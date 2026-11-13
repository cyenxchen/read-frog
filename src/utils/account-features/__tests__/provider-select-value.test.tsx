// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Select, SelectTrigger } from "@/components/ui/base-ui/select"
import { AccountProviderSelectValue } from "../provider-select-value"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
afterEach(cleanup)

it.each([null, undefined])("shows a default provider prompt for unavailable value %s", (value) => {
  render(
    <Select value={value} items={[]}>
      <SelectTrigger>
        <AccountProviderSelectValue>
          {(selected: { name: string }) => selected.name}
        </AccountProviderSelectValue>
      </SelectTrigger>
    </Select>,
  )
  expect(screen.getByRole("combobox")).toHaveTextContent(
    "options.selectionToolbar.customActions.form.selectProvider",
  )
})

it("keeps an explicit placeholder for a parked provider", () => {
  render(
    <ProviderSelector
      providers={[]}
      value="read-frog-free-ai"
      onChange={() => {}}
      placeholder="Choose your model"
    />,
  )
  expect(screen.getByRole("combobox")).toHaveTextContent("Choose your model")
})

it("renders the available provider with the caller's value renderer", () => {
  const provider = { name: "My provider" }
  render(
    <Select value={provider} items={[{ value: provider, label: provider.name }]}>
      <SelectTrigger>
        <AccountProviderSelectValue>
          {(selected: { name: string }) => selected.name}
        </AccountProviderSelectValue>
      </SelectTrigger>
    </Select>,
  )
  expect(screen.getByRole("combobox")).toHaveTextContent("My provider")
})

it("shows the default prompt through the real selector for a parked hosted provider", () => {
  render(<ProviderSelector providers={[]} value="read-frog-free-ai" onChange={() => {}} />)
  expect(screen.getByRole("combobox")).toHaveTextContent(
    "options.selectionToolbar.customActions.form.selectProvider",
  )
})
