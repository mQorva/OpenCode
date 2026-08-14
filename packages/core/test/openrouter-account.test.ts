import { afterEach, describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Credential } from "@opencode-ai/core/credential"
import { CredentialTable } from "@opencode-ai/core/credential/sql"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
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

const clientLayer = Layer.succeed(
  OpenRouterClient.Service,
  OpenRouterClient.Service.of({
    currentKey: (key) => currentKey(key),
    models: (key) => models(key),
  }),
)

const layer = LayerNode.compile(LayerNode.group([Database.node, Credential.node, OpenRouterAccountService.node]), [
  [OpenRouterClient.node, clientLayer],
] as const)
const it = testEffect(layer)

let protectedValues = new Map<string, string>()

afterEach(() => {
  ProtectedSecret.reset()
  protectedValues = new Map()
  currentKey = () => Effect.succeed(metadata)
  models = () => Effect.succeed({ models: [remoteModel], rejected: 1 })
})

const installSecrets = () =>
  ProtectedSecret.install({
    put: (ref, value) => Effect.sync(() => void protectedValues.set(ref, value)),
    get: (ref) => Effect.succeed(protectedValues.get(ref)),
    remove: (ref) => Effect.sync(() => protectedValues.delete(ref)),
  })

describe("OpenRouterAccount", () => {
  it.effect("connects with protected storage and persists only safe metadata", () =>
    Effect.gen(function* () {
      installSecrets()
      let verified = ""
      currentKey = (key) => Effect.sync(() => ((verified = key), metadata))
      const service = yield* OpenRouterAccountService.Service
      const credentials = yield* Credential.Service
      const { db } = yield* Database.Service

      const account = yield* service.connectKey({ key: "  actual-secret  ", label: "Arbeit" })
      expect(verified).toBe("actual-secret")
      expect(account).toMatchObject({ provider: "openrouter", state: "connected", label: "Arbeit" })
      expect(JSON.stringify(account)).not.toContain("actual-secret")

      const credential = (yield* credentials.all())[0]
      expect(credential?.protected).toBe(true)
      expect(credential?.value).toBeUndefined()
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
})
