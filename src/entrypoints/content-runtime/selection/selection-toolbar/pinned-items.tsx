import { useAtomValue } from "jotai"
import { ACCOUNT_FEATURES_ENABLED } from "@/utils/account-features/flag"
import { configAtom } from "@/utils/atoms/config"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"
import { SelectionToolbarCustomActionTrigger } from "./custom-action-button/custom-action-trigger"
import { SpeakButton } from "./speak-button"
import { TranslateButton } from "./translate-button"

// The buttons of the shown items pinned to the toolbar, in the toolbar's
// order. The other shown items are in its "more" menu only.
export function SelectionToolbarPinnedItems() {
  const config = useAtomValue(configAtom)

  return getSelectionToolbarItems(config)
    .filter((item) => item.shown && item.pinned)
    .map((item) => {
      if (item.kind === "action") {
        return <SelectionToolbarCustomActionTrigger key={item.id} action={item.action} />
      }
      if (item.id === "translate") return <TranslateButton key={item.id} />
      return ACCOUNT_FEATURES_ENABLED ? <SpeakButton key={item.id} /> : null
    })
}
