use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use thiserror::Error;

use crate::path::WorkspacePath;

#[derive(Debug, Error)]
pub enum WorkspaceBoundaryError {
    #[error("workspace root could not be resolved")]
    RootUnavailable {
        #[source]
        source: io::Error,
    },
    #[error("workspace path contains a symbolic link: {path}")]
    Symlink { path: String },
    #[error("workspace path is not a directory: {path}")]
    NotDirectory { path: String },
    #[error("workspace path is not a regular file: {path}")]
    NotRegularFile { path: String },
    #[error("workspace path does not exist: {path}")]
    NotFound { path: String },
    #[error("workspace path already exists: {path}")]
    AlreadyExists { path: String },
    #[error("workspace path escaped the workspace boundary: {path}")]
    OutsideWorkspace { path: String },
    #[error("workspace path could not be accessed: {path}")]
    Io {
        path: String,
        #[source]
        source: io::Error,
    },
}

#[derive(Debug, Clone)]
pub struct WorkspaceBoundary {
    root: PathBuf,
}

impl WorkspaceBoundary {
    pub fn new(root: impl AsRef<Path>) -> Result<Self, WorkspaceBoundaryError> {
        let root = fs::canonicalize(root)
            .map_err(|source| WorkspaceBoundaryError::RootUnavailable { source })?;
        let metadata = fs::metadata(&root)
            .map_err(|source| WorkspaceBoundaryError::RootUnavailable { source })?;
        if !metadata.is_dir() {
            return Err(WorkspaceBoundaryError::RootUnavailable {
                source: io::Error::new(
                    io::ErrorKind::NotADirectory,
                    "workspace root is not a directory",
                ),
            });
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn resolve_existing_file(
        &self,
        path: &WorkspacePath,
    ) -> Result<PathBuf, WorkspaceBoundaryError> {
        let absolute = self.validate_existing_components(path, true)?;
        let resolved = fs::canonicalize(&absolute).map_err(|source| self.io_error(path, source))?;
        if !resolved.starts_with(&self.root) {
            return Err(self.outside_error(path));
        }
        Ok(resolved)
    }

    pub fn prepare_new_file<'a>(
        &'a self,
        path: &WorkspacePath,
    ) -> Result<PreparedWorkspaceFile<'a>, WorkspaceBoundaryError> {
        self.create_and_validate_parent_directories(path)?;

        let absolute = self.root.join(path.as_str());
        match fs::symlink_metadata(&absolute) {
            Ok(_) => return Err(self.already_exists_error(path)),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(source) => return Err(self.io_error(path, source)),
        }

        self.validate_parent_components(path)?;
        let file = match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&absolute)
        {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                return Err(self.already_exists_error(path));
            }
            Err(source) => return Err(self.io_error(path, source)),
        };

        self.validate_existing_components(path, true)?;
        Ok(PreparedWorkspaceFile {
            boundary: self,
            path: path.clone(),
            absolute,
            file,
        })
    }

    pub fn write_new_file(
        &self,
        path: &WorkspacePath,
        contents: impl AsRef<[u8]>,
    ) -> Result<PathBuf, WorkspaceBoundaryError> {
        self.prepare_new_file(path)?.write_all(contents)
    }

    fn create_and_validate_parent_directories(
        &self,
        path: &WorkspacePath,
    ) -> Result<(), WorkspaceBoundaryError> {
        let components = path.as_str().split('/').collect::<Vec<_>>();
        let mut current = self.root.clone();
        let mut relative = PathBuf::new();

        for component in components.iter().take(components.len().saturating_sub(1)) {
            current.push(component);
            relative.push(component);
            match fs::symlink_metadata(&current) {
                Ok(metadata) => {
                    if metadata.file_type().is_symlink() {
                        return Err(WorkspaceBoundaryError::Symlink {
                            path: display_relative(&relative),
                        });
                    }
                    if !metadata.is_dir() {
                        return Err(WorkspaceBoundaryError::NotDirectory {
                            path: display_relative(&relative),
                        });
                    }
                }
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    match fs::create_dir(&current) {
                        Ok(()) => {}
                        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
                        Err(source) => {
                            return Err(WorkspaceBoundaryError::Io {
                                path: display_relative(&relative),
                                source,
                            });
                        }
                    }
                    let metadata = fs::symlink_metadata(&current).map_err(|source| {
                        WorkspaceBoundaryError::Io {
                            path: display_relative(&relative),
                            source,
                        }
                    })?;
                    if metadata.file_type().is_symlink() || !metadata.is_dir() {
                        return Err(WorkspaceBoundaryError::NotDirectory {
                            path: display_relative(&relative),
                        });
                    }
                }
                Err(source) => {
                    return Err(WorkspaceBoundaryError::Io {
                        path: display_relative(&relative),
                        source,
                    });
                }
            }
        }

        self.validate_parent_components(path)
    }

    fn validate_parent_components(
        &self,
        path: &WorkspacePath,
    ) -> Result<(), WorkspaceBoundaryError> {
        let parent = path
            .as_str()
            .rsplit_once('/')
            .map_or("", |(parent, _)| parent);
        if parent.is_empty() {
            return Ok(());
        }
        let parent = WorkspacePath::parse_config(parent)
            .expect("a parent of a validated WorkspacePath is also valid");
        self.validate_existing_components(&parent, false)?;
        Ok(())
    }

    fn validate_existing_components(
        &self,
        path: &WorkspacePath,
        require_regular_file: bool,
    ) -> Result<PathBuf, WorkspaceBoundaryError> {
        let mut current = self.root.clone();
        let mut relative = PathBuf::new();
        let component_count = path.as_str().split('/').count();

        for (index, component) in path.as_str().split('/').enumerate() {
            current.push(component);
            relative.push(component);
            let metadata = match fs::symlink_metadata(&current) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    return Err(WorkspaceBoundaryError::NotFound {
                        path: display_relative(&relative),
                    });
                }
                Err(source) => {
                    return Err(WorkspaceBoundaryError::Io {
                        path: display_relative(&relative),
                        source,
                    });
                }
            };
            if metadata.file_type().is_symlink() {
                return Err(WorkspaceBoundaryError::Symlink {
                    path: display_relative(&relative),
                });
            }

            let is_last = index + 1 == component_count;
            if !is_last && !metadata.is_dir() {
                return Err(WorkspaceBoundaryError::NotDirectory {
                    path: display_relative(&relative),
                });
            }
            if is_last && require_regular_file && !metadata.is_file() {
                return Err(WorkspaceBoundaryError::NotRegularFile {
                    path: path.as_str().to_string(),
                });
            }
        }

        Ok(current)
    }

    fn io_error(&self, path: &WorkspacePath, source: io::Error) -> WorkspaceBoundaryError {
        WorkspaceBoundaryError::Io {
            path: path.as_str().to_string(),
            source,
        }
    }

    fn outside_error(&self, path: &WorkspacePath) -> WorkspaceBoundaryError {
        WorkspaceBoundaryError::OutsideWorkspace {
            path: path.as_str().to_string(),
        }
    }

    fn already_exists_error(&self, path: &WorkspacePath) -> WorkspaceBoundaryError {
        WorkspaceBoundaryError::AlreadyExists {
            path: path.as_str().to_string(),
        }
    }
}

pub struct PreparedWorkspaceFile<'a> {
    boundary: &'a WorkspaceBoundary,
    path: WorkspacePath,
    absolute: PathBuf,
    file: File,
}

impl PreparedWorkspaceFile<'_> {
    pub fn write_all(
        mut self,
        contents: impl AsRef<[u8]>,
    ) -> Result<PathBuf, WorkspaceBoundaryError> {
        self.boundary
            .validate_existing_components(&self.path, true)?;
        self.file
            .write_all(contents.as_ref())
            .map_err(|source| self.boundary.io_error(&self.path, source))?;
        self.file
            .flush()
            .map_err(|source| self.boundary.io_error(&self.path, source))?;
        self.boundary
            .validate_existing_components(&self.path, true)?;
        Ok(self.absolute)
    }
}

fn display_relative(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::{WorkspaceBoundary, WorkspaceBoundaryError};
    use crate::path::WorkspacePath;

    #[test]
    fn resolves_only_regular_files_without_symlink_components() {
        let fixture = Fixture::new("resolve");
        fs::create_dir_all(fixture.root.join("notes")).unwrap();
        fs::write(fixture.root.join("notes/example.md"), "# Example").unwrap();
        fs::create_dir(fixture.root.join("notes/folder")).unwrap();
        let boundary = WorkspaceBoundary::new(&fixture.root).unwrap();

        assert_eq!(
            boundary
                .resolve_existing_file(&path("notes/example.md"))
                .unwrap(),
            fs::canonicalize(fixture.root.join("notes/example.md")).unwrap()
        );
        assert!(matches!(
            boundary.resolve_existing_file(&path("notes/folder")),
            Err(WorkspaceBoundaryError::NotRegularFile { .. })
        ));
    }

    #[test]
    fn creates_missing_directories_and_writes_with_create_new() {
        let fixture = Fixture::new("write");
        let boundary = WorkspaceBoundary::new(&fixture.root).unwrap();
        let target = path("notes/nested/example.md");

        let written = boundary.write_new_file(&target, "# Example").unwrap();
        assert_eq!(
            written,
            fs::canonicalize(&fixture.root)
                .unwrap()
                .join("notes/nested/example.md")
        );
        assert_eq!(fs::read_to_string(&written).unwrap(), "# Example");
        assert!(matches!(
            boundary.write_new_file(&target, "replacement"),
            Err(WorkspaceBoundaryError::AlreadyExists { .. })
        ));
        assert_eq!(fs::read_to_string(&written).unwrap(), "# Example");
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinks_for_reads_and_new_file_parents() {
        use std::os::unix::fs::symlink;

        let fixture = Fixture::new("symlink");
        let outside = Fixture::new("outside");
        fs::write(outside.root.join("outside.md"), "# Outside").unwrap();
        symlink(&outside.root, fixture.root.join("linked")).unwrap();
        symlink(
            outside.root.join("outside.md"),
            fixture.root.join("linked-file.md"),
        )
        .unwrap();
        let boundary = WorkspaceBoundary::new(&fixture.root).unwrap();

        for target in ["linked/outside.md", "linked-file.md"] {
            assert!(matches!(
                boundary.resolve_existing_file(&path(target)),
                Err(WorkspaceBoundaryError::Symlink { .. })
            ));
        }
        assert!(matches!(
            boundary.write_new_file(&path("linked/created.md"), "unsafe"),
            Err(WorkspaceBoundaryError::Symlink { .. })
        ));
        assert!(!outside.root.join("created.md").exists());
    }

    fn path(value: &str) -> WorkspacePath {
        WorkspacePath::parse_config(value).unwrap()
    }

    struct Fixture {
        root: std::path::PathBuf,
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            static NEXT_ID: AtomicU64 = AtomicU64::new(0);
            let root = std::env::temp_dir().join(format!(
                "forma-boundary-{name}-{}-{}",
                std::process::id(),
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&root).unwrap();
            Self { root }
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }
}
