---
scope: project
type: product
owners: []
tags:
    - product
    - direction
    - agent-collaboration
    - knowledge
---

# Product Direction

## Goal

Choral Forma should make complex project knowledge easier to maintain, read, and
reuse by both humans and AI Agents.

The product should help people maintain a structured, normalized, versioned
knowledge base that is friendly for human reading and reliable as Agent context.
Many human and Agent mistakes begin with insufficient context or low-quality
context; Choral Forma should reduce that failure mode.

## Users

Choral Forma should serve teams and individuals doing complex, process-heavy
work. This includes software, internet products, scientific research, sales,
manufacturing, operations, and one-person company workflows.

The product should not assume one team type, one industry, or one canonical
information architecture. It should be simple at the core and flexible enough
for users to create their own structures, schemas, modes, and templates.

## Product Principles

Choral Forma should not be treated as only a Markdown editor. It should become a
repository-backed knowledge compiler that continuously turns raw sources, human
decisions, Agent analysis, and project artifacts into auditable, linked,
maintainable canonical knowledge.

- Keep the core simple, like a general note or knowledge app, while allowing
  many usage patterns to emerge.
- Treat repository files as durable state, but do not assume users understand
  Git concepts.
- Support human-readable knowledge and Agent-friendly context as equally
  important outputs.
- Make structured knowledge approachable for non-software professional users.
- Prefer user-configurable structures over hard-coded product assumptions.
- Make hidden context, stale context, and poor context quality visible.
- Treat validation as diagnostic-first rather than enforcement-first because
  repository files remain directly editable throughout the product lifecycle.
- Model repeatable note types as spaces: a named set of related entries
  with a source location, schema, templates, references, and views.
- Keep spaces thin. They should explain files, not become a heavyweight
  database, permission, or workflow engine.
- Support user-defined semantic types instead of hard-coding product concepts
  such as people, projects, statuses, priorities, customers, or machines.
- Treat GUI and CLI as first-class product interfaces. Agent and Skill flows
  should assist and orchestrate product capabilities, not replace them.

## Relationship To Current Knowledge Workflow

The current `knowledge/` directory is not a direct product specification for a
future Choral Forma user workspace. It is the development knowledge base for
this repository and has its own workflow rules, schemas, member conventions,
planning model, and Agent skills.

At the same time, this repository's knowledge workflow is an early practice
ground for Choral Forma's product thesis. It should be treated as dogfooding,
prototype practice, and an evidence source for product design.

Practices that prove useful in this workflow should become candidates for
Choral Forma capabilities. Practices that are shaped by the current repository's
toolchain, historical choices, or development-team context should be abstracted
before being promoted into product requirements.

Working rule:

```text
current knowledge-workflow = early practice and evidence
future Choral Forma = productized capabilities abstracted from practice
```

The current workflow can therefore inform product design, but it should not
automatically constrain product workspaces. When a current workflow convention
conflicts with a cleaner product model, the product design should identify the
underlying user value, compatibility need, and migration cost before adopting or
rejecting that convention.

## Relationship To Choral Flows

Choral Forma and Choral Flows share the same underlying knowledge runtime thesis, but productize it for different users and interaction surfaces.

Choral Forma is the professional productization path. It keeps repository-backed Markdown, spaces, schemas, semantic types, structured views, reviewable diffs, health checks, and Agent-readable context close to the surface so knowledge maintainers and Agent workflow builders can control the structure directly.

Choral Flows is the business-user productization path. It hides repository and schema mechanics behind business objects such as Matter, Message, Handoff, Proposal, Work Record, Agent, Skill, and Knowledge Promotion so ordinary users can operate through work context rather than knowledge-engineering mechanics.

Working distinction:

```text
Choral Forma = professional knowledge engineering workspace.
Choral Flows = business collaboration runtime.
```

Choral Forma should not be treated only as a companion tool for Choral Flows. It can serve software teams, research teams, consulting teams, operations teams, one-person companies, and Agent workflow maintainers that need durable, reviewable, repository-backed knowledge. Choral Flows may later use Choral Forma-style capabilities to maintain Starter Kits, Agent Definitions, Skills, Workflow Definitions, and Knowledge Promotion materials, but the two products should keep separate user models and product surfaces.

A Choral Forma repository may also be consumed by Choral Flows as a Git-backed knowledge source. In that model, Forma remains the professional authoring and governance source, while Flows installs the repository as a Workspace Data Source and governs operational use through Workspace, Project, Matter, Agent, Skill, and permission policies. This should be treated as integration, not full migration from Forma into Flows.

Choral Flows does not face the same direct-file inconsistency problem because
users operate through product surfaces and knowledge documents are handled by
the server. Choral Forma has a larger inconsistency surface because repository
files remain directly editable. It should still borrow Choral Flows' broader
workflow idea: maintenance problems should become observable, attributable,
diagnosable, and repairable through structured findings, reviewable changes,
tasks, or Agent workflows instead of only being printed as errors.

## Behavior

### Flexible Knowledge Spaces

Choral Forma should let users define structures that fit their own work. A
future workspace may use notes, tasks, processes, decisions, research, meeting
records, designs, operating procedures, sales workflows, manufacturing checklists,
or other domain-specific documents.

Default templates and schemas can help users get started, but the product should
allow custom structures, schemas, modes, and templates instead of forcing the
current repository's `knowledge/` layout onto every user.

Astro Content Spaces are a useful reference for this model. In Choral Forma, a space should mean a group of related knowledge entries with a
defined source, schema, template, references, and view behavior. A space
could represent decisions, experiments, customer notes, manufacturing issues,
sales opportunities, operating procedures, or any domain-specific note type.

The important product idea is not Astro compatibility. The useful idea is that
"a pile of Markdown files" can become a typed, validated, queryable set without
turning Markdown into a database export format.

### Spaces And Schemas

Spaces should provide the bridge between a simple note app and structured
knowledge work.

Current product direction favors a thin space model. A space
definition should initially focus on:

- A name and human-readable purpose.
- A file source expressed as workspace-relative include and exclude globs.
- A schema for frontmatter or structured metadata.
- A default template for new entries.
- Simple membership invariants such as a frontmatter discriminator.
- Field semantic mapping and create-time defaults.
- Managed views such as list, table, kanban, and later calendar.

Schemas should make structure visible and checkable, but should not force every
workspace into one information architecture. Users should be able to start with
plain notes, then promote repeated patterns into spaces when the structure
becomes valuable.

More advanced concepts such as lifecycle rules, permissions, strict process
automation, complex loaders, and deep validation should remain outside the thin
space core until the product has stronger evidence.

Recommended MVP space responsibilities:

- Discover files.
- Validate metadata shape.
- Create new entries.
- Explain field semantics.

The space model should not become the first place for lifecycle policy,
permissions, workflow automation, executable hooks, or external data loading.

`include` should be the primary source field name rather than `path`. It should
be a required workspace-relative glob. The MVP can start with one include glob
string per space. `exclude` should be an optional list of workspace-relative
globs.

A file should match at most one space after excludes are applied. Multiple
space matches should be reported as health issues. Candidate files that
match `include` and are not removed by `exclude` should then be checked against
the space's schema. P0 space schemas should use a `kind` const field
as the frontmatter discriminator.

The Markdown body should remain free-form. Body structure constraints should be
expressed through templates and guidance rather than hard validation in the
space MVP. Health checks may warn about empty or obviously incomplete
bodies, but a file should not fail space membership only because its
headings differ from a template.

P0 should use a Forma-native YAML Schema DSL as the canonical object constraint
language. JSON Schema should not be the P0 authoring format. Runtime tools may
derive internal validation plans or exported JSON Schema from the Forma Schema
DSL when useful.

The Schema DSL should be used wherever Choral Forma needs object structure or
field constraints, not only for space entries. Future create inputs, update
inputs, view params, workflow inputs, starter manifests, and diagnostics can use
the same schema primitives instead of inventing separate constraint syntaxes.

Example P0 starter space:

```yaml
spaces:
    todos:
        title: Todos
        description: Lightweight action items.
        include: todos/**/*.md
        template: .forma/templates/todo.md
        create:
            directory: todos
            filename: "{{ input.slug }}.md"
            inputs:
                title:
                    field: title
                    required: true
                summary:
                    field: summary
                    default: ""
                slug:
                    label: Slug
                    type: string
                    default: "{{ input.title }}"
                    transform: slugify
        conventions:
            titleField: title
            summaryField: summary
            createdAtField: createdAt
        schema:
            type: object
            fields:
                kind:
                    type: const
                    value: todo
                    required: true
                title:
                    type: string
                    label: Title
                    required: true
                summary:
                    type: string
                    label: Summary
                status:
                    type: enum
                    enum: todoStatus
                    label: Status
                    required: true
                assignees:
                    type: list
                    label: Assignees
                    items:
                        type: ref
                        target: user
```

Space paths such as `template`, `create.directory`, and `create.filename`
should be workspace-relative paths, not knowledge wikilinks.
The default starter layout above means a todo entry for a user registration task
is `todos/user-registration.md`: `todos` is the space id, and `todos/` is
the space's default entry directory.

Space `schema` should describe entry metadata structure, user-facing
labels, and semantic field constraints. Useful P0 field properties include:

```yaml
status:
    type: enum
    enum: todoStatus
    label: Status
    description: Current delivery state.
    required: true
    readonly: false
    hidden: false
```

Use `label` for fields, enum values, buttons, and parameters. Use `title` for
content objects, spaces, views, and pages.

P0 Schema DSL primitives can include:

```text
object
string
number
integer
boolean
date
datetime
const
enum
ref
list
```

`required` should be field-local in the Forma Schema DSL, such as
`schema.fields.title.required: true`, rather than a JSON Schema-style
`required: [title]` array. Field-local required constraints are easier to merge,
patch, review, and edit with Agents.

`default` does not belong in space schema fields in P0. Defaults are
operation-level behavior and should live in create or update input
configuration, templates, runtime values, or later migration rules. `readonly`
and `hidden` should be treated as product and tool behavior hints, not security
permissions.

Space `conventions` can name common semantic fields such as `titleField`,
`summaryField`, and `createdAtField`. These conventions should help creation,
display, and Agent explanation, but they should not define view layouts. Health
checks should validate referenced schema fields. Fallbacks are allowed when no
convention exists, but they should be explainable; for example, title can fall
back from `title` to `name`, `displayName`, and finally the file basename.

Views should reference spaces by id. They should not redefine space
schema fields. Spaces should not define view layouts. Query operators
should be validated from space schema field types and cardinality. Display
fields, sort fields, kanban fields, and parameter references should be checked
against the target space and view parameter definitions.

### Semantic Types

Choral Forma should keep built-in data types small and allow users to define
domain semantics through configuration.

Base types can include strings, numbers, integers, booleans, dates, datetimes,
objects, lists, maps, and paths. Product concepts such as `user`, `group`,
`project`, `customer`, `machine`, `priority`, or `taskStatus` should be
user-defined semantic types rather than hard-coded system primitives.

Semantic types can be backed by:

- Static enums declared in configuration, such as status, priority, risk level,
  or review state.
- Entries from a space, such as users, customers, accounts, machines, or
  projects.

Space-backed types make a space's entries available as a type. For
example, a `users` space can define the allowed values for a `user`
semantic type. Other schemas can then use that type as a single value, a list
value, or a map key or value.

The MVP type model should support:

```yaml
types:
    todoStatus:
        kind: enum
        values: [todo, doing, done]

    user:
        kind: space
        space: users
        input:
            transform: slugify
```

Enum values can start as simple scalar values. Later versions can allow richer
value objects with label, icon, color, description, or ordering metadata.

Space-backed types imply knowledge reference behavior. Union types are a
useful future capability for closely related reference classes, such as users
and groups in an assignee field, but they should not be part of P0. When union
types are introduced, they should be constrained enough to remain explainable
and should not become a general-purpose way to combine unrelated data shapes.

Space-backed types may define input normalization for bare user-entered
values:

```yaml
types:
    note:
        kind: space
        space: notes
        input:
            transform: slugify
```

This applies only while parsing bare GUI, CLI, or Agent input. It does not change
stored ids, stored references, path matching, wikilink matching, schema
validation, template rendering, or exact reference comparison.

Example behavior:

```text
Galen -> slugify -> galen -> users/galen.md
users/Galen -> exact path-like input
[[users/Galen]] -> exact wikilink target
```

This is not title search. It only helps map human-entered labels to path ids
when the workspace follows slug conventions. P0 should support `slugify` as the
only type input transform.

Cardinality belongs on fields rather than type definitions. The same semantic
type can be used as a single value in one field and a space of values in
another field.

This lets Choral Forma support many domains without embedding industry-specific
objects in the product. The system provides composition mechanisms; users define
their own vocabulary.

### References In Metadata

Choral Forma should distinguish knowledge references from file, resource, and
configuration path references.

Knowledge references point to knowledge entries, such as users, groups,
projects, tasks, decisions, customers, machines, topics, or other user-defined
spaces. Fields with space-backed semantic types are knowledge
reference fields.

Knowledge reference fields may use wikilink syntax in Markdown metadata because
the user intent is to refer to a knowledge object, not to manipulate a raw file
path:

```yaml
assignees:
    - "[[users/tiscs]]"
project: "[[projects/choral-forma]]"
```

The product should use read-wide, write-strict behavior. Manually authored short
wikilinks such as `[[tiscs]]` are valid when they resolve uniquely within the
field's allowed target spaces. GUI, CLI, and Agent writes should prefer
path-qualified wikilinks such as `[[users/tiscs]]` to avoid ambiguity and make
diffs clearer.

The resolver scope should come from the field's semantic type. For example,
`assignees` can resolve only against allowed user spaces in P0, rather
than searching the whole workspace. Ambiguous short wikilinks should produce a
health check finding instead of being guessed.

File, resource, and configuration references should use workspace-relative path
strings instead of wikilinks:

```yaml
template: .forma/templates/task.md
source_file: attachments/acme-contract.pdf
```

The WebApp should treat WorkspaceFile as the first-class navigation object.
Knowledge documents, views, templates, config files, generated indexes, and
resources share the same file inventory shape, while server-assigned features
drive render and preview affordances.

Heading or block wikilinks should not be valid for space entry references
in the MVP. Alias wikilinks may be accepted where useful for display, but the
identity should resolve from the target part.

Internally, Choral Forma should normalize both short and path-qualified
knowledge wikilinks into typed resolved references. The initial resolved
identity can be the target file path. Queries, views, health checks, and Agent
tools should compare resolved references rather than raw string syntax.

### Schema Format

Choral Forma should not use code-based schema frameworks as the user-facing
schema configuration format in the product direction for the visible future.

Forma Schema DSL should be the user-visible schema layer. It avoids making
Node.js or a JavaScript runtime a hard dependency, keeps object constraints in
YAML alongside space configuration, and lets Choral Forma express product
semantics such as references, labels, readonly fields, and hidden fields without
custom JSON Schema extension keys.

JSON Schema can remain an export, compatibility, or advanced integration format
later, but it should not be required in the P0 minimal starter. Forma can derive
internal validation plans or exported JSON Schema from the Forma Schema DSL when
useful.

### Git-Backed Starter Kit Registry

Choral Forma should consider a Git-backed Starter Kit Registry so official teams, community contributors, and private teams can publish reusable knowledge workspace starter kits through ordinary repositories.

At a high level, a registry should let a repository declare one or more installable Starter Kits in a conventional, inspectable way. A Starter Kit should be able to initialize or extend a Choral Forma workspace with knowledge structures such as spaces, schemas, semantic types, templates, views, health checks, workflow rules, examples, and optional Agent or Skill guidance.

The registration mechanism should stay lightweight and repository-native. Choral Forma should be able to discover, inspect, and install a kit from an approved source without requiring a centralized marketplace in the initial product. Users should be able to preview planned file changes, review diffs, and run health checks before accepting the result.

Early design should treat Starter Kits as knowledge workspace structure, not as executable plugins. Arbitrary install hooks, shell scripts, network access, or post-install code execution should remain out of scope unless a later capability model explicitly governs them.

The exact declaration format, registry layout, kit reference syntax, trust model, and update workflow should be designed later.

### Starter Kit Initialization Principles

Starter Kit installation should initialize both knowledge content and workspace configuration. The generated workspace should include a `.forma/` configuration directory alongside repository-backed knowledge content.

Recommended responsibility split:

```text
.forma/ = workspace configuration.
knowledge/ = repository-backed knowledge content.
.agents/ = optional canonical Agent assistance layer.
```

`.forma/` must not become a hidden knowledge store. It should explain and configure repository files, not replace them as the source of truth.

Working rule:

```text
If users need to read, cite, review, or discuss it, it belongs in knowledge/.
If tools need to validate, render, create, or inspect it, it belongs in .forma/.
If Agents need to follow it as operational behavior, it belongs in .agents/ or AGENTS.md.
```

Starter Kit setup should ask for the canonical language and the supported languages. The canonical language remains the source-of-truth language for durable knowledge. Supported languages describe the languages the workspace intends to support for localized knowledge, labels, templates, Starter Kit copy, and future translation freshness workflows.

Starter Kits may initialize Agent compatibility content. Choral Forma should treat `.agents/` and `AGENTS.md` as the canonical Agent layer because they are broadly useful across Agent applications. Platform-specific entrypoints such as `CLAUDE.md`, `.claude/skills`, `GEMINI.md`, or similar files should normally be symlinks to the canonical Agent content.

Choral Forma targets professional users and may assume a development-like environment where repository-local symlinks are supported. Import wrappers or generated copies are exceptional compatibility fallbacks, not baseline product behavior. Compatibility entrypoints should derive from the canonical Agent layer rather than becoming independent sources of truth.

The P0 minimal starter should include enough structure to demonstrate Choral
Forma's knowledge, action, and lightweight collaboration model without becoming
an opinionated project-management workflow.

Recommended P0 minimal starter spaces:

```text
notes
todos
users
```

`notes` represents general knowledge notes. `todos` represents lightweight
action items. `users` represents people who can be referenced in the workspace.

The P0 starter should not include `groups` or union semantic types. Groups
introduce membership, responsibility, and organizational modeling that should
wait until P1. Todo assignment should still be modeled in a future-compatible
way:

```yaml
assignees:
    type: list
    label: Assignees
    items:
        type: ref
        target: user
```

When groups are added later, the `assignees` field can keep its name and list
shape while its item target evolves to an `assignee` union over `user` and
`group`.

The P0 `users` space should keep identity lightweight. A user entry's
stable id comes from its path, such as `users/tiscs.md`. P0 should not include a
separate `username` field because it would act like a field-level override for
path identity. Runtime current-user matching should use the user id directly.

`forma init` should not treat the current user as a special system value. If an
initial user entry is created during initialization, it should be handled as
ordinary starter input and created through the same space create pipeline
as any other user entry.

### Product Naming In Workspace Surfaces

Choral is the brand name; Forma is the product name. Product-specific workspace
surfaces should use Forma naming:

```text
CLI command: forma
configuration directory: .forma/
product docs: Choral Forma
brand and ecosystem references: Choral
```

The `choral` name should remain available for brand-level or future cross-product
capabilities instead of being consumed by the Forma MVP.

### Human And Agent Collaboration

The product should help humans and AI Agents maintain a shared context base.
Agents should be able to search, inspect, validate, summarize, and update
knowledge through explicit files, schemas, CLI commands, and skills.

When Agents assist with workflows such as conflict resolution, pull requests,
schema checks, or knowledge health checks, the product should guide the human
without requiring them to understand the underlying Git mechanics.

Agent and Skill flows should be an assistance layer over stable product
capabilities. Core actions such as creating spaces, editing semantic types,
building views, inspecting effective config, and running health checks should be
available through GUI and CLI. Agents can suggest, explain, draft, orchestrate,
and repair, but the product should not depend on Agents as the only way to use
these capabilities.

Manual edits, Git merges, incomplete drafts, stale derived artifacts, and Agent
work-in-progress may create temporary inconsistencies. Choral Forma should read
and inspect imperfect files with diagnostics where possible. Product commands
should avoid knowingly writing invalid content, while `forma check` should make
workspace inconsistencies explicit enough for humans or Agents to repair
manually or through future reviewable repair workflows.

### Executable Knowledge

Some process definitions should be stored as structured knowledge. Humans and
Agents should be able to follow those definitions to move work forward.

This should be treated as a product concept: process knowledge can define
expected inputs, states, checks, transitions, review points, and outputs. It is
not application code, but it should be executable enough for people and Agents
to coordinate consistent work.

### Shared And Personal Boundaries

The product must distinguish shared team knowledge, shared personal knowledge,
and local personal knowledge.

Shared team knowledge is committed to the repository and represents team-level
facts, structures, processes, decisions, or work context.

Shared personal knowledge is also committed to the repository, but remains
owned by or associated with a person. It can include public working style,
public research summaries, handoffs, responsibility notes, or personal context
that the team and Agents may safely use.

Local personal knowledge is not committed to the repository. It is for private
drafts, local execution plans, scratchpads, local preferences, and Agent runtime
state.

Personal content can be promoted into shared personal or shared team content
when it becomes useful beyond the local workspace. Shared content can also be
converted or split into personal working material when a person needs a local
execution plan, draft, scratchpad, or private context.

The product should make these transitions explicit and reviewable.

### Team And Local Configuration

The product should support team shared configuration and local personal
configuration in P0. Shared personal configuration has product value, but it
should remain a P1 or later capability until there are enough durable personal
preferences to justify the extra configuration layer.

Team shared configuration is committed to the repository and defines workspace
meaning: spaces, semantic types, schemas, templates, shared views, and
baseline health checks. Team-level changes should be made directly in the shared
base configuration; the MVP should not include shared team overrides.

Local personal configuration is not committed to the repository. It can store
temporary or sensitive preferences such as machine-local paths, private Agent
preferences, local scratch locations, UI state, secrets, or private connection
details.

The P0 merge order should be:

```text
team shared config -> local personal overrides -> runtime values
```

Runtime values are not written back into configuration files. They are available
for interpolation, effective configuration inspection, health checks, and view
or template rendering.

Recommended target layout:

```text
.forma.yml
.forma/
  types.yml
  taxonomies.yml
  views/
    *.yml
  templates/
assets/
```

Local overrides are optional and should be created only when the workspace
configuration explicitly includes them. If the conventional `.forma/` support
directory is used, it can include a `.gitignore` rule equivalent to:

```gitignore
overrides/local.yml
local/
```

Root ignore rules can also provide a safety net. The MVP does not need to create
`.forma/local/`; that directory can be introduced later for local runtime state
such as caches, locks, local indexes, or GUI state.

The core P0 rule is: team shared config defines workspace meaning; local
personal config defines private or temporary preference.

Future shared personal configuration can use the same override mechanism when
the product has enough committed, non-sensitive personal preferences to justify
it. A likely future path is:

```text
.forma/overrides/users/<user-id>.yml
```

If introduced, shared personal overrides would sit between team shared config
and local personal overrides in the merge order.

Strict team enforcement is not an initial requirement. The more important need
is a clear merge model and Agent-friendly CLI or skills that can explain the
effective configuration, show where each value came from, and check knowledge
health, configuration consistency, schema validity, and local override effects.

MVP override semantics should remain simple and explainable:

```text
object: deep merge
array: replace
scalar: replace
null: explicit empty value
missing: inherit
delete/unset: not supported
array append/remove: not supported
same-layer conflict: invalid unless a file boundary explicitly owns it
```

Configuration sections and included files should have clear responsibility
boundaries:

```text
.forma.yml owns the main configuration entry and includes.
workspace owns identity, root, language, timezone, and logo.
runtime owns runtime values.
types.yml owns semantic types.
taxonomies owns configured classification systems such as starter spaces.
templates/ owns create-time content templates.
views owns saved projection definitions.
navigation owns sidebar and prominent route/page/view groups.
```

The effective configuration should be inspectable instead of hidden. CLI and
Agent-facing interfaces should be able to show the merged configuration, explain
which source produced a specific value, and check for merge conflicts, invalid
types, circular references, local-only leakage, and values that depend on the
current machine.

The product should avoid writing an effective configuration file as a durable
source of truth. If caching becomes necessary, caches should live under
`.forma/local/cache/` and remain uncommitted.

### Managed Views

Views should be managed Markdown definitions under `.forma/views/**/*.md`.
They are file-based facts, but not ordinary knowledge notes. Their frontmatter
defines rendering behavior; their Markdown body explains purpose, usage, and
maintenance context.

The durable architecture for view sources and queries is captured in
[[architecture/forma-view-query-model]]. This section keeps the product-facing
behavior and examples aligned with that model.

Shared view definitions should live under `.forma/views/`, not in the ordinary
knowledge content tree. A view is configuration for rendering, filtering, and
organizing knowledge; it is not itself a domain knowledge entry. Keeping view
definitions under `.forma/` preserves the file-as-fact principle while making
the boundary clear.

The view file should be recognizable through explicit frontmatter:

```yaml
---
kind: forma-view

view:
    surface: page
    mode: table
    space: todos
    title: My Todos
    description: Active todos assigned to the current user.
---
```

The view data source should be the workspace. `source` selects the candidate
file set; `query` filters normalized entries derived from those files.
Taxonomy-oriented views may keep a readable shorthand such as `taxonomy` and
`term`, but it should be treated as a query shortcut rather than a separate
source kind. This:

```yaml
view:
    surface: page
    mode: table
    taxonomy: spaces
    term: todos
```

is equivalent to:

```yaml
view:
    surface: page
    mode: table
    source:
        kind: workspace
    query:
        all:
            - target: taxonomy.spaces
              op: equals
              value: todos
```

This keeps graph, file navigation, uncatalogued documents, and future
repository-wide renderings on the same source model without forcing every view
through space-specific semantics.

The Markdown body should not contain query logic. It can include a render mount
point:

```markdown
<!-- forma-view -->
```

If no mount point exists, the rendered view should appear after the Markdown
body. If multiple mount points exist, health checks should report the problem.

Views should have a surface:

```text
page
embed
```

P0 managed views should only require directly accessible `page` views. `embed`
views and view embedding syntax are important P1 design targets, captured here
to protect the model, but they should not be treated as required for the P0
starter or first implementation.

`page` views are directly accessible full views. They can appear in view
navigation, have complete page layout, and expose filtering or sorting controls
where the mode supports them.

`embed` views are reusable view fragments intended for inclusion inside other
Markdown documents. They should not appear in ordinary view navigation by
default. They can still be inspected or previewed for maintenance.

The MVP should keep one primary surface per view file. If a team needs both a
page view and an embedded fragment, it can define two view files with related
queries. Shared query abstraction can wait until there is stronger evidence.

View definitions may support declared parameters. P0 page views may omit
parameters entirely. View parameters are optional for P0 page views and should
be required when P1 embedded views ship. Parameters can have base types or
user-defined semantic types, can have defaults, and can be referenced from view
metadata, query values, mode-specific configuration, and body text:

```yaml
view:
    params:
        user:
            label: User
            type: user
            required: true
            default: "{{ runtime.values.currentUserId }}"
        date:
            label: Date
            type: date
            default: "{{ runtime.values.currentDate }}"
```

Page view parameter values can come from defaults, URL or GUI state, or CLI
parameters. Embedded view parameter values should come from the embedding
comment, falling back to defaults where available. Unknown parameters, missing
required parameters, and invalid parameter values should be diagnostics.

Embedded view parameters are required for a useful embed model. Without them,
teams would need one view definition for every member, project, or reporting
period. P1 embedded views should therefore include parameter support rather than
shipping fixed-only embeddings.

Knowledge documents should be able to embed existing views with Markdown HTML
comments:

```markdown
<!-- forma-view: user-active-todos user="users/tiscs" -->
<!-- forma-view: project-open-tasks project="{{ params.project }}" -->
```

The identifier should resolve to a view file, such as
`.forma/views/user-active-todos.md`. Embed arguments should be type-checked
against the target view's `view.params`. The initial argument model should stay
small: string, number, boolean, date, semantic reference literals, and `{{ ... }}`
path placeholders. It should not support expressions, loops, conditions, or
complex object literals.

Definitions and embeddings are separate concepts:

```text
.forma/views/*.md = view definition
knowledge Markdown comments = view embedding sites
```

View queries should operate on normalized entry records, not directly on raw
Markdown files. The runtime should first parse each candidate Markdown file into
an entry record with stable namespaces such as:

```ts
entry = {
    path: "todos/review-webapp.md",
    taxonomies: {
        spaces: "todos" | null,
    },
    kind: "todo" | null,
    frontmatter: {},
    refs: {},
    text: {},
};
```

The query model should use structured `all` / `any` / `not` nodes rather than a
text query DSL in the MVP. Query predicates should use explicit `target` paths
into the normalized entry record:

```yaml
query:
    all:
        - target: taxonomy.spaces
          op: equals
          value: todos
        - target: frontmatter.status
          op: in
          value: [todo, doing]
        - any:
              - target: frontmatter.priority
                op: equals
                value: high
              - target: frontmatter.blocked
                op: equals
                value: true
```

This query model should be treated as the internal query AST. A future text DSL
can compile to the same model if product evidence justifies it, but the MVP
should avoid taking on parser, type-checking, error-reporting, and GUI
round-tripping complexity too early.

Initial query operations can include:

```text
equals
notEquals
in
notIn
contains
notContains
intersects
exists
before
beforeOrEqual
after
afterOrEqual
```

`exists` should use an explicit boolean `value`. For example, uncatalogued
Markdown can be expressed without a special `missing` operator:

```yaml
query:
    all:
        - target: taxonomy.spaces
          op: exists
          value: false
```

P0 can keep query support intentionally small: `source.kind: workspace`,
`source.include`, `source.exclude`, `all`, `any`, `not`, `target:
taxonomy.<id>`, `target: frontmatter.<field>`, and the operations `equals`,
`in`, `contains`, and `exists`. References, full-text predicates, date
comparisons, diagnostic filters, and saved runtime query controls can remain P1
unless needed by implementation evidence.

View modes should start with `list`, `table`, and `kanban`. Calendar views are
valuable for daily, weekly, monthly, and time-based workflows, but should remain
P1 unless implementation capacity proves otherwise.

Graph should also be treated as a view mode, not as a separate global product
surface. Users should open graph views through normal view navigation, tabs, or
links, the same way they open table or kanban views. A graph view can visualize
references, backlinks, relationship fields, or a scoped subset of entries, but
it should still be described by a view definition with explicit scope and
rendering intent. Bottom relationship panels can show backlinks, outgoing links,
and mentions for the current document, but they should not be the primary graph
surface.

Graph views can use the same workspace source without a space filter. For
example, an initialized workspace can include a global graph view:

```yaml
view:
    surface: page
    mode: graph
    title: Knowledge Graph
    source:
        kind: workspace
        include:
            - "**/*.md"
        exclude:
            - ".forma/**"
            - "**/local/**"
```

This is not a cross-space table query. It is a graph rendering over the
workspace file inventory and reference index, so it can include space
entries, uncatalogued Markdown documents, and cross-space links without
making every view mode support arbitrary space joins.

List and table views can use shared `query` and `sort` fields, plus
mode-specific rendering options such as title fields, subtitle fields, metadata
fields, or table columns.

Kanban views should support richer configuration because process-heavy work is
central to the product. A kanban view should first select candidate cards with
the top-level `query`, then assign cards to columns with `kanban.columns[].query`.
Columns are evaluated in order and the first matching column wins. Health checks
should warn about overlapping columns and unmatched items.

Example kanban configuration:

```yaml
kanban:
    card:
        titleField: title
        subtitleFields: [project, assignees]
        badgeFields: [priority, dueDate]
    columns:
        - id: todo
          label: To Do
          icon: circle
          query:
              all:
                  - target: frontmatter.status
                    op: equals
                    value: todo
          onDrop:
              set:
                  status: todo
        - id: blocked
          label: Blocked
          icon: octagon-alert
          query:
              all:
                  - target: frontmatter.blocked
                    op: equals
                    value: true
          onDrop:
              set:
                  blocked: true
```

Drag-and-drop mutation should be explicit. If a column has complex matching
logic, the product should not guess how to update a card. `onDrop.set` should
declare the exact field changes that moving a card into the column will make.

View health checks should report missing spaces, missing fields, missing
parameters, incompatible operators, invalid default or query values, invalid
sort or display fields, invalid kanban `onDrop.set` fields, overlapping kanban
columns, unmatched kanban items, and multiple render mount points.

Cross-space list, table, and kanban views should remain out of the MVP.
The initial space view model should make one space understandable and
useful before trying to join multiple spaces. This limitation does not
prevent graph views from using the workspace source without a space filter.

Runtime temporary query controls, runtime filters, runtime group-by controls,
runtime sort overrides, and saved personal view controls are not part of the
current direction. Future table views may add advanced table features, but that
should be discussed separately from the P0 managed view model.

Agents should read the same view definitions that human-facing UI uses. View
definitions should not contain a separate Agent-only context policy. Agents can
use `view.query`, `view.params`, space schema fields, semantic types, and
future view rendering APIs to find candidate entries, then decide which entries
to inspect based on the task.

This keeps responsibility clear:

```text
View = selection and display definition.
Agent = task-specific context choice using the same workspace structures.
```

Agent-friendly output formats such as `--json` are product interfaces, not a
second configuration model. Agent-only workspace configuration should be avoided
unless there is a strong safety, permission, or interoperability reason.

### Runtime Interpolation

Configuration files and template files should support limited runtime
interpolation with `{{ ... }}` placeholders.

Interpolation should initially be path lookup only. It should not support
expression evaluation, function calls, loops, conditionals, shell execution,
JavaScript execution, arbitrary environment access, file reads, or network
requests.

MVP placeholders can include:

- `{{ input.<name> }}`
- `{{ params.<name> }}`
- `{{ runtime.values.currentDate }}`
- `{{ runtime.values.currentDateTime }}`
- `{{ runtime.values.workspaceRoot }}`
- `{{ runtime.values.currentUserId }}`
- `{{ config.<dotted.path> }}`

Configuration references should resolve against the effective config after team
shared config and local personal overrides are merged. The resolver must detect
circular references and report them clearly instead of silently producing
partial values.

Runtime values should be explicit definitions under `runtime.values.*`. In
configuration files, `runtime.values.<name>` defines how to resolve the value.
In templates, view params, and resolved contexts, `runtime.values.<name>` reads
the resolved value.

P0 runtime value kinds can include:

```text
const
gitConfig
currentDate
currentDateTime
workspaceRoot
```

Example:

```yaml
runtime:
    values:
        currentDate:
            kind: currentDate
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
        currentUserId:
            kind: gitConfig
            key: user.name
            transform: slugify
```

Local overrides can replace runtime value definitions with the same shape:

```yaml
runtime:
    values:
        currentUserId:
            kind: const
            value: tiscs
            transform: slugify
```

P0 should not include a separate `memberIdResolver` concept. Current-user
identity should instead be modeled as `runtime.values.currentUserId`, a normal runtime
value whose provider can normalize environment data into a user id. Member-like
or user-like behavior should be derived from spaces, semantic types, and
runtime values rather than hard-coded resolver names.

The resolver chain should remain explicit and inspectable. CLI and Agent tools
should report which runtime value definition produced a value, which definition
source won after overrides, and why a value is unresolved.

Template files can use runtime placeholders when creating new entries.
Committed knowledge entries should generally store resolved concrete values
rather than dynamic placeholders as durable facts.

Hugo is a useful reference for mature file-based templates, but Choral Forma P0
should not adopt Hugo's full template expression model. P0 templates should use
simple path placeholders only. They should not support default operators,
filters, functions, conditionals, loops, includes, partials, expression
evaluation, or arbitrary scripting.

Create input defaults can use the same simple placeholder syntax:

```yaml
create:
    inputs:
        date:
            label: Date
            type: date
            default: "{{ runtime.values.currentDate }}"
```

Template placeholders should then stay simple:

```yaml
date: "{{ input.date }}"
```

This keeps defaults inspectable in space configuration instead of burying
them in template expressions.

Create inputs may also define a small operation-level transform:

```yaml
create:
    inputs:
        title:
            field: title
            required: true
        slug:
            label: Slug
            type: string
            default: "{{ input.title }}"
            transform: slugify
```

Transforms are not template functions. They normalize final input values during
the create pipeline before filename and template rendering. Runtime value
definitions can also use transforms to normalize provider output before the
resolved value is exposed to templates or views. P0 should only support a
`slugify` transform. `slugify` should be deterministic and safe for filenames:
trim, lowercase where applicable, normalize whitespace to hyphens, remove path
separators and reserved filesystem characters, collapse repeated hyphens, strip
leading and trailing hyphens, keep Unicode letters and numbers, and fail if the
result is empty.

Future versions may introduce a small declarative DSL for lightweight type
conversion, data-structure transformation, filtering, or cleanup. This should
remain separate from arbitrary scripting.

### Create, Edit, And Inspect Flows

Space-backed create flows should be predictable and reviewable:

```text
choose space
-> collect input
-> generate path
-> render template
-> validate
-> write file
-> show diff/result
```

Example:

```sh
forma create tasks --title "Draft reference model"
```

Creation should use `space.create.directory` and
`space.create.filename`. `input.*` placeholders are create-time values only.
Templates can use input, runtime, and configuration placeholders, but committed
knowledge entries should store resolved concrete values where possible.

Create inputs are operation parameters, not runtime space schema
definitions. Space schema fields and create inputs are separate namespaces.
A create input may explicitly bind to a schema field:

```yaml
create:
    inputs:
        title:
            field: title
            required: true
```

The binding explains that the input corresponds to `space.schema.fields.title` for
type checking, GUI labels, Agent explanation, and diagnostics. Same-name inputs
and schema fields do not bind implicitly. If `field` is absent, the input is a
create-only parameter even when it has the same name as a schema field.
Templates still decide how inputs are written into generated files.

P0 create input properties can include:

```text
field
label
description
type
required
default
transform
```

The metadata creation flow should be:

```text
resolve create inputs -> render filename and template -> validate Forma schema
```

Input resolution should treat inputs as a dependency graph:

1. Load declared inputs and explicit user values.
2. Build dependencies from `default` placeholders that reference `input.*`.
3. Validate that referenced inputs exist and that there are no cycles.
4. Resolve inputs in dependency order.
5. For each missing input, render its default after dependencies are resolved.
6. Apply the input `transform`, if configured, to explicit or defaulted values.
7. Type-check final values and enforce `input.required`.

Dependencies read another input's final value after its transform. Template and
filename rendering happens only after all inputs are resolved.

Semantic field context should control serialization. For example, if
`assignees` is a many-valued `user` reference field, a user id can be serialized
as a path-qualified user wikilink. The write should fail before creating an
invalid space entry.

The MVP should not require bulk creation, loops, executable hooks, overwrite
modes, or multi-file transactions.

Editing should prefer typed patches first and raw edits second. The product
should support three levels:

- Structured edit for normal use.
- Raw metadata edit for advanced users and tools.
- Body edit using ordinary Markdown editing.

Examples:

```sh
forma set todos/foo.md status doing
forma add todos/foo.md assignees users/tiscs
forma remove todos/foo.md assignees users/tiscs
forma unset todos/foo.md dueDate
```

`set` should replace a single-value field or replace the whole value of a
many-valued field. `add` and `remove` should operate on many-valued fields.
`unset` should remove a field. A later `clear` command can explicitly set a
field to null if that distinction becomes important.

Reference input should be permissive when the field context is known. Users and
Agents may provide values such as `tiscs`, `users/tiscs`, `[[tiscs]]`, or
`[[users/tiscs]]` for an assignees field. Product writes should normalize
resolved references to path-qualified wikilinks. Many-valued reference fields
should deduplicate by resolved identity, not by raw string.

Edits should preserve YAML ordering, unknown fields, comments where practical,
and the Markdown body. The product should avoid full-document rewrites for small
metadata changes. Validation should run before writing, and force writes should
remain out of the MVP.

P0 Agent-facing tooling should use stable read, check, and create commands such
as:

```sh
forma config inspect
forma inspect
forma list
forma create
forma check
```

P1 structured edit commands can add:

```sh
forma set
forma add
forma remove
forma unset
```

Entry locators should support:

- Workspace-relative Markdown paths.
- Workspace-relative paths with the `.md` extension omitted.
- Explicit space-scoped lookup with `--space <space-id>
<entry-name>`.

Recommended Agent-safe form:

```sh
forma inspect --space todos user-registration --json
```

For space-scoped lookup, `<entry-name>` should mean a file basename without
`.md` inside the space's include and exclude result. No-match and
multiple-match cases should be errors with suggestions to use a path locator or
create a new entry.

Space-scoped bare entry locators may use the corresponding
space-backed type input normalization when such a type exists. For example,
`forma inspect --space notes "Meeting Notes"` can normalize the bare entry
name to `meeting-notes` before exact lookup. Path-like locators remain exact and
should not be normalized.

With the starter todos space, `forma inspect todos/user-registration` is a
path-like locator for `todos/user-registration.md`, while
`forma inspect --space todos user-registration` resolves the same entry
through the `todos` space.

P0 CLI should prioritize reading, indexing, checking, and inspection before safe
write operations, while still including initialization and minimal create so the
starter can be used end to end. Required P0 commands:

```text
- forma init --name <name> [--language <tag>] [--timezone <iana>] [-y|--yes]
- forma config inspect [--json]
- forma config inspect --path <path> [--json]
- forma check [--json]
- forma inspect <path> [--json]
- forma inspect --space <space> <entry> [--json]
- forma list --space <space> [--json]
- forma create <space> [--input <name=value>]... [--json]
- forma serve

P1:
- forma set <entry> <field> <value>
- forma add <entry> <field> <value>
- forma remove <entry> <field> <value>
- forma unset <entry> <field>
- forma deprecate <entry>
- forma delete <entry>
- forma move <from> <to>
- forma rename --space <space> <old> <new>
- search/query commands
- fix plan/apply commands
- local full index
```

All read commands should support stable JSON output for GUI and Agent use.
Human-oriented output should remain concise and explainable.

`forma init` should create the P0 minimal starter without sample entries, create
`.forma.yml` and referenced support files, and fail on path conflicts. `forma
create` should use configured create inputs, defaults, transforms, and
templates, fail on path conflicts, and report any read-model refresh or
persistent-index follow-up explicitly instead of rebuilding automatically.

CLI confirmation should be based on operation risk. Read-only commands should
not ask for confirmation. Single-file, predictable, non-destructive writes can
avoid confirmation when they fail on conflicts or invalid inputs. Initialization,
physical deletion, path moves or renames that change references, automatic
fixes, batch updates, and multi-file or reference-changing writes should require
confirmation.

In P0, only `forma init` requires confirmation because it creates the starter
workspace structure. Interactive shells should show the
resolved initialization parameters and planned starter writes before asking for
confirmation. Non-interactive shells such as CI should fail without writing
unless `-y` or `--yes` is provided. `forma create` does not require confirmation
in P0 because it writes one new entry and fails on path conflicts.

### Lifecycle And Deletion

Entry lifecycle should distinguish knowledge status from file operations.

Lifecycle should remain outside the P0 minimal starter until its field model,
view behavior, check behavior, and Agent context behavior are designed together.
The product should avoid adding implicit lifecycle semantics to ordinary schema
fields. If lifecycle interpretation is introduced later, it should be configured
explicitly rather than inferred only from a field name.

Deprecation remains an important future lifecycle operation. A deprecated file
should stay at its original path and remain readable, searchable, and directly
openable, while future views or context builders can explicitly decide whether
to include it.

The dedicated deprecation command should be P1, earlier than archive or merge:

```sh
forma deprecate decisions/old-auth.md --reason "Superseded by the new auth model"
forma deprecate decisions/old-auth.md --replaced-by decisions/new-auth.md
forma deprecate --space decisions old-auth --replaced-by decisions/new-auth
```

The exact lifecycle schema, replacement relationship, view filtering, and
context behavior should be decided with the P1 deprecation design. A separate
`undeprecate` command is not required in the initial deprecation design;
restoring active status can remain a deliberate metadata edit until product
evidence justifies a first-class command.

Delete should be a dangerous but legitimate future first-class action. Choral
Forma is intended for professional, repository-backed workspaces, so the product
does not need a heavy application-level recycle bin. Physical deletion should be
allowed once the command is designed, and version control can provide history
where users adopt it.

Deletion still needs explicit tooling because it affects references:

```sh
forma delete decisions/old-note.md
forma delete decisions/old-note.md --replace-with decisions/new-note.md
```

P1 delete behavior should inspect affected references, show the planned change,
physically delete the file when confirmed, and run or recommend a follow-up
check. `--replace-with` should rewrite references that can be safely resolved
and report anything ambiguous. More advanced reference cleanup options can wait.

Path should remain the default entry identity in the MVP. Controlled move and
rename commands should be the preferred migration path because they can update
references and keep space membership valid:

```sh
forma move todos/old-name.md todos/new-name.md
forma rename --space todos old-name new-name
```

Direct filesystem edits should remain allowed. `forma check` should detect
broken references, invalid space membership, ambiguous short wikilinks,
stale views, and other consequences before review or commit.

### In-Memory Read Model

The first public release should not use a committed summary index. The local
server and read operations scan source files and configuration, then keep the
read model in memory.

The MVP should not include a committed summary index or a local full index such
as `.forma/local/index.json`. A persistent index, SQLite backend, watcher, or
vector index can be introduced later only after a fresh design if workspace
size, GUI latency, local overrides, or semantic search make them necessary.

The read model is derived runtime state, not a knowledge store:

```text
source files win
read model supports discovery, graph traversal, and context selection
read model can always be rebuilt in memory
```

Runtime read-model projections should not contain absolute paths, local override
results, private local files, runtime identity, user behavior traces, full
frontmatter, full Markdown bodies, diagnostics, check summaries, health state,
effective config, rendered HTML, or rendered view results.

Recommended shape:

```json
{
    "schemaVersion": 1,
    "workspace": {
        "name": "Acme Knowledge",
        "canonicalLanguage": "en",
        "supportedLanguages": ["en"]
    },
    "spaces": [
        {
            "id": "todos",
            "title": "Todos",
            "include": "todos/**/*.md",
            "entryCount": 1
        }
    ],
    "views": [
        {
            "id": "todos",
            "path": ".forma/views/todos.md",
            "surface": "page",
            "mode": "kanban",
            "space": "todos",
            "title": "Todos"
        }
    ],
    "entries": [
        {
            "path": "todos/user-registration.md",
            "space": "todos",
            "kind": "todo",
            "title": "User registration",
            "summary": "Implement user registration flow.",
            "refs": [
                {
                    "source": "frontmatter",
                    "field": "assignees",
                    "targetPath": "users/tiscs.md",
                    "semanticType": "user",
                    "intent": "reference"
                },
                {
                    "source": "body",
                    "targetPath": "notes/account-model.md",
                    "semanticType": "note",
                    "intent": "link"
                },
                {
                    "source": "body",
                    "targetPath": "notes/project-brief.md",
                    "semanticType": "note",
                    "intent": "embed"
                }
            ]
        }
    ]
}
```

By default, serve/check operations should full-scan shared source files and
shared configuration into memory. P0 does not need true incremental indexing.
P0 should not expose persistent `index rebuild` or `index check` behavior.

Diagnostics are runtime results that belong to `forma check`, `forma serve`, or
shared RPC responses; they should not be persisted as a separate diagnostics
result file.
Effective configuration belongs to `forma config inspect`; view results belong
to view rendering.

Future implementation caches may accelerate checks, parsing, or diagnostics, but
they should be local-only, rebuildable, and stored under `.forma/local/cache/`.
They must not become product facts or public Script/Agent interfaces.

### Check Diagnostics

`forma check` should be read-only and diagnostic-first. It should not repair
files in P0. Human output should be concise, while `--json` should provide
stable structure for Agents, scripts, and GUI.

Recommended P0 JSON shape:

```json
{
    "status": "failed",
    "summary": {
        "errors": 1,
        "warnings": 2,
        "infos": 0
    },
    "diagnostics": [
        {
            "severity": "error",
            "code": "ref.unresolved",
            "message": "Reference cannot be resolved.",
            "path": "todos/user-registration.md",
            "location": {
                "kind": "frontmatter",
                "field": "assignees",
                "index": 0
            },
            "actual": "[[users/tics]]",
            "expected": {
                "type": "ref",
                "target": "user"
            },
            "suggestions": [
                {
                    "label": "Use users/tiscs",
                    "value": "[[users/tiscs]]"
                }
            ]
        }
    ]
}
```

P0 diagnostic fields should include `severity`, `code`, `message`, `path`,
`location`, `actual`, `expected`, and `suggestions` where applicable.
Suggestions are advisory only and should not contain patches in P0.

P0 severity values:

```text
error
warning
info
```

P0 status values:

```text
passed = no errors or warnings
warning = warnings but no errors
failed = at least one error
```

Warnings should not cause a non-zero exit code in P0. Errors should. A required
runtime value that cannot resolve should be a warning unless it blocks a
specific operation.

P0 diagnostic code families can include:

```text
config.*
runtime.*
space.*
schema.*
entry.*
ref.*
view.*
template.*
create.*
index.*
privacy.*
```

### Editing And Reading Surfaces

The product can support multiple surfaces:

- VS Code or Zed extensions.
- A local service started from the product CLI and accessed through a browser.
- A read-only GUI for browsing, rendering, inspecting, and diagnostics over a
  local repository workspace.
- CLI commands for inspection, validation, generation, repair assistance, and
  automation.
- Agent and Skill wrappers over GUI, CLI, and repository operations.

P0 GUI should be a local webapp served by `forma serve`. It should browse
spaces and page views, render table and kanban views, inspect entry
metadata and Markdown bodies, show resolved references, and display check/index
status. It should not create, edit, delete, move, rename, deprecate, rebuild the
index, mutate kanban cards, edit settings or schemas, run Git operations, or
perform fixes in P0.

The user-facing experience should not require users to understand Git branches,
merge conflicts, pull requests, or commits. Agents and skills can assist with
those operations when they are needed.

## In Scope

- Thin configurable spaces, schemas, semantic types, modes, views, and
  templates.
- Human-readable and Agent-friendly repository knowledge.
- Agent-friendly CLI and skills for health checks, validation, workflow
  execution, and safe maintenance.
- CLI interfaces for init, config inspection, index rebuild/check, check,
  inspect, list, create, and serving a local read-only webapp.
- Read-only local browser GUI for browsing spaces and views, rendering
  entries, inspecting metadata, and viewing diagnostics.
- Structured views over files without requiring custom executable scripts.
- Forma-native YAML Schema DSL as the initial user-visible object constraint
  format.
- Explicit promotion and splitting between personal and shared content.
- Three knowledge visibility scopes: shared team, shared personal, and local
  personal.
- P0 configuration scopes: team shared and local personal.
- Guidance for non-software users around repository operations that would
  otherwise require Git knowledge.
- Optional date-based workflows such as daily, weekly, or monthly reports where
  they fit a user's workspace.
- Limited `{{ ... }}` runtime interpolation for configuration and templates.
- Create inputs with explicit field binding, operation-level defaults,
  dependency-graph resolution, and a small `slugify` transform.
- Runtime in-memory read model rebuilt from source files and shared
  configuration.
- P0 CLI for init, config inspection, workspace checks, entry inspection, space
  listing, entry creation, and read-only local GUI serving.

## Out Of Scope

- Full import or migration compatibility with specific note-taking products.
- Complete compatibility with every Obsidian, Foam, Logseq, or Notion feature.
- Custom executable query scripts in the initial product direction.
- Code-based schema configuration as the user-facing schema format.
- Required JSON Schema authoring files in the P0 minimal starter.
- Arbitrary expression evaluation, filters, loops, conditionals, includes,
  partials, or scripting inside template placeholders.
- `default` in space schema fields for P0.
- Publishing systems in the initial product direction.
- Assuming the current repository's `knowledge/` layout is the default or only
  future workspace structure.
- Assuming all users understand Git concepts.
- Shared team overrides in the MVP. Team-level configuration changes should edit
  the shared base config directly.
- Shared personal overrides in P0. They remain a P1 or later capability.
- Agent-only product capabilities. Agent and Skill flows should not be the only
  way to create, inspect, validate, or maintain knowledge structures.
- Local full index, SQLite index backend, filesystem watcher, or vector index in
  P0.
- Heavy archive, merge, provenance, or recycle-bin workflows in the MVP.
- First-class deprecate, delete, move, rename, search/query, and fix commands in
  the initial required P0 command set.

## Open Questions

- What exact P0 starter file contents should initialize `notes`, `todos`, and
  `users` without constraining advanced workspaces?
- What exact P0 Schema DSL, semantic type, template, and view configuration
  syntax should be implemented first?
- When should loaders or integrations become necessary beyond declarative
  space configuration?
- How should Forma package or expose repository-backed knowledge so operational
  systems such as Choral Flows can consume it as a Git-backed knowledge source
  without turning Forma into a Flows backend or losing repository authorship?
- How should the product model promotion workflows from personal content to
  shared content?
- How should shared content be split into personal work material without losing
  provenance?
- What exact CLI, JSON result, and future skill interfaces are needed for Agents
  to check knowledge health?
- What conflict and pull request workflows can be made understandable for
  non-software users?
- Which future shared personal configuration fields are safe to commit, and when
  is that extra layer justified?
- Which runtime values should be available in P0, and how should custom runtime
  value providers be configured safely later?
