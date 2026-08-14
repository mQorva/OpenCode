import type { ProductTaskInfo } from "@opencode-ai/sdk/v2/types"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { createSignal } from "solid-js"
import { useLanguage } from "@/context/language"

export function DialogProductTask(props: {
  task?: ProductTaskInfo
  onSave: (input: { title: string; description: string }) => Promise<boolean>
}) {
  const dialog = useDialog()
  const language = useLanguage()
  const [title, setTitle] = createSignal(props.task?.title ?? "")
  const [description, setDescription] = createSignal(props.task?.description ?? "")
  const [busy, setBusy] = createSignal(false)
  const [invalid, setInvalid] = createSignal(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const nextTitle = title().trim()
    if (!nextTitle) {
      setInvalid(true)
      return
    }
    setBusy(true)
    const saved = await props.onSave({ title: nextTitle, description: description() })
    setBusy(false)
    if (saved) dialog.close()
  }

  return (
    <Dialog fit>
      <form class="contents" onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>
            {props.task ? language.t("home.tasks.edit.title") : language.t("home.tasks.create.title")}
          </DialogTitle>
        </DialogHeader>
        <DividerV2 />
        <DialogBody class="flex w-full flex-col gap-6 px-4 pt-4 pb-2">
          <Field>
            <Field.Label>{language.t("home.tasks.fields.title")}</Field.Label>
            <TextInputV2
              autofocus
              appearance="large"
              class="!w-full"
              value={title()}
              invalid={invalid()}
              placeholder={language.t("home.tasks.fields.title.placeholder")}
              disabled={busy()}
              onInput={(event) => {
                setTitle(event.currentTarget.value)
                setInvalid(false)
              }}
            />
          </Field>
          <Field>
            <Field.Label>{language.t("home.tasks.fields.description")}</Field.Label>
            <TextareaV2
              class="!w-full"
              rows={5}
              value={description()}
              placeholder={language.t("home.tasks.fields.description.placeholder")}
              disabled={busy()}
              onInput={(event) => setDescription(event.currentTarget.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={busy()} onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 type="submit" variant="contrast" disabled={busy()}>
            {busy() ? language.t("common.saving") : language.t("common.save")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
