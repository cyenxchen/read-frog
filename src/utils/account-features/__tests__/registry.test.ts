import { describe, expect, it, vi } from "vitest"
import { FEATURE_KEYS } from "@/utils/constants/feature-providers"
import { BUILT_IN_AI_PROVIDER_IDS } from "@/utils/constants/provider-ids"
import {
  doesProviderSupportsCapability,
  getProviderIdsForCapability,
  getSelectableProvidersForCapability,
  getSystemProviderIdsForCapability,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

const capabilities = [
  "pageTranslation",
  "selectionTranslation",
  "inputTranslation",
  "videoSubtitles",
  "noteSuggestion",
  "customAction",
  "languageDetection",
] as const

describe("hidden system providers", () => {
  it.each(capabilities)(
    "%s hides hosted providers but accepts their persisted IDs",
    (capability) => {
      expect(getSelectableProvidersForCapability(capability, [])).toEqual([])
      expect(getSystemProviderIdsForCapability(capability)).toEqual([])
      expect(getProviderIdsForCapability(capability, [])).toEqual([])
      for (const id of BUILT_IN_AI_PROVIDER_IDS) {
        expect(resolveProviderRefForCapability(capability, [], id)).toBeNull()
        expect(doesProviderSupportsCapability(capability, [], id, { requireEnable: true })).toBe(
          true,
        )
      }
    },
  )

  it("excludes note suggestion from provider assignments and deletion guards", () => {
    expect(FEATURE_KEYS).not.toContain("noteSuggestion")
    expect(FEATURE_KEYS).toContain("pageTranslation")
  })
})
