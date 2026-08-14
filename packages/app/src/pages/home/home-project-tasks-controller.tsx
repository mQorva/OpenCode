import type { ProductTaskInfo } from "@opencode-ai/sdk/v2/types"
import { createMemo, createResource, createSignal } from "solid-js"
import { useLanguage } from "@/context/language"
import { ServerConnection } from "@/context/server"
import { useTabs } from "@/context/tabs"
import { errorMessage } from "@/pages/layout/helpers"
import { Identifier } from "@/utils/id"
import { showToast } from "@/utils/toast"
import type { HomeController } from "./home-controller"

type TaskPatch = {
  title?: string
  description?: string
}

type TaskTarget = {
  server: ServerConnection.Any
  serverKey: ServerConnection.Key
  projectID: string
  directory: string
}

export function createHomeProjectTasksController(home: HomeController) {
  const language = useLanguage()
  const tabs = useTabs()
  const [includeArchived, setIncludeArchived] = createSignal(false)
  const source = createMemo(() => {
    const server = home.server.focused()
    const project = home.project.selected()
    if (!server || !project?.id) return undefined
    return {
      serverKey: ServerConnection.key(server),
      server,
      projectID: project.id,
      includeArchived: includeArchived(),
    }
  })

  const [tasks, actions] = createResource(source, async (value) => {
    const context = home.server.context(value.server)
    const result = await context.sdk.client.productTask.list({
      projectID: value.projectID,
      includeArchived: value.includeArchived,
    })
    if (result.error) throw result.error
    if (result.data === undefined) throw new Error(language.t("common.requestFailed"))
    return result.data
  })

  const notifyFailure = (cause: unknown) =>
    showToast({
      title: language.t("common.requestFailed"),
      description: errorMessage(cause, language.t("common.requestFailed")),
    })

  const sameTarget = (target: TaskTarget) => {
    const value = source()
    return value?.serverKey === target.serverKey && value.projectID === target.projectID
  }

  const openSession = (target: TaskTarget, sessionID: string) => {
    const context = home.server.context(target.server)
    context.projects.open(target.directory)
    context.projects.touch(target.directory)
    const tab = tabs.addSessionTab({ server: target.serverKey, sessionId: sessionID })
    tabs.select(tab)
  }

  const refetchAfterFailure = async (target: TaskTarget) => {
    if (!sameTarget(target)) return
    try {
      await actions.refetch()
    } catch {
      // The original mutation error remains the user-facing failure.
    }
  }

  const apply = (target: TaskTarget, updated: ProductTaskInfo) => {
    if (!sameTarget(target)) return
    const current = (tasks() ?? []).filter((task) => task.id !== updated.id)
    if (!includeArchived() && updated.archivedAt) {
      actions.mutate(current)
      return
    }
    actions.mutate(
      [...current, updated].sort(
        (a, b) => a.position - b.position || a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      ),
    )
  }

  const mutation = async (
    target: TaskTarget,
    request: () => Promise<{ data?: ProductTaskInfo; error?: unknown }>,
  ) => {
    try {
      const result = await request()
      if (result.error) throw result.error
      if (!result.data) throw new Error(language.t("common.requestFailed"))
      apply(target, result.data)
    } catch (cause) {
      await refetchAfterFailure(target)
      notifyFailure(cause)
      return false
    }
    return true
  }

  const create = async (target: TaskTarget, input: { title: string; description: string }) => {
    const context = home.server.context(target.server)
    return mutation(target, () =>
      context.sdk.client.productTask.create({
        projectID: target.projectID,
        title: input.title,
        description: input.description || undefined,
      }),
    )
  }

  const update = async (target: TaskTarget, task: ProductTaskInfo, patch: TaskPatch) => {
    const context = home.server.context(target.server)
    return mutation(target, () =>
      context.sdk.client.productTask.update({
        taskID: task.id,
        expectedVersion: task.version,
        title: patch.title,
        description: patch.description,
      }),
    )
  }

  const archive = async (target: TaskTarget, task: ProductTaskInfo) => {
    const context = home.server.context(target.server)
    return mutation(target, () =>
      context.sdk.client.productTask.archive({
        taskID: task.id,
        expectedVersion: task.version,
      }),
    )
  }

  const restore = async (target: TaskTarget, task: ProductTaskInfo) => {
    const context = home.server.context(target.server)
    return mutation(target, () =>
      context.sdk.client.productTask.restore({
        taskID: task.id,
        expectedVersion: task.version,
      }),
    )
  }

  const reopen = async (target: TaskTarget, task: ProductTaskInfo) => {
    const context = home.server.context(target.server)
    return mutation(target, () =>
      context.sdk.client.productTask.reopen({
        taskID: task.id,
        expectedVersion: task.version,
      }),
    )
  }

  const target = (): TaskTarget | undefined => {
    const value = source()
    const project = home.project.selected()
    if (!value || !project) return undefined
    return { server: value.server, serverKey: value.serverKey, projectID: value.projectID, directory: project.worktree }
  }

  const openWorkspace = async (target: TaskTarget, task: ProductTaskInfo) => {
    const context = home.server.context(target.server)
    try {
      const runsResult = await context.sdk.client.productTask.listRuns({ taskID: task.id })
      if (runsResult.error) throw runsResult.error
      const runs = runsResult.data ?? []
      const latest = runs.at(-1)
      const existing = task.activeRunID ? runs.find((run) => run.id === task.activeRunID) : latest
      if (task.status !== "ready") {
        if (!existing?.sessionID) throw new Error(language.t("home.tasks.workspaceUnavailable"))
        openSession(target, existing.sessionID)
        return true
      }
      const trigger = !latest ? "new" : latest.status === "succeeded" ? "reopen" : "retry"
      context.projects.open(target.directory)
      context.projects.touch(target.directory)
      await tabs.newDraft(
        {
          server: target.serverKey,
          directory: target.directory,
          productTask: {
            taskID: task.id,
            expectedVersion: task.version,
            trigger,
            sessionID: Identifier.ascending("session"),
            messageID: Identifier.ascending("message"),
          },
        },
        task.description.trim() || task.title,
      )
      return true
    } catch (cause) {
      notifyFailure(cause)
      return false
    }
  }

  return {
    copy: { language },
    project: home.project.selected,
    target,
    data: {
      list: () => tasks() ?? [],
      loading: () => tasks.loading,
      error: () => tasks.error,
      reload: () => actions.refetch(),
      includeArchived,
      toggleArchived: () => setIncludeArchived((value) => !value),
    },
    task: { create, update, archive, restore, reopen, openWorkspace },
  }
}

export type HomeProjectTasksController = ReturnType<typeof createHomeProjectTasksController>
