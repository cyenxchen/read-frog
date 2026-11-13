// @vitest-environment jsdom

import type { BilibiliSubtitlesResponse } from ".."
import type { TrackLanguagePreference } from "@/utils/subtitles/track-language"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NoSubtitlesError } from "@/utils/subtitles/errors"
import { bilibiliTrackSource } from ".."

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))
vi.mock("@/utils/sleep", () => ({ sleep: () => Promise.resolve() }))

const postMessageRequest = vi.fn<(...args: unknown[]) => Promise<unknown>>()
vi.mock("@/utils/subtitles/fetchers/post-message-request", () => ({
  postMessageRequest: (...args: unknown[]) => postMessageRequest(...args),
}))

const readTrackLanguagePreference = vi.fn<() => Promise<TrackLanguagePreference | null>>()
vi.mock("@/utils/subtitles/read-track-language-preference", () => ({
  readTrackLanguagePreference: () => readTrackLanguagePreference(),
}))

const HUMAN = { lan: "zh-CN", subtitle_url: "//i0.hdslb.com/bfs/subtitle/zh.json" }
const AI = { lan: "ai-zh", subtitle_url: "//aisubtitle.hdslb.com/bfs/ai_subtitle/zh.json" }
const FILE = {
  body: [
    { from: 3.12, to: 4.34, content: "在我的印象中", music: 0 },
    { from: 0.22, to: 3.12, content: " 这就是刚刚发布的手机 " },
  ],
}

function response(overrides: Partial<BilibiliSubtitlesResponse> = {}): BilibiliSubtitlesResponse {
  return {
    type: "response",
    requestId: "1",
    cid: 42,
    subtitles: [AI, HUMAN],
    ...overrides,
  }
}

const PART_ID = "BV1XZn26rE8x:2"
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  window.history.replaceState(null, "", "/video/BV1XZn26rE8x/?p=2")
  postMessageRequest.mockResolvedValue(response())
  readTrackLanguagePreference.mockResolvedValue(null)
  fetchMock.mockImplementation(async () => Response.json(FILE))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe("bilibiliTrackSource", () => {
  it("keys the track by the video part in the url", () => {
    expect(bilibiliTrackSource.currentKey()).toBe("BV1XZn26rE8x:2")
  })

  it("asks the page for the part and loads the uploader's subtitles, in milliseconds", async () => {
    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toEqual({
      language: "zh-CN",
      fragments: [
        { text: "在我的印象中", start: 3120, end: 4340 },
        { text: " 这就是刚刚发布的手机 ", start: 220, end: 3120 },
      ],
    })
    expect(postMessageRequest.mock.lastCall?.[1]).toMatchObject({ partId: PART_ID })
    expect(fetchMock.mock.lastCall?.[0]).toEqual(
      new URL("https://i0.hdslb.com/bfs/subtitle/zh.json"),
    )
  })

  it("falls back to AI subtitles, skipping entries it cannot read", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: [{ lan: 1 }, AI] }))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "zh" })
  })

  it("reports no subtitles when the list is empty, as it is for a signed-out viewer", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: [] }))

    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toBeInstanceOf(NoSubtitlesError)
  })

  it("reports a timeout when the page never names the part", async () => {
    postMessageRequest.mockResolvedValue(response({ cid: null, subtitles: null }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )

    postMessageRequest.mockResolvedValue(null)
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.fetchSubTimeout",
    )
  })

  it("asks for the file again when the subtitle host drops the request", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

    await expect(bilibiliTrackSource.load(PART_ID)).resolves.toMatchObject({ language: "zh-CN" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("reports a load failure when the list or the file cannot be had", async () => {
    postMessageRequest.mockResolvedValue(response({ subtitles: null }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    postMessageRequest.mockResolvedValue(response())
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    fetchMock.mockResolvedValue(Response.json({ body: "not a list" }))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )

    fetchMock.mockRejectedValue(new TypeError("network"))
    await expect(bilibiliTrackSource.load(PART_ID)).rejects.toThrow(
      "subtitles.errors.trackFileNotLoaded",
    )
  })
})

describe("bilibiliTrackSource by language settings", () => {
  const EN = { lan: "en-US", subtitle_url: "//i0.hdslb.com/bfs/subtitle/en.json" }
  const JA = { lan: "ja", subtitle_url: "//i0.hdslb.com/bfs/subtitle/ja.json" }
  const AI_EN = { lan: "ai-en", subtitle_url: "//aisubtitle.hdslb.com/bfs/ai_subtitle/en.json" }

  async function loadedLanguage() {
    return (await bilibiliTrackSource.load(PART_ID)).language
  }

  it("loads the uploader's target-language subtitles over one listed first", async () => {
    readTrackLanguagePreference.mockResolvedValue({ target: "zh-Hans", source: null })
    postMessageRequest.mockResolvedValue(response({ subtitles: [EN, HUMAN] }))

    await expect(loadedLanguage()).resolves.toBe("zh-CN")
  })

  it("downloads a blank file once when the usual pick is already in the target language", async () => {
    readTrackLanguagePreference.mockResolvedValue({ target: "zh-Hans", source: null })
    postMessageRequest.mockResolvedValue(response({ subtitles: [HUMAN, EN] }))
    fetchMock.mockImplementation(async () =>
      Response.json({ body: [{ from: 0, to: 1, content: " " }] }),
    )

    await expect(loadedLanguage()).resolves.toBe("zh-CN")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to the uploader's source-language subtitles", async () => {
    readTrackLanguagePreference.mockResolvedValue({ target: "zh-Hans", source: "en" })
    postMessageRequest.mockResolvedValue(response({ subtitles: [JA, EN] }))

    await expect(loadedLanguage()).resolves.toBe("en-US")
  })

  it("never picks AI subtitles by language, which may be machine-translated", async () => {
    readTrackLanguagePreference.mockResolvedValue({ target: "en", source: null })
    postMessageRequest.mockResolvedValue(response({ subtitles: [JA, AI_EN] }))

    await expect(loadedLanguage()).resolves.toBe("ja")
  })

  it("falls back to the usual pick when the language-picked file holds only blank lines", async () => {
    readTrackLanguagePreference.mockResolvedValue({ target: "zh-Hans", source: null })
    postMessageRequest.mockResolvedValue(response({ subtitles: [EN, HUMAN] }))
    fetchMock.mockImplementation(async (url) =>
      (url instanceof Request ? url.url : url.toString()).includes("zh.json")
        ? Response.json({ body: [{ from: 0, to: 1, content: " " }] })
        : Response.json(FILE),
    )

    await expect(loadedLanguage()).resolves.toBe("en-US")
  })

  it("keeps the usual pick while the setting is off", async () => {
    readTrackLanguagePreference.mockResolvedValue(null)
    postMessageRequest.mockResolvedValue(response({ subtitles: [EN, HUMAN] }))

    await expect(loadedLanguage()).resolves.toBe("en-US")
  })
})
