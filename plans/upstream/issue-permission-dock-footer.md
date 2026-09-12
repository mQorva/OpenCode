### Description

Permission dock actions sit in a detached tray and overflow on narrow widths.

The permission dock renders its action buttons in a separate `DockTray` below the shell. On narrow composer widths the buttons wrap awkwardly and the footer is visually detached from the content. There is no opt-in way to keep the actions inside the dock shell where they wrap cleanly.

### Plugins

n/a

### OpenCode version

latest `dev`

### Steps to reproduce

1. Trigger a permission request in the composer.
2. Narrow the composer width.
3. The action footer overflows / wraps awkwardly in the detached tray.

### Screenshot and/or share link

n/a

### Operating System

n/a (all)

### Terminal

n/a
