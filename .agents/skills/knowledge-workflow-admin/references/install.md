# Installation Rules

Use this reference for `knowledge-workflow-admin:init` and `knowledge-workflow-admin:install-skills`.

## Assets

Template assets live in `assets/`.

Render text assets by replacing `{{knowledge_dir}}`, `{{agent_local_dir}}`, `{{canonical_language}}`, and `{{default_group_id}}`. Normalize directory values without trailing slashes before writing the manifest or rendering placeholders.

Asset mapping:

- `knowledge/` path segment -> selected `<knowledge_dir>/`.
- `knowledge/_gitignore` -> `<knowledge_dir>/.gitignore`.
- `knowledge/groups/default-team.md` -> `<knowledge_dir>/groups/<default_group_id>.md`.
- Root asset `AGENTS.md` -> marked root `AGENTS.md` append block.
- `.agents/skills/<skill-name>/SKILL.md.tpl` -> `<agent_skills.dir>/<skill-name>/SKILL.md` when `agent_skills.mode: project`.

Treat asset rendering as an inventory operation:

- Build a complete source-to-target inventory before writing files or reporting the dry run.
- Include required directories even when their asset directories are empty or absent from a packaged skill checkout.
- Render every knowledge and AGENTS asset file individually; do not use wildcard copy commands.
- If `agent_skills.mode` is `project`, copy every support file under asset `.agents/skills/<skill-name>/`, including `agents/` and `references/`.
- Do not leave installed `SKILL.md.tpl` files in project-local workflow skill directories.
- Treat the installed default group document as protected project knowledge, not a managed workflow file.

## Required Knowledge Directories

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

## Required Collaboration Skills

```text
knowledge-assistant
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

All listed collaboration skills must be available to the current Agent or installed into the target repository when project-local skills are selected. `knowledge-workflow-admin` is the manager skill and should remain external to ordinary project-local distributions unless explicitly requested.

## Init Parameters

### Knowledge Directory

Default directory: `knowledge/`.

For `init`, use a user-named directory when present. If no directory is named, ask whether to use `knowledge/` or another repo-relative path. Reject absolute paths, `..`, `.git/`, `.agents/`, source package directories, build outputs, dependency folders, editor caches, and tool caches.

### Canonical Language

Use a user-named BCP 47 language tag such as `en`, `zh-CN`, or `ja-JP`. If no language is named, ask. Do not silently default the language. Record the selected value as `canonical_language`.

### Default Group

Default group id: `default-team`.

Use a user-named default group id when present. If absent, suggest `default-team` and ask whether to use it or provide another lowercase kebab-case id. Reject empty ids, path separators, `..`, leading `.`, or characters outside lowercase letters, digits, and hyphens.

Create `<knowledge_dir>/groups/<default_group_id>.md` from the default group seed only when the file does not already exist.

### Agent Skills

Default mode: reuse externally available workflow skills when the current Agent can load the complete required set.

For `init`, check the required collaboration skills by name. If all are available, recommend `agent_skills.mode: external` and do not install local copies unless requested. If any are missing, recommend project-local installation. If using project mode, use a user-named skills directory or default to `.agents/skills/`.

Reject Agent skills directories that are absolute, contain `..`, target `.git/`, the selected knowledge directory, source package directories, build outputs, dependency folders, editor caches, or tool caches. Record symlink adapter directories only outside the manifest.

### Agent Local Directory

Default Agent local runtime directory: `.agents/.local/`.

Use a user-named Agent local directory when present; otherwise use `.agents/.local/`. Reject absolute paths, `..`, `.git/`, the selected knowledge directory, the selected project-local skills directory, source package directories, build outputs, dependency folders, editor caches, or tool caches.

## Init Workflow

1. Resolve and validate `knowledge_dir`, `agent_skills.mode`, optional `agent_skills.dir`, `agent_local_dir`, `canonical_language`, and `default_group_id`.
2. Precheck the asset tree: root AGENTS block, `knowledge/_gitignore`, required workflow files, and every installable collaboration-skill asset directory with `SKILL.md.tpl`.
3. Build a complete render inventory covering required directories, managed knowledge files, protected default group seed, optional project-local workflow skill files, root AGENTS append block, and manifest file.
4. Build a dry run showing `create`, `mkdir`, `append`, `skip`, and `conflict`.
5. Create required directories separately from file rendering.
6. Never overwrite an existing Kanban board, member profile, member workspace, task item, or business knowledge file.
7. Append the marked knowledge workflow block to root `AGENTS.md`; do not replace existing project engineering instructions.
8. Include the final `### Project-Specific Knowledge Workflow` heading inside the marked block. Ask for project-specific rules only when the user mentions them or wants customization.
9. If root `.gitignore` is missing or does not ignore `<agent_local_dir>/`, propose creating or appending that ignore line as a non-managed edit.
10. After user confirmation, write files and create `<knowledge_dir>/.workflow/manifest.yml`.
11. Validate required directories, workflow files, default group file, root AGENTS block, `<knowledge_dir>/.gitignore`, optional root `.gitignore`, manifest fields, and project-local skills when used.
12. Treat editor settings as optional unmanaged convenience; do not edit `.vscode/settings.json` or `.zed/settings.json` unless explicitly asked.
13. Report created directories, created files, installed skills, skipped/protected paths, conflicts, and validation findings.

## Install Skills Workflow

1. Read root `AGENTS.md` to find the explicit knowledge directory.
2. Read `<knowledge_dir>/.workflow/manifest.yml`.
3. Confirm or set `agent_skills.mode: project` and `agent_skills.dir`.
4. Validate `agent_skills.dir`.
5. Build a dry run from `assets/.agents/skills/` into `<agent_skills.dir>/`.
6. Install `SKILL.md.tpl` assets as `SKILL.md`; copy support files such as `references/` and `agents/`.
7. Do not install or update `knowledge-workflow-admin` itself unless explicitly asked.
8. Update the manifest `agent_skills` section and managed paths after approval.
