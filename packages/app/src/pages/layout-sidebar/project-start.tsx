import { ProjectStartDialog } from "./project-start-dialog"
import {
  createHomeController,
  errorMessage,
  normalizeSessionInfo,
  showToast,
  useDialog,
  useDirectoryPicker,
  useLanguage,
  useLayout,
  useServer,
  useServerSDK,
  useServerSync,
  useSettingsDialog,
  useTabs,
} from "./upstream"

/**
 * Opening a project and starting its first session.
 *
 * This lives outside `Sidebar` because the shell only mounts that component while the sidebar is
 * open. A command registered inside it would deregister on close, which leaves the matching app
 * menu entry permanently disabled — the shell registers `project.add` instead and calls in here.
 */
export function createProjectStartController(input: { home: ReturnType<typeof createHomeController> }) {
  const dialog = useDialog()
  const language = useLanguage()
  const layout = useLayout()
  const pickDirectory = useDirectoryPicker()
  const server = useServer()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  const showServers = useSettingsDialog("servers")
  const tabs = useTabs()

  const createProjectSession = async (directory: string) => {
    layout.projects.open(directory)
    const created = await serverSDK()
      .api.session.create({ location: { directory } })
      .then(normalizeSessionInfo)
      .catch((error) => {
        showToast({
          title: language.t("prompt.toast.sessionCreateFailed.title"),
          description: errorMessage(error, language.t("common.requestFailed")),
        })
        return undefined
      })
    if (!created) return

    serverSync().session.remember(created)
    // Fetch sessions lazily (no bootstrap:true) so the new tab can render
    // immediately instead of waiting for a full provider/path/agent bootstrap.
    serverSync().child(directory)[1]("session", (sessions) =>
      sessions.some((session) => session.id === created.id) ? sessions : [...sessions, created],
    )
    const tab = tabs.addSessionTab({ server: server.key, sessionId: created.id })
    tabs.select(tab)
  }

  const chooseProjectFolder = () => {
    const conn = server.current
    if (!conn) return
    dialog.close()
    queueMicrotask(() =>
      pickDirectory({
        server: conn,
        title: language.t("sidebarLayout.addProject"),
        multiple: false,
        onSelect: (result) => {
          if (!result) return
          const directory = Array.isArray(result) ? result[0] : result
          if (!directory) return
          // Kick off project registration without blocking: register first,
          // then create the session; do not chain via .then(...) which defers
          // the session creation until file.list/initGit completes.
          void Promise.resolve(input.home.project.add(conn, [directory])).then(() => createProjectSession(directory))
        },
      }),
    )
  }

  const addProject = () => {
    // The sidebar is where projects live, so surfacing one implies showing it.
    layout.sidebar.open()
    void dialog.show(() => (
      <ProjectStartDialog
        recent={layout.projects.recentlyClosed()}
        onChooseFolder={chooseProjectFolder}
        onReopen={(project) => {
          dialog.close()
          void createProjectSession(project.worktree)
        }}
        onManageServers={() => {
          dialog.close()
          queueMicrotask(showServers)
        }}
      />
    ))
  }

  return { addProject, createProjectSession, chooseProjectFolder }
}
