import { readFileSync, readdirSync } from "node:fs"
import { posix } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BUILT_IN_AI_PROVIDER_IDS } from "@/utils/constants/provider-ids"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"
import { remapHiddenProviderRefs } from "../remap-hidden-providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

const ACCOUNT_SURFACE_MODULES = [
  "components/user-account-menu",
  "components/badges/upgrade-plan-badge",
  "components/badges/plan-badge",
  "components/llm-providers/use-hosted-ai-status",
  "components/custom-action/use-save-to-notebase",
]

function importsAccountSurface(path: string, source: string): boolean {
  return Array.from(source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)).some(
    (match) => {
      const specifier = match[1]!
      const resolved = specifier.startsWith("@/")
        ? specifier.slice(2)
        : specifier.startsWith(".")
          ? posix.normalize(posix.join(posix.dirname(path), specifier))
          : specifier
      const module = resolved.replace(/\.(?:ts|tsx|js|jsx)$/, "").replace(/\/index$/, "")
      return (
        module.startsWith("utils/auth/") ||
        module.startsWith("utils/orpc/") ||
        ACCOUNT_SURFACE_MODULES.some(
          (surface) => module === surface || module.startsWith(`${surface}/`),
        )
      )
    },
  )
}

it.each([
  [
    "resolved account plan",
    'import { useResolvedAccountPlan } from "@/components/user-account-menu/shared"',
  ],
  ["upgrade badge", 'import { UpgradePlanBadge } from "@/components/badges/upgrade-plan-badge"'],
  ["plan badge", 'import { PlanBadge } from "@/components/badges/plan-badge"'],
  [
    "hosted status",
    'import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"',
  ],
  [
    "Notebase save",
    'import { useSaveToNotebase } from "@/components/custom-action/use-save-to-notebase"',
  ],
  ["account menu", 'import { UserAccountMenuPopup } from "@/components/user-account-menu"'],
  ["relative account surface", 'import { PlanBadge } from "../../components/badges/plan-badge"'],
  ["dynamic account surface", 'const menu = import("@/components/user-account-menu")'],
])("detects a newly visible entry point through %s", (_name, source) => {
  expect(importsAccountSurface("entrypoints/new-page/index.tsx", source)).toBe(true)
})

it("does not classify unrelated imports as account surfaces", () => {
  expect(
    importsAccountSurface(
      "entrypoints/new-page/index.tsx",
      'import { configAtom } from "@/utils/atoms/config"',
    ),
  ).toBe(false)
})

// Every new upstream consumer needs an explicit decision about its fork entry point.
it("keeps the account-client import inventory reviewed", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url))
  const consumers = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(?:ts|tsx)$/.test(path) && !path.includes("__tests__/"))
    .filter((path) => importsAccountSurface(path, readFileSync(`${root}/${path}`, "utf8")))
    .sort((a, b) => a.localeCompare(b))
  expect(
    consumers,
    "Check for a newly visible account entry point before updating this reviewed import allowlist.",
  ).toEqual([
    "components/badges/upgrade-plan-badge.tsx",
    "components/custom-action/save-to-notebase-button.tsx",
    "components/custom-action/save-to-notebase-dialog-host.tsx",
    "components/custom-action/use-save-to-notebase.ts",
    "components/llm-providers/provider-selector.tsx",
    "components/llm-providers/use-hosted-ai-provider-options.ts",
    "components/llm-providers/use-hosted-ai-status.ts",
    "components/test-orpc.tsx",
    "components/ui/selection-popover/review-due-tab.tsx",
    "components/user-account-menu/index.ts",
    "components/user-account-menu/popup.tsx",
    "components/user-account-menu/shared.tsx",
    "components/user-account-menu/sidebar.tsx",
    "entrypoints/background/background-stream.ts",
    "entrypoints/background/hosted-ai-status.ts",
    "entrypoints/background/notebase-pending-save.ts",
    "entrypoints/content-runtime/selection/selection-toolbar/note-suggestion/note-suggestion-card.tsx",
    "entrypoints/options/app-sidebar/index.tsx",
    "entrypoints/options/app-sidebar/whats-new-footer.tsx",
    "entrypoints/options/components/llm-feature-status-list.tsx",
    "entrypoints/options/pages/api-providers/built-in-ai-usage/index.tsx",
    "entrypoints/options/pages/api-providers/language-detection/index.tsx",
    "entrypoints/options/pages/api-providers/providers-config/index.tsx",
    "entrypoints/options/pages/api-providers/providers-config/provider-config-form/index.tsx",
    "entrypoints/options/pages/api-providers/providers-config/provider-editor.tsx",
    "entrypoints/options/pages/custom-actions/action-config-form/notebase-connection-field.tsx",
    "entrypoints/options/pages/video-subtitles/ai-quota/index.tsx",
    "entrypoints/popup/app.tsx",
    "entrypoints/popup/components/providers-field.tsx",
    "entrypoints/translation-hub/components/translation-service-dropdown.tsx",
    "utils/orpc/background-client.ts",
    "utils/orpc/client.ts",
    "utils/subtitles/ai/access-guard.ts",
    "utils/subtitles/ai/request-ai-subtitles.ts",
  ])
})

it("leaves only the parked note-suggestion ID in defaults with a usable LLM", () => {
  const config = structuredClone(DEFAULT_CONFIG)
  config.providersConfig.push({
    ...structuredClone(DEFAULT_PROVIDER_CONFIG.openai),
    enabled: true,
    apiKey: "test-key",
  })
  const remapped = remapHiddenProviderRefs(config)
  const hiddenPaths: string[] = []
  function visit(value: unknown, path: string[]) {
    if (typeof value === "string" && BUILT_IN_AI_PROVIDER_IDS.some((id) => id === value)) {
      hiddenPaths.push(path.join("."))
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => visit(child, [...path, key]))
    }
  }
  visit(remapped, [])
  expect(hiddenPaths).toEqual(["selectionToolbar.noteSuggestion.providerId"])
})
