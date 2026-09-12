### Description

Submitting a prompt can silently lose the text the user typed.

The prompt composer keeps its text in two places: the DOM editor element and the store-backed prompt state. When the store is empty but the DOM editor still holds text (for example after a navigation or state reset), `createPromptSubmit` sees `text.trim().length === 0` and returns early without sending anything. The typed message is lost and the user has to retype it.

### Plugins

n/a

### OpenCode version

latest `dev`

### Steps to reproduce

1. Type a message in the composer so the DOM editor contains text but the store-backed prompt state is empty.
2. Press Enter to submit.
3. Nothing is sent and the typed text is discarded.

### Screenshot and/or share link

n/a

### Operating System

n/a (all)

### Terminal

n/a
