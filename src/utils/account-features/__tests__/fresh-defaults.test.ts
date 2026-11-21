import { expect, it, vi } from "vitest"
import { configSchema } from "@/types/config/config"
import { isAPIProviderConfig } from "@/types/config/provider"
import { DEFAULT_CONFIG, buildFreshDefaultConfig } from "@/utils/constants/config"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/constants/provider-ids"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

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
    DEFAULT_BUILT_IN_AI_PROVIDER_ID,
    DEFAULT_BUILT_IN_AI_PROVIDER_ID,
    DEFAULT_BUILT_IN_AI_PROVIDER_ID,
  ])
  expect(config.selectionToolbar.noteSuggestion.providerId).toBe(DEFAULT_BUILT_IN_AI_PROVIDER_ID)
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
