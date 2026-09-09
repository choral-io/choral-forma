---
schemaVersion: 1
kind: decision
scope: project
type: decision
title: Guided Modeling Slice Compiler And File Plan
summary: Define the first empty-corpus slice, its reviewed file plan, template mode, compatibility boundaries, and verification requirements.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - guided-modeling
    - core
    - cli
    - compatibility
sources:
    - "planning/forma-guided-knowledge-modeling-flow"
    - "architecture/forma-p0-operation-api-spec"
    - "architecture/forma-p0-check-index-spec"
    - "architecture/forma-p0-schema-dsl-spec"
    - "guidelines/dependency-governance"
supersedes: []
supersededBy: []
---

# Guided Modeling Slice Compiler And File Plan

## Status And Authority

2026-09-09: This record documents implementation choices and contract amendments within the authorized reimplementation and review-fix scope, for pre-commit review. It does not establish a stable RPC commitment, a completed release, or acceptance of the original design Task. Existing Task lifecycle metadata remains unchanged.

## Context

[[planning/forma-guided-knowledge-modeling-flow]] establishes a journey from user needs to an explainable model that can be revised item by item, with sketches for generic proposals, artifact kinds, and review records. Directly mapping semantic fields to physical artifacts, or treating a proposal ID as confirmation of files, would leave dependencies, final write contents, and the object of user approval unclear in the first implementation.

The first useful outcome is a content group that supports creating and retrieving content. The implementation therefore follows a narrow vertical slice: structured choices → complete file compilation → workspace validation → exact confirmation → create-only application → first-entry creation and retrieval.

## Decision And Supersession Scope

- The first empty-corpus implementation uses `SliceChoice` and `compile_slice` instead of implementing the original generic `ModelingArtifact`/proposal read-model interface. Fields belong to a content group; the compiler turns semantic choices and dependencies into a complete file set. The taxonomy, content group, template, and table view are all explicit; dependencies are never created implicitly.
- The original design's user value, reasons, explicit choices, review after revision, prohibition on self-authorization, Markdown/configuration authority, and shared Core ownership remain in force. This record amends the generic proposal serialization shape and artifact-enumeration-based implementation sequence within this first slice; they are no longer acceptance interfaces for this implementation.
- The scope is an initialized workspace with an empty configured corpus, one content group, Text/Date fields, and a table. Existing-content inventory/import, general semantic types and relationships, natural-language inference, GUI, and modeling RPC remain future work. The current interface does not complete the original empty/existing/mixed journeys.
- The CLI exposes `model guide`, `model prepare`, and `model apply`. The guide collects and presents choices; Core owns semantics, files, and validation. An Agent may propose candidate choices but cannot claim user approval merely because it holds a plan ID.

## File Plan And Workspace Binding

Version-2 file plans contain `schemaVersion: 2`, a `gm2-…` ID, `workspaceId`, and complete choice/files/preconditions/verification/advisories. Experimental `gm1` plans must be prepared and confirmed again; their approval is not migrated automatically.

`workspaceId` is a protocol-domain-separated SHA256 digest of the canonical root; plans do not serialize absolute host paths. Workspace binding remains necessary: two independently initialized workspaces with identical content can have identical relative paths and content preconditions, so those preconditions alone cannot distinguish the target. The digest is neither authentication, a secret token, nor a guarantee against correlation.

The canonical root is used only internally. Apply resolves WorkspaceBoundary once, regenerates and compares the entire file plan on that boundary, and reuses the same boundary for writes. Retargeting a workspace alias during validation therefore cannot redirect writes. This is not a filesystem lock against replacement of the workspace root inode or arbitrary external writers.

Ordinary operation results continue to follow the safe-path constraints in [[architecture/forma-p0-operation-api-spec]]. A file plan is an explicitly exported execution artifact awaiting confirmation. Only that artifact may carry confirmation IDs, non-path workspace binding, and content-digest preconditions. This narrow exception does not permit indexes or ordinary CLI/RPC results to expose internal cache hashes, mtimes, absolute paths, or credentials.

## Validation And Recovery

Prepare copies actual configuration inputs and relevant empty directories into a private temporary workspace, retaining the original imports without expanding reachability for validation. A synthetic entry uses a deterministic available filename to avoid conflicts with existing empty directories. Validation performs actual create, inspect, list, table render, and post-creation check operations in the copy. It checks statuses, confirms that the created path belongs to the intended group, and verifies its presence in list/table results. The synthetic entry is never written to the user's workspace.

This is a bounded, representative usage check. It does not prove validity for every future field value, filename, or external configuration change. Changes to original inputs or the plan require a new prepare/confirmation cycle.

Target writes reuse WorkspaceBoundary's create-only operations. After writing, apply compares actual and expected files and the entire checked input set, then validates actual creation and retrieval in a fresh temporary copy. There is no multi-file atomic transaction. Failures preserve the files and report written paths, a potentially incomplete target, newly observed directories, and the error. `partial`/`verificationFailed` must not be reported as success. Cleanup requires separate handling based on the observed state and applicable authorization.

## Template And Parser Compatibility

The new configuration field `create.templateMode: text | structuredMarkdown` defaults to `text`, preserving existing literal string replacement. `structuredMarkdown` parses YAML frontmatter before substituting values and serializing it. Whole-value placeholders preserve input types; missing declared optional inputs are omitted only when they occupy an entire mapping value. Explicit null and absence remain distinct. Missing inputs in embedded text, sequences, or the body still produce errors. Placeholder-like text within input values is not evaluated recursively.

Core creation operations consume this mode consistently; existing CLI/RPC create/create.preview operations share the behavior. config.summary adds a templateMode projection while retaining defaults for decoding older JSON, and the shared TypeScript contract is updated accordingly. This is an explicitly selected template-rendering mode, not a hidden modeling-specific directive.

The frontmatter closing delimiter now requires `---` at the start of the line, while still allowing trailing whitespace. Matching no longer removes leading whitespace. Indented `---` inside a YAML block scalar belongs to its value; the previous parser could truncate quoted or multiline input. Compatibility impact: documents that previously used indented closing delimiters must move the actual closing delimiter to column 1, while markers inside block scalars remain indented. This correction affects every read path sharing the frontmatter delimiter parser, not only the new template mode.

## Dependency Choice

Core adds `sha2 = 0.11.0` as a direct runtime dependency for plan and content integrity digests. This version already exists in Cargo.lock; no version upgrade or network service is introduced. The standard library's DefaultHasher is unsuitable for stable digests in execution artifacts shared across runs, and a custom cryptographic hash offers no benefit. The dependency remains in Core, which owns the plan contract. A future digest algorithm change must migrate through a protocol version change rather than silently altering existing IDs.

## Distribution Advisory

`.forma/local/` remains a valid explicitly reachable target. To reduce collaboration omissions, plans targeting this conventional path include the non-blocking `modeling.reviewDistribution` advisory, displayed by the CLI before file confirmation. The advisory concerns distribution conventions; it does not claim to have checked Git-ignore rules, change runtime classification, or provide a privacy guarantee.

Users must verify that their actual distribution process includes all required configuration and referenced files. Neither directory names nor `.gitignore` determine whether Forma loads a file. Valid configuration must not be rejected merely because its path contains local.

## Delivery And Verification

Complete and record the following evidence before committing. Earlier full-suite success does not replace the review counterexamples:

- Retargeting a workspace alias cannot redirect confirmed writes. Plans cannot be replayed in a different workspace with identical content, and JSON contains no generated absolute host paths.
- Empty directory trees are preserved, synthetic filenames avoid conflicts, and ordinary primary-taxonomy classification conflicts for the first entry are detected during prepare. No synthetic entry remains in the user's workspace.
- The local-convention advisory is visible without rejecting valid plans, and its contents are bound by complete-plan confirmation.
- Regression coverage passes for template quotes, multiline values, optional/null behavior, the existing text mode, and frontmatter block scalars.
- Actual creation and retrieval across three domains, CLI guide/prepare/apply, affected projections, repository check/health, the full `mise run check`, and independent read-only review all pass.

Implementation details and invocation examples are in `docs/cli/model.md` and `docs/workspace/templates.md`. This record and the original planning amendment provide the shared contract history. The local handoff retains execution details and does not replace the product contract.
