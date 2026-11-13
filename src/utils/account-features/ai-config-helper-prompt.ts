import type { SupportedUiLocale } from "@/utils/i18n/locales"
import { translateIn } from "@/utils/i18n"
import { ACCOUNT_FEATURES_ENABLED } from "./flag"

// Keep the upstream template intact; remove only instructions for hidden surfaces.
// The current action's mapped-fields notice is gated at its source, where it can
// be distinguished from arbitrary user-authored prompts, layouts and field names.
export function filterAccountFeaturesFromAiPrompt(
  prompt: string,
  uiLocale: SupportedUiLocale,
): string {
  if (ACCOUNT_FEATURES_ENABLED) return prompt

  const notebaseLabel = translateIn("en", "options.selectionToolbar.customActions.tabs.notebase")
  const lines = prompt.split("\n")
  if (uiLocale !== "en") {
    const glossaryRow = lines.findIndex((line) => line.startsWith(`- ${notebaseLabel} → `))
    if (glossaryRow >= 0) lines.splice(glossaryRow, 1)
  }
  return lines
    .join("\n")
    .replace(
      "The editor has two tabs: Config (every setting below, in this order) and Notebase.",
      "The editor contains the Config settings below, in this order.",
    )
    .replace("Read Frog's built-in AI, or ", "")
    .replace(/^With Read Frog's built-in AI:.*\n/m, "")
    .replace(
      " (the built-in Sentence Analysis and Improve Writing start with one, so the Notebase keeps the sentence)",
      "",
    )
    .replace(/^### Notebase tab\nOptionally saves every result[^\n]*\n\n/m, "")
    .replace(" unless it exists only for the Notebase", "")
}
