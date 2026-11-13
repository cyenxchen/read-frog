// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { MemoryRouter } from "react-router"
import { afterEach, expect, it, vi } from "vitest"
import { AppSidebar } from "@/entrypoints/options/app-sidebar"
import { FeaturesNav } from "@/entrypoints/options/app-sidebar/features-nav"
import { WhatsNewFooter } from "@/entrypoints/options/app-sidebar/whats-new-footer"
import { commandPaletteOpenAtom } from "@/entrypoints/options/command-palette/atoms"
import { SEARCH_ITEMS } from "@/entrypoints/options/command-palette/search-items"
import { SettingsSearch } from "@/entrypoints/options/command-palette/settings-search"
import { ApiProvidersPage } from "@/entrypoints/options/pages/api-providers"
import { ActionEditorTabs } from "@/entrypoints/options/pages/custom-actions/action-config-form/editor-tabs"
import { ActionsSection } from "@/entrypoints/options/pages/selection-toolbar/actions"
import { VideoSubtitlesPage } from "@/entrypoints/options/pages/video-subtitles"
import Popup from "@/entrypoints/popup/app"
import BlogNotification from "@/entrypoints/popup/components/blog-notification"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CUSTOM_ACTION_NOTEBASE_SECTION_ID } from "@/utils/navigation"

vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/components/user-account-menu", () => ({
  UserAccountMenuPopup: () => <button type="button">Account menu</button>,
  UserAccountMenuSidebar: () => <button type="button">Account menu</button>,
}))
vi.mock("@/components/user-account-menu/shared", () => ({ useResolvedAccountPlan: () => null }))
vi.mock("@/components/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light" }) }))
vi.mock("@/components/llm-providers/use-hosted-ai-status", () => ({
  useHostedAiStatus: () => ({ status: undefined, isPending: false, isError: false }),
}))
vi.mock("@/components/ui/base-ui/sidebar", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return Object.fromEntries(
    [
      "Sidebar",
      "SidebarHeader",
      "SidebarContent",
      "SidebarFooter",
      "SidebarGroup",
      "SidebarGroupLabel",
      "SidebarGroupContent",
      "SidebarMenu",
      "SidebarMenuItem",
      "SidebarMenuButton",
      "SidebarMenuSub",
      "SidebarMenuSubItem",
      "SidebarMenuSubButton",
    ].map((key) => [key, Box]),
  )
})
vi.mock("@/entrypoints/options/app-sidebar/collapse-toggle", () => ({ CollapseToggle: () => null }))
vi.mock("@/entrypoints/options/app-sidebar/settings-nav", () => ({ SettingsNav: () => null }))
vi.mock("@/entrypoints/options/app-sidebar/product-nav", () => ({ ProductNav: () => null }))
vi.mock("@/entrypoints/options/pages/api-providers/providers-config/add-provider-dialog", () => ({
  default: () => null,
}))
vi.mock("@/entrypoints/options/pages/api-providers/providers-config/provider-config-form", () => ({
  ProviderConfigForm: () => <p>Own provider editor</p>,
}))
vi.mock("@/entrypoints/options/pages/api-providers/providers-config/provider-editor", () => ({
  BuiltInProviderEditor: { Provider: () => <p>Hosted editor</p> },
  ProviderEditor: {},
}))
vi.mock("@/entrypoints/options/pages/api-providers/ai-content-aware", () => ({
  AIContentAwareConfig: () => null,
}))
vi.mock("@/entrypoints/options/pages/api-providers/feature-providers", () => ({
  FeatureProvidersConfig: () => null,
}))
vi.mock("@/entrypoints/options/pages/api-providers/language-detection", () => ({
  LanguageDetectionConfig: () => null,
}))
vi.mock("@/entrypoints/options/pages/api-providers/built-in-ai-usage", () => ({
  BuiltInAiUsageConfig: () => <p>Hosted usage</p>,
}))
vi.mock("@/entrypoints/options/pages/video-subtitles/ai-quota", () => ({
  AiQuotaSection: () => <p>AI quota</p>,
}))
vi.mock("@/entrypoints/options/pages/video-subtitles/preference", () => ({
  PreferenceSection: () => <p>Subtitle preferences</p>,
}))
vi.mock("@/entrypoints/options/pages/video-subtitles/cache", () => ({ CacheSection: () => null }))
vi.mock("@/entrypoints/options/pages/video-subtitles/custom-prompts", () => ({
  CustomPromptsSection: () => null,
}))
vi.mock("@/entrypoints/options/pages/video-subtitles/subtitles-queue", () => ({
  SubtitlesQueueSection: () => null,
}))
vi.mock("@/entrypoints/options/pages/video-subtitles/subtitles-style", () => ({
  SubtitlesStyleSection: () => null,
}))
vi.mock("@/entrypoints/options/pages/selection-toolbar/actions/note-suggestion-items", () => ({
  NoteSuggestionItems: () => <p>Note suggestion</p>,
}))
vi.mock("@/entrypoints/options/pages/custom-actions/action-config-form/action-editor", () => ({
  useActionEditor: () => ({ state: { form: { store: {} } } }),
}))
vi.mock("@tanstack/react-store", () => ({
  useSelector: (_store: unknown, select: (state: unknown) => unknown) =>
    select({ fieldMeta: {}, values: { outputSchema: [] } }),
}))
vi.mock("@/components/ui/base-ui/command", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return Object.fromEntries(
    [
      "Command",
      "CommandDialog",
      "CommandEmpty",
      "CommandGroup",
      "CommandInput",
      "CommandItem",
      "CommandList",
    ].map((key) => [key, Box]),
  )
})
vi.mock("@iconify/react/dist/iconify.js", () => ({ Icon: () => null }))
vi.mock("@/entrypoints/popup/components/ai-smart-context", () => ({ AISmartContext: () => null }))
vi.mock("@/entrypoints/popup/components/always-translate", () => ({ AlwaysTranslate: () => null }))
vi.mock("@/entrypoints/popup/components/discord-button", () => ({ DiscordButton: () => null }))
vi.mock("@/entrypoints/popup/components/language-options-selector", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/more-menu", () => ({ MoreMenu: () => null }))
vi.mock("@/entrypoints/popup/components/node-translation-hotkey-selector", () => ({
  default: () => null,
}))
vi.mock("@/entrypoints/popup/components/providers-field", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/site-control-toggle", () => ({
  SiteControlToggle: () => null,
}))
vi.mock("@/entrypoints/popup/components/store-review-prompt", () => ({
  StoreReviewPrompt: () => null,
}))
vi.mock("@/entrypoints/popup/components/translate-button", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/translate-prompt-selector", () => ({ default: () => null }))
vi.mock("@/entrypoints/popup/components/translation-hub-button", () => ({
  TranslationHubButton: () => null,
}))
vi.mock("@/entrypoints/popup/components/translation-mode-selector", () => ({ default: () => null }))

const clients: QueryClient[] = []
function mount(element: ReactNode, type = "update") {
  const store = createStore()
  store.set(configAtom, {
    ...structuredClone(DEFAULT_CONFIG),
    providersConfig: [],
    uiLanguage: "en",
  })
  store.set(commandPaletteOpenAtom, true)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  clients.push(client)
  client.setQueryData(["last-viewed-blog-date"], null)
  client.setQueryData(["latest-blog-post", "en"], {
    type,
    title: "Ordinary update",
    url: "/blog/update",
    date: new Date("2026-11-13T00:00:00Z"),
  })
  return render(
    <QueryClientProvider client={client}>
      <Provider store={store}>
        <MemoryRouter initialEntries={["/page-translation"]}>{element}</MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  )
}
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

it("popup and options sidebar do not mount account menus", () => {
  mount(
    <>
      <Popup />
      <AppSidebar />
    </>,
  )
  expect(screen.queryAllByText("Account menu")).toHaveLength(0)
  expect(screen.getByText("popup.options")).toBeInTheDocument()
})
it("API Providers hides hosted cards, editor and usage, keeping own-provider editing", () => {
  mount(<ApiProvidersPage />)
  expect(screen.queryByText("Hosted usage")).not.toBeInTheDocument()
  expect(screen.queryByText("Hosted editor")).not.toBeInTheDocument()
  expect(screen.queryByText("options.apiProviders.builtInProvider")).not.toBeInTheDocument()
  expect(screen.getByText("Own provider editor")).toBeInTheDocument()
})
it("Video Subtitles keeps preferences without AI quota", () => {
  mount(<VideoSubtitlesPage />)
  expect(screen.queryByText("AI quota")).not.toBeInTheDocument()
  expect(screen.getByText("Subtitle preferences")).toBeInTheDocument()
})
it("action editor keeps config without mounting Notebase, including retained connections", () => {
  mount(<ActionEditorTabs config={<p>Action config</p>} notebase={<p>Notebase connection</p>} />)
  expect(screen.getByText("Action config")).toBeInTheDocument()
  expect(screen.queryByText("Notebase connection")).not.toBeInTheDocument()
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
})
it("toolbar settings hide note suggestion", () => {
  mount(<ActionsSection />)
  expect(screen.queryByText("Note suggestion")).not.toBeInTheDocument()
  expect(screen.getByText("options.selectionToolbar.actions.translate.title")).toBeInTheDocument()
})
it("command palette hides all three account sections while keeping ordinary settings", () => {
  mount(<SettingsSearch />)
  for (const sectionId of [
    CUSTOM_ACTION_NOTEBASE_SECTION_ID,
    "selection-toolbar-note-suggestion",
    "subtitles-ai-quota",
  ]) {
    const item = SEARCH_ITEMS.find((entry) => entry.sectionId === sectionId)!
    expect(screen.queryByText(item.titleKey)).not.toBeInTheDocument()
  }
  expect(
    screen.getByText("options.translation.preference.translationMode.title"),
  ).toBeInTheDocument()
})
it("sidebar hides the PDF external link", () => {
  mount(<FeaturesNav />)
  expect(screen.queryByText("options.tools.pdfTranslation")).not.toBeInTheDocument()
})
it.each(["update", "announcement"])("ordinary %s posts still appear in both surfaces", (type) => {
  const { container } = mount(
    <>
      <WhatsNewFooter />
      <BlogNotification />
    </>,
    type,
  )
  expect(screen.getByText("options.whatsNew.title")).toBeInTheDocument()
  expect(container.querySelector(".animate-ping")).toBeInTheDocument()
})
it("promotional posts disappear from the footer and popup notification", () => {
  const { container } = mount(
    <>
      <WhatsNewFooter />
      <BlogNotification />
    </>,
    "promotion",
  )
  expect(container).toBeEmptyDOMElement()
})
