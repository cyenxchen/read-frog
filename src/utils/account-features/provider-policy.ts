import { isNonAPIProvider } from "@/types/config/provider/constants"
import { ACCOUNT_FEATURES_ENABLED } from "./flag"

/** Only seed fresh installs; stored/imported/synced provider lists never pass here. */
export function shouldSeedFreshProvider(provider: { provider: string }): boolean {
  return ACCOUNT_FEATURES_ENABLED || isNonAPIProvider(provider.provider)
}

/** Stable provider-type order gives no partner a reserved position in its group. */
export function getProviderPickerOrder<T extends string>(types: readonly T[]): readonly T[] {
  return ACCOUNT_FEATURES_ENABLED ? types : types.toSorted()
}
