# Product domain and adapter contract

Status: accepted for AP-09 implementation

Updated: 14 August 2026

## Contract classification

- Contract type: new product object, new persistence model, new API boundary, and reuse of the existing OpenCode execution engine.
- Same object type as an OpenCode session: no.
- Own contract required: yes, for data, lifecycle, persistence, adapter API, error semantics, and UI-visible completion.

## Boundary

The canonical hierarchy is:

```text
OpenCode Project -> Product Task -> Product Run -> OpenCode Session
```

- The existing OpenCode project remains the canonical repository/workspace identity.
- A product task is a durable, user-visible work item within one project.
- A product run records one execution attempt for a task and owns exactly one root OpenCode session after execution starts.
- Child OpenCode sessions remain children of that root session. They are not separate product runs.
- Session todos, follow-ups, plan files, titles, and message metadata are execution details and must not become the canonical product task record.

## Identifiers and references

- `ProductTaskID`: opaque, stable, globally unique, product-owned identifier.
- `ProductRunID`: opaque, stable, globally unique, product-owned identifier.
- `projectID`: required foreign key to the existing OpenCode project.
- `sessionID`: nullable on a queued run and required once a run starts; foreign key to the root OpenCode session.
- IDs are never derived from titles, paths, timestamps, or array positions.
- Existing project/session IDs are stored as references and are never rewritten for product naming.

## Product task record

Canonical mutable fields:

- `id`
- `projectID`
- `title`
- `description` as user intent, not as an execution transcript
- `status`: `ready | active | waiting | review | completed | cancelled`
- `position`: stable ordering value within the project
- `version`: monotonically increasing optimistic-concurrency value
- `activeRunID`: nullable reference to the current non-terminal run
- `createdAt`, `updatedAt`
- `completedAt`, `cancelledAt`, `archivedAt`: nullable lifecycle timestamps

Derived fields such as latest model, token totals, cost, changed file count, permission count, and last activity are query projections from runs/sessions. They are not independently editable task truth.

Task invariants:

- A task belongs to exactly one project.
- At most one non-terminal run exists for a task.
- `activeRunID`, when set, points to that task's non-terminal run.
- A task in `active` or `waiting` has an `activeRunID`; a task in `ready`, `review`, `completed`, or `cancelled` does not.
- `completed` means the task result was explicitly accepted or completed through a defined product action. An idle model session alone does not complete the task.
- A completed or cancelled task can be reopened to `ready`; reopening does not mutate historical runs.
- Archive is orthogonal to task status and only hides the task from normal lists.
- Hard deletion is not a normal UI action. Initial product behavior is archive; later permanent deletion requires an explicit cascade contract.

## Product run record

Canonical fields:

- `id`
- `taskID`
- `sequence`: monotonically increasing within the task
- `sessionID`: nullable until the OpenCode session is created
- `status`: `queued | running | waiting_permission | waiting_input | succeeded | failed | cancelled | interrupted`
- `trigger`: `new | continue | retry | reopen`
- `startedAt`, `finishedAt`
- `failureCode`, `failureMessage`: nullable, sanitized product error data
- `completionSummary`: nullable immutable snapshot written when a terminal result is recorded

Run invariants:

- A run belongs to exactly one task and therefore one project.
- A root OpenCode session belongs to at most one product run.
- `sequence` is unique together with `taskID`; a non-null `sessionID` is globally unique across product runs.
- A terminal run is immutable except for additive diagnostic references that do not alter its outcome.
- `succeeded` means the execution reached an explicit product completion boundary; session `idle` only means no work is currently executing.
- `interrupted` covers application/process termination or lost execution state where success or failure cannot be proven.
- Retry creates a new run; it never resets or overwrites the failed run.

## State transitions

Task transitions:

```text
ready -> active
active -> waiting | review | ready | cancelled
waiting -> active | review | ready | cancelled
review -> active | completed | ready | cancelled
completed -> ready
cancelled -> ready
```

Run transitions:

```text
queued -> running | cancelled
running -> waiting_permission | waiting_input | succeeded | failed | cancelled | interrupted
waiting_permission -> running | failed | cancelled | interrupted
waiting_input -> running | succeeded | failed | cancelled | interrupted
```

Invalid transitions are rejected by the product service. The renderer may hide invalid actions for convenience but is not the enforcement boundary.

Engine-to-product projection:

- creating a run moves the task to `active`;
- an unresolved permission request moves run/task to `waiting_permission`/`waiting`;
- an unresolved product question moves run/task to `waiting_input`/`waiting`;
- resuming execution moves run/task back to `running`/`active`;
- explicit successful execution completion moves run/task to `succeeded`/`review`;
- failure, cancellation, or interruption clears `activeRunID` and returns a non-cancelled task to `ready` while retaining the terminal run outcome;
- user acceptance moves a task from `review` to `completed`.

## Completion and review contract

An execution result exposed for review contains:

- root session reference and child-session references;
- final assistant summary;
- changed files and diff summary from the existing snapshot/diff facilities;
- outstanding permission or question requests;
- tests/checks reported by tools, clearly separated from checks merely suggested;
- token and cost telemetry available from the session;
- terminal run status and sanitized failure information.

The product must not claim a successful build, test, save, runtime launch, or external action unless corresponding execution evidence exists. User acceptance marks the task `completed`; requesting changes creates or resumes work through a new run without deleting prior evidence.

## Product adapter

New product UI consumes one stable adapter surface. Initial ports are intentionally small.

Queries:

- `listProjects()`
- `listTasks(projectID, filter, cursor)`
- `getTask(taskID)`
- `listRuns(taskID)`
- `getRunWorkspace(runID)`
- `getTaskReview(taskID)`

Commands:

- `createTask(projectID, title, description)`
- `updateTask(taskID, expectedVersion, patch)` for title, description, and ordering only; lifecycle changes use dedicated commands
- `archiveTask(taskID, expectedVersion)` and `restoreTask(...)`
- `startRun(taskID, expectedVersion, executionOptions)`
- `continueRun(runID, input)`
- `cancelRun(runID)`
- `answerPermission(runID, requestID, decision)`
- `answerQuestion(runID, requestID, answer)`
- `submitForReview(runID)`
- `acceptTask(taskID, expectedVersion)`
- `reopenTask(taskID, expectedVersion)`

Events:

- task created, updated, archived, and status changed;
- run created, linked to session, status changed, and completed;
- workspace message/event appended;
- permission requested/resolved;
- question requested/resolved;
- review projection changed.

Adapter rules:

- UI DTOs use product IDs and product statuses. Raw SDK objects may appear only inside an explicitly engine-owned workspace payload.
- The adapter translates OpenCode session status, events, errors, permissions, messages, diffs, and usage into product projections.
- Commands that mutate task lifecycle use optimistic concurrency through `expectedVersion`.
- Event delivery can be repeated. Consumers deduplicate by stable event identity and always recover from a fresh query after reconnect.
- A renderer restart reconstructs state from persisted product records and OpenCode session state; in-memory stream state is never the only source of truth.

## Validation and normalization

- Titles are trimmed, must contain visible text, and have a bounded stored length.
- Descriptions preserve user text; whitespace and line endings may be normalized without changing meaning.
- Project, task, run, session, permission, and question identifiers are treated as opaque values and validated by their owning schema.
- A run cannot be started for an unknown, archived, or concurrently active task.
- A referenced OpenCode project/session must exist and belong to the expected hierarchy.
- Paths stay under the existing OpenCode project/workspace contract; the product model does not introduce a second path authority.

Exact field length limits and pagination defaults are implementation constants and must be exposed consistently by schema and API rather than duplicated in the renderer.

## Error semantics

Errors are typed at the adapter boundary and remain distinguishable in the UI:

- `validation`: malformed input or invalid state transition;
- `not_found`: project, task, run, session, or request does not exist;
- `conflict`: stale version or another active run;
- `persistence`: product data could not be read or written;
- `engine_unavailable`: local OpenCode service is unavailable;
- `engine_protocol`: unexpected SDK/event payload or incompatible engine behavior;
- `permission_required`: execution is intentionally waiting for a decision;
- `provider_auth`: configured provider credential is missing or rejected;
- `provider_permission`: credential lacks required provider rights;
- `provider_unavailable`: provider cannot currently serve the request;
- `execution_failed`: tool, model, or execution failed after starting;
- `cancelled` and `interrupted`: explicit cancellation versus unproven termination.

Internal service failures must not be presented as invalid OpenRouter credentials. Sanitized user messages and diagnostic details are separate fields.

## Persistence and migration rules

- Product tables live beside the existing core database schema so task/run writes can participate in the same local persistence boundary.
- Tables and services use product-specific names and references; do not add product columns to upstream `session` or encode product state in `session.metadata`.
- Project and session references use restrictive deletion. Existing delete paths must report a conflict while product tasks/runs still reference the target; they must not silently cascade product history.
- Schema changes use the repository's generated Drizzle schema and ordered migration mechanism.
- Existing installations begin with no product tasks. Existing sessions remain accessible through the legacy/history route until an explicit, user-controlled adoption flow is designed.
- No heuristic automatically turns every historical session into a product task.
- Product records never cascade-delete an OpenCode project or session. Project/session deletion behavior must check product references and use an explicit future policy.

## Inherited assumptions

- Existing project identity and directory handling: valid and retained.
- Existing session/message/event execution engine: valid and retained behind the adapter.
- Session todos as project tasks: invalid.
- Session `idle` as product completion: invalid.
- Existing diff, revert, terminal, permission, and question mechanics: valid as engine capabilities; incomplete as product lifecycle evidence until projected by the adapter.
- Direct SDK/store use throughout new screens: invalid.
- Graphical project, account, model, and provider interaction: required.

## Review variants

AP-09 implementation and review must cover at least:

- create, edit, order, archive, restore, and reopen a task;
- first run, continuation, retry after failure, and cancellation;
- permission wait and user-input wait across renderer restart;
- process interruption and recovery without a false success;
- multiple runs with preserved historical evidence;
- child sessions remaining attached to the owning root run;
- legacy sessions remaining available without automatic task conversion;
- concurrent update conflict and duplicate/replayed event handling.

## Decision for implementation

AP-09 may implement the product-owned schema, service, API, and adapter skeleton after this contract is reviewed. AP-12 through AP-14 must consume that adapter instead of creating parallel task state in renderer stores.
