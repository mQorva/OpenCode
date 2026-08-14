export * as OpenRouterClient from "./openrouter-client"

import { Context, Effect, Exit, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { makeGlobalNode } from "./effect/app-node"
import { httpClient } from "./effect/app-node-platform"

const endpoint = "https://openrouter.ai/api/v1"
const timeout = "15 seconds"

const NullableNumber = Schema.NullOr(Schema.Finite)
const NullableString = Schema.NullOr(Schema.String)

const CurrentKeyResponse = Schema.Struct({
  data: Schema.Struct({
    label: Schema.String,
    is_free_tier: Schema.Boolean,
    is_management_key: Schema.Boolean,
    is_provisioning_key: Schema.Boolean,
    include_byok_in_limit: Schema.optional(Schema.Boolean),
    creator_user_id: Schema.optional(Schema.String),
    limit: NullableNumber,
    limit_remaining: NullableNumber,
    limit_reset: Schema.NullOr(Schema.Literals(["daily", "weekly", "monthly"])),
    usage: Schema.Finite,
    usage_daily: Schema.Finite,
    usage_weekly: Schema.Finite,
    usage_monthly: Schema.Finite,
    byok_usage: Schema.Finite,
    byok_usage_daily: Schema.Finite,
    byok_usage_weekly: Schema.Finite,
    byok_usage_monthly: Schema.Finite,
    expires_at: NullableString,
  }),
})

const RemoteModel = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  context_length: Schema.Finite,
  architecture: Schema.Struct({
    input_modalities: Schema.Array(Schema.String),
    output_modalities: Schema.Array(Schema.String),
  }),
  supported_parameters: Schema.Array(Schema.String),
  pricing: Schema.Record(Schema.String, Schema.String),
})

const ModelListEnvelope = Schema.Struct({ data: Schema.Array(Schema.Unknown) })
const ExchangeResponse = Schema.Struct({
  key: Schema.String,
  user_id: Schema.optional(Schema.NullOr(Schema.String)),
})

export type KeyMetadata = (typeof CurrentKeyResponse.Type)["data"]
export type Model = typeof RemoteModel.Type
export type Exchange = typeof ExchangeResponse.Type

export type ModelCatalog = {
  readonly models: readonly Model[]
  readonly rejected: number
}

export const ErrorCategory = Schema.Literals([
  "auth_callback",
  "provider_auth",
  "provider_payment",
  "provider_permission",
  "provider_rate_limit",
  "provider_timeout",
  "provider_unavailable",
  "provider_protocol",
])
export type ErrorCategory = typeof ErrorCategory.Type

export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()("OpenRouterClient.ProviderError", {
  category: ErrorCategory,
  status: Schema.optional(Schema.Number),
  retryAfterSeconds: Schema.optional(Schema.Number),
}) {
  override get message() {
    return "OpenRouter request failed."
  }
}

export interface Interface {
  readonly currentKey: (key: string) => Effect.Effect<KeyMetadata, ProviderError>
  readonly models: (key: string) => Effect.Effect<ModelCatalog, ProviderError>
  readonly exchange: (code: string, verifier: string) => Effect.Effect<Exchange, ProviderError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/OpenRouterClient") {}

const statusCategory = (status: number): ErrorCategory => {
  if (status === 401) return "provider_auth"
  if (status === 402) return "provider_payment"
  if (status === 403) return "provider_permission"
  if (status === 408) return "provider_timeout"
  if (status === 429) return "provider_rate_limit"
  if (status === 502 || status === 503 || status === 504) return "provider_unavailable"
  return "provider_protocol"
}

const retryAfter = (value: string | undefined) => {
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number(value)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : undefined
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const request = Effect.fn("OpenRouterClient.request")(function* (path: string, key: string) {
      const response = yield* HttpClientRequest.get(`${endpoint}${path}`).pipe(
        HttpClientRequest.acceptJson,
        HttpClientRequest.bearerToken(key),
        http.execute,
        Effect.timeout(timeout),
        Effect.mapError(
          (error) =>
            new ProviderError({
              category: error._tag === "TimeoutError" ? "provider_timeout" : "provider_unavailable",
            }),
        ),
      )
      if (response.status < 200 || response.status >= 300) {
        return yield* new ProviderError({
          category: statusCategory(response.status),
          status: response.status,
          retryAfterSeconds: retryAfter(response.headers["retry-after"]),
        })
      }
      return yield* response.json.pipe(
        Effect.mapError(() => new ProviderError({ category: "provider_protocol", status: response.status })),
      )
    })

    const exchangeRequest = Effect.fn("OpenRouterClient.exchangeRequest")(function* (code: string, verifier: string) {
      const response = yield* HttpClientRequest.post(`${endpoint}/auth/keys`).pipe(
        HttpClientRequest.acceptJson,
        HttpClientRequest.bodyJson({ code, code_verifier: verifier, code_challenge_method: "S256" }),
        Effect.flatMap(http.execute),
        Effect.timeout(timeout),
        Effect.mapError(
          (error) =>
            new ProviderError({
              category: error._tag === "TimeoutError" ? "provider_timeout" : "provider_unavailable",
            }),
        ),
      )
      if (response.status < 200 || response.status >= 300) {
        const category =
          response.status === 400 || response.status === 401 || response.status === 403
            ? "auth_callback"
            : statusCategory(response.status)
        return yield* new ProviderError({
          category,
          status: response.status,
          retryAfterSeconds: retryAfter(response.headers["retry-after"]),
        })
      }
      const body = yield* response.json.pipe(
        Effect.mapError(() => new ProviderError({ category: "provider_protocol", status: response.status })),
      )
      const decoded = yield* Schema.decodeUnknownEffect(ExchangeResponse)(body).pipe(
        Effect.mapError(() => new ProviderError({ category: "provider_protocol", status: response.status })),
      )
      if (!decoded.key.trim())
        return yield* new ProviderError({ category: "provider_protocol", status: response.status })
      return decoded
    })

    return Service.of({
      currentKey: Effect.fn("OpenRouterClient.currentKey")(function* (key) {
        const body = yield* request("/key", key)
        const decoded = yield* Schema.decodeUnknownEffect(CurrentKeyResponse)(body).pipe(
          Effect.mapError(() => new ProviderError({ category: "provider_protocol", status: 200 })),
        )
        if (decoded.data.expires_at !== null && !Number.isFinite(Date.parse(decoded.data.expires_at))) {
          return yield* new ProviderError({ category: "provider_protocol", status: 200 })
        }
        return decoded.data
      }),
      models: Effect.fn("OpenRouterClient.models")(function* (key) {
        const body = yield* request("/models", key)
        const envelope = yield* Schema.decodeUnknownEffect(ModelListEnvelope)(body).pipe(
          Effect.mapError(() => new ProviderError({ category: "provider_protocol", status: 200 })),
        )
        const models: Model[] = []
        let rejected = 0
        for (const candidate of envelope.data) {
          const decoded = Schema.decodeUnknownExit(RemoteModel)(candidate)
          if (Exit.isFailure(decoded) || !decoded.value.id.trim() || !decoded.value.name.trim()) {
            rejected++
            continue
          }
          models.push(decoded.value)
        }
        return { models, rejected }
      }),
      exchange: exchangeRequest,
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [httpClient] })
