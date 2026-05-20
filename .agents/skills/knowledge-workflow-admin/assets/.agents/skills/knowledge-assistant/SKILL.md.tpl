---
name: knowledge-assistant
description: Use when a user asks how to use a repository knowledge workflow, where content belongs, which skill applies, what policy means, or how to recover safely.
---

# Knowledge Assistant

## Runtime Context

Before acting, use the repository Knowledge Workflow runtime context from root `AGENTS.md` and its manifest; do not assume workflow paths or default ids.

Use this skill as the ordinary team-facing entry point for understanding and navigating the repository knowledge workflow.

## Scope

Use this skill for:

- workflow help, onboarding, and examples;
- choosing which workflow skill owns a request;
- deciding where information should live;
- diagnosing stuck, obsolete, failed, or unclear workflow state;
- explaining project-specific workflow policy read-only;
- recommending the next prompt or handoff path.

This skill is strictly read-only. It must not write files, install skills, change root `AGENTS.md`, edit the manifest, mutate Kanban, edit WORKLIST, create tasks, or change project facts.

If the user explicitly asks this skill to perform a write or state-changing operation, do not perform it. Explain the boundary and, when the requested action is clear, provide a concrete prompt the user can manually give to the owning write-capable skill.

## Workflow

1. Read `references/help.md`.
2. Read the marked Knowledge Workflow block in root `AGENTS.md`.
3. Extract the explicit knowledge directory, then read `<knowledge_dir>/.workflow/manifest.yml` when it exists.
4. If the block or manifest is missing, give pre-install or repair guidance only; do not guess workflow paths as facts.
5. Read only the installed docs needed for the question.
6. If the question is member-scoped, determine the current member id with `git config user.name`; read member or local preference files only when they matter.
7. Infer the user's likely workflow intent from the current question and repository context.
8. Give one recommended path, the reason, and unsafe actions to avoid. Add a concrete next prompt only when the user's intent and execution direction are clear enough to make it useful.

## Policy Boundary

This skill may explain or audit project-specific workflow policy from root `AGENTS.md` read-only.

If policy is missing, partial, or needs to be saved, ask a maintainer to run the maintainer-run repository knowledge maintenance process. Do not produce or apply policy writes unless the user explicitly switches to a maintainer workflow skill that has write authority.

## Guardrails

- Prefer routing to the owning workflow skill over answering with broad generic advice.
- Report source conflicts instead of silently choosing one.
- Do not treat proposals, local notes, loose task items, or localized files as accepted project facts.
- Do not bypass approval gates by suggesting direct edits from help output.
- Do not continue into the recommended write-capable skill inside the same invocation; stop after giving the suggested prompt.
- Do not let prompt-level policy weaken baseline safety, privacy, local-only, ownership, approval, or review rules.

## References

- Help, router, placement, recovery, and examples: `references/help.md`
