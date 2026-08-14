import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { OpenRouterPKCE } from "@opencode-ai/core/openrouter-pkce"

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)

describe("OpenRouterPKCE", () => {
  test("creates an RFC 7636 S256 base64url challenge without padding", () => {
    expect(OpenRouterPKCE.createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })

  test("creates the official authorization URL and accepts one callback", async () => {
    const flow = await run(OpenRouterPKCE.make().start({ timeoutMs: 2_000 }))
    const authorization = new URL(flow.authorizationUrl)
    const callback = authorization.searchParams.get("callback_url")
    const callbackValue = new URL(flow.callbackUrl)
    const state = callbackValue.searchParams.get("state")

    expect(authorization.origin).toBe("https://openrouter.ai")
    expect(authorization.pathname).toBe("/auth")
    expect(callback).toBe(flow.callbackUrl)
    expect(new URL(flow.callbackUrl).hostname).toBe("127.0.0.1")
    expect(new URL(flow.callbackUrl).pathname).toBe("/callback")
    expect(new URL(flow.callbackUrl).port).not.toBe("")
    expect(callbackValue.searchParams.has("state")).toBe(true)
    expect(authorization.searchParams.has("state")).toBe(false)
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256")
    expect(authorization.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)

    const waiting = run(flow.wait)
    const response = await fetch(`${flow.callbackUrl}&code=one-time-code`)
    expect(response.status).toBe(200)
    expect(await waiting).toMatchObject({ code: "one-time-code", callbackUrl: flow.callbackUrl })
  })

  test("rejects a callback with the wrong state and closes the listener", async () => {
    const flow = await run(OpenRouterPKCE.make().start({ timeoutMs: 2_000 }))
    const callback = new URL(flow.callbackUrl)
    callback.searchParams.set("state", "wrong-state")
    callback.searchParams.set("code", "not-returned")
    const waiting = run(flow.wait).then(
      () => undefined,
      (error) => error,
    )
    const response = await fetch(callback)
    const error = await waiting

    expect(response.status).toBe(400)
    expect(error).toBeInstanceOf(OpenRouterPKCE.InvalidState)
    expect(JSON.stringify(error)).not.toContain("not-returned")
  })

  test("rejects a callback without a code", async () => {
    const flow = await run(OpenRouterPKCE.make().start({ timeoutMs: 2_000 }))
    const callback = new URL(flow.callbackUrl)
    callback.searchParams.delete("code")
    const waiting = run(flow.wait).then(
      () => undefined,
      (error) => error,
    )
    const response = await fetch(callback)
    const error = await waiting

    expect(response.status).toBe(400)
    expect(error).toBeInstanceOf(OpenRouterPKCE.MissingCode)
  })

  test("rejects a callback without state", async () => {
    const flow = await run(OpenRouterPKCE.make().start({ timeoutMs: 2_000 }))
    const callback = new URL(flow.callbackUrl)
    callback.searchParams.delete("state")
    callback.searchParams.set("code", "not-returned")
    const waiting = run(flow.wait).then(
      () => undefined,
      (error) => error,
    )
    const response = await fetch(callback)
    const error = await waiting

    expect(response.status).toBe(400)
    expect(error).toBeInstanceOf(OpenRouterPKCE.MissingState)
    expect(JSON.stringify(error)).not.toContain("not-returned")
  })

  test("classifies provider denial before a missing code", async () => {
    const flow = await run(OpenRouterPKCE.make().start({ timeoutMs: 2_000 }))
    const callback = new URL(flow.callbackUrl)
    callback.searchParams.set("error", "access_denied")
    const waiting = run(flow.wait).then(
      () => undefined,
      (error) => error,
    )
    const response = await fetch(callback)
    const error = await waiting

    expect(response.status).toBe(400)
    expect(error).toBeInstanceOf(OpenRouterPKCE.ProviderDenied)
    expect(JSON.stringify(error)).not.toContain("access_denied")
  })

  test("times out and supports explicit cancellation", async () => {
    const timeoutFlow = await run(OpenRouterPKCE.make().start({ timeoutMs: 20 }))
    const timeoutError = await run(timeoutFlow.wait).then(
      () => undefined,
      (error) => error,
    )
    expect(timeoutError).toBeInstanceOf(OpenRouterPKCE.Timeout)

    const cancelFlow = await run(OpenRouterPKCE.make().start({ timeoutMs: 2_000 }))
    const waiting = run(cancelFlow.wait).then(
      () => undefined,
      (error) => error,
    )
    await run(cancelFlow.cancel)
    expect(await waiting).toBeInstanceOf(OpenRouterPKCE.Cancelled)
  })

  test("binds the injected listener only to the loopback contract", async () => {
    let input: Parameters<OpenRouterPKCE.ServerBoundary["listen"]>[0] | undefined
    let closed = 0
    let status = 0
    const service = OpenRouterPKCE.make({
      random: { bytes: (size) => new Uint8Array(size).fill(7) },
      server: {
        listen: (next) =>
          Effect.sync(() => {
            input = next
            return { port: 45678, close: () => Effect.sync(() => void closed++) }
          }),
      },
    })
    const flow = await run(service.start({ timeoutMs: 2_000 }))

    expect(input?.host).toBe("127.0.0.1")
    expect(input?.port).toBe(0)
    expect(flow.callbackUrl).toMatch(/^http:\/\/127\.0\.0\.1:45678\/callback\?state=[A-Za-z0-9_-]+$/)
    const state = new URL(flow.callbackUrl).searchParams.get("state")
    const waiting = run(flow.wait)
    input?.onRequest(
      { method: "GET", url: `/callback?state=${encodeURIComponent(state ?? "")}&code=one-time-code` },
      { respond: (next) => void (status = next) },
    )
    await waiting
    expect(status).toBe(200)
    expect(closed).toBe(1)
  })
})
