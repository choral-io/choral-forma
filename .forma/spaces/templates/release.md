---
schemaVersion: 1
kind: release
title: "{{ input.title }}"
summary: "{{ input.summary }}"
scope: project
type: release
status: planned
version: ""
date:
owners: []
tags:
    - release
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# {{ input.title }}

## Scope

## Included Changes

## Validation

## Rollout Plan

## Migration Or Operations Notes

## Release Notes

## Rollback Plan

## Post-Release Follow-Up

- Add this released record to [[planning/forma-release-and-delivery-ledger]], then run `mise run release:record-check -- v<version>` before committing the post-release evidence.
