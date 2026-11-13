import { ACCOUNT_FEATURES_ENABLED } from "./flag"

export const HIDDEN_ACCOUNT_SECTION_IDS: ReadonlySet<string> = new Set(
  ACCOUNT_FEATURES_ENABLED
    ? []
    : ["custom-actions-notebase", "selection-toolbar-note-suggestion", "subtitles-ai-quota"],
)

export function isHiddenAccountPost(post: { type?: string } | null | undefined): boolean {
  return !ACCOUNT_FEATURES_ENABLED && post?.type === "promotion"
}

export function accountFeatureCopy(enabled: string, disabled = ""): string {
  return ACCOUNT_FEATURES_ENABLED ? enabled : disabled
}

export const MISSING_SUBTITLES_MESSAGE_KEY = ACCOUNT_FEATURES_ENABLED
  ? "subtitles.sidebar.needsSubtitles"
  : "subtitles.errors.noSubtitlesFound"
