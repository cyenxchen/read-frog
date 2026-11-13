import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BUILT_IN_AI_PROVIDER_IDS } from "@/utils/constants/provider-ids"
import { remapHiddenProviderRefs } from "../remap-hidden-providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

// Every new upstream consumer needs an explicit decision about its fork entry point.
it("keeps the account-client import inventory reviewed", () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url))
  const consumers = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(?:ts|tsx)$/.test(path) && !path.includes("__tests__/"))
    .filter((path) =>
      /(?:from\s*|import\(\s*)["']@\/utils\/(?:auth|orpc)\//.test(
        readFileSync(`${root}/${path}`, "utf8"),
      ),
    )
    .sort((a, b) => a.localeCompare(b))
  expect(consumers).toEqual([
    "components/custom-action/save-to-notebase-button.tsx",
    "components/custom-action/save-to-notebase-dialog-host.tsx",
    "components/custom-action/use-save-to-notebase.ts",
    "components/llm-providers/use-hosted-ai-status.ts",
    "components/test-orpc.tsx",
    "components/ui/selection-popover/review-due-tab.tsx",
    "components/user-account-menu/shared.tsx",
    "entrypoints/background/background-stream.ts",
    "entrypoints/background/hosted-ai-status.ts",
    "entrypoints/background/notebase-pending-save.ts",
    "entrypoints/options/pages/custom-actions/action-config-form/notebase-connection-field.tsx",
    "entrypoints/options/pages/video-subtitles/ai-quota/index.tsx",
    "utils/subtitles/ai/access-guard.ts",
    "utils/subtitles/ai/request-ai-subtitles.ts",
  ])
})

it("leaves only the parked note-suggestion ID in defaults with a usable LLM", () => {
  const config = structuredClone(DEFAULT_CONFIG)
  const llm = config.providersConfig.find((p) => p.provider === "openai")!
  Object.assign(llm, { enabled: true, apiKey: "test-key" })
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
