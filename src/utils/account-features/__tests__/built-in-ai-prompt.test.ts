import { expect, it, vi } from "vitest"
import { promptForBuiltInAiRefusal } from "@/utils/content-runtime/built-in-ai-prompt"
import { HostedAiProviderUnavailableError } from "@/utils/providers/provider-ref"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))

const getBuiltInAiUpgradePlan = vi.hoisted(() => vi.fn<() => Promise<"free" | null>>())
vi.mock("@/utils/hosted-ai/upgrade-plan", () => ({ getBuiltInAiUpgradePlan }))

it.each([
  ["log-in", "authentication_required"],
  ["upgrade", "quota_exhausted"],
] as const)("never asks to %s while account features are off", async (_name, reason) => {
  getBuiltInAiUpgradePlan.mockResolvedValue("free")
  const error = new HostedAiProviderUnavailableError(
    { kind: "system", id: "read-frog-ai:gpt-6-luna", name: "GPT", model: "gpt-6-luna" },
    "refused",
    undefined,
    reason,
  )

  await expect(
    promptForBuiltInAiRefusal(error, {
      feature: "pageTranslation",
      analyticsFeature: "page_translation",
      trigger: "user",
    }),
  ).resolves.toBe(false)
  expect(getBuiltInAiUpgradePlan).not.toHaveBeenCalled()
})
