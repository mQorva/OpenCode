import { afterEach, describe, expect } from "bun:test"
import { Effect } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { ProtectedSecret } from "@opencode-ai/core/protected-secret"
import { testEffect } from "./lib/effect"

const layer = LayerNode.compile(ProtectedSecret.node)
const it = testEffect(layer)

afterEach(() => ProtectedSecret.reset())

describe("ProtectedSecret", () => {
  it.effect("reports unavailable without an adapter", () =>
    Effect.gen(function* () {
      const secrets = yield* ProtectedSecret.Service

      expect(yield* secrets.available()).toBe(false)
      const error = yield* secrets.get(ProtectedSecret.ID.create()).pipe(Effect.flip)
      expect(error).toBeInstanceOf(ProtectedSecret.Unavailable)
    }),
  )

  it.effect("installs an adapter, round-trips, replaces, and removes a value", () =>
    Effect.gen(function* () {
      const values = new Map<string, string>()
      const uninstall = ProtectedSecret.install({
        put: (ref, value) => Effect.sync(() => void values.set(ref, value)),
        get: (ref) => Effect.succeed(values.get(ref)),
        remove: (ref) => Effect.sync(() => values.delete(ref)),
      })
      try {
        const secrets = yield* ProtectedSecret.Service
        expect(yield* secrets.available()).toBe(true)

        const ref = yield* secrets.put("first")
        expect(ref).toMatch(/^sec_/)
        expect(yield* secrets.get(ref)).toBe("first")
        expect(yield* secrets.put("second", ref)).toBe(ref)
        expect(yield* secrets.get(ref)).toBe("second")
        yield* secrets.remove(ref)
        expect(values.has(ref)).toBe(false)
      } finally {
        uninstall()
      }
    }),
  )

  it.effect("returns NotFound for a missing reference", () =>
    Effect.gen(function* () {
      ProtectedSecret.install({
        put: () => Effect.void,
        get: () => Effect.succeed(undefined),
        remove: () => Effect.succeed(false),
      })
      const secrets = yield* ProtectedSecret.Service
      const ref = ProtectedSecret.ID.create()
      const error = yield* secrets.get(ref).pipe(Effect.flip)
      expect(error).toBeInstanceOf(ProtectedSecret.NotFound)
      if (error instanceof ProtectedSecret.NotFound) expect(error.ref).toBe(ref)
    }),
  )

  it.effect("sanitizes adapter failures", () =>
    Effect.gen(function* () {
      const secret = "do-not-leak-this-value"
      ProtectedSecret.install({
        put: () => Effect.fail(new Error(`${secret}: technical adapter detail`)),
        get: () => Effect.fail(new Error(`${secret}: technical adapter detail`)),
        remove: () => Effect.fail(new Error(`${secret}: technical adapter detail`)),
      })
      const secrets = yield* ProtectedSecret.Service
      const error = yield* secrets.put(secret).pipe(Effect.flip)
      expect(error).toBeInstanceOf(ProtectedSecret.Operation)
      expect(error.message).toBe("Protected secret operation failed.")
      expect(error.message).not.toContain(secret)
      expect(error.message).not.toContain("technical adapter detail")
    }),
  )

  it.effect("resets the adapter and isolates later installations", () =>
    Effect.gen(function* () {
      const first = ProtectedSecret.install({
        put: () => Effect.void,
        get: () => Effect.succeed("first"),
        remove: () => Effect.void,
      })
      const secrets = yield* ProtectedSecret.Service
      expect(yield* secrets.available()).toBe(true)
      first()
      expect(yield* secrets.available()).toBe(false)

      ProtectedSecret.install({
        put: () => Effect.void,
        get: () => Effect.succeed("second"),
        remove: () => Effect.void,
      })
      expect(yield* secrets.get(ProtectedSecret.ID.create())).toBe("second")
      ProtectedSecret.reset()
      expect(yield* secrets.available()).toBe(false)
    }),
  )
})
