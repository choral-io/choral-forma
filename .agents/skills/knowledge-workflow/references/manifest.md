# Manifest

The target repository stores installation state at:

```text
<knowledge_dir>/.workflow/manifest.yml
```

## Required Fields

```yaml
template_id: knowledge-workflow
template_version: 1
manifest_version: 1
knowledge_dir: <knowledge_dir>
agent_local_dir: <agent_local_dir>
canonical_language: "<bcp47>"
default_group_id: default-team
agent_skills:
    mode: external # or project
    required: []
installed_at: "<iso8601>"
updated_at: "<iso8601>"
append_blocks: []
managed:
    version: 1
    paths: []
protected: []
local_overrides: []
skipped_patterns: []
```

`knowledge_dir`, `agent_skills.mode`, `agent_local_dir`, and `canonical_language` are stable installation keys after manifest creation.
`default_group_id` records the default responsibility group id. It must resolve to `<knowledge_dir>/groups/<default_group_id>.md`.
`agent_skills.required` records the collaboration skill names this installation expects. `agent_skills.dir` appears only when `agent_skills.mode` is `project`.

## Managed Files

Use grouped strategy sections, not one record per file:

```yaml
template_id: knowledge-workflow
template_version: 1
manifest_version: 1
knowledge_dir: <knowledge_dir>
agent_local_dir: <agent_local_dir>
canonical_language: "<bcp47>"
default_group_id: default-team
agent_skills:
    mode: project
    dir: <agent_skills.dir>
    required:
        - knowledge-intake
        - knowledge-capture
        - knowledge-schema-audit
        - task-metadata-audit
        - knowledge-status-report
        - workspace-worklist
        - delivery-planning
        - next-task-selection
        - kanban-maintenance
        - delivery-implementation
        - delivery-review
installed_at: "<iso8601>"
updated_at: "<iso8601>"

append_blocks:
    - path: AGENTS.md
      block: knowledge-workflow
      version: 1

managed:
    version: 1
    paths:
        - <knowledge_dir>/.gitignore
        - <knowledge_dir>/README.md
        - <knowledge_dir>/groups/templates/group.md.tpl
        - <knowledge_dir>/members/templates/member.md.tpl
        - <knowledge_dir>/planning/WORKFLOW.md
        - <knowledge_dir>/schemas/README.md
        - <knowledge_dir>/schemas/architecture.md
        - <knowledge_dir>/schemas/common.md
        - <knowledge_dir>/schemas/concepts.md
        - <knowledge_dir>/schemas/decisions.md
        - <knowledge_dir>/schemas/design.md
        - <knowledge_dir>/schemas/discovery.md
        - <knowledge_dir>/schemas/groups.md
        - <knowledge_dir>/schemas/guidelines.md
        - <knowledge_dir>/schemas/members.md
        - <knowledge_dir>/schemas/planning.md
        - <knowledge_dir>/schemas/product.md
        - <knowledge_dir>/schemas/proposals.md
        - <knowledge_dir>/schemas/sprints.md
        - <knowledge_dir>/schemas/tasks.md
        - <knowledge_dir>/schemas/workspace.md
        - <knowledge_dir>/proposals/templates/proposal.md.tpl
        - <knowledge_dir>/tasks/WORKFLOW.md
        - <knowledge_dir>/workspace/templates/worklist.md.tpl
        - <knowledge_dir>/workspace/templates/handoff.md.tpl
        - <knowledge_dir>/tasks/templates/task-item.md.tpl
        - <agent_skills.dir>/delivery-planning/**
        - <agent_skills.dir>/delivery-review/**
        - <agent_skills.dir>/delivery-implementation/**
        - <agent_skills.dir>/kanban-maintenance/**
        - <agent_skills.dir>/knowledge-capture/**
        - <agent_skills.dir>/knowledge-schema-audit/**
        - <agent_skills.dir>/knowledge-intake/**
        - <agent_skills.dir>/knowledge-status-report/**
        - <agent_skills.dir>/next-task-selection/**
        - <agent_skills.dir>/task-metadata-audit/**
        - <agent_skills.dir>/workspace-worklist/**

protected:
    - <knowledge_dir>/planning/KANBAN.md
    - path: <knowledge_dir>/planning/**
      except:
          - <knowledge_dir>/planning/WORKFLOW.md
    - path: <knowledge_dir>/tasks/**
      except:
          - <knowledge_dir>/tasks/WORKFLOW.md
          - <knowledge_dir>/tasks/templates/task-item.md.tpl
    - path: <knowledge_dir>/workspace/**
      except:
          - <knowledge_dir>/workspace/templates/worklist.md.tpl
          - <knowledge_dir>/workspace/templates/handoff.md.tpl
    - <knowledge_dir>/workspace/*/local/**
    - path: <knowledge_dir>/members/**
      except:
          - <knowledge_dir>/members/templates/member.md.tpl
    - path: <knowledge_dir>/groups/**
      except:
          - <knowledge_dir>/groups/templates/group.md.tpl
    - path: <knowledge_dir>/proposals/**
      except:
          - <knowledge_dir>/proposals/templates/proposal.md.tpl
    - <knowledge_dir>/discovery/**
    - <knowledge_dir>/product/**
    - <knowledge_dir>/design/**
    - <knowledge_dir>/architecture/**
    - <knowledge_dir>/concepts/**
    - <knowledge_dir>/decisions/**
    - <knowledge_dir>/guidelines/**

local_overrides: []
skipped_patterns: []
```

Use rendered target paths, not placeholder paths, in the manifest. Render `<agent_skills.dir>` in managed skill paths only when `agent_skills.mode` is `project`; external skills are required capabilities but not managed project files. Render `<agent_local_dir>` to the selected local-only Agent runtime directory. `canonical_language` records the explicit BCP 47 language tag for canonical knowledge files. `default_group_id` records the group id used for default responsibility group ownership. Symlink adapter directories for other agent programs are outside manifest management.

Asset `knowledge/_gitignore` renders to target `<knowledge_dir>/.gitignore`; the manifest records the rendered target path.
Asset `knowledge/groups/default-team.md` renders to target `<knowledge_dir>/groups/<default_group_id>.md`; the manifest records `<knowledge_dir>/groups/**` as protected, not managed.

`skipped_patterns` is only for workflow-scope paths that the workflow deliberately excludes during init. Do not use it to record arbitrary unrelated repository files, untracked artifacts, editor scratch files, build outputs, or project files outside the selected knowledge workflow surface.

Existing product notes, scratch files, or task items should not create new manifest patterns unless the pattern is part of the workflow policy or the user explicitly asks for it.

Recommended strategies:

- `managed`: owned by the workflow; create from rendered assets during init after dry-run confirmation.
- `append_block`: only a marked block may be inserted or updated.
- `protected`: never replace from workflow assets during init.
- `local-override`: user-owned local version; skip unless the user explicitly asks for a manual merge.

## Fresh Init Values

Fresh init writes these baseline manifest values:

```yaml
template_version: 1
manifest_version: 1
knowledge_dir: <knowledge_dir>
agent_local_dir: <agent_local_dir>
canonical_language: "<bcp47>"
default_group_id: default-team
agent_skills:
    mode: external
    required:
        - knowledge-intake
        - knowledge-capture
        - knowledge-schema-audit
        - task-metadata-audit
        - knowledge-status-report
        - workspace-worklist
        - delivery-planning
        - next-task-selection
        - kanban-maintenance
        - delivery-implementation
        - delivery-review
append_blocks:
    knowledge-workflow: 1
managed:
    version: 1
```

## Marked AGENTS Block

Root `AGENTS.md` must be handled as `append_block`. Only this marked block is managed:

```text
<!-- knowledge-workflow:start -->
...
<!-- knowledge-workflow:end -->
```

Never modify text outside this block.
