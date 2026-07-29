use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use globset::{GlobSet, GlobSetBuilder};

use crate::boundary::WorkspaceBoundary;
use crate::config::WorkspaceConfig;
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::markdown::FormaMarkdownDocument;
use crate::model::ResolvedWorkspaceRelationships;
use crate::path::{FORMA_CONFIG_PATH, WorkspaceGlob, WorkspacePath};

#[derive(Debug, Clone)]
pub struct WorkspacePatternSet {
    root: PathBuf,
    patterns: Vec<String>,
    matcher: GlobSet,
    scan_roots: Vec<PathBuf>,
}

impl PartialEq for WorkspacePatternSet {
    fn eq(&self, other: &Self) -> bool {
        self.root == other.root
            && self.patterns == other.patterns
            && self.scan_roots == other.scan_roots
    }
}

impl Eq for WorkspacePatternSet {}

impl WorkspacePatternSet {
    fn from_validated(root: &Path, patterns: impl IntoIterator<Item = WorkspaceGlob>) -> Self {
        let mut patterns = patterns.into_iter().collect::<Vec<_>>();
        patterns.sort_by(|left, right| left.as_str().cmp(right.as_str()));
        patterns.dedup_by(|left, right| left.as_str() == right.as_str());

        let mut builder = GlobSetBuilder::new();
        let mut scan_roots = Vec::new();
        let pattern_strings = patterns
            .into_iter()
            .map(|pattern| {
                builder.add(
                    globset::Glob::new(pattern.as_str())
                        .expect("WorkspaceGlob contains a validated glob"),
                );
                scan_roots.push(pattern.scan_root(root));
                pattern.as_str().to_string()
            })
            .collect();

        Self {
            root: root.to_path_buf(),
            patterns: pattern_strings,
            matcher: builder
                .build()
                .expect("validated workspace globs should build a matcher"),
            scan_roots: minimal_scan_roots(scan_roots),
        }
    }

    pub fn patterns(&self) -> &[String] {
        &self.patterns
    }

    pub fn scan_roots(&self) -> &[PathBuf] {
        &self.scan_roots
    }

    pub fn is_match(&self, path: impl AsRef<Path>) -> bool {
        self.matcher.is_match(path)
    }

    pub fn matching_patterns(&self, path: impl AsRef<Path>) -> Vec<String> {
        let path = path.as_ref();
        self.patterns
            .iter()
            .filter(|pattern| {
                globset::Glob::new(pattern)
                    .expect("WorkspacePatternSet contains validated globs")
                    .compile_matcher()
                    .is_match(path)
            })
            .cloned()
            .collect()
    }

    pub fn matching_files(&self) -> io::Result<Vec<PathBuf>> {
        let mut files = BTreeSet::new();
        for scan_root in &self.scan_roots {
            collect_regular_files(&self.root, scan_root, &self.matcher, &mut files)?;
        }
        Ok(files.into_iter().collect())
    }

    pub fn matching_files_with_extensions(&self, extensions: &[&str]) -> io::Result<Vec<PathBuf>> {
        Ok(self
            .matching_files()?
            .into_iter()
            .filter(|path| {
                path.extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| {
                        extensions
                            .iter()
                            .any(|allowed| extension.eq_ignore_ascii_case(allowed))
                    })
            })
            .collect())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceScanPlan {
    root: PathBuf,
    config_patterns: WorkspacePatternSet,
    content_patterns: WorkspacePatternSet,
    taxonomy_patterns: WorkspacePatternSet,
    space_patterns: BTreeMap<String, WorkspacePatternSet>,
    taxonomy_term_patterns: BTreeMap<String, BTreeMap<String, WorkspacePatternSet>>,
    watch_patterns: WorkspacePatternSet,
    control_paths: BTreeSet<String>,
    resource_paths: BTreeSet<String>,
    diagnostics: Vec<Diagnostic>,
}

impl WorkspaceScanPlan {
    pub fn bootstrap(root: impl AsRef<Path>) -> Self {
        let root = root.as_ref();
        let mut diagnostics = Vec::new();
        let imports = bootstrap_imports(root, &mut diagnostics);
        let config_patterns = validate_patterns(
            root,
            imports,
            "imports",
            FORMA_CONFIG_PATH,
            &mut diagnostics,
        );
        let control_paths = BTreeSet::from([FORMA_CONFIG_PATH.to_string()]);
        let watch_patterns = watch_pattern_set(
            root,
            &config_patterns,
            &WorkspacePatternSet::from_validated(root, []),
            &control_paths,
            &BTreeSet::new(),
        );
        Self {
            root: root.to_path_buf(),
            config_patterns,
            content_patterns: WorkspacePatternSet::from_validated(root, []),
            taxonomy_patterns: WorkspacePatternSet::from_validated(root, []),
            space_patterns: BTreeMap::new(),
            taxonomy_term_patterns: BTreeMap::new(),
            watch_patterns,
            control_paths,
            resource_paths: BTreeSet::new(),
            diagnostics,
        }
    }

    pub(crate) fn from_imports(
        root: &Path,
        imports: &[String],
        diagnostics: &mut Vec<Diagnostic>,
    ) -> Self {
        let config_patterns = validate_patterns(
            root,
            imports.iter().cloned(),
            "imports",
            FORMA_CONFIG_PATH,
            diagnostics,
        );
        let control_paths = BTreeSet::from([FORMA_CONFIG_PATH.to_string()]);
        let content_patterns = WorkspacePatternSet::from_validated(root, []);
        let resource_paths = BTreeSet::new();
        let watch_patterns = watch_pattern_set(
            root,
            &config_patterns,
            &content_patterns,
            &control_paths,
            &resource_paths,
        );
        Self {
            root: root.to_path_buf(),
            config_patterns,
            content_patterns,
            taxonomy_patterns: WorkspacePatternSet::from_validated(root, []),
            space_patterns: BTreeMap::new(),
            taxonomy_term_patterns: BTreeMap::new(),
            watch_patterns,
            control_paths,
            resource_paths,
            diagnostics: Vec::new(),
        }
    }

    pub(crate) fn resolve(
        bootstrap: Self,
        config: &WorkspaceConfig,
        relationships: &ResolvedWorkspaceRelationships,
        config_sources: impl IntoIterator<Item = String>,
    ) -> Arc<Self> {
        let root = &bootstrap.root;
        let mut diagnostics = bootstrap.diagnostics;
        let space_patterns = relationships
            .content_groups()
            .iter()
            .map(|(space_id, space)| {
                let patterns = if space.include_patterns.is_empty() {
                    vec![space.include.clone()]
                } else {
                    space.include_patterns.clone()
                };
                (
                    space_id.as_str().to_string(),
                    pattern_set_skipping_invalid(root, patterns),
                )
            })
            .collect::<BTreeMap<_, _>>();
        let mut taxonomy_term_patterns = config
            .taxonomies
            .keys()
            .filter_map(|taxonomy_id| {
                config.terms.get(taxonomy_id).map(|terms| {
                    let terms = terms
                        .iter()
                        .map(|(term_id, term)| {
                            let patterns = if relationships
                                .content_group_for_taxonomy_term(taxonomy_id, term_id)
                                .is_some()
                            {
                                pattern_set_skipping_invalid(root, term.include_patterns.clone())
                            } else {
                                validate_patterns(
                                    root,
                                    term.include_patterns.clone(),
                                    &format!("taxonomies.{taxonomy_id}.terms.{term_id}.include"),
                                    FORMA_CONFIG_PATH,
                                    &mut diagnostics,
                                )
                            };
                            (term_id.clone(), patterns)
                        })
                        .collect();
                    (taxonomy_id.clone(), terms)
                })
            })
            .collect::<BTreeMap<_, BTreeMap<_, _>>>();
        for (term_id, content_group_id) in relationships.content_group_term_ids() {
            let Some(patterns) = space_patterns.get(content_group_id.as_str()) else {
                continue;
            };
            taxonomy_term_patterns
                .entry(term_id.taxonomy().as_str().to_string())
                .or_default()
                .insert(term_id.term().as_str().to_string(), patterns.clone());
        }
        let taxonomy_patterns = WorkspacePatternSet::from_validated(
            root,
            taxonomy_term_patterns
                .values()
                .flat_map(BTreeMap::values)
                .flat_map(|patterns| patterns.patterns())
                .filter_map(|pattern| WorkspaceGlob::parse_config(pattern).ok()),
        );
        let content_patterns = WorkspacePatternSet::from_validated(
            root,
            space_patterns
                .values()
                .flat_map(|patterns| patterns.patterns())
                .chain(taxonomy_patterns.patterns())
                .filter_map(|pattern| WorkspaceGlob::parse_config(pattern).ok()),
        );
        let mut control_paths = BTreeSet::from([FORMA_CONFIG_PATH.to_string()]);
        control_paths.extend(
            config_sources
                .into_iter()
                .filter_map(|path| WorkspacePath::parse_config(&path).ok())
                .map(|path| path.as_str().to_string()),
        );
        control_paths.extend(valid_exact_paths(config.guidelines.iter()));
        for space in relationships.content_groups().values() {
            if !space.template.is_empty() {
                control_paths.extend(valid_exact_paths(std::iter::once(&space.template)));
            }
            control_paths.extend(valid_exact_paths(space.guidelines.iter()));
        }

        let mut resource_paths = BTreeSet::new();
        if let Some(logo) = &config.workspace.logo {
            resource_paths.extend(valid_exact_paths(std::iter::once(&logo.path)));
        }
        let watch_patterns = watch_pattern_set(
            root,
            &bootstrap.config_patterns,
            &content_patterns,
            &control_paths,
            &resource_paths,
        );

        Arc::new(Self {
            root: root.clone(),
            config_patterns: bootstrap.config_patterns,
            content_patterns,
            taxonomy_patterns,
            space_patterns,
            taxonomy_term_patterns,
            watch_patterns,
            control_paths,
            resource_paths,
            diagnostics,
        })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn config_patterns(&self) -> &WorkspacePatternSet {
        &self.config_patterns
    }

    pub fn content_patterns(&self) -> &WorkspacePatternSet {
        &self.content_patterns
    }

    pub fn taxonomy_patterns(&self) -> &WorkspacePatternSet {
        &self.taxonomy_patterns
    }

    pub fn space_patterns(&self) -> &BTreeMap<String, WorkspacePatternSet> {
        &self.space_patterns
    }

    pub fn taxonomy_term_patterns(
        &self,
    ) -> &BTreeMap<String, BTreeMap<String, WorkspacePatternSet>> {
        &self.taxonomy_term_patterns
    }

    pub fn watch_patterns(&self) -> &WorkspacePatternSet {
        &self.watch_patterns
    }

    pub fn control_paths(&self) -> &BTreeSet<String> {
        &self.control_paths
    }

    pub fn resource_paths(&self) -> &BTreeSet<String> {
        &self.resource_paths
    }

    pub fn diagnostics(&self) -> &[Diagnostic] {
        &self.diagnostics
    }
}

fn bootstrap_imports(root: &Path, diagnostics: &mut Vec<Diagnostic>) -> Vec<String> {
    let source = match WorkspaceBoundary::new(root)
        .and_then(|boundary| {
            let path = WorkspacePath::parse_config(FORMA_CONFIG_PATH)
                .expect("the built-in Forma config path is valid");
            boundary.resolve_existing_file(&path)
        })
        .map_err(|error| io::Error::new(io::ErrorKind::PermissionDenied, error))
        .and_then(fs::read_to_string)
    {
        Ok(source) => source,
        Err(error) => {
            diagnostics.push(
                Diagnostic::error(
                    "config.readFailed",
                    format!("Workspace configuration could not be read: {error}."),
                )
                .with_path(FORMA_CONFIG_PATH),
            );
            return Vec::new();
        }
    };
    let document = FormaMarkdownDocument::parse(&source);
    diagnostics.extend(document.diagnostics);
    let Some(value) = document.frontmatter.value else {
        return Vec::new();
    };
    let Some(imports) = value.get("imports") else {
        return Vec::new();
    };
    let Some(imports) = imports.as_sequence() else {
        diagnostics.push(
            Diagnostic::error(
                "config.importsInvalid",
                "Configured imports must be a list of workspace-relative glob patterns.",
            )
            .with_path(FORMA_CONFIG_PATH)
            .with_location(DiagnosticLocation::Config {
                field: "imports".to_string(),
            }),
        );
        return Vec::new();
    };
    imports
        .iter()
        .enumerate()
        .filter_map(|(index, value)| match value.as_str() {
            Some(value) => Some(value.to_string()),
            None => {
                diagnostics.push(
                    Diagnostic::error(
                        "config.importsInvalid",
                        "Configured import must be a workspace-relative glob pattern.",
                    )
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config {
                        field: format!("imports[{index}]"),
                    }),
                );
                None
            }
        })
        .collect()
}

fn validate_patterns(
    root: &Path,
    patterns: impl IntoIterator<Item = String>,
    field: &str,
    source_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> WorkspacePatternSet {
    let patterns = patterns
        .into_iter()
        .enumerate()
        .filter_map(
            |(index, pattern)| match WorkspaceGlob::parse_config(&pattern) {
                Ok(pattern) => Some(pattern),
                Err(error) => {
                    diagnostics.push(
                        Diagnostic::error(
                            "config.globInvalid",
                            format!("Configured glob pattern is invalid: {error}."),
                        )
                        .with_path(source_path)
                        .with_location(DiagnosticLocation::Config {
                            field: format!("{field}[{index}]"),
                        })
                        .with_actual(pattern),
                    );
                    None
                }
            },
        );
    WorkspacePatternSet::from_validated(root, patterns)
}

fn pattern_set_skipping_invalid(
    root: &Path,
    patterns: impl IntoIterator<Item = String>,
) -> WorkspacePatternSet {
    WorkspacePatternSet::from_validated(
        root,
        patterns
            .into_iter()
            .filter_map(|pattern| WorkspaceGlob::parse_config(pattern).ok()),
    )
}

fn valid_exact_paths<'a>(
    paths: impl IntoIterator<Item = &'a String>,
) -> impl Iterator<Item = String> {
    paths.into_iter().filter_map(|path| {
        WorkspacePath::parse_config(path)
            .ok()
            .map(|path| path.as_str().to_string())
    })
}

fn watch_pattern_set(
    root: &Path,
    config: &WorkspacePatternSet,
    content: &WorkspacePatternSet,
    controls: &BTreeSet<String>,
    resources: &BTreeSet<String>,
) -> WorkspacePatternSet {
    let patterns = config
        .patterns()
        .iter()
        .chain(content.patterns())
        .chain(controls)
        .chain(resources)
        .filter_map(|pattern| WorkspaceGlob::parse_config(pattern).ok());
    WorkspacePatternSet::from_validated(root, patterns)
}

fn minimal_scan_roots(mut scan_roots: Vec<PathBuf>) -> Vec<PathBuf> {
    scan_roots.sort();
    scan_roots.dedup();
    let mut minimal = Vec::<PathBuf>::new();
    for candidate in scan_roots {
        if minimal
            .iter()
            .any(|existing| candidate.starts_with(existing))
        {
            continue;
        }
        minimal.retain(|existing| !existing.starts_with(&candidate));
        minimal.push(candidate);
    }
    minimal
}

fn collect_regular_files(
    workspace_root: &Path,
    path: &Path,
    matcher: &GlobSet,
    files: &mut BTreeSet<PathBuf>,
) -> io::Result<()> {
    let metadata = match if path == workspace_root {
        fs::metadata(path)
    } else {
        fs::symlink_metadata(path)
    } {
        Ok(metadata) => metadata,
        Err(_) => return Ok(()),
    };
    if metadata.file_type().is_symlink() {
        return Ok(());
    }
    if metadata.is_file() {
        let relative = path.strip_prefix(workspace_root).unwrap_or(path);
        if matcher.is_match(relative) {
            files.insert(path.to_path_buf());
        }
        return Ok(());
    }
    if !metadata.is_dir() {
        return Ok(());
    }

    let Ok(read_dir) = fs::read_dir(path) else {
        return Ok(());
    };
    let mut entries = read_dir.flatten().collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir()
            && matches!(
                entry.file_name().to_str(),
                Some(".git" | "target" | "node_modules")
            )
        {
            continue;
        }
        collect_regular_files(workspace_root, &entry.path(), matcher, files)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{DiagnosticLocation, WorkspaceScanPlan};

    fn write(path: &Path, source: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, source).unwrap();
    }

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-scan-{name}-{unique}"))
    }

    #[test]
    fn bootstrap_excludes_invalid_imports_but_reports_them() {
        let dir = fixture_root("invalid-import");
        fs::create_dir_all(&dir).unwrap();
        write(
            &dir.join(".forma.md"),
            "---\nimports:\n  - .forma/spaces/*.md\n  - ../outside/*.md\nunknown: true\n---\n",
        );
        let plan = WorkspaceScanPlan::bootstrap(&dir);
        assert!(crate::config::load_workspace(&dir).is_err());
        assert_eq!(
            plan.config_patterns().patterns(),
            &[".forma/spaces/*.md".to_string()]
        );
        assert!(
            plan.diagnostics()
                .iter()
                .any(|diagnostic| diagnostic.code == "config.globInvalid")
        );
        fs::remove_dir_all(dir).unwrap();
        assert!(
            !plan
                .watch_patterns()
                .patterns()
                .iter()
                .any(|pattern| pattern.contains(".."))
        );
    }

    #[test]
    fn resolved_plan_uses_configured_spaces_in_taxonomy_queries() {
        let dir = fixture_root("space-taxonomy");
        fs::create_dir_all(&dir).unwrap();
        write(
            &dir.join(".forma.md"),
            r#"---
schemaVersion: 1
workspace:
  name: Scan Test
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
imports:
  - .forma/spaces/*.md
---
"#,
        );
        write(
            &dir.join(".forma/spaces/tasks.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
include:
  - content/tasks/**/*.md
---
"#,
        );

        let workspace = crate::config::load_workspace(&dir).unwrap();
        let space_terms = workspace
            .model
            .scan_plan()
            .taxonomy_term_patterns()
            .get("spaces")
            .expect("configured terms must remain available to taxonomy queries");
        assert_eq!(
            space_terms.get("tasks").unwrap().patterns(),
            &["content/tasks/**/*.md".to_string()]
        );

        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn resolved_plan_reports_invalid_generic_taxonomy_term_globs() {
        let dir = fixture_root("invalid-taxonomy-term");
        fs::create_dir_all(&dir).unwrap();
        write(
            &dir.join(".forma.md"),
            r#"---
schemaVersion: 1
workspace:
  name: Scan Test
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
imports:
  - .forma/taxonomies/*.md
  - .forma/terms/*.md
---
"#,
        );
        write(
            &dir.join(".forma/taxonomies/topics.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: topics\ntitle: Topics\n---\n",
        );
        write(
            &dir.join(".forma/terms/guides.md"),
            "---\nschemaVersion: 1\nkind: term\nid: guides\ntaxonomy: topics\ntitle: Guides\ninclude:\n  - \"content/[broken.md\"\n---\n",
        );

        let workspace = crate::config::load_workspace(&dir).unwrap();
        let invalid = workspace
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == "config.globInvalid")
            .collect::<Vec<_>>();

        assert_eq!(invalid.len(), 1);
        assert_eq!(
            invalid[0].location,
            Some(DiagnosticLocation::Config {
                field: "taxonomies.topics.terms.guides.include[0]".to_string(),
            })
        );
        assert!(
            workspace
                .model
                .scan_plan()
                .taxonomy_term_patterns()
                .get("topics")
                .and_then(|terms| terms.get("guides"))
                .is_some_and(|patterns| patterns.patterns().is_empty())
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn workspace_symlink_root_is_scanned_but_internal_symlinks_are_not_followed() {
        use std::os::unix::fs::symlink;

        let dir = fixture_root("symlink");
        let actual = dir.join("actual");
        let link = dir.join("workspace");
        fs::create_dir_all(&actual).unwrap();
        write(
            &actual.join(".forma.md"),
            "---\nimports:\n  - '**/*.md'\n---\n",
        );
        write(&actual.join("inside.md"), "---\nkind: space\n---\n");
        let outside = dir.join("outside");
        write(&outside.join("escaped.md"), "---\nkind: space\n---\n");
        symlink(&outside, actual.join("linked")).unwrap();
        symlink(&actual, &link).unwrap();

        let plan = WorkspaceScanPlan::bootstrap(&link);
        let paths = plan
            .config_patterns()
            .matching_files_with_extensions(&["md"])
            .unwrap();
        assert!(paths.iter().any(|path| path.ends_with("inside.md")));
        assert!(!paths.iter().any(|path| path.ends_with("escaped.md")));
        fs::remove_dir_all(dir).unwrap();
    }
}
