import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  ProtectedSecretBridgeError,
  createProtectedSecretClient,
  installProtectedSecretHost,
  type ProtectedSecretMessageChannel,
} from "./protected-secret-bridge"
import { ProtectedSecret } from "@opencode-ai/core/protected-secret"

function channels() {
  const left = new Set<(message: unknown) => void>()
  const right = new Set<(message: unknown) => void>()
  const endpoint = (
    own: Set<(message: unknown) => void>,
    peer: Set<(message: unknown) => void>,
  ): ProtectedSecretMessageChannel => ({
    postMessage: (message) => queueMicrotask(() => peer.forEach((handler) => handler(message))),
    on: (_event, handler) => own.add(handler),
    off: (_event, handler) => own.delete(handler),
  })
  return { host: endpoint(left, right), client: endpoint(right, left), left, right }
}

function memoryStore() {
  const values = new Map<string, string>()
  return {
    values,
    store: {
      put(value: string, ref = ProtectedSecret.ID.create()) {
        values.set(ref, value)
        return ref
      },
      get: (ref: string) => values.get(ref),
      delete: (ref: string) => values.delete(ref),
    },
  }
}

describe("protected secret bridge", () => {
  test("round-trips, replaces, and removes secrets with correlated parallel requests", async () => {
    const pair = channels()
    const memory = memoryStore()
    const detach = installProtectedSecretHost(pair.host, {
      store: memory.store,
      isEncryptionAvailable: () => true,
    })
    let next = 0
    const client = createProtectedSecretClient(pair.client, {
      createRequestId: () => `psr_request_${++next}`,
      timeoutMs: 100,
    })
    const first = ProtectedSecret.ID.create()
    const second = ProtectedSecret.ID.create()

    await Promise.all([
      Effect.runPromise(client.adapter.put(first, "alpha")),
      Effect.runPromise(client.adapter.put(second, "beta")),
    ])
    expect(await Effect.runPromise(client.adapter.get(first))).toBe("alpha")
    expect(await Effect.runPromise(client.adapter.get(second))).toBe("beta")
    await Effect.runPromise(client.adapter.put(first, "replaced"))
    expect(await Effect.runPromise(client.adapter.get(first))).toBe("replaced")
    expect(await Effect.runPromise(client.adapter.remove(first))).toBe(true)
    expect(await Effect.runPromise(client.adapter.get(first))).toBeUndefined()

    client.close()
    detach()
    expect(pair.left.size).toBe(0)
    expect(pair.right.size).toBe(0)
  })

  test("ignores invalid messages and rejects timed-out requests", async () => {
    const pair = channels()
    const client = createProtectedSecretClient(pair.client, { timeoutMs: 10, createRequestId: () => "psr_timeout_1" })
    pair.host.postMessage({ type: "protected-secret-result", requestId: "invalid", ok: true })

    const error = await Effect.runPromise(client.adapter.get(ProtectedSecret.ID.create()).pipe(Effect.flip))
    expect(error).toBeInstanceOf(ProtectedSecretBridgeError)
    if (error instanceof ProtectedSecretBridgeError) expect(error.code).toBe("timeout")
    client.close()
  })

  test("sanitizes host failures and rejects pending work when closed", async () => {
    const pair = channels()
    const detach = installProtectedSecretHost(pair.host, {
      isEncryptionAvailable: () => true,
      store: {
        put: () => {
          throw new Error("secret and technical detail")
        },
        get: () => undefined,
        delete: () => false,
      },
    })
    let next = 0
    const client = createProtectedSecretClient(pair.client, {
      timeoutMs: 100,
      createRequestId: () => `psr_failure_${++next}`,
    })
    const failed = await Effect.runPromise(
      client.adapter.put(ProtectedSecret.ID.create(), "do-not-leak").pipe(Effect.flip),
    )
    expect(failed).toBeInstanceOf(ProtectedSecretBridgeError)
    expect(failed.message).not.toContain("do-not-leak")
    expect(failed.message).not.toContain("technical")

    const pending = Effect.runPromise(client.adapter.get(ProtectedSecret.ID.create()).pipe(Effect.flip))
    client.close()
    const closed = await pending
    expect(closed).toBeInstanceOf(ProtectedSecretBridgeError)
    if (closed instanceof ProtectedSecretBridgeError) expect(closed.code).toBe("closed")
    detach()
  })

  test("reports unavailable encryption without exposing host details", async () => {
    const pair = channels()
    const memory = memoryStore()
    const detach = installProtectedSecretHost(pair.host, {
      store: memory.store,
      isEncryptionAvailable: () => false,
    })
    const client = createProtectedSecretClient(pair.client, {
      timeoutMs: 100,
      createRequestId: () => "psr_unavailable_1",
    })
    const error = await Effect.runPromise(
      client.adapter.put(ProtectedSecret.ID.create(), "do-not-leak").pipe(Effect.flip),
    )
    expect(error).toBeInstanceOf(ProtectedSecretBridgeError)
    if (error instanceof ProtectedSecretBridgeError) expect(error.code).toBe("unavailable")
    client.close()
    detach()
  })
})
