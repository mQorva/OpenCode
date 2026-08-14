# mQorva OpenCode desktop product plan

Version: 14 August 2026

## Goal

Create an independently branded, commercially usable, open-source desktop product from the MIT-licensed OpenCode codebase. Keep the capable OpenCode agent runtime while delivering a calm, modern, fully integrated project- and task-centered experience similar in operating principle to the Codex desktop app. OpenRouter is a mandatory first-class provider path.

## Repository and maintenance model

- Maintain a full fork with complete history.
- `upstream` tracks the official OpenCode `dev` branch.
- `origin` is reserved for the future mQorva product fork.
- Integrate upstream regularly through reviewed merge branches.
- Keep product logic in explicit product packages and adapters; minimize upstream-core divergence.
- Preserve upstream MIT and third-party notices and state that the product is not affiliated with the official OpenCode team.

## Target architecture

```text
mQorva desktop product
├── project and task navigation
├── task workspace, approvals, files, diffs, terminal, and completion review
├── graphical settings and connected accounts
├── product domain and OpenCode adapter
└── OpenCode SDK / Server / Core
    ├── sessions and events
    ├── agent and tool execution
    ├── permissions, files, diffs, and PTY
    └── providers including OpenRouter
```

The existing Electron Desktop, shared SolidJS App, SDK connection, local server lifecycle, updater, and OS integration are the starting point. AP-06 inventories what already exists; AP-07 makes the evidence-based renderer decision.

## Product constraints

- Normal use must not require CLI work, VS Code, or manual JSON editing.
- Projects and durable tasks are the primary navigation model.
- OpenRouter, direct API keys, and subscription/OAuth accounts remain separate contracts.
- Settings expose providers, models, credentials, and product behavior graphically.
- Generic upstream fixes remain isolated from branding and product changes.
- Builds, packaging, desktop runtime, UI behavior, persistence, and live providers are separate evidence levels.

## Work packages

| ID    | Result                                                               | Depends on                           |
| ----- | -------------------------------------------------------------------- | ------------------------------------ |
| AP-00 | Product decisions and explicit decision gates                        | current owner direction              |
| AP-01 | Full fork, correct remotes, recorded base                            | AP-00 where required                 |
| AP-02 | Root contract, plan, decisions, base, and resumable status           | AP-01                                |
| AP-03 | Fresh unchanged baseline compiles and Windows desktop starts         | AP-01                                |
| AP-04 | Build failures repaired within limits and package basis verified     | AP-03 started                        |
| AP-05 | Reproducible PowerShell setup/check/build/package contract           | AP-04                                |
| AP-06 | Desktop and UI flow/component inventory                              | AP-03                                |
| AP-07 | Evidence-based renderer strategy decision                            | AP-06                                |
| AP-08 | Product domain and OpenCode adapter contract                         | AP-06, AP-07                         |
| AP-09 | Product domain and durable task persistence                          | AP-08                                |
| AP-10 | OpenRouter account/provider/security contract                        | AP-08                                |
| AP-11 | Complete graphical OpenRouter integration                            | AP-09, AP-10                         |
| AP-12 | Project navigation and durable task list                             | AP-09                                |
| AP-13 | Integrated task workspace                                            | AP-09, AP-12                         |
| AP-14 | Diff, review, evidence, and completion workspace                     | AP-13                                |
| AP-15 | Complete graphical settings                                          | AP-10, AP-12                         |
| AP-16 | Selected direct API providers                                        | AP-11, AP-15                         |
| AP-17 | Approved Codex/Claude authentication paths                           | confirmed legal and technical access |
| AP-18 | Upstream update automation and compatibility test merge              | AP-05 and product changes            |
| AP-19 | Security, regression, performance, accessibility, and product review | release scope complete               |
| AP-20 | Installable and startable Windows distribution                       | AP-19, name/signing decisions        |
| AP-21 | Open-source publication                                              | AP-20 and owner approval             |
| AP-22 | Verified macOS and Linux distributions                               | stable Windows baseline              |

## Agent execution contract

The orchestrator owns architecture, contracts, integration, reviews, and acceptance. Luna workers receive bounded, non-overlapping tasks with explicit read/write scope, non-goals, checks, acceptance criteria, stop conditions, and structured handoff. Luna does not decide architecture, persistence, public APIs, authentication, security, licensing, upstream conflicts, publication, or paid external actions.

Parallel work is allowed only for disjoint files and contracts. Protocol, Schema, SDK, Client generation, root manifests, lockfiles, shared tokens, and architecture records use a single writer. Worker output is reviewed against its assignment and is never accepted on assertion alone.

## Quality gates

Every affected package passes the relevant gates:

1. rules, clean scope, and preservation of unrelated changes;
2. repository research and reuse decision;
3. product, API, persistence, provider, and authentication contract;
4. implementation quality including loading, empty, error, and resume states;
5. package-local format, typecheck, tests, generation, and builds;
6. real desktop/UI/persistence/provider verification where authorized;
7. user, product, UI, backend, security, and regression review;
8. status, decisions, evidence, and next-package handoff.

An item is done only when acceptance criteria and relevant gates pass, blocking findings are repaired, documents and tests match the implementation, runtime evidence is not inferred from static checks, and a new chat can continue from repository state alone.

## Bounded baseline repair

AP-03/AP-04 allow at most three meaningful repairs for one stable root cause and eight meaningful repairs total in a contiguous run. Each attempt records the failing command, diagnosis, change, and result. Identical retries without changed state do not count and are not allowed as an endless loop. At the limit, stop with the complete error, classification, attempted repairs, Git/build state, reversible changes, and concrete options. Product-domain, provider, and renderer work does not begin without a compiled and started reference baseline unless the owner explicitly changes the base decision.

## Bounded repair loops

Every later implementation and verification stage is bounded as well. One contiguous repair loop may address at most three distinct, evidenced failure causes. Repeating an unchanged command is not a repair attempt and is prohibited unless an external prerequisite has demonstrably changed. When the third cause is not resolved, stop that loop, preserve the reproducible state, record the exact blocker and attempted fixes, and continue only after a new diagnosis or an explicit owner decision. A successful check closes the loop and the next independently scoped work package starts with a fresh limit.

## Owner decision gates

Explicit approval is required for the final name and branding, GitHub organization and public repository, license changes, paid services, productive credentials, subscription authentication, code signing purchases, public pushes/releases, and any departure from full-fork maintenance, OpenRouter as mandatory, or the task-centered UI goal. Independent technical work continues until the first package that truly depends on one of these decisions.
