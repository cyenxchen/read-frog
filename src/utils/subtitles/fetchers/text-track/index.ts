import type { SubtitlesFetcher } from "../types"
import type { TrackLanguagePreference } from "@/utils/subtitles/track-language"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import {
  TEXT_TRACK_CUE_POLL_INTERVAL_MS,
  TEXT_TRACK_CUE_WAIT_TIMEOUT_MS,
  TEXT_TRACK_NATIVE_REHIDE_DELAY_MS,
} from "@/utils/constants/subtitles"
import { pollUntil } from "@/utils/poll"
import { NoSubtitlesError, VideoNotFoundError } from "@/utils/subtitles/errors"
import { readTrackLanguagePreference } from "@/utils/subtitles/read-track-language-preference"
import { pickByLanguage } from "@/utils/subtitles/track-language"
import { cuesToFragments } from "./cues"

interface TextTrackFetcherOptions {
  resolveVideo: () => HTMLVideoElement | null
  getVideoId: () => string | null
  isSourceTrack?: (track: TextTrack) => boolean
}

const SUBTITLE_KINDS = new Set<TextTrackKind>(["subtitles", "captions"])

export class TextTrackFetcher implements SubtitlesFetcher {
  private subtitles: SubtitlesFragment[] = []
  private sourceLanguage = ""
  private cachedTrackHash: string | null = null
  // Language-picked tracks that never got a cue; picked by language no more until cleanup.
  private emptyLanguageTracks = new Set<string>()
  private playerModes = new Map<TextTrack, TextTrackMode>()
  private rehideTimer: ReturnType<typeof setTimeout> | null = null
  private watchedTracks: TextTrackList | null = null
  // Only we set "hidden", so any other mode is what the player now wants restored.
  private readonly rehideOnTrackChange = () => {
    for (const track of Array.from(this.watchedTracks ?? [])) {
      if (track.mode !== "hidden") {
        this.playerModes.set(track, track.mode)
      }
    }
    this.hideShowingTracks()
  }

  constructor(private options: TextTrackFetcherOptions) {}

  async fetch(): Promise<SubtitlesFragment[]> {
    const video = this.options.resolveVideo()
    if (!video) {
      throw new VideoNotFoundError()
    }

    const preference = await readTrackLanguagePreference()
    const usual = this.selectTrack(video)
    const byLanguage = this.selectTrackByLanguage(video, preference)
    if (byLanguage && byLanguage !== usual) {
      try {
        return await this.loadTrack(byLanguage)
      } catch (error) {
        if (!(error instanceof NoSubtitlesError)) throw error
        // A player may load cues only for the track it shows: the usual pick still works, and
        // the empty track is skipped from now on so the track poll does not try it again.
        this.emptyLanguageTracks.add(this.buildTrackHash(byLanguage))
      }
    }

    if (!usual) {
      throw new NoSubtitlesError()
    }
    return this.loadTrack(usual)
  }

  private async loadTrack(track: TextTrack): Promise<SubtitlesFragment[]> {
    const trackHash = this.buildTrackHash(track)
    if (this.subtitles.length > 0 && this.cachedTrackHash === trackHash) {
      return this.subtitles
    }

    this.ensureLoading(track)
    const fragments = cuesToFragments(await this.waitForCues(track))
    if (fragments.length === 0) {
      throw new NoSubtitlesError()
    }

    this.subtitles = fragments
    this.sourceLanguage = track.language
    this.cachedTrackHash = trackHash

    return fragments
  }

  getSourceLanguage(): string {
    return this.sourceLanguage
  }

  // A track can be there and never get a cue, so checking loads the cues and `fetch` reuses them.
  // A missing video is not a captionless one, so that error goes to the caller.
  async hasAvailableSubtitles(): Promise<boolean> {
    const preference = await readTrackLanguagePreference()
    // The reader can pick another track while the cues load; the answer is for the one picked.
    for (;;) {
      const picked = this.pickedTrackHash(preference)
      const found = await this.fetch().then(
        () => true,
        (error: unknown) => {
          if (error instanceof NoSubtitlesError) return false
          throw error
        },
      )
      if (this.pickedTrackHash(preference) === picked) return found
    }
  }

  async shouldUseSameTrack(): Promise<boolean> {
    if (this.subtitles.length === 0 || !this.cachedTrackHash) return false
    const preference = await readTrackLanguagePreference()
    return this.pickedTrackHash(preference) === this.cachedTrackHash
  }

  hideNativeSubtitles(): void {
    this.hideShowingTracks()
    this.clearRehideTimer()
    this.rehideTimer = setTimeout(() => {
      this.rehideTimer = null
      this.hideShowingTracks()
    }, TEXT_TRACK_NATIVE_REHIDE_DELAY_MS)
    this.watchTrackChanges()
  }

  showNativeSubtitles(): void {
    // Before restoring, or putting a track back to "showing" re-triggers the watcher.
    this.unwatchTrackChanges()
    this.clearRehideTimer()
    for (const [track, mode] of this.playerModes) {
      // A track the player moved off our "hidden" already has the mode it wants.
      if (track.mode === "hidden") {
        track.mode = mode
      }
    }
    this.playerModes.clear()
  }

  cleanup(): void {
    this.showNativeSubtitles()
    this.subtitles = []
    this.sourceLanguage = ""
    this.cachedTrackHash = null
    this.emptyLanguageTracks.clear()
  }

  private buildTrackHash(track: TextTrack): string {
    return [this.options.getVideoId() ?? "", track.language, track.label, track.kind].join(":")
  }

  // The same pick `fetch` makes, so a track poll does not see a change where there is none.
  private pickedTrackHash(preference: TrackLanguagePreference | null): string | null {
    const video = this.options.resolveVideo()
    const track = video
      ? (this.selectTrackByLanguage(video, preference) ?? this.selectTrack(video))
      : null
    return track ? this.buildTrackHash(track) : null
  }

  private candidateTracks(video: HTMLVideoElement): TextTrack[] {
    const { isSourceTrack } = this.options
    return Array.from(video.textTracks).filter(
      (track) => SUBTITLE_KINDS.has(track.kind) && (!isSourceTrack || isSourceTrack(track)),
    )
  }

  private isPlayerShowing(track: TextTrack): boolean {
    // A track the player shows is still its pick once we hide it under our overlay.
    return (this.playerModes.get(track) ?? track.mode) === "showing"
  }

  private selectTrackByLanguage(
    video: HTMLVideoElement,
    preference: TrackLanguagePreference | null,
  ): TextTrack | null {
    const tracks = this.candidateTracks(video).filter(
      (track) => !this.emptyLanguageTracks.has(this.buildTrackHash(track)),
    )
    return pickByLanguage(tracks, preference, (track) => ({
      locale: track.language,
      kind: "human",
      selected: this.isPlayerShowing(track),
    }))
  }

  private selectTrack(video: HTMLVideoElement): TextTrack | null {
    const candidates = this.candidateTracks(video)
    return (
      // A track the player shows is still its pick once we hide it under our overlay.
      candidates.find((track) => (this.playerModes.get(track) ?? track.mode) === "showing") ??
      candidates.find((track) => track.kind === "subtitles") ??
      candidates[0] ??
      null
    )
  }

  private setMode(track: TextTrack, mode: TextTrackMode): void {
    // Only a mode other than our "hidden" changes here, so it is the player's latest choice.
    this.playerModes.set(track, track.mode)
    track.mode = mode
  }

  private ensureLoading(track: TextTrack): void {
    if (track.mode === "disabled") {
      this.setMode(track, "hidden")
    }
  }

  private hideShowingTracks(): void {
    const video = this.options.resolveVideo()
    if (!video) {
      return
    }

    for (const track of Array.from(video.textTracks)) {
      if (track.mode === "showing") {
        this.setMode(track, "hidden")
      }
    }
  }

  // The player can reveal captions long after we hid them, so stay subscribed.
  private watchTrackChanges(): void {
    const tracks = this.options.resolveVideo()?.textTracks ?? null
    if (!tracks || tracks === this.watchedTracks) {
      return
    }

    this.unwatchTrackChanges()
    this.watchedTracks = tracks
    tracks.addEventListener("addtrack", this.rehideOnTrackChange)
    tracks.addEventListener("change", this.rehideOnTrackChange)
  }

  private unwatchTrackChanges(): void {
    this.watchedTracks?.removeEventListener("addtrack", this.rehideOnTrackChange)
    this.watchedTracks?.removeEventListener("change", this.rehideOnTrackChange)
    this.watchedTracks = null
  }

  private clearRehideTimer(): void {
    if (this.rehideTimer !== null) {
      clearTimeout(this.rehideTimer)
      this.rehideTimer = null
    }
  }

  private async waitForCues(track: TextTrack): Promise<TextTrackCueList> {
    const cues = await pollUntil(() => (track.cues?.length ? track.cues : null), {
      timeoutMs: TEXT_TRACK_CUE_WAIT_TIMEOUT_MS,
      intervalMs: TEXT_TRACK_CUE_POLL_INTERVAL_MS,
    })
    if (!cues) {
      throw new NoSubtitlesError()
    }
    return cues
  }
}
