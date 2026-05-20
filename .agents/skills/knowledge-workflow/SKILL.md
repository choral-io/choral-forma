---
name: knowledge-workflow
description: Install, explain, or manage repository knowledge workflow policy. Use for setup, manifest assets, workflow help, onboarding, and project-specific agent policy.
---

# Knowledge Workflow

Use this skill to explain or install the knowledge workflow in a target repository during internal testing.

This workflow-manager skill may run from an external maintainer copy or from a project-local installed copy. It installs knowledge structure and AGENTS guidance, and it can install project-local copies of the collaboration skills used by the workflow when needed. This internal-test workflow supports fresh init, help, opt-in project-local skill installation, and opt-in project policy management.

## Assets

Template assets live in `assets/`.

Render knowledge and root AGENTS text assets by replacing `{{knowledge_dir}}` with the selected repository-relative knowledge directory, `{{agent_local_dir}}` with the selected repository-relative Agent local runtime directory, `{{canonical_language}}` with the selected BCP 47 canonical knowledge language, and `{{default_group_id}}` with the selected `default_group_id` value. Normalize directory values without trailing slashes before writing them to the manifest or rendering placeholders. When copying files from the asset tree, map the asset path segment `knowledge/` to the rendered knowledge directory. Render asset `knowledge/_gitignore` to target `<knowledge_dir>/.gitignore`. Render asset `knowledge/groups/default-team.md` to target `<knowledge_dir>/groups/<default_group_id>.md`.

Workflow skill assets under `assets/.agents/skills/` are portable runtime-discovery skills. They must not bake in project-specific paths. Install them only when the selected `agent_skills.mode` is `project`; when installing, copy every support file and install files named `SKILL.md.tpl` as `SKILL.md`.

Treat asset rendering as an inventory operation, not a shell glob copy:

- Build a complete source-to-target inventory before writing files or reporting the dry run.
- Include directories from the required directory set below, even when the corresponding asset directories are empty or absent from a packaged skill checkout.
- Render every knowledge and AGENTS asset file individually; do not use copy commands that rely on non-empty wildcard matches.
- If `agent_skills.mode` is `project`, copy every file under asset `.agents/skills/<skill-name>/` into `<agent_skills.dir>/<skill-name>/`, including `agents/`, `references/`, and other support files.
- If `agent_skills.mode` is `project`, install each asset `.agents/skills/<skill-name>/SKILL.md.tpl` as `<agent_skills.dir>/<skill-name>/SKILL.md`.
- Do not leave `SKILL.md.tpl` files in installed project-local workflow skill directories.
- Install asset `knowledge/_gitignore` as `<knowledge_dir>/.gitignore`.
- Install asset `knowledge/groups/default-team.md` as `<knowledge_dir>/groups/<default_group_id>.md` during init only. Treat the installed group document as protected project knowledge, not a managed workflow file.
- Treat asset root `AGENTS.md` as the marked root `AGENTS.md` append block, not as a full-file overwrite.

Required knowledge directories for init:

```text
<knowledge_dir>/
<knowledge_dir>/architecture/
<knowledge_dir>/assets/
<knowledge_dir>/assets/design/
<knowledge_dir>/concepts/
<knowledge_dir>/decisions/
<knowledge_dir>/design/
<knowledge_dir>/discovery/
<knowledge_dir>/guidelines/
<knowledge_dir>/groups/
<knowledge_dir>/groups/templates/
<knowledge_dir>/members/
<knowledge_dir>/members/templates/
<knowledge_dir>/planning/
<knowledge_dir>/planning/sprints/
<knowledge_dir>/product/
<knowledge_dir>/proposals/
<knowledge_dir>/proposals/templates/
<knowledge_dir>/schemas/
<knowledge_dir>/tasks/
<knowledge_dir>/tasks/items/
<knowledge_dir>/tasks/templates/
<knowledge_dir>/workspace/
<knowledge_dir>/workspace/templates/
```

Required collaboration skills:

```text
delivery-implementation
delivery-planning
delivery-review
kanban-maintenance
knowledge-capture
knowledge-intake
knowledge-schema-audit
knowledge-status-report
next-task-selection
task-metadata-audit
workspace-worklist
```

All listed collaboration skills must be available to the current Agent. `knowledge-workflow` itself is the manager skill and may remain external to the target repository unless the user explicitly asks to install a project-local manager copy.

Read these references only when needed:

- `references/manifest.md`: manifest fields and managed-file tracking.
- `references/help.md`: help mode inputs, output format, and boundaries.
- `references/policy.md`: project-specific Agent policy design and AGENTS update workflow.

## Modes

- `init`: create a new workflow installation.
- `install-skills`: install or refresh project-local workflow skills from bundled assets.
- `help`: answer workflow usage questions and recommend the right next process step without modifying files.
- `policy`: explain, audit, design, update, or save project-specific Agent policy in root `AGENTS.md`.

Infer the mode from the user's request. If ambiguous, state the assumed mode before acting. If the user asks to change an existing installation, keep the response in help mode and recommend a fresh test install unless they explicitly ask for manual cleanup guidance.

## Help Workflow

Use `help` when the user asks how to use the knowledge workflow, requests an onboarding guide or training overview, asks where to put information, which skill to use, how to move from idea to task or task to delivery, how personal workspace material should be handled, how scope conflicts should be resolved, how run-loop failures should recover, whether a handoff needs a shared file, or how to recover the next workflow step.

1. Read `references/help.md`.
2. Read the root `AGENTS.md` Knowledge Workflow block to find the explicit knowledge directory, then read `<knowledge_dir>/.workflow/manifest.yml`.
3. If no manifest exists, use pre-install help: explain that the workflow is not installed, describe recommended defaults without claiming they exist, and route action to `init`.
4. Read the knowledge workflow block in root `AGENTS.md` when present.
5. Read only the relevant installed docs for the question, such as `<knowledge_dir>/README.md`, `<knowledge_dir>/schemas/*.md`, `<knowledge_dir>/tasks/WORKFLOW.md`, or `<knowledge_dir>/planning/WORKFLOW.md`.
6. Check whether the recommended required skill is available to the current Agent. If `agent_skills.mode` is `project`, the project-local copy should exist under `agent_skills.dir`.
7. Give a concrete recommendation, examples, and a suggested next prompt.
8. Do not write files, change Kanban, edit WORKLIST, or create tasks in help mode unless the user explicitly asks to switch modes and perform that action.

If the user asks to use `auto-review` and the project-specific execution policy is missing or partial, do not configure it silently. Explain that `auto-review` can run conservatively without a stable project policy, then offer `policy auto-review` as the path for teams that want repeatable automation.

## Policy Workflow

Use `policy` when the user asks what project policy says, how a policy applies, or whether a policy exists. Also use it when the user explicitly asks to define, update, audit, or save project-specific Agent policy, or when another workflow discovers missing project policy and the user chooses to configure it.

1. Read `references/policy.md`.
2. Read the root `AGENTS.md` Knowledge Workflow block to find the explicit knowledge directory, then read `<knowledge_dir>/.workflow/manifest.yml`; if either is missing, route to `init` first.
3. Read the marked Knowledge Workflow block in root `AGENTS.md`.
4. Identify the policy topic, such as `auto-review`, approval gates, protected surfaces, validation baseline, Kanban automation, git/worktree automation, source stability, or parallel/subagent execution.
5. If the user asks a question or requests an audit, explain the current policy and gaps without editing.
6. If the user asks to define, update, or save policy, summarize existing policy first and ask only for decisions that cannot be inferred safely from existing project instructions or the current prompt.
7. For writes, produce a `Policy Dry Run` that edits only the final `### Project-Specific Knowledge Workflow` subsection inside the marked block.
8. Require user approval before writing root `AGENTS.md`.
9. After writing, report the saved policy summary and the remaining cases that still require explicit confirmation.

## Knowledge Directory

Default directory: `knowledge/`.

For `init`:

1. Use a directory explicitly named by the user, such as `knowledge/` or `docs/knowledge/`.
2. If no directory is named, ask whether to use `knowledge/` or another repo-relative path.
3. Validate the directory before rendering.

Reject directories that are absolute paths, contain `..`, or target `.git/`, `.agents/`, source package directories, build outputs, dependency folders, editor caches, or tool caches.

## Canonical Language

For `init`:

1. Use a canonical knowledge language explicitly named by the user, such as `en`, `zh-CN`, or `ja-JP`.
2. If no language is named, ask which BCP 47 language tag to use for canonical knowledge files.
3. Do not assume or silently default the language in the manifest.
4. Record the selected language as `canonical_language` in the manifest.

## Default Group

Default group id: `default-team`.

For `init`:

1. Use a default group id explicitly named by the user, such as `default-team`, `core-team`, or `maintainers-team`.
2. If no default group id is named, suggest `default-team` and ask whether to use it or provide another lowercase kebab-case group id.
3. Validate the default group id before rendering.
4. Record the selected id as `default_group_id` in the manifest.
5. Create `<knowledge_dir>/groups/<default_group_id>.md` from the default group seed only when that file does not already exist.

Reject default group ids that are empty, contain path separators, contain `..`, start with `.`, or contain characters outside lowercase letters, digits, and hyphens.

## Agent Skills

Default mode: reuse externally available workflow skills when the current Agent can load the complete required set.

For `init`:

1. Check whether the current Agent can load every required collaboration skill by name.
2. If all required skills are available, recommend `agent_skills.mode: external` and do not install project-local skill copies unless the user asks for them.
3. If any required skill is missing, recommend installing project-local workflow skills.
4. If the user explicitly asks for project-local skills, use `agent_skills.mode: project`.
5. If using project mode, use an Agent skills directory explicitly named by the user or default to `.agents/skills/`.
6. Validate the directory before writing project-local skills.

Reject Agent skills directories that are absolute paths, contain `..`, target `.git/`, the selected knowledge directory, source package directories, build outputs, dependency folders, editor caches, or tool caches. Treat `agent_skills.dir` as the canonical actual project-local skills installation directory only when `agent_skills.mode` is `project`; do not record symlink adapter directories for other agent programs in the manifest.

## Agent Local Directory

Default Agent local runtime directory: `.agents/.local/`.

For `init`:

1. Use an Agent local directory explicitly named by the user, such as `.agents/.local/` or `.codex/.local/`.
2. If no Agent local directory is named, use `.agents/.local/`.
3. Validate the directory before rendering.

Reject Agent local directories that are absolute paths, contain `..`, target `.git/`, the selected knowledge directory, the selected project-local `agent_skills.dir`, source package directories, build outputs, dependency folders, editor caches, or tool caches. Treat `agent_local_dir` as local-only Agent runtime state. It may hold reusable Agent runtime worktrees and must be ignored by project git configuration.

## Init Workflow

1. Resolve and validate `knowledge_dir`, `agent_skills.mode`, optional project-local `agent_skills.dir`, `agent_local_dir`, `canonical_language`, and `default_group_id`.
2. Precheck the asset tree: verify the root AGENTS block asset, `knowledge/_gitignore`, required workflow files, and every installable collaboration-skill asset directory with `SKILL.md.tpl` are present.
3. Build a complete render inventory covering required directories, managed knowledge files, the protected default group seed, optional project-local workflow skill files, the root AGENTS append block, and the manifest state file.
4. Build a dry run showing `create`, `mkdir`, `append`, `skip`, and `conflict`.
5. Create required directories separately from file rendering so empty knowledge areas such as `architecture/`, `concepts/`, `decisions/`, `design/`, `discovery/`, and `guidelines/` are created without relying on wildcard file matches.
6. Render files using the asset mapping rules: `knowledge/_gitignore` becomes `<knowledge_dir>/.gitignore`; when `agent_skills.mode` is `project`, skill `SKILL.md.tpl` files become installed `SKILL.md` files under `<agent_skills.dir>`.
7. Never overwrite an existing Kanban board, member profile, member workspace, task item, or business knowledge file.
8. Append a marked knowledge workflow block to root `AGENTS.md`; do not replace existing project engineering instructions.
9. Include the final `### Project-Specific Knowledge Workflow` heading inside the marked `AGENTS.md` block. Ask for project-specific rules only when the user has mentioned them or wants to customize the workflow during init. This is a protected local subsection, not a managed subsection.
10. If root `.gitignore` is missing or does not ignore `<agent_local_dir>/`, propose creating or appending that ignore line as a non-managed local project edit.
11. After user confirmation, write files and create `<knowledge_dir>/.workflow/manifest.yml`.
12. Validate the completed init before reporting success: required knowledge directories exist, required workflow files exist, `<knowledge_dir>/groups/<default_group_id>.md` exists, root `AGENTS.md` contains the marked block, `<knowledge_dir>/.gitignore` exists, root `.gitignore` ignores `<agent_local_dir>/` when that edit was approved, and `<knowledge_dir>/.workflow/manifest.yml` records `knowledge_dir`, `agent_skills`, `agent_local_dir`, `canonical_language`, and `default_group_id`. When `agent_skills.mode` is `project`, every installable collaboration skill must have `<agent_skills.dir>/<skill-name>/SKILL.md`, with no installed `SKILL.md.tpl` left behind; `knowledge-workflow` itself may be external unless explicitly installed.
13. Treat editor settings as optional, unmanaged project convenience; do not edit project editor settings such as `.vscode/settings.json` or `.zed/settings.json` unless the user explicitly asks.
14. Record `knowledge_dir`, `agent_skills`, `agent_local_dir`, `canonical_language`, `default_group_id`, `append_blocks`, managed, protected, `local_overrides`, and `skipped_patterns` state in the manifest.
15. Report init results with created directories, created files, installed skills, skipped/protected paths, conflicts, and validation findings. If validation fails, report the failure and do not claim the workflow is initialized.

## Install Skills Workflow

Use `install-skills` when the user asks to install or refresh project-local workflow skills, or when init finds missing required external skills and the user approves project-local installation.

1. Read root `AGENTS.md` to find the explicit knowledge directory.
2. Read `<knowledge_dir>/.workflow/manifest.yml`.
3. Confirm or set `agent_skills.mode: project` and `agent_skills.dir`.
4. Validate `agent_skills.dir` with the Agent Skills rules above.
5. Build a dry run of collaboration-skill files copied from `assets/.agents/skills/` into `<agent_skills.dir>/`.
6. Install `SKILL.md.tpl` assets as `SKILL.md`; copy support files such as `references/` and `agents/`.
7. Do not install or update `knowledge-workflow` itself unless the user explicitly asks for a project-local manager copy.
8. Update the manifest `agent_skills` section and managed paths after approval.

## Guardrails

- Do not copy business drafts, member-specific notes, editor settings, package scripts, or project-specific build commands into the workflow assets.
- Do not record unrelated repository files, dirty worktree artifacts, or untracked project files in the manifest.
- Do not add protected or skipped patterns just because matching project documents currently exist. Add them only when they are part of the workflow policy or the user explicitly configures them.
- Do not assume project facts are Markdown-only; protected knowledge areas may contain Markdown, images, exports, data files, or other supporting artifacts.
- Do not define installed workflow assets as depending on a specific language runtime, package manager, shell, or script file.
- Do not define optional external process skills, including Superpowers skills, as required workflow dependencies, managed assets, or manifest state.
- During concrete init or help work, the Agent may detect and use tools already available in the target project or environment.
- If reusable workflow documentation needs a script example, provide both Bash and PowerShell versions and mark them as optional examples, not requirements.
- Use or recommend whatever Markdown formatter/checker is already available in the target project for supported Markdown knowledge text files (`<knowledge_dir>/**/*.md`, `<knowledge_dir>/**/*.mdx`) and supported Markdown templates (`<knowledge_dir>/**/*.md.tpl`, `<knowledge_dir>/**/*.mdx.tpl`).
- Treat editor settings such as `.vscode/settings.json` or `.zed/settings.json` as optional local project convenience, not managed workflow assets.
- Keep `<agent_local_dir>/` local-only. It may hold reusable Agent runtime worktrees and should be ignored by project git configuration.
- Use `git config user.name` as the default current member id in installed documentation and skills.
- Require the installed manifest to record an explicit `canonical_language`; do not infer it from current asset language or local user locale.
- Keep the installed workflow Markdown-first, Foam-compatible, and Obsidian-readable without plugin-only syntax.
- Treat `<knowledge_dir>/.workflow/manifest.yml` as workflow state created by init.
