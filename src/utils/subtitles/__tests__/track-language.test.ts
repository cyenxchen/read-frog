import type { TrackLanguageInfo } from "../track-language"
import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getTrackLanguagePreference, isTrackInLanguage, pickByLanguage } from "../track-language"

function configWith(
  preferLanguageMatchedTrack: boolean,
  language: Partial<Config["language"]> = {},
): Config {
  return {
    ...DEFAULT_CONFIG,
    language: { ...DEFAULT_CONFIG.language, ...language },
    videoSubtitles: { ...DEFAULT_CONFIG.videoSubtitles, preferLanguageMatchedTrack },
  }
}

describe("getTrackLanguagePreference", () => {
  it("has no preference while the setting is off", () => {
    expect(getTrackLanguagePreference(configWith(false, { sourceCode: "en" }))).toBeNull()
  })

  it("has no preference without a config", () => {
    expect(getTrackLanguagePreference(null)).toBeNull()
  })

  it("takes the target and source languages from the reader's settings", () => {
    expect(
      getTrackLanguagePreference(configWith(true, { sourceCode: "en", targetCode: "ja" })),
    ).toEqual({ target: "ja", source: "en" })
  })

  it("has no source language while the source is detected automatically", () => {
    expect(
      getTrackLanguagePreference(configWith(true, { sourceCode: "auto", targetCode: "zh-Hans" })),
    ).toEqual({ target: "zh-Hans", source: null })
  })
})

describe("isTrackInLanguage", () => {
  it.each(["zh", "zh-Hans", "zh-CN", "cmn"])("counts %s as Simplified Chinese", (locale) => {
    expect(isTrackInLanguage(locale, "zh-Hans")).toBe(true)
  })

  it.each(["zh-Hant", "zh-TW", "zh-HK"])("does not count %s as Simplified Chinese", (locale) => {
    expect(isTrackInLanguage(locale, "zh-Hans")).toBe(false)
  })

  // Matches the untranslated-track check, which shows a `pt-PT` track as is to a `pt-BR` reader.
  it("counts a European Portuguese track for a Brazilian reader, as pages do", () => {
    expect(isTrackInLanguage("pt-PT", "pt-BR")).toBe(true)
  })

  it.each([null, undefined, "", "und"])("never matches an unknown language (%s)", (locale) => {
    expect(isTrackInLanguage(locale, "zh-Hans")).toBe(false)
  })
})

interface Track {
  id: string
  info: TrackLanguageInfo
}

const track = (id: string, info: TrackLanguageInfo): Track => ({ id, info })
const pick = (tracks: Track[], preference: Parameters<typeof pickByLanguage>[1]) =>
  pickByLanguage(tracks, preference, (t) => t.info)?.id ?? null

describe("pickByLanguage", () => {
  const zhEn = { target: "zh-Hans", source: "en" } as const

  it("picks nothing without a preference", () => {
    expect(pick([track("zh", { locale: "zh", kind: "human" })], null)).toBeNull()
  })

  it("prefers a target-language track over a source-language one", () => {
    const tracks = [
      track("en", { locale: "en", kind: "human", selected: true }),
      track("zh", { locale: "zh-Hans", kind: "human" }),
    ]
    expect(pick(tracks, zhEn)).toBe("zh")
  })

  it("falls back to a source-language track when there is no target-language one", () => {
    const tracks = [
      track("ja", { locale: "ja", kind: "human", selected: true }),
      track("en", { locale: "en", kind: "human" }),
    ]
    expect(pick(tracks, zhEn)).toBe("en")
  })

  it("picks nothing when neither language is there", () => {
    expect(pick([track("ja", { locale: "ja", kind: "human" })], zhEn)).toBeNull()
  })

  it("does not look for a source-language track when the source is detected", () => {
    expect(
      pick([track("en", { locale: "en", kind: "human" })], { target: "zh-Hans", source: null }),
    ).toBeNull()
  })

  it("within a language, takes the selected track, then a human one, then speech recognition", () => {
    const asr = track("asr", { locale: "zh", kind: "asr" })
    const human = track("human", { locale: "zh-CN", kind: "human" })
    const selectedAsr = track("selected", { locale: "zh-Hans", kind: "asr", selected: true })

    expect(pick([asr, human], zhEn)).toBe("human")
    expect(pick([asr, human, selectedAsr], zhEn)).toBe("selected")
    expect(pick([asr], zhEn)).toBe("asr")
  })

  it("never picks a machine-translated track", () => {
    const tracks = [
      track("mt-zh", { locale: "zh-Hans", kind: "machine", selected: true }),
      track("mt-en", { locale: "en", kind: "machine" }),
    ]
    expect(pick(tracks, zhEn)).toBeNull()
  })
})
