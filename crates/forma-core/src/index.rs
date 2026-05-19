use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use globset::{Glob, GlobSet, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{ConfigError, LoadMode, SemanticType, WorkspaceConfig, load_workspace};
use crate::diagnostics::{Diagnostic, DiagnosticLocation, DiagnosticSummary, OperationStatus};
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent};
use crate::path::{
    FORMA_COLLECTIONS_PATH, FORMA_DIR, FORMA_INDEX_SUMMARY_PATH, FORMA_VIEWS_DIR, WorkspacePath,
    slugify_path_segment,
};
use crate::schema::{SchemaNode, parse_collection_schema, validate_schema_value};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryIndex {
    pub schema_version: u16,
    pub workspace: IndexWorkspace,
    pub collections: Vec<IndexCollection>,
    pub views: Vec<IndexView>,
    pub entries: Vec<IndexEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexWorkspace {
    pub name: String,
    pub canonical_language: String,
    pub supported_languages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexCollection {
    pub id: String,
    pub title: String,
    pub include: String,
    pub entry_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexView {
    pub id: String,
    pub path: String,
    pub surface: String,
    pub mode: String,
    pub collection: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexEntry {
    pub path: String,
    pub collection: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub refs: Vec<IndexReference>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexReference {
    pub source: ReferenceSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub target_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_type: Option<String>,
    pub intent: ReferenceIntent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReferenceSource {
    Frontmatter,
    Body,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReferenceIntent {
    Reference,
    Link,
    Embed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexRebuildResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub path: String,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone)]
pub struct Discovery {
    pub index: SummaryIndex,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone)]
struct CandidateEntry {
    path: String,
    collection: String,
    document: FormaMarkdownDocument,
}

#[derive(Debug, Clone)]
struct PathIndex {
    all_paths: BTreeSet<String>,
    by_basename: BTreeMap<String, Vec<String>>,
    by_collection: BTreeMap<String, BTreeSet<String>>,
}

#[derive(Debug, Clone)]
struct RefField {
    field: String,
    semantic_type: String,
    collection: String,
    transform: Option<String>,
    many: bool,
}

pub fn discover_workspace(root: impl AsRef<Path>) -> Result<Discovery, ConfigError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let root = workspace.root;
    let config = workspace.config;
    let mut diagnostics = workspace.diagnostics;

    let mut entries = discover_entries(&root, &config, &mut diagnostics);
    let path_index = PathIndex::from_entries(&entries);
    let mut index_entries = Vec::new();

    for entry in &mut entries {
        let mut refs = Vec::new();
        let collection = &config.collections[&entry.collection];
        if let Ok(schema) = parse_collection_schema(collection) {
            let frontmatter_value = entry
                .document
                .frontmatter
                .value
                .as_ref()
                .unwrap_or(&Value::Null);
            diagnostics.extend(validate_schema_value(
                &config,
                &schema,
                frontmatter_value,
                entry.path.clone(),
            ));
            let ref_fields = collect_ref_fields(&config, &schema);
            refs.extend(resolve_frontmatter_refs(
                &entry.path,
                frontmatter_value,
                &ref_fields,
                &path_index,
                &mut diagnostics,
            ));
        }
        refs.extend(resolve_body_refs(
            &entry.path,
            &entry.document,
            &path_index,
            &mut diagnostics,
        ));
        refs.sort_by(|left, right| {
            (
                left.intent,
                left.target_path.as_str(),
                left.source,
                left.field.as_deref().unwrap_or(""),
            )
                .cmp(&(
                    right.intent,
                    right.target_path.as_str(),
                    right.source,
                    right.field.as_deref().unwrap_or(""),
                ))
        });

        let frontmatter_value = entry.document.frontmatter.value.as_ref();
        index_entries.push(IndexEntry {
            path: entry.path.clone(),
            collection: entry.collection.clone(),
            kind: scalar_field(frontmatter_value, "kind"),
            title: title_for_entry(frontmatter_value, collection),
            summary: summary_for_entry(frontmatter_value, collection),
            refs,
        });
    }

    let mut collections = config
        .collections
        .iter()
        .map(|(id, collection)| IndexCollection {
            id: id.clone(),
            title: collection.title.clone(),
            include: collection.include.clone(),
            entry_count: path_index
                .by_collection
                .get(id)
                .map(BTreeSet::len)
                .unwrap_or(0),
        })
        .collect::<Vec<_>>();
    collections.sort_by(|left, right| left.id.cmp(&right.id));

    let mut views = discover_views(&root, &config, &mut diagnostics);
    views.sort_by(|left, right| {
        (left.path.as_str(), left.id.as_str()).cmp(&(right.path.as_str(), right.id.as_str()))
    });
    index_entries.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(Discovery {
        index: SummaryIndex {
            schema_version: 1,
            workspace: IndexWorkspace {
                name: config.workspace.name,
                canonical_language: config.workspace.canonical_language,
                supported_languages: config.workspace.supported_languages,
            },
            collections,
            views,
            entries: index_entries,
        },
        diagnostics,
    })
}

pub fn check_workspace(root: impl AsRef<Path>) -> CheckResult {
    let mut diagnostics = match discover_workspace(root.as_ref()) {
        Ok(discovery) => {
            let mut diagnostics = discovery.diagnostics;
            diagnostics.extend(index_freshness_diagnostics(root.as_ref(), &discovery.index));
            diagnostics
        }
        Err(error) => vec![config_error_diagnostic(error)],
    };
    diagnostics.sort_by_key(diagnostic_sort_key);
    check_result("check", diagnostics)
}

pub fn index_check(root: impl AsRef<Path>) -> CheckResult {
    let diagnostics = match discover_workspace(root.as_ref()) {
        Ok(discovery) => index_freshness_diagnostics(root.as_ref(), &discovery.index),
        Err(error) => vec![config_error_diagnostic(error)],
    };
    check_result("index.check", diagnostics)
}

pub fn index_rebuild(root: impl AsRef<Path>) -> Result<IndexRebuildResult, ConfigError> {
    let discovery = discover_workspace(root.as_ref())?;
    let summary = DiagnosticSummary::from_diagnostics(&discovery.diagnostics);
    if summary.errors == 0 {
        let json = summary_index_json(&discovery.index);
        let path = root.as_ref().join(FORMA_INDEX_SUMMARY_PATH);
        fs::write(&path, json).map_err(|source| ConfigError::Write {
            path: FORMA_INDEX_SUMMARY_PATH.to_string(),
            source,
        })?;
    }
    Ok(IndexRebuildResult {
        schema_version: 1,
        operation: "index.rebuild".to_string(),
        status: summary.status(),
        path: FORMA_INDEX_SUMMARY_PATH.to_string(),
        summary,
        diagnostics: discovery.diagnostics,
    })
}

pub fn summary_index_json(index: &SummaryIndex) -> String {
    let mut output = serde_json::to_string_pretty(index).expect("summary index should serialize");
    output.push('\n');
    output
}

fn check_result(operation: &str, diagnostics: Vec<Diagnostic>) -> CheckResult {
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    CheckResult {
        schema_version: 1,
        operation: operation.to_string(),
        status: summary.status(),
        summary,
        diagnostics,
    }
}

fn discover_entries(
    root: &Path,
    config: &WorkspaceConfig,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<CandidateEntry> {
    let markdown_files = collect_markdown_files(root);
    let matchers = build_collection_matchers(config, diagnostics);
    let mut entries = Vec::new();

    for path in markdown_files {
        let Some(relative) = workspace_relative_path(root, &path) else {
            continue;
        };
        let matched = matchers
            .iter()
            .filter(|(_, matcher)| matcher.is_match(relative.as_str()))
            .map(|(id, _)| id.clone())
            .collect::<Vec<_>>();
        if matched.is_empty() {
            continue;
        }
        if matched.len() > 1 {
            diagnostics.push(
                Diagnostic::error(
                    "collection.membership.ambiguous",
                    "Entry matches multiple collections.",
                )
                .with_path(relative),
            );
            continue;
        }

        match fs::read_to_string(&path) {
            Ok(source) => {
                let document = FormaMarkdownDocument::parse(&source);
                diagnostics.extend(
                    document
                        .diagnostics
                        .iter()
                        .cloned()
                        .map(|diagnostic| diagnostic.with_path(relative.clone())),
                );
                entries.push(CandidateEntry {
                    path: relative,
                    collection: matched[0].clone(),
                    document,
                });
            }
            Err(error) => diagnostics.push(
                Diagnostic::error("file.readFailed", "Workspace file could not be read.")
                    .with_path(relative)
                    .with_actual(error.to_string()),
            ),
        }
    }

    entries.sort_by(|left, right| left.path.cmp(&right.path));
    entries
}

fn build_collection_matchers(
    config: &WorkspaceConfig,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<(String, GlobSet)> {
    let mut matchers = Vec::new();
    for (collection_id, collection) in &config.collections {
        let mut builder = GlobSetBuilder::new();
        match Glob::new(&collection.include) {
            Ok(glob) => {
                builder.add(glob);
                if let Ok(set) = builder.build() {
                    matchers.push((collection_id.clone(), set));
                }
            }
            Err(error) => diagnostics.push(
                Diagnostic::error("config.globInvalid", "Collection include glob is invalid.")
                    .with_path(FORMA_COLLECTIONS_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: format!("collections.{collection_id}.include"),
                    })
                    .with_actual(error.to_string()),
            ),
        }
    }
    matchers
}

fn collect_markdown_files(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_markdown_files_inner(root, root, &mut files);
    files.sort();
    files
}

fn collect_markdown_files_inner(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if path.is_dir() {
            if matches!(name, ".git" | FORMA_DIR | "target" | "node_modules") {
                continue;
            }
            collect_markdown_files_inner(root, &path, files);
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("md")
            && path.starts_with(root)
        {
            files.push(path);
        }
    }
}

fn discover_views(
    root: &Path,
    config: &WorkspaceConfig,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<IndexView> {
    let views_root = root.join(FORMA_VIEWS_DIR);
    let mut files = Vec::new();
    collect_view_files(&views_root, &mut files);
    let mut views = Vec::new();

    for path in files {
        let Some(relative) = workspace_relative_path(root, &path) else {
            continue;
        };
        let Ok(source) = fs::read_to_string(&path) else {
            diagnostics.push(
                Diagnostic::error("view.readFailed", "View file could not be read.")
                    .with_path(relative),
            );
            continue;
        };
        let document = FormaMarkdownDocument::parse(&source);
        diagnostics.extend(
            document
                .diagnostics
                .iter()
                .cloned()
                .map(|diagnostic| diagnostic.with_path(relative.clone())),
        );
        let Some(value) = document.frontmatter.value else {
            diagnostics.push(
                Diagnostic::error("view.invalid", "View must define YAML frontmatter.")
                    .with_path(relative.clone()),
            );
            continue;
        };
        let surface =
            required_string(&value, "view.surface").or_else(|| required_string(&value, "surface"));
        let mode = required_string(&value, "view.mode").or_else(|| required_string(&value, "mode"));
        let collection = required_string(&value, "view.collection")
            .or_else(|| required_string(&value, "collection"));
        let title =
            optional_string(&value, "view.title").or_else(|| optional_string(&value, "title"));
        let valid_collection = collection
            .as_ref()
            .is_some_and(|collection| config.collections.contains_key(collection));
        if surface.is_none() || mode.is_none() || collection.is_none() || !valid_collection {
            diagnostics.push(
                Diagnostic::error("view.invalid", "View definition is invalid.")
                    .with_path(relative.clone()),
            );
            continue;
        }
        views.push(IndexView {
            id: view_id(&relative),
            path: relative,
            surface: surface.unwrap(),
            mode: mode.unwrap(),
            collection: collection.unwrap(),
            title,
        });
    }

    views
}

fn collect_view_files(dir: &Path, files: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_view_files(&path, files);
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("md") {
            files.push(path);
        }
    }
    files.sort();
}

fn collect_ref_fields(config: &WorkspaceConfig, schema: &SchemaNode) -> Vec<RefField> {
    let mut fields = Vec::new();
    collect_ref_fields_inner(config, schema, "", false, &mut fields);
    fields
}

fn collect_ref_fields_inner(
    config: &WorkspaceConfig,
    schema: &SchemaNode,
    field_path: &str,
    many: bool,
    fields: &mut Vec<RefField>,
) {
    match schema {
        SchemaNode::Object { fields: nodes, .. } => {
            for (name, node) in nodes {
                let next = if field_path.is_empty() {
                    name.clone()
                } else {
                    format!("{field_path}.{name}")
                };
                collect_ref_fields_inner(config, node, &next, many, fields);
            }
        }
        SchemaNode::List { items, .. } => {
            collect_ref_fields_inner(config, items, field_path, true, fields)
        }
        SchemaNode::Ref { target, .. } => {
            if let Some(SemanticType::Collection { collection, input }) = config.types.get(target) {
                fields.push(RefField {
                    field: field_path.to_string(),
                    semantic_type: target.clone(),
                    collection: collection.clone(),
                    transform: input.transform.clone(),
                    many,
                });
            }
        }
        SchemaNode::String { .. }
        | SchemaNode::Number { .. }
        | SchemaNode::Integer { .. }
        | SchemaNode::Boolean { .. }
        | SchemaNode::Date { .. }
        | SchemaNode::DateTime { .. }
        | SchemaNode::Const { .. }
        | SchemaNode::Enum { .. } => {}
    }
}

fn resolve_frontmatter_refs(
    source_path: &str,
    frontmatter: &Value,
    fields: &[RefField],
    path_index: &PathIndex,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<IndexReference> {
    let mut refs = Vec::new();
    for field in fields {
        let Some(value) = value_at_path(frontmatter, &field.field) else {
            continue;
        };
        if field.many {
            if let Some(sequence) = value.as_sequence() {
                for (index, item) in sequence.iter().enumerate() {
                    resolve_frontmatter_ref_value(
                        source_path,
                        item,
                        field,
                        Some(index),
                        path_index,
                        diagnostics,
                        &mut refs,
                    );
                }
            }
        } else {
            resolve_frontmatter_ref_value(
                source_path,
                value,
                field,
                None,
                path_index,
                diagnostics,
                &mut refs,
            );
        }
    }
    refs
}

fn resolve_frontmatter_ref_value(
    source_path: &str,
    value: &Value,
    field: &RefField,
    index: Option<usize>,
    path_index: &PathIndex,
    diagnostics: &mut Vec<Diagnostic>,
    refs: &mut Vec<IndexReference>,
) {
    let Some(raw_target) = value.as_str() else {
        return;
    };
    let mut target = strip_reference_markup(raw_target);
    if let Some(transform) = field.transform.as_deref() {
        match apply_input_transform(transform, &target) {
            Ok(transformed) => target = transformed,
            Err(message) => {
                diagnostics.push(
                    Diagnostic::error("ref.transformFailed", "Reference input transform failed.")
                        .with_path(source_path)
                        .with_location(DiagnosticLocation::Frontmatter {
                            field: field.field.clone(),
                            index,
                        })
                        .with_actual(message),
                );
                return;
            }
        }
    }
    match path_index.resolve(&target, Some(&field.collection)) {
        ResolveResult::Resolved(target_path) => refs.push(IndexReference {
            source: ReferenceSource::Frontmatter,
            field: Some(field.field.clone()),
            target_path,
            semantic_type: Some(field.semantic_type.clone()),
            intent: ReferenceIntent::Reference,
        }),
        ResolveResult::Unresolved => diagnostics.push(
            Diagnostic::error("ref.unresolved", "Reference cannot be resolved.")
                .with_path(source_path)
                .with_location(DiagnosticLocation::Frontmatter {
                    field: field.field.clone(),
                    index,
                })
                .with_actual(raw_target.to_string())
                .with_expected(format!("{} entry", field.semantic_type)),
        ),
        ResolveResult::Ambiguous => diagnostics.push(
            Diagnostic::error("ref.ambiguous", "Reference resolves to multiple entries.")
                .with_path(source_path)
                .with_location(DiagnosticLocation::Frontmatter {
                    field: field.field.clone(),
                    index,
                })
                .with_actual(raw_target.to_string()),
        ),
    }
}

fn resolve_body_refs(
    source_path: &str,
    document: &FormaMarkdownDocument,
    path_index: &PathIndex,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<IndexReference> {
    let mut refs = Vec::new();
    for reference in &document.references {
        if matches!(reference.intent, FormaReferenceIntent::View)
            || is_external_target(&reference.target)
        {
            continue;
        }
        let intent = match reference.intent {
            FormaReferenceIntent::Link => ReferenceIntent::Link,
            FormaReferenceIntent::Embed => ReferenceIntent::Embed,
            FormaReferenceIntent::View => continue,
        };
        match path_index.resolve(&reference.target, None) {
            ResolveResult::Resolved(target_path) => refs.push(IndexReference {
                source: ReferenceSource::Body,
                field: None,
                target_path,
                semantic_type: None,
                intent,
            }),
            ResolveResult::Unresolved => diagnostics.push(
                Diagnostic::error("ref.unresolved", "Reference cannot be resolved.")
                    .with_path(source_path)
                    .with_location(
                        reference
                            .span
                            .map(|span| DiagnosticLocation::Body {
                                line: Some(span.start_line),
                                column: Some(span.start_column),
                            })
                            .unwrap_or(DiagnosticLocation::Body {
                                line: None,
                                column: None,
                            }),
                    )
                    .with_actual(reference.target.clone()),
            ),
            ResolveResult::Ambiguous => diagnostics.push(
                Diagnostic::error("ref.ambiguous", "Reference resolves to multiple entries.")
                    .with_path(source_path)
                    .with_location(
                        reference
                            .span
                            .map(|span| DiagnosticLocation::Body {
                                line: Some(span.start_line),
                                column: Some(span.start_column),
                            })
                            .unwrap_or(DiagnosticLocation::Body {
                                line: None,
                                column: None,
                            }),
                    )
                    .with_actual(reference.target.clone()),
            ),
        }
    }
    refs
}

enum ResolveResult {
    Resolved(String),
    Unresolved,
    Ambiguous,
}

impl PathIndex {
    fn from_entries(entries: &[CandidateEntry]) -> Self {
        let mut all_paths = BTreeSet::new();
        let mut by_basename: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut by_collection: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();

        for entry in entries {
            all_paths.insert(entry.path.clone());
            let basename = basename_id(&entry.path);
            by_basename
                .entry(basename)
                .or_default()
                .push(entry.path.clone());
            by_collection
                .entry(entry.collection.clone())
                .or_default()
                .insert(entry.path.clone());
        }

        Self {
            all_paths,
            by_basename,
            by_collection,
        }
    }

    fn resolve(&self, raw_target: &str, collection: Option<&str>) -> ResolveResult {
        let target = strip_reference_markup(raw_target);
        let candidates = candidate_paths(&target);
        for candidate in candidates {
            if self.path_allowed(&candidate, collection) {
                return ResolveResult::Resolved(candidate);
            }
        }

        if target.contains('/') {
            return ResolveResult::Unresolved;
        }

        let matches = self
            .by_basename
            .get(&target)
            .into_iter()
            .flatten()
            .filter(|path| self.path_allowed(path, collection))
            .cloned()
            .collect::<Vec<_>>();

        match matches.len() {
            0 => ResolveResult::Unresolved,
            1 => ResolveResult::Resolved(matches[0].clone()),
            _ => ResolveResult::Ambiguous,
        }
    }

    fn path_allowed(&self, path: &str, collection: Option<&str>) -> bool {
        if !self.all_paths.contains(path) {
            return false;
        }
        match collection {
            Some(collection) => self
                .by_collection
                .get(collection)
                .is_some_and(|paths| paths.contains(path)),
            None => true,
        }
    }
}

fn candidate_paths(target: &str) -> Vec<String> {
    let target = target.trim_start_matches("./");
    if target.ends_with(".md") {
        vec![target.to_string()]
    } else {
        vec![format!("{target}.md"), target.to_string()]
    }
}

fn basename_id(path: &str) -> String {
    path.rsplit('/')
        .next()
        .unwrap_or(path)
        .strip_suffix(".md")
        .unwrap_or(path)
        .to_string()
}

fn title_for_entry(
    value: Option<&Value>,
    collection: &crate::config::CollectionDefinition,
) -> Option<String> {
    collection
        .conventions
        .title_field
        .as_deref()
        .and_then(|field| scalar_field(value, field))
        .or_else(|| scalar_field(value, "title"))
}

fn summary_for_entry(
    value: Option<&Value>,
    collection: &crate::config::CollectionDefinition,
) -> Option<String> {
    collection
        .conventions
        .summary_field
        .as_deref()
        .and_then(|field| scalar_field(value, field))
        .or_else(|| scalar_field(value, "summary"))
}

fn scalar_field(value: Option<&Value>, field: &str) -> Option<String> {
    value_at_path(value?, field).and_then(|value| value.as_str().map(ToString::to_string))
}

fn value_at_path<'a>(value: &'a Value, field: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in field.split('.') {
        current = current
            .as_mapping()?
            .get(Value::String(segment.to_string()))?;
    }
    Some(current)
}

fn required_string(value: &Value, field: &str) -> Option<String> {
    value_at_path(value, field).and_then(|value| value.as_str().map(ToString::to_string))
}

fn optional_string(value: &Value, field: &str) -> Option<String> {
    required_string(value, field)
}

fn strip_reference_markup(value: &str) -> String {
    let mut value = value.trim();
    if let Some(stripped) = value.strip_prefix("![[") {
        value = stripped.strip_suffix("]]").unwrap_or(stripped);
    } else if let Some(stripped) = value.strip_prefix("[[") {
        value = stripped.strip_suffix("]]").unwrap_or(stripped);
    }
    value
        .split_once('|')
        .map(|(target, _)| target)
        .unwrap_or(value)
        .trim()
        .to_string()
}

fn apply_input_transform(transform: &str, value: &str) -> Result<String, String> {
    match transform {
        "slugify" => slugify_path_segment(value).map_err(|error| error.to_string()),
        other => Err(format!("unknown transform `{other}`")),
    }
}

fn is_external_target(target: &str) -> bool {
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("mailto:")
        || target.starts_with('#')
}

fn workspace_relative_path(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    let value = relative
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    WorkspacePath::parse_config(&value)
        .ok()
        .map(|path| path.as_str().to_string())
}

fn view_id(path: &str) -> String {
    let views_prefix = format!("{FORMA_VIEWS_DIR}/");
    path.strip_prefix(&views_prefix)
        .unwrap_or(path)
        .strip_suffix(".md")
        .unwrap_or(path)
        .to_string()
}

fn index_freshness_diagnostics(root: &Path, index: &SummaryIndex) -> Vec<Diagnostic> {
    let path = root.join(FORMA_INDEX_SUMMARY_PATH);
    let expected = summary_index_json(index);
    let Ok(actual) = fs::read_to_string(&path) else {
        return vec![
            Diagnostic::warning("index.missing", "Summary index is missing.")
                .with_path(FORMA_INDEX_SUMMARY_PATH),
        ];
    };

    if serde_json::from_str::<SummaryIndex>(&actual).is_err() {
        return vec![
            Diagnostic::error("index.invalid", "Summary index is invalid JSON.")
                .with_path(FORMA_INDEX_SUMMARY_PATH),
        ];
    }

    if actual != expected {
        return vec![
            Diagnostic::warning("index.stale", "Summary index is stale.")
                .with_path(FORMA_INDEX_SUMMARY_PATH),
        ];
    }

    Vec::new()
}

pub(crate) fn config_error_diagnostic(error: ConfigError) -> Diagnostic {
    match error {
        ConfigError::MissingFormaDirectory => Diagnostic::error(
            "workspace.missingForma",
            "Workspace root does not contain .forma.",
        ),
        ConfigError::Read { path, source } => {
            Diagnostic::error("config.readFailed", "Configuration file could not be read.")
                .with_path(path)
                .with_actual(source.to_string())
        }
        ConfigError::Write { path, source } => {
            Diagnostic::error("index.writeFailed", "Summary index could not be written.")
                .with_path(path)
                .with_actual(source.to_string())
        }
        ConfigError::Parse { path, source } => Diagnostic::error(
            "config.parseFailed",
            "Configuration file could not be parsed.",
        )
        .with_path(path)
        .with_actual(source.to_string()),
    }
}

fn diagnostic_sort_key(diagnostic: &Diagnostic) -> (String, String, String) {
    (
        diagnostic.path.clone().unwrap_or_default(),
        diagnostic.code.clone(),
        diagnostic.message.clone(),
    )
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::path::{
        FORMA_LOCAL_OVERRIDES_PATH, FORMA_TEMPLATES_DIR, FORMA_TYPES_PATH, FORMA_WORKSPACE_PATH,
    };

    #[test]
    fn builds_deterministic_summary_index_with_resolved_refs() {
        let root = fixture_root("valid");
        write_workspace(&root);
        write_entry(
            &root,
            "users/tiscs.md",
            "---\nkind: user\ntitle: Tiscs\n---\n",
        );
        write_entry(
            &root,
            "notes/account-model.md",
            "---\nkind: note\ntitle: Account model\n---\n",
        );
        write_entry(
            &root,
            "todos/user-registration.md",
            "---\nkind: todo\ntitle: User registration\nsummary: Register users\nassignees:\n  - Tiscs\n---\nSee [[notes/account-model]] and ![[users/tiscs]].\n",
        );
        write_view(
            &root,
            "todos.md",
            "---\ntitle: Todos\nsurface: page\nmode: kanban\ncollection: todos\n---\n<!-- forma-view -->\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let json = summary_index_json(&discovery.index);

        assert!(discovery.diagnostics.is_empty());
        assert_eq!(discovery.index.entries.len(), 3);
        assert_eq!(discovery.index.collections[0].id, "notes");
        let expected_json = r#"{
  "schemaVersion": 1,
  "workspace": {
    "name": "Acme Knowledge",
    "canonicalLanguage": "en",
    "supportedLanguages": [
      "en"
    ]
  },
  "collections": [
    {
      "id": "notes",
      "title": "Notes",
      "include": "notes/**/*.md",
      "entryCount": 1
    },
    {
      "id": "todos",
      "title": "Todos",
      "include": "todos/**/*.md",
      "entryCount": 1
    },
    {
      "id": "users",
      "title": "Users",
      "include": "users/**/*.md",
      "entryCount": 1
    }
  ],
  "views": [
    {
      "id": "todos",
      "path": "{{todos_view_path}}",
      "surface": "page",
      "mode": "kanban",
      "collection": "todos",
      "title": "Todos"
    }
  ],
  "entries": [
    {
      "path": "notes/account-model.md",
      "collection": "notes",
      "kind": "note",
      "title": "Account model"
    },
    {
      "path": "todos/user-registration.md",
      "collection": "todos",
      "kind": "todo",
      "title": "User registration",
      "summary": "Register users",
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
          "intent": "link"
        },
        {
          "source": "body",
          "targetPath": "users/tiscs.md",
          "intent": "embed"
        }
      ]
    },
    {
      "path": "users/tiscs.md",
      "collection": "users",
      "kind": "user",
      "title": "Tiscs"
    }
  ]
}
"#
        .replace(
            "{{todos_view_path}}",
            &format!("{FORMA_VIEWS_DIR}/todos.md"),
        );
        assert_eq!(json, expected_json);
        assert_eq!(json, summary_index_json(&discovery.index));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_reports_missing_stale_and_invalid_index() {
        let root = fixture_root("freshness");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");

        let missing = index_check(&root);
        assert_eq!(missing.status, OperationStatus::Warning);
        assert_eq!(missing.diagnostics[0].code, "index.missing");

        index_rebuild(&root).unwrap();
        write_entry(&root, "notes/b.md", "---\nkind: note\ntitle: B\n---\n");
        let stale = index_check(&root);
        assert_eq!(stale.diagnostics[0].code, "index.stale");

        fs::write(root.join(FORMA_INDEX_SUMMARY_PATH), "{").unwrap();
        let invalid = index_check(&root);
        assert_eq!(invalid.status, OperationStatus::Failed);
        assert_eq!(invalid.diagnostics[0].code, "index.invalid");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn index_rebuild_does_not_rewrite_when_errors_are_present() {
        let root = fixture_root("rebuild-errors");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");
        index_rebuild(&root).unwrap();
        let original = fs::read_to_string(root.join(FORMA_INDEX_SUMMARY_PATH)).unwrap();

        write_entry(&root, "notes/broken.md", "---\ntitle: [broken\n---\nBody\n");
        let result = index_rebuild(&root).unwrap();
        let after_failed_rebuild = fs::read_to_string(root.join(FORMA_INDEX_SUMMARY_PATH)).unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "markdown.frontmatter.invalidYaml")
        );
        assert_eq!(after_failed_rebuild, original);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn unresolved_and_ambiguous_refs_are_diagnostics_not_index_refs() {
        let root = fixture_root("refs");
        write_workspace(&root);
        write_entry(
            &root,
            "notes/a/duplicate.md",
            "---\nkind: note\ntitle: A\n---\n",
        );
        write_entry(
            &root,
            "notes/b/duplicate.md",
            "---\nkind: note\ntitle: B\n---\n",
        );
        write_entry(
            &root,
            "todos/broken.md",
            "---\nkind: todo\ntitle: Broken\nassignees:\n  - Missing User\n---\n[[duplicate]] [[missing-note]]\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let todo = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "todos/broken.md")
            .unwrap();

        assert!(todo.refs.is_empty());
        assert!(
            discovery
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "ref.unresolved")
        );
        assert!(
            discovery
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "ref.ambiguous")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_frontmatter_and_invalid_view_produce_runtime_diagnostics() {
        let root = fixture_root("invalid");
        write_workspace(&root);
        write_entry(&root, "notes/broken.md", "---\ntitle: [broken\n---\nBody\n");
        write_view(
            &root,
            "bad.md",
            "---\ntitle: Bad\nsurface: page\nmode: table\ncollection: missing\n---\n",
        );

        let result = check_workspace(&root);

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "markdown.frontmatter.invalidYaml")
        );
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.invalid")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_config_produces_runtime_diagnostic() {
        let root = fixture_root("invalid-config");
        write_workspace(&root);
        fs::write(
            root.join(FORMA_COLLECTIONS_PATH),
            "schemaVersion: [broken\n",
        )
        .unwrap();

        let result = check_workspace(&root);

        assert_eq!(result.status, OperationStatus::Failed);
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].code, "config.parseFailed");
        assert_eq!(
            result.diagnostics[0].path.as_deref(),
            Some(FORMA_COLLECTIONS_PATH)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn public_paths_are_workspace_relative_posix_paths() {
        let root = fixture_root("paths");
        write_workspace(&root);
        write_entry(
            &root,
            "notes/nested/path.md",
            "---\nkind: note\ntitle: Path\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();

        assert_eq!(discovery.index.entries[0].path, "notes/nested/path.md");
        assert!(!summary_index_json(&discovery.index).contains(root.to_string_lossy().as_ref()));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn committed_summary_index_ignores_local_overrides() {
        let root = fixture_root("local-overrides");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");
        fs::create_dir_all(root.join(FORMA_LOCAL_OVERRIDES_PATH).parent().unwrap()).unwrap();
        fs::write(
            root.join(FORMA_LOCAL_OVERRIDES_PATH),
            "workspace:\n  name: Local Only\n",
        )
        .unwrap();

        let discovery = discover_workspace(&root).unwrap();

        assert_eq!(discovery.index.workspace.name, "Acme Knowledge");
        fs::remove_dir_all(root).unwrap();
    }

    fn write_workspace(root: &Path) {
        fs::create_dir_all(root.join(FORMA_TEMPLATES_DIR)).unwrap();
        fs::create_dir_all(root.join(FORMA_VIEWS_DIR)).unwrap();
        fs::write(
            root.join(FORMA_WORKSPACE_PATH),
            "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\n",
        )
        .unwrap();
        fs::write(
            root.join(FORMA_TYPES_PATH),
            "schemaVersion: 1\ntypes:\n  note:\n    kind: collection\n    collection: notes\n  todo:\n    kind: collection\n    collection: todos\n  user:\n    kind: collection\n    collection: users\n    input:\n      transform: slugify\n",
        )
        .unwrap();
        fs::write(
            root.join(FORMA_COLLECTIONS_PATH),
            format!(
                "schemaVersion: 1\ncollections:\n  notes:\n    title: Notes\n    include: notes/**/*.md\n    template: {FORMA_TEMPLATES_DIR}/note.md\n    conventions:\n      titleField: title\n      summaryField: summary\n    schema:\n      type: object\n      fields:\n        kind:\n          type: const\n          value: note\n        title:\n          type: string\n  todos:\n    title: Todos\n    include: todos/**/*.md\n    template: {FORMA_TEMPLATES_DIR}/todo.md\n    conventions:\n      titleField: title\n      summaryField: summary\n    schema:\n      type: object\n      fields:\n        kind:\n          type: const\n          value: todo\n        title:\n          type: string\n          required: true\n        summary:\n          type: string\n        assignees:\n          type: list\n          items:\n            type: ref\n            target: user\n  users:\n    title: Users\n    include: users/**/*.md\n    template: {FORMA_TEMPLATES_DIR}/user.md\n    conventions:\n      titleField: title\n    schema:\n      type: object\n      fields:\n        kind:\n          type: const\n          value: user\n        title:\n          type: string\n"
            ),
        )
        .unwrap();
    }

    fn write_entry(root: &Path, path: &str, contents: &str) {
        let path = root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn write_view(root: &Path, path: &str, contents: &str) {
        let path = root.join(FORMA_VIEWS_DIR).join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, contents).unwrap();
    }

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-index-{name}-{unique}"))
    }
}
