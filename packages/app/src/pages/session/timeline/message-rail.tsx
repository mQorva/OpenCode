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
/** Parked far outside the track, which the stylesheet reads as "no pointer". */
const POINTER_AWAY = -9999

/**
 * Slim rail along the left edge of the timeline: one mark per user message, evenly spaced so the
 * conversation reads as a fixed set of stops rather than a scaled-down map. Marks near the pointer
 * grow, which makes a dense rail aimable; the one under the pointer previews its prompt. Dragging
 * along the rail scrubs through the conversation.
 *
 * The growth itself is CSS: the pointer position goes onto the track as one custom property and
 * each mark works out its own distance from there. That keeps a pointer move at a single style
 * write instead of a re-render across every mark, and the marks scale rather than resize, so the
 * rail never lays out mid-gesture.
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
  const [hovered, setHovered] = createSignal<number>()
  const [scrubbing, setScrubbing] = createSignal(false)
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

  /** Coalesce moves to one style write per frame — a pointer can outrun the compositor. */
  let pending: number | undefined
  let frame: number | undefined
  const paint = (y: number) => {
    pending = y
    if (frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      track?.style.setProperty("--rail-pointer", String(pending))
    })
  }
  onCleanup(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  /** Nearest mark, or undefined when the pointer sits between groups. */
  const nearest = (y: number): number | undefined => {
    if (props.items.length === 0) return undefined
    let best = 0
    let bestDistance = Infinity
    props.items.forEach((_, index) => {
      const distance = Math.abs(offsetOf(index) - y)
      if (distance >= bestDistance) return
      bestDistance = distance
      best = index
    })
    if (bestDistance > layout().spacing) return undefined
    return best
  }

  const aim = (y: number) => {
    paint(y)
    setHovered(nearest(y))
  }

  const clear = () => {
    paint(POINTER_AWAY)
    setHovered(undefined)
  }

  const select = (index: number | undefined) => {
    const item = index === undefined ? undefined : props.items[index]
    if (item && item.id !== props.activeID) props.onSelect(item.id)
  }

  const localY = (event: PointerEvent) => {
    if (!track) return 0
    return event.clientY - track.getBoundingClientRect().top
  }

  const tipTop = () => {
    const index = hovered()
    if (index === undefined) return 0
    return Math.min(Math.max(offsetOf(index), 8), Math.max(8, height() - 8))
  }

  return (
    <Show when={props.items.length > 1}>
      <div
        data-slot="session-message-rail"
        data-pointing={hovered() !== undefined ? "true" : undefined}
        data-scrubbing={scrubbing() ? "true" : undefined}
        style={{ "--rail-inset-top": props.insetTop }}
      >
        <nav
          aria-label={props.label}
          ref={(el) => {
            track = el
            observer.observe(el)
          }}
          onPointerMove={(event) => {
            const y = localY(event)
            aim(y)
            if (!scrubbing()) return
            // Scrubbing follows the rail rather than the pointer's own target, so a drag that
            // wanders sideways keeps selecting.
            select(nearest(y))
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            setScrubbing(true)
            event.currentTarget.setPointerCapture(event.pointerId)
            const y = localY(event)
            aim(y)
            // Capturing the pointer routes the rest of the gesture — the click included — to this
            // element, so a mark's own onClick never runs for pointer input. Selecting here is
            // what makes a plain click work at all, and it doubles as the start of a scrub.
            select(nearest(y))
          }}
          onPointerUp={(event) => {
            if (!scrubbing()) return
            setScrubbing(false)
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          onPointerCancel={() => setScrubbing(false)}
          onPointerLeave={() => {
            if (scrubbing()) return
            clear()
          }}
        >
          <For each={props.items}>
            {(item, index) => (
              <button
                type="button"
                data-slot="session-message-rail-mark"
                data-active={props.activeID === item.id ? "true" : undefined}
                data-near={hovered() === index() ? "true" : undefined}
                style={{
                  "--mark-y": offsetOf(index()).toFixed(2),
                  // Hit area follows the spacing so neighbouring marks never overlap.
                  "--mark-hit": `${Math.max(3, layout().spacing).toFixed(2)}px`,
                }}
                aria-label={item.title}
                aria-current={props.activeID === item.id ? "true" : undefined}
                onFocus={() => aim(offsetOf(index()))}
                onBlur={clear}
                // Keyboard activation only — `detail` is 0 for Enter/Space. Pointer clicks are
                // handled on the rail itself, see onPointerDown.
                onClick={(event) => {
                  if (event.detail !== 0) return
                  props.onSelect(item.id)
                }}
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
