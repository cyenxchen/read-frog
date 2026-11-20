import { ACCOUNT_FEATURES_ENABLED } from "@/utils/account-features/flag" // fork:account-off
import { SHOW_ANALYTICS_PREFERENCE } from "@/utils/account-features/ui-policy"
import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"
import { AnalyticsItem } from "./analytics"
import { BetaExperienceItem } from "./beta-experience"

export function UserExperienceSection() {
  if (!ACCOUNT_FEATURES_ENABLED && !SHOW_ANALYTICS_PREFERENCE) return null

  return (
    <ConfigSection title={i18n.t("options.preference.userExperience.title")}>
      {ACCOUNT_FEATURES_ENABLED && <BetaExperienceItem />}
      {SHOW_ANALYTICS_PREFERENCE && <AnalyticsItem />}
    </ConfigSection>
  )
}
