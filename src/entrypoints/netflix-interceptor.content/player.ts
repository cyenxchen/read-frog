import type {
  NetflixSubtitlesAction,
  NetflixSubtitlesResponse,
} from "@/utils/subtitles/fetchers/netflix"
import type { TrackLanguagePreference } from "@/utils/subtitles/track-language"
import { resolveLanguage } from "@read-frog/definitions"
import {
  NETFLIX_LOAD_TIMEOUT_MS,
  NETFLIX_SUBTITLES_REQUEST_TYPE,
  NETFLIX_SUBTITLES_RESPONSE_TYPE,
  NETFLIX_PAGE_POLL_INTERVAL_MS,
  NETFLIX_PAGE_WAIT_TIMEOUT_MS,
} from "@/utils/constants/subtitles"
import { pollUntil } from "@/utils/poll"
import { pickByLanguage } from "@/utils/subtitles/track-language"
import { findCapturedTtml } from "./ttml-capture"

interface TimedTextTrack {
  trackId: string
  bcp47: string | null
  isNoneTrack: boolean
  isForcedNarrative: boolean
  isImageBased?: boolean
}

interface NetflixPlayer {
  getMovieId: () => number
  getAudioTrack: () => { bcp47?: string } | null
  getTimedTextTrack: () => TimedTextTrack | null
  getTimedTextTrackList: () => TimedTextTrack[]
  setTimedTextTrack: (track: TimedTextTrack) => void
}

let replacedTrack: { movieId: number; track: TimedTextTrack; pickedTrackId: string } | null = null
let languagePickedMovieId: number | null = null

// Anything on the page can post to this window, so a preference is used only when well formed.
function parseTrackLanguagePreference(value: unknown): TrackLanguagePreference | null {
  if (!value || typeof value !== "object") return null
  const { target, source } = value as Record<string, unknown>
  const targetTag = typeof target === "string" ? resolveLanguage(target) : null
  if (!targetTag) return null
  return { target: targetTag, source: typeof source === "string" ? resolveLanguage(source) : null }
}

// Each wait gets whatever time is left before the request's deadline.
function untilDeadline(deadline: number) {
  return { timeoutMs: deadline - Date.now(), intervalMs: NETFLIX_PAGE_POLL_INTERVAL_MS }
}

function emptyResponse(requestId: string): NetflixSubtitlesResponse {
  return {
    type: NETFLIX_SUBTITLES_RESPONSE_TYPE,
    requestId,
    movieId: null,
    trackId: null,
    language: null,
    translatable: false,
    ttml: null,
  }
}

function getReadyPlayer(): NetflixPlayer | null {
  try {
    const videoPlayer = (window as any).netflix.appContext.state.playerApp.getAPI().videoPlayer
    const sessionIds: string[] = videoPlayer.getAllPlayerSessionIds()
    const sessionId = sessionIds.find((id) => id.startsWith("watch")) ?? sessionIds[0]
    const player: NetflixPlayer | undefined = sessionId
      ? videoPlayer.getVideoPlayerBySessionId(sessionId)
      : undefined
    return player?.getTimedTextTrackList().length ? player : null
  } catch {
    return null
  }
}

function isTranslatable(track: TimedTextTrack | null): track is TimedTextTrack {
  return !!track && !track.isNoneTrack && !track.isForcedNarrative && !track.isImageBased
}

function primaryLanguage(language: string | null | undefined): string {
  return language?.split("-")[0]?.toLowerCase() ?? ""
}

function switchTrack(player: NetflixPlayer, current: TimedTextTrack | null, next: TimedTextTrack) {
  if (current) {
    replacedTrack = { movieId: player.getMovieId(), track: current, pickedTrackId: next.trackId }
  }
  player.setTimedTextTrack(next)
}

// Once per title: the track poll reloads after a restore or a track the viewer picks, and
// switching again then would undo the viewer's choice.
function pickByLanguageOnce(
  player: NetflixPlayer,
  current: TimedTextTrack | null,
  preference: TrackLanguagePreference | null,
): TimedTextTrack | null {
  const movieId = player.getMovieId()
  if (!preference || languagePickedMovieId === movieId) return null
  languagePickedMovieId = movieId

  const tracks = player.getTimedTextTrackList().filter(isTranslatable)
  const next = pickByLanguage(tracks, preference, (track) => ({
    locale: track.bcp47,
    kind: "human",
    selected: track.trackId === current?.trackId,
  }))
  if (next && next.trackId !== current?.trackId) switchTrack(player, current, next)
  return next
}

function ensureTranslatableTrack(
  player: NetflixPlayer,
  preference: TrackLanguagePreference | null,
): TimedTextTrack | null {
  const current = player.getTimedTextTrack()
  const byLanguage = pickByLanguageOnce(player, current, preference)
  if (byLanguage) return byLanguage
  if (isTranslatable(current)) return current

  const tracks = player.getTimedTextTrackList().filter(isTranslatable)
  const audioLanguage = primaryLanguage(player.getAudioTrack()?.bcp47)
  const next =
    tracks.find((track) => primaryLanguage(track.bcp47) === audioLanguage) ??
    tracks.find((track) => primaryLanguage(track.bcp47) === "en") ??
    tracks[0]
  if (!next) return null

  switchTrack(player, current, next)
  return next
}

async function handleRequest(
  requestId: string,
  action: NetflixSubtitlesAction,
  preference: TrackLanguagePreference | null,
): Promise<NetflixSubtitlesResponse> {
  const response = emptyResponse(requestId)
  // A load shares one deadline between the player and its subtitle file, so the content
  // script knows the longest it can take.
  const deadline =
    Date.now() + (action === "load" ? NETFLIX_LOAD_TIMEOUT_MS : NETFLIX_PAGE_WAIT_TIMEOUT_MS)
  const player = await pollUntil(getReadyPlayer, untilDeadline(deadline))
  if (!player) return response

  const movieId = player.getMovieId()
  if (action === "restore") {
    const previous = replacedTrack
    replacedTrack = null
    if (
      previous?.movieId === movieId &&
      player.getTimedTextTrack()?.trackId === previous.pickedTrackId
    ) {
      player.setTimedTextTrack(previous.track)
    }
  }

  const track =
    action === "load" ? ensureTranslatableTrack(player, preference) : player.getTimedTextTrack()
  response.movieId = movieId
  response.trackId = track?.trackId ?? null
  response.language = track?.bcp47 ?? null
  response.translatable = isTranslatable(track)
  if (action === "load" && track && response.translatable) {
    response.ttml = await pollUntil(
      () => findCapturedTtml(movieId, track.trackId),
      untilDeadline(deadline),
    )
  }
  return response
}

export function listenForSubtitlesRequests(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== NETFLIX_SUBTITLES_REQUEST_TYPE
    ) {
      return
    }
    const { requestId, action } = event.data
    const preference = parseTrackLanguagePreference(event.data.preference)
    // Answer even when reading the player throws, so the content script is not left waiting.
    void handleRequest(requestId, action, preference)
      .catch(() => emptyResponse(requestId))
      .then((response) => window.postMessage(response, window.location.origin))
  })
}
