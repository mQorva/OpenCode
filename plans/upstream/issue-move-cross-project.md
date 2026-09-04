### Feature hasn't been suggested before.
- [x] I have verified this feature I'm about to request hasn't been suggested before.

### Describe the enhancement you want to request

`MoveSession` can already relocate a session, but only inside the project it already belongs to. `move-session.ts` resolves the destination and aborts when the project differs:

```ts
const destination = yield* project.resolve(directory)
if (current.projectID !== destination.id) {
  return yield* new DestinationProjectMismatchError({ expected: current.projectID, actual: destination.id })
}
```

The TUI `/move` dialog matches that limit: it only offers `project.directories({ projectID })` — worktrees and subdirectories of the current project.

So a session that started in the wrong project stays there for good. That happens often enough to be annoying:

- You start typing, then notice you are in the wrong repository.
- You start a chat without a project. After the first prompt it is pinned to the `global` project with `worktree: "/"` and cannot be moved out.
- You work across repositories and the session is factually about another project long before you notice.

The plumbing for a cross-project move looks like it is mostly there. Sessions live in one global database, and the session's directory comes from the session record rather than the route, so relocating the record is what makes the session run in the new place. Message history is untouched by `Moved`, and `/move` already appends a synthetic reminder to the transcript.

What seems missing:

- `SessionEvent.Moved` carries `directory`, `path` and `workspace_id`, but not `project_id`. A cross-project move needs the project to follow, otherwise the session stays listed under the old one.
- Nothing rejects a move while a prompt is running.
- Snapshots are not covered by `MoveSession`. After a cross-project move they point at the old repository, so revert and diff would break — they probably have to be dropped, with the user told about it.
- `moveChanges` (carrying uncommitted work over as a Git patch) makes little sense across repositories and should likely be refused for this case.

Before proposing an implementation I would like to know whether the `projectID` check is a deliberate product decision or just the current scope. If a cross-project move is wanted, is a separate opt-in path (leaving `/move` as the same-project operation) the shape you would accept?
