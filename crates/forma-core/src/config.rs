use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use globset::{Glob, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::path::{
    FORMA_CONFIG_PATH, FORMA_DIR, FORMA_LOCAL_OVERRIDES_PATH, PathError, WorkspacePath,
};
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConfig {
    pub schema_version: u64,
    pub workspace: WorkspaceSettings,
    #[serde(default)]
    pub runtime: RuntimeConfig,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub dashboard: BTreeMap<String, Value>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub taxonomies: BTreeMap<String, Value>,
    #[serde(default)]
    pub types: BTreeMap<String, SemanticType>,
    #[serde(default)]
    pub spaces: BTreeMap<String, SpaceDefinition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    Space {
        space: String,
        #[serde(default)]
        input: TypeInput,
    },
    Enum {
        values: Vec<String>,
    },
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
    #[serde(default, skip)]
    pub include_patterns: Vec<String>,
    pub template: String,
    #[serde(default)]
    pub create: Option<CreateDefinition>,
    #[serde(default)]
    pub conventions: SpaceConventions,
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
    #[error("workspace root does not contain .forma")]
    MissingFormaDirectory,
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigFile {
    schema_version: u64,
    workspace: WorkspaceSettings,
    #[serde(default)]
    include: Vec<String>,
    #[serde(default)]
    runtime: RuntimeConfig,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigNode {
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
    let forma_dir = root.join(FORMA_DIR);
    if !forma_dir.is_dir() {
        return Err(ConfigError::MissingFormaDirectory);
    }

    let config_path = root.join(FORMA_CONFIG_PATH);

    let mut config_value = read_yaml_value(&config_path, FORMA_CONFIG_PATH)?;
    if mode == LoadMode::WithLocalOverrides {
        let local_override_path = root.join(FORMA_LOCAL_OVERRIDES_PATH);
        if local_override_path.exists() {
            let local_value = read_yaml_value(&local_override_path, FORMA_LOCAL_OVERRIDES_PATH)?;
            deep_merge(&mut config_value, local_value);
        }
    }

    let config_file: ConfigFile =
        serde_yml::from_value(config_value).map_err(|source| ConfigError::Parse {
            path: FORMA_CONFIG_PATH.to_string(),
            source,
        })?;

    let (dashboard, taxonomies, types, spaces) = load_config_nodes(root, &config_file)?;

    let config = WorkspaceConfig {
        schema_version: config_file.schema_version,
        workspace: config_file.workspace,
        runtime: config_file.runtime,
        dashboard,
        taxonomies,
        types,
        spaces,
    };
    let mut diagnostics = validate_config_paths(&config);
    diagnostics.extend(validate_space_schemas(&config));

    Ok(FormaWorkspace {
        root: root.to_path_buf(),
        config,
        diagnostics,
    })
}

fn load_config_nodes(
    root: &Path,
    config_file: &ConfigFile,
) -> Result<
    (
        BTreeMap<String, Value>,
        BTreeMap<String, Value>,
        BTreeMap<String, SemanticType>,
        BTreeMap<String, SpaceDefinition>,
    ),
    ConfigError,
> {
    let mut dashboard = BTreeMap::new();
    let mut taxonomies = BTreeMap::new();
    let mut types = BTreeMap::new();
    let mut spaces = BTreeMap::new();

    for public_path in included_markdown_config_paths(root, &config_file.include) {
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
        if node.kind.as_deref() == Some("dashboard") {
            dashboard.insert(view_id_from_config_path(&public_path), frontmatter);
            continue;
        }
        if node.kind.as_deref() == Some("taxonomy") {
            taxonomies.insert(view_id_from_config_path(&public_path), frontmatter);
            continue;
        }
        if node.kind.as_deref() != Some("term") || node.taxonomy.as_deref() != Some("spaces") {
            continue;
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
        types.insert(
            semantic_type_id_for_space(&space_id),
            SemanticType::Space {
                space: space_id.clone(),
                input: TypeInput {
                    transform: Some("slugify".to_string()),
                },
            },
        );
        let schema = node
            .schema
            .clone()
            .unwrap_or_else(|| starter_term_schema(&space_id));
        spaces.insert(
            space_id,
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
                schema,
            },
        );
    }

    Ok((dashboard, taxonomies, types, spaces))
}

fn view_id_from_config_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(path)
        .to_string()
}

fn semantic_type_id_for_space(space_id: &str) -> String {
    space_id.strip_suffix('s').unwrap_or(space_id).to_string()
}

fn starter_term_schema(space_id: &str) -> Value {
    let schema = if space_id == "todos" {
        "type: object\nfields:\n  kind:\n    type: string\n  assignees:\n    type: list\n    items:\n      type: ref\n      target: user\n"
    } else {
        "type: object\nfields:\n  kind:\n    type: string\n"
    };
    serde_yml::from_str(schema).expect("built-in starter term schema is valid YAML")
}

fn included_markdown_config_paths(root: &Path, include: &[String]) -> Vec<String> {
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
    collect_included_files(root, root, &globs, &mut paths);
    paths.sort();
    paths
}

fn collect_included_files(
    root: &Path,
    dir: &Path,
    globs: &globset::GlobSet,
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
            collect_included_files(root, &path, globs, paths);
        } else if path.extension().and_then(|extension| extension.to_str()) == Some("md")
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

fn validate_config_paths(config: &WorkspaceConfig) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();

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
            push_path_diagnostic(
                &mut diagnostics,
                space_id,
                "create.directory",
                &create.directory,
                WorkspacePath::parse_config(&create.directory),
            );
        }
    }

    diagnostics
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
    use crate::path::{FORMA_CONFIG_PATH, FORMA_LOCAL_OVERRIDES_PATH};

    #[test]
    fn loads_repository_starter_kit_config() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/forma-starter-kit");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(workspace.config.workspace.name, "Choral Forma Example");
        assert_eq!(workspace.config.workspace.timezone, "UTC");
        assert_eq!(workspace.config.spaces["todos"].include, "todos/**/*.md");
        assert_eq!(
            workspace.config.spaces["todos"].template,
            ".forma/spaces/templates/todo.md"
        );
        assert_eq!(
            workspace.config.spaces["todos"]
                .conventions
                .title_field
                .as_deref(),
            Some("fields.title")
        );
        assert_eq!(
            workspace.config.dashboard["dashboard"]["kind"],
            Value::String("dashboard".to_string())
        );
        assert_eq!(
            workspace.config.taxonomies["index"]["kind"],
            Value::String("taxonomy".to_string())
        );
        assert_eq!(workspace.config.types["todo"].space(), Some("todos"));
        assert!(workspace.diagnostics.is_empty());
    }

    #[test]
    fn loads_starter_style_config() {
        let root = fixture_root("starter-style-config");
        write_minimal_config(&root, "Asia/Shanghai", "notes/**/*.md");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(workspace.config.workspace.name, "Acme Knowledge");
        assert_eq!(workspace.config.workspace.timezone, "Asia/Shanghai");
        assert_eq!(workspace.config.types["note"].space(), Some("notes"));
        assert_eq!(workspace.config.spaces["notes"].include, "notes/**/*.md");
        assert!(workspace.diagnostics.is_empty());

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
    fn applies_local_overrides_when_requested() {
        let root = fixture_root("local-overrides");
        write_minimal_config(&root, "UTC", "notes/**/*.md");
        fs::create_dir_all(root.join(FORMA_LOCAL_OVERRIDES_PATH).parent().unwrap()).unwrap();
        fs::write(
            root.join(FORMA_LOCAL_OVERRIDES_PATH),
            "workspace:\n  timezone: Europe/Paris\nruntime:\n  values:\n    currentUserId:\n      kind: const\n      value: tiscs\n",
        )
        .unwrap();

        let shared = load_workspace(&root, LoadMode::SharedOnly).unwrap();
        let effective = load_workspace(&root, LoadMode::WithLocalOverrides).unwrap();

        assert_eq!(shared.config.workspace.timezone, "UTC");
        assert_eq!(effective.config.workspace.timezone, "Europe/Paris");
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
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            format!(
                "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: {timezone}\ninclude:\n  - \".forma/spaces/*.md\"\nruntime:\n  values:\n    currentDate:\n      kind: currentDate\n"
            ),
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/notes.md"),
            format!(
                "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - {include}\ncreate:\n  directory: notes\n  filename: \"{{{{ input.slug }}}}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: fields.title\n  summaryField: fields.summary\n---\n\n# Notes\n"
            ),
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/note.md"),
            "---\nkind: note\ntitle: \"{{ input.title }}\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
    }

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-{name}-{unique}"))
    }

    trait SemanticTypeExt {
        fn space(&self) -> Option<&str>;
    }

    impl SemanticTypeExt for super::SemanticType {
        fn space(&self) -> Option<&str> {
            match self {
                super::SemanticType::Space { space, .. } => Some(space),
                super::SemanticType::Enum { .. } => None,
            }
        }
    }
}
