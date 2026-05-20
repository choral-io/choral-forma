---
name: knowledge-workflow-admin
description: Use when a maintainer explicitly needs repository knowledge workflow setup, skill installation, manifest work, or approved policy updates.
disable-model-invocation: true
---

# Knowledge Workflow Admin

Use this maintainer skill to install or administer the knowledge workflow in a target repository during internal testing.

This workflow-manager skill should normally run from an external maintainer copy. It supports fresh init, opt-in project-local skill installation, manifest work, and approved project policy management.

## References

Read only the reference needed for the active mode:

- `references/help.md`: maintainer help for this workflow-manager skill.
- `references/install.md`: assets, render inventory, init, and project-local skill installation rules.
- `references/manifest.md`: manifest fields and managed-file tracking.
- `references/policy.md`: project-specific Agent policy design and AGENTS update workflow.

## Modes

- `help`: explain this maintainer skill's modes, boundaries, and safe next setup step.
- `init`: create a new workflow installation.
- `install-skills`: install or refresh project-local workflow skills from bundled assets.
- `policy`: design, update, or save approved project-specific Agent policy in root `AGENTS.md`.

Infer the mode from the user's request. If ambiguous, state the assumed mode before acting. If the user asks ordinary workflow help, routing, onboarding, or recovery questions, recommend `knowledge-assistant` instead of using this maintainer skill.

## Help Workflow

Use `help` only for questions about this workflow-manager skill itself, such as when to initialize, when to install project-local skills, how the manifest is managed, or how maintainer policy updates should be handled.

1. Read `references/help.md`.
2. If the question concerns an already initialized repository, read root `AGENTS.md` and `<knowledge_dir>/.workflow/manifest.yml` before answering.
3. Give the safest maintainer next step and name whether the operation is read-only, dry-run-only, or write-capable after approval.
4. Route ordinary team workflow usage, content placement, recovery, and skill routing questions to `knowledge-assistant`.

## Ordinary Help Boundary

Use `knowledge-assistant` for ordinary team-facing help, onboarding, skill routing, content placement, read-only policy explanation, and recovery diagnosis.

This skill may answer setup/admin questions needed to run `init`, `install-skills`, or approved `policy` work. It must not become the ordinary distributed help surface for team members.

## Policy Workflow

Use `policy` only when the user explicitly asks to define, update, or save project-specific Agent policy. Read `references/policy.md`, summarize current policy first, produce a dry run scoped to the final `### Project-Specific Knowledge Workflow` subsection, and require approval before writing root `AGENTS.md`.

## Init Workflow

Use `init` only for a maintainer-approved workflow installation. Read `references/install.md`, resolve required parameters, build a dry run, require approval, then write files and validate the completed installation. Do not silently default canonical language.

## Install Skills Workflow

Use `install-skills` when the user asks to install or refresh project-local workflow skills, or when init finds missing required external skills and the user approves project-local installation. Read `references/install.md`; do not install or update `knowledge-workflow-admin` itself unless explicitly asked.

## Guardrails

- Do not copy business drafts, member-specific notes, editor settings, package scripts, or project-specific build commands into the workflow assets.
- Do not record unrelated repository files, dirty worktree artifacts, or untracked project files in the manifest.
- Do not add protected or skipped patterns just because matching project documents currently exist. Add them only when they are part of the workflow policy or the user explicitly configures them.
- Keep `<agent_local_dir>/` local-only. It may hold reusable Agent runtime worktrees and should be ignored by project git configuration.
- Require the installed manifest to record an explicit `canonical_language`; do not infer it from current asset language or local user locale.
- Keep the installed workflow Markdown-first, Foam-compatible, and Obsidian-readable without plugin-only syntax.
- For full installation guardrails, read `references/install.md`.
