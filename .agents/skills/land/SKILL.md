---
name: land
description: >-
    Land explicitly requested changes in the Choral Forma repository. Invoke this skill only when the user has requested Land Changes or explicitly requested that a change be landed; do not invoke it for review, preparation, passing checks, or skill installation alone.
metadata:
    delta-action: land
---

# Land Changes

This skill executes an explicit landing request. The request that invoked this skill is already the permission to land; do not ask whether the user wants the change landed again. Choose the remote workflow by default, or choose the local-only workflow when the user explicitly asks to keep the result local.

## Repository contract

Choral Forma uses `main` as its destination branch and `origin` as the selected source remote. The repository is in Public Preview and its pull-request template says that unsolicited external pull requests are not accepted (`.github/pull_request_template.md:1`). Internal maintainer changes may use a pull request. The repository currently has no branch protection or rulesets, but recheck destination settings at execution time rather than treating that as permanent.

The CI workflow runs on pull requests and pushes to `main` (`.github/workflows/ci.yml:3-8`). Its landing evidence covers Static site, Knowledge, Windows installer, Unix installer, Web, VS Code Extension, Rust, and CLI release-build verification (`.github/workflows/ci.yml:18-48`, `149-172`, `173-193`, `195-245`, `247-317`, `319-359`, and `361-368`). A successful local check is not a substitute for the exact remote `main` CI run.

Do not create release tags, publish a GitHub Release, publish the Marketplace extension, or update release evidence as part of ordinary landing. Release publication has its own exact-candidate and protected-promotion workflow (`knowledge/guidelines/release-execution-and-verification.md:50-80`).

## 1. Establish the landing scope

Recheck the checkout before changing it:

```sh
git status --short --branch
git branch --show-current
git rev-parse HEAD
git remote get-url origin
git worktree list --porcelain
```

These checks protect unrelated local material and worktrees, as required by the repository delivery guidance (`AGENTS.md:51-57`).

Determine the source branch and destination:

- The destination is `main`, unless the user explicitly names another repository destination and that destination is verified as valid.
- If the current branch is `main` and it is ahead of `origin/main`, preserve its existing commits and use the direct-main remote path.
- If the current branch is a topic branch, use the topic-branch PR path for a remote landing.
- If the user explicitly says “local only”, “do not push”, or equivalent, use the local-only path and do not perform any remote mutation.

If the worktree contains changes, classify every path before staging it. Stage only paths within the approved change. Keep repository worktrees, generated caches, browser state, and local workspace material out of commits (`AGENTS.md:51-57`). If the scope of an untracked or modified path is unclear, stop and report it instead of staging broadly.

When approved changes are uncommitted, create the necessary Conventional Commit without opening an interactive editor. Do not squash, reset, or rewrite existing commits merely to make the landing convenient; Conventional Commit format is a repository requirement (`AGENTS.md:51-57`).

Before committing or merging, run:

```sh
git diff --check
git diff --cached --check
```

If the current worktree is dirty with unrelated material, stop until the approved scope can be isolated safely.

## 2. Run proportionate local checks

Use the repository's pinned tools and task definitions. For complete, cross-surface, lockfile, configuration, or otherwise broad changes, run:

```sh
CI=true mise run check
```

The complete check is defined by `mise.toml:78-80`, its component tasks by `mise.toml:4-37`, and the repository verification policy by `AGENTS.md:38-49`. The release guideline also requires the pinned complete gate for a complete candidate (`knowledge/guidelines/release-execution-and-verification.md:52-62`).

For narrowly scoped changes, run the affected tasks from `mise.toml:4-37` and the corresponding workflow gate. For example, a knowledge-only Markdown change uses:

```sh
mise exec -- pnpm exec prettier --check "knowledge/**/*.md"
```

This matches the Knowledge CI gate (`.github/workflows/ci.yml:167-171`). Broaden to `CI=true mise run check` when the change crosses package, Rust, configuration, lockfile, or shared-contract boundaries, or when the affected surface cannot be identified confidently.

A local failure is a landing blocker. Fix it within the approved scope, create a new commit when needed, and rerun the affected checks; do not bypass the failure or reuse stale evidence.

## 3. Recheck remote policy before a remote landing

For a remote landing, verify authentication and the current repository destination settings without exposing credentials:

```sh
gh auth status --hostname github.com
gh repo view choral-io/choral-forma \
  --json defaultBranchRef,mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed
gh api repos/choral-io/choral-forma/rulesets
```

Check branch protection separately with `gh api repos/choral-io/choral-forma/branches/main/protection`. Treat an HTTP 404 with the message `Branch not protected` as the current absence of branch protection; treat authentication errors, permission errors, and all other responses as blockers. An absent protection response is information, not permission to skip the workflow's own checks. If the destination has gained required reviews, required checks, or another protection rule, satisfy it; never bypass it with administrator merge options.

Before pushing, fetch the destination without overwriting local work:

```sh
git fetch origin main
```

If `origin/main` has advanced and the source does not contain it, integrate `origin/main` into the source using a normal merge, then rerun local checks:

```sh
git merge --no-edit origin/main
```

If the source is already local `main`, perform this merge in the `main` worktree. If it is a topic branch, update that topic branch before pushing its PR. Apply the conflict policy in section 7 rather than resolving an ambiguous merge automatically. Do not force-push or rebase shared history.

## 4. Remote landing from local `main`

Use this path when the approved changes are already committed on local `main`. Confirm that the remote destination has not advanced unexpectedly:

```sh
git merge-base --is-ancestor origin/main HEAD
```

If this succeeds, push the exact local `main` history without force:

```sh
git push origin main
```

The push triggers the CI workflow because `main` is a configured push target (`.github/workflows/ci.yml:3-8`). Record the pushed SHA and wait for the CI workflow whose `head_sha` is exactly that SHA. Do not treat an older successful run as evidence for the new commit.

Verify the remote ref before declaring success:

```sh
gh api repos/choral-io/choral-forma/git/ref/heads/main --jq '.object.sha'
```

Then locate and watch the exact push-triggered CI run. The release workflow uses the same exact-source Actions query pattern (`.github/workflows/release.yml:67-85`):

```sh
gh run list --repo choral-io/choral-forma \
  --workflow CI --branch main --limit 20 \
  --json databaseId,headSha,event,status,conclusion,url
gh run watch <run-id> --repo choral-io/choral-forma --exit-status
gh run view <run-id> --repo choral-io/choral-forma \
  --json status,conclusion,jobs,url
```

Use only a run with the expected SHA and the `push` event. Require the run to finish successfully and require every non-skipped job to succeed. If no exact run exists yet, poll for it; a pending, failed, missing, or ambiguous run is not success.

## 5. Remote landing from a topic branch

Use this path when the approved source is not `main`:

1. Push the exact topic branch without force:

    ```sh
    git push --set-upstream origin <topic-branch>
    ```

2. Create or locate one pull request from that branch to `main`. Use the repository's Conventional Commit title and summarize the verified scope and checks in the body; the title and body describe the change only and carry no authorship, attribution, or tooling metadata (`AGENTS.md:51-57`).

    ```sh
    gh pr create --repo choral-io/choral-forma \
      --base main --head <topic-branch> \
      --title "<conventional title>" --body-file <body-file>
    ```

3. Verify that the PR head SHA is the pushed SHA, its base is `main`, and its current merge state is not conflicting:

    ```sh
    gh pr view <pr-number> --repo choral-io/choral-forma \
      --json baseRefName,headRefName,headRefOid,mergeStateStatus,reviewDecision,statusCheckRollup,url
    gh pr checks <pr-number> --repo choral-io/choral-forma --watch --fail-fast
    ```

    Treat required review or check requirements from the current destination settings as mandatory even when the repository currently reports none. Do not invent an approval or treat the absence of a review as proof that every review concern is resolved.

4. Merge only after the PR checks and applicable review requirements pass. Use a merge commit to match the repository's established PR history and preserve the exact expected head:

    ```sh
    gh pr merge <pr-number> --repo choral-io/choral-forma \
      --merge --match-head-commit <head-sha>
    ```

    If the GitHub merge command requests an unmet review, check, or permission, stop. Do not use an administrator override to bypass it. Do not delete the source branch automatically; the repository setting currently keeps merged branches.

5. Read the resulting merge commit from the PR, verify that remote `main` points to that commit, and verify its exact push-triggered CI using the procedure in section 4. The PR's green checks are not a substitute for merged-`main` CI.

## 6. Local-only landing

Use this path only when the user explicitly requested a local-only result. Take a baseline of the remote ref and keep it unchanged:

```sh
remote_main_before="$(git rev-parse origin/main)"
```

If the source is already local `main`, retain its commits and run the local checks from section 2. If the source is a topic branch, operate in the worktree that owns local `main`:

```sh
git switch main
git merge --no-ff --no-edit <topic-branch>
```

Do not remove another worktree to make this switch possible. If `main` is checked out in another worktree or the target worktree is not safe to use, stop and report the path that needs attention.

Resolve only mechanical conflicts whose intended result is clear from the source, destination, and surrounding changes. For an ambiguous conflict, abort the merge and report the conflicting paths and decision needed. After a successful local merge, rerun the applicable local checks and verify:

```sh
git status --short --branch
git merge-base --is-ancestor <source-commit> main
test "$(git rev-parse origin/main)" = "$remote_main_before"
```

The local-only result is complete only when the local target contains the approved source, local checks pass, the worktree is clean, and the remote ref is unchanged. Report explicitly that no push, PR, remote CI, or deployment occurred.

## 7. Conflict and failure handling

The conflict preference for this project is: automatically resolve a conflict when the intended result is unambiguous; pause for the user when it is not. This applies to local merges, destination updates, and PR mergeability.

For a clear conflict:

1. inspect the conflict markers and both sides;
2. preserve unrelated changes and the approved destination semantics;
3. resolve only the affected paths;
4. run `git diff --check`, stage the resolution, and continue the merge;
5. rerun all checks required by the changed scope.

For an ambiguous conflict, failed check, stale head, denied permission, missing exact CI run, or non-fast-forward that cannot be safely integrated:

- stop without force-pushing, discarding work, or claiming success;
- leave recoverable local state intact, or abort a merge when that is the safe way to avoid an unresolved index;
- report the specific blocker and the exact commit or PR state;
- use failure status reporting when running as a subthread.

## 8. Completion report

Report success only after verifying the requested target:

- For remote landing: remote `main` contains the intended commit and its exact CI workflow passed. Include the short commit SHA, verified commit URL, CI run URL, and final remote SHA.
- For local-only landing: local `main` contains the intended commit and local checks passed. Include the short commit SHA and state that remote `main`, PRs, remote CI, and deployment were unchanged.
- For either mode, include unresolved risks or checks not run. Do not call a prepared commit, pushed topic branch, or green PR “landed” before the final target verification.

When `report_subthread_status` is available, report the outcome to the parent subthread. Use `status: "success"` only after the corresponding remote or local completion criteria above are verified. Use `status: "failure"` for a blocked or failed landing, and state that the change was not landed when appropriate. Link only verified commit and CI URLs; never invent them.
