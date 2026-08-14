import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Credential } from "@opencode-ai/core/credential"
import { CredentialTable } from "@opencode-ai/core/credential/sql"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Integration } from "@opencode-ai/core/integration"
import { OpenRouterAccountService } from "@opencode-ai/core/openrouter-account"
import { OpenRouterAccountTable, OpenRouterModelCatalogTable } from "@opencode-ai/core/openrouter-account/sql"
import { OpenRouterClient } from "@opencode-ai/core/openrouter-client"
import { ProtectedSecret } from "@opencode-ai/core/protected-secret"
import { testEffect } from "./lib/effect"

const metadata: OpenRouterClient.KeyMetadata = {
  label: "sk-or-v1-abc...xyz",
  is_free_tier: false,
  is_management_key: false,
  is_provisioning_key: false,
  include_byok_in_limit: false,
  limit: 100,
  limit_remaining: 74.5,
  limit_reset: "monthly",
  usage: 25.5,
  usage_daily: 1,
  usage_weekly: 5,
  usage_monthly: 25.5,
  byok_usage: 0,
  byok_usage_daily: 0,
  byok_usage_weekly: 0,
  byok_usage_monthly: 0,
  expires_at: "2027-12-31T23:59:59Z",
}

const remoteModel: OpenRouterClient.Model = {
  id: "openai/gpt-4",
  name: "GPT-4",
  context_length: 8192,
  architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
  supported_parameters: ["tools", "reasoning", "response_format"],
  pricing: { prompt: "0.00003", completion: "0.00006", request: "0" },
}

let currentKey: OpenRouterClient.Interface["currentKey"] = () => Effect.succeed(metadata)
let models: OpenRouterClient.Interface["models"] = () => Effect.succeed({ models: [remoteModel], rejected: 1 })
let exchange: OpenRouterClient.Interface["exchange"] = () => Effect.die("unexpected PKCE exchange")

const clientLayer = Layer.succeed(
  OpenRouterClient.Service,
  OpenRouterClient.Service.of({
    currentKey: (key) => currentKey(key),
    models: (key) => models(key),
    exchange: (code, verifier) => exchange(code, verifier),
  }),
)

const layer = LayerNode.compile(
  LayerNode.group([Database.node, Credential.node, Integration.node, OpenRouterAccountService.node]),
  [[OpenRouterClient.node, clientLayer]] as const,
)
const it = testEffect(layer)

let protectedValues = new Map<string, string>()

afterEach(() => {
  ProtectedSecret.reset()
  protectedValues = new Map()
  currentKey = () => Effect.succeed(metadata)
  models = () => Effect.succeed({ models: [remoteModel], rejected: 1 })
  exchange = () => Effect.die("unexpected PKCE exchange")
})

const installSecrets = () =>
  ProtectedSecret.install({
    put: (ref, value) => Effect.sync(() => void protectedValues.set(ref, value)),
    get: (ref) => Effect.succeed(protectedValues.get(ref)),
    remove: (ref) => Effect.sync(() => protectedValues.delete(ref)),
  })

const waitForAttempt = (service: OpenRouterAccountService.Interface, id: Parameters<typeof service.getPkceAttempt>[0]) =>
  Effect.gen(function* () {
    for (let index = 0; index < 50; index++) {
      const attempt = yield* service.getPkceAttempt(id)
      if (attempt.status !== "pending") return attempt
      yield* Effect.sleep("10 millis")
    }
    return yield* Effect.die("PKCE attempt did not settle")
  })

describe("OpenRouterAccount", () => {
  it.effect("connects with protected storage and persists only safe metadata", () =>
    Effect.gen(function* () {
      installSecrets()
      let verified = ""
      currentKey = (key) => Effect.sync(() => ((verified = key), metadata))
      const service = yield* OpenRouterAccountService.Service
      const credentials = yield* Credential.Service
      const integrations = yield* Integration.Service
      const { db } = yield* Database.Service

      const account = yield* service.connectKey({ key: "  actual-secret  ", label: "Arbeit" })
      expect(verified).toBe("actual-secret")
      expect(account).toMatchObject({ provider: "openrouter", state: "connected", label: "Arbeit" })
      expect(JSON.stringify(account)).not.toContain("actual-secret")

      const credential = (yield* credentials.all())[0]
      expect(credential?.protected).toBe(true)
      expect(credential?.value).toBeUndefined()
      expect(
        yield* integrations.connection.resolve({ type: "credential", id: credential.id, label: credential.label }),
      ).toEqual(
        Credential.Key.make({ type: "key", key: "actual-secret", metadata: { origin: "openrouter_api_key" } }),
      )
      const credentialRow = yield* db.select().from(CredentialTable).get().pipe(Effect.orDie)
      const accountRow = yield* db.select().from(OpenRouterAccountTable).get().pipe(Effect.orDie)
      expect(credentialRow?.value).toBeNull()
      expect(JSON.stringify([credentialRow, accountRow])).not.toContain("actual-secret")
    }),
  )

  it.effect("discards an invalid candidate and leaves the active credential unchanged", () =>
    Effect.gen(function* () {
      installSecrets()
      const service = yield* OpenRouterAccountService.Service
      const credentials = yield* Credential.Service
      const connected = yield* service.connectKey({ key: "working-secret" })
      const active = (yield* credentials.all())[0]
      currentKey = () => Effect.fail(new OpenRouterClient.ProviderError({ category: "provider_auth", status: 401 }))

      const error = yield* service.connectKey({ key: "invalid-secret" }).pipe(Effect.flip)
      expect(error.category).toBe("provider_auth")
      expect(yield* service.get()).toMatchObject({ id: connected.id, state: "connected" })
      expect(yield* credentials.resolve(active.id)).toEqual(
        Credential.Key.make({ type: "key", key: "working-secret", metadata: { origin: "openrouter_api_key" } }),
      )
      expect([...protectedValues.values()].join(" ")).not.toContain("invalid-secret")
    }),
  )

  it.effect("refreshes models and retains the last catalog after a provider failure", () =>
    Effect.gen(function* () {
      installSecrets()
      const service = yield* OpenRouterAccountService.Service
      yield* service.connectKey({ key: "actual-secret" })
      const refreshed = yield* service.refreshModels()
      expect(refreshed.models).toHaveLength(1)
      expect(refreshed.models[0]).toMatchObject({
        slug: "openai/gpt-4",
        contextLength: 8192,
        capabilities: { tools: true, reasoning: true, structuredOutputs: true },
      })
      expect(refreshed.models[0]?.pricing.prompt).toBe(0.00003)

      models = () => Effect.fail(new OpenRouterClient.ProviderError({ category: "provider_unavailable", status: 503 }))
      expect((yield* service.refreshModels().pipe(Effect.flip)).category).toBe("provider_unavailable")
      expect((yield* service.models())?.models.map((model) => model.slug)).toEqual(["openai/gpt-4"])
      const { db } = yield* Database.Service
      expect((yield* db.select().from(OpenRouterModelCatalogTable).get().pipe(Effect.orDie))?.last_error_category).toBe(
        "provider_unavailable",
      )
    }),
  )

  it.effect("keeps metadata when protected deletion fails and removes all data on retry", () =>
    Effect.gen(function* () {
      let failRemoval = false
      ProtectedSecret.install({
        put: (ref, value) => Effect.sync(() => void protectedValues.set(ref, value)),
        get: (ref) => Effect.succeed(protectedValues.get(ref)),
        remove: (ref) =>
          failRemoval ? Effect.fail(new Error("temporary failure")) : Effect.sync(() => protectedValues.delete(ref)),
      })
      const service = yield* OpenRouterAccountService.Service
      yield* service.connectKey({ key: "actual-secret" })
      failRemoval = true
      expect((yield* service.remove().pipe(Effect.flip)).category).toBe("secret_storage")
      expect(yield* service.get()).toBeDefined()
      failRemoval = false
      yield* service.remove()
      expect(yield* service.get()).toBeUndefined()
      expect(protectedValues.size).toBe(0)
    }),
  )

  it.effect("connects through PKCE without exposing or persisting exchanged secrets", () =>
    Effect.gen(function* () {
      installSecrets()
      let received: { code: string; verifier: string } | undefined
      exchange = (code, verifier) =>
        Effect.sync(() => {
          received = { code, verifier }
          return { key: "exchanged-secret", user_id: "user-1" }
        })
      const service = yield* OpenRouterAccountService.Service
      const credentials = yield* Credential.Service
      const { db } = yield* Database.Service

      const started = yield* service.startPkce()
      expect(started.status).toBe("pending")
      expect(JSON.stringify(started)).not.toContain("verifier")
      const callback = new URL(new URL(started.authorizationUrl!).searchParams.get("callback_url")!)
      callback.searchParams.set("code", "one-time-code")
      expect((yield* Effect.tryPromise(() => fetch(callback))).status).toBe(200)

      const complete = yield* waitForAttempt(service, started.id)
      expect(complete.status).toBe("complete")
      expect(received?.code).toBe("one-time-code")
      expect(received?.verifier).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(JSON.stringify(complete)).not.toContain("exchanged-secret")
      const credential = (yield* credentials.all())[0]
      expect(credential?.protected).toBe(true)
      expect((yield* db.select().from(CredentialTable).get().pipe(Effect.orDie))?.value).toBeNull()
      expect(yield* service.get()).toMatchObject({ kind: "openrouter_pkce_key", state: "connected" })
    }),
  )

  it.effect("reports rejected PKCE exchange safely and supports cancellation", () =>
    Effect.gen(function* () {
      installSecrets()
      exchange = () => Effect.fail(new OpenRouterClient.ProviderError({ category: "auth_callback", status: 403 }))
      const service = yield* OpenRouterAccountService.Service
      const rejected = yield* service.startPkce()
      const callback = new URL(new URL(rejected.authorizationUrl!).searchParams.get("callback_url")!)
      callback.searchParams.set("code", "rejected-code")
      yield* Effect.tryPromise(() => fetch(callback))
      const failed = yield* waitForAttempt(service, rejected.id)
      expect(failed).toMatchObject({ status: "failed", error: { category: "auth_callback", httpStatus: 403 } })
      expect(JSON.stringify(failed)).not.toContain("rejected-code")

      const pending = yield* service.startPkce()
      const cancelled = yield* service.cancelPkce(pending.id)
      expect(cancelled).toMatchObject({ status: "cancelled", error: { category: "auth_cancelled" } })
      expect((yield* service.getPkceAttempt(pending.id)).status).toBe("cancelled")
    }),
  )

  it.effect("reports protected-store failure after PKCE without retaining the exchanged key", () =>
    Effect.gen(function* () {
      ProtectedSecret.install({
        put: () => Effect.fail(new Error("unavailable")),
        get: () => Effect.succeed(undefined),
        remove: () => Effect.void,
      })
      exchange = () => Effect.succeed({ key: "must-not-leak" })
      const service = yield* OpenRouterAccountService.Service
      const started = yield* service.startPkce()
      const callback = new URL(new URL(started.authorizationUrl!).searchParams.get("callback_url")!)
      callback.searchParams.set("code", "one-time-code")
      yield* Effect.tryPromise(() => fetch(callback))
      const failed = yield* waitForAttempt(service, started.id)
      expect(failed).toMatchObject({ status: "failed", error: { category: "secret_storage" } })
      expect(JSON.stringify(failed)).not.toContain("must-not-leak")
      expect(protectedValues.size).toBe(0)
    }),
  )
})
