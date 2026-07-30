use std::error::Error;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use semver::Version;

use super::error;

const EXECUTABLE_CHECK_TIMEOUT: Duration = Duration::from_secs(10);
const STALE_LOCK_AGE: Duration = Duration::from_secs(2 * 60 * 60);

pub struct Paths {
    pub staged: PathBuf,
    pub backup: PathBuf,
    pub lock: PathBuf,
}

impl Paths {
    pub fn new(target: &Path) -> Result<Self, Box<dyn Error>> {
        let parent = target
            .parent()
            .ok_or_else(|| error("the current Forma executable has no parent directory"))?;
        let suffix = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        Ok(Self {
            staged: parent.join(format!(".forma-update-{suffix}.new")),
            backup: parent.join(format!(".forma-update-{suffix}.backup")),
            lock: parent.join(".forma-update.lock"),
        })
    }
}

pub struct UpdateLock {
    path: PathBuf,
}

impl UpdateLock {
    pub fn acquire(path: &Path) -> Result<Self, Box<dyn Error>> {
        if path.exists() && lock_is_stale(path) {
            fs::remove_file(path).map_err(|source| {
                error(format!(
                    "cannot remove stale Forma update lock {}: {source}",
                    path.display()
                ))
            })?;
        }
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map_err(|source| {
                error(format!(
                    "another Forma update may be running; cannot create lock {}: {source}",
                    path.display()
                ))
            })?;
        writeln!(file, "pid={}", std::process::id())?;
        file.sync_all()?;
        Ok(Self {
            path: path.to_owned(),
        })
    }
}

impl Drop for UpdateLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn lock_is_stale(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .is_some_and(|age| age >= STALE_LOCK_AGE)
}

pub fn write_staged(
    path: &Path,
    source: &[u8],
    current_executable: &Path,
) -> Result<(), Box<dyn Error>> {
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)?;
        file.write_all(source)?;
        file.sync_all()?;
        drop(file);
        copy_executable_permissions(current_executable, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = remove_if_present(path);
    }
    result
}

pub fn copy_backup(source: &Path, destination: &Path) -> Result<(), Box<dyn Error>> {
    fs::copy(source, destination)?;
    let file = fs::OpenOptions::new().write(true).open(destination)?;
    file.sync_all()?;
    Ok(())
}

pub fn restore_backup(backup: &Path, target: &Path) -> Result<(), Box<dyn Error>> {
    if !backup.is_file() {
        return Err(error(format!(
            "Forma update backup {} does not exist",
            backup.display()
        )));
    }
    fs::copy(backup, target)?;
    let file = fs::OpenOptions::new().write(true).open(target)?;
    file.sync_all()?;
    Ok(())
}

pub async fn verify_executable_version(
    executable: &Path,
    expected: &Version,
) -> Result<(), Box<dyn Error>> {
    let mut command = tokio::process::Command::new(executable);
    command.arg("--version").kill_on_drop(true);
    let output = tokio::time::timeout(EXECUTABLE_CHECK_TIMEOUT, command.output())
        .await
        .map_err(|_| {
            error(format!(
                "timed out while verifying {}",
                executable.display()
            ))
        })??;
    if !output.status.success() {
        return Err(error(format!(
            "{} --version exited with {}",
            executable.display(),
            output.status
        )));
    }
    let stdout = String::from_utf8(output.stdout)
        .map_err(|source| error(format!("Forma --version output is not UTF-8: {source}")))?;
    let expected_output = format!("forma {expected}");
    if stdout.trim() != expected_output {
        return Err(error(format!(
            "{} reports {:?}, expected {:?}",
            executable.display(),
            stdout.trim(),
            expected_output
        )));
    }
    Ok(())
}

pub fn remove_if_present(path: &Path) -> Result<(), Box<dyn Error>> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(Box::new(source)),
    }
}

#[cfg(unix)]
fn copy_executable_permissions(source: &Path, destination: &Path) -> Result<(), Box<dyn Error>> {
    use std::os::unix::fs::PermissionsExt;

    let mode = fs::metadata(source)?.permissions().mode();
    fs::set_permissions(destination, fs::Permissions::from_mode(mode))?;
    Ok(())
}

#[cfg(not(unix))]
fn copy_executable_permissions(_source: &Path, _destination: &Path) -> Result<(), Box<dyn Error>> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_unique_paths_next_to_target() {
        let target = std::env::temp_dir()
            .join("forma-test")
            .join("bin")
            .join(if cfg!(windows) { "forma.exe" } else { "forma" });
        let paths = Paths::new(&target).unwrap();
        assert_eq!(paths.staged.parent(), target.parent());
        assert_eq!(paths.backup.parent(), target.parent());
        assert_eq!(paths.lock.parent(), target.parent());
        assert_ne!(paths.staged, paths.backup);
    }
}
