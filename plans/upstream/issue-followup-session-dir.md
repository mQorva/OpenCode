### Description

V1 follow-up prompts are sent to the wrong workspace directory.

In the V1 protocol the follow-up prompt path (`sendFollowupDraft` in the app) calls `input.api.prompt` without the session's directory. The directory-scoped API client only knows the project directory, so a follow-up prompt for a session that lives in another worktree or directory is routed to the wrong location instead of the session's own directory.

### Plugins

n/a

### OpenCode version

latest `dev`

### Steps to reproduce

1. Open a session whose directory differs from the current project directory (e.g. a worktree session on a `v1` server).
2. Send a follow-up prompt.
3. The prompt is delivered against the project directory rather than the session's directory.

### Screenshot and/or share link

n/a

### Operating System

n/a (all)

### Terminal

n/a
