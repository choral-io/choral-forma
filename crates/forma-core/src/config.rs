use std::collections::BTreeMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use globset::{Glob, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::markdown::FormaMarkdownDocument;
use crate::path::{FORMA_CONFIG_PATH, PathError, WorkspacePath};
use crate::schema::validate_space_schemas;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadMode {
    SharedOnly,
    WithLocalOverrides,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FormaWorkspace {
    pub root: PathBuf,
    pub config: WorkspaceConfig,
    pub diagnostics: Vec<Diagnostic>,
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
        #[serde(skip)]
        space: Option<String>,
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

    pub fn space(&self) -> Option<&str> {
        match self {
            Self::EntryRef { space, .. } => space.as_deref(),
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

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
}

impl DisplayOptions {
    pub fn is_empty(&self) -> bool {
        self.order.is_none()
    }
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TermCreateDefinition {
    directory: String,
    filename: String,
    template: String,
    #[serde(default)]
    inputs: BTreeMap<String, CreateInput>,
}

pub fn load_workspace(
    root: impl AsRef<Path>,
    mode: LoadMode,
) -> Result<FormaWorkspace, ConfigError> {
    let root = root.as_ref();
    let config_path = root.join(FORMA_CONFIG_PATH);

    let mut config_value = read_markdown_frontmatter_value(&config_path, FORMA_CONFIG_PATH)?;
    let mut diagnostics = Vec::new();
    let mut types = BTreeMap::new();
    let root_types = take_types_from_value(&mut config_value, FORMA_CONFIG_PATH)?;
    merge_type_definitions(&mut types, root_types, FORMA_CONFIG_PATH, &mut diagnostics);

    let base_config_file: ConfigFile =
        serde_yml::from_value(config_value.clone()).map_err(|source| ConfigError::Parse {
            path: FORMA_CONFIG_PATH.to_string(),
            source,
        })?;
    reject_legacy_root_include(&base_config_file, FORMA_CONFIG_PATH)?;
    for public_path in included_yaml_config_paths(root, &base_config_file.imports) {
        let mut local_value = read_yaml_value(&root.join(&public_path), &public_path)?;
        let local_types = take_types_from_value(&mut local_value, &public_path)?;
        merge_type_definitions(&mut types, local_types, &public_path, &mut diagnostics);
        deep_merge(&mut config_value, local_value);
    }

    let config_file: ConfigFile =
        serde_yml::from_value(config_value).map_err(|source| ConfigError::Parse {
            path: FORMA_CONFIG_PATH.to_string(),
            source,
        })?;
    reject_legacy_root_include(&config_file, FORMA_CONFIG_PATH)?;

    let (taxonomies, spaces, space_sources, node_diagnostics) =
        load_config_nodes(root, &config_file, mode, &mut types)?;
    diagnostics.extend(node_diagnostics);

    let mut config = WorkspaceConfig {
        schema_version: config_file.schema_version,
        workspace: config_file.workspace,
        runtime: config_file.runtime,
        guidelines: config_file.guidelines,
        dashboard: config_file.dashboard,
        taxonomies,
        types,
        spaces,
    };
    resolve_type_sources(&mut config, &space_sources, &mut diagnostics);
    diagnostics.extend(validate_config_paths(root, &config));
    diagnostics.extend(validate_space_schemas(&config));

    Ok(FormaWorkspace {
        root: root.to_path_buf(),
        config,
        diagnostics,
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

fn load_config_nodes(
    root: &Path,
    config_file: &ConfigFile,
    _mode: LoadMode,
    types: &mut BTreeMap<String, SemanticType>,
) -> Result<
    (
        BTreeMap<String, Value>,
        BTreeMap<String, SpaceDefinition>,
        BTreeMap<String, String>,
        Vec<Diagnostic>,
    ),
    ConfigError,
> {
    let mut taxonomies = BTreeMap::new();
    let mut spaces = BTreeMap::new();
    let mut space_sources = BTreeMap::new();
    let mut diagnostics = Vec::new();
    let mut referenced_taxonomies = Vec::new();

    for public_path in included_markdown_config_paths(root, &config_file.imports) {
        let source =
            fs::read_to_string(root.join(&public_path)).map_err(|source| ConfigError::Read {
                path: public_path.clone(),
                source,
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

        let has_top_level_types = !node.types.is_empty();
        let has_explicit_type_kind = node.kind.as_deref() == Some("types");
        if has_explicit_type_kind || has_top_level_types {
            merge_type_definitions(types, node.types, &public_path, &mut diagnostics);

            if has_explicit_type_kind {
                continue;
            }
        }
        if node.kind.as_deref() == Some("taxonomy") {
            let taxonomy_id = node
                .id
                .clone()
                .unwrap_or_else(|| view_id_from_config_path(&public_path));
            taxonomies.insert(taxonomy_id, frontmatter);
            continue;
        }
        if node.kind.as_deref() != Some("term") || node.taxonomy.as_deref() != Some("spaces") {
            continue;
        }
        if let Some(taxonomy) = &node.taxonomy {
            referenced_taxonomies.push((taxonomy.clone(), public_path.clone()));
        }
        let Some(space_id) = Path::new(&public_path)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(ToOwned::to_owned)
        else {
            continue;
        };
        let Some(include) = node.include.first().cloned() else {
            continue;
        };
        let schema = node
            .schema
            .clone()
            .unwrap_or_else(|| starter_term_schema(&space_id));
        add_space_source_aliases(&mut space_sources, &public_path, &space_id);
        spaces.insert(
            space_id.clone(),
            SpaceDefinition {
                title: node.title.unwrap_or_else(|| public_path.clone()),
                display: node.display,
                description: node.description,
                include,
                include_patterns: node.include,
                template: node
                    .create
                    .as_ref()
                    .map(|create| create.template.clone())
                    .unwrap_or_default(),
                create: node.create.map(|create| CreateDefinition {
                    directory: create.directory,
                    filename: create.filename,
                    inputs: create.inputs,
                }),
                conventions: node.conventions,
                guidelines: node.guidelines,
                schema,
            },
        );
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

    Ok((taxonomies, spaces, space_sources, diagnostics))
}

pub fn config_source_paths(
    root: impl AsRef<Path>,
    _mode: LoadMode,
) -> Result<Vec<ConfigSourcePath>, ConfigError> {
    let root = root.as_ref();
    let mut sources = vec![ConfigSourcePath {
        path: FORMA_CONFIG_PATH.to_string(),
        present: root.join(FORMA_CONFIG_PATH).exists(),
    }];
    let config_file: ConfigFile =
        read_markdown_frontmatter(&root.join(FORMA_CONFIG_PATH), FORMA_CONFIG_PATH)?;
    for path in included_yaml_config_paths(root, &config_file.imports)
        .into_iter()
        .chain(included_markdown_config_paths(root, &config_file.imports))
    {
        sources.push(ConfigSourcePath {
            present: root.join(&path).exists(),
            path,
        });
    }
    sources.sort_by(|a, b| a.path.cmp(&b.path));
    sources.dedup_by(|a, b| a.path == b.path);
    Ok(sources)
}

fn view_id_from_config_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(path)
        .to_string()
}

fn add_space_source_aliases(
    space_sources: &mut BTreeMap<String, String>,
    public_path: &str,
    space_id: &str,
) {
    space_sources.insert(public_path.to_string(), space_id.to_string());
    if let Some(without_extension) = public_path
        .strip_suffix(".md")
        .or_else(|| public_path.strip_suffix(".mdx"))
    {
        space_sources.insert(without_extension.to_string(), space_id.to_string());
    }
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
    incoming: BTreeMap<String, SemanticType>,
    public_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for (type_name, semantic_type) in incoming {
        if let std::collections::btree_map::Entry::Vacant(entry) = types.entry(type_name.clone()) {
            entry.insert(semantic_type);
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

fn resolve_type_sources(
    config: &mut WorkspaceConfig,
    space_sources: &BTreeMap<String, String>,
    diagnostics: &mut Vec<Diagnostic>,
) {
    for (type_name, semantic_type) in &mut config.types {
        let SemanticType::EntryRef { source, space, .. } = semantic_type else {
            continue;
        };
        match WorkspacePath::parse_config(source.as_str()) {
            Ok(path) => {
                if let Some(space_id) = space_sources.get(path.as_str()) {
                    *space = Some(space_id.clone());
                } else {
                    diagnostics.push(
                        Diagnostic::error(
                            "config.type.sourceMissing",
                            format!(
                                "Type `{type_name}` source does not reference a configured space."
                            ),
                        )
                        .with_path(FORMA_CONFIG_PATH)
                        .with_location(DiagnosticLocation::Config {
                            field: format!("types.{type_name}.source"),
                        })
                        .with_actual(source.clone()),
                    );
                }
            }
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "config.pathInvalid",
                        format!("Type `{type_name}` source path is invalid: {error}."),
                    )
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: format!("types.{type_name}.source"),
                    })
                    .with_actual(source.clone()),
                );
            }
        }
    }
}

fn starter_term_schema(_space_id: &str) -> Value {
    let schema = "type: object\nfields:\n  kind:\n    type: string\n";
    serde_yml::from_str(schema).expect("built-in starter term schema is valid YAML")
}

fn included_markdown_config_paths(root: &Path, include: &[String]) -> Vec<String> {
    included_config_paths(root, include, &["md", "mdx"])
}

fn included_yaml_config_paths(root: &Path, include: &[String]) -> Vec<String> {
    included_config_paths(root, include, &["yml", "yaml"])
}

fn included_config_paths(root: &Path, include: &[String], extensions: &[&str]) -> Vec<String> {
    let mut builder = GlobSetBuilder::new();
    for pattern in include {
        if let Ok(glob) = Glob::new(pattern) {
            builder.add(glob);
        }
    }
    let Ok(globs) = builder.build() else {
        return Vec::new();
    };

    let mut paths = Vec::new();
    collect_included_files(root, root, &globs, extensions, &mut paths);
    paths.sort();
    paths
}

fn collect_included_files(
    root: &Path,
    dir: &Path,
    globs: &globset::GlobSet,
    extensions: &[&str],
    paths: &mut Vec<String>,
) {
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
            collect_included_files(root, &path, globs, extensions, paths);
        } else if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                extensions
                    .iter()
                    .any(|allowed| extension.eq_ignore_ascii_case(allowed))
            })
            && let Some(relative) = path.strip_prefix(root).ok().and_then(|path| path.to_str())
        {
            let relative = relative.replace('\\', "/");
            if globs.is_match(&relative) {
                paths.push(relative);
            }
        }
    }
}

fn read_yaml<T: for<'de> Deserialize<'de>>(
    path: &Path,
    public_path: &str,
) -> Result<T, ConfigError> {
    let contents = fs::read_to_string(path).map_err(|source| ConfigError::Read {
        path: public_path.to_string(),
        source,
    })?;
    serde_yml::from_str(&contents).map_err(|source| ConfigError::Parse {
        path: public_path.to_string(),
        source,
    })
}

fn read_yaml_value(path: &Path, public_path: &str) -> Result<Value, ConfigError> {
    read_yaml(path, public_path)
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

fn validate_config_paths(root: &Path, config: &WorkspaceConfig) -> Vec<Diagnostic> {
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

    for (space_id, space) in &config.spaces {
        for include in &space.include_patterns {
            push_path_diagnostic(
                &mut diagnostics,
                space_id,
                "include",
                include,
                WorkspacePath::parse_config(include),
            );
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
    let absolute_path = root.join(path.as_str());
    match fs::metadata(&absolute_path) {
        Ok(metadata) if !metadata.is_file() => {
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
        Err(error) if error.kind() == ErrorKind::NotFound => {
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
    if root.join(path.as_str()).is_file() && !is_markdown_path(path.as_str()) {
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
    match fs::metadata(root.join(path.as_str())) {
        Ok(metadata) if !metadata.is_file() => {
            diagnostics.push(
                Diagnostic::error(not_file_code, not_file_message)
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: field.to_string(),
                    })
                    .with_actual(value.to_string()),
            );
        }
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {
            diagnostics.push(
                Diagnostic::error(missing_code, missing_message)
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: field.to_string(),
                    })
                    .with_actual(value.to_string()),
            );
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

    use super::{LoadMode, load_workspace};
    use crate::path::FORMA_CONFIG_PATH;

    #[test]
    fn loads_repository_starter_kit_config() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/getting-started-workspace");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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
        assert_eq!(workspace.config.types["task"].space(), Some("tasks"));
    }

    #[test]
    fn loads_starter_style_config() {
        let root = fixture_root("starter-style-config");
        write_minimal_config(&root, "Asia/Shanghai", "notes/**/*.md");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(workspace.config.workspace.name, "Acme Workspace");
        assert_eq!(workspace.config.workspace.timezone, "Asia/Shanghai");
        assert_eq!(workspace.config.types["note"].space(), Some("notes"));
        assert_eq!(workspace.config.spaces["notes"].include, "notes/**/*.md");
        assert!(workspace.diagnostics.is_empty());

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(
            workspace
                .config
                .types
                .get("person")
                .and_then(super::SemanticType::source),
            Some(".forma/spaces/people")
        );
        assert_eq!(workspace.config.types["person"].space(), Some("people"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_legacy_named_ref_type_kind() {
        let root = fixture_root("legacy-named-ref-type-kind");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ntypes:\n  person:\n    kind: ref\n    source: .forma/spaces/people\n",
        );

        assert!(load_workspace(&root, LoadMode::SharedOnly).is_err());

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(workspace.config.types["person"].space(), Some("people"));

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert!(workspace.diagnostics.is_empty());
        assert_eq!(
            workspace
                .config
                .types
                .get("person")
                .and_then(super::SemanticType::source),
            Some(".forma/spaces/people")
        );
        assert_eq!(workspace.config.types["person"].space(), Some("people"));

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.type.duplicate")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_duplicate_named_types_from_yaml_includes() {
        let root = fixture_root("duplicate-yaml-named-ref-types");
        write_root_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/local/types.yml\n  - .forma/spaces/*.md\ntypes:\n  person:\n    kind: entryRef\n    source: .forma/spaces/people",
        );
        write_file(
            &root,
            ".forma/local/types.yml",
            "types:\n  person:\n    kind: entryRef\n    source: .forma/spaces/team\n",
        );
        write_config_node(
            &root,
            ".forma/spaces/people.md",
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: People\ninclude:\n  - people/**/*.md\n---\n\n# People\n",
        );

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert!(
            workspace
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.type.duplicate"
                    && diagnostic.path.as_deref() == Some(".forma/local/types.yml"))
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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(workspace.config.types["person"].space(), None);
        assert_eq!(workspace.config.types["missing"].space(), None);
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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let error = load_workspace(&root, LoadMode::SharedOnly).unwrap_err();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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
    fn included_config_files_are_loaded_in_all_modes() {
        let root = fixture_root("included-config-files");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n  - \".forma/local/*.yml\"\nruntime:\n  values:\n    currentDate:\n      kind: currentDate\n",
        );
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.yml"),
            "workspace:\n  timezone: Europe/Paris\nruntime:\n  values:\n    currentUserId:\n      kind: const\n      value: alex-chen\n",
        )
        .unwrap();

        let shared = load_workspace(&root, LoadMode::SharedOnly).unwrap();
        let effective = load_workspace(&root, LoadMode::WithLocalOverrides).unwrap();

        assert_eq!(shared.config.workspace.timezone, "Europe/Paris");
        assert_eq!(effective.config.workspace.timezone, "Europe/Paris");
        assert!(shared.config.runtime.values.contains_key("currentUserId"));
        assert!(
            effective
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
            "---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\ntitle: Spaces\nmode: primary\n---\n\n# Spaces\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\n---\n\n# Notes\n",
        )
        .unwrap();

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert!(workspace.config.spaces.contains_key("notes"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_legacy_root_include_import_field() {
        let root = fixture_root("legacy-root-include");
        fs::create_dir_all(&root).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ninclude:\n  - \".forma/spaces/*.md\"\n",
        );

        let error = load_workspace(&root, LoadMode::SharedOnly).unwrap_err();

        assert!(matches!(
            error,
            super::ConfigError::LegacyRootInclude { .. }
        ));
        assert!(error.to_string().contains("renamed to `imports`"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn included_local_named_files_are_not_special() {
        let root = fixture_root("local-name-not-special");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n  - \".forma/local/*.yml\"\n",
        );
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.yml"),
            "workspace:\n  timezone: Europe/Paris\n",
        )
        .unwrap();

        let shared = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(shared.config.workspace.timezone, "Europe/Paris");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn gitignore_does_not_change_included_config_loading_or_sources() {
        let root = fixture_root("gitignore-config-not-special");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - \".forma/spaces/*.md\"\n  - \".forma/local/*.yml\"\n",
        );
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(root.join(".forma/.gitignore"), "local/\n").unwrap();
        fs::write(
            root.join(".forma/local/profile.yml"),
            "workspace:\n  timezone: Europe/Paris\n",
        )
        .unwrap();

        let shared = load_workspace(&root, LoadMode::SharedOnly).unwrap();
        let effective = load_workspace(&root, LoadMode::WithLocalOverrides).unwrap();
        let sources = super::config_source_paths(&root, LoadMode::WithLocalOverrides).unwrap();

        assert_eq!(shared.config.workspace.timezone, "Europe/Paris");
        assert_eq!(effective.config.workspace.timezone, "Europe/Paris");
        assert!(
            sources
                .iter()
                .any(|source| source.path == ".forma/local/profile.yml")
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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

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

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        let expected_schema: Value = serde_yml::from_str(
            "type: object\nfields:\n  kind:\n    type: const\n    value: note\n    required: true\n  title:\n    type: string\n    required: true\n",
        )
        .unwrap();
        assert_eq!(workspace.config.spaces["notes"].schema, expected_schema);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_starter_schema_fallback_when_space_has_no_schema() {
        let root = fixture_root("space-schema-fallback");
        write_minimal_config(&root, "UTC", "notes/**/*.md");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        let expected_schema: Value =
            serde_yml::from_str("type: object\nfields:\n  kind:\n    type: string\n").unwrap();
        assert_eq!(workspace.config.spaces["notes"].schema, expected_schema);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_invalid_config_paths_as_diagnostics() {
        let root = fixture_root("invalid-paths");
        write_minimal_config(&root, "UTC", "../notes/**/*.md");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(workspace.diagnostics.len(), 1);
        assert_eq!(workspace.diagnostics[0].code, "config.pathInvalid");
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
            "---\nschemaVersion: 1\nkind: taxonomy\nid: spaces\ntitle: Spaces\nmode: primary\n---\n\n# Spaces\n",
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
