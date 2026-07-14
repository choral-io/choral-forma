---
schemaVersion: 1
scope: project
type: task
title: Refine Zed Link Navigation And Highlighting
summary: Restrict Forma LSP work to managed documents, refine reference source spans and navigation ownership, and align Zed wikilink highlighting with editor themes.
priority: P1
value: H
module: app
effort: L
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - zed
    - lsp
    - navigation
    - highlighting
    - performance
blockedBy: []
relatedTo:
    - "planning/forma-link-navigation-and-highlighting-refinement-plan"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "discovery/forma-lsp-zed-navigation-validation-2026-07-13"
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/validate-zed-link-navigation"
    - "tasks/implement-zed-extension-mvp"
    - "tasks/generalize-taxonomy-neutral-page-model"
severity:
sprint:
reportedBy:
affectedArea: Forma Core reference spans, Forma LSP managed-document lifecycle, and Zed navigation and semantic highlighting
---

# Refine Zed Link Navigation And Highlighting

## Goal

Execute [[planning/forma-link-navigation-and-highlighting-refinement-plan]] as a bounded Zed and editor-neutral LSP refinement. Make Forma-specific links navigate consistently, keep ordinary Markdown editor-owned, align wikilink syntax with active themes, and eliminate Forma language work for unmanaged Markdown documents.

## Sources

- [[planning/forma-link-navigation-and-highlighting-refinement-plan]]
- [[planning/forma-lsp-zed-navigation-execution-plan]]
- [[discovery/forma-lsp-zed-navigation-validation-2026-07-13]]
- [[tasks/implement-forma-lsp-foundation]]
- [[tasks/validate-zed-link-navigation]]

## In Scope

- Capture focused regressions for wikilink aliases, heading fragments, embeds, semantic-token ranges, and unmanaged Markdown activity.
- Add a Core-owned managed-document classification for Pages matched by any effective taxonomy term `include`, configured View sources, control files, and unmanaged files.
- Apply the confirmed save-only configuration invalidation boundary and reclassify open documents after effective configuration changes.
- Gate LSP overlays, analysis, requests, and snapshot rebuilds by managed scope.
- Preserve complete syntax, target, label, and fragment source spans in Core.
- Keep plain Markdown links native, add only the bounded managed heading-fragment fallback needed by Zed, and make Forma wikilink paths and labels navigate to the same resolved destination.
- Remove competing internal DocumentLink results where Definition owns navigation.
- Align wikilink, embed, delimiter, target, fragment, label, and marker semantic roles with Zed themes without fixed colors.
- Validate Zed and VS Code navigation compatibility and record quick performance evidence after each material optimization stage.

## Temporary Taxonomy Constraint

All configured taxonomy ids are equal for the new managed-document predicate. This task must not recognize `spaces` or any other taxonomy id.

To keep multi-taxonomy schema and convention composition out of this task, validation assumes one Page matches at most one taxonomy term. If the implementation requires choosing between multiple matching terms, stop and defer that behavior to [[tasks/generalize-taxonomy-neutral-page-model]] rather than introducing precedence.

## Out Of Scope

- Repository-wide replacement of the existing space compatibility projection.
- Generic-taxonomy basename/title lookup and schema-derived reference resolution; this refinement only adds taxonomy-neutral scope gating and explicit-path wikilink/embed navigation outside the compatibility index.
- Multi-taxonomy schema, convention, guideline, create, or template composition.
- Zed View Preview, Explorer panels, status UI, diagnostics UI, CLI acquisition, registry publication, or release publication.
- Completing every remaining item in [[tasks/implement-zed-extension-mvp]].
- Replacing Zed's built-in Markdown grammar or native Markdown navigation.

## Acceptance Criteria

- Managed Pages under differently named taxonomies receive equivalent Forma LSP lifecycle gating, highlighting, and explicit-path wikilink/embed navigation without taxonomy-id branches.
- Configured View sources receive the accepted link navigation and highlighting behavior.
- Unmanaged Markdown lifecycle and requests cause no Forma analysis or snapshot rebuild.
- Saved `.forma.md`, import, taxonomy, term, View, or include changes safely recompute scope and reclassify open documents.
- Wikilink target and displayed title both open the same resolved target and heading.
- Plain Markdown links remain editor-owned and do not receive competing Forma results; managed Markdown heading fragments use a bounded fallback that opens the resolved heading.
- Wikilink opening and closing delimiters share one theme-derived style; wikilinks and embeds share target styling; the embed marker remains a distinct internal role even when the current standard-token fallback renders it like an operator.
- Focused Core/LSP tests, Zed WASM checks, cross-editor verification, repository checks, and performance gates pass.
- Validation evidence is recorded, and no release is published without separate approval.

## Execution Notes

Follow the phases and stop conditions in [[planning/forma-link-navigation-and-highlighting-refinement-plan]]. Keep commits small enough to preserve a working baseline between scope gating, span changes, navigation ownership, semantic-token changes, and final evidence.

## Completion Evidence

- Core and LSP managed-document classification, failed-refresh preservation, post-`initialized` watcher registration, configured View overlays, request gating, reference spans, navigation ownership, and semantic roles are covered by focused tests and the full Rust workspace suite.
- VS Code adapter checks preserve native Markdown ownership and activate both wikilink targets and labels.
- Zed WASM checks and real-editor navigation passed for path, alias, heading, embed styling, CLI restart recovery, and Ayu Light/Ayu Dark theme previews.
- Navigation ownership and highlighting are represented explicitly: plain Markdown stays native, managed heading fragments use one bounded fallback, five internal wikilink roles map to standard Zed token transport without fixed colors, and semantic tests assert source slices rather than raw protocol-vector positions.
- Markdown-labelled fenced examples use a separate lexical projection: standard links and wikilinks receive consistent DocumentLink navigation, wikilink delimiters receive the same theme-derived semantic roles as document content, and Core relationship analysis remains inert.
- Inline code uses a navigation-only lexical projection for explicit Markdown links, wikilinks, and embeds so Zed's partial path fallback cannot make only one syntax clickable; inline styling and Core relationship analysis remain native/inert.
- Unique wikilinks and embeds without fragments use client-native positionless DocumentLink targets and no competing Definition. Zed clients receive `zed://file`, avoiding Zed's forced `(0,0)` conversion for standard file DocumentLinks; fragment-bearing and ambiguous references retain positioned Definition navigation. Zed remote mapping remains unclaimed pending separate validation.
- `mise run perf:lsp:quick` showed no material regression and improved the project cold Definition sample from 123.2 ms to 106.3 ms.
- The post-cleanup quick run remained within budget at 128.8 ms project cold Definition, 0.2 ms project warm p95, 37.7 ms 1,000-entry cold Definition, and 0.1 ms 1,000-entry warm p95.
- The positionless-navigation follow-up updated the benchmark to probe Definition and DocumentLink separately; the rerun remained within budget at 108.1 ms project cold Definition, 0.2 ms project warm p95, 36.3 ms 1,000-entry cold Definition, and 0.1 ms 1,000-entry warm p95.
- `CI=true mise run check`, project `forma check`, and example-workspace `forma check` passed before closure.
- Detailed evidence is recorded in [[discovery/forma-lsp-zed-navigation-validation-2026-07-13]]. No release was published.
