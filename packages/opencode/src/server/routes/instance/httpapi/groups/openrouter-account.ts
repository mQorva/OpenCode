import { OpenRouterAccount } from "@opencode-ai/schema/openrouter-account"
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { described } from "./metadata"

const root = "/product/provider/openrouter"

export class OpenRouterActionError extends Schema.TaggedErrorClass<OpenRouterActionError>()(
  "OpenRouterActionError",
  {
    category: OpenRouterAccount.ProviderErrorCategory,
    message: Schema.String,
    httpStatus: Schema.optional(Schema.Number),
    retryAfter: Schema.optional(Schema.Number),
  },
  { httpApiStatus: 422 },
) {}

export const ConnectPayload = Schema.Struct({
  key: Schema.String,
  label: Schema.optional(Schema.String),
})

export const OpenRouterAccountPaths = {
  account: `${root}/account`,
  connect: `${root}/account/connect`,
  pkce: `${root}/account/pkce`,
  pkceAttempt: `${root}/account/pkce/:attemptID`,
  verify: `${root}/account/verify`,
  models: `${root}/models`,
  refreshModels: `${root}/models/refresh`,
} as const

export const OpenRouterAccountApi = HttpApi.make("openrouter-account").add(
  HttpApiGroup.make("openrouter-account")
    .add(
      HttpApiEndpoint.get("get", OpenRouterAccountPaths.account, {
        success: described(Schema.NullOr(OpenRouterAccount.Account), "OpenRouter account projection"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.post("connect", OpenRouterAccountPaths.connect, {
        payload: ConnectPayload,
        success: described(OpenRouterAccount.Account, "Connected OpenRouter account"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.post("startPkce", OpenRouterAccountPaths.pkce, {
        success: described(OpenRouterAccount.PkceAttempt, "Started OpenRouter PKCE connection"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.get("getPkce", OpenRouterAccountPaths.pkceAttempt, {
        params: { attemptID: OpenRouterAccount.PkceAttemptID },
        success: described(OpenRouterAccount.PkceAttempt, "OpenRouter PKCE connection status"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.delete("cancelPkce", OpenRouterAccountPaths.pkceAttempt, {
        params: { attemptID: OpenRouterAccount.PkceAttemptID },
        success: described(OpenRouterAccount.PkceAttempt, "Cancelled OpenRouter PKCE connection"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.post("verify", OpenRouterAccountPaths.verify, {
        success: described(OpenRouterAccount.Account, "Verified OpenRouter account"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.delete("remove", OpenRouterAccountPaths.account, {
        success: described(Schema.Void, "Removed OpenRouter account"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.get("models", OpenRouterAccountPaths.models, {
        success: described(Schema.NullOr(OpenRouterAccount.ModelCatalog), "Cached OpenRouter model catalog"),
        error: OpenRouterActionError,
      }),
      HttpApiEndpoint.post("refreshModels", OpenRouterAccountPaths.refreshModels, {
        success: described(OpenRouterAccount.ModelCatalog, "Refreshed OpenRouter model catalog"),
        error: OpenRouterActionError,
      }),
    )
    .annotateMerge(
      OpenApi.annotations({
        title: "openrouter-account",
        description: "Protected OpenRouter account and model catalog adapter routes.",
      }),
    )
    .middleware(Authorization),
)
