import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { proxyFetch } = vi.hoisted(() => ({
  proxyFetch: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))
vi.mock("../flag", () => ({ ACCOUNT_FEATURES_ENABLED: false }))
vi.mock("@/env", () => ({ env: { WXT_API_URL: "https://api.readfrog.app" } }))
vi.mock("@/utils/message", () => ({ sendMessage: proxyFetch }))

const directFetch = vi.fn<typeof fetch>()
vi.stubGlobal("fetch", directFetch)
const { authClient } = await import("@/utils/auth/auth-client")
const { backgroundAuthClient } = await import("@/utils/auth/background-auth-client")
const { backgroundOrpcClient } = await import("@/utils/orpc/background-client")
const { orpcClient } = await import("@/utils/orpc/client")
beforeEach(() => {
  proxyFetch.mockReset().mockResolvedValue({
    body: "null",
    status: 200,
    statusText: "OK",
    headers: [["content-type", "application/json"]],
  })
  directFetch.mockReset().mockImplementation(async () => Response.json(null))
  vi.stubGlobal("fetch", directFetch)
})
afterEach(() => vi.unstubAllGlobals())

describe("account clients with the fork flag off", () => {
  it.each([
    ["UI auth", authClient],
    ["background auth", backgroundAuthClient],
  ] as const)("%s returns a null session without transport", async (_name, client) => {
    const session = await client.getSession({ query: { disableCookieCache: true } })
    expect(session.data).toBeNull()
    expect(directFetch).not.toHaveBeenCalled()
    expect(proxyFetch).not.toHaveBeenCalled()
  })

  it.each([
    ["UI oRPC", orpcClient],
    ["background oRPC", backgroundOrpcClient],
  ] as const)("%s rejects before transport", async (_name, client) => {
    await expect(client.hostedAi.status({})).rejects.toThrow("Account features are disabled")
    expect(directFetch).not.toHaveBeenCalled()
    expect(proxyFetch).not.toHaveBeenCalled()
  })
})
