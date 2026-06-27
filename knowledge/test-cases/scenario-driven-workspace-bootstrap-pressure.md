---
schemaVersion: 1
kind: test-case
title: Scenario Driven Workspace Bootstrap Pressure
summary: Pressure test that an Agent can translate a human business description into the first minimal Forma workspace slice.
scope: project
type: pressure
status: draft
priority: P0
automation: manual-agent
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agent
    - bootstrap
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Scenario Driven Workspace Bootstrap Pressure

## Purpose

Validate that the docs-backed Agent flow can start from human domain language and produce a small, useful Forma configuration without over-modeling or copying the starter-kit.

## Scenario Prompts

Use these prompts against fresh empty directories after `forma init`. Each prompt should lead to one first slice, not a full taxonomy.

1. Consulting practice:
    > I run a small consulting practice. I want Forma to help me organize client work. I need to keep track of clients, engagements, meeting notes, and decisions. I am not sure what the structure should be yet. Help me build the smallest useful workspace first.
2. Research workspace:
    > I am collecting papers, reading notes, claims, and open questions for a research topic. Help me start a Forma workspace without assuming an academic citation manager.
3. Team runbook:
    > My team wants to organize operational runbooks, incidents, services, and postmortems. Help me create the first useful slice without copying a project-management template.
4. Writing project:
    > I am writing a long-form guide with chapters, source notes, examples, and review comments. Help me model the first content workflow.
5. Product planning:
    > We want to track product decisions, user stories, experiments, and release notes. Help me start with the smallest useful workflow and avoid assuming Forma has built-in tasks.

## Expected Agent Behavior

- Loads `forma-cli-core`, then `workspace.configuration`, `workspace.spaces`, `workspace.schemas`, `workspace.templates`, and `agents.workspace-bootstrap`.
- Asks short clarification questions before editing config.
- Restates one proposed first slice with directory, key fields, and template shape.
- Does not create all requested categories in the first pass.
- Does not treat `tasks`, `members`, `notes`, or `project` as built-in Forma concepts.
- Uses the human's domain terms for the chosen space id and title.
- Adds only the accepted first space, template, and one or two sample entries.
- Runs `forma config inspect --json`, `forma check --json`, `forma list --space <space-id> --json`, and `forma inspect <path> --json`.
- Explains `workspace health` warnings as relationship feedback unless the human expected a connected graph.

## Failure Signals

- Copies `examples/forma-starter-kit` or this repository's `knowledge/` structure without explicit request.
- Creates a broad taxonomy before the first slice is confirmed.
- Uses a top-level `template` field instead of `create.template`.
- Assumes local/private path semantics from directory names.
- Skips verification after changing config.

## Evidence Or Execution Notes

Record the temporary workspace path, the questions asked, the first slice proposed, files written, commands run, and health/check results.
