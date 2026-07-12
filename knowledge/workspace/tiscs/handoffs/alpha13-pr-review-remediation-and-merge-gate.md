---
scope: member
type: handoff
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - workspace
    - handoff
    - forma
    - github
    - pull-request
    - release
    - vscode
---

# Alpha 13 PR Review Remediation And Merge Gate

## Current Disposition

This handoff is retained as historical execution context. It is not an active plan.

The project owner later decided to defer PR review and merge-gate workflow design and continue product development instead. Do not execute the proposed merge gate, Copilot review policy, repository rules, or main-conversation start prompt without a new explicit approval. Historical review findings and release context below remain useful evidence for understanding the Alpha 13 remediation sequence.

## Purpose

Hand off the post-release work required to address review feedback that was not processed before Forma `v0.1.0-alpha.13` was merged and published, then make the PR merge process resistant to the same failure mode.

This handoff is execution context for the main conversation. It does not itself change task state, release evidence, product code, GitHub review threads, repository rulesets, or the published Alpha 13 tag.

## Current State

- Forma `v0.1.0-alpha.13` is published as an internal GitHub prerelease.
- [Implementation PR #1](https://github.com/choral-io/choral-forma/pull/1) and [release-evidence PR #2](https://github.com/choral-io/choral-forma/pull/2) are merged.
- PR #1 was merged after CI and mergeability checks, but without a thread-aware review sweep.
- Five Copilot inline comments were submitted before PR #1 merged and were missed.
- One Codex P2 comment on PR #1 arrived shortly after merge.
- PR #2 merged approximately seven seconds before its Copilot review arrived; its Codex P2 review also arrived after merge.
- All nine review threads remain unresolved on GitHub. Two PR #2 Copilot threads are marked outdated by GitHub, but their observations still apply to the current document.
- The project owner has disabled automatic GitHub Copilot Code Review.
- The project owner has a free GitHub Copilot Pro subscription granted for open-source participation, with 1,500 AI Credits per month.
- Copilot PR Review should therefore be requested manually and selectively, not on every PR or push.

## Review Findings To Address

### PR #1: Implementation

1. **Reference token end offset is inclusive instead of exclusive.**
    - Thread: [discussion_r3564116067](https://github.com/choral-io/choral-forma/pull/1#discussion_r3564116067)
    - Current behavior uses `offset <= token.end`, although token ranges and VS Code ranges are `[start, end)`.
    - Required change: use `< token.end` and test offsets at `start`, `end - 1`, and `end`.

2. **Restricted-mode test reintroduces `ELECTRON_RUN_AS_NODE`.**
    - Thread: [discussion_r3564116079](https://github.com/choral-io/choral-forma/pull/1#discussion_r3564116079)
    - The environment first removes the variable, then adds `ELECTRON_RUN_AS_NODE: undefined` before `spawn`.
    - Required change: omit the key entirely and add a focused assertion or test around the environment passed to the runner.

3. **View mount diagnostics name the wrong marker.**
    - Threads: [missing mount](https://github.com/choral-io/choral-forma/pull/1#discussion_r3564116089) and [multiple mounts](https://github.com/choral-io/choral-forma/pull/1#discussion_r3564116093)
    - Runtime recognizes `<!-- forma:content -->`, while diagnostics say “forma-view mount point.”
    - Required change: make both diagnostics name the exact accepted marker and cover the messages in tests.

4. **The default VSIX filename hardcodes Alpha 13.**
    - Thread: [discussion_r3564116104](https://github.com/choral-io/choral-forma/pull/1#discussion_r3564116104)
    - Required change: derive the default filename from `packages/vscode-extension/package.json` while preserving the `VSIX_OUT` override.

5. **Legacy empty `<!-- forma-view -->` mounts are accepted without editor source mapping.**
    - Thread: [discussion_r3564121136](https://github.com/choral-io/choral-forma/pull/1#discussion_r3564121136)
    - Current behavior suppresses `view.mountMissing` for the legacy directive, but `document.mounts` only maps `<!-- forma:content -->`; preview content can silently fall back to the end of the document.
    - Recommended direction: since old-version compatibility is not required, reject the legacy empty marker consistently and emit an actionable migration diagnostic telling users to replace it with `<!-- forma:content -->`.

### PR #2: Release Evidence

1. **The released Alpha 13 record is still titled “Next Internal Release.”**
    - Threads: [frontmatter title](https://github.com/choral-io/choral-forma/pull/2#discussion_r3564153341) and [H1](https://github.com/choral-io/choral-forma/pull/2#discussion_r3564153348)
    - Required immediate change: align the frontmatter title and H1 with Forma `v0.1.0-alpha.13`.
    - Follow-up decision: consider moving the historical record to a versioned path and creating a new `next-internal-release.md`; inventory and update all references before moving the file.

2. **The Alpha 13 release-validation task was closed without complete downloaded-artifact smoke evidence.**
    - Thread: [discussion_r3564155375](https://github.com/choral-io/choral-forma/pull/2#discussion_r3564155375)
    - The downloaded VSIX was installed and activated with the released Forma binary, reached `Forma: Ready`, and returned configuration JSON.
    - The task also requires the exact downloaded artifact to prove workspace discovery, reference navigation, list/table/kanban preview, theme behavior, source access, and Graph deferred state.
    - Required change: run the missing smoke matrix against the exact GitHub Release VSIX. If it cannot be completed immediately or any case fails, restore the validation task to `reviewing` and record the gap without overstating release acceptance.

## Published Artifact Boundary

- Do not move, overwrite, or recreate tag `v0.1.0-alpha.13`.
- Do not replace existing Alpha 13 Release assets.
- Preserve Alpha 13 as historical evidence of what was actually published and validated at the time.
- Behavioral fixes should ship in a new version, provisionally `v0.1.0-alpha.14`, after the maintainer confirms that cutline.

## Remediation Execution Plan

### Phase 1: Re-establish Truth

1. Confirm local `main`, worktree cleanliness, current release metadata, and live review-thread state.
2. Run the downloaded Alpha 13 artifact smoke matrix using:
    - the exact VSIX downloaded from GitHub Release;
    - the released native Forma binary;
    - an isolated VS Code profile and extension directory;
    - ordinary Markdown link, wikilink, fragment, and semantic-reference fixtures;
    - list, table, kanban, theme, source-access, and Graph-deferred checks.
3. Record exact evidence. Do not infer released-package behavior only from source Extension Host tests or a locally packaged candidate VSIX.
4. Decide from evidence whether the Alpha 13 validation task remains `done` or returns to `reviewing`.

### Phase 2: Fix Review Findings

1. Create a focused remediation branch from current `main`.
2. Implement the five PR #1 finding clusters with regression tests.
3. Correct the Alpha 13 release-record title and evidence wording.
4. Decide whether the historical release file should be moved to a versioned path; keep that move separate if reference churn obscures the functional fixes.
5. Run the full local gate before push, including Forma checks, Rust and pnpm checks, extension unit and Extension Host tests, package inspection, and VSIX smoke.
6. Open a Draft PR first. Do not request Copilot review during iterative pushes.

### Phase 3: Review And Release

1. When the remediation PR is stable and local checks pass, mark it Ready.
2. Use Codex or a human review as the default review path.
3. Request one manual Low-effort Copilot review only if the PR remains high-value enough to justify the credits.
4. Fetch review submissions and thread-aware inline comments; do not rely only on `reviewDecision`, mergeability, or CI checks.
5. Address every actionable thread. For deferred feedback, reply with the rationale and a durable follow-up task before resolving the thread.
6. Re-run review on the current HEAD only when fixes materially changed reviewed behavior.
7. Merge only after the review gate and CI both pass.
8. If behavioral fixes are released, use a new version and repeat merged-main CI, tag, Release workflow, downloaded checksums, and exact released-package smoke.

### Phase 4: Close Historical Threads

After fixes and evidence exist:

1. Reply to each PR #1 and PR #2 review thread with the implementing commit, evidence, or explicit disposition.
2. Resolve threads only after the referenced correction is merged or the documented follow-up is accepted.
3. Perform a post-merge sweep for late-arriving automated reviews.

## Process Improvements

### Required Merge Gate

Before every merge, verify all of the following:

- Required CI checks pass on the current HEAD.
- Expected automated or human reviews for the current HEAD have completed, or an explicit unavailability waiver is recorded.
- A thread-aware query reports zero unresolved actionable review threads.
- Outdated threads have been evaluated for current applicability; `isOutdated` is not treated as equivalent to resolved.
- Deferred findings have a reply and durable follow-up task.
- No commits were added after the final review without repeating the gate.

### Repository Implementation Options

Implement the smallest reliable combination:

1. Add a repository command such as `mise run pr:review-ready -- <pr>` that uses GitHub GraphQL review threads and checks:
    - current PR HEAD SHA;
    - required checks;
    - review submissions on the current HEAD;
    - unresolved and outdated review threads;
    - explicit waiver state when an optional reviewer is unavailable.
2. Add a short PR checklist covering CI, current-HEAD reviews, unresolved threads, deferred follow-ups, and final review-gate output.
3. Add the merge-gate requirement to repository Agent guidance and the relevant Forma workspace guideline.
4. Enable GitHub branch protection or ruleset support for required status checks and conversation resolution.
5. Consider a late-review sentinel that records actionable review comments submitted after merge instead of allowing them to disappear silently.

### Copilot Usage Policy

- Automatic GitHub Copilot Code Review is disabled.
- Copilot is an optional second reviewer, not a required single point of failure.
- Request Copilot manually only after a high-value PR is stable.
- Use Low review effort by default.
- Do not enable `Review new pushes` or draft automatic review.
- Target one Copilot review per selected PR and at most one material re-review.
- If Copilot is unavailable due to credits or rate limits, record a waiver and use Codex or human review.
- Already-submitted Copilot comments remain mandatory review inputs even though Copilot itself is optional.

## Suggested Work Breakdown

Keep the implementation reviewable through separate concerns:

1. **Artifact verification and evidence correction**
    - Complete the exact Alpha 13 released-package smoke.
    - Correct release/task truth from evidence.
2. **Runtime and packaging fixes**
    - Address PR #1 code findings with tests.
3. **PR review and merge gate**
    - Add workflow guidance, executable checks, PR checklist, and repository rules where approved.
4. **Remediation release**
    - Publish a new Alpha version only after the maintainer confirms the cutline.

## Acceptance Criteria

This handoff is complete when:

- all nine historical review threads have an evidence-backed response and final disposition;
- the five PR #1 finding clusters are fixed or explicitly rejected with rationale;
- the exact released Alpha 13 VSIX has complete smoke evidence, or the release record clearly states any remaining failure;
- release and task records no longer overclaim validation;
- the published Alpha 13 tag and assets remain immutable;
- the repository has a documented and executable pre-merge review gate;
- late automated review comments cannot be silently missed;
- Copilot review remains manual, selective, and non-blocking when its monthly credits are exhausted.

## Main Conversation Start Prompt

Use this prompt to resume:

> Continue from `knowledge/workspace/tiscs/handoffs/alpha13-pr-review-remediation-and-merge-gate.md`. First perform a read-only freshness check of `main`, the Alpha 13 GitHub Release, PR #1 and PR #2 review threads, and current Forma task/release records. Then present the smallest evidence-backed remediation plan and implementation sequence. Do not move or overwrite the Alpha 13 tag. Treat Copilot review as manual and optional, but treat every existing review comment as required triage input. Ask only for decisions that materially change release cutline or repository rules.

## Response

Superseded as an active handoff. Retained for historical context; PR review workflow work remains deferred.
