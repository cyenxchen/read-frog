import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v123-to-v124"

describe("v123-to-v124 migration", () => {
  it("adds picking subtitle tracks by language, off", () => {
    const oldConfig = { videoSubtitles: { enabled: true, pauseOnHover: false } }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      videoSubtitles: { enabled: true, pauseOnHover: false, preferLanguageMatchedTrack: false },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toBe(migrated)
  })

  it("keeps a choice the reader already made", () => {
    const config = { videoSubtitles: { preferLanguageMatchedTrack: true } }

    expect(migrate(config)).toBe(config)
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ videoSubtitles: null })).toEqual({ videoSubtitles: null })
    expect(migrate({ videoSubtitles: [] })).toEqual({ videoSubtitles: [] })
  })
})
