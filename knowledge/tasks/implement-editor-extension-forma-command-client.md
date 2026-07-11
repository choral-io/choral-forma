---
schemaVersion: 1
kind: task
scope: project
title: Implement editor extension Forma command client
summary: Discover a preinstalled Forma binary and invoke structured CLI operations with cancellation, compatibility, and safe process handling.
type: task
priority: P1
value: H
module: app
effort: M
status: backlog
readiness: blocked
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - cli
    - process
blockedBy:
    - "tasks/scaffold-vscode-extension-package"
relatedTo:
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Extension process and Forma CLI adapter
---

# Implement Editor Extension Forma Command Client

## Goal

Provide one testable process boundary for locating and invoking a separately installed Forma binary.

## Sources

- [[architecture/editor-extension-adapter-contract]]
- [[planning/editor-extension-alpha-13-execution-plan]]

## In Scope

- Resolve an explicit user-level `forma.path` setting before falling back to `forma` on the extension-host `PATH`.
- Treat workspace-scoped binary settings as restricted in untrusted workspaces.
- Run `forma --version` and expose missing, inaccessible, incompatible, and ready outcomes.
- Execute structured CLI operations with an explicit workspace root and JSON output.
- Implement cancellation, timeout, bounded stdout/stderr capture, exit-code handling, JSON parse errors, and redacted logging.
- Validate operation and schema versions instead of best-effort interpretation of unknown output.
- Make process spawning injectable so unit tests use deterministic fake processes.
- Keep paths correct when the extension runs in a remote workspace extension host.

## Out Of Scope

- Bundling or downloading Forma.
- Running workspace-provided executables automatically.
- Persistent HTTP, stdio RPC, daemon, or language-server lifecycle.
- Workspace selection and editor UI.

## Acceptance Criteria

- Explicit user setting and `PATH` lookup order are covered by tests.
- Missing binary, incompatible version, timeout, cancellation, non-zero exit, invalid JSON, and passed-result cases are covered.
- Logs do not expose environment variables, credentials, or unbounded command output.
- The command client can call current config, health, check, inspect, and view commands through one typed interface.
- No network request is used to acquire Forma.
