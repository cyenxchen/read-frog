import type { FeatureUsedEventProperties } from "@/types/analytics"
import { expect, it, vi } from "vitest"
import { setupFeatureUsedEventHandlers } from "@/entrypoints/background/feature-used-event"
import { isHiddenForkSearchItem, SHOW_ANALYTICS_PREFERENCE } from "../ui-policy"

type FeatureUsedHandler = (message: { data: FeatureUsedEventProperties }) => Promise<void>

const { onMessage, recordFeatureActiveDay, capture } = vi.hoisted(() => ({
  onMessage: vi.fn<(key: string, handler: FeatureUsedHandler) => void>(),
  recordFeatureActiveDay: vi.fn<() => Promise<void>>(),
  capture: vi.fn<() => Promise<void>>(),
}))

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/env", () => ({
  env: { WXT_POSTHOG_HOST: "https://telemetry.example", WXT_POSTHOG_API_KEY: "test-project-key" },
}))
vi.mock("@/utils/message", () => ({ onMessage }))
vi.mock("@/utils/feature-active-days", () => ({ recordFeatureActiveDay }))
vi.mock("@/entrypoints/background/analytics", () => ({
  captureFeatureUsedEventInBackground: capture,
}))

it("hides analytics settings even when PostHog is configured", () => {
  expect.soft(SHOW_ANALYTICS_PREFERENCE).toBe(false)
  expect(isHiddenForkSearchItem({ sectionId: "analytics", route: "/preference" })).toBe(true)
})

it("counts successful feature use locally without forwarding it to PostHog", async () => {
  setupFeatureUsedEventHandlers()
  const [messageType, handler] = onMessage.mock.calls[0]!
  expect(messageType).toBe("trackFeatureUsedEvent")

  await handler({
    data: {
      feature: "page_translation",
      surface: "popup",
      outcome: "success",
      latency_ms: 100,
      provider: "openai",
      backend_kind: "llm",
      target_language: "zh-Hans",
      translation_mode: "bilingual",
    },
  })

  expect(recordFeatureActiveDay).toHaveBeenCalledOnce()
  expect(capture).not.toHaveBeenCalled()
})
