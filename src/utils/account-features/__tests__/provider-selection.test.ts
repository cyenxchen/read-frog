// @vitest-environment jsdom
import { createStore } from "jotai"
import { expect, it, vi } from "vitest"
import { selectedProviderIdAtom } from "@/entrypoints/options/pages/api-providers/providers-config/atoms"
import { configAtom } from "@/utils/atoms/config"
import { buildFreshDefaultConfig } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

it("opens on the first configured API provider when Built-in AI is hidden", () => {
  const store = createStore()
  const config = buildFreshDefaultConfig()
  const provider = { ...DEFAULT_PROVIDER_CONFIG.openai, id: "my-openai" }
  config.providersConfig = [...config.providersConfig, provider, DEFAULT_PROVIDER_CONFIG.deepseek]
  store.set(configAtom, config)

  expect(store.get(selectedProviderIdAtom)).toBe("my-openai")
})
