---
schemaVersion: 1
kind: test-case
title: Starter Shared Profile Selection Contract
summary: Verify that committed starter shared profiles are reusable fragments selected only by local personal configuration.
scope: starter-kit
type: contract
status: draft
priority: P1
automation: manual-cli
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - profiles
    - local-overrides
    - contract
covers_user_stories: []
covers_product:
    - "product/choral-forma"
related_tasks: []
---

# Starter Shared Profile Selection Contract

## Purpose

Validate the starter example for future shared profiles: profiles are committed configuration fragments selected by workspace-relative path, but Forma should not infer profile selection from members, groups, users, Agents, Git identity, or runtime values.

## Preconditions

- The starter config and health contracts pass.
- The starter includes committed shared profile examples under `.forma/profiles/`.
- `.forma/local/` remains local-only and ignored.

## Test Data

- Workspace: `examples/forma-starter-kit`
- Shared profile examples:
    - `.forma/profiles/reviewer.md`
    - `.forma/profiles/evidence-review.md`
- Local selection example:

```yml
schemaVersion: 1

profiles:
    use:
        - ".forma/profiles/reviewer.md"
```

## Steps

1. Inspect the committed shared profile files.
2. Confirm each profile is referenced by workspace-relative path and does not reference members, groups, users, Agents, or other identity spaces as the selection mechanism.
3. Confirm the starter documentation says profiles are not loaded automatically.
4. In a temporary copy of the starter, create an included local file such as `.forma/local/profile.yml` with `profiles.use`.
5. Confirm the intended merge order is shared workspace config, selected shared profiles in declaration order, local personal overrides, then runtime values.
6. Confirm current Forma checks still pass even though profile loading is only an evaluation example.

## Expected Results

- Shared profiles are committed and reviewable, but inert until selected by local personal configuration.
- Profile selection is explicit and local.
- Profile selection uses workspace-relative paths rather than implicit profile ids.
- The starter does not imply a built-in `member`, `group`, `user`, or Agent identity model for profile loading.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Shared profile examples.
- Local-only profile selection.
- Config merge model.
- Separation between product framework concepts and workspace-defined knowledge spaces.

## Evidence Or Execution Notes

Record profile paths, local selection content, and check output from the temporary copy.

## Open Questions

- Should `profiles.use` be implemented as a first-class config merge feature before or after writable Forma operations?
