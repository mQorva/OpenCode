### Description

While the model is reasoning, the "Thinking…" status line shows the current reasoning topic next to the shimmer. When the topic string is long (e.g. a whole sentence or a path), the heading text overflows the timeline container to the right instead of being clipped. The row is a flex row with one shrinkable heading (`flex: 1 1 auto; min-width: 0`), but the heading itself has no overflow handling, so a `nowrap` heading pushes past the right edge.

### Plugins

N/A

### OpenCode version

dev (current upstream/dev)

### Steps to reproduce

1. Start a session with a reasoning-capable model.
2. Let the model emit a long reasoning topic heading (several words / a path).
3. Observe the row: the heading text runs out past the right side of the timeline thread instead of truncating.

### Screenshot and/or share link

N/A

### Operating System

Windows 11 (independent of platform — also visible on Linux/macOS)

### Terminal

N/A (app UI)

### Related / duplicate check

- No open or closed issue matches this specific overflow; verified by search.