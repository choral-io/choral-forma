use std::collections::BTreeSet;
use std::ffi::OsStr;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use forma_core::{
    DiagnosticSeverity, OperationStatus, StaticSiteDiagnostic, StaticSiteEntry, StaticSiteSnapshot,
    StaticSiteView, build_static_site_snapshot,
};
use include_dir::Dir;
use serde::Serialize;

const OPERATION: &str = "site.build";

#[derive(Debug, Clone)]
pub(crate) struct SiteBuildOptions {
    pub out: PathBuf,
    pub base_url: String,
    pub home: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub home: Option<String>,
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

pub(crate) fn build_site(
    workspace: &Path,
    options: SiteBuildOptions,
    static_webapp: &Dir<'_>,
) -> Result<SiteBuildResult, String> {
    let workspace = fs::canonicalize(workspace)
        .map_err(|error| format!("site workspace could not be resolved: {error}"))?;
    let snapshot = build_static_site_snapshot(&workspace)
        .map_err(|error| format!("site snapshot could not be built: {error}"))?;
    let base_url = normalize_base_url(&options.base_url)?;
    let output = validate_output(&workspace, &options.out, &snapshot)?;
    let home = validate_home(options.home.as_deref(), &snapshot)?;
    let staging = staging_path(&output.parent)?;

    fs::create_dir_all(&output.parent).map_err(|error| {
        format!(
            "site output parent could not be created {}: {error}",
            output.parent.display()
        )
    })?;
    fs::create_dir(&staging).map_err(|error| {
        format!(
            "site staging directory could not be created {}: {error}",
            staging.display()
        )
    })?;

    let write = write_artifact(
        &staging,
        &snapshot,
        static_webapp,
        &options.root_path,
        &base_url,
    );
    let (assets, bytes) = match write {
        Ok(value) => value,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging);
            return Err(error);
        }
    };

    if output.target.exists() {
        ensure_existing_target_is_safe(&output.target)?;
        fs::remove_dir_all(&output.target).map_err(|error| {
            format!(
                "validated site output could not be replaced {}: {error}",
                output.target.display()
            )
        })?;
    }
    fs::rename(&staging, &output.target).map_err(|error| {
        format!(
            "validated site staging directory could not be activated {}: {error}",
            output.target.display()
        )
    })?;

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
        home,
        counts: SiteBuildCounts {
            routes: snapshot.summary.routes,
            // Phase 2 deliberately emits only the generic client shell. Crawlable route pages arrive in Phase 3.
            pages: 1,
            views: snapshot.summary.views,
            resources: snapshot.summary.resources,
            copied_resources: 0,
            assets,
            warnings,
            bytes,
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
) -> Result<(usize, u64), String> {
    let mut bytes = 0_u64;
    let mut asset_count = 0_usize;
    let data = StaticDashboardData::from_snapshot(snapshot)?;
    bytes += write_json(staging, "data/dashboard.json", &data)?;

    for entry in &snapshot.entries {
        let path = data_path("data/entries", &entry.id)?;
        bytes += write_json(staging, &path, entry)?;
    }
    for view in &snapshot.views {
        let path = data_path("data/views", &view.id)?;
        bytes += write_json(staging, &path, view)?;
    }

    let mut files = collect_embedded_files(static_webapp);
    files.sort_by(|left, right| left.0.cmp(&right.0));
    for (path, contents) in files {
        let contents = if path == "index.html" {
            inject_static_config(contents, root_path, base_url)?.into_bytes()
        } else {
            contents.to_vec()
        };
        bytes += write_bytes(staging, &path, &contents)?;
        asset_count += 1;
    }
    Ok((asset_count, bytes))
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

fn inject_static_config(html: &[u8], root_path: &str, _base_url: &str) -> Result<String, String> {
    let html = std::str::from_utf8(html)
        .map_err(|error| format!("embedded static WebApp index is not UTF-8: {error}"))?;
    let data_base_url = if root_path == "/" {
        "/data".to_string()
    } else {
        format!("{root_path}/data")
    };
    let config = serde_json::json!({ "dataBaseUrl": data_base_url });
    let script = format!(
        r#"<script>window.__FORMA_STATIC_WORKSPACE__={};</script>"#,
        config
    );
    if let Some(index) = html.find("</head>") {
        let mut output = String::with_capacity(html.len() + script.len());
        output.push_str(&html[..index]);
        output.push_str(&script);
        output.push_str(&html[index..]);
        Ok(output)
    } else {
        Ok(format!("{script}{html}"))
    }
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
    fs::write(&target, bytes).map_err(|error| {
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
    for source in source_paths(workspace, snapshot) {
        if source.starts_with(&target) || target == source {
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
    if target.exists() {
        ensure_existing_target_is_safe(&target)?;
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
        if !current.exists() {
            break;
        }
        let metadata = fs::symlink_metadata(&current).map_err(|error| {
            format!(
                "site output path could not be inspected {}: {error}",
                current.display()
            )
        })?;
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
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("site staging clock is unavailable: {error}"))?
        .as_nanos();
    Ok(parent.join(format!(
        ".forma-site-staging-{}-{nonce}",
        std::process::id()
    )))
}

fn validate_home(
    home: Option<&str>,
    snapshot: &StaticSiteSnapshot,
) -> Result<Option<String>, String> {
    let Some(home) = home else { return Ok(None) };
    let home = home.trim();
    if home.is_empty() {
        return Err("site home path must not be empty".to_string());
    }
    if snapshot.entries.iter().any(|entry| entry.path == home) {
        return Ok(Some(home.to_string()));
    }
    Err(format!(
        "site home entry is not a managed workspace entry: {home}"
    ))
}

fn normalize_base_url(value: &str) -> Result<String, String> {
    let value = value.trim().trim_end_matches('/');
    if !(value.starts_with("https://") || value.starts_with("http://")) {
        return Err("site base URL must start with http:// or https://".to_string());
    }
    if value.contains('?')
        || value.contains('#')
        || value.split("//").nth(1).is_none_or(str::is_empty)
    {
        return Err(
            "site base URL must be an origin without a query string or fragment".to_string(),
        );
    }
    Ok(value.to_string())
}

fn data_path(prefix: &str, id: &str) -> Result<String, String> {
    let id = safe_relative_path(id)?;
    Ok(format!("{prefix}/{}.json", id.to_string_lossy()))
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
    #[serde(skip_serializing_if = "Option::is_none")]
    logo: Option<StaticLogo<'a>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticLogo<'a> {
    public_path: &'a str,
    alt: &'a str,
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
    variants: &'a [forma_core::StaticSiteEntryVariant],
    data_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticViewSummary<'a> {
    id: &'a str,
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
            schema_version: snapshot.schema_version,
            generator_version: &snapshot.generator_version,
            status: snapshot.status,
            workspace: StaticWorkspace {
                name: &snapshot.workspace.name,
                canonical_language: &snapshot.workspace.canonical_language,
                supported_languages: &snapshot.workspace.supported_languages,
                logo: snapshot.workspace.logo.as_ref().map(|logo| StaticLogo {
                    public_path: &logo.public_path,
                    alt: &logo.alt,
                }),
            },
            spaces: &snapshot.spaces,
            taxonomies: &snapshot.taxonomies,
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
            variants: &entry.variants,
            data_path: data_path("data/entries", &entry.id)?,
        })
    }
}

impl<'a> StaticViewSummary<'a> {
    fn from_view(view: &'a StaticSiteView) -> Result<Self, String> {
        Ok(Self {
            id: &view.id,
            route_path: &view.route_path,
            mode: &view.mode,
            title: &view.title,
            display: &view.display,
            space: &view.space,
            status: view.status,
            data_path: data_path("data/views", &view.id)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{data_path, safe_relative_path};

    #[test]
    fn site_data_paths_keep_stable_nested_ids() {
        assert_eq!(
            data_path("data/entries", "notes/a").unwrap(),
            "data/entries/notes/a.json"
        );
        assert!(data_path("data/entries", "../a").is_err());
        assert!(safe_relative_path("/absolute").is_err());
    }
}
