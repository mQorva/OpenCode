import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import "./message-rail.css"

export type MessageRailItem = {
  id: string
  /** First line of the prompt — the tooltip's headline. */
  title: string
  /** Everything after the first line, joined into one paragraph. */
  body?: string
}

const MARK_SPACING_MAX = 11
/** How far from the pointer a mark still grows, in pixels. */
const REACH = 56
const WIDTH_BASE = 9
const WIDTH_BOOST = 11

/**
 * Slim rail along the left edge of the timeline: one mark per user message, evenly spaced so the
 * conversation reads as a fixed set of stops rather than a scaled-down map. Marks near the pointer
 * grow, which makes a dense rail aimable; the one under the pointer previews its prompt.
 */
export function MessageRail(props: {
  items: MessageRailItem[]
  activeID?: string
  label: string
  /** Space to keep clear at the top, e.g. for the sticky session header. */
  insetTop?: string
  onSelect: (id: string) => void
}) {
  const [height, setHeight] = createSignal(0)
  const [pointer, setPointer] = createSignal<number>()
  let track: HTMLElement | undefined

  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect
    if (box) setHeight(box.height)
  })
  onCleanup(() => observer.disconnect())

  const layout = createMemo(() => {
    const count = props.items.length
    const available = height()
    if (count === 0 || available === 0) return { spacing: 0, top: 0 }
    const spacing = Math.min(MARK_SPACING_MAX, available / count)
    return { spacing, top: (available - spacing * count) / 2 }
  })

  const offsetOf = (index: number) => layout().top + layout().spacing * (index + 0.5)

  const widthOf = (index: number) => {
    const y = pointer()
    if (y === undefined) return WIDTH_BASE
    const distance = Math.abs(offsetOf(index) - y)
    if (distance >= REACH) return WIDTH_BASE
    // Cosine falloff: the growth tapers off instead of ending in a hard edge.
    const falloff = (Math.cos((distance / REACH) * Math.PI) + 1) / 2
    return WIDTH_BASE + WIDTH_BOOST * falloff
  }

  const hovered = createMemo(() => {
    const y = pointer()
    if (y === undefined || props.items.length === 0) return
    let best = 0
    let bestDistance = Infinity
    props.items.forEach((_, index) => {
      const distance = Math.abs(offsetOf(index) - y)
      if (distance >= bestDistance) return
      bestDistance = distance
      best = index
    })
    if (bestDistance > layout().spacing) return
    return best
  })

  const tipTop = () => {
    const index = hovered()
    if (index === undefined) return 0
    return Math.min(Math.max(offsetOf(index), 8), Math.max(8, height() - 8))
  }

  return (
    <Show when={props.items.length > 1}>
      <div data-slot="session-message-rail" style={{ "--rail-inset-top": props.insetTop }}>
        <nav
          aria-label={props.label}
          ref={(el) => {
            track = el
            observer.observe(el)
          }}
          onPointerMove={(event) => {
            if (!track) return
            setPointer(event.clientY - track.getBoundingClientRect().top)
          }}
          onPointerLeave={() => setPointer(undefined)}
        >
          <For each={props.items}>
            {(item, index) => (
              <button
                type="button"
                data-slot="session-message-rail-mark"
                data-active={props.activeID === item.id ? "true" : undefined}
                data-near={hovered() === index() ? "true" : undefined}
                style={{
                  top: `${offsetOf(index())}px`,
                  "--mark-width": `${widthOf(index()).toFixed(2)}px`,
                  // Hit area follows the spacing so neighbouring marks never overlap.
                  "--mark-hit": `${Math.max(3, layout().spacing).toFixed(2)}px`,
                }}
                aria-label={item.title}
                aria-current={props.activeID === item.id ? "true" : undefined}
                onFocus={() => setPointer(offsetOf(index()))}
                onBlur={() => setPointer(undefined)}
                onClick={() => props.onSelect(item.id)}
              />
            )}
          </For>
          <Show when={hovered() !== undefined && props.items[hovered()!]}>
            {(item) => (
              <div data-slot="session-message-rail-tip" style={{ top: `${tipTop()}px` }}>
                <span data-slot="session-message-rail-tip-title">{item().title}</span>
                <Show when={item().body}>
                  <span data-slot="session-message-rail-tip-body">{item().body}</span>
                </Show>
              </div>
            )}
          </Show>
        </nav>
      </div>
    </Show>
  )
}
