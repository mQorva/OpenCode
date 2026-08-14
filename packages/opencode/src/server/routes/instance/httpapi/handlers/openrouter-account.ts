import { OpenRouterAccountService } from "@opencode-ai/core/openrouter-account"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ConnectPayload, OpenRouterActionError } from "../groups/openrouter-account"

const mapError = <A>(effect: Effect.Effect<A, OpenRouterAccountService.Error>) =>
  effect.pipe(
    Effect.mapError(
      (error) =>
        new OpenRouterActionError({
          category: error.category,
          message: error.message,
          httpStatus: error.httpStatus,
          retryAfter: error.retryAfter,
        }),
    ),
  )

export const openRouterAccountHandlers = HttpApiBuilder.group(InstanceHttpApi, "openrouter-account", (handlers) =>
  Effect.gen(function* () {
    const account = yield* OpenRouterAccountService.Service
    return handlers
      .handle("get", () => mapError(account.get()).pipe(Effect.map((value) => value ?? null)))
      .handle("connect", (ctx: { payload: typeof ConnectPayload.Type }) =>
        mapError(account.connectKey({ ...ctx.payload, kind: "openrouter_api_key" })),
      )
      .handle("verify", () => mapError(account.verify()))
      .handle("remove", () => mapError(account.remove()))
      .handle("models", () => mapError(account.models()).pipe(Effect.map((value) => value ?? null)))
      .handle("refreshModels", () => mapError(account.refreshModels()))
  }),
)
