import {
  isLLMProvider,
  isPureTranslateProvider,
  isTranslateProvider,
} from "@/types/config/provider/constants"
import {
  BUILT_IN_AI_ADVANCE_PROVIDER_ID,
  BUILT_IN_AI_PROVIDER_ID,
} from "@/utils/constants/provider-ids"
import { providerSupportsTranslationOnlyMode } from "@/utils/providers/translation-only-gate"
import { ACCOUNT_FEATURES_ENABLED } from "./flag"

interface ProviderSlot {
  providerId: string
}
interface RemapProvider {
  id: string
  provider: string
  enabled: boolean
  apiKey?: string
}
// Deliberately structural: importing Config here would make schema inference recursive.
interface RemappableConfig {
  providersConfig: RemapProvider[]
  pageTranslation: ProviderSlot & { mode: "bilingual" | "translationOnly" }
  inputTranslation: ProviderSlot
  videoSubtitles: ProviderSlot
  languageDetection: { mode: "basic" | "llm"; providerId?: string }
  translationHub: { selectedProviderIds: string[] | null }
  selectionToolbar: {
    features: { translate: ProviderSlot }
    builtInActions: Record<string, ProviderSlot>
    customActions: ProviderSlot[]
    noteSuggestion: ProviderSlot
  }
}

function isHiddenId(id: string | undefined): boolean {
  return id === BUILT_IN_AI_PROVIDER_ID || id === BUILT_IN_AI_ADVANCE_PROVIDER_ID
}

function isUsableLlm(provider: RemapProvider): boolean {
  return (
    provider.enabled &&
    isLLMProvider(provider.provider) &&
    (!!provider.apiKey?.trim() ||
      ["ollama", "openai-compatible", "open-responses"].includes(provider.provider))
  )
}

function remapSlot<T extends ProviderSlot>(slot: T, replacement?: RemapProvider): T {
  return replacement && isHiddenId(slot.providerId) ? { ...slot, providerId: replacement.id } : slot
}

export function remapHiddenProviderRefs<T extends RemappableConfig>(config: T): T {
  if (ACCOUNT_FEATURES_ENABLED) return config

  const llms = config.providersConfig.filter(isUsableLlm)
  const replacement = llms.find((p) => p.id === config.pageTranslation.providerId) ?? llms[0]
  const translators = config.providersConfig.filter(
    (p) => p.enabled && isTranslateProvider(p.provider) && isPureTranslateProvider(p.provider),
  )
  const translationFallback =
    replacement ?? translators.find((p) => p.provider === "microsoft-translate") ?? translators[0]

  let pageTranslation = remapSlot(config.pageTranslation, translationFallback)
  if (
    pageTranslation !== config.pageTranslation &&
    !replacement &&
    pageTranslation.mode === "translationOnly" &&
    translationFallback &&
    !providerSupportsTranslationOnlyMode(translationFallback.provider)
  ) {
    const supported = translators.filter((p) => providerSupportsTranslationOnlyMode(p.provider))
    const markupProvider = supported.find((p) => p.provider === "google-translate") ?? supported[0]
    pageTranslation = markupProvider
      ? { ...pageTranslation, providerId: markupProvider.id }
      : { ...pageTranslation, mode: "bilingual" }
  }

  const inputTranslation = remapSlot(config.inputTranslation, translationFallback)
  const videoSubtitles = remapSlot(config.videoSubtitles, translationFallback)
  const languageDetection =
    config.languageDetection.mode === "llm" && isHiddenId(config.languageDetection.providerId)
      ? replacement
        ? { ...config.languageDetection, providerId: replacement.id }
        : { mode: "basic" as const }
      : config.languageDetection

  const toolbar = config.selectionToolbar
  const translate = remapSlot(toolbar.features.translate, translationFallback)
  const features =
    translate === toolbar.features.translate ? toolbar.features : { ...toolbar.features, translate }
  const actionEntries = Object.entries(toolbar.builtInActions).map(
    ([key, action]) => [key, remapSlot(action, replacement)] as const,
  )
  const builtInActions = actionEntries.every(
    ([key, action]) => action === toolbar.builtInActions[key],
  )
    ? toolbar.builtInActions
    : Object.fromEntries(actionEntries)
  const remappedActions = toolbar.customActions.map((action) => remapSlot(action, replacement))
  const customActions = remappedActions.every((action, i) => action === toolbar.customActions[i])
    ? toolbar.customActions
    : remappedActions
  const noteSuggestion =
    toolbar.noteSuggestion.providerId === BUILT_IN_AI_PROVIDER_ID
      ? toolbar.noteSuggestion
      : { ...toolbar.noteSuggestion, providerId: BUILT_IN_AI_PROVIDER_ID }
  const selectionToolbar =
    features === toolbar.features &&
    builtInActions === toolbar.builtInActions &&
    customActions === toolbar.customActions &&
    noteSuggestion === toolbar.noteSuggestion
      ? toolbar
      : { ...toolbar, features, builtInActions, customActions, noteSuggestion }

  let translationHub = config.translationHub
  const selected = translationHub.selectedProviderIds
  if (selected?.some(isHiddenId)) {
    const ids = [
      ...new Set(
        selected.flatMap((id) => (isHiddenId(id) ? (replacement ? [replacement.id] : []) : [id])),
      ),
    ]
    translationHub = { ...translationHub, selectedProviderIds: ids.length ? ids : null }
  }

  if (
    pageTranslation === config.pageTranslation &&
    inputTranslation === config.inputTranslation &&
    videoSubtitles === config.videoSubtitles &&
    languageDetection === config.languageDetection &&
    selectionToolbar === toolbar &&
    translationHub === config.translationHub
  )
    return config

  return {
    ...config,
    pageTranslation,
    inputTranslation,
    videoSubtitles,
    languageDetection,
    selectionToolbar,
    translationHub,
  }
}
