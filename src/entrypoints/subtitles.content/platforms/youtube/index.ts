import type { PlatformConfig } from "@/entrypoints/subtitles.content/platforms"
import { ACCOUNT_FEATURES_ENABLED } from "@/utils/account-features/flag" // fork:account-off
import { AiSubtitlesFetcher, YoutubeSubtitlesFetcher } from "@/utils/subtitles/fetchers"
import { UniversalVideoAdapter } from "../../universal-adapter"

export function createYoutubeSubtitlesAdapter(config: PlatformConfig) {
  const { createAiSubtitlesContext } = config
  return new UniversalVideoAdapter({
    config,
    fetchers: {
      native: () => new YoutubeSubtitlesFetcher(),
      ...(ACCOUNT_FEATURES_ENABLED && createAiSubtitlesContext // fork:account-off
        ? { ai: () => new AiSubtitlesFetcher(createAiSubtitlesContext) }
        : {}),
    },
  })
}
