import { ProviderAuth } from "@/provider/auth"
import { Config } from "@/config/config"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { Provider } from "@/provider/provider"
import { Auth } from "@/auth"

import { mapValues } from "remeda"
import { Effect, Schema } from "effect"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { ProviderAuthApiError } from "../groups/provider"
import { ProviderV2 } from "@opencode-ai/core/provider"

function mapProviderAuthError<A, R>(self: Effect.Effect<A, ProviderAuth.Error, R>) {
  return self.pipe(
    Effect.mapError((error) => {
      if (error instanceof ProviderAuth.OauthMissing) {
        return new ProviderAuthApiError({ name: error._tag, data: { providerID: error.providerID } })
      }
      if (error instanceof ProviderAuth.OauthCodeMissing) {
        return new ProviderAuthApiError({ name: error._tag, data: { providerID: error.providerID } })
      }
      if (error instanceof ProviderAuth.OauthCallbackFailed) {
        return new ProviderAuthApiError({ name: error._tag, data: {} })
      }
      if (error instanceof ProviderAuth.ValidationFailed) {
        return new ProviderAuthApiError({ name: error._tag, data: { field: error.field, message: error.message } })
      }
      return new ProviderAuthApiError({ name: "BadRequest", data: {} })
    }),
  )
}

export const providerHandlers = HttpApiBuilder.group(InstanceHttpApi, "provider", (handlers) =>
  Effect.gen(function* () {
    const cfg = yield* Config.Service
    const provider = yield* Provider.Service
    const svc = yield* ProviderAuth.Service
    const authStore = yield* Auth.Service

    // The models.dev catalog holds 213 providers with 7500+ models and is identical for every
    // directory. Rebuilding it per request costs ~500ms — `toPublicInfo` alone validates every
    // model with `Schema.is` — and startup asks for the list repeatedly. Keep the transformed
    // catalog keyed on the models.dev snapshot identity and the provider filter; connected
    // providers stay live because they carry auth state.
    let catalog:
      | {
          source: Record<string, ModelsDev.Provider>
          filter: string
          entries: Record<string, Provider.Info>
          publicInfo: Record<string, Provider.Info>
        }
      | undefined

    const list = Effect.fn("ProviderHttpApi.list")(function* (ctx: { query: { connected?: boolean } }) {
      const connected = yield* provider.list()
      const credentials = yield* authStore.all().pipe(Effect.orDie)

      // `connected=true` skips the catalog entirely — the caller only wants what is usable
      // right now and pulls the rest separately.
      if (ctx.query.connected) {
        const providers = { ...connected }
        return {
          all: Object.values(providers).map(Provider.toPublicInfo),
          default: Provider.defaultModelIDs(providers),
          connected: Object.keys(providers).filter((id) => id in connected || credentials[id]),
        }
      }

      const config = yield* cfg.get()
      const all = yield* ModelsDev.Service.use((s) => s.get())
      const filter = JSON.stringify([config.enabled_providers ?? null, config.disabled_providers ?? null])
      if (!catalog || catalog.source !== all || catalog.filter !== filter) {
        const disabled = new Set(config.disabled_providers ?? [])
        const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined
        const entries = mapValues(
          Object.fromEntries(
            Object.entries(all).filter(([key]) => (enabled ? enabled.has(key) : true) && !disabled.has(key)),
          ),
          (item) => Provider.fromModelsDevProvider(item),
        )
        catalog = { source: all, filter, entries, publicInfo: mapValues(entries, Provider.toPublicInfo) }
      }
      const providers = Object.assign({ ...catalog.entries }, connected)
      // Connected providers carry live auth state and overwrite the catalog entry, so they
      // must not be served from the cached public info.
      const publicInfo = catalog.publicInfo
      return {
        all: Object.entries(providers).map(([id, item]) =>
          id in connected ? Provider.toPublicInfo(item) : (publicInfo[id] ?? Provider.toPublicInfo(item)),
        ),
        default: Provider.defaultModelIDs(providers),
        connected: Object.keys(providers).filter((id) => id in connected || credentials[id]),
      }
    })

    const auth = Effect.fn("ProviderHttpApi.auth")(function* () {
      return yield* svc.methods()
    })

    const authorize = Effect.fn("ProviderHttpApi.authorize")(function* (ctx: {
      params: { providerID: ProviderV2.ID }
      payload: ProviderAuth.AuthorizeInput
    }) {
      return yield* mapProviderAuthError(
        svc.authorize({
          providerID: ctx.params.providerID,
          method: ctx.payload.method,
          inputs: ctx.payload.inputs,
        }),
      )
    })

    const authorizeRaw = Effect.fn("ProviderHttpApi.authorizeRaw")(function* (ctx: {
      params: { providerID: ProviderV2.ID }
      request: HttpServerRequest.HttpServerRequest
    }) {
      const body = yield* Effect.orDie(ctx.request.text)
      const payload = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(ProviderAuth.AuthorizeInput))(body).pipe(
        Effect.mapError(() => new ProviderAuthApiError({ name: "BadRequest", data: {} })),
      )
      // Match legacy route behavior: when authorize() resolves without a
      // result (e.g. no further redirect), serialize as JSON `null` instead
      // of an empty body so clients can `.json()` parse the response.
      const result = yield* authorize({ params: ctx.params, payload })
      return HttpServerResponse.jsonUnsafe(result ?? null)
    })

    const callback = Effect.fn("ProviderHttpApi.callback")(function* (ctx: {
      params: { providerID: ProviderV2.ID }
      payload: ProviderAuth.CallbackInput
    }) {
      yield* mapProviderAuthError(
        svc.callback({
          providerID: ctx.params.providerID,
          method: ctx.payload.method,
          code: ctx.payload.code,
        }),
      )
      return true
    })

    return handlers
      .handle("list", list)
      .handle("auth", auth)
      .handleRaw("authorize", authorizeRaw)
      .handle("callback", callback)
  }),
)
