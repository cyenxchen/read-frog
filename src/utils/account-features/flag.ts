// fork:account-off — keep upstream tests exercising the original behavior.
export const ACCOUNT_FEATURES_ENABLED: boolean = import.meta.env.MODE === "test"
