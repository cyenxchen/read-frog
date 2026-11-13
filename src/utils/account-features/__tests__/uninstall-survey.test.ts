import { afterEach, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { setupUninstallSurvey } from "@/entrypoints/background/uninstall-survey"
import { EXTENSION_VERSION } from "@/utils/constants/app"

const flag = vi.hoisted(() => ({ enabled: false }))
vi.mock("../flag", () => ({
  get ACCOUNT_FEATURES_ENABLED() {
    return flag.enabled
  },
}))
vi.mock("@/utils/i18n", () => ({
  i18n: { t: () => "https://tally.so/r/upstream-survey" },
}))

afterEach(() => {
  flag.enabled = false
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it("clears a previously registered uninstall survey when account features are off", async () => {
  vi.spyOn(browser.i18n, "getUILanguage").mockReturnValue("en")
  const setUninstallURL = vi.spyOn(browser.runtime, "setUninstallURL").mockResolvedValue()
  await setupUninstallSurvey()
  expect(setUninstallURL.mock.calls).toEqual([[""]])
})

it("keeps the upstream survey and its context parameters when account features are on", async () => {
  flag.enabled = true
  vi.stubEnv("BROWSER", "chrome")
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Macintosh) Chrome/153.0.0.0",
    platform: "MacIntel",
    language: "en-US",
  })
  vi.spyOn(browser.i18n, "getUILanguage").mockReturnValue("zh-TW")
  const setUninstallURL = vi.spyOn(browser.runtime, "setUninstallURL").mockResolvedValue()
  await setupUninstallSurvey()
  expect(setUninstallURL).toHaveBeenCalledTimes(1)
  const url = new URL(setUninstallURL.mock.calls[0]![0])
  expect(`${url.origin}${url.pathname}`).toBe("https://tally.so/r/upstream-survey")
  expect(Object.fromEntries(url.searchParams)).toEqual({
    rf_version: EXTENSION_VERSION,
    browser_type: "chrome",
    browser_version: "153.0.0.0",
    os: "MacOS",
    ui_lang: "zh-TW",
  })
})
