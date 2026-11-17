use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsStr;
use std::fs;
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::http::Uri;
use forma_core::routes::{
    RAW_ROUTE_PREFIX, ROUTE_STATIC_OUTPUT_CONFLICT_CODE, SYSTEM_ROUTE_SEGMENT,
};
use forma_core::{
    DiagnosticSeverity, OperationStatus, StaticSiteDiagnostic, StaticSiteEntry, StaticSiteSnapshot,
    StaticSiteView, build_static_site_snapshot_with_root_path,
};
use include_dir::Dir;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::static_html::{
    PageShellOptions, home_redirect_html, not_found_page, page_shell, public_href, render_pages,
    sitemap_xml,
};

mod output_preflight;

use output_preflight::{ArtifactOutput, incomplete_output_preflight, validate_artifact_outputs};

const OPERATION: &str = "site.build";
pub(crate) const STATIC_DATA_SCHEMA_VERSION: u16 = 3;
/// The artifact directory of the data files, `-/data`, beside the reserved routes.
const STATIC_DATA_DIR: &str = "-/data";
const ARTIFACT_MARKER: &str = ".forma-site-artifact";
const CLOUDFLARE_STATIC_ASSET_HEADERS: &str = r#"/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
"#;

#[derive(Debug, Clone)]
pub(crate) struct SiteBuildOptions {
    pub out: PathBuf,
    pub base_url: String,
    pub root_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SiteBuildResult {
    pub schema_version: u16,
    pub operation: &'static str,
    pub status: OperationStatus,
    pub output: String,
    pub base_url: String,
    pub root_path: String,
    pub artifact_id: String,
    pub counts: SiteBuildCounts,
    pub diagnostics: Vec<StaticSiteDiagnostic>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SiteBuildCounts {
    pub routes: usize,
    pub pages: usize,
    pub views: usize,
    pub resources: usize,
    pub copied_resources: usize,
    pub assets: usize,
    pub warnings: usize,
    pub bytes: u64,
}

#[derive(Debug)]
struct ValidatedOutput {
    target: PathBuf,
    parent: PathBuf,
}

#[derive(Debug)]
struct ArtifactWrite {
    artifact_id: String,
    assets: usize,
    bytes: u64,
    copied_resources: usize,
    pages: usize,
}

#[derive(Debug)]
pub(crate) struct SiteBuildError {
    pub(crate) message: String,
    pub(crate) diagnostics: Vec<StaticSiteDiagnostic>,
}

impl From<String> for SiteBuildError {
    fn from(message: String) -> Self {
        Self {
            message,
            diagnostics: Vec::new(),
        }
    }
}

impl std::fmt::Display for SiteBuildError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

pub(crate) fn build_site(
    workspace: &Path,
    options: SiteBuildOptions,
    static_webapp: &Dir<'_>,
) -> Result<SiteBuildResult, SiteBuildError> {
    let workspace = fs::canonicalize(workspace)
        .map_err(|error| format!("site workspace could not be resolved: {error}"))?;
    let snapshot = build_static_site_snapshot_with_root_path(&workspace, &options.root_path)
        .map_err(|error| format!("site snapshot could not be built: {error}"))?;
    if snapshot.diagnostics.iter().any(|diagnostic| {
        diagnostic.severity == DiagnosticSeverity::Error
            && diagnostic.code != ROUTE_STATIC_OUTPUT_CONFLICT_CODE
    }) {
        return Err(SiteBuildError {
            message: snapshot_errors_message(&snapshot),
            diagnostics: snapshot.diagnostics,
        });
    }
    let base_url = normalize_base_url(&options.base_url)?;
    let output = validate_output(&workspace, &options.out, &snapshot)?;
    let incomplete = |actual| incomplete_output_preflight(actual, &snapshot.diagnostics);
    let staging = staging_path(&output.parent).map_err(incomplete)?;

    fs::create_dir_all(&output.parent).map_err(|error| {
        incomplete(format!(
            "site output parent could not be created {}: {error}",
            output.parent.display()
        ))
    })?;
    fs::create_dir(&staging).map_err(|error| {
        incomplete(format!(
            "site staging directory could not be created {}: {error}",
            staging.display()
        ))
    })?;

    let write = write_artifact(
        &staging,
        &snapshot,
        static_webapp,
        &options.root_path,
        &base_url,
        &workspace,
    );
    let write = match write {
        Ok(value) => value,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
    };

    activate_artifact(&staging, &output.target, &output.parent)?;

    let warnings = snapshot
        .diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == DiagnosticSeverity::Warning)
        .count();
    Ok(SiteBuildResult {
        schema_version: 1,
        operation: OPERATION,
        status: snapshot.status,
        output: output.target.to_string_lossy().to_string(),
        base_url,
        root_path: options.root_path,
        artifact_id: write.artifact_id,
        counts: SiteBuildCounts {
            routes: snapshot.summary.routes,
            // Phase 2 deliberately emits only the generic client shell. Crawlable route pages arrive in Phase 3.
            pages: write.pages,
            views: snapshot.summary.views,
            resources: snapshot.summary.resources,
            copied_resources: write.copied_resources,
            assets: write.assets,
            warnings,
            bytes: write.bytes,
        },
        diagnostics: snapshot.diagnostics,
    })
}

fn write_artifact(
    staging: &Path,
    snapshot: &StaticSiteSnapshot,
    static_webapp: &Dir<'_>,
    root_path: &str,
    base_url: &str,
    workspace: &Path,
) -> Result<ArtifactWrite, SiteBuildError> {
    let dashboard = StaticDashboardData::from_snapshot(snapshot)?;
    let mut data = BTreeMap::new();
    insert_data(&mut data, "dashboard.json".into(), &dashboard)?;
    for entry in &snapshot.entries {
        insert_data(&mut data, data_path("entries", &entry.path), entry)?;
        for variant in &entry.variants {
            insert_data(&mut data, data_path("entries", &variant.path), variant)?;
        }
    }
    for view in &snapshot.views {
        insert_data(&mut data, data_path("views", &view.config_id), view)?;
    }
    for directory in &snapshot.directories {
        if let Some(source_path) = &directory.directory.intro_entry_path {
            let entry = snapshot
                .entries
                .iter()
                .find(|entry| &entry.path == source_path)
                .ok_or_else(|| format!("missing static directory introduction: {source_path}"))?;
            let mut detail = serde_json::to_value(entry).map_err(|error| error.to_string())?;
            let object = detail
                .as_object_mut()
                .expect("entry serializes as an object");
            object.insert(
                "directoryPath".into(),
                Value::String(directory.directory.path.clone()),
            );
            object.insert(
                "directoryRoutePath".into(),
                Value::String(directory.directory.route_path.clone()),
            );
            object.insert(
                "markdown".into(),
                Value::String(directory.intro_markdown.clone().unwrap_or_default()),
            );
            object.insert(
                "html".into(),
                Value::String(directory.intro_html.clone().unwrap_or_default()),
            );
            insert_data(
                &mut data,
                data_path("directories", &directory.directory.path),
                &detail,
            )?;
        }
    }

    let mut files = collect_embedded_files(static_webapp);
    files.sort_by(|left, right| left.0.cmp(&right.0));
    let embedded_index = files
        .iter()
        .find(|file| file.0 == "index.html")
        .map_or(Ok(""), |file| std::str::from_utf8(file.1))
        .map_err(|error| format!("embedded static WebApp index is not UTF-8: {error}"))?;
    let not_found = not_found_page(
        &snapshot.workspace.name,
        &snapshot.workspace.canonical_language,
    );
    let routes = snapshot
        .routes
        .iter()
        .map(|route| (route.path.as_str(), route))
        .collect::<BTreeMap<_, _>>();
    let redirect_path = format!("{SYSTEM_ROUTE_SEGMENT}/index.html");
    let support_paths = [
        redirect_path.as_str(),
        "sitemap.xml",
        "robots.txt",
        "_headers",
        ARTIFACT_MARKER,
    ];
    // The final data directory uses a full SHA-256 segment. Use the same shape during ownership checks.
    const ID_PLACEHOLDER: &str = "0000000000000000000000000000000000000000000000000000000000000000";
    let output_data_paths = data
        .keys()
        .map(|path| format!("{STATIC_DATA_DIR}/{ID_PLACEHOLDER}/{path}"))
        .collect::<Vec<_>>();
    validate_artifact_outputs(
        staging,
        snapshot
            .routes
            .iter()
            .map(ArtifactOutput::route)
            .chain(std::iter::once(ArtifactOutput::generated(
                &not_found.output_path,
                "site support file",
            )))
            .chain(
                files
                    .iter()
                    .filter(|file| file.0 != "index.html")
                    .map(|file| ArtifactOutput::generated(&file.0, "WebApp asset")),
            )
            .chain(snapshot.resources.iter().map(ArtifactOutput::resource))
            .chain(
                support_paths
                    .into_iter()
                    .map(|path| ArtifactOutput::generated(path, "site support file")),
            )
            .chain(
                output_data_paths
                    .iter()
                    .map(|path| ArtifactOutput::generated(path, "site data file")),
            ),
        &snapshot.diagnostics,
    )?;
    let pages = render_pages(snapshot, root_path)?;
    let sitemap_url = format!("{base_url}{}", public_href(root_path, "/sitemap.xml"));
    let support_contents = [
        home_redirect_html(root_path, &snapshot.workspace.canonical_language),
        sitemap_xml(base_url, root_path, &pages),
        format!(
            "User-agent: *\nAllow: {}\nSitemap: {sitemap_url}\n",
            public_href(root_path, "/")
        ),
        CLOUDFLARE_STATIC_ASSET_HEADERS.to_string(),
        "forma-static-site-v1\n".to_string(),
    ];

    let mut bytes = 0;
    let mut assets = 0;
    let mut fingerprint = Sha256::new();
    fingerprint.update(b"forma-static-artifact-v3");
    let fingerprint_write =
        |fingerprint: &mut Sha256, path: &str, contents: &[u8]| -> Result<u64, String> {
            hash_artifact_record(fingerprint, path, contents);
            write_bytes(staging, path, contents)
        };
    for (path, contents) in &files {
        if path == "index.html" {
            continue;
        }
        let contents = root_embedded_asset(contents, path, root_path);
        bytes += fingerprint_write(&mut fingerprint, path, &contents)?;
        assets += 1;
    }
    let copied_resources =
        copy_resources(workspace, staging, snapshot, &mut bytes, &mut fingerprint)?;
    for (path, contents) in support_paths.into_iter().zip(&support_contents) {
        bytes += fingerprint_write(&mut fingerprint, path, contents.as_bytes())?;
    }

    let render_page = |page: &crate::static_html::StaticPage, artifact_id: &str| {
        page_shell(PageShellOptions {
            artifact_id,
            route: routes.get(page.canonical_route.as_str()).copied(),
            base_url,
            embedded_index,
            noindex: page.output_path == not_found.output_path,
            page,
            root_path,
            workspace_name: &snapshot.workspace.name,
            workspace_logo: snapshot
                .workspace
                .logo
                .as_ref()
                .map(|logo| (logo.public_path.as_str(), logo.alt.as_str())),
        })
    };
    for page in pages.iter().chain(std::iter::once(&not_found)) {
        hash_artifact_record(
            &mut fingerprint,
            &page.output_path,
            render_page(page, ID_PLACEHOLDER).as_bytes(),
        );
    }
    for (path, content) in &data {
        let normalized_path = format!("{STATIC_DATA_DIR}/{ID_PLACEHOLDER}/{path}");
        let serialized = serde_json::to_vec(content).map_err(|error| error.to_string())?;
        hash_artifact_record(&mut fingerprint, &normalized_path, &serialized);
    }
    let artifact_id = sha256_hex(fingerprint.finalize().as_slice());

    for page in pages.iter().chain(std::iter::once(&not_found)) {
        bytes += write_bytes(
            staging,
            &page.output_path,
            render_page(page, &artifact_id).as_bytes(),
        )?;
    }
    for (path, mut content) in data {
        let object = content
            .as_object_mut()
            .expect("data record serializes as an object");
        object.insert(
            "schemaVersion".into(),
            Value::from(STATIC_DATA_SCHEMA_VERSION),
        );
        object.insert("artifactId".into(), Value::String(artifact_id.clone()));
        bytes += write_json(
            staging,
            &format!("{STATIC_DATA_DIR}/{artifact_id}/{path}"),
            &content,
        )?;
    }
    Ok(ArtifactWrite {
        artifact_id,
        assets,
        bytes,
        copied_resources,
        pages: pages.len() + 2,
    })
}

fn insert_data(
    data: &mut BTreeMap<String, Value>,
    path: String,
    value: &impl Serialize,
) -> Result<(), String> {
    let value = serde_json::to_value(value).map_err(|error| error.to_string())?;
    match data.entry(path) {
        std::collections::btree_map::Entry::Vacant(entry) => {
            entry.insert(value);
            Ok(())
        }
        std::collections::btree_map::Entry::Occupied(entry) => Err(format!(
            "static data output has multiple owners: {}",
            entry.key()
        )),
    }
}

fn hash_artifact_record(fingerprint: &mut Sha256, path: &str, contents: &[u8]) {
    fingerprint.update((path.len() as u64).to_be_bytes());
    fingerprint.update(path.as_bytes());
    fingerprint.update((contents.len() as u64).to_be_bytes());
    fingerprint.update(Sha256::digest(contents));
}

fn collect_embedded_files<'a>(directory: &'a Dir<'a>) -> Vec<(String, &'a [u8])> {
    let mut files = directory
        .files()
        .map(|file| (file.path().to_string_lossy().to_string(), file.contents()))
        .collect::<Vec<_>>();
    for child in directory.dirs() {
        files.extend(collect_embedded_files(child));
    }
    files
}

fn root_embedded_asset(contents: &[u8], path: &str, root_path: &str) -> Vec<u8> {
    if !path.ends_with(".css") || root_path == "/" {
        return contents.to_vec();
    }
    let Ok(css) = std::str::from_utf8(contents) else {
        return contents.to_vec();
    };
    css.replace("/-/forma-icon", &format!("{root_path}/-/forma-icon"))
        .into_bytes()
}

fn copy_resources(
    workspace: &Path,
    staging: &Path,
    snapshot: &StaticSiteSnapshot,
    bytes: &mut u64,
    fingerprint: &mut Sha256,
) -> Result<usize, String> {
    let mut outputs = BTreeSet::new();
    for resource in &snapshot.resources {
        if resource.referenced_by.is_empty() && !resource.workspace_presentation {
            return Err(format!(
                "site resource was not declared by exported content: {}",
                resource.path
            ));
        }
        let source_relative = safe_relative_path(&resource.path)?;
        let expected_output = resource_output_path(&resource.path);
        if resource.output_path != expected_output {
            return Err(format!(
                "site resource output does not match its declared path: {}",
                resource.path
            ));
        }
        if !outputs.insert(expected_output.to_ascii_lowercase()) {
            return Err(format!(
                "site resources collide on a case-insensitive output path: {}",
                expected_output
            ));
        }
        let source = workspace.join(&source_relative);
        validate_resource_source(workspace, &source, &resource.path)?;
        let contents = fs::read(&source).map_err(|error| {
            format!("site resource could not be read {}: {error}", resource.path)
        })?;
        hash_artifact_record(fingerprint, &expected_output, &contents);
        *bytes += write_bytes(staging, &expected_output, &contents)?;
    }
    Ok(snapshot.resources.len())
}

fn validate_resource_source(
    workspace: &Path,
    source: &Path,
    display_path: &str,
) -> Result<(), String> {
    let relative = source
        .strip_prefix(workspace)
        .map_err(|_| format!("site resource escapes the workspace: {display_path}"))?;
    let mut current = workspace.to_path_buf();
    for (index, component) in relative.components().enumerate() {
        let Component::Normal(segment) = component else {
            return Err(format!("site resource path is not safe: {display_path}"));
        };
        current.push(segment);
        let metadata = fs::symlink_metadata(&current).map_err(|error| {
            format!("site resource could not be inspected {display_path}: {error}")
        })?;
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "site resource must not traverse a symbolic link: {display_path}"
            ));
        }
        let is_leaf = index + 1 == relative.components().count();
        if is_leaf {
            if !metadata.is_file() {
                return Err(format!(
                    "site resource must be a regular file: {display_path}"
                ));
            }
        } else if !metadata.is_dir() {
            return Err(format!(
                "site resource parent must be a directory: {display_path}"
            ));
        }
    }
    let canonical = fs::canonicalize(source)
        .map_err(|error| format!("site resource could not be resolved {display_path}: {error}"))?;
    if canonical == workspace || !canonical.starts_with(workspace) {
        return Err(format!(
            "site resource resolves outside the workspace: {display_path}"
        ));
    }
    Ok(())
}

/// The failure of a snapshot that has errors, naming each one so it can be fixed without
/// running another command.
fn snapshot_errors_message(snapshot: &StaticSiteSnapshot) -> String {
    let mut message = "site snapshot contains errors and cannot be published:".to_string();
    for diagnostic in snapshot
        .diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == DiagnosticSeverity::Error)
    {
        message.push_str(&format!("\n- {}: {}", diagnostic.code, diagnostic.message));
        if let Some(path) = &diagnostic.path {
            message.push_str(&format!(" ({path})"));
        }
        if let Some(actual) = &diagnostic.actual {
            message.push_str(&format!(" {actual}"));
        }
    }
    message
}

fn resource_output_path(path: &str) -> String {
    format!("{}/{path}", RAW_ROUTE_PREFIX.trim_start_matches('/'))
}

fn write_json(value_root: &Path, relative: &str, value: &impl Serialize) -> Result<u64, String> {
    let bytes = serde_json::to_vec(value)
        .map_err(|error| format!("site data could not be serialized: {error}"))?;
    write_bytes(value_root, relative, &bytes)
}

fn write_bytes(value_root: &Path, relative: &str, bytes: &[u8]) -> Result<u64, String> {
    let path = safe_relative_path(relative)?;
    let target = value_root.join(&path);
    let parent = target
        .parent()
        .ok_or_else(|| "site output path has no parent".to_string())?;
    fs::create_dir_all(parent).map_err(|error| {
        format!(
            "site artifact directory could not be created {}: {error}",
            parent.display()
        )
    })?;
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .and_then(|mut file| file.write_all(bytes))
        .map_err(|error| {
            format!(
                "site artifact file could not be written {}: {error}",
                target.display()
            )
        })?;
    Ok(bytes.len() as u64)
}

fn validate_output(
    workspace: &Path,
    out: &Path,
    snapshot: &StaticSiteSnapshot,
) -> Result<ValidatedOutput, String> {
    if out.as_os_str().is_empty() {
        return Err("site output path must not be empty".to_string());
    }
    if out
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("site output path must not contain `..`".to_string());
    }
    let target = if out.is_absolute() {
        normalize_absolute_path(out)?
    } else {
        normalize_absolute_path(&workspace.join(out))?
    };
    if target == Path::new("/") {
        return Err("site output path must not be the filesystem root".to_string());
    }
    let repository = repository_root(workspace);
    if target == workspace || workspace.starts_with(&target) {
        return Err("site output path must not be the workspace root or an ancestor".to_string());
    }
    if let Some(repository) = repository.as_deref()
        && (target == repository || repository.starts_with(&target))
    {
        return Err("site output path must not be the repository root or an ancestor".to_string());
    }
    for protected in [".git", ".forma", ".agents", ".worktrees"] {
        let protected = workspace.join(protected);
        if target == protected || target.starts_with(&protected) {
            return Err(format!(
                "site output path must not be inside protected workspace state: {}",
                protected.display()
            ));
        }
    }
    for source in source_paths(workspace, snapshot) {
        if source.starts_with(&target) || target.starts_with(&source) {
            return Err(format!(
                "site output path overlaps a workspace source: {}",
                source.display()
            ));
        }
    }
    let parent = target
        .parent()
        .ok_or_else(|| "site output path must have a parent directory".to_string())?
        .to_path_buf();
    ensure_existing_ancestors_are_not_symlinks(&parent)?;
    if path_exists(&target)? {
        ensure_existing_target_is_safe(&target)?;
        if !target.join(ARTIFACT_MARKER).is_file() {
            return Err(format!(
                "existing site output is not owned by Forma (missing {ARTIFACT_MARKER}): {}",
                target.display()
            ));
        }
    }
    Ok(ValidatedOutput { target, parent })
}

fn source_paths(workspace: &Path, snapshot: &StaticSiteSnapshot) -> BTreeSet<PathBuf> {
    let mut paths = BTreeSet::new();
    paths.insert(workspace.join(".forma.md"));
    paths.insert(workspace.join(".forma"));
    for entry in &snapshot.entries {
        paths.insert(workspace.join(&entry.path));
        for variant in &entry.variants {
            paths.insert(workspace.join(&variant.path));
        }
    }
    for resource in &snapshot.resources {
        paths.insert(workspace.join(&resource.path));
    }
    paths
}

fn normalize_absolute_path(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("site output path could not be made absolute".to_string());
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::RootDir => normalized.push(Path::new("/")),
            Component::Normal(segment) => normalized.push(segment),
            Component::CurDir => {}
            Component::ParentDir | Component::Prefix(_) => {
                return Err("site output path must not contain traversal components".to_string());
            }
        }
    }
    Ok(normalized)
}

fn ensure_existing_ancestors_are_not_symlinks(path: &Path) -> Result<(), String> {
    let mut current = PathBuf::from("/");
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            continue;
        }
        current.push(component.as_os_str());
        let metadata = match fs::symlink_metadata(&current) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => break,
            Err(error) => {
                return Err(format!(
                    "site output path could not be inspected {}: {error}",
                    current.display()
                ));
            }
        };
        if metadata.file_type().is_symlink() {
            return Err(format!(
                "site output path must not traverse a symbolic link: {}",
                current.display()
            ));
        }
        if !metadata.is_dir() {
            return Err(format!(
                "site output parent is not a directory: {}",
                current.display()
            ));
        }
    }
    Ok(())
}

fn ensure_existing_target_is_safe(target: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(target).map_err(|error| {
        format!(
            "site output could not be inspected {}: {error}",
            target.display()
        )
    })?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "site output must not be a symbolic link: {}",
            target.display()
        ));
    }
    if !metadata.is_dir() {
        return Err(format!(
            "site output must be a directory: {}",
            target.display()
        ));
    }
    Ok(())
}

fn path_exists(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!(
            "site output path could not be inspected {}: {error}",
            path.display()
        )),
    }
}

fn repository_root(workspace: &Path) -> Option<PathBuf> {
    workspace.ancestors().find_map(|candidate| {
        let git = candidate.join(".git");
        if git.is_dir() || git.is_file() {
            Some(candidate.to_path_buf())
        } else {
            None
        }
    })
}

fn staging_path(parent: &Path) -> Result<PathBuf, String> {
    unique_sibling_path(parent, "staging")
}

fn backup_path(parent: &Path) -> Result<PathBuf, String> {
    unique_sibling_path(parent, "backup")
}

fn unique_sibling_path(parent: &Path, kind: &str) -> Result<PathBuf, String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("site staging clock is unavailable: {error}"))?
        .as_nanos();
    for suffix in 0..100 {
        let candidate = parent.join(format!(
            ".forma-site-{kind}-{}-{nonce}-{suffix}",
            std::process::id()
        ));
        match fs::symlink_metadata(&candidate) {
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(candidate),
            Ok(_) => continue,
            Err(error) => {
                return Err(format!(
                    "site {kind} sibling could not be inspected {}: {error}",
                    candidate.display()
                ));
            }
        }
    }
    Err(format!(
        "site {kind} sibling could not be allocated under {}",
        parent.display()
    ))
}

fn activate_artifact(staging: &Path, target: &Path, parent: &Path) -> Result<(), String> {
    activate_artifact_with(staging, target, parent, |from, to| fs::rename(from, to))
}

fn activate_artifact_with<F>(
    staging: &Path,
    target: &Path,
    parent: &Path,
    mut rename: F,
) -> Result<(), String>
where
    F: FnMut(&Path, &Path) -> io::Result<()>,
{
    let backup = if path_exists(target)? {
        ensure_existing_target_is_safe(target)?;
        let backup = backup_path(parent)?;
        rename(target, &backup).map_err(|error| {
            format!(
                "validated site output could not be moved to a recoverable backup {}: {error}",
                target.display()
            )
        })?;
        Some(backup)
    } else {
        None
    };

    match rename(staging, target) {
        Ok(()) => {
            if let Some(backup) = backup {
                fs::remove_dir_all(&backup).map_err(|error| {
                    format!(
                        "site artifact activated at {}, but the previous artifact backup could not be removed {}: {error}",
                        target.display(),
                        backup.display()
                    )
                })?;
            }
            Ok(())
        }
        Err(activation_error) => {
            let Some(backup) = backup else {
                let cleanup = fs::remove_dir_all(staging).err();
                return Err(activation_failure_message(
                    target,
                    &activation_error,
                    None,
                    cleanup.as_ref(),
                ));
            };
            match rename(&backup, target) {
                Ok(()) => {
                    let cleanup = fs::remove_dir_all(staging).err();
                    Err(activation_failure_message(
                        target,
                        &activation_error,
                        Some(&backup),
                        cleanup.as_ref(),
                    ))
                }
                Err(restoration_error) => Err(format!(
                    "site artifact activation failed at {}: {activation_error}; previous artifact backup {} could not be restored: {restoration_error}",
                    target.display(),
                    backup.display()
                )),
            }
        }
    }
}

fn activation_failure_message(
    target: &Path,
    activation_error: &io::Error,
    restored_backup: Option<&Path>,
    cleanup_error: Option<&io::Error>,
) -> String {
    let restoration = restored_backup.map_or_else(
        || "no prior artifact existed".to_string(),
        |backup| format!("previous artifact was restored from {}", backup.display()),
    );
    let cleanup = cleanup_error.map_or_else(String::new, |error| {
        format!("; failed to remove staging artifact: {error}")
    });
    format!(
        "site artifact activation failed at {}: {activation_error}; {restoration}{cleanup}",
        target.display()
    )
}

fn normalize_base_url(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.contains('#') || value.chars().any(char::is_control) {
        return Err("site base URL must not contain a fragment or control characters".to_string());
    }
    let uri = value
        .parse::<Uri>()
        .map_err(|_| "site base URL must be a valid HTTP(S) origin".to_string())?;
    let scheme = uri
        .scheme_str()
        .filter(|scheme| matches!(*scheme, "http" | "https"))
        .ok_or_else(|| "site base URL must use http or https".to_string())?;
    let authority = uri
        .authority()
        .filter(|authority| !authority.host().is_empty() && !authority.as_str().contains('@'))
        .ok_or_else(|| "site base URL must include a host without user information".to_string())?;
    if !valid_authority_port(authority.as_str()) {
        return Err("site base URL port must be numeric".to_string());
    }
    if uri.query().is_some() || !matches!(uri.path(), "" | "/") {
        return Err(
            "site base URL must be an origin without a path, query string, or fragment".to_string(),
        );
    }
    Ok(format!("{scheme}://{authority}"))
}

fn valid_authority_port(authority: &str) -> bool {
    if let Some(rest) = authority.strip_prefix('[') {
        let Some((_, suffix)) = rest.split_once(']') else {
            return false;
        };
        return suffix.is_empty()
            || suffix
                .strip_prefix(':')
                .is_some_and(|port| port.parse::<u16>().is_ok());
    }
    authority
        .rsplit_once(':')
        .is_none_or(|(_, port)| !port.is_empty() && port.parse::<u16>().is_ok())
}

fn sha256_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn data_path(kind: &str, identity: &str) -> String {
    format!(
        "{kind}/{}.json",
        sha256_hex(Sha256::digest(identity.as_bytes()).as_slice())
    )
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.is_empty() || path.is_absolute() {
        return Err(format!("site artifact path is not safe: {value}"));
    }
    let mut segments = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) if segment != OsStr::new("") => segments.push(segment),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("site artifact path is not safe: {value}"));
            }
            _ => return Err(format!("site artifact path is not safe: {value}")),
        }
    }
    if segments.is_empty() {
        return Err(format!("site artifact path is not safe: {value}"));
    }
    Ok(segments.iter().collect())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticDashboardData<'a> {
    schema_version: u16,
    generator_version: &'a str,
    status: OperationStatus,
    workspace: StaticWorkspace<'a>,
    spaces: &'a [forma_core::StaticSiteSpace],
    taxonomies: &'a [forma_core::StaticSiteTaxonomy],
    routes: &'a [forma_core::StaticSiteRoute],
    directories: Vec<StaticDirectorySummary<'a>>,
    resources: &'a [forma_core::StaticSiteResourceCandidate],
    entries: Vec<StaticEntrySummary<'a>>,
    views: Vec<StaticViewSummary<'a>>,
    summary: forma_core::DiagnosticSummary,
    diagnostics: &'a [StaticSiteDiagnostic],
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticWorkspace<'a> {
    name: &'a str,
    canonical_language: &'a str,
    supported_languages: &'a [String],
    home: StaticWorkspaceHome<'a>,
    #[serde(skip_serializing_if = "Option::is_none")]
    logo: Option<StaticLogo<'a>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticWorkspaceHome<'a> {
    path: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<&'a str>,
    omit_leading_title: bool,
    markdown: &'a str,
    headings: &'a [forma_core::RenderedHeading],
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticLogo<'a> {
    public_path: &'a str,
    alt: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticDirectorySummary<'a> {
    path: &'a str,
    route_path: &'a str,
    output_path: &'a str,
    child_directory_paths: &'a [String],
    entry_paths: &'a [String],
    #[serde(skip_serializing_if = "Option::is_none")]
    intro_entry_path: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    data_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticEntrySummary<'a> {
    id: &'a str,
    path: &'a str,
    route_path: &'a str,
    space: &'a str,
    kind: &'a Option<String>,
    title: &'a Option<String>,
    omit_leading_title: bool,
    summary: &'a Option<String>,
    status: OperationStatus,
    variants: Vec<StaticVariantSummary<'a>>,
    data_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticVariantSummary<'a> {
    id: &'a str,
    language: &'a str,
    path: &'a str,
    route_path: &'a str,
    kind: &'a Option<String>,
    title: &'a Option<String>,
    omit_leading_title: bool,
    summary: &'a Option<String>,
    data_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticViewSummary<'a> {
    id: &'a str,
    config_id: &'a str,
    public_id: &'a str,
    source_path: &'a str,
    route_path: &'a str,
    mode: &'a str,
    title: &'a Option<String>,
    display: &'a forma_core::config::DisplayOptions,
    space: &'a Option<String>,
    status: OperationStatus,
    data_path: String,
}

impl<'a> StaticDashboardData<'a> {
    fn from_snapshot(snapshot: &'a StaticSiteSnapshot) -> Result<Self, String> {
        Ok(Self {
            schema_version: STATIC_DATA_SCHEMA_VERSION,
            generator_version: &snapshot.generator_version,
            status: snapshot.status,
            workspace: StaticWorkspace {
                name: &snapshot.workspace.name,
                canonical_language: &snapshot.workspace.canonical_language,
                supported_languages: &snapshot.workspace.supported_languages,
                home: StaticWorkspaceHome {
                    path: &snapshot.workspace.home.path,
                    title: snapshot.workspace.home.title.as_deref(),
                    omit_leading_title: snapshot.workspace.home.omit_leading_title,
                    markdown: &snapshot.workspace.home.markdown,
                    headings: &snapshot.workspace.home.headings,
                },
                logo: snapshot.workspace.logo.as_ref().map(|logo| StaticLogo {
                    public_path: &logo.public_path,
                    alt: &logo.alt,
                }),
            },
            spaces: &snapshot.spaces,
            taxonomies: &snapshot.taxonomies,
            routes: &snapshot.routes,
            directories: snapshot
                .directories
                .iter()
                .map(|directory| {
                    let directory = &directory.directory;
                    StaticDirectorySummary {
                        path: &directory.path,
                        route_path: &directory.route_path,
                        output_path: &directory.output_path,
                        child_directory_paths: &directory.child_directory_paths,
                        entry_paths: &directory.entry_paths,
                        intro_entry_path: directory.intro_entry_path.as_deref(),
                        data_path: directory
                            .intro_entry_path
                            .as_ref()
                            .map(|_| data_path("directories", &directory.path)),
                    }
                })
                .collect(),
            resources: &snapshot.resources,
            entries: snapshot
                .entries
                .iter()
                .map(StaticEntrySummary::from_entry)
                .collect::<Result<Vec<_>, _>>()?,
            views: snapshot
                .views
                .iter()
                .map(StaticViewSummary::from_view)
                .collect::<Result<Vec<_>, _>>()?,
            summary: snapshot.summary.diagnostics,
            diagnostics: &snapshot.diagnostics,
        })
    }
}

impl<'a> StaticEntrySummary<'a> {
    fn from_entry(entry: &'a StaticSiteEntry) -> Result<Self, String> {
        Ok(Self {
            id: &entry.id,
            path: &entry.path,
            route_path: &entry.route_path,
            space: &entry.space,
            kind: &entry.kind,
            title: &entry.title,
            omit_leading_title: entry.omit_leading_title,
            summary: &entry.summary,
            status: entry.status,
            variants: entry
                .variants
                .iter()
                .map(|variant| {
                    Ok(StaticVariantSummary {
                        id: &variant.id,
                        language: &variant.language,
                        path: &variant.path,
                        route_path: &variant.route_path,
                        kind: &variant.kind,
                        title: &variant.title,
                        omit_leading_title: variant.omit_leading_title,
                        summary: &variant.summary,
                        data_path: data_path("entries", &variant.path),
                    })
                })
                .collect::<Result<Vec<_>, String>>()?,
            data_path: data_path("entries", &entry.path),
        })
    }
}

impl<'a> StaticViewSummary<'a> {
    fn from_view(view: &'a StaticSiteView) -> Result<Self, String> {
        Ok(Self {
            id: &view.id,
            config_id: &view.config_id,
            public_id: &view.public_id,
            source_path: &view.source_path,
            route_path: &view.route_path,
            mode: &view.mode,
            title: &view.title,
            display: &view.display,
            space: &view.space,
            status: view.status,
            data_path: data_path("views", &view.config_id),
        })
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::io;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{activate_artifact_with, data_path, normalize_base_url, safe_relative_path};

    #[test]
    fn site_data_paths_keep_distinct_complete_identities() {
        let slash = data_path("entries", "notes/a.md");
        assert_eq!(slash, data_path("entries", "notes/a.md"));
        assert_ne!(slash, data_path("entries", "notes--a.md"));
        assert!(slash.starts_with("entries/"));
        assert_eq!(slash.split('/').count(), 2);
        assert!(safe_relative_path("/absolute").is_err());
    }

    #[test]
    fn site_base_url_requires_a_true_http_origin() {
        assert_eq!(
            normalize_base_url("https://example.test/").unwrap(),
            "https://example.test"
        );
        assert_eq!(
            normalize_base_url("http://localhost:4173").unwrap(),
            "http://localhost:4173"
        );
        assert_eq!(
            normalize_base_url("https://[::1]:4173").unwrap(),
            "https://[::1]:4173"
        );
        for invalid in [
            "javascript:alert(1)",
            "https://user@example.test",
            "https://example.test/path",
            "https://example.test?query=1",
            "https://example.test/#fragment",
            "https://example.test:bad",
        ] {
            assert!(normalize_base_url(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn activation_failure_restores_the_previous_artifact() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let parent = std::env::temp_dir().join(format!("forma-site-activation-{nonce}"));
        let target = parent.join("site");
        let staging = parent.join("staging");
        fs::create_dir_all(&target).unwrap();
        fs::create_dir_all(&staging).unwrap();
        fs::write(target.join("old.txt"), "previous artifact").unwrap();
        fs::write(staging.join("new.txt"), "new artifact").unwrap();

        let error = activate_artifact_with(&staging, &target, &parent, |from, to| {
            if from == staging && to == target {
                return Err(io::Error::other("forced activation failure"));
            }
            fs::rename(from, to)
        })
        .unwrap_err();

        assert!(error.contains("previous artifact was restored"));
        assert_eq!(
            fs::read_to_string(target.join("old.txt")).unwrap(),
            "previous artifact"
        );
        assert!(!target.join("new.txt").exists());
        assert!(!staging.exists());
        fs::remove_dir_all(parent).unwrap();
    }
}
