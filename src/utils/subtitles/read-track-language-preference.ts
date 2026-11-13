import type { TrackLanguagePreference } from "./track-language"
import { getLocalConfig } from "@/utils/config/storage"
import { getTrackLanguagePreference } from "./track-language"

/**
 * The reader's track-language preference, read from storage. Kept apart from `track-language` so
 * that module stays free of storage for Netflix's page script. A config that cannot be read
 * picks tracks the way they always were picked.
 */
export async function readTrackLanguagePreference(): Promise<TrackLanguagePreference | null> {
  try {
    return getTrackLanguagePreference(await getLocalConfig())
  } catch {
    return null
  }
}
