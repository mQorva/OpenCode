### Description

`isSessionNotFoundError` / `isLocalSessionNotFoundError` in the app only recognise the exact V1 tagged shape (`_tag === "SessionNotFoundError"` with matching `sessionID`) and the exact local `Error.message`. When the server returns session-deletion errors through other wrappers — a plain string body, an object with `name: "NotFoundError"` and `data.message`, or any serialised object whose `message` contains the not-found text — the detector misses it, so UI code that should treat the session as gone (hide the entry, stop retrying, drop references) instead keeps it or shows a generic failure.

### Plugins

N/A

### OpenCode version

dev (current upstream/dev)

### Steps to reproduce

1. Open a session, then delete it on the server (or let a worker remove it).
2. Trigger a request against the deleted session (rename, load, switch).
3. The error arrives shaped as a string `"Session not found: <id>"` or as a `NotFoundError` object. `isSessionNotFoundError` returns `false`, so the app does not route to the "session gone" handling and surfaces a generic error.

### Screenshot and/or share link

N/A

### Operating System

Windows 11 (platform-independent)

### Terminal

N/A (app UI / desktop)

### Related / duplicate check

- No open issue matches this specific error-shape detection gap; verified by search.