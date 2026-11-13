import { readFileSync } from "node:fs"
import { expect, it, vi } from "vitest"
import * as uiPolicy from "../ui-policy"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

it("does not open the install guide when account features are disabled", () => {
  const background = readFileSync(
    new URL("../../../entrypoints/background/index.ts", import.meta.url),
    "utf8",
  )

  // Keep the real install tab creation behind the fork policy across upstream merges.
  expect(background).toMatch(
    /if\s*\(details\.reason === "install" && shouldOpenInstallGuide\(\)\)\s*\{\s*(?:\/\/[^\n]*\n\s*)?await browser\.tabs\.create\(\{\s*url: `\$\{env\.WXT_WEBSITE_URL\}\/guide\/step-1\?from=install`,\s*\}\)/,
  )
  expect(background).toMatch(
    /import \{ shouldOpenInstallGuide \} from "@\/utils\/account-features\/ui-policy"/,
  )
  expect(uiPolicy.shouldOpenInstallGuide()).toBe(false)
})
