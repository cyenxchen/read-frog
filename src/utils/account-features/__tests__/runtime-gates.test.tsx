// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, expect, it, vi } from "vitest"
import { SaveToNotebaseButton } from "@/components/custom-action/save-to-notebase-button"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { useNoteSuggestion } from "@/entrypoints/content-runtime/selection/selection-toolbar/note-suggestion/use-note-suggestion"
import { buildAiConfigHelperPrompt } from "@/entrypoints/options/pages/custom-actions/action-config-form/ai-config-helper-prompt"
import {
  currentVideoIdAtom,
  sourceTrackAtom,
  subtitlesStore,
} from "@/entrypoints/subtitles.content/atoms"
import { createYoutubeSubtitlesAdapter } from "@/entrypoints/subtitles.content/platforms/youtube"
import { SubtitlesSidebarItem } from "@/entrypoints/subtitles.content/ui/subtitles-settings-panel/components/subtitles-sidebar-item"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { getGuideDictionaryNotebaseState } from "@/utils/guide/dictionary-notebase"

const { stream, hostedQuery, toast } = vi.hoisted(() => ({
  stream: vi.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({}),
  hostedQuery: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
  toast: vi.fn<(...args: unknown[]) => void>(),
}))
vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/utils/auth/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}))
vi.mock("@/utils/orpc/client", () => ({
  orpc: {
    hostedAi: {
      status: {
        queryOptions: (options: object) => ({ queryFn: hostedQuery, ...options }),
        queryKey: () => ["hosted-status"],
      },
    },
  },
}))
vi.mock("@/components/custom-action/use-save-to-notebase", () => ({
  useSaveToNotebase: () => ({
    save: () => {},
    isSaving: false,
    isAuthenticated: false,
    hasCurrentAccount: false,
  }),
}))
vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundNoteSuggestion: stream,
}))
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: async () => ({
    webTitle: "Title",
    webDescription: "",
    webContent: "Article",
  }),
}))
vi.mock("@/utils/subtitles/toast", () => ({ showAnchoredSubtitlesToast: toast }))
vi.mock("@/entrypoints/subtitles.content/ui/subtitles-ui-context", () => ({
  useSubtitlesUI: () => ({
    supportsSidebar: true,
    hasSubtitlesAvailable: async () => false,
    toggleSubtitles: () => {},
  }),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function wrapper({ children }: { children: ReactNode }) {
  const store = createStore()
  store.set(configAtom, structuredClone(DEFAULT_CONFIG))
  return <Provider store={store}>{children}</Provider>
}

it("note suggestion never starts an LLM request, even with its saved enabled flag", async () => {
  const { result } = renderHook(() => useNoteSuggestion(), { wrapper })
  const config = DEFAULT_CONFIG.providersConfig.find(isLLMProviderConfig)!
  await act(async () =>
    result.current.maybeFire({
      sessionKey: "test:0",
      selectionText: "word",
      savedSelectionText: "word",
      paragraphsText: "A word in context.",
      targetLangName: "English",
      webTitle: "Title",
      provider: { kind: "local", id: config.id, name: config.name, config },
    }),
  )
  expect(stream).not.toHaveBeenCalled()
  expect(result.current.suggestion).toBeNull()
})
it("hosted status polling is disabled even after the session resolves", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  renderHook(() => useHostedAiStatus(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await act(async () => {
    await Promise.resolve()
  })
  expect(hostedQuery).not.toHaveBeenCalled()
  client.clear()
})
it("save-to-Notebase button is absent", () => {
  const action = getSelectionToolbarActions(DEFAULT_CONFIG.selectionToolbar)[0]!
  const { container } = render(
    <SaveToNotebaseButton
      action={action}
      failed={false}
      isRunning={false}
      result={{ Word: "word" }}
      surface="selection_toolbar"
    />,
  )
  expect(container).toBeEmptyDOMElement()
})
it("YouTube has native subtitles without constructing an AI fetcher", () => {
  const adapter = createYoutubeSubtitlesAdapter({
    platform: "youtube",
    selectors: { video: "video", playerContainer: "#player" },
    events: {},
    createAiSubtitlesContext: () => null,
  })
  expect(adapter.supportsAiSubtitles).toBe(false)
})
it("guide reports the hidden Notebase step complete without saved completion data", async () => {
  expect(await getGuideDictionaryNotebaseState()).toEqual({ completed: true })
})
it("subtitle sidebar explains missing subtitles without offering hosted AI generation", async () => {
  subtitlesStore.set(currentVideoIdAtom, "test-video")
  subtitlesStore.set(sourceTrackAtom, [])
  render(<SubtitlesSidebarItem />)
  fireEvent.click(screen.getByRole("button", { name: "subtitles.sidebar.menu.label" }))
  await waitFor(() =>
    expect(toast).toHaveBeenCalledWith("subtitles.errors.noSubtitlesFound", expect.anything()),
  )
})
it("AI helper prompt describes only available settings, including a previously connected action", () => {
  const action = getSelectionToolbarActions(DEFAULT_CONFIG.selectionToolbar)[0]!
  const prompt = buildAiConfigHelperPrompt({
    action,
    otherActionNames: [],
    uiLocale: "en",
    targetCode: "en",
  })
  expect(prompt).not.toMatch(/Notebase|readfrog\.app account|Read Frog's built-in AI/i)
  expect(prompt).toContain("### System prompt")
  expect(prompt).toContain("## Layout reference")
})
