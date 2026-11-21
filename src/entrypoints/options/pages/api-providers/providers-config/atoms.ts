import { atom } from "jotai"
import { requestEditorNavigationAtom } from "@/components/form/autosave-navigation"
import { ACCOUNT_FEATURES_ENABLED } from "@/utils/account-features/flag" // fork:account-off
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAPIProvidersConfig } from "@/utils/config/helpers"
import { DEFAULT_BUILT_IN_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"

/**
 * The field a deep link asked Provider Config to draw attention to. Held as state rather than
 * read from the URL where it is needed, because the provider a link points at may still have to
 * be created — the field mounts well after the navigation that asked for it.
 */
export const highlightedProviderFieldAtom = atom<"apiKey" | null>(null)

/**
 * How long `--animate-ring-flash` runs end to end (see `src/assets/styles/theme.css`). The
 * highlight clears on this timer rather than on `animationend`, which never fires for anyone
 * browsing with reduced motion.
 */
export const PROVIDER_FIELD_HIGHLIGHT_DURATION_MS = 2700

const internalSelectedProviderIdAtom = atom<string | undefined>(undefined)

export const selectedProviderIdAtom = atom(
  (get) => {
    const selected = get(internalSelectedProviderIdAtom)
    if (selected !== undefined) return selected
    if (ACCOUNT_FEATURES_ENABLED) return DEFAULT_BUILT_IN_AI_PROVIDER_ID

    const providersConfig = get(configFieldsAtomMap.providersConfig)
    return getAPIProvidersConfig(providersConfig)[0]?.id ?? DEFAULT_BUILT_IN_AI_PROVIDER_ID
  },
  (get, set, newValue: string | undefined) => {
    if (get(internalSelectedProviderIdAtom) === newValue) return Promise.resolve(true)
    return set(requestEditorNavigationAtom, () => {
      set(internalSelectedProviderIdAtom, newValue)
    })
  },
)
