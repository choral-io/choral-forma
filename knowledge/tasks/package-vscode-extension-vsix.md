---
schemaVersion: 1
kind: task
scope: project
title: Package VS Code extension VSIX
summary: Make the Forma for VS Code extension package distributable, inspectable, and installable as an internal Alpha 13 VSIX.
type: task
priority: P1
value: H
module: infra
effort: M
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - vsix
    - packaging
blockedBy: []
relatedTo:
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code extension metadata, package contents, and install smoke
---

# Package VS Code Extension VSIX

## Goal

Produce a reproducible VSIX package definition that CI can build and internal testers can install.

## Sources

- [[planning/editor-extension-alpha-13-execution-plan]]
- [[design/editor-extension-mvp-design]]

## In Scope

- Add current `@vscode/vsce` packaging support without publishing to Marketplace.
- Complete extension metadata for id, display name, description, repository, license, categories, keywords, commands, settings, capabilities, and version.
- Add an extension README, changelog, installation instructions, preinstalled Forma requirement, supported modes, Graph deferral, trust behavior, remote compatibility statement, and troubleshooting guidance.
- Define package inclusion/exclusion so source, tests, caches, local state, and unrelated workspace files are absent from the VSIX.
- Add a package-content inspection command and reproducible VSIX output name.
- Locally package only to a disposable validation path; CI remains the source of the distributed artifact.
- Install and activate the disposable VSIX in an isolated VS Code profile or Extension Host fixture.

## Out Of Scope

- Marketplace authentication or upload.
- Bundling Forma.
- Public marketing assets beyond an acceptable internal package presentation.

## Acceptance Criteria

- Package-content listing contains only required manifest, bundle, docs, license, and assets.
- Disposable local VSIX packaging succeeds from a clean checkout with installed dependencies.
- Install/activation smoke succeeds with a supported VS Code version and separately installed Forma.
- Missing Forma produces the designed status rather than activation failure.
- The VSIX name and embedded manifest use `0.1.0-alpha.13`.
- No secrets, source maps containing source content, caches, or local workspace state are packaged.
