---
scope: member
type: research
owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - workspace
    - research
    - forma
    - rust
    - markdown
---

# Forma Markdown Parser Spike Report

## Purpose

Evaluate Rust Markdown parser options for Choral Forma P0, based on the handoff in [forma-markdown-parser-spike.md](../handoffs/forma-markdown-parser-spike.md).

This is research evidence, not an accepted architecture decision.

## Sources

- [Forma core technical direction](../../../architecture/forma-core-technical-direction.md)
- [Product direction](../../../product/product-direction.md)
- [markdown-rs docs](https://docs.rs/markdown/latest/markdown/)
- [markdown 1.0.0 crate page](https://docs.rs/crate/markdown/1.0.0)
- [Comrak 0.52.0 crate page](https://docs.rs/crate/comrak/latest)
- [Comrak extension options](https://docs.rs/comrak/latest/comrak/options/struct.Extension.html)
- [pulldown-cmark 0.13.3 README](https://docs.rs/crate/pulldown-cmark/latest/source/README.md)

## Spike Setup

The temporary Rust spike used:

- `markdown = "1.0.0"` with the `serde` feature.
- `comrak = "0.52.0"`.
- `pulldown-cmark = "0.13.3"` as event-stream context.

The test document used the handoff sample: YAML frontmatter, a heading, ordinary wikilink, Obsidian-style embed, Forma view comments, GFM task list, and GFM table with a wikilink in a table cell.

Commands run:

```sh
cargo run
cargo check
```

The first sandboxed `cargo run` failed because DNS to `index.crates.io` was blocked. The approved network rerun downloaded dependencies and compiled the spike.

## Evidence Summary

### markdown-rs

Observed with `ParseOptions::gfm()` and `Options::gfm()`:

- Produced an mdast-style AST with line, column, and byte offset positions.
- Parsed GFM task list state.
- Parsed GFM table structure.
- Kept `[[notes/foo]]`, `![[notes/bar]]`, and table-cell wikilinks as text.
- Detected HTML comments in the AST.
- Rendered HTML comments as escaped visible text by default:

```html
&lt;!-- forma-view --&gt; &lt;!-- forma-view: todos assignee=&quot;users/tiscs&quot; --&gt;
```

This is acceptable only if Forma strips or replaces view comments during FormaAST enrichment before HTML rendering.

### Comrak

Observed with `extension.table`, `extension.tasklist`, `extension.wikilinks_title_after_pipe`, and `render.unsafe` enabled:

- Produced a traversable AST with source positions.
- Parsed Forma view comments as `HtmlBlock` nodes with source positions.
- Parsed GFM table and GFM task list nodes.
- Parsed ordinary `[[notes/foo]]` and table-cell wikilinks as `WikiLink` nodes.
- Did not parse `![[notes/bar]]` as an embed; it remained text.
- Rendered raw HTML comments only when unsafe rendering was enabled.

Representative output:

```text
wikilink node @ 4:5-4:17: NodeWikiLink { url: "notes/foo" }
html node @ 6:1-6:19: NodeHtmlBlock { literal: "<!-- forma-view -->\n" }
task item checked=NodeTaskItem { symbol: Some('x') } @ 13:1-13:17
wikilink node @ 17:3-17:22: NodeWikiLink { url: "notes/table-link" }
```

Comrak's wikilink extension is useful but incomplete for Forma's embed intent. If enabled, Forma would still need a custom scanner for `![[...]]`, so using Comrak wikilinks directly creates a split path between ordinary wikilinks and embeds.

### pulldown-cmark

Observed with table and task-list options:

- Detected HTML comments as events.
- Detected GFM table and task-list events.
- Did not provide an AST.
- Did not expose wikilinks as structured nodes in this basic spike.

It remains a plausible fallback only if Forma keeps AST needs minimal.

### Custom Scanner

A simple line scanner over the Markdown body detected all Forma-specific markers in the sample:

```text
wikilink target=notes/foo @ 4:5
embed target=notes/bar @ 4:23
forma-view target= @ 6:1
forma-view target=todos assignee="users/tiscs" @ 8:1
wikilink target=notes/table-link @ 17:3
```

This supports a P0 strategy where the Markdown parser owns CommonMark/GFM and a small Forma scanner owns wikilinks, embeds, and Forma view comments.

## Capability Matrix

| Capability | markdown-rs | Comrak | pulldown-cmark |
| --- | --- | --- | --- |
| Markdown AST access | Strong mdast AST | Strong AST, arena/refcell style | No AST, event stream |
| Source positions | Strong line/column/offset | Strong sourcepos | Event-level only in this spike |
| HTML comment detection | Yes in AST | Yes as HtmlBlock/HtmlInline | Yes as HTML event |
| GFM table support | Yes with GFM options | Yes with extension option | Yes with option |
| GFM task list support | Yes with GFM options | Yes with extension option | Yes with option |
| HTML rendering | Good, safe by default | Good, configurable; raw HTML needs unsafe | Good basic renderer |
| Wikilink scanning | Custom scanner needed | Built-in ordinary wikilinks, embeds still need scanner | Custom scanner needed |
| Embed scanning | Custom scanner needed | Custom scanner needed | Custom scanner needed |
| Error ergonomics | Result for extension errors, structured message | Mostly parse-through CommonMark behavior | Mostly parse-through event parsing |
| Rust API ergonomics | Simple functions and serializable AST | Mature but arena/refcell traversal | Simple iterator API |
| Maturity | 1.0.0, documented, CommonMark/GFM focus | Mature, active, broad release history | Mature fallback, event-stream oriented |

## Recommendation

Prefer `markdown-rs` for the P0 parser spike path, paired with a custom Forma scanner for wikilinks, `![[...]]` embeds, and `<!-- forma-view ... -->` directives.

Rationale:

- Forma's preferred model is `FormaAST = Markdown AST + Forma extensions`. `markdown-rs` exposes an mdast-like tree with clear positions and simple serialization, which fits AST enrichment better than an event stream.
- Both `markdown-rs` and Comrak cover GFM tables, task lists, comments, source positions, and HTML rendering after options are set.
- Comrak's built-in wikilink support is not enough for Forma because embeds still require custom handling. Disabling parser-level wikilinks and scanning Forma references consistently is cleaner for P0.
- Using one parser for both AST and HTML avoids source-mapping divergence. A dual-parser strategy should wait until a concrete rendering gap requires it.

Keep Comrak as the fallback candidate if later GUI rendering fidelity, CommonMark/GFM compatibility details, or markdown-to-HTML control become more important than mdast ergonomics.

Do not select `pulldown-cmark` as the primary P0 parser unless Forma decides that AST enrichment is not needed. It is useful as an event-stream fallback, but it does not match the current FormaAST direction.

## FormaAST Design Implications

- Split frontmatter before Markdown parsing, as already proposed.
- Treat source Markdown as immutable input for P0; do not rewrite bodies.
- Add a Forma scanner pass over the Markdown body or AST text spans.
- Represent ordinary wikilinks and embeds as Forma extension annotations with source ranges.
- Treat Forma view comments as mount directives, not as ordinary HTML to render.
- HTML rendering should run after FormaAST enrichment strips, replaces, or renders view comments. Otherwise `markdown-rs` safe output will show comments as escaped text.
- Do not rely on parser-native wikilink extensions for P0 identity semantics; Forma reference resolution should remain product-owned.

## Open Follow-Ups

- Verify how `markdown-rs` represents HTML comments in the exact AST variant before writing production extraction code.
- Decide whether Forma comments should be removed, replaced by placeholders, or rendered as view output in the first read-only GUI.
- Evaluate YAML/frontmatter libraries separately; this spike only split frontmatter and did not validate YAML parsing ergonomics.
- Recheck parser choice during the first real `forma check` or local web render implementation, using a larger fixture set from this repository.
