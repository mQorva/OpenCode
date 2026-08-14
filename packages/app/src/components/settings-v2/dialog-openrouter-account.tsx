import type {
  OpenRouterAccountAccount,
  OpenRouterAccountModelCatalog,
  OpenRouterAccountPkceAttempt,
} from "@opencode-ai/sdk/v2/types"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { useServerSDK } from "@/context/server-sdk"
import { showToast } from "@/utils/toast"
import { DialogManageModelsV2 } from "../dialog-manage-models"

type Busy = "key" | "pkce" | "verify" | "models" | "remove" | "cancel"
const MAX_PKCE_POLLS = 800

function message(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message
  return String(error)
}

export function DialogOpenRouterAccount() {
  const language = useLanguage()
  const platform = usePlatform()
  const dialog = useDialog()
  const serverSDK = useServerSDK()
  const [busy, setBusy] = createSignal<Busy>()
  const [key, setKey] = createSignal("")
  const [label, setLabel] = createSignal("")
  const [attempt, setAttempt] = createSignal<OpenRouterAccountPkceAttempt>()
  const [notice, setNotice] = createSignal<string>()
  const [replaceKey, setReplaceKey] = createSignal(false)
  const [modelFilter, setModelFilter] = createSignal("")
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let pollGeneration = 0

  const responseData = async <T,>(request: Promise<{ data?: T; error?: unknown }>) => {
    const result = await request
    if (result.error) throw result.error
    if (result.data === undefined) throw new Error(language.t("settings.openrouter.responseMissing"))
    return result.data
  }

  const pkceStatusText = (status: OpenRouterAccountPkceAttempt["status"]) => {
    if (status === "cancelled") return language.t("settings.openrouter.pkce.cancelled")
    if (status === "expired") return language.t("settings.openrouter.pkce.expired")
    return language.t("settings.openrouter.pkce.failed")
  }

  const accountStateText = (state: OpenRouterAccountAccount["state"]) => {
    if (state === "unconfigured") return language.t("settings.openrouter.state.unconfigured")
    if (state === "verifying") return language.t("settings.openrouter.state.verifying")
    if (state === "connected") return language.t("settings.openrouter.state.connected")
    if (state === "attention") return language.t("settings.openrouter.state.attention")
    return language.t("settings.openrouter.state.disconnected")
  }

  const [account, accountActions] = createResource(async () =>
    responseData<OpenRouterAccountAccount | null>(serverSDK().client.openrouterAccount.get()),
  )
  const [models, modelActions] = createResource(async () =>
    responseData<OpenRouterAccountModelCatalog | null>(serverSDK().client.openrouterAccount.models()),
  )
  const visibleNotice = () => notice() ?? (account.error ? message(account.error) : models.error ? message(models.error) : undefined)
  const filteredModels = createMemo(() => {
    const filter = modelFilter().trim().toLocaleLowerCase()
    return (models()?.models ?? [])
      .filter((model) => !filter || model.name.toLocaleLowerCase().includes(filter) || model.slug.toLocaleLowerCase().includes(filter))
      .slice(0, 100)
  })
  const number = (value: number | undefined) => (value === undefined ? "–" : new Intl.NumberFormat().format(value))
  const date = (value: number | undefined) => (value === undefined ? "–" : new Date(value).toLocaleString())

  const fail = (error: unknown) => {
    const description = message(error)
    setNotice(description)
    showToast({ title: language.t("common.requestFailed"), description })
  }

  const poll = (id: string, generation: number, count = 0) => {
    pollTimer = setTimeout(async () => {
      if (generation !== pollGeneration) return
      try {
        const next = await responseData<OpenRouterAccountPkceAttempt>(
          serverSDK().client.openrouterAccount.getPkce({ attemptID: id }),
        )
        if (generation !== pollGeneration) return
        setAttempt(next)
        if (next.status === "pending") {
          if (Date.now() >= next.expiresAt || count >= MAX_PKCE_POLLS) {
            pollGeneration++
            setAttempt({ ...next, status: "expired", authorizationUrl: undefined })
            setBusy(undefined)
            setNotice(language.t("settings.openrouter.pkce.expired"))
            void serverSDK().client.openrouterAccount.cancelPkce({ attemptID: id }).catch(() => undefined)
            return
          }
          poll(id, generation, count + 1)
          return
        }
        setBusy(undefined)
        if (next.status === "complete") {
          setNotice(undefined)
          showToast({
            variant: "success",
            icon: "circle-check",
            title: language.t("settings.openrouter.connected"),
          })
          const refreshed = await Promise.allSettled([accountActions.refetch(), modelActions.refetch()])
          const rejected = refreshed.find((result) => result.status === "rejected")
          if (rejected?.status === "rejected") setNotice(message(rejected.reason))
          return
        }
        setNotice(next.error?.message ?? pkceStatusText(next.status))
      } catch (error) {
        setBusy(undefined)
        fail(error)
      }
    }, 750)
  }

  const connectKey = async (event: SubmitEvent) => {
    event.preventDefault()
    const value = key().trim()
    if (!value) {
      setNotice(language.t("provider.connect.apiKey.required"))
      return
    }
    setBusy("key")
    setNotice(undefined)
    try {
      const connected = await responseData<OpenRouterAccountAccount>(
        serverSDK().client.openrouterAccount.connect({ key: value, label: label().trim() || account()?.label || undefined }),
      )
      setKey("")
      setReplaceKey(false)
      accountActions.mutate(connected)
      showToast({ variant: "success", icon: "circle-check", title: language.t("settings.openrouter.connected") })
    } catch (error) {
      fail(error)
    } finally {
      setKey("")
      setBusy(undefined)
    }
  }

  const startPkce = async () => {
    setBusy("pkce")
    setNotice(undefined)
    pollGeneration++
    try {
      const next = await responseData<OpenRouterAccountPkceAttempt>(serverSDK().client.openrouterAccount.startPkce())
      setAttempt(next)
      if (!next.authorizationUrl) throw new Error(language.t("settings.openrouter.pkce.failed"))
      platform.openExternal(next.authorizationUrl)
      poll(next.id, pollGeneration)
    } catch (error) {
      setBusy(undefined)
      fail(error)
    }
  }

  const cancelPkce = async () => {
    const current = attempt()
    if (!current || current.status !== "pending") return
    setBusy("cancel")
    pollGeneration++
    if (pollTimer) clearTimeout(pollTimer)
    try {
      const next = await responseData<OpenRouterAccountPkceAttempt>(
        serverSDK().client.openrouterAccount.cancelPkce({ attemptID: current.id }),
      )
      setAttempt(next)
      setNotice(language.t("settings.openrouter.pkce.cancelled"))
    } catch (error) {
      fail(error)
    } finally {
      setBusy(undefined)
    }
  }

  const verify = async () => {
    setBusy("verify")
    setNotice(undefined)
    try {
      const verified = await responseData<OpenRouterAccountAccount>(serverSDK().client.openrouterAccount.verify())
      accountActions.mutate(verified)
      showToast({ variant: "success", icon: "circle-check", title: language.t("settings.openrouter.verified") })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(undefined)
    }
  }

  const refreshModels = async () => {
    setBusy("models")
    setNotice(undefined)
    try {
      const catalog = await responseData<OpenRouterAccountModelCatalog>(serverSDK().client.openrouterAccount.refreshModels())
      modelActions.mutate(catalog)
      showToast({ variant: "success", icon: "circle-check", title: language.t("settings.openrouter.modelsUpdated") })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(undefined)
    }
  }

  const remove = async () => {
    setBusy("remove")
    setNotice(undefined)
    try {
      await serverSDK().client.openrouterAccount.remove({ throwOnError: true })
      setAttempt(undefined)
      accountActions.mutate(null)
      modelActions.mutate(null)
      showToast({ variant: "success", icon: "circle-check", title: language.t("settings.openrouter.disconnected") })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(undefined)
    }
  }

  onCleanup(() => {
    pollGeneration++
    if (pollTimer) clearTimeout(pollTimer)
    const current = attempt()
    if (current?.status === "pending") {
      void serverSDK().client.openrouterAccount.cancelPkce({ attemptID: current.id }).catch(() => undefined)
    }
  })

  return (
    <Dialog fit>
      <DialogHeader>
        <DialogTitle>{language.t("settings.openrouter.title")}</DialogTitle>
      </DialogHeader>
      <DividerV2 />
      <DialogBody class="flex max-h-[min(620px,calc(100vh-140px))] w-full flex-col gap-5 overflow-y-auto px-4 pt-4 pb-2">
        <Show when={account.loading || models.loading}>
          <p class="text-[13px] text-v2-text-text-muted">{language.t("common.loading")}</p>
        </Show>

        <Show when={visibleNotice()}>
          {(value) => (
            <div role="alert" class="rounded-md bg-v2-state-bg-danger px-3 py-2 text-[12px] text-v2-state-fg-danger">
              {value()}
            </div>
          )}
        </Show>

        <Show
          when={account()}
          fallback={
            <div class="flex flex-col gap-5">
              <div class="flex flex-col gap-1">
                <h3 class="text-[13px] font-[530] text-v2-text-text-base">{language.t("settings.openrouter.connect.title")}</h3>
                <p class="text-[12px] text-v2-text-text-muted">{language.t("settings.openrouter.connect.description")}</p>
              </div>
              <div class="flex items-center gap-2">
                <ButtonV2 variant="contrast" disabled={busy() !== undefined} onClick={() => void startPkce()}>
                  {busy() === "pkce" ? language.t("settings.openrouter.pkce.waiting") : language.t("settings.openrouter.pkce.start")}
                </ButtonV2>
                <Show when={attempt()?.status === "pending"}>
                  <ButtonV2 variant="neutral" disabled={busy() === "cancel"} onClick={() => void cancelPkce()}>
                    {language.t("common.cancel")}
                  </ButtonV2>
                </Show>
              </div>
              <DividerV2 />
              <form class="flex flex-col gap-4" onSubmit={connectKey}>
                <Field>
                  <Field.Label>{language.t("settings.openrouter.key")}</Field.Label>
                  <TextInputV2
                    type="password"
                    class="!w-full"
                    value={key()}
                    autocomplete="off"
                    spellcheck={false}
                    onInput={(event) => setKey(event.currentTarget.value)}
                  />
                </Field>
                <Field>
                  <Field.Label>{language.t("settings.openrouter.label")}</Field.Label>
                  <TextInputV2 class="!w-full" value={label()} onInput={(event) => setLabel(event.currentTarget.value)} />
                </Field>
                <ButtonV2 type="submit" variant="neutral" disabled={busy() !== undefined}>
                  {language.t("settings.openrouter.key.connect")}
                </ButtonV2>
              </form>
            </div>
          }
        >
          {(current) => (
            <div class="flex flex-col gap-5">
              <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-[12px]">
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.account")}</span>
                <span class="text-right text-v2-text-text-base">{current().label}</span>
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.status")}</span>
                <span class="text-right text-v2-text-text-base">{accountStateText(current().state)}</span>
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.usage")}</span>
                <span class="text-right text-v2-text-text-base">{number(current().keyMetadata?.usage)}</span>
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.limitRemaining")}</span>
                <span class="text-right text-v2-text-text-base">{number(current().keyMetadata?.limitRemaining)}</span>
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.verifiedAt")}</span>
                <span class="text-right text-v2-text-text-base">{date(current().verifiedAt)}</span>
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.expiresAt")}</span>
                <span class="text-right text-v2-text-text-base">{date(current().keyMetadata?.expiresAt)}</span>
                <span class="text-v2-text-text-muted">{language.t("settings.openrouter.models")}</span>
                <span class="text-right text-v2-text-text-base">{models()?.models.length ?? 0}</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <ButtonV2 variant="neutral" disabled={busy() !== undefined} onClick={() => void verify()}>
                  {language.t("settings.openrouter.verify")}
                </ButtonV2>
                <ButtonV2 variant="neutral" disabled={busy() !== undefined} onClick={() => void refreshModels()}>
                  {language.t("settings.openrouter.models.refresh")}
                </ButtonV2>
                <ButtonV2
                  variant="neutral"
                  disabled={busy() !== undefined}
                  onClick={() => {
                    setLabel(current().label)
                    setReplaceKey(!replaceKey())
                  }}
                >
                  {language.t("settings.openrouter.key.replace")}
                </ButtonV2>
                <ButtonV2 variant="ghost-muted" disabled={busy() !== undefined} onClick={() => void remove()}>
                  {language.t("common.disconnect")}
                </ButtonV2>
              </div>
              <Show when={replaceKey()}>
                <form class="flex flex-col gap-4 rounded-md bg-v2-background-bg-layer-02 p-3" onSubmit={connectKey}>
                  <Field>
                    <Field.Label>{language.t("settings.openrouter.key.new")}</Field.Label>
                    <TextInputV2
                      type="password"
                      class="!w-full"
                      value={key()}
                      autocomplete="off"
                      spellcheck={false}
                      onInput={(event) => setKey(event.currentTarget.value)}
                    />
                  </Field>
                  <ButtonV2 type="submit" variant="contrast" disabled={busy() !== undefined}>
                    {language.t("settings.openrouter.key.replace")}
                  </ButtonV2>
                </form>
              </Show>
              <DividerV2 />
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h3 class="text-[13px] font-[530] text-v2-text-text-base">{language.t("settings.openrouter.catalog.title")}</h3>
                    <p class="text-[11px] text-v2-text-text-muted">{language.t("settings.openrouter.catalog.description")}</p>
                  </div>
                  <ButtonV2
                    variant="neutral"
                    onClick={() => void dialog.push(() => <DialogManageModelsV2 providerID="openrouter" />)}
                  >
                    {language.t("settings.openrouter.models.select")}
                  </ButtonV2>
                </div>
                <Show
                  when={(models()?.models.length ?? 0) > 0}
                  fallback={<p class="text-[12px] text-v2-text-text-muted">{language.t("settings.openrouter.catalog.empty")}</p>}
                >
                  <TextInputV2
                    type="search"
                    class="!w-full"
                    value={modelFilter()}
                    placeholder={language.t("dialog.model.search.placeholder")}
                    aria-label={language.t("dialog.model.search.placeholder")}
                    onInput={(event) => setModelFilter(event.currentTarget.value)}
                  />
                  <div class="flex max-h-64 flex-col overflow-y-auto rounded-md border border-v2-border-border-base">
                    <For each={filteredModels()}>
                      {(model) => (
                        <div class="flex flex-col gap-1 border-b border-v2-border-border-base px-3 py-2 last:border-b-0">
                          <div class="flex items-center justify-between gap-3 text-[12px]">
                            <span class="min-w-0 truncate font-[530] text-v2-text-text-base">{model.name}</span>
                            <span class="shrink-0 text-v2-text-text-muted">{number(model.contextLength)}</span>
                          </div>
                          <div class="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-v2-text-text-muted">
                            <span>{model.slug}</span>
                            <Show when={model.capabilities.tools}><span>{language.t("settings.openrouter.capability.tools")}</span></Show>
                            <Show when={model.capabilities.reasoning}><span>{language.t("settings.openrouter.capability.reasoning")}</span></Show>
                            <Show when={model.capabilities.structuredOutputs}><span>{language.t("settings.openrouter.capability.structured")}</span></Show>
                            <span>{language.t("settings.openrouter.pricing", { prompt: model.pricing.prompt, completion: model.pricing.completion })}</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </DialogBody>
      <DialogFooter>
        <span class="text-[11px] text-v2-text-text-muted">{language.t("settings.openrouter.secretNotice")}</span>
      </DialogFooter>
    </Dialog>
  )
}
