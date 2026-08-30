import { type ComponentProps, splitProps } from "solid-js"

export interface ComposerCardProps extends ComponentProps<"div"> {
  /**
   * `tray` = the dock sits on top of the composer as a sheet (overlaps the input).
   * `card` = a standalone card above the composer with full radius.
   */
  shape?: "card" | "tray"
}

export function ComposerCard(props: ComposerCardProps) {
  const [split, rest] = splitProps(props, ["shape", "children", "class", "classList"])
  const shape = () => split.shape ?? "card"
  return (
    <div
      {...rest}
      data-component="composer-card"
      data-shape={shape()}
      classList={{
        "w-full overflow-hidden bg-v2-background-bg-layer-02": true,
        "rounded-xl border-[0.5px] border-v2-border-border-base": shape() === "card",
        "rounded-t-xl border-x-[0.5px] border-t-[0.5px] border-v2-border-border-base": shape() === "tray",
        [split.class ?? ""]: !!split.class,
        ...split.classList,
      }}
    >
      {split.children}
    </div>
  )
}
