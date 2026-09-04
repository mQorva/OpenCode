### Feature hasn't been suggested before.
- [x] I have verified this feature I'm about to request hasn't been suggested before.

### Describe the enhancement you want to request

The TUI has `/move` for relocating a session to another directory of its project (`packages/tui/src/component/prompt/move.tsx`, calling `experimental.controlPlane.moveSession`). The desktop app has no equivalent — nothing in `packages/app` calls `moveSession`.

In the sidebar, dragging a chat onto a project group only works while it is still a draft. Once a prompt has been sent, the drop is ignored on purpose (`packages/app/src/pages/layout-sidebar/sidebar.tsx`):

```ts
// A started session belongs to the directory it runs in, so a project group is not a target
// for it — dropping there does nothing.
```

So the same operation the TUI offers is simply unavailable in the desktop app, and the affordance that looks like it should do it (drag onto a project) silently does nothing.

The endpoint and the whole move mechanism already exist, including the uncommitted-changes prompt and the synthetic reminder message the TUI appends after the move. What is missing is an entry point in the desktop UI — either the existing drag-and-drop target for non-running sessions, or a session menu item that opens a directory picker like the TUI dialog does.

Would you take a PR for this? If so, which entry point do you prefer — the drag target, a menu item, or both?
