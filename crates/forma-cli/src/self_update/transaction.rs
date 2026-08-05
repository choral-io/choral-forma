use std::error::Error;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use semver::Version;
use serde::{Deserialize, Serialize};

use super::error;

pub const TRANSACTION_FILE_NAME: &str = ".forma-update.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateTransaction {
    pub schema_version: u32,
    pub from_version: Version,
    pub to_version: Version,
    pub backup_file: String,
    pub staged_file: String,
}

pub fn path_for_executable(executable: &Path) -> Result<PathBuf, Box<dyn Error>> {
    let parent = executable
        .parent()
        .ok_or_else(|| error("the current Forma executable has no parent directory"))?;
    Ok(parent.join(TRANSACTION_FILE_NAME))
}

pub fn reconcile(
    path: &Path,
    executable: &Path,
    current_version: &Version,
) -> Result<(), Box<dyn Error>> {
    let Some(transaction) = load(path)? else {
        return Ok(());
    };
    if current_version != &transaction.from_version && current_version != &transaction.to_version {
        return Err(error(format!(
            "cannot reconcile pending Forma update {} -> {} because the running executable reports {}",
            transaction.from_version, transaction.to_version, current_version
        )));
    }

    let parent = executable
        .parent()
        .ok_or_else(|| error("the current Forma executable has no parent directory"))?;
    let backup = adjacent_file(parent, &transaction.backup_file)?;
    let staged = adjacent_file(parent, &transaction.staged_file)?;
    finish(path, &backup, &staged)
}

pub fn write(path: &Path, transaction: &UpdateTransaction) -> Result<(), Box<dyn Error>> {
    let source = serde_json::to_vec_pretty(transaction)?;
    let temporary = path.with_extension(format!(
        "json.tmp-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|source| {
                error(format!(
                    "cannot create temporary update transaction {}: {source}",
                    temporary.display()
                ))
            })?;
        file.write_all(&source)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        drop(file);
        activate(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

pub fn finish(path: &Path, backup: &Path, staged: &Path) -> Result<(), Box<dyn Error>> {
    remove_if_present(backup)?;
    remove_if_present(staged)?;
    remove_if_present(path)
}

fn load(path: &Path) -> Result<Option<UpdateTransaction>, Box<dyn Error>> {
    let source = match fs::read_to_string(path) {
        Ok(source) => source,
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(source) => {
            return Err(error(format!(
                "cannot read update transaction {}: {source}",
                path.display()
            )));
        }
    };
    let transaction = serde_json::from_str::<UpdateTransaction>(&source).map_err(|source| {
        error(format!(
            "invalid update transaction {}: {source}",
            path.display()
        ))
    })?;
    if transaction.schema_version != 1 {
        return Err(error(format!(
            "unsupported update transaction schema version {}",
            transaction.schema_version
        )));
    }
    Ok(Some(transaction))
}

#[cfg(not(windows))]
fn activate(temporary: &Path, path: &Path) -> Result<(), Box<dyn Error>> {
    fs::rename(temporary, path)?;
    Ok(())
}

#[cfg(windows)]
fn activate(temporary: &Path, path: &Path) -> Result<(), Box<dyn Error>> {
    if path.exists() {
        fs::remove_file(path)?;
    }
    match fs::rename(temporary, path) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            fs::copy(temporary, path).map_err(|copy_error| {
                error(format!(
                    "cannot activate update transaction after rename failed ({rename_error}): {copy_error}"
                ))
            })?;
            let file = fs::OpenOptions::new().write(true).open(path)?;
            file.sync_all()?;
            fs::remove_file(temporary)?;
            Ok(())
        }
    }
}

fn adjacent_file(parent: &Path, file_name: &str) -> Result<PathBuf, Box<dyn Error>> {
    let path = Path::new(file_name);
    let mut components = path.components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err(error(format!(
            "invalid update transaction file name {file_name:?}"
        )));
    }
    Ok(parent.join(path))
}

fn remove_if_present(path: &Path) -> Result<(), Box<dyn Error>> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(source) => Err(Box::new(source)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_directory(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "forma-update-transaction-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    #[test]
    fn round_trips_and_reconciles_completed_update() {
        let directory = test_directory("completed");
        fs::create_dir_all(&directory).unwrap();
        let executable = directory.join(if cfg!(windows) { "forma.exe" } else { "forma" });
        let backup = directory.join(".forma-update.backup");
        let staged = directory.join(".forma-update.new");
        fs::write(&executable, b"new executable").unwrap();
        fs::write(&backup, b"old executable").unwrap();
        fs::write(&staged, b"new executable").unwrap();
        let path = path_for_executable(&executable).unwrap();
        let transaction = UpdateTransaction {
            schema_version: 1,
            from_version: Version::new(0, 1, 29),
            to_version: Version::new(0, 1, 30),
            backup_file: ".forma-update.backup".to_owned(),
            staged_file: ".forma-update.new".to_owned(),
        };
        write(&path, &transaction).unwrap();

        reconcile(&path, &executable, &Version::new(0, 1, 30)).unwrap();

        assert!(!path.exists());
        assert!(!backup.exists());
        assert!(!staged.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn reconciles_abandoned_update_without_persistent_state() {
        let directory = test_directory("abandoned");
        fs::create_dir_all(&directory).unwrap();
        let executable = directory.join(if cfg!(windows) { "forma.exe" } else { "forma" });
        let backup = directory.join(".forma-update.backup");
        let staged = directory.join(".forma-update.new");
        fs::write(&executable, b"old executable").unwrap();
        fs::write(&backup, b"old executable").unwrap();
        fs::write(&staged, b"new executable").unwrap();
        let path = path_for_executable(&executable).unwrap();
        write(
            &path,
            &UpdateTransaction {
                schema_version: 1,
                from_version: Version::new(0, 1, 29),
                to_version: Version::new(0, 1, 30),
                backup_file: ".forma-update.backup".to_owned(),
                staged_file: ".forma-update.new".to_owned(),
            },
        )
        .unwrap();

        reconcile(&path, &executable, &Version::new(0, 1, 29)).unwrap();

        assert!(!path.exists());
        assert!(!backup.exists());
        assert!(!staged.exists());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn rejects_non_adjacent_recovery_paths() {
        let parent = std::env::temp_dir().join("forma");
        assert!(adjacent_file(&parent, "../backup").is_err());
        assert!(adjacent_file(&parent, "nested/backup").is_err());
    }
}
