import type { LanguageTag } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { isSameLanguage, resolveLanguage } from "@read-frog/definitions"

// Kept free of page-language detection on purpose: Netflix's MAIN-world page script picks
// tracks with this module too.

/** The languages a subtitle track is picked by, from the reader's language settings. */
export interface TrackLanguagePreference {
  target: LanguageTag
  /** `null` while the source language is detected automatically. */
  source: LanguageTag | null
}

/**
 * What a track is, for picking by language. A machine-translated track is never picked: as the
 * target language it is no better than our own translation, and as the source it would be
 * translated twice.
 */
export interface TrackLanguageInfo {
  locale: string | null | undefined
  kind: "human" | "asr" | "machine"
  /** The track the player shows now. */
  selected?: boolean
}

/** `null` while the setting is off: every platform then picks its track as it always has. */
export function getTrackLanguagePreference(
  config: Config | null | undefined,
): TrackLanguagePreference | null {
  if (!config?.videoSubtitles?.preferLanguageMatchedTrack) return null
  const { sourceCode, targetCode } = config.language
  return { target: targetCode, source: sourceCode === "auto" ? null : sourceCode }
}

/**
 * Same rule as the check that shows a track untranslated, so a track picked as the target
 * language is never sent for translation. Variants differ: `zh-Hant` is not `zh-Hans`.
 */
export function isTrackInLanguage(
  locale: string | null | undefined,
  language: LanguageTag,
): boolean {
  const resolved = resolveLanguage(locale?.trim())
  return resolved !== null && isSameLanguage(resolved, language)
}

const KIND_RANK: Record<TrackLanguageInfo["kind"], number> = { human: 0, asr: 1, machine: 2 }

function pickInLanguage<T>(
  candidates: readonly T[],
  language: LanguageTag,
  describe: (track: T) => TrackLanguageInfo,
): T | null {
  let best: { track: T; rank: number } | null = null
  for (const track of candidates) {
    const info = describe(track)
    if (info.kind === "machine" || !isTrackInLanguage(info.locale, language)) continue
    const rank = info.selected ? -1 : KIND_RANK[info.kind]
    if (!best || rank < best.rank) best = { track, rank }
  }
  return best?.track ?? null
}

/**
 * A track already in the target language, else one in the source language; within a language,
 * the one the player shows, then a human one, then speech recognition. `null` when there is no
 * preference or no such track, and the caller picks the way it always has.
 */
export function pickByLanguage<T>(
  candidates: readonly T[],
  preference: TrackLanguagePreference | null,
  describe: (track: T) => TrackLanguageInfo,
): T | null {
  if (!preference) return null
  return (
    pickInLanguage(candidates, preference.target, describe) ??
    (preference.source ? pickInLanguage(candidates, preference.source, describe) : null)
  )
}
