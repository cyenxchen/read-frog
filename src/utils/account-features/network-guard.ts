import { ACCOUNT_FEATURES_ENABLED } from "./flag"

export function guardedAuthFetch(transport: typeof fetch): typeof fetch {
  return (input, init) =>
    ACCOUNT_FEATURES_ENABLED ? transport(input, init) : Promise.resolve(Response.json(null))
}

export function assertAccountFeaturesEnabled(): void {
  if (!ACCOUNT_FEATURES_ENABLED) throw new Error("Account features are disabled")
}
