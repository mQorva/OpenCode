import { useQuery } from "@tanstack/solid-query"
import { createMemo } from "solid-js"
import {
  loadHomeSessionIndex,
  type HomeSessionEvents,
  type HomeSessionIndexCache,
  type HomeSessionIndexList,
} from "./home-session-index"

/**
 * The server-wide session index as a reactive list.
 *
 * A child store only ever reports sessions of its own directory, so any view that must show
 * sessions beyond the directories it holds stores for reads them from here instead. Callers key
 * their queries off the same per-server cache, which means a second consumer reuses the first
 * one's data rather than issuing a request of its own.
 *
 * `list` doubles as the readiness signal: while it returns undefined the server is not usable yet
 * and the query stays disabled.
 *
 * Returns the session list plus the initial load state, so a caller can tell an empty server from
 * one whose index has not arrived yet.
 */
export function createSessionIndexQuery(input: {
  cache: () => HomeSessionIndexCache
  list: () => HomeSessionIndexList | undefined
}) {
  const events = useQuery(() => ({
    queryKey: input.cache().eventsKey,
    queryFn: async (): Promise<HomeSessionEvents> => ({ sequence: 0, entries: [] }),
    initialData: { sequence: 0, entries: [] } satisfies HomeSessionEvents,
    enabled: false,
  }))

  const index = useQuery(() => ({
    queryKey: input.cache().indexKey,
    enabled: !!input.list(),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const list = input.list()
      if (!list) return { sessions: [], eventSequence: 0 }
      const cache = input.cache()
      // Read the sequence before the request so events arriving mid-flight are not lost.
      const eventSequence = cache.eventSequence()
      const result = await loadHomeSessionIndex(list, eventSequence, signal)
      cache.complete(eventSequence)
      return result
    },
    retry: false,
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
  }))

  return {
    sessions: createMemo(() => input.cache().sessions(index.data, events.data)),
    loading: () => index.isLoading,
  }
}
