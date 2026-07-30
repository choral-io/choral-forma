use std::error::Error;
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use semver::Version;
use serde::{Deserialize, Serialize};

use super::error;

pub const RECEIPT_FILE_NAME: &str = "forma.install.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PendingUpdate {
    pub from_version: Version,
    pub to_version: Version,
    pub backup_file: String,
    pub staged_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallReceipt {
    pub schema_version: u32,
    pub manager: String,
    pub repository: String,
    pub installed_version: Version,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_update: Option<PendingUpdate>,
}

#[derive(Debug)]
pub enum ReceiptState {
    Missing,
    Valid(Box<InstallReceipt>),
}

impl ReceiptState {
    pub fn valid(&self) -> Option<&InstallReceipt> {
        match self {
            Self::Missing => None,
            Self::Valid(receipt) => Some(receipt),
        }
    }

    pub fn owner_label(&self) -> &str {
        self.valid()
            .map(|receipt| receipt.manager.as_str())
            .unwrap_or("unknown")
    }
}

pub fn path_for_executable(executable: &Path) -> Result<PathBuf, Box<dyn Error>> {
    let parent = executable
        .parent()
        .ok_or_else(|| error("the current Forma executable has no parent directory"))?;
    Ok(parent.join(RECEIPT_FILE_NAME))
}

pub fn load(path: &Path) -> Result<ReceiptState, Box<dyn Error>> {
    let source = match fs::read_to_string(path) {
        Ok(source) => source,
        Err(source) if source.kind() == std::io::ErrorKind::NotFound => {
            return Ok(ReceiptState::Missing);
        }
        Err(source) => {
            return Err(error(format!(
                "cannot read installation receipt {}: {source}",
                path.display()
            )));
        }
    };
    let receipt = serde_json::from_str::<InstallReceipt>(&source).map_err(|source| {
        error(format!(
            "invalid installation receipt {}: {source}",
            path.display()
        ))
    })?;
    if receipt.schema_version != 1 {
        return Err(error(format!(
            "unsupported installation receipt schema version {}",
            receipt.schema_version
        )));
    }
    super::release::validate_repository(&receipt.repository)?;
    Ok(ReceiptState::Valid(Box::new(receipt)))
}

pub fn write(path: &Path, receipt: &InstallReceipt) -> Result<(), Box<dyn Error>> {
    let source = serde_json::to_vec_pretty(receipt)?;
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
                    "cannot create temporary installation receipt {}: {source}",
                    temporary.display()
                ))
            })?;
        file.write_all(&source)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        drop(file);
        activate_receipt(&temporary, path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(not(windows))]
fn activate_receipt(temporary: &Path, path: &Path) -> Result<(), Box<dyn Error>> {
    fs::rename(temporary, path)?;
    Ok(())
}

#[cfg(windows)]
fn activate_receipt(temporary: &Path, path: &Path) -> Result<(), Box<dyn Error>> {
    if path.exists() {
        fs::remove_file(path)?;
    }
    match fs::rename(temporary, path) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            fs::copy(temporary, path).map_err(|copy_error| {
                error(format!(
                    "cannot activate installation receipt after rename failed ({rename_error}): {copy_error}"
                ))
            })?;
            let file = fs::OpenOptions::new().write(true).open(path)?;
            file.sync_all()?;
            fs::remove_file(temporary)?;
            Ok(())
        }
    }
}

pub fn reconcile_pending(
    state: ReceiptState,
    receipt_path: &Path,
    executable: &Path,
    current_version: &Version,
) -> Result<ReceiptState, Box<dyn Error>> {
    let ReceiptState::Valid(receipt) = state else {
        return Ok(state);
    };
    let mut receipt = *receipt;
    let Some(pending) = receipt.pending_update.clone() else {
        return Ok(ReceiptState::Valid(Box::new(receipt)));
    };
    if receipt.installed_version != pending.from_version {
        return Err(error(format!(
            "installation receipt pending update starts at {}, but installedVersion is {}",
            pending.from_version, receipt.installed_version
        )));
    }
    let parent = executable
        .parent()
        .ok_or_else(|| error("the current Forma executable has no parent directory"))?;
    let backup = adjacent_file(parent, &pending.backup_file)?;
    let staged = adjacent_file(parent, &pending.staged_file)?;

    if current_version == &pending.to_version {
        receipt.installed_version = pending.to_version;
    } else if current_version == &pending.from_version {
        receipt.installed_version = pending.from_version;
    } else {
        return Err(error(format!(
            "cannot reconcile pending Forma update {} -> {} because the running executable reports {}",
            pending.from_version, pending.to_version, current_version
        )));
    }

    receipt.pending_update = None;
    write(receipt_path, &receipt)?;
    let _ = remove_if_present(&backup);
    let _ = remove_if_present(&staged);
    Ok(ReceiptState::Valid(Box::new(receipt)))
}

fn adjacent_file(parent: &Path, file_name: &str) -> Result<PathBuf, Box<dyn Error>> {
    let path = Path::new(file_name);
    let mut components = path.components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err(error(format!(
            "invalid pending update file name {file_name:?}"
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

    #[test]
    fn round_trips_receipt() {
        let directory = std::env::temp_dir().join(format!(
            "forma-receipt-test-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("unnamed")
        ));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join(RECEIPT_FILE_NAME);
        let receipt = InstallReceipt {
            schema_version: 1,
            manager: "forma-install-script".to_owned(),
            repository: "choral-io/choral-forma".to_owned(),
            installed_version: Version::new(0, 1, 28),
            pending_update: None,
        };
        write(&path, &receipt).unwrap();
        let ReceiptState::Valid(actual) = load(&path).unwrap() else {
            panic!("expected a valid receipt");
        };
        assert_eq!(actual.manager, receipt.manager);
        assert_eq!(actual.installed_version, receipt.installed_version);
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn reconciles_completed_pending_update() {
        let directory = std::env::temp_dir().join(format!(
            "forma-receipt-reconcile-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        let executable = directory.join(if cfg!(windows) { "forma.exe" } else { "forma" });
        fs::write(&executable, b"new executable").unwrap();
        let backup = directory.join(".forma-update.backup");
        let staged = directory.join(".forma-update.new");
        fs::write(&backup, b"old executable").unwrap();
        fs::write(&staged, b"new executable").unwrap();
        let receipt_path = directory.join(RECEIPT_FILE_NAME);
        let receipt = InstallReceipt {
            schema_version: 1,
            manager: "forma-install-script".to_owned(),
            repository: "choral-io/choral-forma".to_owned(),
            installed_version: Version::new(0, 1, 28),
            pending_update: Some(PendingUpdate {
                from_version: Version::new(0, 1, 28),
                to_version: Version::new(0, 1, 29),
                backup_file: ".forma-update.backup".to_owned(),
                staged_file: ".forma-update.new".to_owned(),
            }),
        };
        write(&receipt_path, &receipt).unwrap();

        let state = reconcile_pending(
            ReceiptState::Valid(Box::new(receipt)),
            &receipt_path,
            &executable,
            &Version::new(0, 1, 29),
        )
        .unwrap();
        let actual = state.valid().unwrap();
        assert_eq!(actual.installed_version, Version::new(0, 1, 29));
        assert!(actual.pending_update.is_none());
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
