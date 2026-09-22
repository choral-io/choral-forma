---
id: workspace.views
title: Views
summary: Define saved read-only projections over workspace pages.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 140
---

# Views

## Overview

Views are configured Markdown nodes that describe read-only projections such as lists, tables, kanban boards, graphs, calendars, and Gantt timelines.

View config uses `mode` to select the projection and `source` to choose the candidate pages. Do not use `projection` or `query.source`; those are not the current view DSL.

View parameters and embedded view comments such as `<!-- forma-view: ... -->` are not workspace view syntax. Views are directly rendered page views, and `forma view render` does not evaluate `{{ params.* }}` placeholders in view definitions.

Minimal table view:

```md
---
schemaVersion: 1
kind: view
title: Notes
mode: table
source:
    type: pages
    taxonomy:
        spaces:
            - notes
table:
    columns:
        - field: fields.title
          label: Title
          link:
              target: entry
        - field: fields.summary
          label: Summary
---

# Notes

<!-- forma:content -->
```

Minimal graph view:

```md
---
schemaVersion: 1
kind: view
title: Graph
mode: graph
source:
    type: pages
graph:
    presentation:
        nodes:
            colorBy:
                taxonomy: areas
    edges:
        - source: fields
          field: owner
          label: owned by
---

# Graph

<!-- forma:content -->
```

`graph.presentation.nodes.colorBy.taxonomy` optionally colors nodes by any configured taxonomy. A Page that matches one term uses the term's `display.color`, falling back to the taxonomy's `display.color`. Unclassified Pages and Pages that match several terms keep a neutral fill, so Forma never chooses an arbitrary first term. Omitting `colorBy` preserves the Host's neutral Graph colors; naming an unknown taxonomy reports `view.graphTaxonomyMissing`.

A Graph can instead classify nodes from one scalar frontmatter field:

```yaml
graph:
    presentation:
        nodes:
            colorBy:
                field: fields.status
```

`graph.presentation.nodes.colorBy.field` uses the same `fields.<path>` convention as View queries and supports nested paths such as `fields.workflow.stage`. A non-empty string, number, or boolean becomes a classification label. A string in the existing `#RRGGBB` display-color format is used directly; every other supported value maps deterministically to the built-in Graph palette, so equal typed values receive the same color across Hosts. Missing, null, empty, list, and object values remain neutral and appear as `Unclassified` rather than being flattened or assigned an arbitrary first value.

Configure exactly one of `colorBy.taxonomy` or `colorBy.field`. Invalid combinations and field paths report `view.graphColorByInvalid`. Choose a field with a small, meaningful set of values; more than 24 distinct scalar values reports `view.graphColorCardinalityHigh` because fields such as entry titles or unique identifiers create noisy Graphs and legends.

Node size is derived from the number of incoming and outgoing resolved references, using a bounded logarithmic scale so highly connected Pages stand out without overwhelming the layout.

Use `query` only for filters within the selected source:

```yaml
query:
    all:
        - field: fields.status
          op: equals
          value: active
```

## Gantt

Gantt is a read-only, day-resolution timeline over explicitly bound schema fields. It adds no scheduling engine and never writes dates back to Markdown.

```yaml
schemaVersion: 1
kind: view
title: Exhibition Timeline
mode: gantt
source:
    type: pages
    include: ["exhibitions/**/*.md"]
gantt:
    start: { field: fields.opensOn }
    end: { field: fields.closesOn }
    milestone: { field: fields.isMilestone }
    progress: { field: fields.percentComplete }
    dependencies:
        field: fields.predecessors
        relation: finishToStart
    presentation:
        rows:
            colorBy: { taxonomy: stages }
```

All names in this example are configured, not built-in fields. `start` is required; the other bindings are optional. Start/end reuse Calendar's scalar `date`/`datetime`, timezone, inclusive date-end, exclusive datetime-end and point semantics. A milestone requires a boolean schema field with literal `true`; points and missing ends do not imply milestones. A multi-day milestone retains its bar and adds a start marker. Progress requires an `integer` schema field holding whole percent from `0` through `100`; a ratio convention is not accepted, so a value such as `0.4` is rejected by schema validation rather than read as less than one percent. A value outside the range is diagnosed and dropped rather than clamped, and an authored `0` differs from an absent value. Progress belongs to the entry, so an unscheduled entry can carry it even though only a scheduled row can show a fill.

Dependencies require an `entryRef`, a configured reference semantic type, or a list of either. A declaring entry lists its predecessors; A → B means A is B's declared finish-to-start predecessor. This version does not calculate date conflicts, lag, critical paths or schedules. Self references are diagnosed and omitted; cycles are diagnosed over the selected graph without dropping entries or edges.

Core emits identity/dependencies for every selected node, including unscheduled and invalid intervals. Only scheduled nodes receive temporal rows. Edges are `anchored` only when both endpoints have valid intervals. Filtered-out targets expose counts only, never target identity. Unresolved, duplicate and self-reference counts are separate. Existing index/schema errors remain authoritative; repeated binding failures are summarized on the View with at most ten candidate samples.

WebApp provides continuous local scrolling, sticky row titles and date headers, Today, date jump, day-width selection, keyboard row traversal and dependency connectors, which are drawn for every edge in a small timeline and for the selected row's edges once the row count makes drawing them all unreadable. Titles stay single-line. Bars carry their entry title as clipped decoration; the row's accessible name already states title and range, and a bar too narrow to read shows nothing because the sticky column names every row. Progress renders as a fill inside the bar and never changes where the bar starts or ends. Connectors carry an arrowhead, because direction is the whole content of a finish-to-start edge, and are drawn even when an endpoint row is outside the rendered window, since the geometry is arithmetic. A successor starting before its predecessor ends is ordinary data here, and its connector routes around instead of doubling back. Connectors stay inside the timeline track: one routing past the current view is cut off at the sticky title column and date header rather than drawn across them. The complete node/interval/predecessor list is available at every screen width. Static HTML and VS Code provide that complete list, not an interactive timeline.

Single-clicking a row's title or its bar selects that row without moving the viewport, and keyboard row traversal does not scroll horizontally either, so browsing rows never sends the view chasing bars across years. Double-clicking a title or a bar locates that row, and Enter locates the selected row from the keyboard: the bar start lands two day columns in from the left edge of the track and the row is centred under the header, regardless of where the view currently sits and of whether the date range reached that far before.

The timeline hides both scrollbars while retaining native horizontal and vertical scrolling. Use a trackpad or wheel to browse, date jump or Today to locate dates, and arrow keys, Page Up/Down, Home and End while the timeline is focused to navigate rows. Month/year headings occupy a separate band and center within the visible part of each month.

Navigation and materialized layout have explicit limits: renderable days span `0001-01-01` through `9999-12-30`, with `9999-12-31` reserved as the exclusive upper boundary. Unsupported jumps/width changes preserve the previous state and explain the limit. A data extent too large for the timeline falls back to the complete list rather than losing distant entries. Range, zoom and window are viewer state, not configuration keys.

## Calendar

Calendar binds explicitly configured scalar `date` or `datetime` schema fields. Field names and directories have no built-in scheduling meaning; strings that resemble dates are not inferred as temporal fields.

```yaml
schemaVersion: 1
kind: view
title: Exhibition Calendar
mode: calendar
source:
    type: pages
calendar:
    start:
        field: fields.opensOn
    end:
        field: fields.closesOn
    firstDayOfWeek: monday
```

The end binding is optional. Start and end must have the same schema type. `firstDayOfWeek` accepts `monday` (default) or `sunday`. Existing source, query, and sort rules apply before projection; runtime range parameters are not introduced.

- Civil dates remain calendar dates, independently of the host timezone. An authored end date is inclusive; no end means one day.
- Datetimes require an RFC 3339 offset. Core normalizes instants and derives covered calendar dates in `workspace.timezone`. Datetime ends are exclusive; a missing or equal end is a point event.
- Missing starts without ends appear in Unscheduled. Invalid dates, reversed ranges, orphan ends, and unsupported field types produce source-locatable diagnostics instead of inferred events. Dates must remain within years 0001–9999, including the normalized exclusive boundary.
- Existing ambiguous schema-membership errors still exclude affected pages before Calendar candidate selection.

WebApp provides a month grid, local month controls, expandable crowded dates, and Agenda (the narrow-screen default). Static HTML and VS Code provide complete date-grouped Agendas rather than interactive month grids. Events navigate to their source pages; no surface edits dates or schedules work. Static output does not depend on today's date.

The WebApp month grid uses four to six complete weeks, from the week containing the first day through the week containing the last day. Rows retain equal height. Date-header counts open the complete day list in a drawer.

Select the month heading to jump across months or years. The panel uses the browser's native month input, falling back to a date input when the month type is unsupported; a selected date opens its containing month. Choose or type a value, then press Enter or select Jump to apply it. Escape or clicking outside cancels the draft. Native picker appearance and navigation vary by browser and operating system.

Calendar can reuse Graph's classification color rules:

```yaml
calendar:
    start: { field: fields.opensOn }
    presentation:
        events:
            colorBy:
                taxonomy: areas
                # Alternatively: field: fields.category
```

Configure exactly one taxonomy or scalar frontmatter field. Taxonomy colors use the term's `display.color`, falling back to the taxonomy's color; unclassified or multiply classified entries remain neutral. Field values use the same deterministic palette and explicit `#RRGGBB` handling as Graph. Missing or unsupported values remain neutral. Omitting `colorBy` preserves the uncolored presentation. Invalid sources report `view.calendarColorByInvalid` or `view.calendarTaxonomyMissing`; more than 24 classified field values reports `view.calendarColorCardinalityHigh`.

Core projects the classification label and optional color. WebApp uses a uniform left border in month previews, Agenda, and the day drawer. The border retains its neutral theme color unless a valid classification color overrides it; text and backgrounds retain theme colors. Agenda and drawer entries also show classification text. Static HTML and VS Code preserve classification labels without requiring decorative color. Color never provides the only classification cue.

## Agent Skill

Add views after the underlying spaces and fields exist. Treat views as projections, not as hidden state.

Use `<!-- forma:content -->` when the rendered projection needs an explicit position in the Markdown body. When the marker is absent, clients append the projection to the end of the document. Multiple markers are invalid, and the legacy `<!-- forma-view -->` directive produces a migration diagnostic.

Render configured views with `forma view render <view-id-or-path> --json`. Use this for lists, tables, kanban boards, graphs, calendars, and Gantt timelines instead of introducing workflow-specific read commands.

For a Table column whose values should open the source Page for that row, declare `link.target: entry`. The current target set contains only `entry`.

Fields resolved from schema-declared entry references render automatically as links to their target Pages. A scalar reference renders as its target title; a reference list renders one target-title link per item. Their target links take precedence over `link.target: entry`, so do not configure that option on reference columns.

For the public `forma view render --json` output contract, see [forma view](../cli/view.md) (`cli.view`).
