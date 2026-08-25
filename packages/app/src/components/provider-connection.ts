type LegacyProviderClient = {
  auth: {
    remove(input: { providerID: string }): Promise<unknown>
  }
  instance: {
    dispose(): Promise<unknown>
  }
}

type CurrentProviderApi = {
  integration: {
    get(input: {
      integrationID: string
      location?: { directory?: string }
    }): Promise<{
      data: {
        connections: ReadonlyArray<
          { type: "credential"; id: string; label: string } | { type: "env"; name: string }
        >
      } | null
    }>
  }
  credential: {
    remove(input: { credentialID: string; location?: { directory?: string } }): Promise<unknown>
  }
}

export async function confirmProviderConnection(input: {
  refresh: () => Promise<void>
  connected: () => boolean
  expected: boolean
  failureMessage: string
}) {
  await input.refresh()
  if (input.connected() !== input.expected) throw new Error(input.failureMessage)
}

export async function connectCustomProvider<Config>(input: {
  providerID: string
  key?: string
  client: {
    auth: {
      set(input: { providerID: string; auth: { type: "api"; key: string } }): Promise<unknown>
    }
    instance: {
      dispose(): Promise<unknown>
    }
  }
  config: Config
  updateConfig: (config: Config) => Promise<unknown>
  refresh: () => Promise<void>
  connected: () => boolean
  failureMessage: string
}) {
  if (input.key) {
    await input.client.auth.set({
      providerID: input.providerID,
      auth: { type: "api", key: input.key },
    })
  }
  await input.updateConfig(input.config)
  await input.client.instance.dispose()
  await confirmProviderConnection({
    refresh: input.refresh,
    connected: input.connected,
    expected: true,
    failureMessage: input.failureMessage,
  })
}

export async function disconnectProviderConnection(input: {
  providerID: string
  protocol: "v1" | "v2"
  legacy: LegacyProviderClient
  current: CurrentProviderApi
  directory?: string
  disable: boolean
  disabledProviders: string[]
  updateConfig: (config: { disabled_providers: string[] }) => Promise<unknown>
  refresh: () => Promise<void>
  connected: () => boolean
  failureMessage: string
}) {
  if (input.protocol === "v1") {
    await input.legacy.auth.remove({ providerID: input.providerID })
    if (input.disable) {
      await input.updateConfig({
        disabled_providers: input.disabledProviders.includes(input.providerID)
          ? input.disabledProviders
          : [...input.disabledProviders, input.providerID],
      })
    }
    await input.legacy.instance.dispose()
  }

  if (input.protocol === "v2") {
    const integration = await input.current.integration.get({
      integrationID: input.providerID,
      location: input.directory ? { directory: input.directory } : undefined,
    })
    const credentials = integration.data?.connections.filter((connection) => connection.type === "credential") ?? []
    if (credentials.length === 0) throw new Error(input.failureMessage)
    await Promise.all(
      credentials.map((connection) =>
        input.current.credential.remove({
          credentialID: connection.id,
          location: input.directory ? { directory: input.directory } : undefined,
        }),
      ),
    )
  }

  await confirmProviderConnection({
    refresh: input.refresh,
    connected: input.connected,
    expected: false,
    failureMessage: input.failureMessage,
  })
}
