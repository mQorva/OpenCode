import { describe, expect, test } from "bun:test"
import { confirmProviderConnection, connectCustomProvider, disconnectProviderConnection } from "./provider-connection"

const current = {
  integration: {
    get: async () => ({ data: { connections: [] } }),
  },
  credential: {
    remove: async () => undefined,
  },
}

describe("confirmProviderConnection", () => {
  test("checks the refreshed provider state", async () => {
    let connected = false
    await confirmProviderConnection({
      refresh: async () => {
        connected = true
      },
      connected: () => connected,
      expected: true,
      failureMessage: "not connected",
    })
    expect(connected).toBe(true)
  })

  test("fails instead of reporting an unconfirmed state", async () => {
    expect(
      confirmProviderConnection({
        refresh: async () => undefined,
        connected: () => false,
        expected: true,
        failureMessage: "not connected",
      }),
    ).rejects.toThrow("not connected")
  })
})

describe("connectCustomProvider", () => {
  test("stores, reloads, refreshes, and confirms before completing", async () => {
    const calls: string[] = []
    let connected = false

    await connectCustomProvider({
      providerID: "custom",
      key: "secret",
      client: {
        auth: { set: async () => void calls.push("auth") },
        instance: { dispose: async () => void calls.push("dispose") },
      },
      config: { provider: "custom" },
      updateConfig: async () => void calls.push("config"),
      refresh: async () => {
        calls.push("refresh")
        connected = true
      },
      connected: () => connected,
      failureMessage: "not connected",
    })

    expect(calls).toEqual(["auth", "config", "dispose", "refresh"])
  })
})

describe("disconnectProviderConnection", () => {
  test("reloads a legacy provider before confirming removal", async () => {
    const calls: string[] = []
    let connected = true

    await disconnectProviderConnection({
      providerID: "openrouter",
      protocol: "v1",
      legacy: {
        auth: { remove: async () => void calls.push("remove") },
        instance: { dispose: async () => void calls.push("dispose") },
      },
      current,
      disable: false,
      disabledProviders: [],
      updateConfig: async () => undefined,
      refresh: async () => {
        calls.push("refresh")
        connected = false
      },
      connected: () => connected,
      failureMessage: "still connected",
    })

    expect(calls).toEqual(["remove", "dispose", "refresh"])
  })

  test("removes credentials and disables configured legacy providers", async () => {
    const calls: string[] = []
    let disabled: string[] = []

    await disconnectProviderConnection({
      providerID: "custom",
      protocol: "v1",
      legacy: {
        auth: { remove: async () => void calls.push("remove") },
        instance: { dispose: async () => void calls.push("dispose") },
      },
      current,
      disable: true,
      disabledProviders: ["other"],
      updateConfig: async (config) => {
        calls.push("config")
        disabled = config.disabled_providers
      },
      refresh: async () => void calls.push("refresh"),
      connected: () => false,
      failureMessage: "still connected",
    })

    expect(calls).toEqual(["remove", "config", "dispose", "refresh"])
    expect(disabled).toEqual(["other", "custom"])
  })

  test("removes all current credentials in the selected location", async () => {
    const removed: Array<{ credentialID: string; location?: { directory?: string } }> = []

    await disconnectProviderConnection({
      providerID: "openrouter",
      protocol: "v2",
      legacy: {
        auth: { remove: async () => undefined },
        instance: { dispose: async () => undefined },
      },
      current: {
        integration: {
          get: async () => ({
            data: {
              connections: [
                { type: "credential" as const, id: "first", label: "First" },
                { type: "env" as const, name: "OPENROUTER_API_KEY" },
                { type: "credential" as const, id: "second", label: "Second" },
              ],
            },
          }),
        },
        credential: {
          remove: async (input) => void removed.push(input),
        },
      },
      directory: "D:/Coding/OpenCode",
      disable: false,
      disabledProviders: [],
      updateConfig: async () => undefined,
      refresh: async () => undefined,
      connected: () => false,
      failureMessage: "still connected",
    })

    expect(removed).toEqual([
      { credentialID: "first", location: { directory: "D:/Coding/OpenCode" } },
      { credentialID: "second", location: { directory: "D:/Coding/OpenCode" } },
    ])
  })

  test("does not claim that an environment-only current provider was disconnected", async () => {
    expect(
      disconnectProviderConnection({
        providerID: "openrouter",
        protocol: "v2",
        legacy: {
          auth: { remove: async () => undefined },
          instance: { dispose: async () => undefined },
        },
        current: {
          integration: {
            get: async () => ({
              data: { connections: [{ type: "env" as const, name: "OPENROUTER_API_KEY" }] },
            }),
          },
          credential: { remove: async () => undefined },
        },
        disable: false,
        disabledProviders: [],
        updateConfig: async () => undefined,
        refresh: async () => undefined,
        connected: () => true,
        failureMessage: "cannot disconnect",
      }),
    ).rejects.toThrow("cannot disconnect")
  })
})
