use std::fmt;
use std::path::{Component, Path, PathBuf};

use globset::{Glob, GlobMatcher};
use serde::{Deserialize, Deserializer, Serialize};
use thiserror::Error;

pub const FORMA_CONFIG_PATH: &str = ".forma.md";

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(transparent)]
pub struct WorkspacePath(String);

impl WorkspacePath {
    pub fn parse_config(value: impl AsRef<str>) -> Result<Self, PathError> {
        parse_workspace_path(value.as_ref(), SeparatorPolicy::RejectBackslash)
    }

    pub fn parse_cli(value: impl AsRef<str>) -> Result<Self, PathError> {
        parse_workspace_path(
            &normalize_cli_path(value.as_ref()),
            SeparatorPolicy::AllowNormalized,
        )
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for WorkspacePath {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for WorkspacePath {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        Self::parse_config(value).map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceGlob {
    pattern: WorkspacePath,
    literal_prefix: Option<WorkspacePath>,
}

impl WorkspaceGlob {
    pub fn parse_config(value: impl AsRef<str>) -> Result<Self, PathError> {
        let pattern = WorkspacePath::parse_config(value)?;
        Glob::new(pattern.as_str()).map_err(|error| PathError::InvalidGlob(error.to_string()))?;

        let prefix = pattern
            .as_str()
            .split('/')
            .take_while(|segment| !contains_glob_meta(segment))
            .collect::<Vec<_>>()
            .join("/");
        let literal_prefix = if prefix.is_empty() {
            None
        } else {
            Some(WorkspacePath::parse_config(prefix)?)
        };

        Ok(Self {
            pattern,
            literal_prefix,
        })
    }

    pub fn as_str(&self) -> &str {
        self.pattern.as_str()
    }

    pub fn literal_prefix(&self) -> Option<&WorkspacePath> {
        self.literal_prefix.as_ref()
    }

    pub fn matcher(&self) -> GlobMatcher {
        Glob::new(self.as_str())
            .expect("WorkspaceGlob validates its glob pattern when constructed")
            .compile_matcher()
    }

    pub fn scan_root(&self, root: &Path) -> PathBuf {
        self.literal_prefix
            .as_ref()
            .map_or_else(|| root.to_path_buf(), |prefix| root.join(prefix.as_str()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum PathError {
    #[error("path is empty")]
    Empty,
    #[error("absolute paths are not allowed")]
    Absolute,
    #[error("path traversal is not allowed")]
    Traversal,
    #[error("home expansion is not allowed")]
    HomeExpansion,
    #[error("Windows drive prefixes are not allowed")]
    DrivePrefix,
    #[error("backslash separators are not allowed in persisted paths")]
    Backslash,
    #[error("path segment is invalid: {0}")]
    InvalidSegment(String),
    #[error("glob pattern is invalid: {0}")]
    InvalidGlob(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SeparatorPolicy {
    RejectBackslash,
    AllowNormalized,
}

pub fn normalize_cli_path(value: &str) -> String {
    value.replace('\\', "/")
}

pub fn slugify_path_segment(value: &str) -> Result<String, PathError> {
    let mut output = String::new();
    let mut last_was_dash = false;

    for ch in value.trim().chars().flat_map(char::to_lowercase) {
        let keep = ch.is_alphanumeric() || ch == '_' || ch == '-';
        if keep {
            output.push(ch);
            last_was_dash = false;
        } else if !last_was_dash {
            output.push('-');
            last_was_dash = true;
        }
    }

    let slug = output.trim_matches('-').to_string();
    validate_filename_segment(&slug)?;
    Ok(slug)
}

fn parse_workspace_path(
    value: &str,
    separator_policy: SeparatorPolicy,
) -> Result<WorkspacePath, PathError> {
    if value.is_empty() {
        return Err(PathError::Empty);
    }
    if value == "~" || value.starts_with("~/") {
        return Err(PathError::HomeExpansion);
    }
    if value.contains('\\') && separator_policy == SeparatorPolicy::RejectBackslash {
        return Err(PathError::Backslash);
    }
    if has_windows_drive_prefix(value) {
        return Err(PathError::DrivePrefix);
    }

    let path = Path::new(value);
    if path.is_absolute() {
        return Err(PathError::Absolute);
    }

    let mut segments = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) => {
                let segment = segment.to_string_lossy();
                validate_path_segment(&segment)?;
                segments.push(segment.to_string());
            }
            Component::CurDir => {}
            Component::ParentDir => return Err(PathError::Traversal),
            Component::RootDir | Component::Prefix(_) => return Err(PathError::Absolute),
        }
    }

    if segments.is_empty() {
        return Err(PathError::Empty);
    }

    Ok(WorkspacePath(segments.join("/")))
}

fn validate_path_segment(segment: &str) -> Result<(), PathError> {
    if segment.is_empty() || segment == "." || segment == ".." {
        return Err(PathError::InvalidSegment(segment.to_string()));
    }
    if segment.contains('/') || segment.contains('\\') {
        return Err(PathError::InvalidSegment(segment.to_string()));
    }
    Ok(())
}

fn validate_filename_segment(segment: &str) -> Result<(), PathError> {
    validate_path_segment(segment)?;

    let upper = segment
        .split('.')
        .next()
        .unwrap_or(segment)
        .to_ascii_uppercase();
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    if RESERVED.contains(&upper.as_str()) {
        return Err(PathError::InvalidSegment(segment.to_string()));
    }
    if segment.ends_with('.') || segment.ends_with(' ') {
        return Err(PathError::InvalidSegment(segment.to_string()));
    }

    Ok(())
}

fn has_windows_drive_prefix(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()
}

fn contains_glob_meta(segment: &str) -> bool {
    segment
        .chars()
        .any(|character| matches!(character, '*' | '?' | '[' | ']' | '{' | '}'))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        PathError, WorkspaceGlob, WorkspacePath, normalize_cli_path, slugify_path_segment,
    };

    #[test]
    fn config_paths_are_posix_relative() {
        assert_eq!(
            WorkspacePath::parse_config("notes/foo.md")
                .unwrap()
                .as_str(),
            "notes/foo.md"
        );
        assert_eq!(
            WorkspacePath::parse_config("./notes/foo.md")
                .unwrap()
                .as_str(),
            "notes/foo.md"
        );
        assert_eq!(
            WorkspacePath::parse_config("notes\\foo.md"),
            Err(PathError::Backslash)
        );
    }

    #[test]
    fn glob_scan_roots_stop_before_the_first_dynamic_component() {
        let root = Path::new("/workspace");
        let scan_root = |pattern| {
            WorkspaceGlob::parse_config(pattern)
                .unwrap()
                .scan_root(root)
        };

        assert_eq!(
            scan_root("knowledge/tasks/**/*.md"),
            root.join("knowledge/tasks")
        );
        assert_eq!(
            scan_root("knowledge/workspace/*/index.md"),
            root.join("knowledge/workspace")
        );
        assert_eq!(scan_root("**/*.md"), root.to_path_buf());
        assert_eq!(scan_root("README.md"), root.join("README.md"));
    }

    #[test]
    fn glob_scan_roots_reject_paths_outside_the_workspace() {
        for pattern in [
            "../notes/**/*.md",
            "/notes/**/*.md",
            "~/notes/**/*.md",
            "C:/notes/**/*.md",
            r"notes\**\*.md",
        ] {
            assert!(WorkspaceGlob::parse_config(pattern).is_err(), "{pattern}");
        }
    }

    #[test]
    fn workspace_globs_validate_syntax_and_expose_literal_prefixes() {
        let pattern = WorkspaceGlob::parse_config("knowledge/tasks/**/*.md").unwrap();
        assert_eq!(pattern.as_str(), "knowledge/tasks/**/*.md");
        assert_eq!(
            pattern.literal_prefix().map(WorkspacePath::as_str),
            Some("knowledge/tasks")
        );
        assert!(
            pattern
                .matcher()
                .is_match("knowledge/tasks/open/example.md")
        );

        let pattern = WorkspaceGlob::parse_config("**/*.md").unwrap();
        assert_eq!(pattern.literal_prefix(), None);
        assert!(matches!(
            WorkspaceGlob::parse_config("knowledge/[invalid.md"),
            Err(PathError::InvalidGlob(_))
        ));
    }

    #[test]
    fn workspace_path_deserialization_uses_persisted_path_rules() {
        assert_eq!(
            serde_json::from_str::<WorkspacePath>(r#""notes/example.md""#)
                .unwrap()
                .as_str(),
            "notes/example.md"
        );
        assert!(serde_json::from_str::<WorkspacePath>(r#""../outside.md""#).is_err());
        assert!(serde_json::from_str::<WorkspacePath>(r#""notes\\outside.md""#).is_err());
    }

    #[test]
    fn cli_paths_accept_windows_separators_then_normalize() {
        assert_eq!(normalize_cli_path("notes\\foo.md"), "notes/foo.md");
        assert_eq!(
            WorkspacePath::parse_cli("notes\\foo.md").unwrap().as_str(),
            "notes/foo.md"
        );
    }

    #[test]
    fn rejects_unsafe_paths() {
        assert_eq!(WorkspacePath::parse_config(""), Err(PathError::Empty));
        assert_eq!(
            WorkspacePath::parse_config("/tmp/foo"),
            Err(PathError::Absolute)
        );
        assert_eq!(
            WorkspacePath::parse_config("../foo"),
            Err(PathError::Traversal)
        );
        assert_eq!(
            WorkspacePath::parse_config("~/foo"),
            Err(PathError::HomeExpansion)
        );
        assert_eq!(
            WorkspacePath::parse_config("C:/foo"),
            Err(PathError::DrivePrefix)
        );
    }

    #[test]
    fn slugify_rejects_empty_or_reserved_segments() {
        assert_eq!(
            slugify_path_segment("User Registration").unwrap(),
            "user-registration"
        );
        assert_eq!(slugify_path_segment("研究 计划").unwrap(), "研究-计划");
        assert_eq!(
            slugify_path_segment("CON"),
            Err(PathError::InvalidSegment("con".to_string()))
        );
        assert_eq!(
            slugify_path_segment("!!!"),
            Err(PathError::InvalidSegment(String::new()))
        );
    }
}
