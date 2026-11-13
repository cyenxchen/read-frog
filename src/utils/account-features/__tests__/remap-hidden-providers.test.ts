import type { Config } from "@/types/config/config"
import type { VersionTestData } from "@/utils/config/__tests__/example/types"
import { readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { configSchema } from "@/types/config/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  BUILT_IN_AI_PROVIDER_ID,
  BUILT_IN_AI_ADVANCE_PROVIDER_ID,
} from "@/utils/constants/provider-ids"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { remapHiddenProviderRefs } from "../remap-hidden-providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

const exampleModules = import.meta.glob<VersionTestData>("@/utils/config/__tests__/example/v*.ts")
const latestExample = Object.keys(exampleModules).sort(
  (a, b) => Number(b.match(/v(\d+)\.ts$/)![1]) - Number(a.match(/v(\d+)\.ts$/)![1]),
)[0]!
const { testSeries } = await exampleModules[latestExample]!()

const free = BUILT_IN_AI_PROVIDER_ID
const advance = BUILT_IN_AI_ADVANCE_PROVIDER_ID
const providers = [
  { id: "no-key", provider: "openai", enabled: true, apiKey: "   " },
  { id: "first", provider: "anthropic", enabled: true, apiKey: "first-key" },
  { id: "chosen", provider: "openai", enabled: true, apiKey: "chosen-key" },
  { id: "google", provider: "google-translate", enabled: true },
  { id: "microsoft", provider: "microsoft-translate", enabled: true },
]
function fixture() {
  return {
    providersConfig: structuredClone(providers),
    pageTranslation: {
      providerId: free,
      mode: "bilingual" as "bilingual" | "translationOnly",
      extra: "keep",
    },
    inputTranslation: { providerId: advance },
    videoSubtitles: { providerId: free },
    languageDetection: {
      mode: "llm" as "llm" | "basic",
      providerId: advance as string | undefined,
    },
    translationHub: { selectedProviderIds: [free, "chosen", advance, "google"] as string[] | null },
    selectionToolbar: {
      features: { translate: { providerId: advance } },
      builtInActions: { dictionary: { providerId: free }, improveWriting: { providerId: advance } },
      customActions: [{ providerId: free }, { providerId: "chosen" }],
      noteSuggestion: { providerId: "chosen" },
    },
  }
}
function ids(c: ReturnType<typeof fixture>) {
  return {
    page: c.pageTranslation.providerId,
    selection: c.selectionToolbar.features.translate.providerId,
    input: c.inputTranslation.providerId,
    video: c.videoSubtitles.providerId,
    detection: c.languageDetection,
    builtIn: Object.values(c.selectionToolbar.builtInActions).map((a) => a.providerId),
    custom: c.selectionToolbar.customActions.map((a) => a.providerId),
    hub: c.translationHub.selectedProviderIds,
    note: c.selectionToolbar.noteSuggestion.providerId,
  }
}

describe("hidden provider normalization", () => {
  it.each([
    {
      name: "first usable LLM",
      keys: true,
      translate: "first",
      ai: "first",
      hub: ["first", "chosen", "google"],
    },
    {
      name: "Microsoft fallback",
      keys: false,
      translate: "microsoft",
      ai: null,
      hub: ["chosen", "google"],
    },
    {
      name: "no enabled provider",
      keys: false,
      disabled: true,
      translate: null,
      ai: null,
      hub: ["chosen", "google"],
    },
  ])("remaps every slot with $name", ({ keys, disabled, translate, ai, hub }) => {
    const c = fixture()
    if (!keys)
      c.providersConfig.forEach((p) => {
        p.apiKey = undefined
      })
    if (disabled)
      c.providersConfig.forEach((p) => {
        p.enabled = false
      })
    const before = structuredClone(c)
    const result = remapHiddenProviderRefs(c)
    expect(ids(result)).toEqual({
      page: translate ?? free,
      selection: translate ?? advance,
      input: translate ?? advance,
      video: translate ?? free,
      detection: ai ? { mode: "llm", providerId: ai } : { mode: "basic" },
      builtIn: [ai ?? free, ai ?? advance],
      custom: [ai ?? free, "chosen"],
      hub,
      note: free,
    })
    expect(c).toEqual(before)
    expect(result.pageTranslation.extra).toBe("keep")
    expect(remapHiddenProviderRefs(result)).toBe(result)
  })
  it("prefers the usable page-translation LLM while preserving local selections", () => {
    const c = fixture()
    c.pageTranslation.providerId = "chosen"
    const result = remapHiddenProviderRefs(c)
    expect(ids(result)).toMatchObject({
      page: "chosen",
      selection: "chosen",
      input: "chosen",
      video: "chosen",
      builtIn: ["chosen", "chosen"],
    })
    expect(result.pageTranslation).toBe(c.pageTranslation)
  })
  it.each(["openai", "anthropic"])(
    "does not let a %s page provider with no key occupy all AI slots",
    (provider) => {
      const c = fixture()
      c.providersConfig[0]!.provider = provider
      c.pageTranslation.providerId = "no-key"
      expect(remapHiddenProviderRefs(c).selectionToolbar.customActions[0]!.providerId).toBe("first")
    },
  )
  it.each(["ollama", "openai-compatible", "open-responses"])(
    "accepts %s without a key",
    (provider) => {
      const c = fixture()
      c.providersConfig = [{ id: "local", provider, enabled: true, apiKey: "" }]
      expect(remapHiddenProviderRefs(c).pageTranslation.providerId).toBe("local")
    },
  )
  it("ignores disabled keyed LLMs", () => {
    const c = fixture()
    c.providersConfig[1]!.enabled = false
    expect(remapHiddenProviderRefs(c).pageTranslation.providerId).toBe("chosen")
  })
  it("uses the first enabled pure translator when Microsoft is disabled", () => {
    const c = fixture()
    c.providersConfig.forEach((p) => {
      p.apiKey = undefined
      if (p.provider === "microsoft-translate") p.enabled = false
    })
    expect(remapHiddenProviderRefs(c).pageTranslation.providerId).toBe("google")
  })
  it.each([
    {
      name: "Google over earlier translators",
      types: ["deepl", "google-translate", "microsoft-translate"],
      id: "google-translate",
      mode: "translationOnly",
    },
    {
      name: "other markup-capable translator",
      types: ["deepl", "microsoft-translate"],
      id: "deepl",
      mode: "translationOnly",
    },
    {
      name: "bilingual only when all translators lack markup",
      types: ["microsoft-translate"],
      id: "microsoft-translate",
      mode: "bilingual",
    },
  ])("translationOnly uses $name", ({ types, id, mode }) => {
    const c = fixture()
    c.pageTranslation.mode = "translationOnly"
    c.providersConfig = types.map((provider) => ({ id: provider, provider, enabled: true }))
    const result = remapHiddenProviderRefs(c)
    expect(result.pageTranslation).toMatchObject({ providerId: id, mode })
    expect(result.inputTranslation.providerId).toBe("microsoft-translate")
  })
  it("does not change translationOnly for an existing local selection", () => {
    const c = fixture()
    c.pageTranslation = { providerId: "microsoft", mode: "translationOnly", extra: "keep" }
    expect(remapHiddenProviderRefs(c).pageTranslation).toBe(c.pageTranslation)
  })
  it.each([true, false])(
    "emptied hub follows all enabled translators (any translator: %s)",
    (hasTranslator) => {
      const c = fixture()
      c.providersConfig = hasTranslator
        ? [{ id: "google", provider: "google-translate", enabled: true }]
        : []
      c.translationHub.selectedProviderIds = [free, advance]
      expect(remapHiddenProviderRefs(c).translationHub.selectedProviderIds).toBeNull()
    },
  )
  it("deduplicates hub replacements in order and preserves null", () => {
    const c = fixture()
    c.translationHub.selectedProviderIds = ["chosen", free, "first", advance, "google"]
    expect(remapHiddenProviderRefs(c).translationHub.selectedProviderIds).toEqual([
      "chosen",
      "first",
      "google",
    ])
    c.translationHub.selectedProviderIds = null
    expect(remapHiddenProviderRefs(c).translationHub).toBe(c.translationHub)
  })
  it("parks note suggestion even without usable LLMs or other hosted references", () => {
    const c = fixture()
    c.providersConfig = []
    expect(remapHiddenProviderRefs(c).selectionToolbar.noteSuggestion.providerId).toBe(free)
  })
  it("returns the same object after normalization and leaves unrelated local refs alone", () => {
    const c = fixture()
    c.pageTranslation.providerId = "chosen"
    c.inputTranslation.providerId = "google"
    c.videoSubtitles.providerId = "microsoft"
    c.languageDetection = { mode: "basic", providerId: undefined }
    c.translationHub.selectedProviderIds = ["chosen", "google"]
    c.selectionToolbar.features.translate.providerId = "chosen"
    Object.values(c.selectionToolbar.builtInActions).forEach((a) => {
      a.providerId = "chosen"
    })
    c.selectionToolbar.customActions[0]!.providerId = "chosen"
    c.selectionToolbar.noteSuggestion.providerId = free
    expect(remapHiddenProviderRefs(c)).toBe(c)
  })
  it("self-heals dangling AI-only refs on the next parse after a key is added", () => {
    const c = fixture()
    c.providersConfig.forEach((p) => {
      p.apiKey = undefined
    })
    const parked = remapHiddenProviderRefs(c)
    expect(parked.selectionToolbar.customActions[0]!.providerId).toBe(free)
    const keyed = {
      ...parked,
      providersConfig: [
        ...parked.providersConfig,
        { id: "new", provider: "openai", enabled: true, apiKey: "key" },
      ],
    }
    const healed = remapHiddenProviderRefs(keyed)
    expect(healed.selectionToolbar.customActions[0]!.providerId).toBe("new")
    expect(healed.selectionToolbar.builtInActions.dictionary.providerId).toBe("new")
    expect(healed.selectionToolbar.noteSuggestion.providerId).toBe(free)
  })
})

describe("config schema is lenient before remapping", () => {
  function hostedConfig(): Config {
    const c = structuredClone(DEFAULT_CONFIG)
    c.pageTranslation.providerId = free
    c.inputTranslation.providerId = advance
    c.videoSubtitles.providerId = free
    c.selectionToolbar.features.translate.providerId = advance
    Object.values(c.selectionToolbar.builtInActions).forEach((a) => {
      a.providerId = advance
    })
    c.languageDetection = { mode: "llm", providerId: advance }
    c.translationHub.selectedProviderIds = [free, advance]
    c.selectionToolbar.noteSuggestion.providerId = "deleted-note-provider"
    c.language.targetCode = "ja"
    return c
  }
  it("accepts hosted refs without any enabled local provider and preserves user settings", () => {
    const c = hostedConfig()
    c.providersConfig.forEach((p) => {
      p.enabled = false
    })
    const parsed = configSchema.safeParse(c)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.language.targetCode).toBe("ja")
    expect(parsed.data.pageTranslation.providerId).toBe(free)
    expect(parsed.data.languageDetection).toEqual({ mode: "basic" })
    expect(parsed.data.selectionToolbar.noteSuggestion.providerId).toBe(free)
  })
  it("normalizes fresh defaults without resetting any settings", () => {
    const parsed = configSchema.parse(hostedConfig())
    expect(parsed.pageTranslation.providerId).toBe("microsoft-translate-default")
    expect(parsed.language.targetCode).toBe("ja")
  })
  it.each(Object.entries(testSeries))(
    "latest fixture %s parses without hosted translation refs",
    (_name, { config }) => {
      const parsed = configSchema.parse(config)
      for (const id of [
        parsed.pageTranslation.providerId,
        parsed.inputTranslation.providerId,
        parsed.videoSubtitles.providerId,
        parsed.selectionToolbar.features.translate.providerId,
      ]) {
        expect([free, advance]).not.toContain(id)
      }
    },
  )
  function expectReparseInvariant(input: unknown) {
    const parsedOnce = configSchema.safeParse(input)
    expect(parsedOnce.success).toBe(true)
    if (!parsedOnce.success) return
    const parsedTwice = configSchema.safeParse(parsedOnce.data)
    expect(parsedTwice.success).toBe(true)
    if (!parsedTwice.success) return
    expect(parsedTwice.data).toEqual(parsedOnce.data)
    expect(remapHiddenProviderRefs(parsedOnce.data)).toBe(parsedOnce.data)
  }

  it.each([
    "defaults",
    "no enabled provider",
    "usable LLM",
    "keyless local LLM",
    "translationOnly with Google",
    "translationOnly with Microsoft only",
  ])("re-parse invariant holds for hosted config: %s", (variant) => {
    expect.assertions(4)
    const c = hostedConfig()
    if (variant === "no enabled provider") {
      c.providersConfig.forEach((p) => {
        p.enabled = false
      })
    }
    if (variant === "usable LLM") {
      Object.assign(
        c.providersConfig.find((p) => p.provider === "openai")!,
        { enabled: true, apiKey: "key" },
      )
    }
    if (variant === "keyless local LLM") {
      c.providersConfig.push({ ...structuredClone(DEFAULT_PROVIDER_CONFIG.ollama), enabled: true })
    }
    if (variant.startsWith("translationOnly")) {
      c.pageTranslation.mode = "translationOnly"
      c.providersConfig = c.providersConfig.filter(
        (p) =>
          p.provider === "microsoft-translate" ||
          (variant.endsWith("Google") && p.provider === "google-translate"),
      )
      c.providersConfig.forEach((p) => {
        p.enabled = true
      })
    }
    expectReparseInvariant(c)
  })

  it.each(Object.entries(testSeries))(
    "re-parse invariant holds for latest fixture %s",
    (_name, { config }) => {
      expect.assertions(4)
      expectReparseInvariant(config)
    },
  )
})

it("uses the highest-numbered config example module", async () => {
  const directory = new URL("../../config/__tests__/example/", import.meta.url)
  const latestVersion = Math.max(
    ...readdirSync(fileURLToPath(directory)).flatMap((name) => {
      const match = /^v(\d+)\.ts$/.exec(name)
      return match ? [Number(match[1])] : []
    }),
  )
  const newest = await exampleModules[`/src/utils/config/__tests__/example/v${latestVersion}.ts`]!()
  expect(testSeries).toBe(newest.testSeries)
})
