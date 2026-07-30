mod receipt;
mod release;
mod replacement;
mod verify;

use std::error::Error;
use std::fmt;
use std::io::{self, IsTerminal, Write};

use receipt::{InstallReceipt, PendingUpdate, ReceiptState};
use release::{Release, ReleaseClient};
use semver::Version;
use serde::Serialize;

const OFFICIAL_REPOSITORY: &str = "choral-io/choral-forma";
const INSTALL_SCRIPT_MANAGER: &str = "forma-install-script";

#[derive(Debug, Clone)]
pub struct Options {
    pub version: Option<String>,
    pub check: bool,
    pub yes: bool,
    pub reinstall: bool,
    pub allow_downgrade: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum UpdateDirection {
    Upgrade,
    Same,
    Downgrade,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum UpdateStatus {
    UpToDate,
    UpdateAvailable,
    Updated,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    schema_version: u32,
    operation: &'static str,
    status: UpdateStatus,
    current_version: String,
    target_version: String,
    direction: UpdateDirection,
    update_available: bool,
    installation_owner: String,
    can_apply: bool,
    target_asset: String,
}

impl Report {
    pub fn write_human(&self, writer: &mut impl Write) -> io::Result<()> {
        writeln!(writer, "Current version: {}", self.current_version)?;
        writeln!(writer, "Target version: {}", self.target_version)?;
        writeln!(writer, "Target asset: {}", self.target_asset)?;
        writeln!(writer, "Installation owner: {}", self.installation_owner)?;
        match self.status {
            UpdateStatus::UpToDate => writeln!(writer, "Forma is already up to date."),
            UpdateStatus::UpdateAvailable => {
                if self.can_apply {
                    writeln!(writer, "The requested Forma update is available.")
                } else {
                    writeln!(
                        writer,
                        "The requested release is available, but this installation cannot apply it."
                    )
                }
            }
            UpdateStatus::Updated => {
                writeln!(writer, "Updated Forma to {}.", self.target_version)
            }
        }
    }
}

#[derive(Debug)]
struct SelfUpdateError(String);

impl fmt::Display for SelfUpdateError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl Error for SelfUpdateError {}

fn error(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(SelfUpdateError(message.into()))
}

pub async fn execute(options: Options) -> Result<Report, Box<dyn Error>> {
    let current_version = Version::parse(forma_core::version())
        .map_err(|source| error(format!("invalid current Forma version: {source}")))?;
    let current_executable = std::env::current_exe().map_err(|source| {
        error(format!(
            "cannot resolve the current Forma executable: {source}"
        ))
    })?;
    let receipt_path = receipt::path_for_executable(&current_executable)?;
    let receipt_state = receipt::reconcile_pending(
        receipt::load(&receipt_path)?,
        &receipt_path,
        &current_executable,
        &current_version,
    )?;
    let repository = receipt_state
        .valid()
        .map(|value| value.repository.as_str())
        .unwrap_or(OFFICIAL_REPOSITORY);
    release::validate_repository(repository)?;

    let requested_version = options
        .version
        .as_deref()
        .map(normalize_version)
        .transpose()?;
    let client = ReleaseClient::new(repository)?;
    let release = if let Some(version) = requested_version.as_ref() {
        Some(client.exact(version).await?)
    } else {
        client.latest_after(&current_version).await?
    };
    let target_asset = release::target_asset_name()?;

    let Some(release) = release else {
        return Ok(report(
            &current_version,
            &current_version,
            target_asset,
            &receipt_state,
            UpdateStatus::UpToDate,
            false,
        ));
    };

    release.validate_assets(target_asset)?;
    let direction = compare_versions(&current_version, &release.version);
    let version_permits_apply = match direction {
        UpdateDirection::Upgrade => true,
        UpdateDirection::Same => options.reinstall,
        UpdateDirection::Downgrade => options.allow_downgrade,
    };
    let owns_installation = receipt_state.valid().is_some_and(|receipt| {
        receipt.manager == INSTALL_SCRIPT_MANAGER && receipt.installed_version == current_version
    });
    let can_apply = owns_installation && version_permits_apply;
    let status = if direction == UpdateDirection::Same && !options.reinstall {
        UpdateStatus::UpToDate
    } else {
        UpdateStatus::UpdateAvailable
    };
    let check_report = report(
        &current_version,
        &release.version,
        target_asset,
        &receipt_state,
        status,
        can_apply,
    );
    if options.check || status == UpdateStatus::UpToDate {
        return Ok(check_report);
    }

    let receipt = require_owned_receipt(&receipt_state, &current_version)?;
    match direction {
        UpdateDirection::Upgrade => {}
        UpdateDirection::Same if !options.reinstall => return Ok(check_report),
        UpdateDirection::Same => {}
        UpdateDirection::Downgrade if !options.allow_downgrade => {
            return Err(error(format!(
                "refusing to downgrade Forma from {} to {}; pass --allow-downgrade to confirm the version direction",
                current_version, release.version
            )));
        }
        UpdateDirection::Downgrade => {}
    }
    if !options.yes {
        confirm(&current_version, &release.version, direction)?;
    }

    apply(
        &client,
        release,
        target_asset,
        current_executable,
        receipt_path,
        receipt.clone(),
    )
    .await
}

async fn apply(
    client: &ReleaseClient,
    release: Release,
    target_asset: &str,
    current_executable: std::path::PathBuf,
    receipt_path: std::path::PathBuf,
    mut receipt: InstallReceipt,
) -> Result<Report, Box<dyn Error>> {
    let checksum_asset = format!("{target_asset}.sha256");
    let binary_url = release.asset_url(target_asset)?;
    let checksum_url = release.asset_url(&checksum_asset)?;
    let paths = replacement::Paths::new(&current_executable)?;
    let _lock = replacement::UpdateLock::acquire(&paths.lock)?;

    eprintln!(
        "Downloading Forma {} for {}...",
        release.version, target_asset
    );
    let (binary, checksum) = tokio::try_join!(
        client.download(binary_url),
        client.download_text(checksum_url)
    )?;
    let expected_hash = verify::parse_checksum(&checksum, target_asset)?;
    replacement::write_staged(&paths.staged, &binary, &current_executable)?;
    if let Err(source) = verify::verify_file(&paths.staged, &expected_hash) {
        cleanup_update_artifacts(&paths);
        return Err(source);
    }
    if let Err(source) =
        replacement::verify_executable_version(&paths.staged, &release.version).await
    {
        cleanup_update_artifacts(&paths);
        return Err(source);
    }

    if let Err(source) = replacement::copy_backup(&current_executable, &paths.backup) {
        cleanup_update_artifacts(&paths);
        return Err(source);
    }
    receipt.pending_update = Some(PendingUpdate {
        from_version: receipt.installed_version.clone(),
        to_version: release.version.clone(),
        backup_file: paths
            .backup
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| error("update backup path is not valid UTF-8"))?
            .to_owned(),
        staged_file: paths
            .staged
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| error("update staging path is not valid UTF-8"))?
            .to_owned(),
    });
    if let Err(source) = receipt::write(&receipt_path, &receipt) {
        cleanup_update_artifacts(&paths);
        return Err(source);
    }

    if let Err(source) = self_replace::self_replace(&paths.staged) {
        if let Err(recovery) = replacement::restore_backup(&paths.backup, &current_executable) {
            return Err(error(format!(
                "failed to replace Forma ({source}) and failed to restore its backup ({recovery})"
            )));
        }
        receipt.pending_update = None;
        receipt::write(&receipt_path, &receipt).map_err(|receipt_error| {
            error(format!(
                "failed to replace Forma ({source}); restored the executable, but could not finalize its installation receipt ({receipt_error})"
            ))
        })?;
        cleanup_update_artifacts(&paths);
        return Err(error(format!("failed to replace Forma: {source}")));
    }

    if let Err(source) =
        replacement::verify_executable_version(&current_executable, &release.version).await
    {
        replacement::restore_backup(&paths.backup, &current_executable).map_err(|recovery| {
            error(format!(
                "the updated Forma executable failed verification ({source}) and its backup could not be restored ({recovery})"
            ))
        })?;
        receipt.pending_update = None;
        receipt::write(&receipt_path, &receipt)?;
        let _ = replacement::remove_if_present(&paths.backup);
        let _ = replacement::remove_if_present(&paths.staged);
        return Err(error(format!(
            "the updated Forma executable failed verification and the previous version was restored: {source}"
        )));
    }

    let previous_version = receipt.installed_version.clone();
    receipt.installed_version = release.version.clone();
    receipt.pending_update = None;
    receipt::write(&receipt_path, &receipt)?;
    cleanup_update_artifacts(&paths);

    Ok(Report {
        schema_version: 1,
        operation: "self.update",
        status: UpdateStatus::Updated,
        current_version: previous_version.to_string(),
        target_version: release.version.to_string(),
        direction: compare_versions(&previous_version, &release.version),
        update_available: false,
        installation_owner: receipt.manager,
        can_apply: true,
        target_asset: target_asset.to_owned(),
    })
}

fn cleanup_update_artifacts(paths: &replacement::Paths) {
    let _ = replacement::remove_if_present(&paths.backup);
    let _ = replacement::remove_if_present(&paths.staged);
}

fn report(
    current: &Version,
    target: &Version,
    target_asset: &str,
    receipt: &ReceiptState,
    status: UpdateStatus,
    can_apply: bool,
) -> Report {
    Report {
        schema_version: 1,
        operation: "self.update",
        status,
        current_version: current.to_string(),
        target_version: target.to_string(),
        direction: compare_versions(current, target),
        update_available: status == UpdateStatus::UpdateAvailable,
        installation_owner: receipt.owner_label().to_owned(),
        can_apply,
        target_asset: target_asset.to_owned(),
    }
}

fn require_owned_receipt<'a>(
    state: &'a ReceiptState,
    current_version: &Version,
) -> Result<&'a InstallReceipt, Box<dyn Error>> {
    let receipt = state.valid().ok_or_else(|| {
        error(
            "this Forma executable is not owned by the official install scripts; update it with mise, WinGet, its editor extension, another package manager, or rerun the Forma installer",
        )
    })?;
    if receipt.manager != INSTALL_SCRIPT_MANAGER {
        return Err(error(format!(
            "installation manager {} does not permit Forma self-update",
            receipt.manager
        )));
    }
    if receipt.installed_version != *current_version {
        return Err(error(format!(
            "installation receipt records Forma {}, but the running executable is {}; rerun the installer to repair ownership metadata",
            receipt.installed_version, current_version
        )));
    }
    Ok(receipt)
}

fn normalize_version(source: &str) -> Result<Version, Box<dyn Error>> {
    let normalized = source.strip_prefix('v').unwrap_or(source);
    if normalized.is_empty() || normalized.starts_with('v') {
        return Err(error(format!("invalid Forma version {source:?}")));
    }
    Version::parse(normalized).map_err(|source| error(format!("invalid Forma version: {source}")))
}

fn compare_versions(current: &Version, target: &Version) -> UpdateDirection {
    use std::cmp::Ordering;
    match target.cmp(current) {
        Ordering::Greater => UpdateDirection::Upgrade,
        Ordering::Equal => UpdateDirection::Same,
        Ordering::Less => UpdateDirection::Downgrade,
    }
}

fn confirm(
    current: &Version,
    target: &Version,
    direction: UpdateDirection,
) -> Result<(), Box<dyn Error>> {
    if !io::stdin().is_terminal() {
        return Err(error(
            "self-update requires interactive confirmation; pass --yes in a noninteractive session",
        ));
    }
    let action = match direction {
        UpdateDirection::Upgrade => "Upgrade",
        UpdateDirection::Same => "Reinstall",
        UpdateDirection::Downgrade => "Downgrade",
    };
    eprint!("{action} Forma from {current} to {target}? [y/N] ");
    io::stderr().flush()?;
    let mut answer = String::new();
    io::stdin().read_line(&mut answer)?;
    if !matches!(answer.trim().to_ascii_lowercase().as_str(), "y" | "yes") {
        return Err(error("Forma self-update was cancelled"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_plain_and_tagged_versions() {
        assert_eq!(normalize_version("0.1.29").unwrap(), Version::new(0, 1, 29));
        assert_eq!(
            normalize_version("v0.1.29").unwrap(),
            Version::new(0, 1, 29)
        );
        assert!(normalize_version("vv0.1.29").is_err());
        assert!(normalize_version("main").is_err());
    }

    #[test]
    fn classifies_version_direction() {
        let current = Version::new(0, 1, 28);
        assert_eq!(
            compare_versions(&current, &Version::new(0, 1, 29)),
            UpdateDirection::Upgrade
        );
        assert_eq!(
            compare_versions(&current, &Version::new(0, 1, 28)),
            UpdateDirection::Same
        );
        assert_eq!(
            compare_versions(&current, &Version::new(0, 1, 27)),
            UpdateDirection::Downgrade
        );
    }
}
