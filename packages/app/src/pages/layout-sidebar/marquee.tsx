import { createSignal, onCleanup, onMount, type JSX } from "solid-js"
import "./marquee.css"

/**
 * Single-line text for sidebar rows: soft fade instead of ellipsis when truncated,
 * and while the row is hovered/focused it drifts sideways so hidden parts of long
 * titles stay readable underneath the action icons.
 */
export function SidebarMarquee(props: { class?: string; children?: JSX.Element }) {
  let outer: HTMLSpanElement | undefined
  let inner: HTMLSpanElement | undefined
  const [shift, setShift] = createSignal(0)

  const measure = () => {
    if (!outer || !inner) return
    const distance = Math.max(0, Math.ceil(inner.scrollWidth - outer.clientWidth))
    const rtl = getComputedStyle(outer).direction === "rtl"
    setShift(distance === 0 ? 0 : rtl ? distance : -distance)
  }

  onMount(() => {
    const observer = new ResizeObserver(measure)
    if (outer && inner) {
      observer.observe(outer)
      observer.observe(inner)
    }
    onCleanup(() => observer.disconnect())
  })

  return (
    <span
      ref={outer}
      data-marquee=""
      data-truncated={shift() !== 0 ? "" : undefined}
      style={{
        "--marquee-shift": `${shift()}px`,
        "--marquee-duration": `${Math.min(8, Math.max(1.1, Math.abs(shift()) / 55))}s`,
      }}
    >
      <span ref={inner} class={props.class}>
        {props.children}
      </span>
    </span>
  )
}
