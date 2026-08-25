import type { NormalizedProviderListResponse } from "@opencode-ai/session-ui/context"

const emptyProviderCatalog: NormalizedProviderListResponse = { all: new Map(), connected: [], default: {} }

type DirectoryCatalog = {
  ready: boolean
  providers: NormalizedProviderListResponse
}

type ProviderCatalogInput =
  | {
      explicit: true
      directory?: string
      catalog?: DirectoryCatalog
      global?: NormalizedProviderListResponse
    }
  | {
      explicit: false
      directory?: string
      catalog?: DirectoryCatalog
      global: NormalizedProviderListResponse
    }

export function selectProviderCatalog(input: ProviderCatalogInput) {
  if (input.directory && input.catalog?.ready) return input.catalog.providers
  // Fall back to the global catalog so a fresh directory without a completed
  // bootstrap does not render the model selector permanently in a "loading"
  // state.
  if (input.explicit) return "global" in input ? (input.global ?? emptyProviderCatalog) : emptyProviderCatalog
  return input.global
}

export function resolveDefaultModel(
  current: NormalizedProviderListResponse["defaultModel"],
  legacy: string | undefined,
) {
  if (current !== undefined) return current ?? undefined
  if (!legacy) return undefined
  const [providerID, modelID] = legacy.split("/")
  return { providerID, modelID }
}
