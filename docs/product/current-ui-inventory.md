# Current OpenCode UI inventory

Updated: 14 August 2026

This inventory is the AP-06 evidence base and the input to the accepted AP-07 renderer decision. It records capabilities and boundaries, not a promise that every source-visible path has already been exercised in the packaged desktop application.

## Desktop shell

The existing Electron shell is a mature baseline. It already owns the local OpenCode sidecar lifecycle, preload and IPC boundary, native file selection, updater integration, Windows and WSL handling, application menus, window state, and distribution packaging. These capabilities stay in place.

## Renderer and navigation

The shared Solid application already provides projects, sessions, chat, settings, dialogs, translations, themes, and reusable design tokens. New and legacy layout paths currently overlap, while parts of the renderer depend directly on OpenCode SDK v2 types, events, and stores. The product will converge on one layout and put a product adapter between new product screens and volatile OpenCode details.

The large legacy layout is migration input, not a destination for additional product concepts. Equivalent behavior must be retained before an old path is removed.

## Project, task, and session state

OpenCode persists projects, sessions, workspaces, messages, parts, permissions, todos, and related execution state in SQLite. This is useful engine state, but it has no durable project-level product task entity.

Existing meanings that must remain distinct:

- Project: an OpenCode workspace/project identity associated with a directory and existing migration history.
- Product task: a durable user-visible work item with lifecycle, ordering, current state, and accepted outcome.
- Run: one OpenCode session executing work for a product task.
- Todo: an execution-local checklist inside a run; it is not the product task.
- Follow-up and plan state: interaction aids; neither is the canonical product task record.

## Integrated coding workspace

The renderer already integrates streamed messages and events, tool calls, permission requests, file context, terminal sessions, diffs, review, revert, and child sessions. AP-13 and AP-14 should reuse these capabilities. Missing product-level concerns are task lifecycle, explicit run ownership, acceptance/completion evidence, and a stable summary of artifacts and changes across runs.

## Providers and accounts

OpenRouter is already present as a technical provider and appears in graphical provider/model flows. Current credential values distinguish API key and OAuth-like mechanics, but do not provide the complete product account contract required by AP-10.

The following remain explicit product work:

- credential kind and scope;
- protected storage and deletion lifecycle;
- connection verification and account identity where the provider supports it;
- model-catalog source and refresh behavior;
- session token/cost telemetry versus provider billing data;
- user-facing error classification;
- export, import, and diagnostic redaction rules;
- strict separation of OpenRouter keys, direct provider keys, and subscription authentication.

## AP-07 decision

Retain and consolidate the current renderer. The implementation sequence is:

1. Introduce the product domain and adapter contract.
2. Route project/task/run navigation through that adapter.
3. Add task workspace and completion/review surfaces by composing existing chat, event, terminal, permission, file, and diff capabilities.
4. Consolidate graphical account, provider, and model settings.
5. Remove superseded layout paths only after compatibility evidence exists.

Creating a replacement renderer, embedding VS Code, or making the CLI the product shell is outside the accepted architecture.
