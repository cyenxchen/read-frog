import { expect, it, vi } from "vitest"
import { getShortcutBindings } from "@/entrypoints/options/pages/shortcuts/shortcut-bindings"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getSelectionContextMenuItems } from "@/utils/context-menu"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"

vi.mock("@/utils/account-features/flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

it("makes retired fork features inert even when saved settings enable them", () => {
  const config = structuredClone(DEFAULT_CONFIG)
  config.translationHub.shortcut = "Alt+Shift+H"
  config.selectionToolbar.features.speak.enabled = true

  const shortcuts = getShortcutBindings(config).map((item) => item.id)
  const selectionMenu = getSelectionContextMenuItems(config.selectionToolbar).map((item) => item.id)
  const toolbar = getSelectionToolbarItems(config.selectionToolbar).filter((item) => item.enabled)
  expect.soft(shortcuts).not.toContain("translation-hub-shortcut")
  expect.soft(shortcuts).not.toContain("selection-speak-shortcut")
  expect.soft(selectionMenu).not.toContain("read-frog-selection-read-aloud")
  expect.soft(toolbar.map((item) => item.id)).not.toContain("speak")
  expect(shortcuts).toContain("page-translation-shortcut")
  expect(selectionMenu).toContain("read-frog-selection-translate")
})
