use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock};

use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::boundary::{WorkspaceBoundary, WorkspaceBoundaryError};
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::markdown::FormaMarkdownDocument;
use crate::model::{
    ConfigProjection, ConfigProvenance, ResolvedWorkspaceModel, SemanticTypeId, TaxonomyId,
    TaxonomyTermId, TypedConfigGraph, TypedSemanticTypeNode, TypedTaxonomyNode, TypedTermNode,
    resolve_workspace_model,
};
use crate::path::{FORMA_CONFIG_PATH, PathError, WorkspaceGlob, WorkspacePath};
use crate::scan::WorkspaceScanPlan;
use crate::schema::validate_content_group_schemas;

#[derive(Debug, Clone, PartialEq)]
pub struct FormaWorkspace {
    pub root: PathBuf,
    pub config: WorkspaceConfig,
    pub config_sources: Vec<ConfigSourcePath>,
    pub config_source_patterns: Vec<String>,
    pub diagnostics: Vec<Diagnostic>,
    pub model: Arc<ResolvedWorkspaceModel>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigSourcePath {
    pub path: String,
    pub present: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub schema_version: u64,
    pub workspace: WorkspaceSettings,
    #[serde(default)]
    pub runtime: RuntimeConfig,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub guidelines: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dashboard: Option<Value>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub taxonomies: BTreeMap<String, Value>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub terms: BTreeMap<String, BTreeMap<String, TaxonomyTermDefinition>>,
    #[serde(default)]
    pub types: BTreeMap<String, SemanticType>,
    #[serde(default)]
    pub spaces: BTreeMap<String, SpaceDefinition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct WorkspaceSettings {
    pub name: String,
    pub canonical_language: String,
    #[serde(default)]
    pub supported_languages: Vec<String>,
    pub timezone: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<WorkspaceLogoConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceLogoConfig {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct RuntimeConfig {
    #[serde(default)]
    pub values: BTreeMap<String, RuntimeValueProvider>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum RuntimeValueProvider {
    Const {
        value: Value,
        #[serde(default)]
        required: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        transform: Option<String>,
    },
    GitConfig {
        key: String,
        #[serde(default)]
        required: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        transform: Option<String>,
    },
    CurrentDate,
    CurrentDateTime,
    WorkspaceRoot,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SemanticType {
    EntryRef {
        source: String,
        #[serde(default)]
        input: TypeInput,
    },
    Enum {
        values: Vec<String>,
    },
}

impl SemanticType {
    pub fn source(&self) -> Option<&str> {
        match self {
            Self::EntryRef { source, .. } => Some(source.as_str()),
            Self::Enum { .. } => None,
        }
    }
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TypeInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceDefinition {
    pub title: String,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(default)]
    pub description: Option<String>,
    pub include: String,
    #[serde(default, skip_deserializing, skip_serializing_if = "Vec::is_empty")]
    pub include_patterns: Vec<String>,
    pub template: String,
    #[serde(default)]
    pub create: Option<CreateDefinition>,
    #[serde(default)]
    pub conventions: SpaceConventions,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub guidelines: Vec<String>,
    pub schema: Value,
}

pub type ContentGroupDefinition = SpaceDefinition;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomyTermDefinition {
    pub title: String,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub include_patterns: Vec<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

impl DisplayOptions {
    pub fn is_empty(&self) -> bool {
        self.order.is_none() && self.icon.is_none() && self.color.is_none()
    }

    pub fn sanitized(mut self) -> Self {
        if self
            .icon
            .as_deref()
            .is_some_and(|icon| !is_supported_display_icon(icon))
        {
            self.icon = None;
        }
        if self
            .color
            .as_deref()
            .is_some_and(|color| !is_valid_display_color(color))
        {
            self.color = None;
        }
        self
    }
}

static DISPLAY_ICON_IDS: LazyLock<BTreeSet<&'static str>> = LazyLock::new(|| {
    serde_json::from_str::<Vec<&'static str>>(include_str!("display-icon-registry.json"))
        .expect("the checked-in display icon registry is valid JSON")
        .into_iter()
        .collect()
});

pub fn is_supported_display_icon(icon: &str) -> bool {
    DISPLAY_ICON_IDS.contains(icon)
}

pub fn is_valid_display_color(color: &str) -> bool {
    color.len() == 7
        && color.starts_with('#')
        && color.as_bytes()[1..]
            .iter()
            .all(|character| character.is_ascii_hexdigit())
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDefinition {
    pub directory: String,
    pub filename: String,
    #[serde(default)]
    pub inputs: BTreeMap<String, CreateInput>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInput {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub value_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<Value>,
    #[serde(default)]
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceConventions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at_field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at_field: Option<String>,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("failed to read {path}: {source}")]
    Read {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to write {path}: {source}")]
    Write {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse {path}: {source}")]
    Parse {
        path: String,
        #[source]
        source: serde_yml::Error,
    },
    #[error("root config field `include` has been renamed to `imports` in {path}")]
    LegacyRootInclude { path: String },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFile {
    schema_version: u64,
    workspace: WorkspaceSettings,
    #[serde(default)]
    imports: Vec<String>,
    #[serde(default)]
    include: Option<Value>,
    #[serde(default)]
    runtime: RuntimeConfig,
    #[serde(default)]
    guidelines: Vec<String>,
    #[serde(default)]
    dashboard: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigNode {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    taxonomy: Option<String>,
    #[serde(default)]
    projection: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    display: DisplayOptions,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    include: Vec<String>,
    #[serde(default)]
    create: Option<TermCreateDefinition>,
    #[serde(default)]
    conventions: SpaceConventions,
    #[serde(default)]
    guidelines: Vec<String>,
    #[serde(default)]
    types: BTreeMap<String, SemanticType>,
    #[serde(default)]
    schema: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TermCreateDefinition {
    directory: String,
    filename: String,
    template: String,
    #[serde(default)]
    inputs: BTreeMap<String, CreateInput>,
}

pub fn load_workspace(root: impl AsRef<Path>) -> Result<FormaWorkspace, ConfigError> {
    let root = root.as_ref();
    let config_path = resolve_config_file(root, FORMA_CONFIG_PATH)?;

    let mut config_value = read_markdown_frontmatter_value(&config_path, FORMA_CONFIG_PATH)?;
    let mut diagnostics = Vec::new();
    let mut types = BTreeMap::new();
    let mut type_sources = BTreeMap::new();
    let root_types = take_types_from_value(&mut config_value, FORMA_CONFIG_PATH)?;
    merge_type_definitions(
        &mut types,
        &mut type_sources,
        root_types,
        FORMA_CONFIG_PATH,
        &mut diagnostics,
    );

    let base_config_file: ConfigFile =
        serde_yml::from_value(config_value.clone()).map_err(|source| ConfigError::Parse {
            path: FORMA_CONFIG_PATH.to_string(),
            source,
        })?;
    reject_legacy_root_include(&base_config_file, FORMA_CONFIG_PATH)?;
    let bootstrap_scan_plan =
        WorkspaceScanPlan::from_imports(root, &base_config_file.imports, &mut diagnostics);
    let config_source_patterns = bootstrap_scan_plan.config_patterns().patterns().to_vec();
    let imported_config_paths = included_markdown_config_paths(root, &bootstrap_scan_plan);
    for public_path in &imported_config_paths {
        let imported_path = resolve_config_file(root, public_path)?;
        let mut local_value = read_markdown_frontmatter_value(&imported_path, public_path)?;
        if config_node_kind(&local_value).is_some() {
            continue;
        }
        let local_types = take_types_from_value(&mut local_value, public_path)?;
        merge_type_definitions(
            &mut types,
            &mut type_sources,
            local_types,
            public_path,
            &mut diagnostics,
        );
        deep_merge(&mut config_value, local_value);
    }

    let config_file: ConfigFile =
        serde_yml::from_value(config_value).map_err(|source| ConfigError::Parse {
            path: FORMA_CONFIG_PATH.to_string(),
            source,
        })?;
    reject_legacy_root_include(&config_file, FORMA_CONFIG_PATH)?;

    let (taxonomies, terms, config_graph, node_diagnostics) =
        load_config_nodes(root, &imported_config_paths, &mut types, &mut type_sources)?;
    diagnostics.extend(node_diagnostics);

    let mut config = WorkspaceConfig {
        schema_version: config_file.schema_version,
        workspace: config_file.workspace,
        runtime: config_file.runtime,
        guidelines: config_file.guidelines,
        dashboard: config_file.dashboard,
        taxonomies,
        terms,
        types,
        spaces: BTreeMap::new(),
    };

    let mut config_sources = vec![ConfigSourcePath {
        path: FORMA_CONFIG_PATH.to_string(),
        present: true,
    }];
    config_sources.extend(
        imported_config_paths
            .into_iter()
            .map(|path| ConfigSourcePath {
                present: true,
                path,
            }),
    );
    config_sources.sort_by(|left, right| left.path.cmp(&right.path));
    config_sources.dedup_by(|left, right| left.path == right.path);

    let (spaces, model) = resolve_workspace_model(
        config_graph,
        &config,
        bootstrap_scan_plan,
        config_sources.iter().map(|source| source.path.clone()),
        &mut diagnostics,
    );
    config.spaces = spaces;
    diagnostics.extend(validate_config_paths(root, &config, &model));
    diagnostics.extend(validate_content_group_schemas(&config, &model));

    Ok(FormaWorkspace {
        root: root.to_path_buf(),
        config,
        config_sources,
        config_source_patterns,
        diagnostics,
        model,
    })
}

fn reject_legacy_root_include(config_file: &ConfigFile, path: &str) -> Result<(), ConfigError> {
    if config_file.include.is_some() {
        return Err(ConfigError::LegacyRootInclude {
            path: path.to_string(),
        });
    }
    Ok(())
}

type LoadedConfigNodes = (
    BTreeMap<String, Value>,
    BTreeMap<String, BTreeMap<String, TaxonomyTermDefinition>>,
    TypedConfigGraph,
    Vec<Diagnostic>,
);

fn load_config_nodes(
    root: &Path,
    imported_config_paths: &[String],
    types: &mut BTreeMap<String, SemanticType>,
    type_sources: &mut BTreeMap<String, ConfigProvenance>,
) -> Result<LoadedConfigNodes, ConfigError> {
    let mut taxonomies = BTreeMap::new();
    let mut terms = BTreeMap::<String, BTreeMap<String, TaxonomyTermDefinition>>::new();
    let mut config_graph = TypedConfigGraph::new(ConfigProvenance::new(FORMA_CONFIG_PATH));
    let mut diagnostics = Vec::new();
    let mut referenced_taxonomies = Vec::new();
    let mut parsed_nodes = Vec::new();

    for public_path in imported_config_paths {
        let source =
            fs::read_to_string(resolve_config_file(root, public_path)?).map_err(|source| {
                ConfigError::Read {
                    path: public_path.clone(),
                    source,
                }
            })?;
        let document = crate::markdown::FormaMarkdownDocument::parse(&source);
        let Some(frontmatter) = document.frontmatter.value else {
            continue;
        };
        let node: ConfigNode =
            serde_yml::from_value(frontmatter.clone()).map_err(|source| ConfigError::Parse {
                path: public_path.clone(),
                source,
            })?;
        parsed_nodes.push((public_path.clone(), frontmatter, node));
    }

    let referenced_template_paths = parsed_nodes
        .iter()
        .filter_map(|(_, _, node)| node.create.as_ref())
        .filter_map(|create| WorkspacePath::parse_config(&create.template).ok())
        .map(|path| path.as_str().to_string())
        .collect::<BTreeSet<_>>();

    for (public_path, mut frontmatter, node) in parsed_nodes {
        let has_top_level_types = !node.types.is_empty();
        let has_explicit_type_kind = node.kind.as_deref() == Some("types");
        if has_explicit_type_kind || has_top_level_types {
            merge_type_definitions(
                types,
                type_sources,
                node.types,
                &public_path,
                &mut diagnostics,
            );

            if has_explicit_type_kind {
                continue;
            }
        }
        if node.kind.as_deref() == Some("taxonomy") {
            validate_display_options(&public_path, &node.display, &mut diagnostics);
            set_config_value_display(&mut frontmatter, &node.display.clone().sanitized());
            let taxonomy_id = node
                .id
                .clone()
                .unwrap_or_else(|| view_id_from_config_path(&public_path));
            let projection =
                parse_config_projection(node.projection.as_deref(), &public_path, &mut diagnostics);
            config_graph.insert_taxonomy(TypedTaxonomyNode::new(
                TaxonomyId::new(taxonomy_id.clone()),
                projection,
                ConfigProvenance::new(&public_path),
            ));
            taxonomies.insert(taxonomy_id, frontmatter);
            continue;
        }
        if let Some(kind) = node.kind.as_deref()
            && frontmatter.get("schemaVersion").is_some()
            && !referenced_template_paths.contains(&public_path)
            && !matches!(kind, "term" | "types" | "view")
        {
            diagnostics.push(
                Diagnostic::warning(
                    "config.unknownNodeKind",
                    format!("Imported config node kind `{kind}` is not recognized."),
                )
                .with_path(public_path.clone())
                .with_location(DiagnosticLocation::Frontmatter {
                    field: "kind".to_string(),
                    index: None,
                })
                .with_actual(kind.to_string())
                .with_expected("taxonomy, term, types, or view".to_string()),
            );
            continue;
        }
        if node.kind.as_deref() != Some("term") {
            continue;
        }
        validate_display_options(&public_path, &node.display, &mut diagnostics);
        let display = node.display.clone().sanitized();
        let Some(taxonomy) = node.taxonomy.clone() else {
            continue;
        };
        referenced_taxonomies.push((taxonomy.clone(), public_path.clone()));
        let Some(term_id) = node.id.clone().or_else(|| {
            Path::new(&public_path)
                .file_stem()
                .and_then(|stem| stem.to_str())
                .map(ToOwned::to_owned)
        }) else {
            continue;
        };
        let title = node.title.clone().unwrap_or_else(|| public_path.clone());
        let content_group_candidate = node.include.first().cloned().map(|include| {
            let schema = node
                .schema
                .clone()
                .unwrap_or_else(|| starter_term_schema(&term_id));
            SpaceDefinition {
                title: title.clone(),
                display: display.clone(),
                description: node.description.clone(),
                include,
                include_patterns: node.include.clone(),
                template: node
                    .create
                    .as_ref()
                    .map(|create| create.template.clone())
                    .unwrap_or_default(),
                create: node.create.as_ref().map(|create| CreateDefinition {
                    directory: create.directory.clone(),
                    filename: create.filename.clone(),
                    inputs: create.inputs.clone(),
                }),
                conventions: node.conventions.clone(),
                guidelines: node.guidelines.clone(),
                schema,
            }
        });
        terms.entry(taxonomy.clone()).or_default().insert(
            term_id.clone(),
            TaxonomyTermDefinition {
                title: title.clone(),
                display: display.clone(),
                description: node.description.clone(),
                include_patterns: node.include.clone(),
            },
        );
        config_graph.insert_term(TypedTermNode::new(
            TaxonomyTermId::new(taxonomy, term_id),
            ConfigProvenance::new(&public_path),
            content_group_candidate,
        ));
    }

    for (taxonomy, public_path) in referenced_taxonomies {
        if !taxonomies.contains_key(&taxonomy) {
            diagnostics.push(
                Diagnostic::warning(
                    "config.taxonomyMissing",
                    format!("Term config references taxonomy `{taxonomy}`, but no taxonomy config with id `{taxonomy}` was found."),
                )
                .with_path(public_path)
                .with_location(DiagnosticLocation::Frontmatter {
                    field: "taxonomy".to_string(),
                    index: None,
                })
                .with_actual(taxonomy.clone())
                .with_expected(format!("kind: taxonomy with id: {taxonomy}")),
            );
        }
    }

    for (type_name, provenance) in type_sources {
        config_graph.insert_semantic_type(TypedSemanticTypeNode::new(
            SemanticTypeId::new(type_name),
            provenance.clone(),
        ));
    }

    Ok((taxonomies, terms, config_graph, diagnostics))
}

fn parse_config_projection(
    projection: Option<&str>,
    public_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<ConfigProjection> {
    match projection {
        None => None,
        Some("contentGroups") => Some(ConfigProjection::ContentGroups),
        Some(projection) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.projection.unknown",
                    format!("Config projection `{projection}` is not recognized."),
                )
                .with_path(public_path)
                .with_location(DiagnosticLocation::Frontmatter {
                    field: "projection".to_string(),
                    index: None,
                })
                .with_actual(projection)
                .with_expected("contentGroups"),
            );
            None
        }
    }
}

fn validate_display_options(
    public_path: &str,
    display: &DisplayOptions,
    diagnostics: &mut Vec<Diagnostic>,
) {
    if let Some(icon) = display.icon.as_deref()
        && !is_supported_display_icon(icon)
    {
        diagnostics.push(
            Diagnostic::warning(
                "config.displayIconInvalid",
                format!("Display icon `{icon}` is not in the Forma icon registry."),
            )
            .with_path(public_path)
            .with_location(DiagnosticLocation::Frontmatter {
                field: "display.icon".to_string(),
                index: None,
            })
            .with_actual(icon)
            .with_expected("a supported Forma icon id"),
        );
    }
    if let Some(color) = display.color.as_deref()
        && !is_valid_display_color(color)
    {
        diagnostics.push(
            Diagnostic::warning(
                "config.displayColorInvalid",
                format!("Display color `{color}` must use the #RRGGBB format."),
            )
            .with_path(public_path)
            .with_location(DiagnosticLocation::Frontmatter {
                field: "display.color".to_string(),
                index: None,
            })
            .with_actual(color)
            .with_expected("#RRGGBB"),
        );
    }
}

fn set_config_value_display(value: &mut Value, display: &DisplayOptions) {
    let Value::Mapping(mapping) = value else {
        return;
    };
    let key = Value::String("display".to_string());
    if display.is_empty() {
        mapping.remove(&key);
    } else {
        mapping.insert(
            key,
            serde_yml::to_value(display).expect("display options should serialize"),
        );
    }
}

pub fn config_source_paths(root: impl AsRef<Path>) -> Result<Vec<ConfigSourcePath>, ConfigError> {
    let root = root.as_ref();
    let config_path = resolve_config_file(root, FORMA_CONFIG_PATH)?;
    let mut sources = vec![ConfigSourcePath {
        path: FORMA_CONFIG_PATH.to_string(),
        present: true,
    }];
    let config_file: ConfigFile = read_markdown_frontmatter(&config_path, FORMA_CONFIG_PATH)?;
    let plan = WorkspaceScanPlan::from_imports(root, &config_file.imports, &mut Vec::new());
    for path in included_markdown_config_paths(root, &plan) {
        sources.push(ConfigSourcePath {
            present: true,
            path,
        });
    }
    sources.sort_by(|a, b| a.path.cmp(&b.path));
    sources.dedup_by(|a, b| a.path == b.path);
    Ok(sources)
}

pub fn config_source_patterns(root: impl AsRef<Path>) -> Result<Vec<String>, ConfigError> {
    let root = root.as_ref();
    let config_path = resolve_config_file(root, FORMA_CONFIG_PATH)?;
    let config_file: ConfigFile = read_markdown_frontmatter(&config_path, FORMA_CONFIG_PATH)?;
    reject_legacy_root_include(&config_file, FORMA_CONFIG_PATH)?;
    let plan = WorkspaceScanPlan::from_imports(root, &config_file.imports, &mut Vec::new());
    Ok(plan.config_patterns().patterns().to_vec())
}

fn view_id_from_config_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(path)
        .to_string()
}

fn take_types_from_value(
    value: &mut Value,
    public_path: &str,
) -> Result<BTreeMap<String, SemanticType>, ConfigError> {
    let Some(mapping) = value.as_mapping_mut() else {
        return Ok(BTreeMap::new());
    };
    let Some(types_value) = mapping.remove(Value::String("types".to_string())) else {
        return Ok(BTreeMap::new());
    };
    serde_yml::from_value(types_value).map_err(|source| ConfigError::Parse {
        path: public_path.to_string(),
        source,
    })
}

fn merge_type_definitions(
    types: &mut BTreeMap<String, SemanticType>,
    type_sources: &mut BTreeMap<String, ConfigProvenance>,
    incoming: BTreeMap<String, SemanticType>,
    public_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for (type_name, semantic_type) in incoming {
        if let std::collections::btree_map::Entry::Vacant(entry) = types.entry(type_name.clone()) {
            entry.insert(semantic_type);
            type_sources.insert(type_name, ConfigProvenance::new(public_path));
            continue;
        }
        diagnostics.push(
            Diagnostic::error(
                "config.type.duplicate",
                format!("Type `{type_name}` is defined multiple times."),
            )
            .with_path(public_path)
            .with_location(DiagnosticLocation::Config {
                field: format!("types.{type_name}"),
            })
            .with_actual(type_name),
        );
    }
}

fn starter_term_schema(_space_id: &str) -> Value {
    let schema = "type: object\nfields:\n  kind:\n    type: string\n";
    serde_yml::from_str(schema).expect("built-in starter term schema is valid YAML")
}

fn included_markdown_config_paths(root: &Path, plan: &WorkspaceScanPlan) -> Vec<String> {
    plan.config_patterns()
        .matching_files_with_extensions(&["md", "mdx"])
        .unwrap_or_default()
        .into_iter()
        .filter_map(|path| {
            path.strip_prefix(root)
                .ok()
                .map(|path| path.to_string_lossy().replace('\\', "/"))
        })
        .collect()
}

fn resolve_config_file(root: &Path, public_path: &str) -> Result<PathBuf, ConfigError> {
    let workspace_path = WorkspacePath::parse_config(public_path)
        .map_err(|error| config_boundary_read_error(public_path, error.to_string()))?;
    let boundary = WorkspaceBoundary::new(root)
        .map_err(|error| config_boundary_read_error(public_path, error.to_string()))?;
    boundary
        .resolve_existing_file(&workspace_path)
        .map_err(|error| config_boundary_read_error(public_path, error.to_string()))
}

fn config_boundary_read_error(path: &str, detail: String) -> ConfigError {
    ConfigError::Read {
        path: path.to_string(),
        source: std::io::Error::new(ErrorKind::PermissionDenied, detail),
    }
}

fn config_node_kind(value: &Value) -> Option<&str> {
    value.get("kind").and_then(|kind| kind.as_str())
}

fn read_markdown_frontmatter<T: for<'de> Deserialize<'de>>(
    path: &Path,
    public_path: &str,
) -> Result<T, ConfigError> {
    let value = read_markdown_frontmatter_value(path, public_path)?;
    serde_yml::from_value(value).map_err(|source| ConfigError::Parse {
        path: public_path.to_string(),
        source,
    })
}

fn read_markdown_frontmatter_value(path: &Path, public_path: &str) -> Result<Value, ConfigError> {
    let contents = fs::read_to_string(path).map_err(|source| ConfigError::Read {
        path: public_path.to_string(),
        source,
    })?;
    let document = FormaMarkdownDocument::parse(&contents);
    Ok(document.frontmatter.value.unwrap_or(Value::Null))
}

fn deep_merge(base: &mut Value, overlay: Value) {
    match (base, overlay) {
        (Value::Mapping(base), Value::Mapping(overlay)) => {
            for (key, value) in overlay {
                match base.get_mut(&key) {
                    Some(base_value) => deep_merge(base_value, value),
                    None => {
                        base.insert(key, value);
                    }
                }
            }
        }
        (base, overlay) => *base = overlay,
    }
}

fn validate_config_paths(
    root: &Path,
    config: &WorkspaceConfig,
    model: &ResolvedWorkspaceModel,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();

    if let Some(logo) = &config.workspace.logo {
        match WorkspacePath::parse_config(&logo.path) {
            Ok(path) => push_required_file_diagnostic(
                &mut diagnostics,
                root,
                "config.logoMissing",
                "Workspace logo file is missing.",
                "config.logoNotFile",
                "Workspace logo path does not point to a file.",
                "workspace.logo.path",
                &logo.path,
                &path,
            ),
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "config.pathInvalid",
                        format!("Workspace logo path is invalid: {error}."),
                    )
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: "workspace.logo.path".to_string(),
                    })
                    .with_actual(logo.path.clone()),
                );
            }
        }
    }

    for (index, guideline) in config.guidelines.iter().enumerate() {
        match WorkspacePath::parse_config(guideline) {
            Ok(path) => push_guideline_file_diagnostic(
                &mut diagnostics,
                root,
                &format!("guidelines[{index}]"),
                guideline,
                &path,
            ),
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "config.pathInvalid",
                        format!("Guideline path is invalid: {error}."),
                    )
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: format!("guidelines[{index}]"),
                    })
                    .with_actual(guideline.clone()),
                );
            }
        }
    }

    for (space_id, space) in model.content_groups() {
        let space_id = space_id.as_str();
        for (index, include) in space.include_patterns.iter().enumerate() {
            if let Err(error) = WorkspaceGlob::parse_config(include) {
                diagnostics.push(
                    Diagnostic::error(
                        "config.globInvalid",
                        format!("Space `{space_id}` has an invalid include glob: {error}."),
                    )
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: format!("spaces.{space_id}.include[{index}]"),
                    })
                    .with_actual(include.clone()),
                );
            }
        }
        if let Some(create) = &space.create {
            push_path_diagnostic(
                &mut diagnostics,
                space_id,
                "template",
                &space.template,
                WorkspacePath::parse_config(&space.template),
            );
            if let Ok(path) = WorkspacePath::parse_config(&space.template) {
                push_required_markdown_file_diagnostic(
                    &mut diagnostics,
                    root,
                    "config.templateMissing",
                    "Create template file is missing.",
                    "config.templateNotFile",
                    "Create template path does not point to a file.",
                    "config.templateNotMarkdown",
                    "Create template path must point to a Markdown file.",
                    &format!("spaces.{space_id}.template"),
                    &space.template,
                    &path,
                );
            }
            push_path_diagnostic(
                &mut diagnostics,
                space_id,
                "create.directory",
                &create.directory,
                WorkspacePath::parse_config(&create.directory),
            );
        }
        for (index, guideline) in space.guidelines.iter().enumerate() {
            let field = format!("guidelines[{index}]");
            match WorkspacePath::parse_config(guideline) {
                Ok(path) => push_guideline_file_diagnostic(
                    &mut diagnostics,
                    root,
                    &format!("spaces.{space_id}.{field}"),
                    guideline,
                    &path,
                ),
                Err(error) => {
                    push_path_diagnostic(&mut diagnostics, space_id, &field, guideline, Err(error));
                }
            }
        }
    }

    validate_dashboard_paths(root, config, &mut diagnostics);

    diagnostics
}

fn validate_dashboard_paths(
    root: &Path,
    config: &WorkspaceConfig,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(dashboard) = &config.dashboard else {
        return;
    };
    let Some(sections) = mapping_get(dashboard, "sections").and_then(Value::as_sequence) else {
        return;
    };
    for (index, section) in sections.iter().enumerate() {
        let Some(source) = mapping_get(section, "source") else {
            continue;
        };
        if mapping_get(source, "type").and_then(Value::as_str) != Some("view") {
            continue;
        }
        let Some(view) = mapping_get(source, "view").and_then(Value::as_str) else {
            continue;
        };
        let field = format!("dashboard.sections[{index}].source.view");
        match WorkspacePath::parse_config(view) {
            Ok(path) => push_required_markdown_file_diagnostic(
                diagnostics,
                root,
                "config.dashboardViewMissing",
                "Dashboard view source file is missing.",
                "config.dashboardViewNotFile",
                "Dashboard view source path does not point to a file.",
                "config.dashboardViewNotMarkdown",
                "Dashboard view source path must point to a Markdown file.",
                &field,
                view,
                &path,
            ),
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "config.pathInvalid",
                        format!("Dashboard view source path is invalid: {error}."),
                    )
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config { field })
                    .with_actual(view.to_string()),
                );
            }
        }
    }
}

fn mapping_get<'a>(value: &'a Value, key: &str) -> Option<&'a Value> {
    value.as_mapping()?.get(Value::String(key.to_string()))
}

fn push_guideline_file_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    root: &Path,
    field: &str,
    value: &str,
    path: &WorkspacePath,
) {
    match resolve_configured_file(root, path) {
        Ok(_) if !is_markdown_path(path.as_str()) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.guidelineNotMarkdown",
                    "Configured guideline path must point to a Markdown file.",
                )
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: field.to_string(),
                })
                .with_actual(value.to_string())
                .with_expected("*.md or *.mdx"),
            );
        }
        Ok(_) => {}
        Err(WorkspaceBoundaryError::NotRegularFile { .. }) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.guidelineNotFile",
                    "Configured guideline path does not point to a file.",
                )
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: field.to_string(),
                })
                .with_actual(value.to_string()),
            );
        }
        Err(WorkspaceBoundaryError::NotFound { .. }) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.guidelineMissing",
                    "Configured guideline file is missing.",
                )
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: field.to_string(),
                })
                .with_actual(value.to_string()),
            );
        }
        Err(WorkspaceBoundaryError::Symlink { .. })
        | Err(WorkspaceBoundaryError::OutsideWorkspace { .. }) => {
            diagnostics.push(configured_path_boundary_diagnostic(field, value));
        }
        Err(error) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.guidelineUnreadable",
                    format!("Configured guideline file could not be read: {error}."),
                )
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: field.to_string(),
                })
                .with_actual(value.to_string()),
            );
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn push_required_markdown_file_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    root: &Path,
    missing_code: &str,
    missing_message: &str,
    not_file_code: &str,
    not_file_message: &str,
    not_markdown_code: &str,
    not_markdown_message: &str,
    field: &str,
    value: &str,
    path: &WorkspacePath,
) {
    push_required_file_diagnostic(
        diagnostics,
        root,
        missing_code,
        missing_message,
        not_file_code,
        not_file_message,
        field,
        value,
        path,
    );
    if resolve_configured_file(root, path).is_ok() && !is_markdown_path(path.as_str()) {
        diagnostics.push(
            Diagnostic::error(not_markdown_code, not_markdown_message)
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: field.to_string(),
                })
                .with_actual(value.to_string())
                .with_expected("*.md or *.mdx"),
        );
    }
}

#[allow(clippy::too_many_arguments)]
fn push_required_file_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    root: &Path,
    missing_code: &str,
    missing_message: &str,
    not_file_code: &str,
    not_file_message: &str,
    field: &str,
    value: &str,
    path: &WorkspacePath,
) {
    match resolve_configured_file(root, path) {
        Ok(_) => {}
        Err(WorkspaceBoundaryError::NotRegularFile { .. }) => {
            diagnostics.push(
                Diagnostic::error(not_file_code, not_file_message)
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: field.to_string(),
                    })
                    .with_actual(value.to_string()),
            );
        }
        Err(WorkspaceBoundaryError::NotFound { .. }) => {
            diagnostics.push(
                Diagnostic::error(missing_code, missing_message)
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: field.to_string(),
                    })
                    .with_actual(value.to_string()),
            );
        }
        Err(WorkspaceBoundaryError::Symlink { .. })
        | Err(WorkspaceBoundaryError::OutsideWorkspace { .. }) => {
            diagnostics.push(configured_path_boundary_diagnostic(field, value));
        }
        Err(error) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.pathUnreadable",
                    format!("Configured path could not be read: {error}."),
                )
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: field.to_string(),
                })
                .with_actual(value.to_string()),
            );
        }
    }
}

fn resolve_configured_file(
    root: &Path,
    path: &WorkspacePath,
) -> Result<PathBuf, WorkspaceBoundaryError> {
    WorkspaceBoundary::new(root)?.resolve_existing_file(path)
}

fn configured_path_boundary_diagnostic(field: &str, value: &str) -> Diagnostic {
    Diagnostic::error(
        "config.pathBoundary",
        "Configured path crosses the workspace filesystem boundary.",
    )
    .with_path(FORMA_CONFIG_PATH)
    .with_location(DiagnosticLocation::Config {
        field: field.to_string(),
    })
    .with_actual(value.to_string())
}

fn is_markdown_path(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "mdx"))
}

fn push_path_diagnostic(
    diagnostics: &mut Vec<Diagnostic>,
    space_id: &str,
    field: &str,
    value: &str,
    result: Result<WorkspacePath, PathError>,
) {
    if let Err(error) = result {
        diagnostics.push(
            Diagnostic::error(
                "config.pathInvalid",
                format!("Space `{space_id}` has invalid `{field}` path: {error}."),
            )
            .with_path(FORMA_CONFIG_PATH)
            .with_location(DiagnosticLocation::Config {
                field: format!("spaces.{space_id}.{field}"),
            })
            .with_actual(value.to_string()),
        );
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_yml::Value;

    use super::load_workspace;
    use crate::path::FORMA_CONFIG_PATH;

    #[test]
    fn loads_repository_starter_kit_config() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/getting-started-workspace");

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(
            workspace.config.workspace.name,
            "Choral Forma Getting Started Workspace"
        );
        assert_eq!(workspace.config.workspace.timezone, "UTC");
        assert_eq!(workspace.config.spaces["tasks"].include, "tasks/**/*.md");
        assert_eq!(
            workspace.config.spaces["tasks"].template,
            ".forma/spaces/templates/task.md"
        );
        assert_eq!(
            workspace.config.spaces["tasks"]
                .conventions
                .title_field
                .as_deref(),
            Some("fields.title")
        );
        assert_eq!(
            workspace.config.dashboard.as_ref().unwrap()["title"],
            Value::String("Dashboard".to_string())
        );
        assert_eq!(
            workspace.config.taxonomies["spaces"]["kind"],
            Value::String("taxonomy".to_string())
        );
        assert_eq!(
            workspace
                .model
                .semantic_type_target("task")
                .map(|id| id.as_str()),
            Some("tasks")
        );
    }

    #[test]
    fn loads_starter_style_config() {
        let root = fixture_root("starter-style-config");
        write_minimal_config(&root, "Asia/Shanghai", "notes/**/*.md");

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.workspace.name, "Acme Workspace");
        assert_eq!(workspace.config.workspace.timezone, "Asia/Shanghai");
        assert_eq!(
            workspace
                .model
                .semantic_type_target("note")
                .map(|id| id.as_str()),
            Some("notes")
        );
        assert_eq!(workspace.config.spaces["notes"].include, "notes/**/*.md");
        assert!(workspace.diagnostics.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_taxonomy_neutral_display_presentation() {
        let root = fixture_root("taxonomy-display-presentation");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/taxonomies/*.md\n",
        );
        write_config_node(
            &root,
            ".forma/taxonomies/areas.md",
            "---\nschemaVersion: 1\nkind: taxonomy\nid: areas\ntitle: Areas\nmode: primary\ndisplay:\n  order: 10\n  icon: panels-top-left\n  color: \"#64748B\"\n---\n",
        );
        write_config_node(
            &root,
            ".forma/taxonomies/tasks.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: areas\ntitle: Tasks\ndisplay:\n  order: 20\n  icon: list-checks\n  color: \"#4f7cac\"\ninclude:\n  - tasks/**/*.md\n---\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(
            workspace.config.taxonomies["areas"]["display"]["icon"],
            Value::String("panels-top-left".to_string())
        );
        assert_eq!(
            workspace.config.terms["areas"]["tasks"]
                .display
                .icon
                .as_deref(),
            Some("list-checks")
        );
        assert_eq!(
            workspace.config.terms["areas"]["tasks"]
                .display
                .color
                .as_deref(),
            Some("#4f7cac")
        );
        assert!(workspace.config.spaces.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn warns_and_falls_back_for_invalid_display_presentation() {
        let root = fixture_root("invalid-display-presentation");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/taxonomies/*.md\n",
        );
        write_config_node(
            &root,
            ".forma/taxonomies/topics.md",
            "---\nschemaVersion: 1\nkind: taxonomy\nid: topics\ntitle: Topics\nmode: multiple\ndisplay:\n  icon: ../unsafe.svg\n  color: red\n---\n",
        );
        write_config_node(
            &root,
            ".forma/taxonomies/guides.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: topics\ntitle: Guides\ndisplay:\n  icon: unknown-icon\n  color: \"#fff\"\ninclude:\n  - guides/**/*.md\n---\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(
            workspace
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "config.displayIconInvalid")
                .count(),
            2
        );
        assert_eq!(
            workspace
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "config.displayColorInvalid")
                .count(),
            2
        );
        assert!(
            workspace.config.terms["topics"]["guides"]
                .display
                .is_empty()
        );
        assert!(
            workspace.config.taxonomies["topics"]
                .get("display")
                .is_none()
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_explicit_named_entry_ref_types_from_root_config() {
        let root = fixture_root("explicit-named-ref-types");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/people\n    input:\n      transform: slugify",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );
        write_spaces_taxonomy(&root);

        let workspace = load_workspace(&root).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(
            workspace
                .config
                .types
                .get("person")
                .and_then(super::SemanticType::source),
            Some(".forma/spaces/people")
        );
        assert_eq!(
            workspace
                .model
                .semantic_type_target("person")
                .map(|id| id.as_str()),
            Some("people")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_legacy_named_ref_type_kind() {
        let root = fixture_root("legacy-named-ref-type-kind");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ntypes:\n  person:\n    kind: ref\n    source: .forma/spaces/people\n",
        );

        assert!(load_workspace(&root).is_err());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolves_entry_ref_type_sources_after_path_normalization() {
        let root = fixture_root("normalized-named-ref-source");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\ntypes:\n  person:\n    kind: entryRef\n    source: ./.forma/spaces/people",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );
        write_spaces_taxonomy(&root);

        let workspace = load_workspace(&root).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(
            workspace
                .model
                .semantic_type_target("person")
                .map(|id| id.as_str()),
            Some("people")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_explicit_named_entry_ref_types_from_included_config_node() {
        let root = fixture_root("included-named-ref-types");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/types.md\n  - .forma/spaces/*.md\n",
        );
        write_config_node(
            &root,
            ".forma/types.md",
            "---\nschemaVersion: 1\nkind: types\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/people\n    input:\n      transform: slugify\n---\n\n# Types\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );
        write_spaces_taxonomy(&root);

        let workspace = load_workspace(&root).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(
            workspace
                .config
                .types
                .get("person")
                .and_then(super::SemanticType::source),
            Some(".forma/spaces/people")
        );
        assert_eq!(
            workspace
                .model
                .semantic_type_target("person")
                .map(|id| id.as_str()),
            Some("people")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_duplicate_named_types_across_config_sources() {
        let root = fixture_root("duplicate-named-ref-types");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/types.md\n  - .forma/spaces/*.md\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/people",
        );
        write_config_node(
            &root,
            ".forma/types.md",
            "---\nschemaVersion: 1\nkind: types\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/team\n---\n\n# Types\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.type.duplicate")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_duplicate_named_types_from_explicit_markdown_imports() {
        let root = fixture_root("duplicate-local-markdown-named-ref-types");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/local/types.md\n  - .forma/spaces/*.md\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/people",
        );
        write_config_node(
            &root,
            ".forma/local/types.md",
            "---\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/team\n---\n\n# Local Types\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.type.duplicate"
                    && diagnostic.path.as_deref() == Some(".forma/local/types.md"))
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_taxonomy_for_space_terms() {
        let root = fixture_root("missing-term-taxonomy");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/notes.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\n---\n\n# Notes\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.taxonomyMissing"
                    && diagnostic.path.as_deref() == Some(".forma/spaces/notes.md"))
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_unknown_imported_config_node_kind() {
        let root = fixture_root("unknown-config-node-kind");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/notes.md",
            "---\nschemaVersion: 1\nkind: space\nid: notes\ntitle: Notes\ninclude:\n  - notes/**/*.md\ntemplate: .forma/spaces/templates/note.md\n---\n\n# Notes\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.unknownNodeKind"
                    && diagnostic.path.as_deref() == Some(".forma/spaces/notes.md"))
        );
        assert!(workspace.config.spaces.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recognizes_imported_templates_by_configured_reference_outside_template_directories() {
        let root = fixture_root("referenced-template-outside-template-directory");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\n  - blueprints/*.md\n",
        );
        write_spaces_taxonomy(&root);
        write_config_node(
            &root,
            ".forma/spaces/notes.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\ncreate:\n  directory: notes\n  filename: \"{{ input.slug }}.md\"\n  template: blueprints/note.md\n---\n\n# Notes\n",
        );
        write_config_node(
            &root,
            "blueprints/note.md",
            "---\nschemaVersion: 1\nkind: note\n---\n\n# {{ input.title }}\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .all(|diagnostic| diagnostic.code != "config.unknownNodeKind")
        );
        assert_eq!(
            workspace.config.spaces["notes"].template,
            "blueprints/note.md"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_unreferenced_unknown_nodes_even_inside_template_directories() {
        let root = fixture_root("unreferenced-node-inside-template-directory");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/templates/*.md\n",
        );
        write_config_node(
            &root,
            ".forma/templates/orphan.md",
            "---\nschemaVersion: 1\nkind: note\n---\n\n# Orphan\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(workspace.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "config.unknownNodeKind"
                && diagnostic.path.as_deref() == Some(".forma/templates/orphan.md")
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn explicit_content_group_projection_is_taxonomy_id_neutral() {
        let root = fixture_root("content-group-projection-taxonomy-relationship");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - config/*.md\n",
        );
        write_config_node(
            &root,
            "config/areas.md",
            "---\nschemaVersion: 1\nkind: taxonomy\nid: areas\nprojection: contentGroups\ntitle: Areas\n---\n",
        );
        write_config_node(
            &root,
            "config/spaces.md",
            "---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\ntitle: Legacy-shaped taxonomy\n---\n",
        );
        write_config_node(
            &root,
            "config/area-notes.md",
            "---\nschemaVersion: 1\nkind: term\nid: notes\ntaxonomy: areas\ntitle: Notes\ninclude:\n  - notes/**/*.md\n---\n",
        );
        write_config_node(
            &root,
            "config/space-notes.md",
            "---\nschemaVersion: 1\nkind: term\nid: notes\ntaxonomy: spaces\ntitle: Reused Notes Term\ninclude:\n  - legacy-notes/**/*.md\n---\n",
        );
        write_config_node(&root, "notes/one.md", "---\ntitle: One\n---\n\n# One\n");

        let workspace = load_workspace(&root).unwrap();
        let discovery = crate::index::discover_loaded_workspace(&workspace);

        assert!(workspace.diagnostics.is_empty());
        assert!(discovery.diagnostics.is_empty());
        assert!(
            workspace
                .model
                .content_group_for_taxonomy_term("areas", "notes")
                .is_some()
        );
        assert!(
            workspace
                .model
                .content_group_for_taxonomy_term("spaces", "notes")
                .is_none()
        );
        assert_eq!(workspace.config.spaces["notes"].include, "notes/**/*.md");
        assert_eq!(
            workspace
                .model
                .config_graph()
                .taxonomies()
                .get(&crate::model::TaxonomyId::new("areas"))
                .unwrap()
                .provenance()
                .source_path(),
            "config/areas.md"
        );
        assert_eq!(discovery.index.entries.len(), 1);
        assert_eq!(discovery.index.entries[0].space, "notes");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_spaces_taxonomy_emits_mechanical_compatibility_warning() {
        let root = fixture_root("legacy-spaces-projection");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - config/*.md\n",
        );
        write_config_node(
            &root,
            "config/spaces.md",
            "---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\ntitle: Spaces\n---\n",
        );
        write_config_node(
            &root,
            "config/notes.md",
            "---\nschemaVersion: 1\nkind: term\nid: notes\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\n---\n",
        );

        let workspace = load_workspace(&root).unwrap();
        let compatibility = workspace
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == "config.projection.compatibilitySpaces")
            .collect::<Vec<_>>();

        assert_eq!(compatibility.len(), 1);
        assert_eq!(compatibility[0].path.as_deref(), Some("config/spaces.md"));
        assert_eq!(
            compatibility[0].expected.as_deref(),
            Some("projection: contentGroups")
        );
        assert!(workspace.model.content_group("notes").is_some());
        assert!(workspace.config.spaces.contains_key("notes"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn projection_diagnostics_retain_authored_source_provenance() {
        let root = fixture_root("content-group-projection-diagnostics");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - config/*.md\n",
        );
        for (path, id, projection) in [
            ("config/areas.md", "areas", "contentGroups"),
            ("config/sections.md", "sections", "contentGroups"),
            ("config/topics.md", "topics", "topicIndex"),
        ] {
            write_config_node(
                &root,
                path,
                &format!(
                    "---\nschemaVersion: 1\nkind: taxonomy\nid: {id}\nprojection: {projection}\ntitle: {id}\n---\n"
                ),
            );
        }

        let workspace = load_workspace(&root).unwrap();
        let projection_diagnostics = workspace
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code.starts_with("config.projection."))
            .collect::<Vec<_>>();

        assert_eq!(projection_diagnostics.len(), 3);
        assert!(projection_diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "config.projection.unknown"
                && diagnostic.path.as_deref() == Some("config/topics.md")
        }));
        assert_eq!(
            projection_diagnostics
                .iter()
                .filter(|diagnostic| {
                    diagnostic.code == "config.projection.multipleContentGroups"
                        && matches!(
                            diagnostic.path.as_deref(),
                            Some("config/areas.md" | "config/sections.md")
                        )
                })
                .count(),
            2
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_entry_ref_type_sources_that_do_not_reference_spaces() {
        let root = fixture_root("invalid-ref-type-source");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/views/people\n  missing:\n    kind: entryRef\n    source: .forma/spaces/missing\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.model.semantic_type_target("person"), None);
        assert_eq!(workspace.model.semantic_type_target("missing"), None);
        assert_eq!(
            workspace
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "config.type.sourceMissing")
                .count(),
            2
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_all_space_include_patterns() {
        let root = fixture_root("space-include-patterns");
        write_minimal_config(
            &root,
            "UTC",
            "notes/**/*.md\n  - product/**/*.md\n  - decisions/**/*.md",
        );

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.spaces["notes"].include, "notes/**/*.md");
        assert_eq!(
            workspace.config.spaces["notes"].include_patterns,
            vec![
                "notes/**/*.md".to_string(),
                "product/**/*.md".to_string(),
                "decisions/**/*.md".to_string(),
            ]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_guideline_declarations() {
        let root = fixture_root("guideline-declarations");
        fs::create_dir_all(root.join(".forma/spaces")).unwrap();
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/operations.md\nimports:\n  - \".forma/spaces/*.md\"\n",
        );
        fs::write(
            root.join("knowledge/guidelines/operations.md"),
            "# Operations\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ndescription: Notes.\nguidelines:\n  - knowledge/guidelines/operations.md\ninclude:\n  - notes/**/*.md\n---\n\n# Notes\n",
        )
        .unwrap();
        write_spaces_taxonomy(&root);

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.guidelines.len(), 1);
        assert_eq!(
            workspace.config.guidelines[0],
            "knowledge/guidelines/operations.md"
        );
        assert_eq!(
            workspace.config.spaces["notes"].guidelines,
            vec!["knowledge/guidelines/operations.md".to_string()]
        );
        assert!(workspace.diagnostics.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_guideline_files_as_diagnostics() {
        let root = fixture_root("missing-guideline");
        fs::create_dir_all(root.join(".forma")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/missing.md\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.diagnostics.len(), 1);
        assert_eq!(workspace.diagnostics[0].code, "config.guidelineMissing");
        assert_eq!(
            workspace.diagnostics[0].location,
            Some(crate::diagnostics::DiagnosticLocation::Config {
                field: "guidelines[0]".to_string()
            })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_unknown_workspace_settings_fields() {
        let root = fixture_root("unknown-workspace-setting");
        fs::create_dir_all(root.join(".forma")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  root: .\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\n",
        );

        let error = load_workspace(&root).unwrap_err();

        assert!(matches!(error, super::ConfigError::Parse { .. }));
        assert!(error.to_string().contains("unknown field `root`"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_non_markdown_space_guidelines_as_diagnostics() {
        let root = fixture_root("non-markdown-guideline");
        fs::create_dir_all(root.join(".forma/spaces")).unwrap();
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n",
        );
        fs::write(
            root.join("knowledge/guidelines/not-markdown.txt"),
            "not markdown",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ndescription: Notes.\nguidelines:\n  - knowledge/guidelines/not-markdown.txt\ninclude:\n  - notes/**/*.md\n---\n\n# Notes\n",
        )
        .unwrap();
        write_spaces_taxonomy(&root);

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.diagnostics.len(), 1);
        assert_eq!(workspace.diagnostics[0].code, "config.guidelineNotMarkdown");
        assert_eq!(
            workspace.diagnostics[0].location,
            Some(crate::diagnostics::DiagnosticLocation::Config {
                field: "spaces.notes.guidelines[0]".to_string()
            })
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn explicit_import_is_loaded_into_the_effective_workspace() {
        let root = fixture_root("included-config-files");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n  - \".forma/local/*.md\"\nruntime:\n  values:\n    currentDate:\n      kind: currentDate\n",
        );
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\nruntime:\n  values:\n    currentUserId:\n      kind: const\n      value: alex-chen\n---\n",
        )
        .unwrap();

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.workspace.timezone, "Europe/Paris");
        assert!(
            workspace
                .config
                .runtime
                .values
                .contains_key("currentUserId")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn imports_config_files_from_root_entrypoint() {
        let root = fixture_root("imports-config-files");
        fs::create_dir_all(&root).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n",
        );
        fs::create_dir_all(root.join(".forma/spaces")).unwrap();
        fs::write(
            root.join(".forma/spaces/index.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\nprojection: contentGroups\ntitle: Spaces\nmode: primary\n---\n\n# Spaces\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\n---\n\n# Notes\n",
        )
        .unwrap();

        let workspace = load_workspace(&root).unwrap();

        assert!(workspace.config.spaces.contains_key("notes"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_import_globs_are_diagnosed_and_never_scanned() {
        let root = fixture_root("invalid-import-globs");
        let outside = fixture_root("invalid-import-globs-outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(
            outside.join("profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\n---\n",
        )
        .unwrap();
        let outside_name = outside.file_name().unwrap().to_string_lossy();
        write_config(
            &root,
            format!(
                "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \"../{outside_name}/*.md\"\n  - \".forma/[broken.md\"\n"
            ),
        );

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.workspace.timezone, "UTC");
        assert!(workspace.config_source_patterns.is_empty());
        assert_eq!(
            workspace
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "config.globInvalid")
                .count(),
            2
        );

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn imported_config_file_symlinks_are_not_followed() {
        use std::os::unix::fs::symlink;

        let root = fixture_root("symlink-import");
        let outside = fixture_root("symlink-import-outside");
        fs::create_dir_all(root.join(".forma")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/profile.md\"\n",
        );
        fs::write(
            outside.join("profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\n---\n",
        )
        .unwrap();
        symlink(outside.join("profile.md"), root.join(".forma/profile.md")).unwrap();

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.workspace.timezone, "UTC");
        assert!(
            workspace
                .config_sources
                .iter()
                .all(|source| source.path != ".forma/profile.md")
        );

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn rejects_legacy_root_include_import_field() {
        let root = fixture_root("legacy-root-include");
        fs::create_dir_all(&root).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ninclude:\n  - \".forma/spaces/*.md\"\n",
        );

        let error = load_workspace(&root).unwrap_err();

        assert!(matches!(
            error,
            super::ConfigError::LegacyRootInclude { .. }
        ));
        assert!(error.to_string().contains("renamed to `imports`"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn local_directory_name_has_no_loading_semantics() {
        let root = fixture_root("local-name-not-special");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n  - \".forma/local/*.md\"\n",
        );
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\n---\n",
        )
        .unwrap();

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.config.workspace.timezone, "Europe/Paris");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn gitignore_does_not_change_included_config_loading_or_sources() {
        let root = fixture_root("gitignore-config-not-special");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n  - \".forma/local/*.md\"\n",
        );
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(root.join(".forma/.gitignore"), "local/\n").unwrap();
        fs::write(
            root.join(".forma/local/profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\n---\n",
        )
        .unwrap();

        let workspace = load_workspace(&root).unwrap();
        let sources = super::config_source_paths(&root).unwrap();

        assert_eq!(workspace.config.workspace.timezone, "Europe/Paris");
        assert!(
            sources
                .iter()
                .any(|source| source.path == ".forma/local/profile.md")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_workspace_logo_file() {
        let root = fixture_root("missing-logo");
        fs::create_dir_all(&root).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\n  logo:\n    path: assets/logo.svg\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.logoMissing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_dashboard_view_source() {
        let root = fixture_root("missing-dashboard-view");
        fs::create_dir_all(root.join(".forma")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ndashboard:\n  title: Dashboard\n  sections:\n    - id: recent\n      title: Recent\n      source:\n        type: view\n        view: .forma/views/recent.md\n",
        );

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.dashboardViewMissing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_create_template_file() {
        let root = fixture_root("missing-create-template");
        fs::create_dir_all(root.join(".forma/spaces")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\n",
        );
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\ncreate:\n  directory: notes\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\n---\n\n# Notes\n",
        )
        .unwrap();

        let workspace = load_workspace(&root).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.templateMissing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_schema_from_space_definition_frontmatter() {
        let root = fixture_root("space-frontmatter-schema");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\ncreate:\n  directory: notes\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: title\n  summaryField: summary\nschema:\n  type: object\n  fields:\n    kind:\n      type: const\n      value: note\n      required: true\n    title:\n      type: string\n      required: true\n---\n\n# Notes\n",
        )
        .unwrap();

        let workspace = load_workspace(&root).unwrap();

        let expected_schema: Value = serde_yml::from_str(
            "type: object\nfields:\n  kind:\n    type: const\n    value: note\n    required: true\n  title:\n    type: string\n    required: true\n",
        )
        .unwrap();
        assert_eq!(workspace.config.spaces["notes"].schema, expected_schema);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_created_and_updated_at_convention_fields() {
        let root = fixture_root("space-timestamp-conventions");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        let space_path = root.join(".forma/spaces/notes.md");
        let space = fs::read_to_string(&space_path)
            .unwrap()
            .replace(
                "  summaryField: fields.summary",
                "  summaryField: fields.summary\n  createdAtField: fields.createdAt\n  updatedAtField: fields.updatedAt",
            );
        fs::write(space_path, space).unwrap();

        let workspace = load_workspace(&root).unwrap();
        let conventions = &workspace.config.spaces["notes"].conventions;

        assert_eq!(
            conventions.created_at_field.as_deref(),
            Some("fields.createdAt")
        );
        assert_eq!(
            conventions.updated_at_field.as_deref(),
            Some("fields.updatedAt")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_starter_schema_fallback_when_space_has_no_schema() {
        let root = fixture_root("space-schema-fallback");
        write_minimal_config(&root, "UTC", "notes/**/*.md");

        let workspace = load_workspace(&root).unwrap();

        let expected_schema: Value =
            serde_yml::from_str("type: object\nfields:\n  kind:\n    type: string\n").unwrap();
        assert_eq!(workspace.config.spaces["notes"].schema, expected_schema);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_invalid_config_paths_as_diagnostics() {
        let root = fixture_root("invalid-paths");
        write_minimal_config(&root, "UTC", "../notes/**/*.md");

        let workspace = load_workspace(&root).unwrap();

        assert_eq!(workspace.diagnostics.len(), 1);
        assert_eq!(workspace.diagnostics[0].code, "config.globInvalid");
        assert_eq!(
            workspace.diagnostics[0].path.as_deref(),
            Some(FORMA_CONFIG_PATH)
        );

        fs::remove_dir_all(root).unwrap();
    }

    fn write_minimal_config(root: &Path, timezone: &str, include: &str) {
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        write_config(
            root,
            format!(
                "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: {timezone}\nimports:\n  - \".forma/spaces/*.md\"\nruntime:\n  values:\n    currentDate:\n      kind: currentDate\n\ntypes:\n  note:\n    kind: entryRef\n    source: .forma/spaces/notes\n"
            ),
        );
        fs::write(
            root.join(".forma/spaces/notes.md"),
            format!(
                "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - {include}\ncreate:\n  directory: notes\n  filename: \"{{{{ input.slug }}}}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: fields.title\n  summaryField: fields.summary\n---\n\n# Notes\n"
            ),
        )
        .unwrap();
        write_spaces_taxonomy(root);
        fs::write(
            root.join(".forma/spaces/templates/note.md"),
            "---\nkind: note\ntitle: \"{{ input.title }}\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
    }

    fn write_spaces_taxonomy(root: &Path) {
        fs::create_dir_all(root.join(".forma/spaces")).unwrap();
        fs::write(
            root.join(".forma/spaces/index.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\nprojection: contentGroups\ntitle: Spaces\nmode: primary\n---\n\n# Spaces\n",
        )
        .unwrap();
    }

    fn write_config(root: &Path, yaml: impl AsRef<str>) {
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            format!("---\n{}---\n\n# Forma Workspace\n", yaml.as_ref()),
        )
        .unwrap();
    }

    fn write_root_config(root: &Path, yaml: &str) {
        fs::create_dir_all(root).unwrap();
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            format!("---\n{yaml}\n---\n\n# Acme Workspace\n"),
        )
        .unwrap();
    }

    fn write_config_node(root: &Path, path: &str, frontmatter: &str) {
        write_file(root, path, frontmatter);
    }

    fn write_file(root: &Path, path: &str, contents: &str) {
        let absolute_path = root.join(path);
        if let Some(parent) = absolute_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(absolute_path, contents).unwrap();
    }

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-{name}-{unique}"))
    }
}
