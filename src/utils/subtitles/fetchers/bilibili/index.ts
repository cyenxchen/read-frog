import type { SubtitlesTrack, SubtitlesTrackSource } from "../track"
import type { TrackLanguagePreference } from "@/utils/subtitles/track-language"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { z } from "zod"
import {
  BILIBILI_POST_MESSAGE_TIMEOUT_MS,
  BILIBILI_SUBTITLES_REQUEST_TYPE,
  BILIBILI_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import {
  NoSubtitlesError,
  OverlaySubtitlesError,
  TrackFileNotLoadedError,
} from "@/utils/subtitles/errors"
import { readTrackLanguagePreference } from "@/utils/subtitles/read-track-language-preference"
import { pickByLanguage } from "@/utils/subtitles/track-language"
import { getBilibiliPartId } from "@/utils/subtitles/video-id"
import { fetchWithRetry, readJson } from "../fetch-with-retry"
import { postMessageRequest } from "../post-message-request"

const bilibiliSubtitlesResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  cid: z.number().nullable(),
  subtitles: z.array(z.unknown()).nullable(),
})

export type BilibiliSubtitlesResponse = z.infer<typeof bilibiliSubtitlesResponseSchema>

const subtitleEntrySchema = z.object({ lan: z.string(), subtitle_url: z.string().nonempty() })

type SubtitleEntry = z.infer<typeof subtitleEntrySchema>

const subtitleFileSchema = z.object({
  body: z.array(z.object({ from: z.number(), to: z.number(), content: z.string() })),
})

async function requestBilibiliSubtitles(partId: string): Promise<BilibiliSubtitlesResponse | null> {
  const response = await postMessageRequest(
    BILIBILI_SUBTITLES_RESPONSE_TYPE,
    { type: BILIBILI_SUBTITLES_REQUEST_TYPE, partId },
    BILIBILI_POST_MESSAGE_TIMEOUT_MS,
  )
  const parsed = bilibiliSubtitlesResponseSchema.safeParse(response)
  return parsed.success ? parsed.data : null
}

const isAiSubtitle = (entry: SubtitleEntry) => entry.lan.startsWith("ai-")

// Bilibili names its AI subtitles `ai-<lang>`; the uploader's own are the better source. By
// language, only the uploader's count: an AI one may be a machine translation.
function pickSubtitle(
  subtitles: unknown[],
  preference: TrackLanguagePreference | null,
): SubtitleEntry | null {
  const entries = subtitles.flatMap((subtitle) => {
    const parsed = subtitleEntrySchema.safeParse(subtitle)
    return parsed.success ? [parsed.data] : []
  })
  return (
    pickByLanguage(entries, preference, (entry) => ({
      locale: entry.lan,
      kind: isAiSubtitle(entry) ? "machine" : "human",
    })) ??
    entries.find((entry) => !isAiSubtitle(entry)) ??
    entries[0] ??
    null
  )
}

async function downloadFragments(subtitle: SubtitleEntry): Promise<SubtitlesFragment[]> {
  // `subtitle_url` comes without a scheme, as `//host/path`.
  const response = await fetchWithRetry(new URL(subtitle.subtitle_url, window.location.href))
  const parsed = subtitleFileSchema.safeParse(await readJson(response))
  if (!parsed.success) throw new TrackFileNotLoadedError()

  return parsed.data.body.map(({ from, to, content }) => ({
    text: content,
    start: Math.round(from * 1000),
    end: Math.round(to * 1000),
  }))
}

async function loadTrack(partId: string): Promise<SubtitlesTrack> {
  const response = await requestBilibiliSubtitles(partId)
  // No reply, or a player that never reached this part: either way the wait ran out.
  if (!response || response.cid === null) {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
  }
  if (!response.subtitles) throw new TrackFileNotLoadedError()

  // Bilibili also sends an empty list to a signed-out viewer; signing in is theirs to do.
  const usual = pickSubtitle(response.subtitles, null)
  if (!usual) throw new NoSubtitlesError()

  const byLanguage = pickSubtitle(response.subtitles, await readTrackLanguagePreference())
  // Each pick parses the list afresh, so the same entry is told apart by its file.
  if (byLanguage && byLanguage.subtitle_url !== usual.subtitle_url) {
    const fragments = await downloadFragments(byLanguage)
    // A file of blank lines would leave the part without subtitles; the usual pick still works.
    if (fragments.some((fragment) => fragment.text.trim())) {
      return { language: byLanguage.lan.replace(/^ai-/, ""), fragments }
    }
  }

  return {
    language: usual.lan.replace(/^ai-/, ""),
    fragments: await downloadFragments(usual),
  }
}

export const bilibiliTrackSource: SubtitlesTrackSource = {
  currentKey: getBilibiliPartId,
  load: loadTrack,
}
