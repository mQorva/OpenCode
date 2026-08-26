import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import "./workspace-skeleton.css"

/** Widths in percent, alternating sides, so the shape reads as a conversation rather than a list. */
const ROWS = [
  { width: 46, side: "end", lines: 1 },
  { width: 92, side: "start", lines: 3 },
  { width: 64, side: "end", lines: 1 },
  { width: 78, side: "start", lines: 2 },
] as const

/**
 * Stand-in for the session area while it resolves. Without one the workspace is simply blank on
 * startup and on every session switch, which reads as a broken window rather than as loading.
 *
 * Only shows itself after a short delay (see the stylesheet), so a fast load stays invisible.
 */
export function WorkspaceSkeleton(props: { composer?: boolean }) {
  const language = useLanguage()

  return (
    <div data-slot="workspace-skeleton" role="status" aria-label={language.t("common.loading")} aria-busy="true">
      <div class="shrink-0 h-12 w-full flex items-center px-4">
        <div data-slot="workspace-skeleton-block" data-strong="true" class="h-4 w-40" />
      </div>

      <div class="flex-1 min-h-0 w-full overflow-hidden px-3">
        <div class="w-full md:max-w-200 md:mx-auto 2xl:max-w-[1000px] flex flex-col gap-6 pt-6">
          <For each={ROWS}>
            {(row) => (
              <div
                data-slot="workspace-skeleton-row"
                class="flex flex-col gap-2"
                classList={{ "items-end": row.side === "end", "items-start": row.side === "start" }}
                style={{ width: `${row.width}%`, "align-self": row.side === "end" ? "flex-end" : "flex-start" }}
              >
                <For each={Array.from({ length: row.lines })}>
                  {(_, line) => (
                    <div
                      data-slot="workspace-skeleton-block"
                      data-strong={row.side === "end" ? "true" : undefined}
                      class="h-3.5 w-full"
                      // Last line of a paragraph runs short, the way real text does.
                      style={line() === row.lines - 1 && row.lines > 1 ? { width: "62%" } : undefined}
                    />
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>

      <Show when={props.composer !== false}>
        <div class="shrink-0 w-full px-3 pb-3">
          <div class="w-full md:max-w-200 md:mx-auto 2xl:max-w-[1000px]">
            <div data-slot="workspace-skeleton-block" class="h-[92px] w-full rounded-xl" />
          </div>
        </div>
      </Show>
    </div>
  )
}
