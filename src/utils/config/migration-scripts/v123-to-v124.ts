/**
 * Migration script from v123 to v124
 * - Adds `videoSubtitles.preferLanguageMatchedTrack`: pick the subtitle track
 *   by the reader's language settings — a track already in the target
 *   language is shown as it is, else a source-language track is translated.
 *   Off: in bilingual mode a target-language track shows one line instead of
 *   two, a visible change readers choose for themselves.
 *
 * Idempotent: a config that already has the field is returned by identity.
 *
 * IMPORTANT: The default is hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants, helpers, or shared types.
 */
export function migrate(oldConfig: any): any {
  const videoSubtitles = oldConfig?.videoSubtitles
  if (
    !videoSubtitles ||
    typeof videoSubtitles !== "object" ||
    Array.isArray(videoSubtitles) ||
    typeof videoSubtitles.preferLanguageMatchedTrack === "boolean"
  ) {
    return oldConfig
  }

  return {
    ...oldConfig,
    videoSubtitles: { ...videoSubtitles, preferLanguageMatchedTrack: false },
  }
}
