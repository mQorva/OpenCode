import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { For, Show, createResource, createSignal } from "solid-js"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"

export function DialogSavedProjectPermissions(props: { projectID: string }) {
  const dialog = useDialog()
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const [removing, setRemoving] = createSignal<string>()
  const [permissions, { refetch }] = createResource(
    () => props.projectID,
    (projectID) => serverSDK().client.v2.permission.saved.list({ projectID }).then((result) => result.data?.data ?? []),
  )

  const remove = (id: string) => {
    if (removing()) return
    setRemoving(id)
    serverSDK()
      .client.v2.permission.saved.remove({ id })
      .then(() => refetch())
      .catch((error: unknown) => {
        showToast({
          title: language.t("common.requestFailed"),
          description: error instanceof Error ? error.message : String(error),
        })
      })
      .finally(() => setRemoving(undefined))
  }

  return (
    <Dialog fit>
      <DialogHeader>
        <DialogTitle>{language.t("settings.permissions.saved.title")}</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex max-h-96 min-h-32 w-full min-w-0 flex-col overflow-y-auto px-4 py-3">
        <Show when={!permissions.loading} fallback={<div class="text-13-regular text-v2-text-text-muted">…</div>}>
          <Show
            when={permissions()?.length}
            fallback={
              <div class="text-13-regular text-v2-text-text-muted">
                {language.t("settings.permissions.saved.empty")}
              </div>
            }
          >
            <div class="flex min-w-0 flex-col gap-2">
              <For each={permissions()}>
                {(permission) => (
                  <div class="flex min-w-0 items-center gap-3 rounded-md bg-v2-background-bg-layer-02 px-3 py-2">
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span class="text-12-medium text-v2-text-text-base">{permission.action}</span>
                      <TooltipV2 class="min-w-0" contentClass="break-all" value={permission.resource} placement="top">
                        <code class="block truncate text-12-regular text-v2-text-text-muted">
                          {permission.resource}
                        </code>
                      </TooltipV2>
                    </div>
                    <ButtonV2
                      size="small"
                      variant="danger"
                      disabled={!!removing()}
                      onClick={() => remove(permission.id)}
                    >
                      {language.t("settings.permissions.saved.remove")}
                    </ButtonV2>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </DialogBody>
      <DividerV2 />
      <DialogFooter>
        <ButtonV2 variant="neutral" onClick={() => dialog.close()}>
          {language.t("settings.permissions.saved.close")}
        </ButtonV2>
      </DialogFooter>
    </Dialog>
  )
}
