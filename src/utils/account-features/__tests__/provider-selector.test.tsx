// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
afterEach(cleanup)

const llm = DEFAULT_PROVIDER_CONFIG.openai
const translator = DEFAULT_CONFIG.providersConfig.find((p) => p.provider === "microsoft-translate")!
it.each([
  { name: "empty", providers: [] },
  { name: "one group", providers: [llm] },
  { name: "multiple groups", providers: [llm, translator] },
])("renders the $name selector for an intentionally parked hosted reference", ({ providers }) => {
  render(
    <ProviderSelector
      providers={providers}
      value="read-frog-free-ai"
      onChange={() => {}}
      placeholder="Select your provider"
    />,
  )
  expect(screen.getByRole("combobox")).toHaveTextContent("Select your provider")
})
it("still renders the selected local provider", () => {
  render(
    <ProviderSelector
      providers={[llm]}
      value={llm.id}
      onChange={() => {}}
      placeholder="Select your provider"
    />,
  )
  expect(screen.getByRole("combobox")).toHaveTextContent(llm.name)
})
