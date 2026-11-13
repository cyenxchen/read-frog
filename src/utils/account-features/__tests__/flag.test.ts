import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it("disables account features in a production build", async () => {
  vi.stubEnv("MODE", "production")
  vi.resetModules()
  const { ACCOUNT_FEATURES_ENABLED } = await import("../flag")
  expect(ACCOUNT_FEATURES_ENABLED).toBe(false)
})

it("preserves upstream behavior under WxtVitest", async () => {
  const { ACCOUNT_FEATURES_ENABLED } = await import("../flag")
  expect(import.meta.env.MODE).toBe("test")
  expect(ACCOUNT_FEATURES_ENABLED).toBe(true)
})

it("keeps config normalization an identity operation in upstream tests", async () => {
  const { DEFAULT_CONFIG } = await import("@/utils/constants/config")
  const { remapHiddenProviderRefs } = await import("../remap-hidden-providers")
  expect(remapHiddenProviderRefs(DEFAULT_CONFIG)).toBe(DEFAULT_CONFIG)
})
