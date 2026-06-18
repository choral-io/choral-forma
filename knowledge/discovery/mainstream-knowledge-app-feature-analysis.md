---
scope: project
type: competitor-analysis
owners: []
tags:
    - discovery
    - competitor-analysis
    - notes
    - knowledge-apps
---

# Mainstream Knowledge App Feature Analysis

## Purpose

Summarize major feature patterns from mainstream knowledge and note-taking applications, then prioritize them for Choral Forma as a lightweight, editor-independent, repository-backed team knowledge application.

## Sources

- [Obsidian core plugins](https://help.obsidian.md/plugins)
- [Obsidian Bases](https://help.obsidian.md/bases)
- [Obsidian Canvas](https://help.obsidian.md/plugins/canvas)
- [Obsidian Sync for teams](https://help.obsidian.md/teams/sync)
- [Obsidian Dataview community plugin](https://community.obsidian.md/plugins/dataview)
- [Obsidian Kanban community plugin](https://github.com/obsidian-community/obsidian-kanban)
- [Obsidian Tasks community plugin](https://community.obsidian.md/plugins/obsidian-tasks-plugin)
- [Obsidian Calendar community plugin](https://community.obsidian.md/plugins/calendar)
- [Foam wikilinks](https://foamnotes.com/user/features/wikilinks.html)
- [Foam Queries](https://docs.foamnotes.com/features/foam-queries/)
- [Foam Visual Studio Marketplace page](https://marketplace.visualstudio.com/items?itemName=foam.foam-vscode)
- [Foam graph visualization](https://docs.foamnotes.com/features/graph-view/)
- [Logseq GitHub repository](https://github.com/logseq/logseq)
- [Logseq DB version notes](https://github.com/logseq/docs/blob/master/db-version.md)
- [Notion product overview](https://www.notion.com/product/notion)
- [Notion database properties](https://www.notion.com/help/database-properties)
- [Notion API overview](https://developers.notion.com/guides/get-started/getting-started)
- [Dendron overview](https://wiki.dendron.so/)
- [Dendron features](https://wiki.dendron.so/notes/4bb85c39-d8ac-48ad-a765-3f2a071f7bc9/)
- [Dendron schemas](https://wiki.dendron.so/notes/60c03500-98e4-4a02-a31e-2702b4068a88/)
- [GitBook Git Sync](https://www.gitbook.com/features/git-sync)
- [GitBook concepts](https://gitbook.com/docs/getting-started/concepts)
- [MkDocs overview](https://www.mkdocs.org/)
- [Material for MkDocs navigation](https://squidfunk.github.io/mkdocs-material/setup/setting-up-navigation/)
- [Quartz authoring content](https://quartz.jzhao.xyz/authoring-content)
- [Quartz Obsidian compatibility](https://quartz.jzhao.xyz/features/Obsidian-compatibility)
- [Quartz wikilinks](https://quartz.jzhao.xyz/features/wikilinks)
- [Superthread documentation](https://superthread.com/docs/help/index)
- [Superthread pages and subpages](https://superthread.com/docs/help/pages-and-subpages)
- [Superthread projects](https://superthread.com/docs/help/projects-roadmap)
- [How Superthread uses Superthread internally](https://superthread.com/blog/how-we-use-superthread-internally)
- [Superthread CLI reference](https://superthread.com/docs/cli)
- [Astro Content Spaces](https://docs.astro.build/en/guides/content-spaces/)
- [Astro Content Spaces API reference](https://docs.astro.build/en/reference/modules/astro-content/)
- [Astro Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)
- [Use a CMS with Astro](https://docs.astro.build/en/guides/cms/)
- [Hugo configuration introduction](https://gohugo.io/configuration/introduction/)
- [Hugo templating introduction](https://gohugo.io/templates/introduction/)
- [Hugo functions quick reference](https://gohugo.io/quick-reference/functions/)
- [Hugo default function](https://gohugo.io/functions/compare/default/)
- [Hugo where function](https://gohugo.io/functions/spaces/where/)
- [Tolaria homepage](https://tolaria.md/)
- [Tolaria vaults](https://tolaria.md/concepts/vaults)
- [Tolaria editor](https://tolaria.md/concepts/editor)
- [Tolaria properties](https://tolaria.md/concepts/properties)
- [Tolaria relationships](https://tolaria.md/concepts/relationships)
- [Tolaria Git](https://tolaria.md/concepts/git)
- [Tolaria AI](https://tolaria.md/concepts/ai)
- [Tolaria view filters](https://tolaria.md/reference/view-filters)

## Context

Choral Forma should treat repository Markdown as the durable source of truth. This makes Obsidian and Foam especially relevant for local file workflows, Dendron and Quartz relevant for schema, graph, and publishing patterns, GitBook relevant for team review UX, and Notion relevant for collaborative polish and database-style knowledge views. Superthread is relevant as a product-management reference because it integrates tasks, projects, docs, comments, smart links, and meeting notes in one workspace. Astro Content Spaces and the Astro Content Layer are relevant as a reference for typed, validated content management over Markdown, data files, and remote content sources. Hugo is relevant as a mature files-first static site generator with split configuration, content frontmatter, and a powerful template language over project data, content, and configuration. Tolaria is relevant as a files-first Markdown desktop app that combines frontmatter properties, relationships, Git, views, media, whiteboards, and AI agent support.

The current repository's `knowledge/` directory is the development knowledge base for building Choral Forma. Its workflow rules guide this project's collaboration, planning, and delivery. They are not automatically product requirements for future Choral Forma workspaces, and they should not be treated as the application's user-facing feature set.

The key product question is not which existing app to copy. The useful question is which affordances are essential when the application layer must remain an adapter over explicit repository files and schemas.

## Product Priority Model

### P0: Foundation Required Before Application Code

These capabilities are central to Choral Forma and should shape the earliest product and architecture work.

| Capability | Why It Matters | Reference Pattern |
| --- | --- | --- |
| Repository files as canonical state | Prevents hidden app state and keeps Git, editors, and agents aligned. | Foam, Dendron, MkDocs, Quartz |
| Spaces, schemas, and frontmatter | Enables validation, routing, automation, and stable views without a proprietary database. | Astro Content Spaces, Astro Content Layer, Dendron, current Choral Forma workflow |
| Safe read/write operations | The app must make file changes that can be reviewed, diffed, reverted, and checked. | Tolaria Git UI, GitBook change requests, Git workflows |
| Fast search and file navigation | Users need immediate retrieval before richer graph or AI features matter. | Tolaria, Obsidian quick switcher, Foam, MkDocs |
| Wikilinks plus portable Markdown links | Lightweight relationships are useful, but syntax must remain documented and editor-independent. | Obsidian, Foam, Quartz |
| Backlinks and broken-link diagnostics | Repository knowledge needs visible relationships, missing targets, and safe rename behavior. | Obsidian backlinks, Foam placeholders |
| Local-only privacy boundaries | Project-local and user-private state need explicit boundaries from shared repository knowledge. | Current repository workflow, local-first note apps |
| Validation and formatting checks | Trust in the file store depends on repeatable checks for schema, links, and Markdown formatting. | CI/docs-as-code workflows |

### P1: Early Product Differentiators

These should follow the foundation because they make repository-backed knowledge usable for teams rather than only for individual note-taking.

| Capability | Why It Matters | Reference Pattern |
| --- | --- | --- |
| Reviewable knowledge changes | Teams need a readable workflow for proposed edits, diffs, comments, approvals, and merge state. | GitBook change requests, Git PRs |
| Schema-driven views | Users should see tasks, decisions, product notes, and discovery research as structured lists. | Obsidian Bases, Dataview, Foam Queries, Notion databases |
| Docs-to-work conversion | Users need a low-friction path from written context to trackable work without losing links. | Superthread pages to cards, GitBook comments, Notion tasks |
| Ownership and freshness signals | Team knowledge needs visible maintainers, reviewers, stale pages, and verified pages. | Notion wikis, GitBook review states |
| Task and Kanban integration | Planning status should remain explicit while still being easy to browse and update. | Obsidian Kanban, Obsidian Tasks, Notion projects, current Kanban file |
| Project health and update history | Long-running initiatives need concise status, staleness, and historical updates. | Superthread projects, Notion projects |
| Graph and local graph navigation | Graphs help reveal relationships, but should be practical filters over repository links. | Obsidian graph, Foam graph, Quartz |
| Publish or preview mode | Humans need a pleasant reading surface without adopting a proprietary knowledge store. | Quartz, MkDocs Material, GitBook |
| Conflict visibility | Concurrent edits should surface file conflicts, schema conflicts, and ownership conflicts. | Tolaria diffs/history, Git workflows, Obsidian Sync caveats |
| Agent-friendly operation log | Agent changes should be attributable, scoped, and reproducible from repository state. | Tolaria AI + Git, Git history plus workflow metadata |

### P2: Useful After Core Team Workflows Exist

These features can add value, but should not precede the source-of-truth and review foundations.

| Capability | Why It Matters | Reference Pattern |
| --- | --- | --- |
| Visual canvas or whiteboard | Useful for product mapping and architecture exploration, but secondary to canonical notes. | Obsidian Canvas, Logseq boards |
| Block-level references | Powerful for granular reuse, but can reduce portability if the syntax becomes app-specific. | Logseq, Obsidian, Foam |
| Transclusion and embeds | Useful for summaries and dashboards, but should resolve from files and remain inspectable. | Obsidian, Foam, Quartz |
| Advanced query language | Useful for power users, but initial users need schema views and search first. | Dataview, Foam Queries, Logseq queries, Obsidian Bases |
| Templates and snippets | Useful for consistent capture once schemas are stable. | Foam templates, Dendron snippets |
| Temporal navigation and reviews | Useful for date-based planning, weekly summaries, and research recency checks. | Obsidian Calendar, daily/weekly notes |
| Static site publishing pipeline | Valuable when sharing knowledge externally or internally as a polished site. | MkDocs Material, Quartz, GitBook |
| Import/export helpers | Useful for migration, but not part of the core authoring model. | Dendron pods, Obsidian importer |
| Content loaders and integrations | Useful after local files and schemas are stable, especially for external content sources. | Astro Content Loader API, Superthread CLI/API, Notion API |
| Media and durable whiteboards | Useful for richer knowledge capture if assets still live as inspectable repository files. | Tolaria media previews and Markdown whiteboards |

### P3: Defer Or Treat As Optional

These are not irrelevant, but they can distract from the repository-backed knowledge goal if introduced too early.

| Capability | Reason To Defer | Reference Pattern |
| --- | --- | --- |
| Real-time collaborative editing | Hard to reconcile with Git review and file ownership; can be additive later. | Notion, GitBook, Logseq DB |
| Proprietary cloud sync as default | Conflicts with repository Markdown as the source of truth. | Notion, Obsidian Sync |
| Rich block database as primary | Risks making Markdown an export format instead of canonical state. | Notion, Logseq DB direction |
| Plugin marketplace | Powerful but creates security, governance, and compatibility burden. | Obsidian community plugins |
| AI answers over the workspace | Valuable later, but only trustworthy after canonical documents, schema, and freshness are strong. | Notion AI, GitBook AI Search |
| Mobile-first capture | Useful but should not define the initial repository workflow. | Obsidian mobile, Logseq mobile |
| Flashcards and personal PKM extras | Good for individual learning but outside the first team knowledge scope. | Logseq SRS |

## Tool Observations

### Obsidian

Obsidian is the strongest reference for polished local Markdown note UX. Its core plugins cover backlinks, graph view, search, quick switching, properties, Bases, Canvas, templates, Sync, and Publish. Its main lesson for Choral Forma is that local files can support a rich product experience if the app treats indexes, views, and graph data as derived surfaces.

The caution is that Obsidian is still a proprietary app with app-specific configuration, plugin risk, and paid team sync/publish features. Choral Forma should borrow the reading, linking, graph, property, and local-first UX patterns without depending on Obsidian as the project fact store.

#### Obsidian Community Plugin Patterns

Dataview is important because it treats a Markdown vault as a queryable database. It pulls data from YAML frontmatter and inline fields, then renders tables, lists, task views, grouped results, sorted results, and filtered reports.

For Choral Forma, the Dataview lesson is that structured views should be generated from explicit file metadata and task lines. The product should prefer a constrained, deterministic query/view layer.

Foam Queries reinforce the same pattern in a more repository-friendly form. A `foam-query` block can render dynamic lists, tables, and counts from tags, paths, links, properties, backlink counts, and outlink counts. Foam also limits JavaScript-style querying to trusted workspaces, but Choral Forma should defer custom script execution and focus on safe declarative queries.

Obsidian Kanban is relevant because it provides a drag-and-drop board while keeping board data in Markdown. Choral Forma already has `knowledge/planning/KANBAN.md`, so the strongest idea to borrow is not a new planning source of truth. The useful pattern is a visual board that edits an explicit Markdown representation and keeps changes reviewable in Git.

Obsidian Tasks is relevant because it enhances normal Markdown task list items with due dates, recurring tasks, done dates, partial checklist handling, filters, grouping, sorting, and query blocks. It can mark tasks done from a query view and update the original source file. Choral Forma should treat this as evidence that Markdown-native task lines can support useful task workflows, but should avoid burying durable task state in ad hoc syntax before the task schema is stable.

Obsidian Calendar is relevant because it adds a month view for visualizing and navigating daily notes. It can open any daily note, create missing daily notes using the current daily-note settings and template, visualize how much writing exists for each day, and support weekly notes as another organizational layer.

For Choral Forma, Calendar's value is temporal navigation and periodic review, not a direct requirement to mirror this repository's development workflow. The current repository avoids shared `daily/`, `inbox`, `scratch`, and `drafts` directories because `knowledge/` is guiding this project, not modeling every possible user workspace that the future app may manage. A future Choral Forma UI can still evaluate daily and weekly notes as product features, especially for date picker navigation, weekly summary entry points, recency signals, and date-based review affordances for discovery research, planning, and task due dates.

### Foam

Foam is the closest fit to Choral Forma's current repository shape. It lives in VS Code, uses Markdown files in a workspace, supports wikilinks, backlinks, graph visualization, placeholders, templates, and Git-based collaboration. Foam also demonstrates that editor integrations can improve navigation without owning the knowledge store.

The limitation is product polish and audience breadth. Foam assumes VS Code and Git fluency. Choral Forma can keep Foam compatibility while building a more focused team workflow UI over the same files.

### Logseq

Logseq shows the appeal of block-level outlining, page and block references, tasks, queries, journals, graph navigation, and whiteboards. It is especially strong for personal knowledge composition and block reuse.

The caution is strategic: Logseq's newer DB direction shows how a richer product model can make Markdown incomplete as a fidelity-preserving format. For Choral Forma, any database or index should be rebuildable from repository files, not the canonical source.

### Notion

Notion is the benchmark for collaborative polish: docs, wikis, projects, databases, properties, relations, views, permissions, comments, templates, and integrations. It shows that non-technical teams value flexible structured views over raw file operations.

The limitation is fundamental for Choral Forma: Notion's canonical model is a proprietary cloud workspace. Markdown is an import/export or integration boundary, not the source of truth. Choral Forma should borrow database-view and verified-knowledge interaction patterns while keeping files canonical.

### Dendron

Dendron is the strongest reference for structured, developer-oriented Markdown knowledge. Its hierarchy, lookup, schemas, vaults, frontmatter, and publishing patterns are directly relevant to repository-backed knowledge at scale.

The limitation is product direction and adoption risk. Dendron is best treated as an architectural reference for schema-driven knowledge management, not as a runtime dependency.

### Astro Content Spaces

Astro Content Spaces are a useful reference for pattern-based notes and structured content. Astro models a space as a set of related entries loaded from local Markdown, MDX, Markdoc, YAML, TOML, JSON, or remote sources. Each space can define a loader and a schema, commonly through Zod, so entry data can be validated and queried with predictable fields.

The strongest product idea for Choral Forma is that structure can be declared at the space level. A user should be able to say that a set of files are experiments, decisions, customer notes, procedures, or tasks, then attach a schema, template, references, and views to that space. This is a cleaner model than treating every note as globally uniform or relying only on ad hoc tags.

Astro's `reference()` concept is also relevant. Choral Forma should support typed relationships between spaces, such as tasks referencing projects, decisions referencing proposals, experiments referencing hypotheses, or sales notes referencing accounts. These references should remain visible in Markdown and validated by the product.

The limitation is that Astro is a web framework content layer, not a knowledge application. Choral Forma should borrow the space mental model, schema validation, references, and typed queries, while keeping the user experience focused on reading, editing, health checks, and Agent collaboration.

### Astro As A Lightweight Content Management Model

Astro is not a traditional CMS. Its official CMS guidance treats external CMSes as optional content sources, while Astro itself provides a content layer that organizes, validates, queries, and renders content. This makes Astro a useful reference for Choral Forma because the management layer is declarative and file-friendly instead of a proprietary editing database.

Astro's content management model has several useful parts:

- Spaces define named sets of structurally related content.
- Loaders connect a space to local files, a single data file, remote data, a CMS, a database, or an API.
- Schemas validate content shape and provide editor/type support.
- Query APIs such as `getSpace()` and `getEntry()` give application code a stable way to access entries.
- Reference fields model relationships between spaces.
- Render APIs turn Markdown, MDX, or other supported content into displayable output.
- Build-time and live content modes separate static content from content fetched at request time.

For Choral Forma, the most valuable idea is a content-management pipeline over repository knowledge:

```text
source files -> space loader -> schema validation -> typed entries -> views,
queries, rendering, health checks, and Agent context
```

This pipeline maps well to a repository-backed knowledge app. Choral Forma can start with local Markdown loaders and later add optional loaders for other sources. Unlike Astro, Choral Forma should focus on editing and maintaining the knowledge itself, not generating web pages.

The product should avoid inheriting the web-framework assumptions. Spaces should remain user-facing knowledge structures, not only developer configuration. Non-software users should be able to create and modify spaces through GUI or Agent-assisted workflows without editing TypeScript configuration files.

### Hugo Template And Configuration Model

Hugo is relevant as a mature example of a files-first system that uses configuration, frontmatter, templates, and derived output without making the generated output the source of truth.

Hugo's template system is intentionally powerful. It is based on Go's `text/template` and `html/template` packages, and supports variables, functions, methods, conditionals, loops, context rebinding, partial templates, and pipelines. Its function catalog includes casting, space manipulation, comparison, formatting, path helpers, resource processing, string helpers, time helpers, and transformation functions.

The `default` function is especially relevant to Choral Forma's placeholder discussion. Hugo treats a default as a value chosen when the input is unset, with explicit rules for falsy values. That pattern is useful, but Choral Forma should avoid copying Hugo's full expression language into P0 templates. A lightweight create-input default system can provide most of the needed value without adding loops, conditionals, arbitrary functions, or a broad filter pipeline.

Hugo's `where` function is also relevant as a query design reference. It filters spaces by a key, operator, and value, with operators such as equality, ordering, membership, intersection, and pattern matching. Choral Forma's structured `all` / `any` query model covers a similar user need, but should stay declarative and type-checked so GUI and Agent consumers can inspect and explain queries without parsing a template expression language.

Hugo configuration also reinforces a useful design principle: concise defaults matter. Hugo supports both single config files and split config directories, but its documentation emphasizes keeping configuration short and defining only what deviates from defaults. Choral Forma should apply the same principle to `.forma/`: split files are useful when ownership is clear, but the default starter should avoid making users read a large configuration surface before writing notes.

Implications for Choral Forma:

- Use Hugo as a reference for durable file-based configuration, not as a feature checklist.
- Prefer explicit create inputs and defaults over a general-purpose template expression language in P0.
- Keep `{{ ... }}` placeholders path-oriented and inspectable.
- Do not add loops, conditionals, arbitrary functions, partials, or file/network access to P0 templates.
- Let structured view queries handle space filtering instead of embedding query logic in templates.
- Keep configuration concise even when the internal model is split across `settings.yml`, `types.yml`, `spaces.yml`, `templates/`, and `views/`. P0 should keep the user-authored Schema DSL in space configuration rather than requiring separate `.forma/schemas/` authoring files.

### Tolaria

Tolaria is a strong near-neighbor for Choral Forma because it is local-first, Git-first, and Markdown-based. A Tolaria vault is a folder the app reads and writes, with the filesystem as the source of truth and application cache derived from files. Notes are Markdown files with optional YAML frontmatter, and Tolaria uses the first H1 as the primary title while keeping the file on disk as the durable representation.

The first design pattern to borrow is a dual editing surface. Tolaria provides a rich block editor for daily writing and a raw Markdown mode for exact file control. Both write to the same Markdown file. Choral Forma should consider the same split: non-technical users need a comfortable GUI, while advanced users and Agents need precise access to Markdown and frontmatter.

The second pattern is frontmatter as a lightweight property layer. Tolaria uses properties such as `type`, `status`, `url`, and `date`, reserves underscore fields for system behavior, and allows custom fields. This is thinner than a heavy schema system but still gives the app enough structure for properties panels, filtering, navigation, and editing. It aligns with Choral Forma's current direction toward thin spaces and user-defined semantic types.

The third pattern is relationship fields backed by wikilinks. Tolaria treats any frontmatter field containing wikilinks as a relationship field and supports default relationship names such as `belongs_to`, `has`, and `related_to`. Choral Forma can borrow the idea that important relationships belong in structured fields where views, filters, graph navigation, and Agents can rely on them, while body links remain useful for natural writing.

The fourth pattern is Git as product UX. Tolaria can show note-level history and diffs, whole-vault history, commits, pulls, pushes, and automatic checkpoint commits after idle time or app inactivity. This validates the Choral Forma goal of hiding Git mechanics behind review, recovery, and history affordances for users who should not need to understand branches, commits, and diffs.

The fifth pattern is AI mode separation. Tolaria distinguishes coding agents that can inspect and edit a vault from direct model chats that use note context without vault-write tools. It also distinguishes safer file/search/edit modes from more powerful shell-enabled modes, and it avoids storing provider API keys in vault settings. This is directly relevant to Choral Forma's shared/local configuration boundary, secret handling, and Agent collaboration model.

Tolaria also offers useful secondary ideas: saved views as focused recurring questions, media previews that keep files inside the vault, markdown-backed whiteboards, table-of-contents navigation for long notes, and built-in product documentation for local AI agents.

The main limitation is that Tolaria appears closer to a general files-first Markdown app with AI and Git than to a configurable space/schema platform for many work domains. Choral Forma should learn from Tolaria's UX integration while keeping stronger emphasis on spaces, semantic types, shared versus personal knowledge/config layers, CLI/Skills-based health checks, and cross-industry adaptability.

### GitBook

GitBook is the strongest team review and publishing reference. Git Sync, branch-based change requests, visual editing, comments, review states, and docs publishing are valuable patterns for making repository-backed content usable by non-developers.

The limitation is that GitBook remains a hosted application platform. Choral Forma should study its review UX while making repository diffs and explicit files the durable artifact.

### Superthread

Superthread is a strong reference for combining task management and team documentation into one fast product workspace. Its documented model includes workspaces, spaces, boards, cards and child cards, statuses, tags, sprints, views, projects and roadmaps, pages and subpages, comments, mentions, smart links, integrations, notifications, and an inbox.

The most relevant design pattern is the tight loop from knowledge to execution. Superthread pages are real-time collaborative documents; selected text can be converted directly into a task card, and the selected text is replaced with a link to the card. Pages, cards, and comments share the same editor affordances, including Markdown shortcuts, tables, checklists, media, callouts, code blocks, and embeds. This suggests a Choral Forma feature direction where project notes, research summaries, and planning text can spawn trackable work while preserving source context and reviewable links.

Superthread also models strategic work at multiple levels. Projects live on a dedicated board that can be shown as board, list, or timeline; they carry statuses, health, assignees, start and due dates, tags, related or dependent projects, and health update history. Their internal workflow description uses a triage board, roadmap epics, shipped record, and child cards that can live on team-specific execution boards while remaining connected to the parent epic. This is a useful reference for Choral Forma if it later needs to bridge product context, task items, roadmap views, and cross-team execution without forcing all work into one flat Kanban board.

Superthread's speed-oriented interactions are also relevant: global search and Command-K style navigation, private quick notes, smart links between pages, cards, projects, and people, and CLI/API access for automation. The CLI is especially interesting for agent workflows because it exposes filtered card listing, card creation and updates, project creation, project health updates, and cross-object search.

The limitation is source-of-truth fit. Superthread is an application workspace, not a repository Markdown system. Choral Forma should borrow its interaction patterns for docs-to-work conversion, nested work breakdown, project health, and fast navigation, while keeping repository files and schemas as the durable state.

### MkDocs Material

MkDocs Material is a strong reference for a stable docs-as-code publishing pipeline. It shows how Markdown, YAML configuration, navigation, search, tags, and static hosting can provide a polished reading experience.

Its limitation is that it is primarily a generator, not an editing or workflow application. Choral Forma can use similar preview/publish ideas after the authoring and review model is clear.

### Quartz

Quartz is the strongest digital-garden publishing reference for Obsidian-like Markdown. It supports wikilinks, backlinks, graph views, tags, popover previews, frontmatter, search, and Obsidian-flavored Markdown compatibility.

Its limitation is that it is optimized for publishing personal or public gardens, not governed team workflows. Choral Forma can borrow its graph, search, and preview affordances while adding schema and review discipline.

## Implications For Choral Forma

Choral Forma should start with a deliberately small core:

1. Repository-aware Markdown reading and writing.
2. Schema-aware metadata editing and validation.
3. Search, quick navigation, backlinks, and broken-link diagnostics.
4. Reviewable change proposals that map cleanly to Git diffs.
5. Structured views over existing files, especially product, concepts, decisions, tasks, and discovery.
6. Markdown-native planning and TODO views that update explicit source files.
7. Context-preserving conversion from notes, research, or planning text into trackable work items.

The product should avoid early investments in real-time collaboration, rich block databases, plugin marketplaces, or AI answers until the canonical file model is reliable. Those features can become useful later, but only if they remain adapters over explicit repository state.

## Assumptions

- The initial user is comfortable with Markdown and Git-adjacent workflows, but the future app should reduce the amount of direct Git/editor knowledge needed.
- The project values team knowledge durability more than personal note-taking expressiveness.
- Application indexes, caches, and databases are acceptable only when rebuildable from repository files.
- Query and planning views should be deterministic by default; custom executable query extensions are outside the current scope.

## Open Questions

- Should Choral Forma prioritize a local desktop app, a web UI over a checked-out repository, or an editor extension first?
- What is the smallest schema-driven view that would be more useful than editing Markdown directly?
- How much Obsidian/Foam wikilink compatibility is enough without making those editor conventions mandatory?
- Should reviewable knowledge changes map directly to Git branches and commits, or should Choral Forma introduce an intermediate proposal layer first?
- What minimal query language is expressive enough for schema-driven views without requiring custom executable scripts?
- Should Markdown TODOs remain lightweight references to structured task items, or become a first-class task source alongside a configured task space?
- How should Choral Forma represent project health, stale updates, and cross-team child work while keeping repository files reviewable?
