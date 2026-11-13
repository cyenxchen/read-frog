import { AUTH_BASE_PATH } from "@read-frog/definitions"
import { createAuthClient } from "better-auth/client"
import { env } from "@/env"
import { guardedAuthFetch } from "@/utils/account-features/network-guard" // fork:account-off

// Background scripts can fetch the API directly. UI authClient intentionally
// proxies through backgroundFetch for content-script contexts.
export const backgroundAuthClient = createAuthClient({
  baseURL: env.WXT_API_URL,
  basePath: AUTH_BASE_PATH,
  fetchOptions: {
    credentials: "include",
    cache: "no-store",
    customFetchImpl: guardedAuthFetch((...args) => fetch(...args)), // fork:account-off
  },
})
