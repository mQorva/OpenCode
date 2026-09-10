import { createStore, reconcile } from "solid-js/store"
import {
  type Accessor,
  batch,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  onMount,
} from "solid-js"
import { makeEventListener } from "@solid-primitives/event-listener"
import { useNavigate, useParams, useSearchParams } from "@solidjs/router"
import { createSimpleContext } from "@opencode-ai/ui/context"
import type { ServerSDK } from "./server-sdk"
import type { ServerSync } from "./server-sync"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { usePermission } from "@/context/permission"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { decode64 } from "@/utils/base64"
import { EventSessionError } from "@opencode-ai/sdk/v2"
import { Persist, persisted } from "@/utils/persist"
import { playSoundById } from "@/utils/sound"
import { useGlobal } from "./global"
import { ServerConnection, useServer } from "./server"
import { type DraftTab, useTabs } from "./tabs"
import { requireServerKey } from "@/utils/session-route"
import type { ServerScope } from "@/utils/server-scope"
import { isSessionNotFoundError } from "@/utils/server-errors"

type NotificationBase = {
  directory?: string
  session?: string
  metadata?: unknown
  time: number
  viewed: boolean
}

type TurnCompleteNotification = NotificationBase & {
  type: "turn-complete"
}

type ErrorNotification = NotificationBase & {
  type: "error"
  error: EventSessionError["properties"]["error"]
}

export type Notification = TurnCompleteNotification | ErrorNotification

type NotificationIndex = {
  session: {
    all: Record<string, Notification[]>
    unseen: Record<string, Notification[]>
    unseenCount: Record<string, number>
    unseenHasError: Record<string, boolean>
  }
  project: {
    all: Record<string, Notification[]>
    unseen: Record<string, Notification[]>
    unseenCount: Record<string, number>
    unseenHasError: Record<string, boolean>
  }
}

const MAX_NOTIFICATIONS = 500
const NOTIFICATION_TTL_MS = 1000 * 60 * 60 * 24 * 30

function pruneNotifications(list: Notification[]) {
  const cutoff = Date.now() - NOTIFICATION_TTL_MS
  const pruned = list.filter((n) => n.time >= cutoff)
  if (pruned.length <= MAX_NOTIFICATIONS) return pruned
  return pruned.slice(pruned.length - MAX_NOTIFICATIONS)
}

function createNotificationIndex(): NotificationIndex {
  return {
    session: {
      all: {},
      unseen: {},
      unseenCount: {},
      unseenHasError: {},
    },
    project: {
      all: {},
      unseen: {},
      unseenCount: {},
      unseenHasError: {},
    },
  }
}

function buildNotificationIndex(list: Notification[]) {
  const index = createNotificationIndex()

  list.forEach((notification) => {
    if (notification.session) {
      const all = index.session.all[notification.session] ?? []
      index.session.all[notification.session] = [...all, notification]
      if (!notification.viewed) {
        const unseen = index.session.unseen[notification.session] ?? []
        index.session.unseen[notification.session] = [...unseen, notification]
        index.session.unseenCount[notification.session] = unseen.length + 1
        if (notification.type === "error") index.session.unseenHasError[notification.session] = true
      }
    }

    if (notification.directory) {
      const all = index.project.all[notification.directory] ?? []
      index.project.all[notification.directory] = [...all, notification]
      if (!notification.viewed) {
        const unseen = index.project.unseen[notification.directory] ?? []
        index.project.unseen[notification.directory] = [...unseen, notification]
        index.project.unseenCount[notification.directory] = unseen.length + 1
        if (notification.type === "error") index.project.unseenHasError[notification.directory] = true
      }
    }
  })

  return index
}

export const { use: useNotification, provider: NotificationProvider } = createSimpleContext({
  name: "Notification",
  gate: false,
  init: () => {
    const params = useParams<{ serverKey?: string; dir?: string; id?: string }>()
    const [search] = useSearchParams<{ draftId?: string }>()
    const global = useGlobal()
    const server = useServer()
    const tabs = useTabs()
    const navigate = useNavigate()
    const platform = usePlatform()
    const settings = useSettings()
    const language = useLanguage()
    const permission = usePermission()
    const owner = getOwner()
    const states = new Map<ServerScope, { dispose: () => void; state: NotificationState }>()

    const activeServer = createMemo(() => {
      if (params.serverKey) return requireServerKey(params.serverKey)
      if (search.draftId) {
        const draft = tabs.store.find((tab): tab is DraftTab => tab.type === "draft" && tab.draftID === search.draftId)
        if (draft) return draft.server
      }
      return server.key
    })
    const activeDirectory = createMemo(() => decode64(params.dir))
    const activeSession = createMemo(() => params.id)

    const ensure = (key: ServerConnection.Key) => {
      const conn = global.servers.list().find((item) => ServerConnection.key(item) === key)
      if (!conn) throw new Error(`Notification server not found: ${key}`)
      const ctx = global.ensureServerCtx(conn)
      const existing = states.get(ctx.sdk.scope)
      if (existing) return existing.state
      const root = createRoot(
        (dispose) => ({
          dispose,
          state: createServerNotificationState({
            sdk: ctx.sdk,
            sync: ctx.sync,
            active: () => server.scope(activeServer()) === ctx.sdk.scope,
            directory: activeDirectory,
            sessionID: activeSession,
            platform,
            settings,
            language,
            permission,
            navigate,
          }),
        }),
        owner ?? undefined,
      )
      states.set(ctx.sdk.scope, root)
      return root.state
    }

    createEffect(() => {
      global.servers.list().forEach((conn) => ensure(ServerConnection.key(conn)))
    })

    // Taskbar-/Dock-Badge immer aktuell melden. Die Sichtbarkeits-Schwelle (nur während das
    // Fenster minimiert/verdeckt ist) legt der Main-Prozess fest; hier zählt nur die Zahl.
    // Der Provider läuft in beiden Layouts (Legacy und Sidebar-Shell), anders als ein Shell-Effekt.
    createEffect(() => {
      if (!platform.setTaskbarBadge) return
      let count = 0
      try {
        count = selected().totalUnseen()
      } catch {}
      platform.setTaskbarBadge(count)
    })

    createEffect(() => {
      const scopes = new Set(global.servers.list().map((conn) => server.scope(ServerConnection.key(conn))))
      states.forEach((value, scope) => {
        if (scopes.has(scope)) return
        value.dispose()
        states.delete(scope)
      })
    })

    onCleanup(() => states.forEach((value) => value.dispose()))

    const selected = () => {
      const list = global.servers.list()
      const key = activeServer()
      if (list.some((conn) => ServerConnection.key(conn) === key)) return ensure(key)
      const conn = list.find((conn) => ServerConnection.key(conn) === server.key) ?? list[0]
      if (!conn) throw new Error("Notification server not found")
      return ensure(ServerConnection.key(conn))
    }

    return {
      ready: () => selected().ready(),
      ensureServerState: ensure,
      focused: () => selected().focused(),
      totalUnseen: () => selected().totalUnseen(),
      session: {
        all: (session: string) => selected().session.all(session),
        unseen: (session: string) => selected().session.unseen(session),
        unseenCount: (session: string) => selected().session.unseenCount(session),
        unseenHasError: (session: string) => selected().session.unseenHasError(session),
        markViewed: (session: string) => selected().session.markViewed(session),
      },
      project: {
        all: (directory: string) => selected().project.all(directory),
        unseen: (directory: string) => selected().project.unseen(directory),
        unseenCount: (directory: string) => selected().project.unseenCount(directory),
        unseenHasError: (directory: string) => selected().project.unseenHasError(directory),
        markViewed: (directory: string) => selected().project.markViewed(directory),
      },
    }
  },
})

type NotificationState = ReturnType<typeof createServerNotificationState>

function createServerNotificationState(input: {
  sdk: ServerSDK
  sync: ServerSync
  active: Accessor<boolean>
  directory: Accessor<string | undefined>
  sessionID: Accessor<string | undefined>
  platform: ReturnType<typeof usePlatform>
  settings: ReturnType<typeof useSettings>
  language: ReturnType<typeof useLanguage>
  permission: ReturnType<typeof usePermission>
  navigate: (href: string) => void
}) {
  const serverSDK = () => input.sdk
  const serverSync = () => input.sync
  const platform = input.platform
  const settings = input.settings
  const language = input.language

  const empty: Notification[] = []

  // Ob das Fenster gerade im Vordergrund ist. Eine abgeschlossene Session ist nur dann
  // "gesehen" (und braucht keinen Badge-/Dock-Punkt), wenn der Nutzer sie gerade ansieht —
  // ist das Fenster minimiert oder nicht fokussiert, bleibt der Eintrag ungelesen und das
  // Badge zählt ihn, bis die Session geöffnet wird.
  const [focused, setFocused] = createSignal(typeof document !== "undefined" && document.hasFocus())
  onMount(() => {
    const focus = () => setFocused(true)
    const blur = () => setFocused(false)
    makeEventListener(window, "focus", focus)
    makeEventListener(window, "blur", blur)
  })

  const currentDirectory = input.directory
  const currentSession = input.sessionID

  const [store, setStore, _, ready] = persisted(
    Persist.serverGlobal(serverSDK().scope, "notification", ["notification.v1"]),
    createStore({
      list: [] as Notification[],
    }),
  )
  const [index, setIndex] = createStore<NotificationIndex>(buildNotificationIndex(store.list))

  // Offene Rückfragen (Question/Permission) zählen in den Aufmerksamkeitszähler des
  // Taskbar-/Dock-Badges. Der Zähler wird NICHT über replizierte Events geführt — die
  // verwaisten Einträge hängen sonst dauerhaft fest (z. B. wenn der Server eine Session ohne
  // replied/rejected-Ereignis abbricht). Stattdessen wird er aus den echten Sync-Daten
  // abgeleitet, die der Client ohnehin zuverlässig pflegt (asked fügt ein, replied/rejected
  // und session.deleted entfernen): je Sitzung mit mindestens einer unbeantworteten Anfrage
  // zählt das Badge eins.
  const attentionCount = createMemo(() => {
    const data = input.sync.session.data
    const sessions = new Set<string>()
    for (const [sessionID, list] of Object.entries(data.permission ?? {})) {
      if (list && list.length > 0) sessions.add(sessionID)
    }
    for (const [sessionID, list] of Object.entries(data.question ?? {})) {
      if (list && list.length > 0) sessions.add(sessionID)
    }
    return sessions.size
  })

  const meta = { pruned: false, disposed: false }

  const updateUnseen = (scope: "session" | "project", key: string, unseen: Notification[]) => {
    setIndex(scope, "unseen", key, unseen)
    setIndex(scope, "unseenCount", key, unseen.length)
    setIndex(
      scope,
      "unseenHasError",
      key,
      unseen.some((notification) => notification.type === "error"),
    )
  }

  const appendToIndex = (notification: Notification) => {
    if (notification.session) {
      setIndex("session", "all", notification.session, (all = []) => [...all, notification])
      if (!notification.viewed) {
        setIndex("session", "unseen", notification.session, (unseen = []) => [...unseen, notification])
        setIndex("session", "unseenCount", notification.session, (count = 0) => count + 1)
        if (notification.type === "error") setIndex("session", "unseenHasError", notification.session, true)
      }
    }

    if (notification.directory) {
      setIndex("project", "all", notification.directory, (all = []) => [...all, notification])
      if (!notification.viewed) {
        setIndex("project", "unseen", notification.directory, (unseen = []) => [...unseen, notification])
        setIndex("project", "unseenCount", notification.directory, (count = 0) => count + 1)
        if (notification.type === "error") setIndex("project", "unseenHasError", notification.directory, true)
      }
    }
  }

  const removeFromIndex = (notification: Notification) => {
    if (notification.session) {
      setIndex("session", "all", notification.session, (all = []) => all.filter((n) => n !== notification))
      if (!notification.viewed) {
        const unseen = (index.session.unseen[notification.session] ?? empty).filter((n) => n !== notification)
        updateUnseen("session", notification.session, unseen)
      }
    }

    if (notification.directory) {
      setIndex("project", "all", notification.directory, (all = []) => all.filter((n) => n !== notification))
      if (!notification.viewed) {
        const unseen = (index.project.unseen[notification.directory] ?? empty).filter((n) => n !== notification)
        updateUnseen("project", notification.directory, unseen)
      }
    }
  }

  createEffect(() => {
    if (!ready()) return
    if (meta.pruned) return
    meta.pruned = true
    const list = pruneNotifications(store.list)
    batch(() => {
      setStore("list", list)
      setIndex(reconcile(buildNotificationIndex(list), { merge: false }))
    })
  })

  // Ghost-Einträge beseitigen: Benachrichtigungen für Sessions, die der Server nicht mehr kennt
  // (z. B. gelöscht, während die App offline war — das `session.deleted`-Ereignis ging verloren),
  // ließen sonst eine dauerhafte Ziffer im Badge zurück. Statt die Liste gegen einen Index
  // abzugleichen, fragen wir beim Start gezielt die wenigen ungelesenen Einträge beim Server ab:
  // Existiert die Session nicht mehr, wird sie samt Eintrag entfernt. Protokoll-unabhängig
  // (v1 wie v2) und ohne Annahmen über Query-Caches.
  let reconciling = false
  let reconciled = false
  const reconcileGhosts = () => {
    if (reconciling || reconciled || !ready()) return
    const seen = new Set<string>()
    for (const notification of store.list) {
      if (notification.viewed || !notification.session || notification.session === "global") continue
      seen.add(notification.session)
    }
    const ids = [...seen]
    if (ids.length === 0) {
      reconciled = true
      return
    }
    reconciling = true
    void Promise.allSettled(
      ids.map((sessionID) =>
        input.sdk.api.session
          .get({ sessionID })
          .then(() => undefined as string | undefined)
          .catch((error) => (isSessionNotFoundError(error, sessionID) ? sessionID : undefined)),
      ),
    ).then((results) => {
      if (meta.disposed) return
      reconciling = false
      // Mindestens eine Antwort war "definitiv" (Server erreichbar) → ab jetzt nicht wiederholen.
      // Scheitern alle (Server beim Start noch nicht bereit), bleibt `reconciled` falsch und der
      // Effekt versucht es beim nächsten Listen-Update erneut.
      if (results.some((result) => result.status === "fulfilled")) reconciled = true
      const stale = results.flatMap((result) =>
        result.status === "fulfilled" && result.value ? [result.value] : [],
      )
      if (stale.length === 0) return
      dropSessions(stale)
    })
  }

  createEffect(() => {
    if (!ready()) return
    reconcileGhosts()
  })

  const append = (notification: Notification) => {
    const list = pruneNotifications([...store.list, notification])
    const keep = new Set(list)
    const removed = store.list.filter((n) => !keep.has(n))

    batch(() => {
      if (keep.has(notification)) appendToIndex(notification)
      removed.forEach((n) => removeFromIndex(n))
      setStore("list", list)
    })
  }

  // Gelöschte Sessions dürfen keine ungesehenen Einträge hinterlassen — sonst zählen sie
  // dauerhaft in `totalUnseen` (Badge) und der Punkt bleibt, obwohl nichts mehr existiert.
  // Offene Rückfragen der Session räumen sich über die Sync-Daten selbst (session.deleted
  // entfernt dort permission/question), hier genügt die Benachrichtigungsliste.
  const dropSessions = (sessionIDs: Iterable<string>) => {
    const ids = new Set(sessionIDs)
    if (!ids.size) return
    const affected = store.list.filter((n) => !!n.session && ids.has(n.session))
    if (!affected.length) return
    const directories = [...new Set(affected.flatMap((n) => (n.directory ? [n.directory] : [])))]
    batch(() => {
      setStore("list", store.list.filter((n) => !n.session || !ids.has(n.session)))
      for (const sessionID of ids) {
        setIndex("session", "all", sessionID, (all) => all.filter((n) => !n.session || !ids.has(n.session)))
        updateUnseen("session", sessionID, [])
      }
      for (const directory of directories) {
        setIndex("project", "all", directory, (all) => all.filter((n) => !n.session || !ids.has(n.session)))
        const unseen = (index.project.unseen[directory] ?? empty).filter((n) => !n.session || !ids.has(n.session))
        updateUnseen("project", directory, unseen)
      }
    })
  }

  const lookup = async (directory: string, sessionID?: string) => {
    if (!sessionID) return undefined
    const sync = serverSync().ensureDirSyncContext(directory)
    const session = sync.session.get(sessionID)
    if (session) return session
    return sync.session
      .sync(sessionID)
      .then(() => sync.session.get(sessionID))
      .catch(() => undefined)
  }

  const viewedInCurrentSession = (directory: string, sessionID?: string) => {
    if (!input.active()) return false
    // Nicht fokussiert (minimiert / Fenster im Hintergrund) → nichts wird als gesehen markiert.
    if (!focused()) return false
    const activeDirectory = currentDirectory()
    const activeSession = currentSession()
    if (!activeSession) return false
    if (!sessionID) return false
    if (activeDirectory && directory !== activeDirectory) return false
    return sessionID === activeSession
  }

  const handleSessionIdle = (directory: string, event: { properties: { sessionID?: string } }, time: number) => {
    const sessionID = event.properties.sessionID
    void lookup(directory, sessionID).then((session) => {
      if (meta.disposed) return
      if (!session) return
      if (session.parentID) return

      if (settings.sounds.agentEnabled()) {
        void playSoundById(settings.sounds.agent())
      }

      append({
        directory,
        time,
        viewed: viewedInCurrentSession(directory, sessionID),
        type: "turn-complete",
        session: sessionID,
      })

      const href = `/${base64Encode(directory)}/session/${sessionID}`
      if (settings.notifications.agent()) {
        void platform.notify(language.t("notification.session.responseReady.title"), session.title ?? sessionID, () =>
          input.navigate(href),
        )
      }
    })
  }

  const handleSessionError = (
    directory: string,
    event: { properties: { sessionID?: string; error?: EventSessionError["properties"]["error"] } },
    time: number,
  ) => {
    const sessionID = event.properties.sessionID
    void lookup(directory, sessionID).then((session) => {
      if (meta.disposed) return
      if (session?.parentID) return

      if (settings.sounds.errorsEnabled()) {
        void playSoundById(settings.sounds.errors())
      }

      const error = "error" in event.properties ? event.properties.error : undefined
      append({
        directory,
        time,
        viewed: viewedInCurrentSession(directory, sessionID),
        type: "error",
        session: sessionID ?? "global",
        error,
      })
      const description =
        session?.title ??
        (typeof error === "string" ? error : language.t("notification.session.error.fallbackDescription"))
      const href = sessionID ? `/${base64Encode(directory)}/session/${sessionID}` : `/${base64Encode(directory)}`
      if (settings.notifications.errors()) {
        void platform.notify(language.t("notification.session.error.title"), description, () => input.navigate(href))
      }
    })
  }

  const unsub = serverSDK().event.listen((e) => {
    const event = e.details
    const directory = e.name
    const time = Date.now()

    if (event.type === "session.idle") {
      handleSessionIdle(directory, event, time)
      return
    }
    if (event.type === "session.error") {
      handleSessionError(directory, event, time)
      return
    }

    if (event.type === "session.deleted") {
      const deleted = event.properties.sessionID ?? event.properties.info?.id
      if (deleted) dropSessions([deleted])
      return
    }
  })
  onCleanup(() => {
    meta.disposed = true
    unsub()
  })

  return {
    ready,
    focused,
    // Das Badge zählt, was der Nutzer noch sehen muss: jede fertige, ungelesene Sitzung
    // (je Sitzung einmal, egal wie viele Turns sie produziert hat — die Seitenleiste zeigt
    // denselben Stand als einen Punkt) plus jede offene Rückfrage (permission./question.-Dock).
    totalUnseen() {
      const unreadSessions = Object.values(index.session.unseenCount).filter((count) => count > 0).length
      return unreadSessions + attentionCount()
    },
    session: {
      all(session: string) {
        return index.session.all[session] ?? empty
      },
      unseen(session: string) {
        return index.session.unseen[session] ?? empty
      },
      unseenCount(session: string) {
        return index.session.unseenCount[session] ?? 0
      },
      unseenHasError(session: string) {
        return index.session.unseenHasError[session] ?? false
      },
      markViewed(session: string) {
        const unseen = index.session.unseen[session] ?? empty
        if (!unseen.length) return

        const projects = [
          ...new Set(unseen.flatMap((notification) => (notification.directory ? [notification.directory] : []))),
        ]
        batch(() => {
          setStore("list", (n) => n.session === session && !n.viewed, "viewed", true)
          updateUnseen("session", session, [])
          projects.forEach((directory) => {
            const next = (index.project.unseen[directory] ?? empty).filter(
              (notification) => notification.session !== session,
            )
            updateUnseen("project", directory, next)
          })
        })
      },
    },
    project: {
      all(directory: string) {
        return index.project.all[directory] ?? empty
      },
      unseen(directory: string) {
        return index.project.unseen[directory] ?? empty
      },
      unseenCount(directory: string) {
        return index.project.unseenCount[directory] ?? 0
      },
      unseenHasError(directory: string) {
        return index.project.unseenHasError[directory] ?? false
      },
      markViewed(directory: string) {
        const unseen = index.project.unseen[directory] ?? empty
        if (!unseen.length) return

        const sessions = [
          ...new Set(unseen.flatMap((notification) => (notification.session ? [notification.session] : []))),
        ]
        batch(() => {
          setStore("list", (n) => n.directory === directory && !n.viewed, "viewed", true)
          updateUnseen("project", directory, [])
          sessions.forEach((session) => {
            const next = (index.session.unseen[session] ?? empty).filter(
              (notification) => notification.directory !== directory,
            )
            updateUnseen("session", session, next)
          })
        })
      },
    },
  }
}
