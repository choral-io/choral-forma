//! Workspace-aware validation and create-only execution. Temporary validation
//! uses the original configured inputs; it never broadens imports.
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::{FilePreview, SliceChoice, compile_slice};
use crate::boundary::WorkspaceBoundary;
use crate::config::load_workspace;
use crate::diagnostics::OperationStatus;
use crate::index::{check_workspace, discover_loaded_workspace};
use crate::operations::{
    create_entry, create_preview, inspect_entry_by_path, list_files, list_space, workspace_health,
};
use crate::path::WorkspacePath;
use crate::render::render_view;
use crate::scan::WorkspaceScanPlan;

#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct PlanError(pub String);

type Result<T> = std::result::Result<T, PlanError>;
fn fail(message: impl Into<String>) -> PlanError {
    PlanError(message.into())
}
fn convert(error: impl std::fmt::Display) -> PlanError {
    fail(error.to_string())
}
fn digest(bytes: impl AsRef<[u8]>) -> String {
    Sha256::digest(bytes.as_ref())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Confirmation binds these exact files, choices, verification steps and scoped
/// preconditions. The id is an integrity identifier, not an authorization token.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FilePlan {
    pub id: String,
    pub schema_version: u32,
    pub workspace_id: String,
    pub choice: SliceChoice,
    pub files: Vec<FilePreview>,
    pub preconditions: BTreeMap<String, String>,
    pub verification: Vec<String>,
    pub advisories: Vec<PlanAdvisory>,
}

/// A non-blocking distribution reminder; never a runtime classification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanAdvisory {
    pub code: String,
    pub path: String,
    pub message: String,
}

fn advisories(files: &[FilePreview]) -> Vec<PlanAdvisory> {
    files.iter().filter(|file| file.path.starts_with(".forma/local/")).map(|file| PlanAdvisory {
        code: "modeling.reviewDistribution".into(),
        path: file.path.clone(),
        message: "This destination uses a commonly local-only distribution convention. Verify that collaborators receive this file and its references. This is not a Git-ignore determination, runtime classification, or privacy guarantee.".into(),
    }).collect()
}

fn workspace_id(boundary: &WorkspaceBoundary) -> String {
    let mut source = b"forma:modeling:workspace:v2\0".to_vec();
    source.extend_from_slice(boundary.root().as_os_str().as_encoded_bytes());
    format!("ws2-{}", digest(source))
}

impl FilePlan {
    fn identity(&self) -> Result<String> {
        let mut unsigned = self.clone();
        unsigned.id.clear();
        Ok(format!(
            "gm2-{}",
            digest(serde_json::to_vec(&unsigned).map_err(convert)?)
        ))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApplyStatus {
    Applied,
    Partial,
    VerificationFailed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReport {
    pub schema_version: u32,
    pub operation: String,
    pub status: ApplyStatus,
    pub plan_id: String,
    pub written: Vec<String>,
    /// May exist with incomplete contents. Never removed automatically.
    pub failed_target: Option<String>,
    pub created_directories: Vec<String>,
    pub error: Option<String>,
}

struct Snapshot {
    state: BTreeMap<String, String>,
    files: BTreeMap<String, Vec<u8>>,
}

fn path(value: &str) -> Result<WorkspacePath> {
    WorkspacePath::parse_config(value).map_err(convert)
}

// Capture only explicit configuration inputs and the chosen content directory.
// No repository-wide copy, Git state, credential store, or hidden privacy inference.
fn snapshot(root: &Path, choice: &SliceChoice, files: &[FilePreview]) -> Result<Snapshot> {
    let boundary = WorkspaceBoundary::new(root).map_err(convert)?;
    let workspace = load_workspace(root).map_err(convert)?;
    let discovery = discover_loaded_workspace(&workspace);
    if !discovery.index.entries.is_empty() {
        return Err(fail(
            "Guided modeling currently requires an empty configured corpus.",
        ));
    }
    let baseline = check_workspace(root);
    if baseline.status != OperationStatus::Passed {
        return Err(fail(format!(
            "Workspace check must pass before modeling: {:?}",
            baseline.diagnostics
        )));
    }
    let mut paths = std::collections::BTreeSet::from([".forma.md".to_string()]);
    for source in &workspace.config_sources {
        if source.present {
            paths.insert(source.path.clone());
        }
    }
    // Includes matching but unclassified control files, and newly added imports.
    for file in WorkspaceScanPlan::bootstrap(root)
        .config_patterns()
        .matching_files()
        .map_err(convert)?
    {
        paths.insert(
            file.strip_prefix(root)
                .map_err(convert)?
                .to_string_lossy()
                .replace('\\', "/"),
        );
    }
    for file in list_files(root).map_err(convert)?.files {
        paths.insert(file.path);
    }
    let mut captured = BTreeMap::new();
    let mut state = BTreeMap::new();
    for name in paths {
        let absolute = boundary
            .resolve_existing_file(&path(&name)?)
            .map_err(convert)?;
        let bytes = fs::read(absolute).map_err(convert)?;
        state.insert(format!("file:{name}"), digest(&bytes));
        captured.insert(name, bytes);
    }
    // No pre-existing files beneath the proposed include, including unindexed
    // files. This rejects accidental adoption without an inventory/import step.
    fn empty_directory(
        root: &Path,
        name: &str,
        state: &mut BTreeMap<String, String>,
    ) -> Result<()> {
        match fs::symlink_metadata(root.join(name)) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                state.insert(format!("directory:{name}"), "missing".into());
                Ok(())
            }
            Err(e) => Err(convert(e)),
            Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => {
                state.insert(format!("directory:{name}"), "directory".into());
                for entry in fs::read_dir(root.join(name)).map_err(convert)? {
                    let entry = entry.map_err(convert)?;
                    let child = format!(
                        "{name}/{}",
                        entry
                            .file_name()
                            .to_str()
                            .ok_or_else(|| fail("Non-UTF8 content path."))?
                    );
                    empty_directory(root, &child, state)?;
                }
                Ok(())
            }
            Ok(_) => Err(fail(format!(
                "Proposed content directory is not empty or contains a symbolic link: {name}"
            ))),
        }
    }
    let directory = path(&choice.layout.content_directory)?.to_string();
    // Check parents through the shared resolver before recursive enumeration.
    boundary
        .check_new_file(&path(&format!("{directory}/.modeling-probe"))?)
        .map_err(convert)?;
    empty_directory(root, &directory, &mut state)?;
    for file in files {
        if boundary
            .check_new_file(&path(&file.path)?)
            .map_err(convert)?
        {
            return Err(fail(format!(
                "Create-only target already exists: {}",
                file.path
            )));
        }
        state.insert(format!("target:{}", file.path), "missing".into());
        let mut parent = Path::new(&file.path).parent();
        while let Some(p) = parent.filter(|p| !p.as_os_str().is_empty()) {
            let name = p.to_str().ok_or_else(|| fail("Non-UTF8 parent path."))?;
            let kind = match fs::symlink_metadata(root.join(p)) {
                Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => "directory",
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => "missing",
                Err(e) => return Err(convert(e)),
                Ok(_) => return Err(fail(format!("Invalid target parent: {name}"))),
            };
            state.insert(format!("parent:{name}"), kind.into());
            parent = p.parent();
        }
    }
    Ok(Snapshot {
        state,
        files: captured,
    })
}

struct Overlay(PathBuf);
impl Overlay {
    fn new() -> Result<Self> {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(convert)?
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "forma-model-validation-{}-{nonce}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let mut builder = fs::DirBuilder::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        builder.create(&root).map_err(convert)?;
        Ok(Self(root))
    }

    fn from_snapshot(snapshot: &Snapshot) -> Result<Self> {
        let overlay = Self::new()?;
        for (key, kind) in &snapshot.state {
            if kind == "directory"
                && let Some(name) = key
                    .strip_prefix("directory:")
                    .or_else(|| key.strip_prefix("parent:"))
            {
                fs::create_dir_all(overlay.0.join(path(name)?.as_str())).map_err(convert)?;
            }
        }
        let boundary = WorkspaceBoundary::new(&overlay.0).map_err(convert)?;
        for (name, contents) in &snapshot.files {
            boundary
                .write_new_file(&path(name)?, contents)
                .map_err(convert)?;
        }
        Ok(overlay)
    }
}
impl Drop for Overlay {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn verification_steps(choice: &SliceChoice) -> Vec<String> {
    vec![
        "check".into(),
        "workspace health".into(),
        format!(
            "temporary create/inspect/list {} (validation copy only)",
            choice.group_id
        ),
        format!(
            "view render {}",
            choice
                .layout
                .view_file
                .strip_suffix(".md")
                .unwrap_or(&choice.layout.view_file)
        ),
    ]
}

fn verify(root: &Path, choice: &SliceChoice, files: &[FilePreview]) -> Result<()> {
    // Called only on the private validation copy. A synthetic entry never enters
    // the user workspace, including verification after a successful apply.
    let check = check_workspace(root);
    if check.status != OperationStatus::Passed {
        return Err(fail(format!(
            "Planned workspace check failed: {:?}",
            check.diagnostics
        )));
    }
    let health = workspace_health(root).map_err(convert)?;
    if health.status != OperationStatus::Passed {
        return Err(fail(format!(
            "Planned workspace health failed: {:?}",
            health.diagnostics
        )));
    }
    let workspace = load_workspace(root).map_err(convert)?;
    for file in [&files[0], &files[1], &files[3]] {
        if !workspace
            .config_sources
            .iter()
            .any(|s| s.present && s.path == file.path)
        {
            return Err(fail(format!(
                "Planned control file is outside configured imports: {}",
                file.path
            )));
        }
    }
    let group = workspace
        .model
        .content_group(&choice.group_id)
        .ok_or_else(|| fail("Planned content group is not reachable."))?;
    if group.template != files[2].path {
        return Err(fail(
            "Planned template is not the group's configured template.",
        ));
    }
    let boundary = WorkspaceBoundary::new(root).map_err(convert)?;
    let directory = path(&choice.layout.content_directory)?;
    // An empty corpus may contain empty directories with Markdown-looking names.
    // Choose a free deterministic probe instead of colliding with one of them.
    let mut ordinal = 0u64;
    let slug = loop {
        let candidate = if ordinal == 0 {
            "model-validation".to_string()
        } else {
            format!("model-validation-{ordinal}")
        };
        if !boundary
            .check_new_file(&path(&format!("{directory}/{candidate}.md"))?)
            .map_err(convert)?
        {
            break candidate;
        }
        ordinal = ordinal
            .checked_add(1)
            .ok_or_else(|| fail("No available validation filename."))?;
    };
    let mut inputs = BTreeMap::from([
        (
            "title".into(),
            serde_yml::Value::String("Model validation".into()),
        ),
        ("slug".into(), serde_yml::Value::String(slug)),
    ]);
    for (name, field) in &choice.fields {
        let value = match field.kind {
            super::FieldKind::Text => "Validation value",
            super::FieldKind::Date => "2000-01-01",
        };
        inputs.insert(name.clone(), serde_yml::Value::String(value.into()));
    }
    let preview = create_preview(root, &choice.group_id, inputs.clone()).map_err(convert)?;
    if preview.status != OperationStatus::Passed || !preview.target.writable {
        return Err(fail(format!(
            "Planned create preview failed: {:?}",
            preview.diagnostics
        )));
    }
    let created = create_entry(root, &choice.group_id, inputs).map_err(convert)?;
    if created.status != OperationStatus::Passed || created.created.path != preview.target.path {
        return Err(fail("Validation entry creation did not match the preview."));
    }
    let inspected = inspect_entry_by_path(root, &created.created.path).map_err(convert)?;
    let listed = list_space(root, &choice.group_id).map_err(convert)?;
    let after = check_workspace(root);
    if inspected.status != OperationStatus::Passed
        || listed.status != OperationStatus::Passed
        || after.status != OperationStatus::Passed
        || inspected.entry.space.as_deref() != Some(&choice.group_id)
        || !listed
            .entries
            .iter()
            .any(|entry| entry.path == created.created.path)
    {
        return Err(fail(format!(
            "Validation entry is not consistently classified and retrievable: {:?}",
            after.diagnostics
        )));
    }
    let view = render_view(
        root,
        files[3].path.strip_suffix(".md").unwrap_or(&files[3].path),
        BTreeMap::new(),
    )
    .map_err(convert)?;
    if view.status != OperationStatus::Passed {
        return Err(fail(format!("Planned view failed: {:?}", view.diagnostics)));
    }
    if !matches!(&view.render, Some(crate::render::ViewRenderOutput::Table { items, .. })
        if items.iter().any(|item| item.path == created.created.path))
    {
        return Err(fail("Planned view does not retrieve the validation entry."));
    }
    Ok(())
}

/// Validate without writing to the target workspace. Returned files are complete;
/// changing any choice requires a new plan and confirmation.
pub fn prepare_plan(root: impl AsRef<Path>, choice: &SliceChoice) -> Result<FilePlan> {
    let boundary = WorkspaceBoundary::new(root).map_err(convert)?;
    prepare_on_boundary(&boundary, choice)
}

fn prepare_on_boundary(boundary: &WorkspaceBoundary, choice: &SliceChoice) -> Result<FilePlan> {
    let root = boundary.root();
    let files = compile_slice(choice).map_err(convert)?;
    let before = snapshot(root, choice, &files)?;
    let overlay = Overlay::from_snapshot(&before)?;
    let target = WorkspaceBoundary::new(&overlay.0).map_err(convert)?;
    for file in &files {
        target
            .write_new_file(&path(&file.path)?, &file.content)
            .map_err(convert)?;
    }
    verify(&overlay.0, choice, &files)?;
    if snapshot(root, choice, &files)?.state != before.state {
        return Err(fail(
            "Workspace changed during plan validation; prepare again.",
        ));
    }
    let mut plan = FilePlan {
        id: String::new(),
        schema_version: 2,
        workspace_id: workspace_id(boundary),
        choice: choice.clone(),
        advisories: advisories(&files),
        files,
        preconditions: before.state,
        verification: verification_steps(choice),
    };
    plan.id = plan.identity()?;
    Ok(plan)
}

/// Confirmation is supplied by the caller after presenting all files. This
/// function checks integrity and freshness; it does not infer human consent.
pub fn apply_plan(
    root: impl AsRef<Path>,
    plan: &FilePlan,
    confirmation: &str,
) -> Result<ApplyReport> {
    let boundary = validate_plan(root, plan, confirmation)?;
    apply_validated(&boundary, plan, |boundary, file| {
        boundary
            .write_new_file(&path(&file.path)?, &file.content)
            .map(|_| ())
            .map_err(convert)
    })
}

// Return the same boundary that was used to validate the plan. Never resolve
// the caller's potentially mutable workspace alias again before writing.
fn validate_plan(
    root: impl AsRef<Path>,
    plan: &FilePlan,
    confirmation: &str,
) -> Result<WorkspaceBoundary> {
    if plan.schema_version != 2 || confirmation != plan.id || plan.id != plan.identity()? {
        return Err(fail(
            "Confirmation does not match this exact file plan; prepare a new version-2 plan.",
        ));
    }
    let boundary = WorkspaceBoundary::new(root).map_err(convert)?;
    let validated = prepare_on_boundary(&boundary, &plan.choice)?;
    if &validated != plan {
        return Err(fail(
            "Plan is stale, belongs to another workspace or was edited; prepare and review a new plan.",
        ));
    }
    Ok(boundary)
}

fn apply_validated(
    boundary: &WorkspaceBoundary,
    plan: &FilePlan,
    mut write: impl FnMut(&WorkspaceBoundary, &FilePreview) -> Result<()>,
) -> Result<ApplyReport> {
    let mut report = ApplyReport {
        schema_version: 1,
        operation: "model.apply".into(),
        status: ApplyStatus::Applied,
        plan_id: plan.id.clone(),
        written: vec![],
        failed_target: None,
        created_directories: vec![],
        error: None,
    };
    for file in &plan.files {
        if let Err(error) = write(boundary, file) {
            report.status = ApplyStatus::Partial;
            report.failed_target = Some(file.path.clone());
            report.error = Some(error.to_string());
            break;
        }
        report.written.push(file.path.clone());
    }
    for (key, value) in &plan.preconditions {
        if value == "missing"
            && let Some(parent) = key.strip_prefix("parent:")
            && fs::symlink_metadata(boundary.root().join(parent))
                .is_ok_and(|m| m.is_dir() && !m.file_type().is_symlink())
        {
            report.created_directories.push(parent.into());
        }
    }
    if report.status == ApplyStatus::Applied {
        // Check exact writes and the retained inputs as well as semantic health.
        let validation = (|| {
            for file in &plan.files {
                let bytes = fs::read(
                    boundary
                        .resolve_existing_file(&path(&file.path)?)
                        .map_err(convert)?,
                )
                .map_err(convert)?;
                if bytes != file.content.as_bytes() {
                    return Err(fail(format!("Written file changed: {}", file.path)));
                }
            }
            // Compare the entire scoped input set, including additions during
            // writing. Also reject content arriving before the initial entry.
            let after = snapshot(boundary.root(), &plan.choice, &[])?;
            let mut expected = plan
                .preconditions
                .iter()
                .filter(|(key, _)| key.starts_with("file:") || key.starts_with("directory:"))
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect::<BTreeMap<_, _>>();
            for file in &plan.files {
                expected.insert(format!("file:{}", file.path), digest(&file.content));
            }
            if after.state != expected {
                return Err(fail(
                    "Scoped workspace inputs changed during apply; review the retained files.",
                ));
            }
            let overlay = Overlay::from_snapshot(&after)?;
            verify(&overlay.0, &plan.choice, &plan.files)
        })();
        if let Err(error) = validation {
            report.status = ApplyStatus::VerificationFailed;
            report.error = Some(error.to_string());
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn apply_keeps_the_boundary_validated_before_a_workspace_alias_switch() {
        let first = super::super::tests::Fixture::new();
        let second = super::super::tests::Fixture::new();
        let aliases = super::super::tests::Fixture::new();
        for root in [&first, &second] {
            crate::init_workspace(&root.0, "Identical", "en", "UTC").unwrap();
        }
        let alias = aliases.0.join("workspace");
        std::os::unix::fs::symlink(&first.0, &alias).unwrap();
        let plan = prepare_plan(&alias, &super::super::tests::observation()).unwrap();
        let boundary = validate_plan(&alias, &plan, &plan.id).unwrap();
        fs::remove_file(&alias).unwrap();
        std::os::unix::fs::symlink(&second.0, &alias).unwrap();
        let report = apply_validated(&boundary, &plan, |boundary, file| {
            boundary
                .write_new_file(&path(&file.path)?, &file.content)
                .map(|_| ())
                .map_err(convert)
        })
        .unwrap();
        assert_eq!(report.status, ApplyStatus::Applied);
        for file in &plan.files {
            assert_eq!(
                fs::read_to_string(first.0.join(&file.path)).unwrap(),
                file.content
            );
            assert!(!second.0.join(&file.path).exists());
        }
    }

    #[test]
    fn concurrent_new_control_file_is_reported_after_writes() {
        let root = super::super::tests::Fixture::new();
        crate::init_workspace(&root.0, "Concurrent", "en", "UTC").unwrap();
        let plan = prepare_plan(&root.0, &super::super::tests::observation()).unwrap();
        let boundary = WorkspaceBoundary::new(&root.0).unwrap();
        let mut count = 0;
        let report = apply_validated(&boundary, &plan, |boundary, file| {
            count += 1;
            boundary
                .write_new_file(&path(&file.path)?, &file.content)
                .map_err(convert)?;
            if count == 3 {
                boundary
                    .write_new_file(&path(".forma/concurrent.md")?, &plan.files[3].content)
                    .map_err(convert)?;
            }
            Ok(())
        })
        .unwrap();
        assert_eq!(report.status, ApplyStatus::VerificationFailed);
        assert_eq!(report.written.len(), 4);
        assert!(root.0.join(".forma/concurrent.md").exists());
    }

    #[test]
    fn partial_failure_keeps_written_files_and_reports_incomplete_target() {
        let root = super::super::tests::Fixture::new();
        crate::init_workspace(&root.0, "Failure", "en", "UTC").unwrap();
        let choice = super::super::tests::observation();
        let plan = prepare_plan(&root.0, &choice).unwrap();
        let boundary = WorkspaceBoundary::new(&root.0).unwrap();
        let mut count = 0;
        let report = apply_validated(&boundary, &plan, |boundary, file| {
            count += 1;
            if count == 2 {
                boundary
                    .write_new_file(&path(&file.path)?, "partial")
                    .map_err(convert)?;
                fs::write(boundary.root().join(&plan.files[0].path), "concurrent edit").unwrap();
                return Err(fail("injected disk write failure"));
            }
            boundary
                .write_new_file(&path(&file.path)?, &file.content)
                .map(|_| ())
                .map_err(convert)
        })
        .unwrap();
        assert_eq!(report.status, ApplyStatus::Partial);
        assert_eq!(report.written, [plan.files[0].path.clone()]);
        assert_eq!(
            report.failed_target.as_deref(),
            Some(plan.files[1].path.as_str())
        );
        assert_eq!(
            fs::read_to_string(root.0.join(&plan.files[0].path)).unwrap(),
            "concurrent edit"
        );
        assert_eq!(
            fs::read_to_string(root.0.join(&plan.files[1].path)).unwrap(),
            "partial"
        );
        assert!(!root.0.join(&plan.files[2].path).exists());
    }
}
