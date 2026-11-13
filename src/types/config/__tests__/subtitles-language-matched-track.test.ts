import { describe, expect, it } from "vitest"
import { testSeries } from "@/utils/config/__tests__/example/v123"
import { configSchema } from "../config"

// The setting ships without a migration so this copy keeps upstream's version numbers: a config
// stored before it existed must still parse, with the setting off.
describe("preferLanguageMatchedTrack in a stored v123 config", () => {
  it.each(Object.entries(testSeries))("is filled in as off for %s", (_name, { config }) => {
    const parsed = configSchema.safeParse(config)

    expect(parsed.success).toBe(true)
    expect(parsed.data?.videoSubtitles.preferLanguageMatchedTrack).toBe(false)
  })
})
