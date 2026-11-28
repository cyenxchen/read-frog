import { expect, it, vi } from "vitest"
import { getShortcutBindings } from "@/entrypoints/options/pages/shortcuts/shortcut-bindings"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getSelectionContextMenuItems } from "@/utils/context-menu"
import { FEATURE_IDS, TOP_LEVEL_FEATURES } from "@/utils/features"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"

vi.mock("@/utils/account-features/flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

it("makes retired fork features inert even when saved settings enable them", () => {
  const config = structuredClone(DEFAULT_CONFIG)
  config.translationHub.shortcut = "Alt+Shift+H"
  config.selectionToolbar.features.speak.enabled = true
  config.difficultWords.enabled = true

  const shortcuts = getShortcutBindings(config, { difficultWords: true }).map((item) => item.id)
  const selectionMenu = getSelectionContextMenuItems(config).map((item) => item.id)
  const toolbar = getSelectionToolbarItems(config).filter((item) => item.shown)
  expect.soft(shortcuts).not.toContain("translation-hub-shortcut")
  expect.soft(shortcuts).not.toContain("selection-speak-shortcut")
  expect.soft(shortcuts).not.toContain("difficult-words-shortcut")
  expect.soft(selectionMenu).not.toContain("read-frog-selection-read-aloud")
  expect.soft(toolbar.map((item) => item.id)).not.toContain("speak")
  expect.soft(TOP_LEVEL_FEATURES).not.toContain("translationHub")
  expect.soft(FEATURE_IDS).not.toContain("selectionToolbar.speak")
  expect.soft(FEATURE_IDS).not.toContain("selectionToolbar.translate.noteSuggestion")
  expect(shortcuts).toContain("page-translation-shortcut")
  expect(selectionMenu).toContain("read-frog-selection-translate")
})
