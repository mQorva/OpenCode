import { afterEach, describe, expect } from "bun:test"
import { Effect } from "effect"
import { Credential } from "@opencode-ai/core/credential"
import { CredentialTable } from "@opencode-ai/core/credential/sql"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Integration } from "@opencode-ai/core/integration"
import { ProtectedSecret } from "@opencode-ai/core/protected-secret"
import { testEffect } from "./lib/effect"

const it = testEffect(LayerNode.compile(LayerNode.group([Database.node, Credential.node])))

afterEach(() => ProtectedSecret.reset())

describe("Credential", () => {
  it.effect("stores, updates, lists, and removes credentials", () =>
    Effect.gen(function* () {
      const credentials = yield* Credential.Service
      const integrationID = Integration.ID.make("openai")
      const created = yield* credentials.create({
        integrationID,
        label: "Work",
        value: Credential.Key.make({ type: "key", key: "secret" }),
      })

      expect(created.protected).toBe(false)
      expect(yield* credentials.list(integrationID)).toEqual([created])
      expect(yield* credentials.resolve(created.id)).toEqual(created.value)
      yield* credentials.update(created.id, { label: "Personal" })
      expect((yield* credentials.list(integrationID))[0]?.label).toBe("Personal")

      const replacement = yield* credentials.create({
        integrationID,
        label: "Replacement",
        value: Credential.Key.make({ type: "key", key: "replacement" }),
      })
      expect(yield* credentials.list(integrationID)).toEqual([replacement])

      yield* credentials.remove(replacement.id)
      expect(yield* credentials.list(integrationID)).toEqual([])
    }),
  )

  it.effect("stores protected credentials without exposing plaintext", () =>
    Effect.gen(function* () {
      const values = new Map<string, string>()
      ProtectedSecret.install({
        put: (ref, value) => Effect.sync(() => void values.set(ref, value)),
        get: (ref) => Effect.succeed(values.get(ref)),
        remove: (ref) => Effect.sync(() => values.delete(ref)),
      })
      const credentials = yield* Credential.Service
      const { db } = yield* Database.Service
      const integrationID = Integration.ID.make("openrouter")
      const value = Credential.Key.make({ type: "key", key: "never-store-plaintext" })

      const created = yield* credentials.createProtected({ integrationID, label: "OpenRouter", value })
      expect(created).toMatchObject({ integrationID, label: "OpenRouter", protected: true })
      expect(created.value).toBeUndefined()
      expect((yield* credentials.get(created.id))?.value).toBeUndefined()
      expect((yield* credentials.list(integrationID))[0]?.value).toBeUndefined()
      expect(yield* credentials.resolve(created.id)).toEqual(value)

      const row = yield* db.select().from(CredentialTable).get().pipe(Effect.orDie)
      expect(row?.value).toBeNull()
      expect(row?.secret_ref).toMatch(/^sec_/)
      expect(JSON.stringify(row)).not.toContain("never-store-plaintext")

      yield* credentials.update(created.id, {
        value: Credential.Key.make({ type: "key", key: "replacement-secret" }),
      })
      expect(yield* credentials.resolve(created.id)).toEqual(
        Credential.Key.make({ type: "key", key: "replacement-secret" }),
      )
      expect([...values.values()].join(" ")).not.toContain("never-store-plaintext")

      yield* credentials.remove(created.id)
      expect(yield* credentials.get(created.id)).toBeUndefined()
      expect(values.size).toBe(0)
    }),
  )

  it.effect("keeps protected metadata when secret deletion fails so removal can be retried", () =>
    Effect.gen(function* () {
      let failRemoval = true
      const values = new Map<string, string>()
      ProtectedSecret.install({
        put: (ref, value) => Effect.sync(() => void values.set(ref, value)),
        get: (ref) => Effect.succeed(values.get(ref)),
        remove: (ref) =>
          failRemoval ? Effect.fail(new Error("temporary failure")) : Effect.sync(() => values.delete(ref)),
      })
      const credentials = yield* Credential.Service
      const created = yield* credentials.createProtected({
        integrationID: Integration.ID.make("openrouter"),
        value: Credential.Key.make({ type: "key", key: "secret" }),
      })

      expect((yield* credentials.remove(created.id).pipe(Effect.flip))._tag).toBe("ProtectedSecret.Operation")
      expect(yield* credentials.get(created.id)).toBeDefined()
      failRemoval = false
      yield* credentials.remove(created.id)
      expect(yield* credentials.get(created.id)).toBeUndefined()
    }),
  )

  it.effect("rejects malformed protected values", () =>
    Effect.gen(function* () {
      const values = new Map<string, string>()
      ProtectedSecret.install({
        put: (ref, value) => Effect.sync(() => void values.set(ref, value)),
        get: (ref) => Effect.succeed(values.get(ref)),
        remove: (ref) => Effect.sync(() => values.delete(ref)),
      })
      const credentials = yield* Credential.Service
      const created = yield* credentials.createProtected({
        integrationID: Integration.ID.make("openrouter"),
        value: Credential.Key.make({ type: "key", key: "secret" }),
      })
      const ref = [...values.keys()][0]
      if (!ref) throw new Error("expected protected reference")
      values.set(ref, "not valid credential json")

      const error = yield* credentials.resolve(created.id).pipe(Effect.flip)
      expect(error).toBeInstanceOf(Credential.ProtectedValueError)
    }),
  )
})
