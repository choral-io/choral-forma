---
schemaVersion: 1
scope: project
type: execution-plan
title: Forma Link Navigation And Highlighting Refinement Plan
summary: Refine Forma reference spans, managed-document LSP scope, navigation ownership, fragment behavior, and theme-aligned wikilink highlighting without overriding native Markdown behavior.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - lsp
    - zed
    - vscode
    - editor-extension
    - navigation
    - highlighting
    - performance
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "discovery/forma-lsp-zed-navigation-validation-2026-07-13"
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/validate-zed-link-navigation"
    - "tasks/refine-zed-link-navigation-and-highlighting"
    - "tasks/generalize-taxonomy-neutral-page-model"
---

# Forma Link Navigation And Highlighting Refinement Plan

> Historical execution plan: the semantic-token phases below describe the completed Alpha 18 experiment. The accepted follow-up direction removes source styling from Forma LSP, keeps only parsing and native navigation integration, and leaves Markdown highlighting entirely to the host editor.

## Objective

Make Forma-specific references behave like a native extension of Markdown while keeping ordinary Markdown behavior editor-owned. The refinement must make wikilink labels clickable, send heading links directly to their resolved heading, align wikilink and embed highlighting with the active theme, and keep the two wikilink delimiters visually consistent.

The LSP must also avoid analyzing every Markdown file in an attached editor worktree. It should provide language intelligence only for content and View documents managed by the effective Forma workspace configuration, observe other control files only for scope invalidation, and leave unmanaged Markdown entirely to the editor's native Markdown implementation.

## Confirmed Problems

- Core currently collapses a complete reference range and its target range into one target-only range before LSP processing.
- An aliased wikilink can resolve when the cursor is on its path, but not when the cursor is on its displayed title.
- Definition resolves an internal heading to its source position, while DocumentLink currently drops the fragment and points to the beginning of the file.
- Zed can therefore receive two different destinations for one command-click and open a Definitions multibuffer even when the reference is not ambiguous.
- Wikilink and embed target highlighting still depends partly on different native Markdown captures.
- The opening and closing wikilink delimiters can inherit different theme styles even though they have the same syntactic role.
- The LSP currently accepts every Markdown document under the selected worktree root, analyzes every opened document, and rebuilds its snapshot after every saved document.

## Accepted Behavior Model

### Syntax And Navigation Ownership

| Syntax | Example | Primary owner | Expected source navigation |
| --- | --- | --- | --- |
| Schema reference | `owners: [members/sam-rivera]` | Forma | Reference scalar is clickable |
| Markdown link | `[Title](path.md#heading)` | Editor native Markdown, with a bounded Forma heading-fragment fallback | Title opens the resolved heading directly |
| Markdown image | `![Alt](assets/image.png)` | Editor native Markdown | Native image or resource behavior is preserved |
| Wikilink | `[[path#heading\|Title]]` | Forma | Path and title open the same resolved heading |
| Obsidian embed | `![[path#heading\|Title]]` | Forma | Uses the same navigation target as the equivalent wikilink |

Ordinary Markdown links and images remain editor-owned and must not receive duplicate internal navigation results from Forma. The current Zed integration has bounded exceptions: Forma may return Definition for a managed Markdown link with a heading fragment when native navigation does not reliably reach the heading; unique wikilinks and embeds without a fragment use Zed's positionless `zed://file` DocumentLink target so opening an existing target does not force a cursor position; and explicit links in inline code or `md`/`markdown` fenced examples may receive DocumentLink projection. Code projections are presentation-only and remain excluded from analysis, diagnostics, Definition, and the reference graph. Only Markdown-labelled fences receive Forma semantic-token projection. Multiple LocationLinks are reserved for genuinely ambiguous Forma reference resolution. Non-Zed clients retain standard `file://` targets, and Zed remote behavior remains a separate validation item.

### Highlight Roles

| Source part                | Semantic role      |
| -------------------------- | ------------------ |
| Opening `[[`               | Wikilink delimiter |
| Closing `]]`               | Wikilink delimiter |
| Target path                | Link target        |
| `#heading`                 | Link fragment      |
| Alias separator (`U+007C`) | Wikilink delimiter |
| Alias or title             | Link text          |
| Leading `!`                | Embed marker       |

The opening and closing delimiters must use exactly the same semantic token type and theme mapping. The target path in a wikilink and an embed must also use the same token type. The leading `!` remains a distinct internal semantic role even when the current Zed fallback maps it to the same standard `operator` token as the delimiters. Forma must preserve all five product roles internally, map them separately to the editor protocol, and must not ship fixed syntax colors.

## Managed-Document Boundary

The LSP must classify workspace-relative paths into four groups from the effective Forma configuration and snapshot:

1. **Managed content document**: a Markdown Page matched by an effective `include` pattern from any configured taxonomy term. No taxonomy id, including `spaces`, has built-in ownership or discovery semantics. Forma may analyze overlays and provide Definition, semantic tokens, diagnostics, and other accepted language intelligence.
2. **Managed View document**: an effective configured View source. Forma may provide Markdown-adjacent link navigation and highlighting while preserving its role as a saved configuration source. An unsaved View overlay does not change the authoritative workspace configuration in this refinement.
3. **Control file**: the root `.forma.md` and its other effective imported taxonomy, term, type, schema, template, guideline, or configuration sources. Forma observes saved or watched changes to these files so it can reload configuration and recompute the managed set, but does not treat them as ordinary managed content unless a taxonomy term `include` also matches them.
4. **Unmanaged document**: every other Markdown file in the worktree. Forma returns no Definition, DocumentLink, diagnostics, semantic tokens, or hover result and does not store or analyze its text.

The managed-document predicate must be exposed by Core or the reusable workspace snapshot rather than reimplemented in Zed, VS Code, or the LSP adapter. It must use effective imported configuration, not a hard-coded directory convention.

### Temporary Taxonomy Boundary

This refinement assumes that one Page matches at most one taxonomy term across the effective configuration. The assumption keeps the Zed navigation and highlighting work independent from the unresolved cross-product design for composing schemas, conventions, guidelines, create behavior, and templates across multiple matching terms.

The assumption is an implementation boundary, not the final Forma taxonomy model. The accepted product direction keeps all configured taxonomies equal and allows a future Page model to participate in multiple taxonomies. This refinement therefore must:

- derive managed membership from the union of every effective taxonomy term `include` pattern;
- avoid adding any branch keyed by a taxonomy id such as `spaces`;
- avoid defining precedence by taxonomy name, import order, or filesystem location;
- stop and defer the affected behavior if a real validation workspace requires multi-term composition;
- leave the existing wider Core, CLI/RPC, WebApp, and editor-client compatibility model unchanged unless a narrow change is required for the accepted Zed behavior.

The repository-wide removal of taxonomy-specific compatibility behavior is tracked by [[tasks/generalize-taxonomy-neutral-page-model]] and must be handled after this Zed refinement as a separate architecture and migration effort.

### Scope Invalidation

Recompute the managed-document set when any source that can change effective membership changes, including:

- root `.forma.md` imports;
- an imported config file being added, removed, or changed;
- taxonomy or term definitions being added, removed, or changed;
- an effective `include` or `includePatterns` value changing;
- imported source ordering or replacement changing which definitions are effective;
- a managed path being created, deleted, or renamed across an include boundary.

Saved control-file changes and supported watched-file notifications are configuration boundaries. Unsaved control-file overlays do not change the authoritative managed set in the first refinement. After recomputation, currently open documents must be reclassified: newly managed documents may enter overlay analysis, while documents that leave the managed set must have their Forma overlays and cached analyses removed.

An unmanaged document open, edit, save, close, or navigation request must not increment the document-analysis count or trigger a workspace snapshot rebuild.

## Delivery Sequence

### Phase 0: Capture The Failing Baseline

- Add a protocol fixture covering ordinary Markdown, frontmatter references, wikilinks, aliases, heading fragments, embeds, and inert code examples.
- Prove that the current wikilink path resolves while its alias does not.
- Prove that current Definition and DocumentLink destinations differ for a heading reference.
- Record the current semantic-token ranges for `[[path]]` and `![[path]]`.
- Record Zed command-click behavior separately from F12 Definition behavior.
- Add an unmanaged Markdown fixture and prove that the current LSP analyzes it.

Exit criterion: every confirmed problem has a focused red-capable automated check or a documented Zed interaction check.

### Phase 1: Add A Core-Owned Managed-Document Predicate

- Expose the effective managed content and View paths or a path-membership predicate from the reusable workspace snapshot.
- Keep control-file discovery separate from content membership.
- Reuse effective imports and every configured taxonomy term's include-pattern semantics without consulting a taxonomy id.
- Add classifications for managed content, managed Views, control files, and unmanaged paths.
- Test multiple imports, multiple include patterns, differently named taxonomies, View sources, additions, deletions, renames, and configuration reloads.

Exit criterion: adapters can ask Core whether a document is managed without scanning the worktree or rebuilding configuration themselves.

### Phase 2: Gate LSP Lifecycle And Requests By Managed Scope

- On `didOpen`, `didChange`, and `didSave`, store and analyze an overlay only for a managed content or managed View document.
- Track control files only for saved or watched invalidation.
- Ignore unmanaged document lifecycle notifications without logging them as errors.
- Return `None` or an empty result, as appropriate to each LSP method, for unmanaged documents.
- Do not rebuild the snapshot after an unmanaged save.
- Reload configuration and reclassify open documents after a control-file membership change.
- Add counters or assertions proving that unmanaged editor activity causes no document analysis or snapshot rebuild.

Exit criterion: attaching Forma to Zed's built-in Markdown language does not change navigation or highlighting in Markdown files outside the effective Forma content scope.

### Phase 3: Preserve Reference Source Roles In Core

- Replace the overloaded document-reference range with explicit `syntaxSpan`, `targetSpan`, `labelSpan`, and `fragmentSpan` fields where applicable.
- Preserve exact byte ranges in Core and continue converting them to UTF-16 only in the LSP adapter.
- Derive activation ranges without re-parsing source text in the editor adapter.
- Keep frontmatter reference ranges limited to schema-declared reference scalars.
- Keep Markdown and Forma syntax recognition out of editor-specific extension code.

Exit criterion: Core can distinguish where a reference resolves, where its visible label appears, where its fragment appears, and which complete source region represents the syntax.

### Phase 4: Separate Definition And DocumentLink Responsibilities

- Leave ordinary Markdown links and images to native editor navigation.
- Add only a bounded Definition fallback for a managed Markdown link with a heading fragment when the editor's native navigation cannot reach the heading; do not add the fallback to plain Markdown links or images.
- Use Definition for internal frontmatter references, fragment-bearing wikilinks and embeds, and ambiguous resolution.
- Use a client-native positionless DocumentLink target for a uniquely resolved wikilink or embed without a fragment, and suppress Definition for the same activation ranges so the editor can preserve an existing target cursor position. In Zed this is a client-detected `zed://file` target; other clients retain `file://`.
- Make both the path and alias portions of a Forma wikilink activate the same navigation target.
- Return the resolved heading source range rather than a zero-width placeholder.
- Do not return an internal DocumentLink that competes with an internal Definition for the same source range.
- Retain DocumentLink only where an external URL or non-document local resource requires it and no conflicting Definition is provided.
- Preserve multiple Definition results only for genuinely ambiguous reference resolution.

Exit criterion: a resolved heading reference opens its document and heading directly, while a genuinely ambiguous reference still opens the editor's Definitions chooser.

### Phase 5: Align Theme-Aware Wikilink Tokens

- Define separate semantic token roles for delimiter, target, fragment, label, and embed marker.
- Emit the same delimiter token for both `[[` and `]]`.
- Emit the same target and fragment tokens for wikilinks and embeds.
- Map the alias to a theme role aligned with native Markdown link text.
- Map `!` independently as an embed marker without restyling the target.
- Validate custom semantic-token mapping through the Zed extension before choosing a standard-token fallback.
- If Zed cannot map a custom delimiter role to theme punctuation, use one shared standard fallback for both delimiters rather than relying on two different Tree-sitter captures.
- For the current built-in Markdown attachment, retain delimiter, target, fragment, label, and embed-marker roles internally, then transport delimiters and markers as `operator`, targets and fragments as `string`, and leave alias text to native Markdown in `combined` mode.
- Keep semantic-token ranges independent from Definition activation ranges.

Exit criterion: the two brackets match each other under every tested theme, wikilink and embed targets match each other, and no fixed Forma palette overrides the user's theme.

### Phase 6: Cross-Editor Validation And Performance Check

- Run focused Core and LSP tests after every phase.
- Validate command-click, F12, hover, aliases, fragments, embeds, unresolved targets, and ambiguity in Zed.
- Verify that standard Markdown remains native in Zed and VS Code.
- Verify that VS Code source navigation and Preview links do not regress.
- Test dark and light Zed themes with Markdown semantic tokens enabled.
- Run the quick LSP performance benchmark after scope gating and after span/token changes.
- Compare document-analysis count, snapshot rebuild count, warm Definition latency, idle CPU, and connected RSS with the recorded baseline.

Exit criterion: functional checks pass and the refinement does not introduce a material navigation-latency or long-lived resource regression.

### Phase 7: Record Evidence And Choose Release Scope

- Run the complete repository validation gate.
- Update the Zed navigation validation record with the refined behavior and measured evidence.
- Record any remaining Zed semantic-token configuration requirement.
- Decide separately whether the change belongs in the next aligned Forma alpha release.
- Do not publish a release as part of this plan unless release execution is explicitly approved later.

## Automated Test Matrix

- Managed and unmanaged Markdown paths under the same editor worktree.
- Managed membership added or removed by imported configuration changes.
- Equivalent managed membership under taxonomy ids other than `spaces`.
- Configured View source navigation and highlighting without unsaved configuration reload.
- Single and multiple frontmatter references.
- Markdown links, Markdown images, wikilinks, aliased wikilinks, heading wikilinks, and embeds.
- Cursor positions in target, fragment, alias, delimiters, and surrounding text.
- Resolved, unresolved, ambiguous, external, and local-resource targets.
- Inline code and fenced code remaining semantically inert while approved lexical link projections stay navigation-only.
- UTF-16 positions with Chinese text and surrogate-pair emoji.
- LF, CRLF, and unsaved managed-document overlays.
- Matching opening and closing delimiter semantic-token types.
- Matching target token types between wikilinks and embeds.
- No analysis or rebuild counters changing for unmanaged document activity.

## Performance Gates

- Unmanaged document lifecycle and navigation requests perform no Core document analysis.
- Unmanaged saves do not rebuild the Forma workspace snapshot.
- Warm managed Definition p95 remains no more than 100 ms.
- Cold managed Definition p95 remains no more than 250 ms.
- One managed overlay version performs at most one Core document analysis.
- Scope recomputation happens only after a relevant control or watched-path change.
- The LSP performs no intentional idle scanning or polling.
- Connected RSS is recorded and reviewed if it increases materially from the existing baseline.

## Stop Conditions

Stop and reassess rather than broadening the change when:

- managed membership cannot be derived from the same effective configuration used by the workspace snapshot;
- correct Zed behavior requires choosing precedence between multiple taxonomy terms;
- fixing Zed highlighting would require replacing the built-in Markdown grammar;
- direct heading navigation requires editor-specific target syntax in Core;
- ordinary Markdown navigation cannot be left native without removing required Forma semantics;
- scope invalidation requires continuous worktree-wide rescanning;
- the refinement materially exceeds the accepted navigation or resource budgets;
- completion would require Zed Preview, panels, CLI acquisition, registry publication, or release execution.

## Suggested Commit Boundaries

1. `test: capture editor link and managed-scope regressions`
2. `feat: expose Forma managed-document membership`
3. `fix: gate LSP analysis to managed documents`
4. `refactor: preserve reference source spans`
5. `fix: separate LSP navigation responsibilities`
6. `fix: align Zed wikilink semantic tokens`
7. `test: validate cross-editor link behavior and performance`
8. `docs: record refined editor navigation evidence`

## Completion Evidence

- Focused Core and LSP tests pass.
- The Zed WASM extension build passes.
- `[[path|Title]]` navigates from both path and title.
- Heading references open the resolved heading directly rather than an unnecessary Definitions multibuffer.
- Unique wikilinks without fragments reopen an existing target without forcing the cursor to the first line.
- `[[` and `]]` use the same theme-derived style.
- `[[path]]` and `![[path]]` use the same target style, while only `!` carries the distinct internal embed-marker role.
- Plain Markdown links and images remain native in unmanaged and managed documents; the managed heading-fragment fallback opens the resolved heading without competing results.
- Non-Forma Markdown files produce no Forma LSP analysis, navigation, diagnostics, or semantic tokens.
- Effective imports and include-pattern changes correctly reclassify the managed document set.
- Quick and full validation gates pass, and performance evidence remains within budget.
- No release is published without a separate explicit approval.
