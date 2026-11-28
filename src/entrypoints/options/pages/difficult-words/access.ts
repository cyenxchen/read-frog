import { ACCOUNT_FEATURES_ENABLED } from "@/utils/account-features/flag"
import { useDifficultWordsAccess } from "@/utils/difficult-words/tab-state"

export const DIFFICULT_WORDS_ROUTE = "/difficult-words"

/**
 * Whether the settings show difficult words: while it is in testing, only to
 * the accounts it is open to, and on a failed check too, as the popup does.
 * Asked afresh once per settings page, where a new grant is looked for. Asked
 * with the feature switched off as well, since its switch is on its page.
 */
export function useIsDifficultWordsOpen() {
  const access = useDifficultWordsAccess(ACCOUNT_FEATURES_ENABLED, { fresh: true })
  return ACCOUNT_FEATURES_ENABLED && (access.data === "allowed" || access.data === "unknown")
}
