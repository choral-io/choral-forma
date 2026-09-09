---
schemaVersion: 1
kind: planning
title: Forma Guided Knowledge Modeling Flow
summary: Product contract for turning a domain description or existing Markdown corpus into a reviewable first Forma workspace model.
scope: project
type: plan
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - product-value
    - onboarding
    - modeling
    - proposal
sources:
    - "tasks/design-guided-knowledge-modeling-flow"
    - "planning/forma-product-value-gap-roadmap"
    - "product/product-direction"
    - "planning/no-example-workspace-bootstrap-phase-1-plan"
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Forma Guided Knowledge Modeling Flow

## Decision

The first guided-modeling experience is a reviewable, explainable proposal flow. It helps a Human or Agent translate a real domain into one small configured Forma slice, but it does not silently write files, import a corpus, or invent a complete information architecture.

The flow is product-level and surface-independent. CLI, Agent guidance, and a future GUI produce and review the same proposal facts. A later implementation may add commands or screens, but must not change this contract to make one surface authoritative.

The default path starts from the user's language and a first useful content group. It does not copy an example workspace, require prior Schema DSL knowledge, or treat this repository's `knowledge/`, task, member, or project vocabulary as Forma built-ins.

## First-slice Implementation Amendment

2026-09-09: The first empty-corpus implementation uses the structured slice compiler and file plan defined in [[decisions/guided-modeling-slice-compiler-and-file-plan]], rather than fixing the generic proposal/artifact sketches below as implementation interfaces. That record defines the supersession scope, retained user value, templateMode, CLI command surface, confirmation and validation, dependencies, and parser compatibility impact.

The generic model shapes, existing/mixed inventory, and complete cross-surface journey below remain inputs to future design; they do not establish that the first implementation covers every goal. Pre-commit acceptance of the first implementation uses the vertical creation/retrieval checks and review counterexamples in that decision. This amendment does not change the original design Task status.

## Goals And Non-goals

### Goals

- Accept a domain description, an existing Markdown corpus, or both.
- Ask the smallest set of questions needed to choose one first content group.
- Produce a deterministic, reviewable first-slice proposal for spaces, semantic types, fields, templates, guidelines, and an initial view.
- Give every proposed artifact a human-readable reason and source evidence.
- Make assumptions, alternatives, deferred structure, conflicts, and unsupported automation visible.
- Leave the source corpus unchanged until a separate approved implementation operation exists.
- Provide enough stable output for later CLI, Agent, GUI, and test-fixture implementations to share one model.

### Non-goals

- Importing, normalizing, rewriting, moving, or deleting existing content.
- Automatically creating or approving workspace files.
- Generating a complete enterprise information architecture.
- Inferring product primitives from directory names, filenames, Git history, or this repository's conventions.
- Network crawling, external ontology lookup, secret discovery, workflow execution, or hidden database creation.
- Adding automatic structured-artifact declarations or making `forma check` scan JSON/YAML artifacts. That boundary remains intentionally deferred by [[decisions/defer-automatic-schema-check-integration]].

## Inputs

The flow accepts an input envelope. This is a design-level shape, not yet a committed CLI or RPC schema.

```yaml
modelingInput:
    mode: empty | existing | mixed
    domainDescription: "Human description in ordinary language"
    desiredOutcome: "What should become easier or more reliable?"
    existingRoots:
        - "workspace-relative directory or file"
    representativeFiles:
        - "workspace-relative path"
    constraints:
        audience: []
        lifecycle: []
        privacy: []
        integrations: []
    preferredTerms: []
    rejectedTerms: []
    reviewPreferences:
        firstSliceSize: small
        allowSeedEntries: false
```

`mode: empty` means no existing corpus is needed; the flow may inspect the current Forma configuration and workspace health before proposing additions. `mode: existing` is read-only inventory of explicitly selected roots. `mode: mixed` combines the two and must distinguish user description from observed file evidence.

The minimum discovery questions are:

1. What recurring kind of content should be easier to create, find, or keep consistent?
2. Who will read or maintain it, and what decision or action should it support?
3. Is there an existing corpus to inspect, and which roots are in scope?
4. Which fields are genuinely required for the first useful entry?
5. Which relationships or views are needed now, and which can wait?
6. What must not be inferred, imported, or changed without a separate approval?

The flow may ask fewer questions when the answers are unambiguous. It must not fill material gaps with repository conventions or silent defaults.

## End-to-end Journey

### 0. Establish The Workspace Boundary

Before modeling, the surface performs the normal read-only Forma bootstrap:

```text
skills get forma-cli-core
config summary --sources --json
workspace health --json
```

For an existing corpus, the surface also records the explicitly selected roots and uses configuration-derived classification. A directory called `notes`, `projects`, `tasks`, or `local` has no product meaning by itself.

The result records the current workspace root, effective configuration, health baseline, and whether the requested roots are managed content, control files, or unmanaged files. It does not change any file.

### 1. Discover The First Content Group

The surface restates the user's goal in neutral terms and narrows it to one first content group. A content group is a configured space-backed collection of entries; domain words such as `decision`, `sample`, `incident`, or `customer` are configured semantic vocabulary, not Forma built-ins.

The discovery result contains:

- the proposed group label and purpose;
- the user outcome it supports;
- intended readers and maintainers;
- selected source roots or the explicit empty-workspace starting point;
- a short list of required, optional, and deferred concerns;
- unresolved questions that block a safe proposal.

If unresolved questions affect identity, source boundaries, privacy, or destructive behavior, the flow stops with questions instead of guessing.

### 2. Inventory Existing Content (When Selected)

Inventory is read-only and bounded to user-selected roots. It may collect:

- normalized workspace-relative paths;
- Markdown frontmatter keys and scalar/list/object shapes;
- headings and ordinary link/reference forms;
- file extension, parse status, and duplicate or conflicting identifiers;
- representative samples selected by the user.

It must not rewrite files, resolve external URLs as internal entries, fetch network content, infer ownership from Git history, or claim that a whole directory is a content group without evidence. Inventory findings are evidence, not an import plan.

### 3. Draft A First-slice Model

The flow proposes the smallest useful model that can be reviewed and later implemented. It should normally contain one space and one or two entry examples; relationships, additional spaces, and richer views are added only when the stated outcome requires them.

Every artifact proposal has the following fields:

| Field          | Meaning                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `kind`         | `space`, `type`, `field`, `template`, `guideline`, `view`, `mapping`, or `verification` |
| `id` / `path`  | Proposed configured identifier or workspace-relative path, clearly marked as proposed   |
| `reason`       | User-visible explanation of why the artifact supports the stated outcome                |
| `source`       | User statement, inventory evidence, existing config path, or explicit product rule      |
| `confidence`   | `observed`, `confirmed`, `inferred`, or `deferred`                                      |
| `dependencies` | Other proposed artifacts that must exist first                                          |
| `changeClass`  | `none`, `new-file`, `metadata-only`, or `future-operation`                              |
| `notes`        | Alternatives, conflicts, compatibility limits, or safety constraints                    |

The first-slice model covers:

- **Space** — purpose, workspace-relative `include` pattern, optional exclusions, source boundary, and a proposed title.
- **Semantic types** — base type and configured domain meaning; space-backed types only when the user needs references.
- **Fields** — required/optional status, cardinality, defaults, allowed values, and reference intent.
- **Template and create inputs** — proposed path, input prompts, and an example rendered shape without writing it.
- **Guideline** — only the maintenance rule needed to keep the first group understandable; no workflow engine.
- **Initial view** — the smallest list, board, or detail projection that answers the stated retrieval question.
- **Mappings** — for existing content, a file-by-file or pattern-based observation with conflicts and an explicit future import boundary.
- **Verification** — commands and expected evidence for configuration, content, and health after a later approved implementation.

The proposal must preserve the Markdown source-of-truth boundary. A structured JSON/YAML artifact may be proposed as a separate explicit content file, but validation remains an explicit `forma tools schema validate` action until the deferred automatic-artifact decision is reopened.

### 4. Explain Assumptions And Alternatives

The proposal includes three separate lists:

- **Assumptions** — statements needed to make the first slice concrete, each tagged with its source and confidence.
- **Alternatives** — plausible choices that were not selected, with the tradeoff and the question that would change the choice.
- **Deferred structure** — useful but intentionally postponed items such as cross-space relationships, bulk normalization, lifecycle automation, or additional views.

An assumption is never presented as observed fact. If the same evidence supports incompatible mappings, the proposal reports a conflict and asks for a choice.

### 5. Review And Decide

Review is explicit and per artifact. The Human can `accept`, `edit`, `defer`, or `reject` each proposed item, and can revise the discovery answers before deciding. The review record includes:

- the proposal identifier and input summary;
- accepted, changed, deferred, and rejected artifacts;
- unresolved questions and rejected automation;
- the exact future operation or follow-up task needed to apply accepted items.

No review action writes workspace files. A proposal is not a lock, authorization, import receipt, or guarantee that a later write will succeed.

### 6. Handoff To A Later Implementation

Only an accepted proposal may be handed to a future implementation operation. That operation is outside this design task and must separately define preview, approval, preconditions, conflict handling, rollback, and post-write verification.

For an empty workspace, the eventual implementation should create only the accepted minimal configuration and content. For an existing corpus, it should use a separate import/normalization contract and preserve originals. The modeling flow does not collapse these two operations.

### 7. Verify The Result

After a later approved implementation, the expected evidence sequence is:

```text
config inspect --json
check --json
list --space <configured-space> --json
inspect <entry> --json
workspace health --json
```

If a proposed structured artifact is part of the accepted slice, run its explicit schema command with the artifact and workspace-local schema named by the user. The modeling flow must not turn that command into an implicit workspace scan.

## Proposal Output Contract

The following shape is the stable product concept that later surfaces should share. Field names may be adapted to the owning CLI/RPC contract after implementation design; the meaning and review boundary must remain.

```yaml
modelingProposal:
    schemaVersion: 1
    proposalId: "deterministic identifier"
    workspace:
        root: "."
        mode: empty | existing | mixed
        healthBaseline: "captured result reference"
    discovery:
        goal: "restated user outcome"
        contentGroup: "proposed configured group"
        audience: []
        sources: []
    artifacts:
        - kind: space
          id: "configured-id"
          reason: "why this belongs in the first slice"
          source: "user | inventory | config | product-rule"
          confidence: confirmed
          changeClass: new-file
          dependencies: []
          notes: []
    assumptions: []
    alternatives: []
    deferred: []
    conflicts: []
    rejectedAutomation: []
    review:
        decisions: []
        approvalRequired: true
    verification:
        commands: []
        expectedEvidence: []
```

The proposal is explainable when a reviewer can trace every artifact to a user answer, observed file/config evidence, or an explicitly named product rule. `source` is not a claim that the source file will be modified.

## Surface Boundaries

### CLI

The CLI is the scriptable, visible entry point for proposal generation and rendering. A future command name is intentionally left open; it must expose machine-readable JSON and a readable summary, accept explicit roots, and return stable diagnostics for unresolved questions, conflicts, and rejected automation. It must not require a GUI or an Agent service.

The CLI may compose existing read-only operations (`config summary`, `workspace explain`, `workspace health`, `list`, `inspect`, and explicit `tools schema validate`) but must not hide writes behind a modeling command.

### Agent

Agent guidance asks discovery questions, loads only the relevant docs, gathers read-only evidence, renders the proposal, and waits at the review boundary. It can explain or edit a proposal after Human direction, but it is not the only client and cannot self-authorize a write. The compact `forma-cli-core` router remains separate from the detailed bootstrap/modeling guidance so ordinary read tasks do not incur the full context cost.

### Future GUI

A GUI may present the same discovery steps, artifact cards, source evidence, alternatives, and per-artifact decisions. It may add progressive disclosure and visual mapping, but it must use the same proposal facts and review semantics as CLI and Agent paths. GUI-only defaults, hidden imports, or silent acceptance are not part of the product contract.

## Rejection And Safety Rules

The flow returns a structured rejection or question instead of guessing when it encounters:

- an unselected directory or file root;
- conflicting frontmatter shapes or duplicate entry identities;
- a requested cross-space reference whose target group is not yet accepted;
- a request to rewrite, move, delete, or bulk-normalize existing content;
- a request to fetch external sources, resolve network `$ref`, or infer sensitive ownership;
- secrets, credentials, or private material inside an inventory root;
- a request to generate a full enterprise model before a first slice is reviewed;
- an automatic JSON/YAML artifact scan or hidden projection not covered by the current contract.

Each rejection includes the observed evidence, why the request is outside the current boundary, and a safe next step such as narrowing roots, answering a question, creating a separate import task, or invoking an explicit schema validation command.

## Representative Fixtures

The fixtures are acceptance scenarios, not default templates. Each must be runnable from a fresh empty workspace and from a small explicitly selected existing corpus.

### Software R&D: Decision And Experiment Notes

**Input.** A team wants a durable record of technical decisions and experiments. The existing repository contains Markdown notes under a user-selected `notes/` root with inconsistent `status` and `owner` frontmatter; the team wants a reviewable first slice, not a rewrite.

**Observable success.** The proposal chooses one configured space (for example, a team-selected `decision-record` id), identifies required title/decision/status fields from the discussion and observed files, proposes an optional owner semantic type only when the team confirms it, records the conflicting existing shapes, and defers experiment links and bulk normalization. Every artifact cites either the team's answers or an inventory path. A later verification plan names `check`, `list`, `inspect`, and health evidence.

**Observable rejection.** The flow refuses to auto-classify every repository Markdown file, infer ownership from Git history, or create a full project/epic/issue hierarchy. It reports the selected-root boundary and offers a separate import/normalization task.

### Research: Study Observations

**Input.** A researcher starts empty and describes recurring study observations, source citations, and a need to compare observations by date and method. No example workspace is provided.

**Observable success.** The proposal contains one observation space, a small date/method/source field set, a template input list, a simple table or list view, and a guideline for preserving source citations. It explains why a citation reference is deferred or configured and marks all inferred fields as assumptions until reviewed.

**Observable rejection.** The flow refuses to fetch DOI metadata, construct a complete ontology, or silently treat external URLs as internal entries. It asks the researcher to select an explicit source boundary or records the enrichment as future work.

### Operations: Service Runbook And Incident Records

**Input.** An operations team has existing Markdown runbooks and incident notes under two selected roots. They want a first slice that makes current status and next action visible while preserving originals.

**Observable success.** The proposal distinguishes the two roots, proposes one first content group with required operational fields confirmed by the team, identifies a view that answers the current-status question, and marks cross-group links and lifecycle automation as deferred. The mapping section points to representative files and reports incompatible frontmatter without changing it.

**Observable rejection.** The flow refuses to execute operational actions, extract secrets or credentials, or bulk-migrate the corpus during modeling. It reports the sensitive path or unsupported action and proposes a separate approved write/import boundary.

## Follow-up Implementation Slices

The design can be implemented without changing the contract by splitting the work into these independently verifiable slices:

1. **Proposal read model** — define the Core/RPC result types, deterministic proposal id, diagnostics, and JSON/human projections; no writes.
2. **Empty-workspace discovery** — expose the question set and first-slice proposal for one configured space, with three fixture tests.
3. **Read-only corpus inventory** — add explicit-root inventory and conflict findings; keep import and normalization separate.
4. **Review record** — persist or export accepted/deferred/rejected decisions only through a separately approved review/write contract.
5. **Implementation handoff** — design preview/apply/precondition/rollback behavior for the accepted empty-workspace slice before creating files.
6. **Surface adapters** — add CLI first, then Agent guidance and GUI projections against the shared proposal contract; retain capability differences as explicit surface metadata.
7. **External value evidence** — run the comparative pilot in [[tasks/define-external-product-value-validation]] after the first usable implementation, measuring setup effort, errors caught, rework, and retention rather than assuming product value.

The deferred automatic structured-artifact check remains a separate re-entry decision. It may be reconsidered only after at least two independent workspace pilots demonstrate repeated manual validation cost and an explicit artifact declaration contract is accepted.

## Acceptance Evidence

This design is accepted when:

- the three fixtures produce proposals with traceable artifact reasons and sources;
- empty and existing modes preserve their distinct write boundaries;
- unsupported automation returns actionable rejections;
- a reviewer can decide per artifact without creating files;
- later implementation slices can be assigned to Core/RPC, CLI, Agent, GUI, inventory, and write-operation tasks without redefining the proposal or approval semantics.

## Result

The guided modeling journey, proposal shape, safety boundary, three representative fixtures, and implementation split are defined. Implementation of the flow, corpus import, automatic structured-artifact scanning, and any write operation remain separate approved tasks.
