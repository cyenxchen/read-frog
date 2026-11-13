import type { Config } from "@/types/config/config"
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { MemoryRouter } from "react-router"
import { afterEach, expect, it, vi } from "vitest"
import { ApiProvidersPage } from "@/entrypoints/options/pages/api-providers"
import { ConfigHeader } from "@/entrypoints/options/pages/api-providers/providers-config/provider-config-form/config-header"
import { configAtom } from "@/utils/atoms/config"
import { buildFreshDefaultConfig } from "@/utils/constants/config"
import { DEFAULT_PROVIDER_CONFIG } from "@/utils/constants/providers"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => ({ status: undefined, isPending: false, isError: false }),
}))

const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

function mount(config: Config = buildFreshDefaultConfig()) {
  const store = createStore()
  store.set(configAtom, structuredClone(config))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <Provider store={store}>
        <MemoryRouter>
          <ApiProvidersPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  )
}

it("renders fresh API Providers with an add button, no API cards and a blank editor", () => {
  const { container } = mount()
  expect(screen.getByRole("button", { name: "options.apiProviders.addProvider" })).toBeVisible()
  expect(container.querySelectorAll("[data-provider-id]")).toHaveLength(0)
  expect(screen.queryByText("Jalapeno Cloud")).not.toBeInTheDocument()
  expect(container.querySelector("form")).toBeNull()
  expect(screen.queryByText("options.apiProviders.builtInProvider")).not.toBeInTheDocument()
})

it("renders existing partner cards without promotional badges", () => {
  const config = structuredClone(buildFreshDefaultConfig())
  config.providersConfig.push(
    structuredClone(DEFAULT_PROVIDER_CONFIG.jalapenocloud),
    structuredClone(DEFAULT_PROVIDER_CONFIG.ifapi),
  )
  const { container } = mount(config)
  expect(container.querySelectorAll("[data-provider-id]")).toHaveLength(2)
  expect(screen.queryAllByText(/options\.apiProviders\.badges\.sponsor/)).toHaveLength(0)
})

it.each(["jalapenocloud", "ifapi"] as const)(
  "%s header keeps configuration help without a promotional call to action",
  (providerType) => {
    render(<ConfigHeader providerType={providerType} />)
    expect(screen.queryAllByText(/options\.apiProviders\.sponsorCta/)).toHaveLength(0)
    expect(
      screen.getByRole("link", { name: "options.apiProviders.howToConfigure" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/docs/providers/openai-compatible-providers"),
    )
  },
)

it.each(["IF API", "Jalapeno Cloud"])(
  "offers %s as an ordinary unbadged alphabetic picker entry and adds it",
  async (name) => {
    mount()
    fireEvent.click(screen.getByRole("button", { name: "options.apiProviders.addProvider" }))
    const dialog = await screen.findByRole("dialog")
    const buttons = within(dialog).getAllByRole("button")
    const indexOf = (label: string) =>
      buttons.findIndex((button) => within(button).queryByText(label, { exact: true }))
    const atlas = indexOf("Atlas Cloud")
    const ifapi = indexOf("IF API")
    const jalapeno = indexOf("Jalapeno Cloud")
    expect(atlas).toBeGreaterThanOrEqual(0)
    expect(ifapi).toBeGreaterThan(atlas)
    expect(jalapeno).toBeGreaterThan(ifapi)
    expect(within(dialog).queryAllByText(/options\.apiProviders\.badges\.sponsor/)).toHaveLength(0)
    fireEvent.click(within(dialog).getByRole("button", { name }))
    expect(await screen.findByText(name, { selector: "[data-provider-id] *" })).toBeVisible()
  },
)
