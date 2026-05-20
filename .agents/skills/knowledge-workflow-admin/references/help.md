# Knowledge Workflow Manager Help

Use this reference only for maintainer questions about the `knowledge-workflow-admin` manager skill itself. Ordinary team workflow help belongs to `knowledge-assistant`.

## Boundary

`knowledge-workflow-admin` is a maintainer/admin skill. It can initialize the repository knowledge workflow, install or refresh project-local collaboration skills, maintain the workflow manifest, and save approved project-specific workflow policy.

It is not the ordinary distributed help surface for team members. Do not route normal questions about content placement, delivery flow, WORKLIST usage, Kanban state, recovery, or skill choice through this manager skill unless the question is about setup or administration.

## Mode Router

| Maintainer question                         | Mode             | Write behavior                                          |
| ------------------------------------------- | ---------------- | ------------------------------------------------------- |
| "How do I set this workflow up?"            | `help` or `init` | `help` is read-only; `init` writes only after approval. |
| "Initialize this repository."               | `init`           | Dry-run first; write after approval.                    |
| "Install or refresh local workflow skills." | `install-skills` | Dry-run first; write after approval.                    |
| "Explain manager manifest fields."          | `help`           | Read-only.                                              |
| "Change auto-review or project policy."     | `policy`         | Dry-run first; edit root `AGENTS.md` after approval.    |

For ordinary team questions, recommend `knowledge-assistant`.

## Setup Guidance

Before answering setup questions:

1. Read the root `AGENTS.md` Knowledge Workflow block when it exists.
2. Read `<knowledge_dir>/.workflow/manifest.yml` when it exists.
3. If neither exists, give pre-install guidance and ask for required initialization choices:
    - repository-relative `knowledge_dir`;
    - explicit `canonical_language`;
    - `default_group_id`;
    - whether to reuse external collaboration skills or install project-local skills;
    - `agent_local_dir`.

Do not silently choose a canonical language. `knowledge/`, `default-team`, external skills reuse, and `.agents/.local/` are examples or defaults only where the main skill instructions allow them.

## Installed Content Rule

Installed repository `AGENTS.md` and ordinary knowledge documents should not tell regular team members to call this manager skill directly. They may keep workflow block markers and manifest metadata required for upgrades, but normal routing should use `knowledge-assistant` and the ordinary collaboration skills.

When a maintainer operation is needed, describe it as maintainer workflow administration unless the user has explicitly chosen this manager skill.

## Answer Shape

For maintainer help, answer with:

1. the relevant mode;
2. whether the next step is read-only, dry-run-only, or write-capable after approval;
3. required inputs that are missing;
4. files that would be read or changed;
5. the next prompt the maintainer can use.
