use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use globset::{Glob, GlobSet, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{
    ConfigError, DisplayOptions, LoadMode, SemanticType, WorkspaceConfig, load_workspace,
};
use crate::diagnostics::{Diagnostic, DiagnosticLocation, DiagnosticSummary, OperationStatus};
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent};
use crate::path::{
    FORMA_CONFIG_PATH, FORMA_DIR, FORMA_VIEWS_DIR, WorkspacePath, slugify_path_segment,
};
use crate::schema::{SchemaNode, parse_space_schema, validate_schema_value};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryIndex {
    pub schema_version: u16,
    pub workspace: IndexWorkspace,
    pub spaces: Vec<IndexSpace>,
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
pub struct IndexSpace {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<IndexViewSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexViewSource {
    #[serde(rename = "type")]
    pub source_type: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub include: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub exclude: Vec<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub taxonomy: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexEntry {
    pub path: String,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variants: Vec<IndexEntryVariant>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub refs: Vec<IndexReference>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexEntryVariant {
    pub language: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexReference {
    pub source: ReferenceSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub target_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_title: Option<String>,
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

#[derive(Debug, Clone)]
pub struct Discovery {
    pub index: SummaryIndex,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone)]
struct CandidateEntry {
    path: String,
    space: String,
    document: FormaMarkdownDocument,
    variants: Vec<CandidateVariant>,
}

#[derive(Debug, Clone)]
struct CandidateVariant {
    language: String,
    path: String,
    document: FormaMarkdownDocument,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LanguageSuffix {
    suffix: String,
    language: String,
}

#[derive(Debug, Clone)]
struct PathIndex {
    all_paths: BTreeSet<String>,
    by_basename: BTreeMap<String, Vec<String>>,
    by_space: BTreeMap<String, BTreeSet<String>>,
}

#[derive(Debug, Clone)]
struct RefField {
    field: String,
    semantic_type: String,
    space: String,
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
        let space = &config.spaces[&entry.space];
        if let Ok(schema) = parse_space_schema(space) {
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

        let frontmatter_value = entry.document.frontmatter.value.as_ref();
        let variants = entry
            .variants
            .iter()
            .map(|variant| {
                let frontmatter_value = variant.document.frontmatter.value.as_ref();
                IndexEntryVariant {
                    language: variant.language.clone(),
                    path: variant.path.clone(),
                    kind: scalar_field(frontmatter_value, "kind"),
                    title: title_for_entry(frontmatter_value, space),
                    summary: summary_for_entry(frontmatter_value, space),
                }
            })
            .collect();
        index_entries.push(IndexEntry {
            path: entry.path.clone(),
            space: entry.space.clone(),
            kind: scalar_field(frontmatter_value, "kind"),
            title: title_for_entry(frontmatter_value, space),
            summary: summary_for_entry(frontmatter_value, space),
            variants,
            refs,
        });
    }

    let mut spaces = config
        .spaces
        .iter()
        .map(|(id, space)| IndexSpace {
            id: id.clone(),
            title: space.title.clone(),
            display: space.display.clone(),
            include: space.include.clone(),
            entry_count: path_index.by_space.get(id).map(BTreeSet::len).unwrap_or(0),
        })
        .collect::<Vec<_>>();
    spaces.sort_by(|left, right| space_sort_key(left).cmp(&space_sort_key(right)));

    let mut views = discover_views(&root, &config, &mut diagnostics);
    views.sort_by(|left, right| view_sort_key(left).cmp(&view_sort_key(right)));
    diagnostics.extend(resource_description_diagnostics(&root));
    index_entries.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(Discovery {
        index: SummaryIndex {
            schema_version: 1,
            workspace: IndexWorkspace {
                name: config.workspace.name,
                canonical_language: config.workspace.canonical_language,
                supported_languages: config.workspace.supported_languages,
            },
            spaces,
            views,
            entries: index_entries,
        },
        diagnostics,
    })
}

pub fn check_workspace(root: impl AsRef<Path>) -> CheckResult {
    let mut diagnostics = match discover_workspace(root.as_ref()) {
        Ok(discovery) => discovery.diagnostics,
        Err(error) => vec![config_error_diagnostic(error)],
    };
    diagnostics.sort_by_key(diagnostic_sort_key);
    check_result("check", diagnostics)
}

#[cfg(test)]
fn read_model_json(index: &SummaryIndex) -> String {
    let mut output = serde_json::to_string_pretty(index).expect("read model should serialize");
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
    let markdown_paths = markdown_files
        .iter()
        .filter_map(|path| workspace_relative_path(root, path))
        .collect::<BTreeSet<_>>();
    let supported_language_suffixes = supported_language_suffixes(config);
    let matchers = build_space_matchers(config, diagnostics);
    let mut entries = Vec::new();
    let mut variants_by_canonical = BTreeMap::<String, Vec<CandidateVariant>>::new();

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
                    "space.membership.ambiguous",
                    "Entry matches multiple spaces.",
                )
                .with_path(relative),
            );
            continue;
        }
        if let Some((language, canonical_path)) =
            language_variant_canonical_path(&relative, &supported_language_suffixes)
        {
            if !markdown_paths.contains(&canonical_path) {
                diagnostics.push(
                    Diagnostic::warning(
                        "languageVariant.canonicalMissing",
                        "Language variant does not have a canonical page.",
                    )
                    .with_path(relative)
                    .with_actual(language)
                    .with_expected(canonical_path),
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
                    variants_by_canonical
                        .entry(canonical_path)
                        .or_default()
                        .push(CandidateVariant {
                            language,
                            path: relative,
                            document,
                        });
                }
                Err(error) => diagnostics.push(
                    Diagnostic::error("file.readFailed", "Workspace file could not be read.")
                        .with_path(relative)
                        .with_actual(error.to_string()),
                ),
            }
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
                    space: matched[0].clone(),
                    document,
                    variants: Vec::new(),
                });
            }
            Err(error) => diagnostics.push(
                Diagnostic::error("file.readFailed", "Workspace file could not be read.")
                    .with_path(relative)
                    .with_actual(error.to_string()),
            ),
        }
    }

    for entry in &mut entries {
        if let Some(mut variants) = variants_by_canonical.remove(&entry.path) {
            variants.sort_by(|left, right| {
                (left.language.as_str(), left.path.as_str())
                    .cmp(&(right.language.as_str(), right.path.as_str()))
            });
            entry.variants = variants;
        }
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    entries
}

fn supported_language_suffixes(config: &WorkspaceConfig) -> Vec<LanguageSuffix> {
    let mut suffixes = config
        .workspace
        .supported_languages
        .iter()
        .chain(std::iter::once(&config.workspace.canonical_language))
        .filter_map(|language| {
            let suffix = language.to_ascii_lowercase();
            (!suffix.trim().is_empty()).then(|| (suffix, language.clone()))
        })
        .collect::<BTreeMap<_, _>>()
        .into_iter()
        .map(|(suffix, language)| LanguageSuffix { suffix, language })
        .collect::<Vec<_>>();
    suffixes.sort_by_key(|language| std::cmp::Reverse(language.suffix.len()));
    suffixes
}

fn language_variant_canonical_path(
    path: &str,
    language_suffixes: &[LanguageSuffix],
) -> Option<(String, String)> {
    let Some(stem) = path.strip_suffix(".md") else {
        return None;
    };
    let (directory, filename_stem) = stem.rsplit_once('/').unwrap_or(("", stem));
    for language in language_suffixes {
        let suffix = format!(".{}", language.suffix);
        let Some(canonical_stem) = filename_stem.strip_suffix(&suffix) else {
            continue;
        };
        if canonical_stem.is_empty() {
            continue;
        }
        let canonical_path = if directory.is_empty() {
            format!("{canonical_stem}.md")
        } else {
            format!("{directory}/{canonical_stem}.md")
        };
        return Some((language.language.clone(), canonical_path));
    }
    None
}

fn build_space_matchers(
    config: &WorkspaceConfig,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<(String, GlobSet)> {
    let mut matchers = Vec::new();
    for (space_id, space) in &config.spaces {
        let mut builder = GlobSetBuilder::new();
        match Glob::new(&space.include) {
            Ok(glob) => {
                builder.add(glob);
                if let Ok(set) = builder.build() {
                    matchers.push((space_id.clone(), set));
                }
            }
            Err(error) => diagnostics.push(
                Diagnostic::error("config.globInvalid", "Space include glob is invalid.")
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: format!("spaces.{space_id}.include"),
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
        let surface = required_string(&value, "surface").unwrap_or_else(|| "page".to_string());
        let mode = required_string(&value, "view.mode").or_else(|| required_string(&value, "mode"));
        let mut space =
            required_string(&value, "view.space").or_else(|| required_string(&value, "space"));
        let source = parse_view_source(&value);
        if space.is_none() {
            space = source.as_ref().and_then(source_taxonomy_space);
        }
        let title =
            optional_string(&value, "view.title").or_else(|| optional_string(&value, "title"));
        let display = DisplayOptions {
            order: optional_i64(&value, "view.display.order")
                .or_else(|| optional_i64(&value, "display.order")),
        };
        let valid_space = space
            .as_ref()
            .is_none_or(|space| config.spaces.contains_key(space));
        let valid_source = source
            .as_ref()
            .is_none_or(|source| source.source_type == "pages");
        if mode.is_none() || !valid_space || !valid_source {
            diagnostics.push(
                Diagnostic::error("view.invalid", "View definition is invalid.")
                    .with_path(relative.clone()),
            );
            continue;
        }
        views.push(IndexView {
            id: view_id(&relative),
            path: relative,
            surface,
            mode: mode.unwrap(),
            space,
            source,
            title,
            display,
        });
    }

    views
}

fn space_sort_key(space: &IndexSpace) -> (bool, i64, &str, &str) {
    (
        space.display.order.is_none(),
        space.display.order.unwrap_or(0),
        space.title.as_str(),
        space.id.as_str(),
    )
}

fn view_sort_key(view: &IndexView) -> (bool, i64, &str, &str, &str) {
    (
        view.display.order.is_none(),
        view.display.order.unwrap_or(0),
        view.title.as_deref().unwrap_or(view.id.as_str()),
        view.id.as_str(),
        view.path.as_str(),
    )
}

fn resource_description_diagnostics(root: &Path) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    for path in collect_markdown_files(root) {
        let Some(description_path) = workspace_relative_path(root, &path) else {
            continue;
        };
        let Some(target_path) = resource_description_target(&description_path) else {
            continue;
        };
        if !root.join(&target_path).is_file() {
            diagnostics.push(
                Diagnostic::error(
                    "resource.description.missingTarget",
                    "Resource description target is missing.",
                )
                .with_path(description_path)
                .with_location(DiagnosticLocation::File)
                .with_expected(target_path),
            );
        }
    }
    diagnostics
}

fn resource_description_target(path: &str) -> Option<String> {
    let target = path.strip_suffix(".md")?;
    media_type_for_resource_target(target)?;
    Some(target.to_string())
}

fn media_type_for_resource_target(path: &str) -> Option<&'static str> {
    let media_type = crate::operations::media_type_for_workspace_path(path)?;
    (media_type != "text/markdown").then_some(media_type)
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
            if let Some(SemanticType::Space { space, input }) = config.types.get(target) {
                fields.push(RefField {
                    field: field_path.to_string(),
                    semantic_type: target.clone(),
                    space: space.clone(),
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
    let mut target = raw_target.trim().to_string();
    let should_transform = !is_explicit_path_reference(&target);
    if should_transform && let Some(transform) = field.transform.as_deref() {
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
    match path_index.resolve(&target, Some(&field.space)) {
        ResolveResult::Resolved(target_path) => refs.push(IndexReference {
            source: ReferenceSource::Frontmatter,
            field: Some(field.field.clone()),
            target_path,
            target_title: None,
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
            || reference.target.starts_with('#')
        {
            continue;
        }
        let intent = match reference.intent {
            FormaReferenceIntent::Link => ReferenceIntent::Link,
            FormaReferenceIntent::Embed => ReferenceIntent::Embed,
            FormaReferenceIntent::View => continue,
        };
        if is_external_target(&reference.target) {
            refs.push(IndexReference {
                source: ReferenceSource::Body,
                field: None,
                target_path: reference.target.clone(),
                target_title: non_empty_string(reference.label.clone()),
                semantic_type: None,
                intent,
            });
            continue;
        }
        match path_index.resolve_from(&reference.target, source_path, None) {
            ResolveResult::Resolved(target_path) => refs.push(IndexReference {
                source: ReferenceSource::Body,
                field: None,
                target_path,
                target_title: non_empty_string(reference.label.clone()),
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
        let mut by_space: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();

        for entry in entries {
            all_paths.insert(entry.path.clone());
            let basename = basename_id(&entry.path);
            by_basename
                .entry(basename)
                .or_default()
                .push(entry.path.clone());
            by_space
                .entry(entry.space.clone())
                .or_default()
                .insert(entry.path.clone());
        }

        Self {
            all_paths,
            by_basename,
            by_space,
        }
    }

    fn resolve(&self, raw_target: &str, space: Option<&str>) -> ResolveResult {
        self.resolve_candidates(candidate_paths(raw_target), space)
    }

    fn resolve_from(
        &self,
        raw_target: &str,
        source_path: &str,
        space: Option<&str>,
    ) -> ResolveResult {
        let target = strip_reference_markup(raw_target);
        if let Some(relative) = relative_reference_path(&target, source_path) {
            let result = self.resolve_candidates(candidate_paths(&relative), space);
            if !matches!(result, ResolveResult::Unresolved) {
                return result;
            }
        }
        self.resolve_candidates(candidate_paths(&target), space)
    }

    fn resolve_candidates(&self, candidates: Vec<String>, space: Option<&str>) -> ResolveResult {
        for candidate in &candidates {
            if self.path_allowed(&candidate, space) {
                return ResolveResult::Resolved(candidate.clone());
            }
        }

        if candidates.iter().any(|candidate| candidate.contains('/')) {
            return ResolveResult::Unresolved;
        }

        let matches = self
            .by_basename
            .get(candidates[0].strip_suffix(".md").unwrap_or(&candidates[0]))
            .into_iter()
            .flatten()
            .filter(|path| self.path_allowed(path, space))
            .cloned()
            .collect::<Vec<_>>();

        match matches.len() {
            0 => ResolveResult::Unresolved,
            1 => ResolveResult::Resolved(matches[0].clone()),
            _ => ResolveResult::Ambiguous,
        }
    }

    fn path_allowed(&self, path: &str, space: Option<&str>) -> bool {
        if !self.all_paths.contains(path) {
            return false;
        }
        match space {
            Some(space) => self
                .by_space
                .get(space)
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

fn relative_reference_path(target: &str, source_path: &str) -> Option<String> {
    if !(target.starts_with("./") || target.starts_with("../")) {
        return None;
    }

    let source_dir = source_path.rsplit_once('/').map_or("", |(dir, _)| dir);
    normalize_posix_path(&format!("{source_dir}/{target}"))
}

fn normalize_posix_path(path: &str) -> Option<String> {
    let mut parts = Vec::new();
    for part in path.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop()?;
            }
            value => parts.push(value),
        }
    }
    Some(parts.join("/"))
}

fn is_explicit_path_reference(target: &str) -> bool {
    target.contains('/') || target.ends_with(".md")
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
    space: &crate::config::SpaceDefinition,
) -> Option<String> {
    space
        .conventions
        .title_field
        .as_deref()
        .and_then(|field| scalar_field(value, field))
        .or_else(|| scalar_field(value, "title"))
}

fn summary_for_entry(
    value: Option<&Value>,
    space: &crate::config::SpaceDefinition,
) -> Option<String> {
    space
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

fn optional_i64(value: &Value, field: &str) -> Option<i64> {
    value_at_path(value, field).and_then(Value::as_i64)
}

fn parse_view_source(value: &Value) -> Option<IndexViewSource> {
    let source = value_at_path(value, "source").or_else(|| value_at_path(value, "view.source"))?;
    let source_type = optional_string(source, "type")?;
    Some(IndexViewSource {
        source_type,
        include: string_sequence(source, "include"),
        exclude: string_sequence(source, "exclude"),
        taxonomy: taxonomy_filter(source),
    })
}

fn source_taxonomy_space(source: &IndexViewSource) -> Option<String> {
    let terms = source.taxonomy.get("spaces")?;
    (terms.len() == 1).then(|| terms[0].clone())
}

fn taxonomy_filter(value: &Value) -> BTreeMap<String, Vec<String>> {
    let Some(taxonomy) = value_at_path(value, "taxonomy") else {
        return BTreeMap::new();
    };
    let Some(mapping) = taxonomy.as_mapping() else {
        return BTreeMap::new();
    };
    mapping
        .iter()
        .filter_map(|(key, value)| {
            Some((
                key.as_str()?.to_string(),
                value
                    .as_sequence()?
                    .iter()
                    .filter_map(Value::as_str)
                    .map(ToOwned::to_owned)
                    .collect(),
            ))
        })
        .collect()
}

fn string_sequence(value: &Value, field: &str) -> Vec<String> {
    value_at_path(value, field)
        .and_then(Value::as_sequence)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
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

fn non_empty_string(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.trim().is_empty())
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
    use crate::path::{FORMA_CONFIG_PATH, FORMA_LOCAL_OVERRIDES_PATH};

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
            "---\nkind: todo\ntitle: User registration\nsummary: Register users\nassignees:\n  - users/tiscs.md\n---\nSee [[notes/account-model]] and ![[users/tiscs]].\n",
        );
        write_view(
            &root,
            "todos.md",
            "---\nkind: view\ntitle: Todos\nmode: kanban\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - todos\n---\n<!-- forma:content -->\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let json = read_model_json(&discovery.index);

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(discovery.index.entries.len(), 3);
        assert_eq!(discovery.index.spaces[0].id, "notes");
        let expected_json = r#"{
  "schemaVersion": 1,
  "workspace": {
    "name": "Acme Knowledge",
    "canonicalLanguage": "en",
    "supportedLanguages": [
      "en"
    ]
  },
  "spaces": [
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
      "space": "todos",
      "source": {
        "type": "pages",
        "taxonomy": {
          "spaces": [
            "todos"
          ]
        }
      },
      "title": "Todos"
    }
  ],
  "entries": [
    {
      "path": "notes/account-model.md",
      "space": "notes",
      "kind": "note",
      "title": "Account model"
    },
    {
      "path": "todos/user-registration.md",
      "space": "todos",
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
      "space": "users",
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
        assert_eq!(json, read_model_json(&discovery.index));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn language_variant_files_do_not_become_primary_index_entries() {
        let root = fixture_root("language-variants");
        write_workspace(&root);
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n    - zh-Hans\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        )
        .unwrap();
        write_entry(
            &root,
            "notes/getting-started.md",
            "---\nkind: note\ntitle: Getting Started\n---\n",
        );
        write_entry(
            &root,
            "notes/getting-started.zh-hans.md",
            "---\nkind: note\ntitle: 快速开始\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(
            discovery
                .index
                .entries
                .iter()
                .map(|entry| entry.path.as_str())
                .collect::<Vec<_>>(),
            vec!["notes/getting-started.md"]
        );
        assert_eq!(discovery.index.spaces[0].entry_count, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn canonical_entries_include_available_language_variants() {
        let root = fixture_root("language-variant-metadata");
        write_workspace(&root);
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n    - zh-Hans\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        )
        .unwrap();
        write_entry(
            &root,
            "notes/getting-started.md",
            "---\nkind: note\ntitle: Getting Started\nsummary: Canonical summary\n---\n",
        );
        write_entry(
            &root,
            "notes/getting-started.zh-hans.md",
            "---\nkind: note\ntitle: Getting Started ZH\nsummary: Variant summary\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let entry = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "notes/getting-started.md")
            .unwrap();

        assert_eq!(entry.variants.len(), 1);
        assert_eq!(entry.variants[0].language, "zh-Hans");
        assert_eq!(entry.variants[0].path, "notes/getting-started.zh-hans.md");
        assert_eq!(
            entry.variants[0].title.as_deref(),
            Some("Getting Started ZH")
        );
        assert_eq!(
            entry.variants[0].summary.as_deref(),
            Some("Variant summary")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn language_variant_without_canonical_page_reports_diagnostic() {
        let root = fixture_root("language-variant-missing-canonical");
        write_workspace(&root);
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n    - zh-Hans\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        )
        .unwrap();
        write_entry(
            &root,
            "notes/missing.zh-hans.md",
            "---\nkind: note\ntitle: Missing Canonical\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();

        assert!(discovery.index.entries.is_empty());
        assert_eq!(discovery.index.spaces[0].entry_count, 0);
        assert_eq!(discovery.diagnostics.len(), 1);
        let diagnostic = &discovery.diagnostics[0];
        assert_eq!(diagnostic.code, "languageVariant.canonicalMissing");
        assert_eq!(diagnostic.path.as_deref(), Some("notes/missing.zh-hans.md"));
        assert_eq!(diagnostic.actual.as_deref(), Some("zh-Hans"));
        assert_eq!(diagnostic.expected.as_deref(), Some("notes/missing.md"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolves_body_markdown_links_relative_to_source_file() {
        let root = fixture_root("relative-links");
        write_workspace(&root);
        write_entry(
            &root,
            "notes/guide/start.md",
            "---\nkind: note\ntitle: Start\n---\n[Next](./next.md)\n",
        );
        write_entry(
            &root,
            "notes/guide/next.md",
            "---\nkind: note\ntitle: Next\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let entry = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "notes/guide/start.md")
            .unwrap();

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(entry.refs[0].target_path, "notes/guide/next.md");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_ignores_persistent_index_file_by_default() {
        let root = fixture_root("freshness");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");

        fs::write(root.join(".forma/index.summary.json"), "{").unwrap();
        write_entry(&root, "notes/b.md", "---\nkind: note\ntitle: B\n---\n");

        let result = check_workspace(&root);

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.diagnostics.is_empty(), "{:#?}", result.diagnostics);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn indexes_workspace_source_graph_view_without_space_filter() {
        let root = fixture_root("graph-view");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");
        write_view(
            &root,
            "knowledge-graph.md",
            "---\nkind: view\nmode: graph\ntitle: Knowledge Graph\nsource:\n  type: pages\n  include:\n    - \"**/*.md\"\n  exclude:\n    - \".forma/**\"\n    - \"**/local/**\"\n---\n\n# Knowledge Graph\n\n<!-- forma:content -->\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let view = discovery
            .index
            .views
            .iter()
            .find(|view| view.id == "knowledge-graph")
            .expect("graph view should be indexed");

        assert!(discovery.diagnostics.is_empty());
        assert_eq!(view.mode, "graph");
        assert_eq!(view.space, None);
        assert_eq!(
            view.source
                .as_ref()
                .map(|source| source.source_type.as_str()),
            Some("pages")
        );
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
    fn frontmatter_refs_do_not_accept_wikilink_markup() {
        let root = fixture_root("frontmatter-wikilink-ref");
        write_workspace(&root);
        write_entry(
            &root,
            "users/tiscs.md",
            "---\nkind: user\ntitle: Tiscs\n---\n",
        );
        write_entry(
            &root,
            "todos/broken.md",
            "---\nkind: todo\ntitle: Broken\nassignees:\n  - \"[[users/tiscs]]\"\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let todo = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "todos/broken.md")
            .unwrap();

        assert!(todo.refs.is_empty());
        assert!(discovery.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "ref.unresolved"
                && diagnostic
                    .actual
                    .as_deref()
                    .is_some_and(|actual| actual == "[[users/tiscs]]")
        }));
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
            "---\ntitle: Bad\nsurface: page\nmode: table\nspace: missing\n---\n",
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
        fs::write(root.join(FORMA_CONFIG_PATH), "schemaVersion: [broken\n").unwrap();

        let result = check_workspace(&root);

        assert_eq!(result.status, OperationStatus::Failed);
        assert_eq!(result.diagnostics.len(), 1);
        assert_eq!(result.diagnostics[0].code, "config.parseFailed");
        assert_eq!(
            result.diagnostics[0].path.as_deref(),
            Some(FORMA_CONFIG_PATH)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resource_description_documents_report_missing_targets() {
        let root = fixture_root("resource-description-health");
        write_workspace(&root);
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/logo.png"), b"\x89PNG\r\n\x1a\n").unwrap();
        write_entry(&root, "assets/logo.png.md", "---\ntitle: Logo\n---\n");
        write_entry(&root, "assets/missing.png.md", "---\ntitle: Missing\n---\n");

        let discovery = discover_workspace(&root).unwrap();

        assert!(discovery.index.entries.iter().all(|entry| {
            entry.path != "assets/logo.png" && entry.path != "assets/logo.png.md"
        }));
        assert!(
            discovery
                .diagnostics
                .iter()
                .all(|diagnostic| diagnostic.path.as_deref() != Some("assets/logo.png.md"))
        );
        let missing = discovery
            .diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "resource.description.missingTarget")
            .expect("missing resource target should produce a diagnostic");
        assert_eq!(missing.path.as_deref(), Some("assets/missing.png.md"));
        assert_eq!(missing.location, Some(DiagnosticLocation::File));
        assert_eq!(missing.expected.as_deref(), Some("assets/missing.png"));
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
        assert!(!read_model_json(&discovery.index).contains(root.to_string_lossy().as_ref()));
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
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join(FORMA_VIEWS_DIR)).unwrap();
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        )
        .unwrap();
        for (path, title, include, template, title_field, summary_field) in [
            (
                ".forma/spaces/notes.md",
                "Notes",
                "notes/**/*.md",
                ".forma/spaces/templates/note.md",
                "fields.title",
                "fields.summary",
            ),
            (
                ".forma/spaces/todos.md",
                "Todos",
                "todos/**/*.md",
                ".forma/spaces/templates/todo.md",
                "fields.title",
                "fields.summary",
            ),
            (
                ".forma/spaces/users.md",
                "Users",
                "users/**/*.md",
                ".forma/spaces/templates/user.md",
                "fields.title",
                "fields.summary",
            ),
        ] {
            fs::write(
                root.join(path),
                format!(
                    "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: {title}\ninclude:\n  - {include}\ncreate:\n  directory: {}\n  filename: \"{{{{ input.slug }}}}.md\"\n  template: {template}\n  inputs:\n    title:\n      required: true\n    slug:\n      default: \"{{{{ input.title }}}}\"\n      transform: slugify\nconventions:\n  titleField: {title_field}\n  summaryField: {summary_field}\n---\n\n# {title}\n",
                    include.split('/').next().unwrap_or("notes")
                ),
            )
            .unwrap();
        }
        fs::write(
            root.join(".forma/spaces/templates/note.md"),
            "---\nkind: note\ntitle: \"{{ input.title }}\"\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/todo.md"),
            "---\nkind: todo\ntitle: \"{{ input.title }}\"\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/user.md"),
            "---\nkind: user\ntitle: \"{{ input.title }}\"\n---\n",
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
