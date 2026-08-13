# Architecture decisions

Status: accepted unless explicitly marked otherwise.

## ADR-001: Full fork with upstream remote

- Decision: Keep the complete OpenCode history in this repository.
- Remote contract: `upstream` is the official OpenCode repository; `origin` is reserved for the future mQorva fork.
- Rejected: submodule and one-time source copy.
- Reason: Core, Server, SDK, App, and Desktop evolve together and must remain mergeable with upstream.

## ADR-002: Existing desktop as technical baseline

- Decision: Start from the existing Electron desktop application and local OpenCode server integration.
- Preserve initially: packaging, updater, file and OS integration, WSL/terminal integration, Renderer-to-SDK connection, and server lifecycle.
- AP-07 decision: Retain the existing Solid renderer and consolidate it incrementally. Do not create a second renderer or replace the desktop shell.
- Preserve: the platform abstraction, preload/IPC boundary, sidecar lifecycle, updater, file picker, WSL/terminal integration, SDK event stream, diff/review capabilities, translations, and design tokens.
- Migration rule: New product screens depend on a product adapter instead of directly spreading OpenCode SDK and store details through UI components. Existing direct dependencies are migrated slice by slice.
- Layout rule: Select one product layout as the destination and retire overlapping legacy/new navigation only after equivalent behavior is proven.

## ADR-003: Product domain and adapter boundary

- Decision: Represent product projects, tasks, runs, events, approvals, diffs, and connected accounts through a stable product domain and a central OpenCode adapter.
- Constraint: Product UI must not depend on volatile OpenCode internals in many unrelated call sites.

## ADR-004: Product experience

- Decision: Build a calm, modern, fully integrated desktop workspace organized by projects and tasks.
- Constraint: Avoid CLI-near, VS Code-like, and JSON-first product configuration.
- Configuration: normal provider, model, account, project, and product settings must be graphical.

## ADR-005: Provider and authentication contract

- Decision: OpenRouter is mandatory, not optional.
- Constraint: OpenRouter API keys, direct provider API keys, and subscription/OAuth access are different credential types and must remain explicit in storage, errors, UI, and verification.
- Decision gate: Codex or Claude subscription authentication is implemented only after a technically and legally confirmed path exists.

## ADR-006: Upstream maintenance

- Decision: Merge `upstream/dev` through dedicated integration branches with semantic conflict review.
- Constraint: Keep general fixes isolated and upstream-capable where practical; do not rewrite published product history to follow upstream.

## ADR-007: Product task is not an OpenCode session

- Decision: A product task is a durable work item owned by a project. An OpenCode session is one execution run belonging to that task.
- Reason: Sessions currently provide strong conversation, event, tool, token, cost, revert, and child-session behavior, but they do not represent a stable product backlog or task lifecycle.
- Constraint: Do not overload OpenCode session titles, todo items, plan files, or local follow-up state as the canonical product task record.
- Compatibility: Existing OpenCode project and session identifiers remain addressable through adapter mappings so upstream storage and history are preserved.
