import type { ExtensionORPCClient, ExtensionORPCClientContext } from "./client-context"
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import { ORPC_PREFIX } from "@read-frog/definitions"
import { env } from "@/env"
import { assertAccountFeaturesEnabled } from "@/utils/account-features/network-guard" // fork:account-off
import { buildExtensionORPCHeaders } from "./client-context"

const link = new RPCLink<ExtensionORPCClientContext>({
  url: `${env.WXT_API_URL}${ORPC_PREFIX}`,
  headers: ({ context }) => buildExtensionORPCHeaders(context),
  fetch: (request, init) => {
    assertAccountFeaturesEnabled() // fork:account-off
    return fetch(request, {
      ...init,
      credentials: "include",
    })
  },
})

export const backgroundOrpcClient: ExtensionORPCClient = createORPCClient(link)
