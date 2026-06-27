use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use globset::{Glob, GlobSet, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{
    ConfigError, DisplayOptions, LoadMode, SemanticType, WorkspaceConfig, config_source_paths,
    load_workspace,
};
use crate::diagnostics::{Diagnostic, DiagnosticLocation, DiagnosticSummary, OperationStatus};
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent};
use crate::operations::workspace_skill_diagnostics;
use crate::path::{FORMA_CONFIG_PATH, WorkspacePath, slugify_path_segment};
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
    pub include_patterns: Vec<String>,
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
    pub fragment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_kind: Option<ReferenceFragmentKind>,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReferenceFragmentKind {
    Heading,
    Block,
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
    by_suffix: BTreeMap<String, Vec<String>>,
    by_basename: BTreeMap<String, Vec<String>>,
    by_space: BTreeMap<String, BTreeSet<String>>,
}

#[derive(Debug, Clone)]
struct RefField {
    field: String,
    semantic_type: Option<String>,
    space: Option<String>,
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
            include_patterns: space.include_patterns.clone(),
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
    let root = root.as_ref();
    let mut diagnostics = match discover_workspace(root) {
        Ok(discovery) => {
            let mut diagnostics = discovery.diagnostics;
            if let Ok(workspace) = load_workspace(root, LoadMode::SharedOnly) {
                diagnostics.extend(workspace_skill_diagnostics(
                    &workspace.root,
                    &workspace.config,
                ));
            }
            diagnostics
        }
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
    let config_source_paths = config_source_paths(root, LoadMode::SharedOnly)
        .map(|sources| {
            sources
                .into_iter()
                .map(|source| source.path)
                .collect::<BTreeSet<_>>()
        })
        .unwrap_or_default();
    let supported_language_suffixes = supported_language_suffixes(config);
    let matchers = build_space_matchers(config, diagnostics);
    let mut entries = Vec::new();
    let mut variants_by_canonical = BTreeMap::<String, Vec<CandidateVariant>>::new();

    for path in markdown_files {
        let Some(relative) = workspace_relative_path(root, &path) else {
            continue;
        };
        if config_source_paths.contains(&relative) {
            continue;
        }
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
        let include_patterns = if space.include_patterns.is_empty() {
            std::slice::from_ref(&space.include)
        } else {
            space.include_patterns.as_slice()
        };
        let mut has_valid_pattern = false;
        for include in include_patterns {
            match Glob::new(include) {
                Ok(glob) => {
                    builder.add(glob);
                    has_valid_pattern = true;
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
        if has_valid_pattern && let Ok(set) = builder.build() {
            matchers.push((space_id.clone(), set));
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
            if matches!(name, ".git" | "target" | "node_modules") {
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
    let mut views = Vec::new();

    let Ok(sources) = config_source_paths(root, LoadMode::SharedOnly) else {
        return views;
    };
    for relative in sources
        .into_iter()
        .filter(|source| source.path.ends_with(".md") || source.path.ends_with(".mdx"))
        .map(|source| source.path)
    {
        let Ok(source) = fs::read_to_string(root.join(&relative)) else {
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
            continue;
        };
        if required_string(&value, "kind").as_deref() != Some("view") {
            continue;
        }
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
        SchemaNode::Named { name, .. } => {
            if let Some(field) = ref_field_for_semantic_type(config, name, field_path, many, true) {
                fields.push(field);
            }
        }
        SchemaNode::Ref { target, .. } => {
            if let Some(target) = target {
                if let Some(field) =
                    ref_field_for_semantic_type(config, target, field_path, many, true)
                {
                    fields.push(field);
                }
            } else {
                fields.push(RefField {
                    field: field_path.to_string(),
                    semantic_type: None,
                    space: None,
                    transform: None,
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

fn ref_field_for_semantic_type(
    config: &WorkspaceConfig,
    type_name: &str,
    field_path: &str,
    many: bool,
    include_semantic_type: bool,
) -> Option<RefField> {
    let semantic_type = config.types.get(type_name)?;
    let transform = match semantic_type {
        SemanticType::Ref { input, .. } => input.transform.clone(),
        SemanticType::Enum { .. } => return None,
    };
    Some(RefField {
        field: field_path.to_string(),
        semantic_type: include_semantic_type.then(|| type_name.to_string()),
        space: semantic_type.space().map(ToOwned::to_owned),
        transform,
        many,
    })
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
    match path_index.resolve(&target, field.space.as_deref()) {
        ResolveResult::Resolved(target_path) => refs.push(IndexReference {
            source: ReferenceSource::Frontmatter,
            field: Some(field.field.clone()),
            target_path,
            fragment: None,
            fragment_kind: None,
            target_title: None,
            semantic_type: field.semantic_type.clone(),
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
                .with_expected(
                    field
                        .semantic_type
                        .as_ref()
                        .map_or_else(|| "entry".to_string(), |target| format!("{target} entry")),
                ),
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
        if matches!(reference.intent, FormaReferenceIntent::View) {
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
                fragment: None,
                fragment_kind: None,
                target_title: non_empty_string(reference.label.clone()),
                semantic_type: None,
                intent,
            });
            continue;
        }
        let target = split_reference_target(&reference.target, source_path);
        match path_index.resolve_from(&target.path, source_path, None) {
            ResolveResult::Resolved(target_path) => refs.push(IndexReference {
                source: ReferenceSource::Body,
                field: None,
                target_path,
                fragment: target.fragment,
                fragment_kind: target.fragment_kind,
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct SplitReferenceTarget {
    path: String,
    fragment: Option<String>,
    fragment_kind: Option<ReferenceFragmentKind>,
}

fn split_reference_target(raw_target: &str, source_path: &str) -> SplitReferenceTarget {
    let trimmed = raw_target.trim();
    let (raw_path, raw_fragment) = trimmed.split_once('#').unwrap_or((trimmed, ""));
    let path = if raw_path.is_empty() {
        source_path.to_string()
    } else {
        raw_path.to_string()
    };
    let (fragment, fragment_kind) = reference_fragment(raw_fragment);

    SplitReferenceTarget {
        path,
        fragment,
        fragment_kind,
    }
}

fn reference_fragment(raw_fragment: &str) -> (Option<String>, Option<ReferenceFragmentKind>) {
    let fragment = raw_fragment.trim();
    if fragment.is_empty() {
        return (None, None);
    }
    if let Some(block) = fragment.strip_prefix('^') {
        let block = block.trim();
        if block.is_empty() {
            (None, None)
        } else {
            (Some(block.to_string()), Some(ReferenceFragmentKind::Block))
        }
    } else {
        (
            Some(fragment.to_string()),
            Some(ReferenceFragmentKind::Heading),
        )
    }
}

enum ResolveResult {
    Resolved(String),
    Unresolved,
    Ambiguous,
}

impl PathIndex {
    fn from_entries(entries: &[CandidateEntry]) -> Self {
        let mut all_paths = BTreeSet::new();
        let mut by_suffix: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut by_basename: BTreeMap<String, Vec<String>> = BTreeMap::new();
        let mut by_space: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();

        for entry in entries {
            all_paths.insert(entry.path.clone());
            if let Some((_, suffix)) = entry.path.split_once('/') {
                by_suffix
                    .entry(suffix.to_string())
                    .or_default()
                    .push(entry.path.clone());
            }
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
            by_suffix,
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

        let suffix_matches = candidates
            .iter()
            .filter_map(|candidate| self.by_suffix.get(candidate))
            .flatten()
            .filter(|path| self.path_allowed(path, space))
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>();
        match suffix_matches.len() {
            1 => return ResolveResult::Resolved(suffix_matches[0].clone()),
            2.. => return ResolveResult::Ambiguous,
            0 => {}
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
    target.starts_with("http://") || target.starts_with("https://") || target.starts_with("mailto:")
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
    path.strip_suffix(".md")
        .or_else(|| path.strip_suffix(".mdx"))
        .unwrap_or(path)
        .to_string()
}

pub(crate) fn config_error_diagnostic(error: ConfigError) -> Diagnostic {
    match error {
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
    use crate::path::FORMA_CONFIG_PATH;

    const FIXTURE_VIEWS_DIR: &str = ".forma/views";

    #[test]
    fn builds_deterministic_summary_index_with_resolved_refs() {
        let root = fixture_root("valid");
        write_workspace(&root);
        write_entry(
            &root,
            "members/alex-chen.md",
            "---\nkind: member\ntitle: Alex Chen\n---\n",
        );
        write_entry(
            &root,
            "notes/account-model.md",
            "---\nkind: note\ntitle: Account model\n---\n",
        );
        write_entry(
            &root,
            "tasks/member-registration.md",
            "---\nkind: task\ntitle: User registration\nsummary: Register members\nassignees:\n  - members/alex-chen.md\n---\nSee [[notes/account-model]] and ![[members/alex-chen]].\n",
        );
        write_view(
            &root,
            "tasks.md",
            "---\nkind: view\ntitle: Tasks\nmode: kanban\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - tasks\n---\n<!-- forma:content -->\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let json = read_model_json(&discovery.index);

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(discovery.index.entries.len(), 3);
        assert_eq!(discovery.index.spaces[0].id, "members");
        let expected_json = r#"{
  "schemaVersion": 1,
  "workspace": {
    "name": "Acme Workspace",
    "canonicalLanguage": "en",
    "supportedLanguages": [
      "en"
    ]
  },
  "spaces": [
    {
      "id": "members",
      "title": "Members",
      "include": "members/**/*.md",
      "includePatterns": [
        "members/**/*.md"
      ],
      "entryCount": 1
    },
    {
      "id": "notes",
      "title": "Notes",
      "include": "notes/**/*.md",
      "includePatterns": [
        "notes/**/*.md"
      ],
      "entryCount": 1
    },
    {
      "id": "tasks",
      "title": "Tasks",
      "include": "tasks/**/*.md",
      "includePatterns": [
        "tasks/**/*.md"
      ],
      "entryCount": 1
    }
  ],
  "views": [
    {
      "id": "{{tasks_view_id}}",
      "path": "{{tasks_view_path}}",
      "surface": "page",
      "mode": "kanban",
      "space": "tasks",
      "source": {
        "type": "pages",
        "taxonomy": {
          "spaces": [
            "tasks"
          ]
        }
      },
      "title": "Tasks"
    }
  ],
  "entries": [
    {
      "path": "members/alex-chen.md",
      "space": "members",
      "kind": "member",
      "title": "Alex Chen"
    },
    {
      "path": "notes/account-model.md",
      "space": "notes",
      "kind": "note",
      "title": "Account model"
    },
    {
      "path": "tasks/member-registration.md",
      "space": "tasks",
      "kind": "task",
      "title": "User registration",
      "summary": "Register members",
      "refs": [
        {
          "source": "frontmatter",
          "field": "assignees",
          "targetPath": "members/alex-chen.md",
          "semanticType": "member",
          "intent": "reference"
        },
        {
          "source": "body",
          "targetPath": "notes/account-model.md",
          "intent": "link"
        },
        {
          "source": "body",
          "targetPath": "members/alex-chen.md",
          "intent": "embed"
        }
      ]
    }
  ]
}
"#
        .replace(
            "{{tasks_view_path}}",
            &format!("{FIXTURE_VIEWS_DIR}/tasks.md"),
        )
        .replace("{{tasks_view_id}}", &format!("{FIXTURE_VIEWS_DIR}/tasks"));
        assert_eq!(json, expected_json);
        assert_eq!(json, read_model_json(&discovery.index));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn language_variant_files_do_not_become_primary_index_entries() {
        let root = fixture_root("language-variants");
        write_workspace(&root);
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n    - zh-Hans\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        );
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
        assert_eq!(
            discovery
                .index
                .spaces
                .iter()
                .find(|space| space.id == "notes")
                .unwrap()
                .entry_count,
            1
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn included_view_config_nodes_can_live_outside_forma_views() {
        let root = fixture_root("included-view-outside-forma-views");
        write_workspace(&root);
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - views/*.md\n",
        );
        write_workspace_file(
            &root,
            "views/tasks.md",
            "---\nkind: view\nmode: table\ntitle: Tasks\nsource:\n  type: pages\n  query:\n    field: taxonomy.space\n    op: equals\n    value: tasks\n---\n\n# Tasks\n",
        );

        let discovery = discover_workspace(&root).unwrap();

        assert!(
            discovery
                .index
                .views
                .iter()
                .any(|view| view.id == "views/tasks" && view.path == "views/tasks.md")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn broad_space_includes_do_not_index_config_source_nodes_as_entries() {
        let root = fixture_root("broad-include-excludes-config-sources");
        write_workspace(&root);
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - \"**/*.md\"\ncreate:\n  directory: notes\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: fields.title\n  summaryField: fields.summary\nschema:\n  type: object\n  fields:\n    kind:\n      type: string\n---\n\n# Notes\n",
        )
        .unwrap();
        write_entry(
            &root,
            "notes/ordinary.md",
            "---\nkind: note\ntitle: Ordinary\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();

        assert!(
            discovery
                .index
                .entries
                .iter()
                .any(|entry| entry.path == "notes/ordinary.md")
        );
        assert!(
            discovery
                .index
                .entries
                .iter()
                .all(|entry| !entry.path.starts_with(".forma/"))
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn canonical_entries_include_available_language_variants() {
        let root = fixture_root("language-variant-metadata");
        write_workspace(&root);
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n    - zh-Hans\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        );
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
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n    - zh-Hans\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        );
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
    fn resolves_wikilink_fragments_against_page_targets() {
        let root = fixture_root("wikilink-fragments");
        write_workspace(&root);
        write_entry(
            &root,
            "notes/source.md",
            "---\nkind: note\ntitle: Source\n---\nSee [[notes/project-brief#Goals]], [[notes/project-brief#^risk-block]], [[#Local]], and [[#^local-block]].\n\n## Local\n\nLocal. ^local-block\n",
        );
        write_entry(
            &root,
            "notes/project-brief.md",
            "---\nkind: note\ntitle: Project Brief\n---\n## Goals\n\nRisk. ^risk-block\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let entry = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "notes/source.md")
            .unwrap();

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(entry.refs.len(), 4);
        assert_eq!(entry.refs[0].target_path, "notes/project-brief.md");
        assert_eq!(entry.refs[0].fragment.as_deref(), Some("Goals"));
        assert_eq!(
            entry.refs[0].fragment_kind,
            Some(ReferenceFragmentKind::Heading)
        );
        assert_eq!(entry.refs[1].target_path, "notes/project-brief.md");
        assert_eq!(entry.refs[1].fragment.as_deref(), Some("risk-block"));
        assert_eq!(
            entry.refs[1].fragment_kind,
            Some(ReferenceFragmentKind::Block)
        );
        assert_eq!(entry.refs[2].target_path, "notes/source.md");
        assert_eq!(entry.refs[2].fragment.as_deref(), Some("Local"));
        assert_eq!(
            entry.refs[2].fragment_kind,
            Some(ReferenceFragmentKind::Heading)
        );
        assert_eq!(entry.refs[3].target_path, "notes/source.md");
        assert_eq!(entry.refs[3].fragment.as_deref(), Some("local-block"));
        assert_eq!(
            entry.refs[3].fragment_kind,
            Some(ReferenceFragmentKind::Block)
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolves_unique_suffix_paths_for_repository_root_workspaces() {
        let root = fixture_root("repository-root-suffix-links");
        write_workspace(&root);
        fs::write(
            root.join(".forma/spaces/project.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Project\ninclude:\n  - knowledge/**/*.md\ncreate:\n  directory: knowledge\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\n    slug:\n      default: \"{{ input.title }}\"\n      transform: slugify\n---\n\n# Project\n",
        )
        .unwrap();
        write_entry(
            &root,
            "knowledge/tasks/ship-cli.md",
            "---\nkind: task\ntitle: Ship CLI\n---\nSee [[product/product-direction]].\n",
        );
        write_entry(
            &root,
            "knowledge/product/product-direction.md",
            "---\nkind: note\ntitle: Product Direction\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let task = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "knowledge/tasks/ship-cli.md")
            .unwrap();

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(
            task.refs[0].target_path,
            "knowledge/product/product-direction.md"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn indexes_workspace_source_graph_view_without_space_filter() {
        let root = fixture_root("graph-view");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");
        write_view(
            &root,
            "workspace-graph.md",
            "---\nkind: view\nmode: graph\ntitle: Workspace Graph\nsource:\n  type: pages\n  include:\n    - \"**/*.md\"\n  exclude:\n    - \".forma/**\"\n    - \"**/local/**\"\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let view = discovery
            .index
            .views
            .iter()
            .find(|view| view.id == ".forma/views/workspace-graph")
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
            "tasks/broken.md",
            "---\nkind: task\ntitle: Broken\nassignees:\n  - Missing User\n---\n[[duplicate]] [[missing-note]]\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let task = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "tasks/broken.md")
            .unwrap();

        assert!(task.refs.is_empty());
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
    fn resolves_named_ref_type_frontmatter_references() {
        let root = fixture_root("named-ref-frontmatter");
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join(FIXTURE_VIEWS_DIR)).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ntypes:\n  member:\n    kind: ref\n    source: .forma/spaces/members\n    input:\n      transform: slugify\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n",
        );
        write_workspace_file(
            &root,
            ".forma/spaces/members.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Members\ninclude:\n  - members/**/*.md\ncreate:\n  directory: members\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/member.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: title\nschema:\n  type: object\n  fields:\n    kind:\n      type: string\n    title:\n      type: string\n---\n\n# Members\n",
        );
        write_workspace_file(
            &root,
            ".forma/spaces/tasks.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Tasks\ninclude:\n  - tasks/**/*.md\ncreate:\n  directory: tasks\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/task.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: title\nschema:\n  type: object\n  fields:\n    kind:\n      type: string\n    title:\n      type: string\n    assignees:\n      type: list\n      items:\n        type: member\n---\n\n# Tasks\n",
        );
        write_workspace_file(
            &root,
            ".forma/spaces/templates/member.md",
            "---\nkind: member\ntitle: \"{{ input.title }}\"\n---\n",
        );
        write_workspace_file(
            &root,
            ".forma/spaces/templates/task.md",
            "---\nkind: task\ntitle: \"{{ input.title }}\"\n---\n",
        );
        write_entry(
            &root,
            "members/alex-chen.md",
            "---\nkind: member\ntitle: Alex Chen\n---\n",
        );
        write_entry(
            &root,
            "tasks/connect-related-pages.md",
            "---\nkind: task\ntitle: Connect Related Pages\nassignees:\n  - Alex Chen\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let entry = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "tasks/connect-related-pages.md")
            .unwrap();

        assert!(
            discovery.diagnostics.is_empty(),
            "{:#?}",
            discovery.diagnostics
        );
        assert_eq!(entry.refs.len(), 1);
        assert_eq!(entry.refs[0].target_path, "members/alex-chen.md");
        assert_eq!(entry.refs[0].semantic_type.as_deref(), Some("member"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn frontmatter_refs_do_not_accept_wikilink_markup() {
        let root = fixture_root("frontmatter-wikilink-ref");
        write_workspace(&root);
        write_entry(
            &root,
            "members/alex-chen.md",
            "---\nkind: member\ntitle: Alex Chen\n---\n",
        );
        write_entry(
            &root,
            "tasks/broken.md",
            "---\nkind: task\ntitle: Broken\nassignees:\n  - \"[[members/alex-chen]]\"\n---\n",
        );

        let discovery = discover_workspace(&root).unwrap();
        let task = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "tasks/broken.md")
            .unwrap();

        assert!(task.refs.is_empty());
        assert!(discovery.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "ref.unresolved"
                && diagnostic
                    .actual
                    .as_deref()
                    .is_some_and(|actual| actual == "[[members/alex-chen]]")
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
            "---\nkind: view\ntitle: Bad\nsurface: page\nmode: table\nspace: missing\n---\n",
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
            root.join(FORMA_CONFIG_PATH),
            "---\nschemaVersion: [broken\n---\n",
        )
        .unwrap();

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
    fn check_reports_invalid_guideline_skill_metadata() {
        let root = fixture_root("invalid-guideline-skill");
        write_workspace(&root);
        add_workspace_guidelines(&root, &["notes/guideline.md"]);
        write_entry(
            &root,
            "notes/guideline.md",
            "---\ntitle: Guideline\nskill:\n  title: Missing Id\n---\n",
        );

        let result = check_workspace(&root);

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(result.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "skills.invalidMetadata"
                && diagnostic.path.as_deref() == Some("notes/guideline.md")
        }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn check_reports_duplicate_guideline_skill_ids() {
        let root = fixture_root("duplicate-guideline-skill");
        write_workspace(&root);
        add_workspace_guidelines(&root, &["notes/first.md", "notes/second.md"]);
        write_entry(
            &root,
            "notes/first.md",
            "---\ntitle: First\nskill:\n  id: duplicate-skill\n---\n",
        );
        write_entry(
            &root,
            "notes/second.md",
            "---\ntitle: Second\nskill:\n  id: duplicate-skill\n---\n",
        );

        let result = check_workspace(&root);

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.duplicateId")
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
    fn committed_summary_index_uses_explicitly_included_config() {
        let root = fixture_root("included-config");
        write_workspace(&root);
        write_entry(&root, "notes/a.md", "---\nkind: note\ntitle: A\n---\n");
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.yml"),
            "workspace:\n  name: Explicitly Included\n",
        )
        .unwrap();

        let discovery = discover_workspace(&root).unwrap();

        assert_eq!(discovery.index.workspace.name, "Explicitly Included");
        fs::remove_dir_all(root).unwrap();
    }

    fn write_workspace(root: &Path) {
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join(FIXTURE_VIEWS_DIR)).unwrap();
        write_config(
            root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ntypes:\n  member:\n    kind: ref\n    source: .forma/spaces/members\n    input:\n      transform: slugify\ninclude:\n  - .forma/spaces/*.md\n  - .forma/views/*.md\n  - .forma/local/*.yml\n",
        );
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
                ".forma/spaces/tasks.md",
                "Tasks",
                "tasks/**/*.md",
                ".forma/spaces/templates/task.md",
                "fields.title",
                "fields.summary",
            ),
            (
                ".forma/spaces/members.md",
                "Members",
                "members/**/*.md",
                ".forma/spaces/templates/member.md",
                "fields.title",
                "fields.summary",
            ),
        ] {
            let schema = if title == "Tasks" {
                "schema:\n  type: object\n  fields:\n    kind:\n      type: string\n    assignees:\n      type: list\n      items:\n        type: ref\n        target: member\n"
            } else {
                "schema:\n  type: object\n  fields:\n    kind:\n      type: string\n"
            };
            fs::write(
                root.join(path),
                format!(
                    "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: {title}\ninclude:\n  - {include}\ncreate:\n  directory: {}\n  filename: \"{{{{ input.slug }}}}.md\"\n  template: {template}\n  inputs:\n    title:\n      required: true\n    slug:\n      default: \"{{{{ input.title }}}}\"\n      transform: slugify\nconventions:\n  titleField: {title_field}\n  summaryField: {summary_field}\n{schema}---\n\n# {title}\n",
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
            root.join(".forma/spaces/templates/task.md"),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/member.md"),
            "---\nkind: member\ntitle: \"{{ input.title }}\"\n---\n",
        )
        .unwrap();
    }

    fn add_workspace_guidelines(root: &Path, paths: &[&str]) {
        let config_path = root.join(FORMA_CONFIG_PATH);
        let mut config = fs::read_to_string(&config_path).unwrap();
        let mut guidelines = String::from("guidelines:\n");
        for path in paths {
            guidelines.push_str(&format!("  - {path}\n"));
        }
        config = config.replacen("\n---\n", &format!("\n{guidelines}---\n"), 1);
        fs::write(config_path, config).unwrap();
    }

    fn write_config(root: &Path, yaml: impl AsRef<str>) {
        let yaml = yaml.as_ref();
        let yaml = if yaml.contains("\ntypes:\n") || yaml.starts_with("types:\n") {
            yaml.to_string()
        } else {
            yaml.replacen(
                "\ninclude:\n",
                "\ntypes:\n  member:\n    kind: ref\n    source: .forma/spaces/members\n    input:\n      transform: slugify\n\ninclude:\n",
                1,
            )
        };
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            format!("---\n{}---\n\n# Forma Workspace\n", yaml),
        )
        .unwrap();
    }

    fn write_entry(root: &Path, path: &str, contents: &str) {
        write_workspace_file(root, path, contents);
    }

    fn write_view(root: &Path, path: &str, contents: &str) {
        write_workspace_file(root, &format!("{FIXTURE_VIEWS_DIR}/{path}"), contents);
    }

    fn write_workspace_file(root: &Path, path: &str, contents: &str) {
        let path = root.join(path);
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
