use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::path::{
    FORMA_DIR, FORMA_LOCAL_OVERRIDES_PATH, FORMA_SETTINGS_PATH, FORMA_SPACES_PATH,
    FORMA_TYPES_PATH, PathError, WorkspacePath,
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
    pub default: Option<String>,
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
struct SettingsFile {
    schema_version: u64,
    workspace: WorkspaceSettings,
    #[serde(default)]
    runtime: RuntimeConfig,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TypesFile {
    #[allow(dead_code)]
    schema_version: u64,
    #[serde(default)]
    types: BTreeMap<String, SemanticType>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpacesFile {
    #[allow(dead_code)]
    schema_version: u64,
    #[serde(default)]
    spaces: BTreeMap<String, SpaceDefinition>,
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

    let settings_path = root.join(FORMA_SETTINGS_PATH);
    let types_path = root.join(FORMA_TYPES_PATH);
    let spaces_path = root.join(FORMA_SPACES_PATH);

    let mut settings_value = read_yaml_value(&settings_path, FORMA_SETTINGS_PATH)?;
    if mode == LoadMode::WithLocalOverrides {
        let local_override_path = root.join(FORMA_LOCAL_OVERRIDES_PATH);
        if local_override_path.exists() {
            let local_value = read_yaml_value(&local_override_path, FORMA_LOCAL_OVERRIDES_PATH)?;
            deep_merge(&mut settings_value, local_value);
        }
    }

    let settings_file: SettingsFile =
        serde_yml::from_value(settings_value).map_err(|source| ConfigError::Parse {
            path: FORMA_SETTINGS_PATH.to_string(),
            source,
        })?;
    let types_file: TypesFile = read_yaml(&types_path, FORMA_TYPES_PATH)?;
    let spaces_file: SpacesFile = read_yaml(&spaces_path, FORMA_SPACES_PATH)?;

    let config = WorkspaceConfig {
        schema_version: settings_file.schema_version,
        workspace: settings_file.workspace,
        runtime: settings_file.runtime,
        types: types_file.types,
        spaces: spaces_file.spaces,
    };
    let mut diagnostics = validate_config_paths(&config);
    diagnostics.extend(validate_space_schemas(&config));

    Ok(FormaWorkspace {
        root: root.to_path_buf(),
        config,
        diagnostics,
    })
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
        push_path_diagnostic(
            &mut diagnostics,
            space_id,
            "include",
            &space.include,
            WorkspacePath::parse_config(&space.include),
        );
        push_path_diagnostic(
            &mut diagnostics,
            space_id,
            "template",
            &space.template,
            WorkspacePath::parse_config(&space.template),
        );

        if let Some(create) = &space.create {
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
            .with_path(FORMA_SPACES_PATH)
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

    use super::{LoadMode, load_workspace};
    use crate::path::{
        FORMA_LOCAL_OVERRIDES_PATH, FORMA_SETTINGS_PATH, FORMA_SPACES_PATH, FORMA_TEMPLATES_DIR,
        FORMA_TYPES_PATH,
    };

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
    fn reports_invalid_config_paths_as_diagnostics() {
        let root = fixture_root("invalid-paths");
        write_minimal_config(&root, "UTC", "../notes/**/*.md");

        let workspace = load_workspace(&root, LoadMode::SharedOnly).unwrap();

        assert_eq!(workspace.diagnostics.len(), 1);
        assert_eq!(workspace.diagnostics[0].code, "config.pathInvalid");
        assert_eq!(
            workspace.diagnostics[0].path.as_deref(),
            Some(FORMA_SPACES_PATH)
        );

        fs::remove_dir_all(root).unwrap();
    }

    fn write_minimal_config(root: &Path, timezone: &str, include: &str) {
        fs::create_dir_all(root.join(FORMA_TEMPLATES_DIR)).unwrap();
        fs::write(
            root.join(FORMA_SETTINGS_PATH),
            format!(
                "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: {timezone}\nruntime:\n  values:\n    currentDate:\n      kind: currentDate\n"
            ),
        )
        .unwrap();
        fs::write(
            root.join(FORMA_TYPES_PATH),
            "schemaVersion: 1\ntypes:\n  note:\n    kind: space\n    space: notes\n",
        )
        .unwrap();
        fs::write(
            root.join(FORMA_SPACES_PATH),
            format!(
                "schemaVersion: 1\nspaces:\n  notes:\n    title: Notes\n    include: {include}\n    template: {FORMA_TEMPLATES_DIR}/note.md\n    create:\n      directory: notes\n      filename: \"{{{{ input.slug }}}}.md\"\n    schema:\n      type: object\n      fields:\n        title:\n          type: string\n"
            ),
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
