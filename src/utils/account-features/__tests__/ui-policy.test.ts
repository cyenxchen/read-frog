import { expect, it, vi } from "vitest"
import { CUSTOM_ACTION_NOTEBASE_SECTION_ID } from "@/utils/navigation"
import { HIDDEN_ACCOUNT_SECTION_IDS } from "../ui-policy"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
// Simulate upstream renaming the navigation target: its fork policy must follow.
vi.mock("@/utils/navigation", () => ({
  CUSTOM_ACTION_NOTEBASE_SECTION_ID: "renamed-notebase-section",
}))

it("hides the current navigation target even when upstream renames it", () => {
  expect(HIDDEN_ACCOUNT_SECTION_IDS.has(CUSTOM_ACTION_NOTEBASE_SECTION_ID)).toBe(true)
  expect(HIDDEN_ACCOUNT_SECTION_IDS.has("selection-toolbar-note-suggestion")).toBe(true)
  expect(HIDDEN_ACCOUNT_SECTION_IDS.has("subtitles-ai-quota")).toBe(true)
})
