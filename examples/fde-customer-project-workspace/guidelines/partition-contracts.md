---
scope: workspace
title: Customer Workspace Partition Contracts
summary: Routing, field, evidence, and approval rules for each team-defined customer-project partition.
type: guideline
status: active
synthetic: "true"
engagementKey: ENG-SYN-001
tags:
    - fde
    - partition-contracts
    - synthetic
skill:
    id: customer-partition-contracts
    title: Customer Workspace Partition Contracts
    description: Route each new record to the configured partition and preserve its local evidence boundary.
    projection: section
    order: 5
relatedTo:
    - overview/engagement-map
---

## Agent Skill

Read this contract before routing a new record. The directory names are team conventions; the configured Forma content group supplies the schema, create template, and local guideline visible to an Agent.

| Partition | Use for | Required contract | Do not use for |
| --- | --- | --- | --- |
| `overview/` | One engagement map and orientation record | `type: overview`, engagement key, local references | Customer facts, decisions, or test evidence |
| `customers/` | Stable synthetic customer facts | Customer key and environment | External message bodies or credentials |
| `communications/` | Indexes for external records | Source id and source kind | Copying the original communication |
| `asks/` | Confirmed requested outcomes | Customer key and source references | Issue diagnosis or approval |
| `issues/` | Observed mismatch or risk | Customer, environment, and evidence references | Candidate solutions |
| `proposals/` | Candidate solutions and trade-offs | Evidence references; not final approval | Human-confirmed decisions |
| `decisions/` | Human-confirmed choices and limits | Evidence references and decision status | Unreviewed proposals |
| `tasks/` | Executable work items | Status and local justification references | Hidden project-management state |
| `runbooks/` | Repeatable investigation steps | Source and local context references | Permission to act externally |
| `guidelines/` | Agent instructions and boundaries | Guideline metadata and related context | Customer facts or delivery evidence |
| `engineering/` | Markdown context cards for code/config/tests | Engineering metadata and fixture references when applicable | The actual `.mjs`/`.json` fixture assets |
| `verifications/` | Reproducible command evidence | Result, exit status, expected output, and failure conditions | Production publication claims |

Route a new record through the partition table, preserve workspace-local evidence, and stop for human approval before external or production action.

## Agent routing

1. Read this contract and the workspace operations guideline before creating or editing a record.
2. Choose the partition whose contract matches the record's purpose, then use that content group's schema and template.
3. Keep references workspace-local. `ENG-SYN-001` is only a narrative key and never an authorization, path, join, synchronization, or promotion mechanism.
4. Treat proposals, tasks, runbooks, and engineering cards as preparation or context. Human confirmation remains required for decisions, external communication, and production changes.
5. Use `verifications/` for command evidence and keep the executable fixture under `engineering/fixture/` as ordinary unmanaged engineering assets.

<!-- forma:content -->
