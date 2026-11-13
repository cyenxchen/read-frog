import { expect, it, vi } from "vitest"
import { configSchema } from "@/types/config/config"
import { isAPIProviderConfig } from "@/types/config/provider"
import { selectFreshTranslateProviders } from "@/utils/config/default-translate-provider"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG, buildFreshDefaultConfig } from "@/utils/constants/config"
import { FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { isGoogleTranslateReachable } from "@/utils/host/translate/api/google"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/utils/host/translate/api/google", () => ({
  isGoogleTranslateReachable: vi.fn<() => Promise<boolean>>(),
}))

it.each([
  ["fresh builder", buildFreshDefaultConfig],
  ["default constant", () => DEFAULT_CONFIG],
])("%s parses with only non-API translators and parked AI slots", (_name, build) => {
  const result = configSchema.safeParse(build())
  expect(result.success).toBe(true)
  if (!result.success) return
  const config = result.data
  expect(config.providersConfig.map((p) => p.provider)).toEqual([
    "google-translate",
    "microsoft-translate",
  ])
  expect(config.providersConfig.filter(isAPIProviderConfig)).toEqual([])
  expect([
    config.pageTranslation.providerId,
    config.inputTranslation.providerId,
    config.videoSubtitles.providerId,
    config.selectionToolbar.features.translate.providerId,
  ]).toEqual(Array.from({ length: 4 }, () => "microsoft-translate-default"))
  expect(Object.values(config.selectionToolbar.builtInActions).map((a) => a.providerId)).toEqual([
    BUILT_IN_AI_PROVIDER_ID,
    BUILT_IN_AI_PROVIDER_ID,
    BUILT_IN_AI_PROVIDER_ID,
  ])
  expect(config.selectionToolbar.noteSuggestion.providerId).toBe(BUILT_IN_AI_PROVIDER_ID)
  expect(config.translationHub.selectedProviderIds).toBeNull()
  expect(configSchema.parse(config)).toEqual(config)
})

it("preserves API providers in stored, imported and synced configs", () => {
  const config = structuredClone(buildFreshDefaultConfig())
  config.providersConfig = config.providersConfig.filter((p) => !isAPIProviderConfig(p))
  config.providersConfig.push(
    structuredClone(DEFAULT_PROVIDER_CONFIG.openai),
    structuredClone(DEFAULT_PROVIDER_CONFIG.jalapenocloud),
    structuredClone(DEFAULT_PROVIDER_CONFIG.ifapi),
    structuredClone(DEFAULT_PROVIDER_CONFIG.deepseek),
  )
  expect(configSchema.parse(config).providersConfig).toEqual(config.providersConfig)
})

it.each([
  [true, "google-translate"],
  [false, "microsoft-translate"],
] as const)(
  "fresh translator selection resolves correctly with Google reachable: %s",
  async (reachable, provider) => {
    await setLocalConfig(buildFreshDefaultConfig())
    vi.mocked(isGoogleTranslateReachable).mockResolvedValue(reachable)
    await selectFreshTranslateProviders()
    const config = (await getLocalConfig())!
    for (const capability of [
      "pageTranslation",
      "inputTranslation",
      "videoSubtitles",
      "selectionTranslation",
    ] as const) {
      const id = FEATURE_PROVIDER_DEFS[capability].getProviderId(config)
      expect(resolveProviderRefForCapability(capability, config.providersConfig, id)).toMatchObject(
        {
          kind: "local",
          config: { provider },
        },
      )
    }
    expect(config.providersConfig.filter(isAPIProviderConfig)).toEqual([])
  },
)
