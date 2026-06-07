use std::fmt;
use std::path::{Component, Path};

use serde::{Deserialize, Serialize};
use thiserror::Error;

macro_rules! forma_path {
    ($suffix:literal) => {
        concat!(".forma", $suffix)
    };
}

pub const FORMA_DIR: &str = forma_path!("");
pub const FORMA_SPACES_PATH: &str = forma_path!("/spaces.yml");
pub const FORMA_GITIGNORE_PATH: &str = forma_path!("/.gitignore");
pub const FORMA_INDEX_SUMMARY_PATH: &str = forma_path!("/index.summary.json");
pub const FORMA_LOCAL_OVERRIDES_PATH: &str = forma_path!("/overrides/local.yml");
pub const FORMA_TEMPLATES_DIR: &str = forma_path!("/templates");
pub const FORMA_TYPES_PATH: &str = forma_path!("/types.yml");
pub const FORMA_VIEWS_DIR: &str = forma_path!("/views");
pub const FORMA_SETTINGS_PATH: &str = forma_path!("/settings.yml");

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
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

#[cfg(test)]
mod tests {
    use super::{PathError, WorkspacePath, normalize_cli_path, slugify_path_segment};

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
