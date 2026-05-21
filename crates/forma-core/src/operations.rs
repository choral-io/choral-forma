use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::config::{ConfigError, LoadMode, load_workspace};
use crate::diagnostics::{Diagnostic, DiagnosticSummary, OperationStatus};
use crate::index::{IndexEntry, config_error_diagnostic, discover_workspace, index_rebuild};
use crate::markdown::FormaMarkdownDocument;
use crate::path::{
    FORMA_COLLECTIONS_PATH, FORMA_DIR, FORMA_GITIGNORE_PATH, FORMA_INDEX_SUMMARY_PATH,
    FORMA_TEMPLATES_DIR, FORMA_TYPES_PATH, FORMA_VIEWS_DIR, FORMA_WORKSPACE_PATH, PathError,
    WorkspacePath,
};
use crate::schema::{
    PlaceholderContext, render_placeholder_template, resolve_create_inputs, resolve_runtime_values,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub root: String,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub created: Vec<String>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub created: CreatedEntry,
    pub inputs: BTreeMap<String, CreateInputResult>,
    pub index: CreateIndexStatus,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedEntry {
    pub path: String,
    pub collection: String,
    pub template: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInputResult {
    pub source: CreateInputSource,
    pub value: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CreateInputSource {
    Explicit,
    Default,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIndexStatus {
    pub stale: bool,
    pub suggested_command: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub entry: InspectEntry,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectEntry {
    pub path: String,
    pub collection: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default)]
    pub metadata: Value,
    #[serde(default)]
    pub headings: Vec<String>,
    #[serde(default)]
    pub refs: Vec<crate::index::IndexReference>,
    pub renderable: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub collection: ListedCollection,
    pub entries: Vec<ListEntry>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedCollection {
    pub id: String,
    pub title: String,
    pub include: String,
    pub entry_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntry {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default)]
    pub fields: Value,
}

#[derive(Debug, Error)]
pub enum OperationError {
    #[error("configuration error: {0}")]
    Config(#[from] ConfigError),
    #[error("workspace already contains .forma")]
    WorkspaceExists,
    #[error("collection `{0}` was not found")]
    CollectionNotFound(String),
    #[error("collection `{0}` does not define create behavior")]
    CreateNotConfigured(String),
    #[error("invalid input `{0}`")]
    InvalidInput(String),
    #[error("invalid workspace path: {0}")]
    InvalidPath(#[from] PathError),
    #[error("invalid timezone `{0}`")]
    InvalidTimezone(String),
    #[error("entry was not found")]
    EntryNotFound,
    #[error("entry locator matched multiple files")]
    EntryAmbiguous,
    #[error("view `{0}` was not found")]
    ViewNotFound(String),
    #[error("path already exists: {0}")]
    PathConflict(String),
    #[error("file operation failed for {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
}

pub fn init_workspace(
    root: impl AsRef<Path>,
    name: &str,
    language: &str,
    timezone: Option<&str>,
) -> Result<InitResult, OperationError> {
    let root = root.as_ref();
    if root.join(FORMA_DIR).exists() {
        return Err(OperationError::WorkspaceExists);
    }

    let timezone = timezone
        .map(ToString::to_string)
        .unwrap_or_else(detect_environment_timezone);
    validate_timezone(&timezone)?;
    let mut created = Vec::new();

    for directory in [
        FORMA_DIR,
        FORMA_TEMPLATES_DIR,
        FORMA_VIEWS_DIR,
        "daily",
        "notes",
        "todos",
        "users",
    ] {
        fs::create_dir_all(root.join(directory)).map_err(|source| OperationError::Io {
            path: directory.to_string(),
            source,
        })?;
    }

    write_file(root, FORMA_GITIGNORE_PATH, STARTER_GITIGNORE, &mut created)?;
    write_file(
        root,
        FORMA_WORKSPACE_PATH,
        &starter_workspace_yml(name, language, &timezone),
        &mut created,
    )?;
    write_file(root, FORMA_TYPES_PATH, STARTER_TYPES_YML, &mut created)?;
    write_file(
        root,
        FORMA_COLLECTIONS_PATH,
        &starter_collections_yml(),
        &mut created,
    )?;
    for (path, source) in starter_templates() {
        write_file(root, &path, source, &mut created)?;
    }
    for (path, source) in starter_views() {
        write_file(root, &path, source, &mut created)?;
    }

    let rebuild = index_rebuild(root)?;
    if !created.iter().any(|path| path == FORMA_INDEX_SUMMARY_PATH) {
        created.push(FORMA_INDEX_SUMMARY_PATH.to_string());
    }

    Ok(InitResult {
        schema_version: 1,
        operation: "init".to_string(),
        status: rebuild.status,
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: name.to_string(),
        },
        created,
        summary: rebuild.summary,
        diagnostics: rebuild.diagnostics,
    })
}

pub fn create_entry(
    root: impl AsRef<Path>,
    collection_id: &str,
    provided: BTreeMap<String, Value>,
) -> Result<CreateResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::WithLocalOverrides)?;
    let collection = workspace
        .config
        .collections
        .get(collection_id)
        .ok_or_else(|| OperationError::CollectionNotFound(collection_id.to_string()))?;
    let create = collection
        .create
        .as_ref()
        .ok_or_else(|| OperationError::CreateNotConfigured(collection_id.to_string()))?;

    for name in provided.keys() {
        if !create.inputs.contains_key(name) {
            return Err(OperationError::InvalidInput(name.clone()));
        }
    }

    let runtime = resolve_runtime_values(&workspace.config, ".");
    let resolved = resolve_create_inputs(&create.inputs, &provided, &runtime);
    let mut diagnostics = workspace.diagnostics;
    diagnostics.extend(runtime.diagnostics.clone());
    diagnostics.extend(resolved.diagnostics);
    if DiagnosticSummary::from_diagnostics(&diagnostics).errors > 0 {
        return Err(OperationError::InvalidInput("create inputs".to_string()));
    }

    let context = PlaceholderContext {
        input: resolved.values.clone(),
        runtime_values: runtime.as_map().clone(),
    };
    let filename = render_placeholder_template(&create.filename, &context);
    diagnostics.extend(filename.diagnostics);
    let Some(filename) = filename.value else {
        return Err(OperationError::InvalidInput("filename".to_string()));
    };
    let rendered_path = WorkspacePath::parse_config(format!("{}/{}", create.directory, filename))?;
    let public_path = rendered_path.as_str().to_string();
    if root.as_ref().join(&public_path).exists() {
        return Err(OperationError::PathConflict(public_path));
    }

    let template_path = WorkspacePath::parse_config(&collection.template)?;
    let template_source =
        fs::read_to_string(root.as_ref().join(template_path.as_str())).map_err(|source| {
            OperationError::Io {
                path: template_path.as_str().to_string(),
                source,
            }
        })?;
    let rendered = render_placeholder_template(&template_source, &context);
    diagnostics.extend(rendered.diagnostics);
    let Some(rendered) = rendered.value else {
        return Err(OperationError::InvalidInput("template".to_string()));
    };

    if let Some(parent) = root.as_ref().join(&public_path).parent() {
        fs::create_dir_all(parent).map_err(|source| OperationError::Io {
            path: create.directory.clone(),
            source,
        })?;
    }
    fs::write(root.as_ref().join(&public_path), rendered).map_err(|source| OperationError::Io {
        path: public_path.clone(),
        source,
    })?;

    diagnostics.push(
        Diagnostic::warning(
            "index.stale",
            "Summary index is stale after creating an entry.",
        )
        .with_path(FORMA_INDEX_SUMMARY_PATH),
    );
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    let inputs = resolved
        .values
        .into_iter()
        .map(|(name, value)| {
            let source = if provided.contains_key(&name) {
                CreateInputSource::Explicit
            } else {
                CreateInputSource::Default
            };
            let transform = create
                .inputs
                .get(&name)
                .and_then(|input| input.transform.clone());
            (
                name,
                CreateInputResult {
                    source,
                    value,
                    transform,
                },
            )
        })
        .collect();

    Ok(CreateResult {
        schema_version: 1,
        operation: "create".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        created: CreatedEntry {
            path: public_path,
            collection: collection_id.to_string(),
            template: collection.template.clone(),
        },
        inputs,
        index: CreateIndexStatus {
            stale: true,
            suggested_command: "forma index rebuild".to_string(),
        },
        summary,
        diagnostics,
    })
}

pub fn inspect_entry_by_path(
    root: impl AsRef<Path>,
    path: &str,
) -> Result<InspectResult, OperationError> {
    let path = normalize_entry_path(path)?;
    inspect_entry(root, &path)
}

pub fn inspect_entry_by_collection(
    root: impl AsRef<Path>,
    collection: &str,
    entry: &str,
) -> Result<InspectResult, OperationError> {
    let discovery = discover_workspace(root.as_ref())?;
    let path = resolve_collection_entry_path(&discovery.index.entries, collection, entry)?;
    inspect_entry(root, &path)
}

pub fn list_collection(
    root: impl AsRef<Path>,
    collection_id: &str,
) -> Result<ListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let collection = workspace
        .config
        .collections
        .get(collection_id)
        .ok_or_else(|| OperationError::CollectionNotFound(collection_id.to_string()))?;
    let discovery = discover_workspace(root.as_ref())?;
    let mut diagnostics = discovery.diagnostics;
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let entries = discovery
        .index
        .entries
        .iter()
        .filter(|entry| entry.collection == collection_id)
        .map(|entry| ListEntry {
            path: entry.path.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            summary: entry.summary.clone(),
            fields: Value::Mapping(Default::default()),
        })
        .collect::<Vec<_>>();

    Ok(ListResult {
        schema_version: 1,
        operation: "list".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        collection: ListedCollection {
            id: collection_id.to_string(),
            title: collection.title.clone(),
            include: collection.include.clone(),
            entry_count: entries.len(),
        },
        entries,
        summary,
        diagnostics,
    })
}

fn inspect_entry(root: impl AsRef<Path>, path: &str) -> Result<InspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let index_entry = discovery
        .index
        .entries
        .iter()
        .find(|entry| entry.path == path)
        .ok_or(OperationError::EntryNotFound)?;
    let source =
        fs::read_to_string(root.as_ref().join(path)).map_err(|source| OperationError::Io {
            path: path.to_string(),
            source,
        })?;
    let document = FormaMarkdownDocument::parse(&source);
    let mut diagnostics = discovery.diagnostics;
    diagnostics.extend(
        document
            .diagnostics
            .iter()
            .cloned()
            .map(|diagnostic| diagnostic.with_path(path.to_string())),
    );
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(InspectResult {
        schema_version: 1,
        operation: "inspect".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        entry: InspectEntry {
            path: path.to_string(),
            collection: index_entry.collection.clone(),
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
            summary: index_entry.summary.clone(),
            metadata: document
                .frontmatter
                .value
                .unwrap_or(Value::Mapping(Default::default())),
            headings: Vec::new(),
            refs: index_entry.refs.clone(),
            renderable: true,
        },
        summary,
        diagnostics,
    })
}

fn resolve_collection_entry_path(
    entries: &[IndexEntry],
    collection: &str,
    entry: &str,
) -> Result<String, OperationError> {
    let entry = entry.strip_suffix(".md").unwrap_or(entry);
    let matches = entries
        .iter()
        .filter(|candidate| {
            candidate.collection == collection
                && candidate
                    .path
                    .rsplit('/')
                    .next()
                    .and_then(|name| name.strip_suffix(".md"))
                    == Some(entry)
        })
        .map(|entry| entry.path.clone())
        .collect::<Vec<_>>();
    match matches.len() {
        0 => Err(OperationError::EntryNotFound),
        1 => Ok(matches[0].clone()),
        _ => Err(OperationError::EntryAmbiguous),
    }
}

fn normalize_entry_path(path: &str) -> Result<String, OperationError> {
    let normalized = WorkspacePath::parse_cli(path)?;
    let value = normalized.as_str();
    if value.ends_with(".md") {
        Ok(value.to_string())
    } else {
        Ok(format!("{value}.md"))
    }
}

fn write_file(
    root: &Path,
    public_path: &str,
    source: &str,
    created: &mut Vec<String>,
) -> Result<(), OperationError> {
    fs::write(root.join(public_path), source).map_err(|source| OperationError::Io {
        path: public_path.to_string(),
        source,
    })?;
    created.push(public_path.to_string());
    Ok(())
}

fn starter_workspace_yml(name: &str, language: &str, timezone: &str) -> String {
    STARTER_WORKSPACE_YML
        .replace("__WORKSPACE_NAME__", &yaml_string(name))
        .replace("__LANGUAGE__", &yaml_string(language))
        .replace("__TIMEZONE__", &yaml_string(timezone))
}

fn starter_collections_yml() -> String {
    STARTER_COLLECTIONS_YML.replace("__TEMPLATES_DIR__", FORMA_TEMPLATES_DIR)
}

fn starter_templates() -> Vec<(String, &'static str)> {
    vec![
        (
            format!("{FORMA_TEMPLATES_DIR}/note.md"),
            "---\nkind: note\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.title }}\n",
        ),
        (
            format!("{FORMA_TEMPLATES_DIR}/daily.md"),
            "---\nkind: daily\ndate: \"{{ input.date }}\"\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.title }}\n\n## Notes\n",
        ),
        (
            format!("{FORMA_TEMPLATES_DIR}/todo.md"),
            "---\nkind: todo\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\nstatus: \"{{ input.status }}\"\nassignees: []\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.title }}\n",
        ),
        (
            format!("{FORMA_TEMPLATES_DIR}/user.md"),
            "---\nkind: user\nname: \"{{ input.name }}\"\ndescription: \"{{ input.description }}\"\nresponsibilities: \"{{ input.responsibilities }}\"\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.name }}\n",
        ),
    ]
}

fn starter_views() -> Vec<(String, &'static str)> {
    vec![
        (
            format!("{FORMA_VIEWS_DIR}/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: notes\n  title: Notes\n  description: General knowledge notes.\n  table:\n    columns:\n      - title\n      - summary\n      - createdAt\n  sort:\n    - field: createdAt\n      direction: desc\n---\n\n# Notes\n\n<!-- forma-view -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/daily.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: daily\n  title: Daily Notes\n  description: Date-based notes.\n  table:\n    columns:\n      - date\n      - title\n      - summary\n      - createdAt\n  sort:\n    - field: date\n      direction: desc\n---\n\n# Daily Notes\n\n<!-- forma-view -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/todos.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: kanban\n  collection: todos\n  title: Todos\n  description: Lightweight action items.\n  kanban:\n    card:\n      titleField: title\n      subtitleFields:\n        - summary\n        - assignees\n      badgeFields:\n        - dueDate\n    columns:\n      - id: todo\n        label: To Do\n        query:\n          all:\n            - target: frontmatter.status\n              op: equals\n              value: todo\n      - id: doing\n        label: Doing\n        query:\n          all:\n            - target: frontmatter.status\n              op: equals\n              value: doing\n      - id: done\n        label: Done\n        query:\n          all:\n            - target: frontmatter.status\n              op: equals\n              value: done\n---\n\n# Todos\n\n<!-- forma-view -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/users.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: users\n  title: Users\n  description: People referenced by this workspace.\n  table:\n    columns:\n      - name\n      - description\n      - createdAt\n  sort:\n    - field: name\n      direction: asc\n---\n\n# Users\n\n<!-- forma-view -->\n",
        ),
    ]
}

pub fn detect_environment_timezone() -> String {
    if let Ok(value) = std::env::var("TZ")
        && !value.trim().is_empty()
    {
        return value;
    }
    if let Ok(target) = fs::read_link("/etc/localtime") {
        let target = target.to_string_lossy();
        if let Some((_, zone)) = target.split_once("zoneinfo/") {
            return zone.to_string();
        }
    }
    "UTC".to_string()
}

fn validate_timezone(timezone: &str) -> Result<(), OperationError> {
    timezone
        .parse::<Tz>()
        .map(|_| ())
        .map_err(|_| OperationError::InvalidTimezone(timezone.to_string()))
}

fn yaml_string(value: &str) -> String {
    serde_json::to_string(value).expect("string values should serialize")
}

pub fn operation_error_diagnostic(error: OperationError) -> Diagnostic {
    match error {
        OperationError::Config(error) => config_error_diagnostic(error),
        OperationError::WorkspaceExists => {
            Diagnostic::error("init.workspaceExists", "Workspace already contains .forma.")
                .with_path(FORMA_DIR)
        }
        OperationError::CollectionNotFound(collection) => Diagnostic::error(
            "collection.notFound",
            format!("Collection `{collection}` was not found."),
        ),
        OperationError::CreateNotConfigured(collection) => Diagnostic::error(
            "create.notConfigured",
            format!("Collection `{collection}` does not define create behavior."),
        ),
        OperationError::InvalidInput(input) => {
            Diagnostic::error("create.inputInvalid", "Create input is invalid.").with_actual(input)
        }
        OperationError::InvalidPath(error) => Diagnostic::error(
            "path.invalid",
            "Workspace-relative path parameter is invalid.",
        )
        .with_actual(error.to_string()),
        OperationError::InvalidTimezone(timezone) => Diagnostic::error(
            "init.timezoneInvalid",
            "Workspace timezone must be a valid IANA timezone.",
        )
        .with_actual(timezone),
        OperationError::EntryNotFound => {
            Diagnostic::error("entry.notFound", "Entry was not found.")
        }
        OperationError::EntryAmbiguous => {
            Diagnostic::error("entry.ambiguous", "Entry locator matched multiple files.")
        }
        OperationError::ViewNotFound(view) => {
            Diagnostic::error("view.notFound", "View was not found.").with_actual(view)
        }
        OperationError::PathConflict(path) => {
            Diagnostic::error("create.pathConflict", "Target path already exists.").with_path(path)
        }
        OperationError::Io { path, source } => {
            Diagnostic::error("file.writeFailed", "File operation failed.")
                .with_path(path)
                .with_actual(source.to_string())
        }
    }
}

const STARTER_GITIGNORE: &str = "overrides/local.yml\nlocal/\n";

const STARTER_WORKSPACE_YML: &str = r#"schemaVersion: 1

workspace:
  name: __WORKSPACE_NAME__
  canonicalLanguage: __LANGUAGE__
  supportedLanguages:
    - __LANGUAGE__
  timezone: __TIMEZONE__

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
      required: true
"#;

const STARTER_TYPES_YML: &str = r#"schemaVersion: 1

types:
  note:
    kind: collection
    collection: notes
    input:
      transform: slugify

  daily:
    kind: collection
    collection: daily

  todo:
    kind: collection
    collection: todos
    input:
      transform: slugify

  user:
    kind: collection
    collection: users
    input:
      transform: slugify

  todoStatus:
    kind: enum
    values:
      - todo
      - doing
      - done
"#;

const STARTER_COLLECTIONS_YML: &str = r#"schemaVersion: 1

collections:
  notes:
    title: Notes
    description: General knowledge notes.
    include: notes/**/*.md
    template: __TEMPLATES_DIR__/note.md
    create:
      directory: notes
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
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
    conventions:
      titleField: title
      summaryField: summary
      createdAtField: createdAt
    schema:
      type: object
      fields:
        kind:
          type: const
          value: note
          required: true
        title:
          type: string
          label: Title
          required: true
        summary:
          type: string
          label: Summary
        createdAt:
          type: datetime
          label: Created At
          required: true
        updatedAt:
          type: datetime
          label: Updated At

  daily:
    title: Daily Notes
    description: Date-based notes.
    include: daily/**/*.md
    template: __TEMPLATES_DIR__/daily.md
    create:
      directory: daily
      filename: "{{ input.date }}.md"
      inputs:
        date:
          field: date
          type: date
          required: true
          default: "{{ runtime.values.currentDate }}"
        title:
          field: title
          default: "{{ input.date }}"
        summary:
          field: summary
          default: ""
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
    conventions:
      titleField: title
      summaryField: summary
      createdAtField: createdAt
    schema:
      type: object
      fields:
        kind:
          type: const
          value: daily
          required: true
        date:
          type: date
          label: Date
          required: true
        title:
          type: string
          label: Title
          required: true
        summary:
          type: string
          label: Summary
        createdAt:
          type: datetime
          label: Created At
          required: true

  todos:
    title: Todos
    description: Lightweight action items.
    include: todos/**/*.md
    template: __TEMPLATES_DIR__/todo.md
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
        status:
          field: status
          default: todo
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
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
        dueDate:
          type: date
          label: Due Date
        createdAt:
          type: datetime
          label: Created At
          required: true

  users:
    title: Users
    description: People who can be referenced in this workspace.
    include: users/**/*.md
    template: __TEMPLATES_DIR__/user.md
    create:
      directory: users
      filename: "{{ input.slug }}.md"
      inputs:
        name:
          field: name
          required: true
        description:
          field: description
          default: ""
        responsibilities:
          field: responsibilities
          default: ""
        slug:
          label: Slug
          type: string
          default: "{{ input.name }}"
          transform: slugify
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
    conventions:
      titleField: name
      summaryField: description
      createdAtField: createdAt
    schema:
      type: object
      fields:
        kind:
          type: const
          value: user
          required: true
        name:
          type: string
          label: Name
          required: true
        description:
          type: string
          label: Description
        responsibilities:
          type: string
          label: Responsibilities
        createdAt:
          type: datetime
          label: Created At
          required: true
"#;
