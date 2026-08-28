import { Progress } from "@opencode-ai/ui/progress"
import { Spinner } from "@opencode-ai/ui/spinner"
import { WordmarkV2 } from "@opencode-ai/ui/v2/wordmark-v2"
import { useLanguage } from "@/context/language"
import "./app-startup-overlay.css"

export function AppStartupOverlay(props: { progress: number }) {
  const language = useLanguage()

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={language.t("startup.loading")}
      data-component="app-startup-overlay"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-v2-background-bg-base"
    >
      <div class="flex w-[min(34rem,72vw)] flex-col items-center gap-12">
        <WordmarkV2 class="h-auto w-full text-v2-background-bg-inverse" />
        <div class="flex w-72 max-w-full flex-col items-center gap-5">
          <Spinner class="size-20 text-v2-icon-icon-base" />
          <div class="flex w-full flex-col items-center gap-3">
            <p class="text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">
              {language.t("startup.loading")}
            </p>
            <Progress value={props.progress} minValue={0} maxValue={100} aria-label={language.t("startup.loading")} />
          </div>
        </div>
      </div>
    </div>
  )
}
