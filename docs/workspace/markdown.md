---
id: workspace.markdown
title: Markdown reading and navigation
summary: Markdown syntax, heading anchors, footnotes, and reader host boundaries.
audience:
    - human
    - agent
surfaces:
    - docs
order: 35
---

# Markdown Reading And Navigation

Markdown files own content. Forma renders them for reading without rewriting their source. Core resolves workspace references; a reader's parser and host provide presentation. A parser option named `gfm` is not a promise to implement every GitHub website feature.

## Supported Content

| Content | Online WebApp / static with JavaScript | Static initial HTML / Core HTML | VS Code native Preview |
| --- | --- | --- | --- |
| Paragraphs, h1–h6, emphasis, lists, quotes, code, ordinary links and images | Supported | Supported | Host Markdown engine |
| Tables, strikethrough, task lists | Supported; task items are read-only | Semantic HTML | Host Markdown engine |
| Basic callouts | NOTE, TIP, IMPORTANT, WARNING, CAUTION | Same semantic content and styling | Host capability; ordinary blockquote fallback |
| Labelled footnotes | Supported | Supported | Host capability; Forma adds no footnote parser |
| Heading anchors | Existing reader IDs plus readable aliases | Existing static IDs plus readable aliases | Native host IDs; Forma injects no aliases |
| Code highlighting | Bundled languages; unknown languages remain code | Plain code | Host highlighting |
| Mathematics | `$…$`, standalone one-line/multiline `$$` blocks and `math` fences, with currency/escape guards | Readable source/code fallback | Host capability; Forma adds no math engine |
| Mermaid | Supported subset, resource budgets, source fallback | Code fallback | Host capability; Forma adds no Mermaid engine |
| Highlight | `==…==` within one line | Same semantic `<mark>` content | Host capability; Forma adds no highlight parser |
| Safe inline HTML | Attribute-free `mark`, `sub`, `sup`; other HTML remains sanitized | Same three inline tags; other HTML follows the compiler policy | Host trust and preview security policy |

The online WebApp and enhanced static reader share Forma rendering semantics, extension syntax and navigation behavior. Static initial HTML preserves content and usable links with readable fallbacks when enhancement is unavailable. The static reader progressively enhances initial HTML. It must preserve readable text and usable navigation when JavaScript is unavailable. Rich presentation may differ between hosts. VS Code keeps its native authoring and preview model; installing Forma does not make its Markdown engine identical to the WebApp.

Standard Markdown hard breaks and permitted `<br>` are supported in the WebApp. Intraword underscores follow CommonMark emphasis rules: use `*强调*` when emphasis must touch surrounding Chinese text. `^1^` is ordinary text, not automatic superscript or a footnote. Definition lists, automatic note inference, and arbitrary third-party Markdown extensions are not promised.

## Mathematics, Highlight And Inline Semantics

Inline `$x^2$`, `$2$` and `$12.50$` are explicit formulae: paired numeric delimiters are not treated as currency. An opener must be followed by non-whitespace content; its closer must not follow whitespace. Inline expressions cannot span lines, contain backticks or contain escaped dollar signs. A digit-leading expression whose closer touches another digit is left literal, while `$x$5` retains its existing inline-math behavior. Unclosed amounts such as `$12.50`, price pairs such as `$5 and $10`, escaped dollars and code examples remain ordinary text. This is a lexical boundary, not automatic inference of financial or mathematical meaning.

A display expression may use `$$x^2$$` on its own line, or opening and closing `$$` lines around a multiline expression. A fenced block whose trimmed language is exactly `math` also renders as display math. Ordinary paragraphs containing `$$…$$` retain that sequence as literal source rather than partially rendering its inner dollars. Other fence languages keep their existing behavior. Formula errors do not fail the document; unavailable enhancement leaves readable source/code. KaTeX's existing trust and resource limits remain in force. Alternative delimiters such as `\(…\)`, `\[…\]` and GitHub's inline backtick-dollar form are outside this batch. Static initial HTML intentionally keeps formula source or fenced code; this batch does not add a server-side math engine.

Use `==重点 **内容**==` for inline highlighting. Delimiters must be literal pairs of exactly two equals signs with non-whitespace inner boundaries, on the same line. Complete emphasis, links, code spans and formulae may appear inside a highlight. Escaped/entity-spelled delimiters, code literals, image alternatives, formula source, unmatched/triple delimiters and constructs crossing a formatting boundary are not inferred as highlights. Highlighter colors use the reader's semantic theme colors. Source spans and existing heading links remain intact; recognized delimiters are omitted from readable heading/reference labels.

Attribute-free inline `<mark>…</mark>`, `<sub>…</sub>` and `<sup>…</sup>` preserve their semantic tags in both readers and static initial HTML. Tag names are case-insensitive. This allowance does not enable arbitrary raw HTML, block HTML, attributes, scripts or event handlers in Core. Attribute-bearing or malformed HTML remains subject to each host's existing safe-HTML policy, outside this portable subset. Escaped tags, entities and code stay literal. `H~2~O` continues to mean a single-tilde strikethrough; `x^2^` stays literal. No subscript/superscript shorthand is added. VS Code keeps its native parser and styling for all these forms.

The combined reading sample is `fixtures/forma-validation/samples/markdown/reading-p1.md`. Exact shared cases in `fixtures/forma-validation/cases/markdown-reading-p1.json` cover numeric/currency boundaries, formula fences, highlight nesting, safe tags, deletion compatibility, escaping, code, lists, tables, footnotes and folded callouts. Both files participate in normal formatting. Core/WebApp tests and the isolated browser gate consume the same cases; browser acceptance covers enhanced readers, no-script fallback, light/dark contrast and narrow layouts. Literal table pipes still require Markdown escaping or a TeX spelling such as `\vert`/`\mid`; the reader does not guess table-column intent.

## Viewer Design And Interaction

The WebApp and enhanced static site use the same viewer presentation for Mermaid and Graph Views, following the right-side media controls used in Choral Flows. Controls use compact translucent circular buttons; expanded inspection uses a native full-viewport dialog. Escape or the collapse button exits, restores reading scroll and returns focus to the opener. Keyboard focus stays in the expanded dialog. Expanding Graph preserves the live graph instance, node selection and layout.

Default fit reserves a right-side content lane for the measured control rail, so controls cannot cover the fitted diagram. Both width and height constrain the Mermaid overview. Zoomed media may pan through the full inspection canvas; reset restores the safe overview, including after resize. Graph allocates its renderer a viewport beside the same control rail, keeping engine-managed picking, camera fit and node navigation in that viewport. A selected-node summary stays clear of the rail too.

Mermaid provides fit and expand/collapse controls, with 100–300% measured relative to the fitted overview. Plus/minus keys zoom, arrows pan, and zero or Home fits; ordinary wheel scrolling remains native while Ctrl/Command-wheel or trackpad pinch zooms. Wheel units and continuous delta accumulation follow Choral Flows (pixel delta × 0.02, without a per-event delta cap), keeping the pointer's content point stable. Expanded media supports touch panning and pinch. Graph uses the same fit and expand/collapse button order and icon size, backed by its own engine camera. Graph uses the same modifier-wheel/trackpad-pinch contract in the WebApp and static reader, retaining its native touch pinch, selection, Enter/double-click navigation, and F to fit all nodes. Graph fit does not recompute layout or clear selection. In expanded inspection, Escape closes the dialog without also clearing the selected node; inline Graph Escape retains its engine behavior. Its scale is not presented as the media viewer's percentage.

Without JavaScript, images remain ordinary images with authored links preserved, Mermaid remains source code, and Graph retains its static projection fallback. VS Code native Markdown and View rendering are outside this WebApp presentation change; no image, Mermaid or Graph rendering takeover is added there.

## Images

Images use ordinary Markdown rendering in the WebApp and static site, with or without JavaScript. Forma adds no viewer wrapper, generated original-resource link, fullscreen button, zoom controls, or image gesture handling. Author-supplied image links retain their destinations and normal navigation behavior. Alt text and titles are preserved; code examples remain code.

Relative image paths continue to use the existing workspace resource resolver and static deployment root. Resource publication rules remain unchanged. SVGs are displayed as image resources, not injected as authored inline markup. VS Code retains its native image rendering and links.

## Basic Callouts

Use one of the five supported type identifiers on the first line of a blockquote. Identifiers are case-insensitive. Text on that same line is a custom title; without it, Forma uses Note, Tip, Important, Warning, or Caution. A callout may contain only a title.

```text
> [!note] Reading context
>
> An explanation with **emphasis** and [a link](guide.md).
>
> A second paragraph in the same callout.
```

The supported types are `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and `CAUTION`; each keeps its existing Forma styling. This is a bounded compatibility subset of Obsidian callouts, not its complete type and alias catalog. In particular, Important and Caution retain their distinct Forma presentation. Custom titles support ordinary inline Markdown and the same HTML safety policy as the body. Long titles and continuous title links wrap within the callout, keeping disclosure-arrow space clear. Keyboard focus uses the native disclosure component’s visible outline. Labels remain visible without relying on color. Callouts are authored document content, not live alerts; rendering does not announce them as urgent notifications.

Keep an empty quoted line (`>`) between the header and body in formatted documents and templates. This creates a paragraph boundary that the repository's Prettier configuration preserves without ignore comments or a custom plugin. The compact form with body text on the next quoted line remains supported, but a formatter can merge those lines. Once merged, the text is a title; Forma does not guess whether it was previously body text. A blank line after the header does not add an empty paragraph to the rendered callout.

Body paragraphs, lists, code, links and footnotes retain normal Markdown behavior. Static initial HTML contains the complete callout and needs no JavaScript. Unknown types, unsupported suffixes, escaped or entity-spelled markers, and code examples remain ordinary Markdown. A leading blank quote line is not a marker line. An immediate `-` or `+` after the marker enables native disclosure: `[!note]- Title` starts collapsed, and `[!note]+ Title` starts expanded. The suffix works with custom or default titles, including title-only callouts. The summary toggles with pointer or keyboard using native `<details>/<summary>`; static initial HTML retains that behavior without JavaScript. In enhanced readers, navigation or history restoration to a target inside a folded callout opens its callout ancestors before focusing and scrolling. Navigating to a disclosure itself does not toggle it. Without JavaScript, deep-link revelation follows browser behavior; users can always open the summary manually. Additional types and aliases, and complex callout nesting remain outside this compatibility batch. Raw HTML is not interpreted as callout syntax. Inline constructs crossing from a compact header line into its body (for example, a code span closed on the next line) remain ordinary quotations rather than risking a title/body split that loses content.

Forma adds no VS Code callout renderer. The host or user extensions may style the same syntax; otherwise it stays a readable blockquote with its marker and body intact.

## VS Code Enhancement Boundary

VS Code owns ordinary Markdown parsing, heading IDs, syntax extensions and presentation. Forma does not register a footnote parser, replace heading rules, or normalize native note IDs to match its own readers. Footnotes and other syntax can therefore differ with the host and the user’s installed extensions. Forma-specific readable fragments are a contract of Forma readers and Core source navigation, not native Preview targets.

For Forma-managed documents, Forma retains collapsible Frontmatter with its configurable initial state, resolved workspace-reference links, and configured View projections. Frontmatter wrapping preserves the native table and leaves unmatched HTML unchanged. Ordinary Markdown outside the managed scope receives no Forma content transformation. View interaction and styling stay within Forma-owned elements. Preview opening, refresh and restoration continue to use the native host.

## Heading Links And Compatibility

In Forma readers, every authored heading level has an additive readable target: `#forma-heading-` followed by its lowercase letters and numbers, with other character runs replaced by a hyphen. Unicode alphabetic characters and numbers are retained; Chinese letters remain Chinese. Footnote call numbers do not participate in a heading alias. Empty slugs use `section`. Repeated targets receive `-2`, `-3`, and so on; existing generated candidates are reserved to avoid suffix collisions.

For example, `## 中文标题` has `#forma-heading-中文标题`, and `#### Deep *heading*` has `#forma-heading-deep-heading`. Use percent-encoded fragments when a transport requires URL encoding. A leading title omitted from the reader body retains its readable target. A title carrying a footnote call remains visible so its note and return navigation stay usable.

Historical reader h2/h3 IDs and static heading IDs remain in place. They were generated differently and are not renamed into one scheme. New readable aliases give authors one form shared by Forma readers. Native VS Code heading IDs remain owned by the host. Core source navigation also resolves these aliases using parsed heading spans, including formatted and Setext headings. Existing explicit HTML IDs take precedence when they conflict with a readable alias. As with other text-derived anchors, changing heading text or the order of duplicate headings can change generated targets.

The navigation outline continues to show second- and third-level headings. This does not limit linkable heading levels. Generated footnote section labels do not consume authored outline positions.

## Footnotes

```markdown
A passage[^translator], referenced again[^translator].

[^translator]: Translator's note, first paragraph.

    A second paragraph in the same note.
```

In Forma readers, references resolve within one document, including definitions later in that document. References inside notes may resolve to another defined note. Numbering follows first reference order. Repeated references share one definition and have separate return links. Return IDs distinguish repeated references from labels ending in a number. Historical unambiguous return IDs remain as aliases in Core and WebApp HTML. Indented continuation paragraphs stay within their definition. Missing definitions remain visible text; code examples do not create footnotes. Use unique, exactly matching labels; case and duplicate-definition recovery differ between parser engines and are not a portable authoring contract. Lowercase ASCII labels are recommended for durable note deep links between Forma readers. Native Preview note syntax and targets follow the host.

Two documents may reuse a label independently. A combined document must give originally independent notes distinct labels; Forma does not infer chapter scopes from headings. Footnotes are rendered at the end of their document. Inline `^[note]` syntax is not part of this contract.

“Original note” and “translator's note” are authored identities, not meanings inferred from numeric labels. Write the identity explicitly. Preserve source-node boundaries and explicit source links when a note spans multiple source nodes; rendering does not merge nodes, infer ownership, or upgrade review status.

WebApp note links update the fragment and move keyboard focus to their target. Direct fragments are restored after asynchronous rendering; browser history navigation restores the target. Static initial HTML uses ordinary links. VS Code retains native fragment navigation.

## Regression And Verification Boundary

The shared samples are `fixtures/forma-validation/samples/markdown/reader.md` and `fixtures/forma-validation/samples/markdown/edge-cases.md`, plus `fixtures/forma-validation/samples/markdown/callout-compatibility.md` for case/title support and formatter stability, `fixtures/forma-validation/samples/markdown/callout-layout.md` for long titles/links and responsive disclosure layout, and `fixtures/forma-validation/samples/markdown/review-regressions.md` and `fixtures/forma-validation/samples/markdown/callouts.md` and `fixtures/forma-validation/samples/markdown/callout-review.md`. Image samples are `fixtures/forma-validation/samples/markdown/images.md` and its local `image-viewer.svg`. `fixtures/forma-validation/samples/markdown/viewers.md` and `image-viewer-tall.svg` cover wide/tall content, ordinary image rendering, authored image links, and Mermaid fit/expand controls; Graph interaction samples remain under `samples/projections/graph-reference-density.md`. Core and the WebApp's real renderer plus sanitizer consume these samples to verify Forma rendering semantics. The VS Code adapter uses them to verify unchanged host output, not matching rendering. They cover all heading levels, Chinese and repeated heading text, suffix collisions, legacy reader links, repeated and multi-paragraph notes, missing notes, Unicode and recursive notes, return-ID collisions, pre-encoded authored links, punctuation labels, note-definition ordering, reserved-ID collisions, and literal extension-like text.

The callout Markdown samples participate in normal Prettier formatting. Exact source spellings that a Markdown formatter may normalize are stored as strings in `fixtures/forma-validation/cases/markdown-callout-boundaries.json`: compact title/body boundaries, leading empty quote lines, hard breaks, escaped/entity markers, list items and code literals. Core, the WebApp and the browser gate consume the same cases. JSON formatting preserves the Markdown source strings; the browser gate materializes them only inside its disposable workspace and checks enhanced and no-script hosts. No inline ignore comments or callout-file exclusions are required.

Parser tests do not establish browser or packaged extension acceptance. Forma rendering changes must also verify the production WebApp with its backend and a built static artifact with and without JavaScript: note/return clicks, direct fragments, refresh, history, keyboard focus, and retained legacy targets. VS Code changes verify native rendering remains intact and the retained Frontmatter, reference-navigation and View enhancements work in a packaged VSIX installed into an isolated editor profile. Native Preview is not required to reproduce Forma reader HTML or extension syntax. Report unavailable hosts and release verification separately.

## Browser Regression Gate

Run `mise run test:markdown:browser` with `playwright-cli` (validated with 0.1.22) and its selected browser installed. The gate builds the current assets and CLI, creates an isolated temporary workspace from the shared Markdown samples, and tests the production WebApp backend plus a static export under `/preview`. It uses fresh browser contexts, including one with JavaScript disabled; it does not connect to an existing signed-in browser or the local demonstration workspace.

The extra link cases are shared in `fixtures/forma-validation/samples/markdown/image-links.md`. The gate checks ordinary image rendering, authored image fragment/page navigation and external destinations, foldable callout defaults and keyboard/header-link behavior, hidden heading/footnote/history revelation, wide/narrow light/dark callout geometry, long-title/link wrapping, arrow clearance, title/body spacing and visible keyboard focus, static no-script image/Mermaid/Graph fallbacks, Mermaid focus restoration, and Graph selection and focus preservation across expand, fit and Escape. Browser page errors, console errors and non-cancelled failed requests fail the enhanced-host scenarios. External image links are clicked against a test-local intercepted response rather than the public network. The no-script context additionally checks that an injected page script cannot execute. Failure screenshots, command logs, `failure.json` and `cleanup.json` remain in ignored `packages/webapp/.tmp/markdown-browser-*` directories. Temporary workspaces, browser sessions and loopback servers are cleaned up on completion and handled SIGINT/SIGTERM; these signals cancel in-flight commands before cleanup starts. Cleanup errors fail the gate, and `result.json` is written only after cleanup succeeds. If screenshot capture itself fails, the original assertion and capture error remain in the log. SIGKILL, host crashes, and an unreachable browser daemon cannot promise graceful cleanup. Set `FORMA_BROWSER=webkit` or `FORMA_BROWSER=firefox` to select another installed Playwright browser; Chromium is the default. This is a separate browser gate, not part of `mise run check`, and does not replace physical gesture-device or VSIX acceptance.
