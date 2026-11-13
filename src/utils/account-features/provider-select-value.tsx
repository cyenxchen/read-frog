import type { ComponentProps } from "react"
import { SelectValue } from "@/components/ui/base-ui/select"
import { i18n } from "@/utils/i18n"
import { ACCOUNT_FEATURES_ENABLED } from "./flag"

// With no usable LLM, the schema intentionally keeps hosted action references.
// Base UI passes null to value renderers when that ID is absent from the list.
function NullableProviderSelectValue({
  children,
  placeholder = i18n.t("options.selectionToolbar.customActions.form.selectProvider"),
  ...props
}: ComponentProps<typeof SelectValue>) {
  return (
    <SelectValue {...props} placeholder={placeholder}>
      {typeof children === "function"
        ? (value) => (value === null || value === undefined ? placeholder : children(value))
        : children}
    </SelectValue>
  )
}

export const AccountProviderSelectValue = ACCOUNT_FEATURES_ENABLED
  ? SelectValue
  : NullableProviderSelectValue
