import { lazy, Suspense } from "react"
import { ACCOUNT_FEATURES_ENABLED } from "@/utils/account-features/flag" // fork:account-off
import { MAX_BACKUPS_COUNT } from "@/utils/constants/backup"
import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { ManualConfigSyncConfigItems } from "./manual-config-sync"
import { ResetConfigItem } from "./reset-config"

// Vite needs a build-time check at the import site to omit the sync chunk.
const GoogleDriveSyncConfigItem =
  !import.meta.env.PROD && ACCOUNT_FEATURES_ENABLED
    ? lazy(() =>
        import("./google-drive-sync").then((module) => ({
          default: module.GoogleDriveSyncConfigItem,
        })),
      )
    : null

export function ConfigManagementSection() {
  return (
    <ConfigSection title={i18n.t("options.preference.config.title")}>
      {GoogleDriveSyncConfigItem && (
        <Suspense fallback={null}>
          <GoogleDriveSyncConfigItem />
        </Suspense>
      )}
      <ManualConfigSyncConfigItems />
      <ConfigNavItem
        to="/preference/config-backup"
        title={i18n.t("options.preference.config.backup.title")}
        description={i18n.t("options.preference.config.backup.description", [MAX_BACKUPS_COUNT])}
      />
      <ResetConfigItem />
    </ConfigSection>
  )
}
