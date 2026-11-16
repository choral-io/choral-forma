//! Deterministic, publication-safe Core input for a later static artifact writer.
//!
//! This module freezes logical routes and artifact paths, but it does not write
//! files, copy resource candidates, or rewrite rendered HTML URLs.

use std::cell::OnceCell;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::DisplayOptions;
use crate::diagnostics::{
    Diagnostic, DiagnosticLocation, DiagnosticSeverity, DiagnosticSummary, OperationStatus,
};
use crate::index::{IndexEntry, IndexEntryVariant};
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent, resolve_markdown_title};
use crate::operations::{
    OperationError, ReferenceEdge, WorkspaceSnapshot, document_id_for_path,
    normalized_relative_target, read_operation_diagnostics, reference_edge,
    reference_edge_sort_key, reference_edge_with_target, unique_references_by_target,
};
use crate::path::{FORMA_CONFIG_PATH, WorkspacePath};
use crate::render::{
    RenderedHeading, ViewRenderDocument, ViewRenderOutput, render_all_headings,
    render_indexed_view_from_loaded, render_markdown_source_html, slugify_heading,
};
use crate::routes::{
    BROWSE_ROUTE_PATH, HEALTH_ROUTE_PATH, RAW_ROUTE_PREFIX, ROUTE_STATIC_OUTPUT_CONFLICT_CODE,
    VIEWS_ROUTE_PATH, directory_paths, directory_route_path, entry_route_path,
    percent_encode_segment, public_view_id, raw_route_path, route_output_path, taxonomy_route_path,
    taxonomy_term_route_path, view_route_path,
};
use crate::{media_type_for_workspace_path, version};

/// Serialized contract version consumed by static artifact writers.
pub const STATIC_SITE_SNAPSHOT_SCHEMA_VERSION: u16 = 2;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteSnapshot {
    pub schema_version: u16,
    pub generator_version: String,
    pub status: OperationStatus,
    pub workspace: StaticSiteWorkspace,
    pub routes: Vec<StaticSiteRoute>,
    pub spaces: Vec<StaticSiteSpace>,
    pub taxonomies: Vec<StaticSiteTaxonomy>,
    pub entries: Vec<StaticSiteEntry>,
    pub views: Vec<StaticSiteView>,
    pub resources: Vec<StaticSiteResourceCandidate>,
    pub summary: StaticSiteSnapshotSummary,
    pub diagnostics: Vec<StaticSiteDiagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteWorkspace {
    pub name: String,
    pub canonical_language: String,
    pub supported_languages: Vec<String>,
    pub home: StaticSiteWorkspaceHome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<StaticSiteWorkspaceLogo>,
}

/// The Markdown body and reader metadata for the workspace root entry (`.forma.md`).
///
/// The root entry has no configured Space, but remains the stable source for
/// the workspace root route.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteWorkspaceHome {
    pub path: String,
    pub title: Option<String>,
    pub omit_leading_title: bool,
    pub markdown: String,
    pub html: String,
    pub headings: Vec<RenderedHeading>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteWorkspaceLogo {
    pub resource_path: String,
    pub public_path: String,
    pub alt: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StaticSiteRouteKind {
    Views,
    Taxonomies,
    Entry,
    View,
    Taxonomy,
    TaxonomyTerm,
    /// A directory of indexed source paths, listing its folders and pages.
    Directory,
    Health,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteRoute {
    pub kind: StaticSiteRouteKind,
    pub id: String,
    pub path: String,
    pub output_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteSpace {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub entry_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteTaxonomy {
    pub id: String,
    pub title: String,
    pub mode: String,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub route_path: String,
    pub terms: Vec<StaticSiteTaxonomyTerm>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteTaxonomyTerm {
    pub id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub route_path: String,
    pub entry_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteEntry {
    pub id: String,
    pub path: String,
    pub route_path: String,
    pub output_path: String,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub omit_leading_title: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub markdown: String,
    pub html: String,
    pub headings: Vec<RenderedHeading>,
    pub outgoing: Vec<ReferenceEdge>,
    pub backlinks: Vec<ReferenceEdge>,
    pub variants: Vec<StaticSiteEntryVariant>,
    pub status: OperationStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteEntryVariant {
    pub id: String,
    pub language: String,
    pub path: String,
    pub route_path: String,
    pub output_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub omit_leading_title: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub markdown: String,
    pub html: String,
    pub headings: Vec<RenderedHeading>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteView {
    pub id: String,
    pub source_path: String,
    pub route_path: String,
    pub output_path: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document: Option<ViewRenderDocument>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub headings: Vec<RenderedHeading>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projection: Option<ViewRenderOutput>,
    pub status: OperationStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteResourceCandidate {
    pub path: String,
    pub public_path: String,
    pub output_path: String,
    pub media_type: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub referenced_by: Vec<String>,
    #[serde(default)]
    pub workspace_presentation: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteDiagnostic {
    pub severity: DiagnosticSeverity,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub route_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<DiagnosticLocation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteSnapshotSummary {
    pub entries: usize,
    pub entry_variants: usize,
    pub views: usize,
    pub taxonomies: usize,
    pub taxonomy_terms: usize,
    pub routes: usize,
    pub resources: usize,
    pub diagnostics: DiagnosticSummary,
}

struct StaticHeadingTargets {
    headings: Vec<RenderedHeading>,
    omit_leading_title: bool,
    projection: OnceCell<Option<StaticHeadingProjection>>,
}

struct StaticHeadingProjection {
    markdown: String,
    html: String,
}

impl StaticHeadingTargets {
    fn new(document: &FormaMarkdownDocument, omit_leading_title: bool) -> Self {
        Self {
            headings: render_all_headings(document, omit_leading_title),
            omit_leading_title,
            projection: OnceCell::new(),
        }
    }

    fn render(&self, markdown: &str) -> String {
        if let Some(Some(projection)) = self.projection.get()
            && projection.markdown == markdown
        {
            return projection.html.clone();
        }
        render_static_markdown_html(markdown, &self.headings, self.omit_leading_title)
    }
}

/// Builds one static snapshot from the workspace's effective configuration and discovery.
pub fn build_static_site_snapshot(
    root: impl AsRef<Path>,
) -> Result<StaticSiteSnapshot, OperationError> {
    build_static_site_snapshot_with_root_path(root, "/")
}

/// Builds a static snapshot whose browser-facing Markdown, HTML, and resource
/// URLs are rooted beneath the deployment path.
pub fn build_static_site_snapshot_with_root_path(
    root: impl AsRef<Path>,
    root_path: &str,
) -> Result<StaticSiteSnapshot, OperationError> {
    if !valid_static_root_path(root_path) {
        return Err(OperationError::InvalidInput(
            "static site root path".to_string(),
        ));
    }
    let source = WorkspaceSnapshot::load(root)?;
    build_static_site_snapshot_from_loaded(&source, root_path)
}

fn build_static_site_snapshot_from_loaded(
    source: &WorkspaceSnapshot,
    root_path: &str,
) -> Result<StaticSiteSnapshot, OperationError> {
    let workspace = source.workspace();
    let discovery = source.discovery();
    let config_paths = workspace
        .config_sources
        .iter()
        .map(|source| source.path.as_str())
        .collect::<BTreeSet<_>>();
    let mut diagnostics = read_operation_diagnostics(discovery.diagnostics.clone());
    let mut resources = BTreeMap::<String, StaticSiteResourceCandidate>::new();
    let mut routes = support_routes();
    let mut entries = Vec::new();
    let mut backlinks_by_target = collect_backlinks_by_target(&discovery.index.entries);
    let entry_routes_by_path = discovery
        .index
        .entries
        .iter()
        .flat_map(|entry| {
            std::iter::once((entry.path.clone(), entry_route_path(&entry.path))).chain(
                entry
                    .variants
                    .iter()
                    .map(|variant| (variant.path.clone(), entry_route_path(&variant.path))),
            )
        })
        .collect::<BTreeMap<_, _>>();
    let omitted_titles = discovery
        .index
        .entries
        .iter()
        .flat_map(|entry| {
            std::iter::once((entry.path.clone(), entry.omit_leading_title)).chain(
                entry
                    .variants
                    .iter()
                    .map(|variant| (variant.path.clone(), variant.omit_leading_title)),
            )
        })
        .collect::<BTreeMap<_, _>>();
    let mut entry_headings_by_path = entry_routes_by_path
        .keys()
        .map(|path| {
            read_document(workspace.root.as_path(), path).map(|document| {
                (
                    path.clone(),
                    StaticHeadingTargets::new(
                        &document,
                        omitted_titles.get(path).copied().unwrap_or(false),
                    ),
                )
            })
        })
        .collect::<Result<BTreeMap<_, _>, _>>()?;
    let workspace_home_document = read_document(workspace.root.as_path(), FORMA_CONFIG_PATH)?;
    let (workspace_home_title, workspace_home_omit_leading_title) =
        resolve_markdown_title(None, &workspace_home_document);
    merge_diagnostics(
        &mut diagnostics,
        workspace_home_document
            .diagnostics
            .iter()
            .cloned()
            .map(|diagnostic| diagnostic.with_path(FORMA_CONFIG_PATH.to_string()))
            .collect(),
    );
    let workspace_home_targets =
        StaticHeadingTargets::new(&workspace_home_document, workspace_home_omit_leading_title);
    entry_headings_by_path.insert(FORMA_CONFIG_PATH.to_string(), workspace_home_targets);
    collect_document_resources(
        workspace.root.as_path(),
        &entry_routes_by_path,
        &mut resources,
        &config_paths,
        FORMA_CONFIG_PATH,
        "/",
        &workspace_home_document,
        root_path,
    );
    let workspace_home_markdown = static_markdown(
        workspace.root.as_path(),
        &workspace_home_document,
        FORMA_CONFIG_PATH,
        &entry_routes_by_path,
        &entry_headings_by_path,
        &config_paths,
        root_path,
    );
    let workspace_home_targets = &entry_headings_by_path[FORMA_CONFIG_PATH];
    let workspace_home_html = workspace_home_targets.render(&workspace_home_markdown);
    let workspace_home_headings = workspace_home_targets.headings.clone();

    for entry in &discovery.index.entries {
        let route_path = entry_route_path(&entry.path);
        let mut document_diagnostics = Vec::new();
        let document = read_document(workspace.root.as_path(), &entry.path)?;
        document_diagnostics.extend(
            document
                .diagnostics
                .iter()
                .cloned()
                .map(|diagnostic| diagnostic.with_path(entry.path.clone())),
        );
        merge_diagnostics(&mut diagnostics, document_diagnostics);
        collect_document_resources(
            workspace.root.as_path(),
            &entry_routes_by_path,
            &mut resources,
            &config_paths,
            &entry.path,
            &route_path,
            &document,
            root_path,
        );
        let markdown = static_markdown(
            workspace.root.as_path(),
            &document,
            &entry.path,
            &entry_routes_by_path,
            &entry_headings_by_path,
            &config_paths,
            root_path,
        );
        let targets = &entry_headings_by_path[&entry.path];
        let html = targets.render(&markdown);
        let headings = targets.headings.clone();

        let outgoing = unique_references_by_target(entry.refs.iter())
            .into_iter()
            .map(|reference| reference_edge(entry, reference, &discovery.index.entries))
            .collect::<Vec<_>>();
        let backlinks = backlinks_by_target.remove(&entry.path).unwrap_or_default();

        let mut variants = Vec::new();
        for variant in &entry.variants {
            let (rendered, variant_diagnostics) = render_variant(
                workspace.root.as_path(),
                &config_paths,
                &mut resources,
                variant,
                &entry_routes_by_path,
                &entry_headings_by_path,
                root_path,
            )?;
            merge_diagnostics(&mut diagnostics, variant_diagnostics);
            routes.push(route_for_entry(
                &rendered.id,
                &rendered.path,
                &rendered.route_path,
            ));
            variants.push(rendered);
        }
        variants.sort_by(|left, right| left.path.cmp(&right.path));

        let id = document_id_for_path(&entry.path);
        routes.push(route_for_entry(&id, &entry.path, &route_path));
        entries.push(StaticSiteEntry {
            id,
            path: entry.path.clone(),
            route_path: route_path.clone(),
            output_path: route_output_path(&route_path),
            space: entry.space.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            omit_leading_title: entry.omit_leading_title,
            summary: entry.summary.clone(),
            markdown,
            html,
            headings,
            outgoing,
            backlinks,
            variants,
            status: OperationStatus::Passed,
        });
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));

    let mut views = Vec::new();
    let mut view_source_routes = BTreeMap::new();
    for view in &discovery.index.views {
        let id = public_view_id(view);
        let route_path = view_route_path(&id);
        view_source_routes.insert(view.path.clone(), route_path.clone());
        let rendered = render_indexed_view_from_loaded(
            workspace,
            discovery,
            source.runtime(),
            &view.id,
            BTreeMap::new(),
        )?;
        let view_document = read_document(workspace.root.as_path(), &view.path)?;
        entry_headings_by_path.insert(
            view.path.clone(),
            StaticHeadingTargets::new(&view_document, true),
        );
        collect_document_resources(
            workspace.root.as_path(),
            &entry_routes_by_path,
            &mut resources,
            &config_paths,
            &view.path,
            &route_path,
            &view_document,
            root_path,
        );
        let view_markdown = static_markdown(
            workspace.root.as_path(),
            &view_document,
            &view.path,
            &entry_routes_by_path,
            &entry_headings_by_path,
            &config_paths,
            root_path,
        );
        let targets = &entry_headings_by_path[&view.path];
        let view_html = targets.render(&view_markdown);
        let view_headings = targets.headings.clone();
        merge_diagnostics(
            &mut diagnostics,
            read_operation_diagnostics(rendered.diagnostics),
        );
        routes.push(StaticSiteRoute {
            kind: StaticSiteRouteKind::View,
            id: id.clone(),
            path: route_path.clone(),
            output_path: route_output_path(&route_path),
        });
        views.push(StaticSiteView {
            id,
            source_path: view.path.clone(),
            route_path: route_path.clone(),
            output_path: route_output_path(&route_path),
            mode: view.mode.clone(),
            title: view.title.clone(),
            display: view.display.clone(),
            space: view.space.clone(),
            document: rendered.document,
            html: Some(view_html),
            headings: view_headings,
            projection: rendered.render,
            status: OperationStatus::Passed,
        });
    }
    views.sort_by(|left, right| left.route_path.cmp(&right.route_path));

    for route in directory_routes(&entries) {
        routes.push(route);
    }

    let (taxonomies, taxonomy_routes) = static_taxonomies(workspace, &discovery.index.entries);
    for route in taxonomy_routes {
        routes.push(route);
    }
    let spaces = static_spaces(workspace, &discovery.index.entries);

    if let Some(logo) = &workspace.config.workspace.logo
        && let Some(candidate) = resource_candidate(&logo.path, ".", true, &config_paths, root_path)
    {
        resources
            .entry(candidate.path.clone())
            .and_modify(|existing| existing.workspace_presentation = true)
            .or_insert(candidate);
    }

    routes.sort_by(|left, right| {
        left.path
            .cmp(&right.path)
            .then_with(|| left.kind.cmp(&right.kind))
            .then_with(|| left.id.cmp(&right.id))
    });
    // A static artifact writes every route as a file, so routes it cannot hold apart block it.
    for diagnostic in &mut diagnostics {
        if diagnostic.code == ROUTE_STATIC_OUTPUT_CONFLICT_CODE {
            diagnostic.severity = DiagnosticSeverity::Error;
        }
    }
    diagnostics.extend(identity_collision_diagnostics(&entries, &views));
    diagnostics.sort_by_key(diagnostic_sort_key);
    diagnostics.dedup();

    let entry_routes = entries
        .iter()
        .flat_map(|entry| {
            std::iter::once((entry.path.clone(), entry.route_path.clone())).chain(
                entry
                    .variants
                    .iter()
                    .map(|variant| (variant.path.clone(), variant.route_path.clone())),
            )
        })
        .collect::<BTreeMap<_, _>>();
    let static_diagnostics = diagnostics
        .into_iter()
        .map(|diagnostic| {
            static_diagnostic(
                diagnostic,
                &entry_routes,
                &view_source_routes,
                workspace.root.as_path(),
            )
        })
        .collect::<Vec<_>>();
    let diagnostic_values = static_diagnostics
        .iter()
        .map(|diagnostic| Diagnostic {
            severity: diagnostic.severity,
            code: diagnostic.code.clone(),
            message: diagnostic.message.clone(),
            path: diagnostic.path.clone(),
            location: diagnostic.location.clone(),
            actual: diagnostic.actual.clone(),
            expected: diagnostic.expected.clone(),
            instance_path: None,
            schema_path: None,
            keyword: None,
        })
        .collect::<Vec<_>>();
    let diagnostic_summary = DiagnosticSummary::from_diagnostics(&diagnostic_values);

    for entry in &mut entries {
        entry.status = status_for_route(&static_diagnostics, &entry.path, &entry.route_path);
    }
    for view in &mut views {
        view.status = status_for_route(&static_diagnostics, "", &view.route_path);
    }

    let resources = resources.into_values().collect::<Vec<_>>();
    let logo = workspace.config.workspace.logo.as_ref().and_then(|logo| {
        resources
            .iter()
            .find(|candidate| candidate.path == logo.path)
            .map(|candidate| StaticSiteWorkspaceLogo {
                resource_path: candidate.path.clone(),
                public_path: candidate.public_path.clone(),
                alt: logo
                    .alt
                    .clone()
                    .unwrap_or_else(|| workspace.config.workspace.name.clone()),
            })
    });
    let entry_variants = entries
        .iter()
        .map(|entry| entry.variants.len())
        .sum::<usize>();
    let taxonomy_terms = taxonomies
        .iter()
        .map(|taxonomy| taxonomy.terms.len())
        .sum::<usize>();
    let summary = StaticSiteSnapshotSummary {
        entries: entries.len(),
        entry_variants,
        views: views.len(),
        taxonomies: taxonomies.len(),
        taxonomy_terms,
        routes: routes.len(),
        resources: resources.len(),
        diagnostics: diagnostic_summary,
    };

    Ok(StaticSiteSnapshot {
        schema_version: STATIC_SITE_SNAPSHOT_SCHEMA_VERSION,
        generator_version: version().to_string(),
        status: diagnostic_summary.status(),
        workspace: StaticSiteWorkspace {
            name: workspace.config.workspace.name.clone(),
            canonical_language: workspace.config.workspace.canonical_language.clone(),
            supported_languages: workspace.config.workspace.supported_languages.clone(),
            home: StaticSiteWorkspaceHome {
                path: FORMA_CONFIG_PATH.to_string(),
                title: workspace_home_title,
                omit_leading_title: workspace_home_omit_leading_title,
                markdown: workspace_home_markdown,
                html: workspace_home_html,
                headings: workspace_home_headings,
            },
            logo,
        },
        routes,
        spaces,
        taxonomies,
        entries,
        views,
        resources,
        summary,
        diagnostics: static_diagnostics,
    })
}

fn collect_backlinks_by_target(entries: &[IndexEntry]) -> BTreeMap<String, Vec<ReferenceEdge>> {
    let entries_by_path = entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let mut backlinks = BTreeMap::<String, Vec<ReferenceEdge>>::new();

    for source in entries {
        for reference in unique_references_by_target(source.refs.iter()) {
            if reference.target_path == source.path {
                continue;
            }
            let Some(target) = entries_by_path.get(reference.target_path.as_str()) else {
                continue;
            };
            backlinks
                .entry(reference.target_path.clone())
                .or_default()
                .push(reference_edge_with_target(source, reference, Some(*target)));
        }
    }
    for edges in backlinks.values_mut() {
        edges.sort_by_key(reference_edge_sort_key);
    }
    backlinks
}

fn read_document(root: &Path, path: &str) -> Result<FormaMarkdownDocument, OperationError> {
    let source = fs::read_to_string(root.join(path)).map_err(|source| OperationError::Io {
        path: path.to_string(),
        source,
    })?;
    Ok(FormaMarkdownDocument::parse(&source))
}

fn render_variant(
    root: &Path,
    config_paths: &BTreeSet<&str>,
    resources: &mut BTreeMap<String, StaticSiteResourceCandidate>,
    variant: &IndexEntryVariant,
    entry_routes_by_path: &BTreeMap<String, String>,
    entry_headings_by_path: &BTreeMap<String, StaticHeadingTargets>,
    root_path: &str,
) -> Result<(StaticSiteEntryVariant, Vec<Diagnostic>), OperationError> {
    let document = read_document(root, &variant.path)?;
    let diagnostics = document
        .diagnostics
        .iter()
        .cloned()
        .map(|diagnostic| diagnostic.with_path(variant.path.clone()))
        .collect::<Vec<_>>();
    let route_path = entry_route_path(&variant.path);
    collect_document_resources(
        root,
        entry_routes_by_path,
        resources,
        config_paths,
        &variant.path,
        &route_path,
        &document,
        root_path,
    );
    let markdown = static_markdown(
        root,
        &document,
        &variant.path,
        entry_routes_by_path,
        entry_headings_by_path,
        config_paths,
        root_path,
    );
    let targets = &entry_headings_by_path[&variant.path];
    let html = targets.render(&markdown);
    let headings = targets.headings.clone();
    Ok((
        StaticSiteEntryVariant {
            id: document_id_for_path(&variant.path),
            language: variant.language.clone(),
            path: variant.path.clone(),
            route_path: route_path.clone(),
            output_path: route_output_path(&route_path),
            kind: variant.kind.clone(),
            title: variant.title.clone(),
            omit_leading_title: variant.omit_leading_title,
            summary: variant.summary.clone(),
            markdown,
            html,
            headings,
        },
        diagnostics,
    ))
}

fn static_spaces(
    workspace: &crate::FormaWorkspace,
    entries: &[IndexEntry],
) -> Vec<StaticSiteSpace> {
    let mut spaces = workspace
        .config
        .spaces
        .iter()
        .map(|(id, space)| {
            let mut entry_ids = entries
                .iter()
                .filter(|entry| entry.space == *id)
                .map(|entry| document_id_for_path(&entry.path))
                .collect::<Vec<_>>();
            entry_ids.sort();
            StaticSiteSpace {
                id: id.clone(),
                title: space.title.clone(),
                display: space.display.clone(),
                description: space.description.clone(),
                entry_ids,
            }
        })
        .collect::<Vec<_>>();
    spaces.sort_by(|left, right| {
        display_sort_key(&left.display, &left.title, &left.id).cmp(&display_sort_key(
            &right.display,
            &right.title,
            &right.id,
        ))
    });
    spaces
}

fn static_taxonomies(
    workspace: &crate::FormaWorkspace,
    entries: &[IndexEntry],
) -> (Vec<StaticSiteTaxonomy>, Vec<StaticSiteRoute>) {
    let mut routes = Vec::new();
    let mut taxonomies = workspace
        .config
        .taxonomies
        .iter()
        .map(|(taxonomy_id, value)| {
            let route_path = taxonomy_route_path(taxonomy_id);
            routes.push(StaticSiteRoute {
                kind: StaticSiteRouteKind::Taxonomy,
                id: taxonomy_id.clone(),
                path: route_path.clone(),
                output_path: route_output_path(&route_path),
            });
            let mut terms = workspace
                .config
                .terms
                .get(taxonomy_id)
                .into_iter()
                .flat_map(BTreeMap::iter)
                .map(|(term_id, term)| {
                    let term_route = taxonomy_term_route_path(taxonomy_id, term_id);
                    routes.push(StaticSiteRoute {
                        kind: StaticSiteRouteKind::TaxonomyTerm,
                        id: format!("{taxonomy_id}/{term_id}"),
                        path: term_route.clone(),
                        output_path: route_output_path(&term_route),
                    });
                    let mut entry_ids = entries
                        .iter()
                        .filter(|entry| {
                            entry
                                .taxonomies
                                .get(taxonomy_id)
                                .is_some_and(|terms| terms.contains(term_id))
                        })
                        .map(|entry| document_id_for_path(&entry.path))
                        .collect::<Vec<_>>();
                    entry_ids.sort();
                    StaticSiteTaxonomyTerm {
                        id: term_id.clone(),
                        title: term.title.clone(),
                        display: term.display.clone(),
                        description: term.description.clone(),
                        route_path: term_route,
                        entry_ids,
                    }
                })
                .collect::<Vec<_>>();
            terms.sort_by(|left, right| {
                display_sort_key(&left.display, &left.title, &left.id).cmp(&display_sort_key(
                    &right.display,
                    &right.title,
                    &right.id,
                ))
            });
            StaticSiteTaxonomy {
                id: taxonomy_id.clone(),
                title: value_string(value, "title").unwrap_or_else(|| taxonomy_id.clone()),
                mode: value_string(value, "mode").unwrap_or_else(|| "multiple".to_string()),
                display: value_display(value),
                description: value_string(value, "description"),
                route_path,
                terms,
            }
        })
        .collect::<Vec<_>>();
    taxonomies.sort_by(|left, right| {
        display_sort_key(&left.display, &left.title, &left.id).cmp(&display_sort_key(
            &right.display,
            &right.title,
            &right.id,
        ))
    });
    (taxonomies, routes)
}

/// One route per directory that holds an indexed page, at its workspace path, so a directory URL
/// is a real page on a static host. A directory served by a page of its own, such as its `index`
/// file or a same-named page beside it, keeps that page instead. The root directory is home.
fn directory_routes(entries: &[StaticSiteEntry]) -> Vec<StaticSiteRoute> {
    let page_routes = entries
        .iter()
        .flat_map(|entry| {
            std::iter::once(entry.route_path.as_str()).chain(
                entry
                    .variants
                    .iter()
                    .map(|variant| variant.route_path.as_str()),
            )
        })
        .collect::<BTreeSet<_>>();
    directory_paths(entries.iter().map(|entry| entry.path.as_str()))
        .into_iter()
        .filter_map(|directory| {
            let path = directory_route_path(&directory);
            (!page_routes.contains(path.as_str())).then(|| StaticSiteRoute {
                kind: StaticSiteRouteKind::Directory,
                output_path: route_output_path(&path),
                id: directory,
                path,
            })
        })
        .collect()
}

fn support_routes() -> Vec<StaticSiteRoute> {
    [
        (StaticSiteRouteKind::Views, "views", VIEWS_ROUTE_PATH),
        (StaticSiteRouteKind::Taxonomies, "browse", BROWSE_ROUTE_PATH),
        (StaticSiteRouteKind::Health, "health", HEALTH_ROUTE_PATH),
    ]
    .into_iter()
    .map(|(kind, id, path)| StaticSiteRoute {
        kind,
        id: id.to_string(),
        path: path.to_string(),
        output_path: route_output_path(path),
    })
    .collect()
}

fn route_for_entry(id: &str, _source_path: &str, route_path: &str) -> StaticSiteRoute {
    StaticSiteRoute {
        kind: StaticSiteRouteKind::Entry,
        id: id.to_string(),
        path: route_path.to_string(),
        output_path: route_output_path(route_path),
    }
}

fn static_markdown(
    root: &Path,
    document: &FormaMarkdownDocument,
    source_path: &str,
    entry_routes_by_path: &BTreeMap<String, String>,
    entry_headings_by_path: &BTreeMap<String, StaticHeadingTargets>,
    config_paths: &BTreeSet<&str>,
    root_path: &str,
) -> String {
    let mut output = document.body.clone();
    let mut replacements = document
        .references
        .iter()
        .filter_map(|reference| {
            let href = static_reference_href(
                root,
                reference,
                source_path,
                entry_routes_by_path,
                entry_headings_by_path,
                config_paths,
                root_path,
            );
            match reference.syntax {
                crate::markdown::FormaReferenceSyntax::Wikilink
                | crate::markdown::FormaReferenceSyntax::ObsidianEmbed => {
                    let span = reference.span?;
                    let href =
                        href.unwrap_or_else(|| unresolved_reference_fallback(&reference.target));
                    let label = markdown_label(
                        reference
                            .label
                            .as_deref()
                            .unwrap_or(reference.target.as_str()),
                    );
                    let prefix = if matches!(
                        reference.syntax,
                        crate::markdown::FormaReferenceSyntax::ObsidianEmbed
                    ) && href.contains(&format!("{RAW_ROUTE_PREFIX}/"))
                    {
                        "!"
                    } else {
                        ""
                    };
                    Some((
                        span.start_byte,
                        span.end_byte,
                        format!("{prefix}[{label}](<{href}>)"),
                    ))
                }
                crate::markdown::FormaReferenceSyntax::MarkdownLink
                | crate::markdown::FormaReferenceSyntax::MarkdownImage => {
                    let span = reference.target_span.or(reference.fragment_span)?;
                    let start = reference
                        .target_span
                        .map_or(span.start_byte, |target| target.start_byte);
                    let end = reference
                        .fragment_span
                        .map_or(span.end_byte, |fragment| fragment.end_byte);
                    href.map(|href| (start, end, href))
                }
                crate::markdown::FormaReferenceSyntax::FormaCommentDirective => None,
            }
        })
        .collect::<Vec<_>>();
    replacements.sort_by_key(|(start, end, _)| (*start, *end));
    replacements.dedup_by(|left, right| left.0 == right.0 && left.1 == right.1);

    for (start, end, replacement) in replacements.into_iter().rev() {
        if start <= end && end <= output.len() {
            output.replace_range(start..end, &replacement);
        }
    }
    output
}

fn static_reference_href(
    root: &Path,
    reference: &crate::markdown::FormaReference,
    source_path: &str,
    entry_routes_by_path: &BTreeMap<String, String>,
    entry_headings_by_path: &BTreeMap<String, StaticHeadingTargets>,
    config_paths: &BTreeSet<&str>,
    root_path: &str,
) -> Option<String> {
    let target = reference.target.trim();
    if target.is_empty()
        || target
            .chars()
            .any(|character| character.is_control() || character == '>')
    {
        return None;
    }
    let markdown_uri = matches!(
        reference.syntax,
        crate::markdown::FormaReferenceSyntax::MarkdownLink
            | crate::markdown::FormaReferenceSyntax::MarkdownImage
    );
    let resolve_fragment = |fragment: &str, path: &str| {
        resolve_heading_fragment(fragment, entry_headings_by_path.get(path), |targets| {
            let document = read_document(root, path).ok()?;
            // Route rewrites affect the labels of wiki links inside headings. Render
            // the same labels without consulting target heading metadata recursively.
            let markdown = static_markdown(
                root,
                &document,
                path,
                entry_routes_by_path,
                &BTreeMap::new(),
                config_paths,
                root_path,
            );
            let html = targets.render(&markdown);
            Some(StaticHeadingProjection { markdown, html })
        })
    };
    if let Some(fragment) = target.strip_prefix('#') {
        let fragment = if markdown_uri {
            crate::routes::decode_public_path_once(fragment)
        } else {
            fragment.to_string()
        };
        return resolve_fragment(&fragment, source_path).map(|fragment| format!("#{fragment}"));
    }
    if is_external_target(target) {
        return None;
    }
    let (without_fragment, fragment) = target.split_once('#').unwrap_or((target, ""));
    let (path, query) = without_fragment
        .split_once('?')
        .map_or((without_fragment, ""), |(path, query)| (path, query));
    let heading_fragment = if markdown_uri {
        crate::routes::decode_public_path_once(fragment)
    } else {
        fragment.to_string()
    };
    let path = if markdown_uri {
        crate::routes::decode_public_path_once(path)
    } else {
        path.to_string()
    };
    let normalized = normalized_static_target(source_path, &path)?;

    let resolved_entry = entry_routes_by_path.get_key_value(&normalized).or_else(|| {
        let workspace_style_target = path.trim_start_matches('/');
        (workspace_style_target != normalized)
            .then(|| entry_routes_by_path.get_key_value(workspace_style_target))
            .flatten()
    });
    if let Some((target_path, route)) = resolved_entry {
        let mut href = public_url(root_path, route);
        if let Some(fragment) = resolve_fragment(&heading_fragment, target_path) {
            href.push('#');
            href.push_str(&fragment);
        }
        return Some(href);
    }

    let allow_suffix = !path.starts_with('/');
    let alias =
        resolve_entry_route(&normalized, entry_routes_by_path, allow_suffix).or_else(|| {
            let workspace_style_target = path.trim_start_matches('/');
            (workspace_style_target != normalized)
                .then(|| {
                    resolve_entry_route(workspace_style_target, entry_routes_by_path, allow_suffix)
                })
                .flatten()
        });
    // A real resource wins a collision; a missing raw file must not steal an
    // existing extensionless sidecar alias. Keep missing-resource behavior when
    // no entry alias exists so normal resource diagnostics remain available.
    if let Some(candidate) = resource_candidate(&normalized, ".", false, config_paths, root_path)
        && (alias.is_none() || root.join(&normalized).is_file())
    {
        let mut href = candidate.public_path;
        if !query.is_empty() {
            href.push('?');
            href.push_str(&encode_url_suffix(query, markdown_uri));
        }
        if !fragment.is_empty() {
            href.push('#');
            href.push_str(&encode_url_suffix(fragment, markdown_uri));
        }
        return Some(href);
    }

    let (target_path, route) = alias?;
    let mut href = public_url(root_path, route);
    if let Some(fragment) = resolve_fragment(&heading_fragment, target_path) {
        href.push('#');
        href.push_str(&fragment);
    }
    Some(href)
}

fn normalized_static_target(source_path: &str, target: &str) -> Option<String> {
    let workspace_absolute = target.starts_with('/');
    let target = target.trim_start_matches('/');
    if target.is_empty() {
        return Some(source_path.to_string());
    }
    if workspace_absolute {
        return WorkspacePath::parse_config(target)
            .ok()
            .map(|path| path.as_str().to_string());
    }
    normalized_relative_target(source_path, target).or_else(|| {
        WorkspacePath::parse_config(target)
            .ok()
            .map(|path| path.as_str().to_string())
    })
}

fn resolve_entry_route<'a>(
    normalized: &str,
    entry_routes_by_path: &'a BTreeMap<String, String>,
    allow_suffix: bool,
) -> Option<(&'a String, &'a String)> {
    for candidate in [
        normalized.to_string(),
        format!("{normalized}.md"),
        format!("{normalized}.mdx"),
        format!("{normalized}/index.md"),
        format!("{normalized}/index.mdx"),
    ] {
        if let Some((path, route)) = entry_routes_by_path.get_key_value(&candidate) {
            return Some((path, route));
        }
    }

    if !allow_suffix {
        return None;
    }

    let suffixes = [
        format!("/{normalized}"),
        format!("/{normalized}.md"),
        format!("/{normalized}.mdx"),
    ];
    let matches = entry_routes_by_path
        .iter()
        .filter(|(path, _)| suffixes.iter().any(|suffix| path.ends_with(suffix)))
        .collect::<Vec<_>>();
    (matches.len() == 1).then(|| matches[0])
}

fn resolve_heading_fragment(
    fragment: &str,
    targets: Option<&StaticHeadingTargets>,
    project: impl FnOnce(&StaticHeadingTargets) -> Option<StaticHeadingProjection>,
) -> Option<String> {
    if fragment.is_empty() {
        return None;
    }
    let normalized = fragment.trim();
    // Slug guesses are for historical ASCII IDs. Dropping all or part of a
    // Unicode name can turn an unknown heading into an unrelated target.
    let legacy_id = (!has_generated_fragment_prefix(fragment)
        && normalized.is_ascii()
        && normalized.bytes().any(|byte| byte.is_ascii_alphanumeric()))
    .then(|| slugify_heading(normalized));
    if let Some(targets) = targets
        && let Some((index, heading)) = targets
            .headings
            .iter()
            .enumerate()
            .find(|(_, heading)| heading.id == fragment)
            .or_else(|| {
                targets
                    .headings
                    .iter()
                    .enumerate()
                    .find(|(_, heading)| heading.text.trim().eq_ignore_ascii_case(normalized))
            })
            .or_else(|| {
                if normalized.is_ascii() {
                    return None;
                }
                // Accept hyphenated titles without discarding any Unicode text.
                let hyphenated = hyphenate_heading_text(normalized);
                targets.headings.iter().enumerate().find(|(_, heading)| {
                    hyphenate_heading_text(&heading.text).eq_ignore_ascii_case(&hyphenated)
                })
            })
            .or_else(|| {
                let id = legacy_id.as_deref()?;
                targets
                    .headings
                    .iter()
                    .enumerate()
                    .find(|(_, heading)| heading.id == id)
            })
    {
        let might_omit_title = index == 0 && heading.level == 1 && targets.omit_leading_title;
        // Real IDs keep precedence over literal titles that look like readable aliases
        // or footnotes. The rendered title also determines whether its historical ID exists.
        if (might_omit_title || has_generated_fragment_prefix(fragment))
            && let Some(projection) = targets.projection.get_or_init(|| project(targets))
        {
            if has_static_anchor(&projection.html, fragment) {
                return Some(percent_encode_segment(fragment));
            }
            if might_omit_title && let Some(id) = leading_heading_anchor(&projection.html) {
                return Some(percent_encode_segment(id));
            }
        }
        return Some(heading.id.clone());
    }
    Some(legacy_id.unwrap_or_else(|| percent_encode_segment(fragment)))
}

fn hyphenate_heading_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join("-")
}

fn has_generated_fragment_prefix(fragment: &str) -> bool {
    fragment.starts_with("forma-heading-")
        || fragment.starts_with("user-content-fn")
        || fragment
            .strip_prefix("forma-omitted-title")
            .is_some_and(|suffix| suffix.bytes().all(|byte| byte == b'-'))
}

fn has_static_anchor(html: &str, id: &str) -> bool {
    let attribute = format!(" id=\"{id}\"");
    html.split('<')
        .skip(1)
        .filter_map(|element| element.split_once('>'))
        .any(|(tag, _)| tag.contains(&attribute))
}

fn leading_heading_anchor(html: &str) -> Option<&str> {
    let (id, attributes) = html.strip_prefix("<span id=\"")?.split_once('"')?;
    attributes
        .starts_with(" data-forma-heading-anchor=\"\"")
        .then_some(id)
}

fn markdown_label(value: &str) -> String {
    value.replace('\\', "\\\\").replace(']', "\\]")
}

fn unresolved_reference_fallback(target: &str) -> String {
    if is_external_target(target) {
        return target.to_string();
    }
    let (path, fragment) = target.split_once('#').unwrap_or((target, ""));
    let mut path = path.trim_start_matches('/').to_string();
    if !path.ends_with(".md") && !path.ends_with(".mdx") {
        path.push_str(".md");
    }
    match resolve_heading_fragment(fragment, None, |_| None) {
        Some(fragment) => format!("./{path}#{fragment}"),
        None => format!("./{path}"),
    }
}

fn is_external_target(target: &str) -> bool {
    target.starts_with("//")
        || target.split_once(':').is_some_and(|(scheme, _)| {
            !scheme.is_empty()
                && scheme.bytes().enumerate().all(|(index, byte)| {
                    if index == 0 {
                        byte.is_ascii_alphabetic()
                    } else {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'-' | b'.')
                    }
                })
        })
}

fn encode_url_suffix(value: &str, markdown_uri: bool) -> String {
    let bytes = value.as_bytes();
    let mut encoded = String::new();
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        // Markdown destinations are already URIs: decoding here would turn an
        // encoded `&` into a new query parameter, while encoding `%` again loses
        // the original value. Wiki suffixes remain literal text.
        if markdown_uri
            && byte == b'%'
            && bytes.get(index + 1).is_some_and(u8::is_ascii_hexdigit)
            && bytes.get(index + 2).is_some_and(u8::is_ascii_hexdigit)
        {
            encoded.push_str(&value[index..index + 3]);
            index += 3;
            continue;
        }
        if byte.is_ascii_alphanumeric()
            || matches!(byte, b'-' | b'.' | b'_' | b'~' | b'=' | b'&')
            || (markdown_uri && b":/?@!$'*+,;".contains(&byte))
        {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
        index += 1;
    }
    encoded
}

fn public_url(root_path: &str, logical_path: &str) -> String {
    if root_path == "/" {
        logical_path.to_string()
    } else {
        format!("{root_path}{logical_path}")
    }
}

fn valid_static_root_path(root_path: &str) -> bool {
    if root_path == "/" {
        return true;
    }
    if !root_path.starts_with('/')
        || root_path.ends_with('/')
        || root_path.starts_with("//")
        || root_path.contains("//")
    {
        return false;
    }
    root_path.split('/').skip(1).all(|segment| {
        !segment.is_empty()
            && segment != "."
            && segment != ".."
            && segment.bytes().all(|byte| {
                byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~')
            })
    })
}

fn render_static_markdown_html(
    markdown: &str,
    headings: &[RenderedHeading],
    omit_leading_title: bool,
) -> String {
    let mut html = render_markdown_source_html(markdown);
    let leading_title = html
        .strip_prefix("<h1>")
        .and_then(|rest| rest.split_once("</h1>"));
    // A duplicate title can be hidden, but its annotation calls cannot disappear.
    let omit_leading_title = omit_leading_title
        && leading_title.is_some_and(|(title, _)| !title.contains("data-footnote-ref="));
    if omit_leading_title && let Some((title_html, rest)) = leading_title {
        let mut alias = title_html
            .find("</span>")
            .map(|end| &title_html[..end + "</span>".len()])
            .unwrap_or("")
            .to_string();
        if let Some((title, body)) = headings.split_first()
            && title.level == 1
            && let Some(id) = leading_heading_anchor(&alias)
            && body.iter().any(|heading| heading.id == id)
        {
            // Preserve both the historical IDs and the readable aliases of the body.
            let taken = |id: &str| {
                body.iter().any(|heading| heading.id == id) || has_static_anchor(&html, id)
            };
            let mut anchor = title.id.clone();
            if taken(&anchor) {
                anchor = "forma-omitted-title".to_string();
                while taken(&anchor) {
                    anchor.push('-');
                }
            }
            alias.replace_range("<span id=\"".len().."<span id=\"".len() + id.len(), &anchor);
        }
        html = format!("{alias}{}", rest.strip_prefix('\n').unwrap_or(rest));
    }

    let rendered_headings = headings
        .iter()
        .enumerate()
        .filter(|(index, heading)| !(omit_leading_title && *index == 0 && heading.level == 1))
        .map(|(_, heading)| heading)
        .collect::<Vec<_>>();
    html = avoid_footnote_heading_collisions(html, &rendered_headings);
    let mut output = String::with_capacity(html.len() + headings.len() * 24);
    let mut cursor = 0;
    let mut heading_index = 0;
    while let Some(relative) = html[cursor..].find("<h") {
        let start = cursor + relative;
        output.push_str(&html[cursor..start]);
        let tag = html.as_bytes().get(start + 2).copied();
        let opening = html.as_bytes().get(start + 3).copied();
        if matches!(tag, Some(b'1'..=b'6'))
            && opening == Some(b'>')
            && let Some(heading) = rendered_headings.get(heading_index)
        {
            output.push_str(&format!(
                "<h{} id=\"{}\">",
                char::from(tag.unwrap_or_default()),
                heading.id
            ));
            heading_index += 1;
            cursor = start + 4;
            continue;
        }
        output.push_str("<h");
        cursor = start + 2;
    }
    output.push_str(&html[cursor..]);
    // Existing published heading IDs own their targets, including names in the
    // readable-anchor namespace. Do not leave duplicate alias IDs behind.
    for heading in &rendered_headings {
        output = output.replace(
            &format!(
                "<span id=\"{}\" data-forma-heading-anchor=\"\" tabindex=\"-1\"></span>",
                heading.id
            ),
            "",
        );
    }
    if output.matches("id=\"footnote-label\"").count() > 1 {
        let mut label = "footnote-label-2".to_string();
        while output.contains(&format!("id=\"{label}\"")) {
            label.push('-');
        }
        output = output
            .replace(
                "<h2 id=\"footnote-label\" class=\"sr-only\">",
                &format!("<h2 id=\"{label}\" class=\"sr-only\">"),
            )
            .replace(
                "aria-describedby=\"footnote-label\"",
                &format!("aria-describedby=\"{label}\""),
            );
    }
    output
}

fn avoid_footnote_heading_collisions(mut html: String, headings: &[&RenderedHeading]) -> String {
    let mut assigned = BTreeSet::new();
    let mut remapped = BTreeMap::new();
    for heading in headings {
        let id = heading.id.as_str();
        if !id.starts_with("user-content-fn") || !has_static_anchor(&html, id) {
            continue;
        }
        let legacy_alias =
            format!("<span id=\"{id}\" tabindex=\"-1\" aria-label=\"Footnote reference\"></span>");
        if html.contains(&legacy_alias) {
            html = html.replace(&legacy_alias, "");
            continue;
        }
        let mut target = format!("{id}-");
        while has_static_anchor(&html, &target)
            || headings.iter().any(|heading| heading.id == target)
            || assigned.contains(&target)
        {
            target.push('-');
        }
        assigned.insert(target.clone());
        remapped.insert(id, target);
    }
    if remapped.is_empty() {
        return html;
    }

    // Only retarget the parser-generated footnote links. An authored link to
    // the original ID still points at the heading that owns it.
    let mut output = String::with_capacity(html.len());
    for part in html.split_inclusive('>') {
        let Some((text, tag)) = part.rsplit_once('<') else {
            output.push_str(part);
            continue;
        };
        output.push_str(text);
        output.push('<');
        let reference = tag.starts_with("a ") && tag.contains(" data-footnote-ref=");
        let backref = tag.starts_with("a ") && tag.contains(" data-footnote-backref=");
        let note = tag.starts_with("li id=\"user-content-fn-");
        if !(reference || backref || note) {
            output.push_str(tag);
            continue;
        }
        let mut tag = tag.to_string();
        if reference || note {
            rewrite_footnote_attribute(&mut tag, " id=\"", &remapped);
        }
        if reference || backref {
            rewrite_footnote_attribute(&mut tag, " href=\"#", &remapped);
        }
        output.push_str(&tag);
    }
    output
}

fn rewrite_footnote_attribute(tag: &mut String, prefix: &str, remapped: &BTreeMap<&str, String>) {
    if let Some(start) = tag.find(prefix).map(|index| index + prefix.len())
        && let Some(end) = tag[start..].find('"').map(|index| start + index)
        && let Some(target) = remapped.get(&tag[start..end])
    {
        tag.replace_range(start..end, target);
    }
}

fn collect_document_resources(
    root: &Path,
    entry_routes_by_path: &BTreeMap<String, String>,
    resources: &mut BTreeMap<String, StaticSiteResourceCandidate>,
    config_paths: &BTreeSet<&str>,
    source_path: &str,
    source_route: &str,
    document: &FormaMarkdownDocument,
    root_path: &str,
) {
    for reference in &document.references {
        if !matches!(
            reference.intent,
            FormaReferenceIntent::Link | FormaReferenceIntent::Embed
        ) {
            continue;
        }
        let Some(path) = normalized_resource_path(source_path, reference) else {
            continue;
        };
        let Some(candidate) =
            resource_candidate(&path, source_route, false, config_paths, root_path)
        else {
            continue;
        };
        // Collect only destinations the link resolver actually publishes as raw
        // resources. Entry aliases must not leave phantom files in the export.
        let href = static_reference_href(
            root,
            reference,
            source_path,
            entry_routes_by_path,
            &BTreeMap::new(),
            config_paths,
            root_path,
        );
        if href
            .as_deref()
            .and_then(|href| href.split(['?', '#']).next())
            != Some(candidate.public_path.as_str())
        {
            continue;
        }
        resources
            .entry(candidate.path.clone())
            .and_modify(|existing| {
                if !existing.referenced_by.contains(&source_route.to_string()) {
                    existing.referenced_by.push(source_route.to_string());
                    existing.referenced_by.sort();
                }
            })
            .or_insert(candidate);
    }
}

fn normalized_resource_path(
    source_path: &str,
    reference: &crate::markdown::FormaReference,
) -> Option<String> {
    let target = reference.target.trim();
    if target.is_empty()
        || target.starts_with('~')
        || target.starts_with('#')
        || target.starts_with("//")
        || is_external_target(target)
    {
        return None;
    }
    let end = target.find(['?', '#']).unwrap_or(target.len());
    let target = &target[..end];
    let target = if matches!(
        reference.syntax,
        crate::markdown::FormaReferenceSyntax::MarkdownLink
            | crate::markdown::FormaReferenceSyntax::MarkdownImage
    ) {
        crate::routes::decode_public_path_once(target)
    } else {
        target.to_string()
    };
    let normalized = normalized_static_target(source_path, &target)?;
    WorkspacePath::parse_config(&normalized)
        .ok()
        .map(|path| path.as_str().to_string())
}

fn resource_candidate(
    path: &str,
    source_route: &str,
    workspace_presentation: bool,
    config_paths: &BTreeSet<&str>,
    root_path: &str,
) -> Option<StaticSiteResourceCandidate> {
    if !resource_path_is_publishable(path, config_paths) {
        return None;
    }
    let media_type = media_type_for_workspace_path(path)?;
    if matches!(
        media_type,
        "text/markdown" | "application/yaml" | "application/json"
    ) {
        return None;
    }
    Some(StaticSiteResourceCandidate {
        path: path.to_string(),
        public_path: public_url(root_path, &raw_route_path(path)),
        output_path: format!("{}/{path}", RAW_ROUTE_PREFIX.trim_start_matches('/')),
        media_type: media_type.to_string(),
        referenced_by: if workspace_presentation {
            Vec::new()
        } else {
            vec![source_route.to_string()]
        },
        workspace_presentation,
    })
}

fn resource_path_is_publishable(path: &str, config_paths: &BTreeSet<&str>) -> bool {
    if config_paths.contains(path) {
        return false;
    }
    let blocked_roots = [
        ".forma",
        ".agents",
        ".git",
        ".worktrees",
        "node_modules",
        "target",
    ];
    let components = path.split('/').collect::<Vec<_>>();
    let Some(root) = components.first() else {
        return false;
    };
    if components
        .iter()
        .any(|component| component.is_empty() || component.starts_with('.'))
    {
        return false;
    }
    !blocked_roots
        .iter()
        .any(|blocked| root.eq_ignore_ascii_case(blocked))
}

fn identity_collision_diagnostics(
    entries: &[StaticSiteEntry],
    views: &[StaticSiteView],
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let mut entry_ids = BTreeMap::<String, String>::new();
    for entry in entries {
        for (id, path) in std::iter::once((&entry.id, &entry.path)).chain(
            entry
                .variants
                .iter()
                .map(|variant| (&variant.id, &variant.path)),
        ) {
            if let Some(existing) = entry_ids.insert(id.to_ascii_lowercase(), path.clone()) {
                diagnostics.push(
                    Diagnostic::error(
                        "site.entryIdentityCollision",
                        "Static entries resolve to the same data identity.",
                    )
                    .with_path(path.clone())
                    .with_actual(format!("{existing} and {path}"))
                    .with_expected("unique stable entry identities"),
                )
            }
        }
    }
    let mut view_ids = BTreeSet::new();
    for view in views {
        if !view_ids.insert(view.id.to_ascii_lowercase()) {
            diagnostics.push(
                Diagnostic::error(
                    "site.viewIdentityCollision",
                    "Static Views resolve to the same public identity.",
                )
                .with_actual(view.id.clone())
                .with_expected("unique stable View identities"),
            );
        }
    }
    diagnostics
}

fn merge_diagnostics(target: &mut Vec<Diagnostic>, additions: Vec<Diagnostic>) {
    for diagnostic in additions {
        if !target.contains(&diagnostic) {
            target.push(diagnostic);
        }
    }
}

fn diagnostic_sort_key(diagnostic: &Diagnostic) -> (String, String, String, u8) {
    let severity = match diagnostic.severity {
        DiagnosticSeverity::Error => 0,
        DiagnosticSeverity::Warning => 1,
        DiagnosticSeverity::Info => 2,
    };
    (
        diagnostic.path.clone().unwrap_or_default(),
        diagnostic.code.clone(),
        diagnostic.message.clone(),
        severity,
    )
}

fn static_diagnostic(
    diagnostic: Diagnostic,
    entry_routes: &BTreeMap<String, String>,
    view_routes: &BTreeMap<String, String>,
    root: &Path,
) -> StaticSiteDiagnostic {
    let entry_route = diagnostic
        .path
        .as_ref()
        .and_then(|path| entry_routes.get(path))
        .cloned();
    let view_route = diagnostic
        .path
        .as_ref()
        .and_then(|path| view_routes.get(path))
        .cloned();
    let is_entry = entry_route.is_some();
    let route_path = entry_route.or(view_route);
    let path = is_entry.then(|| diagnostic.path.clone()).flatten();
    let keep_details = is_entry || route_path.is_some();
    StaticSiteDiagnostic {
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
        path,
        route_path,
        location: diagnostic.location,
        actual: keep_details
            .then(|| safe_diagnostic_detail(diagnostic.actual, root))
            .flatten(),
        expected: keep_details
            .then(|| safe_diagnostic_detail(diagnostic.expected, root))
            .flatten(),
    }
}

fn safe_diagnostic_detail(value: Option<String>, root: &Path) -> Option<String> {
    let value = value?;
    let root = root.to_string_lossy();
    if value.contains(root.as_ref()) || PathBuf::from(&value).is_absolute() {
        None
    } else {
        Some(value)
    }
}

fn status_for_route(
    diagnostics: &[StaticSiteDiagnostic],
    path: &str,
    route_path: &str,
) -> OperationStatus {
    let diagnostics = diagnostics
        .iter()
        .filter(|diagnostic| {
            diagnostic.path.as_deref() == Some(path)
                || diagnostic.route_path.as_deref() == Some(route_path)
        })
        .map(|diagnostic| Diagnostic {
            severity: diagnostic.severity,
            code: diagnostic.code.clone(),
            message: diagnostic.message.clone(),
            path: diagnostic.path.clone(),
            location: diagnostic.location.clone(),
            actual: diagnostic.actual.clone(),
            expected: diagnostic.expected.clone(),
            instance_path: None,
            schema_path: None,
            keyword: None,
        })
        .collect::<Vec<_>>();
    DiagnosticSummary::from_diagnostics(&diagnostics).status()
}

fn value_string(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(ToOwned::to_owned)
}

fn value_display(value: &Value) -> DisplayOptions {
    value
        .get("display")
        .cloned()
        .and_then(|value| serde_yml::from_value(value).ok())
        .unwrap_or_default()
}

fn display_sort_key(
    display: &DisplayOptions,
    title: &str,
    id: &str,
) -> (bool, i64, String, String) {
    (
        display.order.is_none(),
        display.order.unwrap_or(0),
        title.to_string(),
        id.to_string(),
    )
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        StaticSiteRouteKind, build_static_site_snapshot, build_static_site_snapshot_with_root_path,
        collect_backlinks_by_target,
    };
    use crate::{
        DiagnosticSeverity, OperationStatus, ReferenceIntent, ReferenceSource, ViewRenderOutput,
        WorkspaceSnapshot, check_workspace,
    };

    #[test]
    fn site_snapshot_fixture_is_deterministic_and_preserves_contract() {
        let root = copy_fixture("site-snapshot-contract");
        let first = build_static_site_snapshot(&root).unwrap();
        let second = build_static_site_snapshot(&root).unwrap();
        let first_json = serde_json::to_string_pretty(&first).unwrap();
        let second_json = serde_json::to_string_pretty(&second).unwrap();

        assert_eq!(first_json, second_json);
        assert_eq!(
            first.schema_version,
            super::STATIC_SITE_SNAPSHOT_SCHEMA_VERSION
        );
        assert_eq!(first.status, OperationStatus::Warning);
        assert_eq!(first.workspace.home.path, ".forma.md");
        assert!(!first.workspace.home.markdown.trim().is_empty());
        assert!(!first.workspace.home.html.trim().is_empty());
        assert!(!first.workspace.home.html.contains("<h1"));
        assert_eq!(first.summary.entries, 3);
        assert_eq!(first.summary.views, 2);
        assert_eq!(first.summary.resources, 1);
        assert_eq!(first.summary.taxonomies, 1);
        assert_eq!(first.summary.taxonomy_terms, 2);
        assert_eq!(
            first
                .entries
                .iter()
                .map(|entry| entry.path.as_str())
                .collect::<Vec<_>>(),
            vec![
                "content/guides/intro.md",
                "content/guides/related.md",
                "local/private-draft.md",
            ]
        );
        assert!(first.routes.iter().any(|route| {
            route.kind == StaticSiteRouteKind::Entry
                && route.path == "/content/guides/intro"
                && route.output_path == "content/guides/intro/index.html"
        }));
        assert!(first.routes.iter().any(|route| {
            route.kind == StaticSiteRouteKind::View
                && route.path == "/-/views/guide-table"
                && route.output_path == "-/views/guide-table/index.html"
        }));
        for (kind, path, output_path) in [
            (StaticSiteRouteKind::Views, "/-/views", "-/views/index.html"),
            (
                StaticSiteRouteKind::Health,
                "/-/health",
                "-/health/index.html",
            ),
            (
                StaticSiteRouteKind::Taxonomies,
                "/-/browse",
                "-/browse/index.html",
            ),
            (
                StaticSiteRouteKind::Taxonomy,
                "/-/browse/spaces",
                "-/browse/spaces/index.html",
            ),
            (
                StaticSiteRouteKind::TaxonomyTerm,
                "/-/browse/spaces/guides",
                "-/browse/spaces/guides/index.html",
            ),
        ] {
            assert!(first.routes.iter().any(|route| {
                route.kind == kind && route.path == path && route.output_path == output_path
            }));
        }
        assert!(!first_json.contains(root.to_string_lossy().as_ref()));
        assert!(first_json.contains("LOCAL_NAMED_DIRECTORY_SENTINEL"));
        assert!(!first_json.contains("runtime"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_does_not_depend_on_workspace_home_mtime() {
        let root = copy_fixture("site-snapshot-contract");
        let first = build_static_site_snapshot(&root).unwrap();
        let home_path = root.join(".forma.md");
        let source = fs::read_to_string(&home_path).unwrap();
        fs::write(&home_path, source).unwrap();
        let second = build_static_site_snapshot(&root).unwrap();

        assert_eq!(
            serde_json::to_string_pretty(&first).unwrap(),
            serde_json::to_string_pretty(&second).unwrap()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_fixture_exports_references_views_and_resources() {
        let root = copy_fixture("site-snapshot-content");
        fs::create_dir_all(root.join("content/guides/local")).unwrap();
        fs::write(
            root.join("content/guides/local/diagram.png"),
            b"LOCAL_NAMED_RESOURCE_SENTINEL",
        )
        .unwrap();
        let intro_path = root.join("content/guides/intro.md");
        let mut intro_source = fs::read_to_string(&intro_path).unwrap();
        intro_source.push_str("\n![Local named resource](local/diagram.png)\n");
        fs::write(&intro_path, intro_source).unwrap();

        let snapshot = build_static_site_snapshot(&root).unwrap();
        let snapshot_json = serde_json::to_string(&snapshot).unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        let related = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/related.md")
            .unwrap();

        assert!(
            intro
                .markdown
                .contains("[Related](/content/guides/related)")
        );
        assert!(intro.html.contains(r#"<h2 id="overview"><span id="forma-heading-overview" data-forma-heading-anchor="" tabindex="-1"></span>Overview</h2>"#));
        assert_eq!(intro.headings[1].id, "overview");
        assert_eq!(intro.outgoing.len(), 1);
        assert_eq!(intro.outgoing[0].target_path, "content/guides/related.md");
        assert_eq!(intro.outgoing[0].intent, ReferenceIntent::Link);
        assert_eq!(intro.outgoing[0].source, ReferenceSource::Body);
        assert_eq!(related.backlinks.len(), 1);
        assert_eq!(related.backlinks[0].source_path, "content/guides/intro.md");

        let resource = snapshot
            .resources
            .iter()
            .find(|resource| resource.path == "assets/diagram.svg")
            .unwrap();
        assert_eq!(resource.public_path, "/-/raw/assets/diagram.svg");
        assert_eq!(resource.referenced_by, vec!["/content/guides/intro"]);
        let local_named_resource = snapshot
            .resources
            .iter()
            .find(|resource| resource.path == "content/guides/local/diagram.png")
            .unwrap();
        assert_eq!(
            local_named_resource.public_path,
            "/-/raw/content/guides/local/diagram.png"
        );
        assert_eq!(
            local_named_resource.referenced_by,
            vec!["/content/guides/intro"]
        );
        assert!(!snapshot_json.contains("LOCAL_NAMED_RESOURCE_SENTINEL"));
        assert!(snapshot_json.contains("/-/raw/content/guides/local/diagram.png"));
        assert!(
            intro
                .markdown
                .contains("![Local named resource](/-/raw/content/guides/local/diagram.png)")
        );
        assert_eq!(
            snapshot.taxonomies[0].terms[0].entry_ids,
            vec!["content--guides--intro", "content--guides--related"]
        );

        let table = snapshot
            .views
            .iter()
            .find(|view| view.id == "guide-table")
            .unwrap();
        let graph = snapshot
            .views
            .iter()
            .find(|view| view.id == "guide-graph")
            .unwrap();
        assert_eq!(table.source_path, ".forma/views/guide-table.md");
        assert!(matches!(
            table.projection,
            Some(ViewRenderOutput::Table { ref items, .. }) if items.len() == 2
        ));
        assert!(matches!(
            graph.projection,
            Some(ViewRenderOutput::Graph {
                ref nodes,
                ref edges,
                ..
            }) if nodes.len() == 2 && edges.len() == 1
        ));
        assert!(snapshot.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "entryRef.unresolved"
                && diagnostic.path.as_deref() == Some("content/guides/intro.md")
                && diagnostic.route_path.as_deref() == Some("/content/guides/intro")
                && diagnostic.actual.as_deref() == Some("missing-guide")
        }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_rewrites_static_links_resources_and_duplicate_heading_ids() {
        let root = copy_fixture("site-snapshot-static-links");
        fs::write(
            root.join("content/guides/intro.md"),
            "---\ntitle: Intro\nsummary: Fixture introduction.\nstatus: published\n---\n\n# Intro\n\n## Repeat\n\n[Related](related.md#Details)\n[Deep](related.md#深入)\n[[guides/related#Details|Workspace-style]]\n[[related|Bare]]\n\n## Repeat\n\n![Diagram](../../assets/diagram.svg)\n\n[External](https://example.test/a)\n[Mail](mailto:test@example.test)\n[Fragment](#Repeat)\n[Missing](missing.md)\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/related.md"),
            "---\ntitle: Related\nsummary: Related fixture guide.\nstatus: published\n---\n\n# Related\n\n## Details\n\n#### 深入\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/guide-table.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: table\ntitle: Guide Table\nsource:\n  type: pages\n  taxonomy:\n    spaces: [guides]\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n---\n\n# Guide Table\n\n[Related](../../content/guides/related.md#Details)\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();

        assert_eq!(
            intro
                .headings
                .iter()
                .map(|heading| heading.id.as_str())
                .collect::<Vec<_>>(),
            vec!["intro", "repeat", "repeat-2"]
        );
        assert!(intro.html.contains(r#"<h2 id="repeat"><span id="forma-heading-repeat" data-forma-heading-anchor="" tabindex="-1"></span>Repeat</h2>"#));
        assert!(intro.html.contains(r#"<h2 id="repeat-2"><span id="forma-heading-repeat-2" data-forma-heading-anchor="" tabindex="-1"></span>Repeat</h2>"#));
        assert!(
            intro
                .markdown
                .contains("[Related](/preview/content/guides/related#details)")
        );
        assert!(!intro.markdown.contains("#details#Details"));
        assert!(
            intro
                .markdown
                .contains("[Deep](/preview/content/guides/related#section)")
        );
        assert!(
            intro
                .markdown
                .contains("[Workspace-style](</preview/content/guides/related#details>)")
        );
        assert!(
            intro
                .markdown
                .contains("[Bare](</preview/content/guides/related>)")
        );
        let related = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/related.md")
            .unwrap();
        assert!(related.html.contains(r#"<h4 id="section"><span id="forma-heading-深入" data-forma-heading-anchor="" tabindex="-1"></span>深入</h4>"#));
        assert!(
            intro
                .markdown
                .contains("](/preview/-/raw/assets/diagram.svg)")
        );
        assert!(intro.markdown.contains("](https://example.test/a)"));
        assert!(intro.markdown.contains("](mailto:test@example.test)"));
        assert!(intro.markdown.contains("](#repeat)"), "{}", intro.markdown);
        assert!(intro.markdown.contains("](missing.md)"));
        assert_eq!(
            snapshot.resources[0].public_path,
            "/preview/-/raw/assets/diagram.svg"
        );
        let table = snapshot
            .views
            .iter()
            .find(|view| view.id == "guide-table")
            .unwrap();
        assert!(
            table
                .html
                .as_deref()
                .unwrap()
                .contains(r#"href="/preview/content/guides/related#details""#)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resource_inventory_matches_link_resolution() {
        use std::collections::{BTreeMap, BTreeSet};
        let root = copy_fixture("site-resource-resolution-consistency");
        fs::write(root.join("content/guides/source.txt"), "raw source").unwrap();
        fs::create_dir_all(root.join("content/guides/directory.txt")).unwrap();
        let routes = BTreeMap::from([
            (
                "content/guides/source.txt.md".into(),
                "/content/guides/source.txt".into(),
            ),
            (
                "content/guides/directory.txt/index.md".into(),
                "/content/guides/directory.txt".into(),
            ),
            (
                "content/guides/page.md".into(),
                "/content/guides/page".into(),
            ),
        ]);
        let config = BTreeSet::from(["content/guides/config.txt"]);
        for root_path in ["/", "/preview"] {
            for (target, raw) in [
                ("./source.txt?download=1#part", true),
                ("/content/guides/source.txt#part", true),
                ("./source.txt.md", false),
                ("./directory.txt#details", false),
                ("./page.md", false),
                ("./page", false),
                ("https://example.test/source.txt", false),
                ("./config.txt", false),
                ("./missing.txt", true),
            ] {
                let document =
                    crate::markdown::FormaMarkdownDocument::parse(&format!("[link]({target})"));
                let href = super::static_reference_href(
                    &root,
                    &document.references[0],
                    "content/guides/intro.md",
                    &routes,
                    &BTreeMap::new(),
                    &config,
                    root_path,
                );
                let raw_prefix = if root_path == "/" {
                    "/-/raw/"
                } else {
                    "/preview/-/raw/"
                };
                assert_eq!(
                    href.as_deref()
                        .is_some_and(|href| href.starts_with(raw_prefix)),
                    raw,
                    "{root_path} {target}: {href:?}"
                );
                let document = crate::markdown::FormaMarkdownDocument::parse(&format!(
                    "[First]({target})\n[Second]({target})\n"
                ));
                let mut resources = BTreeMap::new();
                super::collect_document_resources(
                    &root,
                    &routes,
                    &mut resources,
                    &config,
                    "content/guides/intro.md",
                    "/content/guides/intro",
                    &document,
                    root_path,
                );
                assert_eq!(
                    resources.len(),
                    usize::from(raw),
                    "{root_path} {target}: {resources:?}"
                );
                if raw {
                    let resource = resources.values().next().unwrap();
                    assert_eq!(
                        href.as_deref().unwrap().split(['?', '#']).next(),
                        Some(resource.public_path.as_str())
                    );
                    assert_eq!(resource.referenced_by, vec!["/content/guides/intro"]);
                }
            }
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_prefers_exact_resource_when_sidecar_exists() {
        let root = copy_fixture("site-snapshot-resource-sidecar-collision");
        fs::write(root.join("content/guides/foo.txt"), "raw resource").unwrap();
        fs::write(
            root.join("content/guides/foo.txt.md"),
            "---\ntitle: Foo text entry\nsummary: Sidecar entry.\nstatus: published\n---\n\n# Foo text entry\n",
        )
        .unwrap();
        let intro_path = root.join("content/guides/intro.md");
        let intro = fs::read_to_string(&intro_path).unwrap();
        fs::write(
            &intro_path,
            format!("{intro}\n[Raw](./foo.txt?download=1#part)\n[Root raw](/content/guides/foo.txt)\n[Sidecar](./foo.txt.md)\n"),
        )
        .unwrap();

        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        assert!(
            intro
                .markdown
                .contains("[Raw](/preview/-/raw/content/guides/foo.txt?download=1#part)")
        );
        assert!(
            intro
                .markdown
                .contains("[Root raw](/preview/-/raw/content/guides/foo.txt)")
        );
        assert!(
            intro
                .markdown
                .contains("[Sidecar](/preview/content/guides/foo.txt)")
        );
        let resource = snapshot
            .resources
            .iter()
            .find(|resource| resource.path == "content/guides/foo.txt")
            .unwrap();
        assert_eq!(
            resource.public_path,
            "/preview/-/raw/content/guides/foo.txt"
        );
        assert_eq!(resource.referenced_by, vec!["/content/guides/intro"]);

        // Without a real raw file the historical sidecar alias must still resolve.
        fs::remove_file(root.join("content/guides/foo.txt")).unwrap();
        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        assert!(
            intro
                .markdown
                .contains("[Raw](/preview/content/guides/foo.txt#part)"),
            "{}",
            intro.markdown
        );
        assert!(
            snapshot
                .resources
                .iter()
                .all(|resource| resource.path != "content/guides/foo.txt")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_decodes_public_urls_once_for_artifact_paths() {
        let root = copy_fixture("site-snapshot-decoded-artifact-paths");
        for (path, title) in [
            ("content/guides/with space.md", "With Space"),
            ("content/guides/你好.md", "Unicode"),
            ("content/guides/100%.md", "Literal Percent"),
        ] {
            fs::write(
                root.join(path),
                format!(
                    "---\ntitle: {title}\nsummary: Encoded route fixture.\nstatus: published\n---\n\n# {title}\n"
                ),
            )
            .unwrap();
        }
        for path in [
            "assets/diagram space.svg",
            "assets/图.svg",
            "assets/100%.svg",
        ] {
            fs::write(
                root.join(path),
                "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
            )
            .unwrap();
        }
        fs::write(
            root.join("content/guides/intro.md"),
            "---\ntitle: Intro\nsummary: Fixture introduction.\nstatus: published\n---\n\n# Intro\n\n![Space](<../../assets/diagram space.svg>)\n![Unicode](../../assets/图.svg)\n![Percent](../../assets/100%.svg)\n",
        )
        .unwrap();

        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        for (path, route_path, output_path) in [
            (
                "content/guides/with space.md",
                "/content/guides/with%20space",
                "content/guides/with space/index.html",
            ),
            (
                "content/guides/你好.md",
                "/content/guides/%E4%BD%A0%E5%A5%BD",
                "content/guides/你好/index.html",
            ),
            (
                "content/guides/100%.md",
                "/content/guides/100%25",
                "content/guides/100%/index.html",
            ),
        ] {
            let entry = snapshot
                .entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap();
            assert_eq!(entry.route_path, route_path);
            assert_eq!(entry.output_path, output_path);
        }
        for (path, public_path, output_path) in [
            (
                "assets/diagram space.svg",
                "/preview/-/raw/assets/diagram%20space.svg",
                "-/raw/assets/diagram space.svg",
            ),
            (
                "assets/图.svg",
                "/preview/-/raw/assets/%E5%9B%BE.svg",
                "-/raw/assets/图.svg",
            ),
            (
                "assets/100%.svg",
                "/preview/-/raw/assets/100%25.svg",
                "-/raw/assets/100%.svg",
            ),
        ] {
            let resource = snapshot
                .resources
                .iter()
                .find(|resource| resource.path == path)
                .unwrap();
            assert_eq!(resource.public_path, public_path);
            assert_eq!(resource.output_path, output_path);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_rejects_unsafe_root_paths() {
        let root = copy_fixture("site-snapshot-root-path");
        for root_path in ["//evil.test", "/a//b", "/%2e%2e", "/a/", "/a b"] {
            assert!(
                build_static_site_snapshot_with_root_path(&root, root_path).is_err(),
                "{root_path}"
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backlink_collector_inverts_deduplicated_references_by_target() {
        let root = copy_fixture("site-snapshot-backlink-map");
        fs::write(
            root.join("content/guides/third.md"),
            "---\ntitle: Third\nsummary: Third fixture guide.\nstatus: published\n---\n\n# Third\n\n[Related first](related.md)\n[Related duplicate](related.md#details)\n[Intro](intro.md)\n[Self](third.md)\n",
        )
        .unwrap();
        let source = WorkspaceSnapshot::load(&root).unwrap();
        let mut entries = source.discovery().index.entries.clone();
        entries.reverse();

        let backlinks = collect_backlinks_by_target(&entries);

        assert_eq!(
            backlinks.keys().map(String::as_str).collect::<Vec<_>>(),
            vec!["content/guides/intro.md", "content/guides/related.md"]
        );
        assert_eq!(
            backlinks["content/guides/intro.md"]
                .iter()
                .map(|edge| edge.source_path.as_str())
                .collect::<Vec<_>>(),
            vec!["content/guides/third.md"]
        );
        assert_eq!(
            backlinks["content/guides/related.md"]
                .iter()
                .map(|edge| edge.source_path.as_str())
                .collect::<Vec<_>>(),
            vec!["content/guides/intro.md", "content/guides/third.md"]
        );
        assert_eq!(
            backlinks["content/guides/related.md"]
                .iter()
                .filter(|edge| edge.source_path == "content/guides/third.md")
                .count(),
            1
        );
        assert!(!backlinks.contains_key("content/guides/third.md"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_routes_each_directory_that_no_page_serves() {
        let root = copy_fixture("site-snapshot-directories");
        fs::create_dir_all(root.join("content/guides/advanced")).unwrap();
        fs::write(
            root.join("content/guides/advanced/deep.md"),
            "---\ntitle: Deep\nsummary: Nested page.\nstatus: published\n---\n\n# Deep\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/advanced.md"),
            "---\ntitle: Advanced\nsummary: Page that serves its directory.\nstatus: published\n---\n\n# Advanced\n",
        )
        .unwrap();

        let snapshot = build_static_site_snapshot(&root).unwrap();
        let directories = snapshot
            .routes
            .iter()
            .filter(|route| route.kind == StaticSiteRouteKind::Directory)
            .map(|route| {
                (
                    route.id.as_str(),
                    route.path.as_str(),
                    route.output_path.as_str(),
                )
            })
            .collect::<Vec<_>>();

        assert_eq!(
            directories,
            vec![
                ("content", "/content", "content/index.html"),
                (
                    "content/guides",
                    "/content/guides",
                    "content/guides/index.html"
                ),
                ("local", "/local", "local/index.html"),
            ],
            "content/guides/advanced is served by advanced.md, so it gets no directory route"
        );
        assert!(
            !snapshot
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "site.routeCollision"),
            "{:?}",
            snapshot.diagnostics
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_rejects_case_only_document_and_directory_conflicts() {
        let root = copy_fixture("site-snapshot-directory-case-conflict");
        fs::create_dir_all(root.join("content/guides/guide")).unwrap();
        fs::write(root.join("content/guides/Guide.md"), "# Guide\n").unwrap();
        fs::write(root.join("content/guides/guide/child.md"), "# Child\n").unwrap();

        let check = check_workspace(&root);
        assert!(check.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == crate::routes::ROUTE_STATIC_OUTPUT_CONFLICT_CODE
                && diagnostic.severity == DiagnosticSeverity::Warning
                && diagnostic.path.as_deref() == Some("content/guides/Guide.md")
        }));
        let snapshot = build_static_site_snapshot(&root).unwrap();
        assert_eq!(snapshot.status, OperationStatus::Failed);
        assert!(snapshot.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == crate::routes::ROUTE_STATIC_OUTPUT_CONFLICT_CODE
                && diagnostic.severity == DiagnosticSeverity::Error
                && diagnostic.path.as_deref() == Some("content/guides/Guide.md")
        }));
        assert!(snapshot.routes.iter().any(|route| {
            route.kind == StaticSiteRouteKind::Directory && route.path == "/content/guides/guide"
        }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_reports_document_routes_with_dot_segments() {
        let root = copy_fixture("site-snapshot-invalid-document-segments");
        let invalid_routes = [
            ("content/guides/..md", "route `/content/guides/.`"),
            ("content/guides/...md", "route `/content/guides/..`"),
        ];
        for (path, _) in invalid_routes {
            fs::write(root.join(path), "# Guide\n").unwrap();
        }

        let check = check_workspace(&root);
        let snapshot = build_static_site_snapshot(&root).unwrap();
        assert_eq!(check.status, OperationStatus::Failed);
        assert_eq!(snapshot.status, OperationStatus::Failed);
        for (path, route) in invalid_routes {
            assert!(check.diagnostics.iter().any(|diagnostic| {
                diagnostic.code == crate::routes::ROUTE_INVALID_SEGMENT_CODE
                    && diagnostic.severity == DiagnosticSeverity::Error
                    && diagnostic.path.as_deref() == Some(path)
                    && diagnostic.actual.as_deref() == Some(route)
            }));
            assert!(snapshot.diagnostics.iter().any(|diagnostic| {
                diagnostic.code == crate::routes::ROUTE_INVALID_SEGMENT_CODE
                    && diagnostic.severity == DiagnosticSeverity::Error
                    && diagnostic.path.as_deref() == Some(path)
            }));
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_decodes_markdown_uri_paths_once_without_changing_wikilinks() {
        let root = copy_fixture("site-snapshot-encoded-links");
        let targets = [
            "a b.md",
            "a%20b.md",
            "hash#.md",
            "query?.md",
            "pipe|name.md",
        ];
        for target in targets {
            fs::write(
                root.join("content/guides").join(target),
                "# Target\n\n[Self](#target)\n[Query self](?download=1#target)\n",
            )
            .unwrap();
        }
        fs::write(root.join("assets/image space.svg"), "<svg/>").unwrap();
        let source = "# Source\n\n[Space](./a%20b%2Emd)\n[Percent](./a%2520b.md)\n[Hash](./hash%23.md)\n[Query](./query%3F.md)\n[[a%20b.md|Literal wiki]]\n[Pipe](./pipe%7Cname.md)\n![Image](../../assets/image%20space.svg)\n";
        fs::write(root.join("content/guides/intro.md"), source).unwrap();
        let check = check_workspace(&root);
        assert!(
            !check
                .diagnostics
                .iter()
                .any(|d| d.code == "entryRef.unresolved"
                    && d.path.as_deref() == Some("content/guides/intro.md")),
            "{:?}",
            check.diagnostics
        );
        let workspace = WorkspaceSnapshot::load(&root).unwrap();
        let indexed = workspace
            .discovery()
            .index
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        assert_eq!(indexed.refs.len(), 6);
        for target in targets {
            let path = format!("content/guides/{target}");
            let entry = workspace
                .discovery()
                .index
                .entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap();
            assert_eq!(entry.refs[0].target_path, path);
            assert_eq!(entry.refs[1].target_path, path);
        }
        let analysis = workspace.analyze_document("content/guides/intro.md", source);
        for (reference, expected) in analysis.references.iter().take(5).zip([
            "a b.md",
            "a%20b.md",
            "hash#.md",
            "query?.md",
            "a%20b.md",
        ]) {
            let resolved = workspace
                .resolve_document_reference("content/guides/intro.md", reference)
                .unwrap();
            assert_eq!(
                resolved.target.unwrap().path,
                format!("content/guides/{expected}")
            );
        }
        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|e| e.path == "content/guides/intro.md")
            .unwrap();
        for expected in [
            "[Space](/preview/content/guides/a%20b)",
            "[Percent](/preview/content/guides/a%2520b)",
            "[Hash](/preview/content/guides/hash%23)",
            "[Query](/preview/content/guides/query%3F)",
            "[Literal wiki](</preview/content/guides/a%2520b>)",
            "[Pipe](/preview/content/guides/pipe%7Cname)",
            "![Image](/preview/-/raw/assets/image%20space.svg)",
        ] {
            assert!(intro.markdown.contains(expected), "{}", intro.markdown);
        }
        assert!(
            snapshot
                .resources
                .iter()
                .any(|r| r.path == "assets/image space.svg")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_resolves_encoded_heading_fragments_once() {
        let root = copy_fixture("site-snapshot-encoded-fragments");
        fs::write(
            root.join("content/guides/suffix-target.md"),
            "# Target\n\n## Hello world\n\n## literal%2Dworld\n\n## literal-world\n\n## 第一节\n\n## 第二节\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/intro.md"),
            "# Source\n\n## Local heading\n\n[Local](#local%2Dheading)\n[Id](./suffix-target.md#hello%2Dworld)\n[Title](./suffix-target.md#Hello%20world)\n[Percent](./suffix-target.md#literal%252Dworld)\n[[suffix-target#literal%2Dworld|Wiki percent]]\n[[suffix-target#第二节|Second named heading]]\n[[suffix-target#不存在|Missing named heading]]\n",
        ).unwrap();
        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        for expected in [
            "[Local](#local-heading)",
            "[Id](/preview/content/guides/suffix-target#hello-world)",
            "[Title](/preview/content/guides/suffix-target#hello-world)",
            "[Percent](/preview/content/guides/suffix-target#literal-2dworld)",
            "[Wiki percent](</preview/content/guides/suffix-target#literal-2dworld>)",
            "[Second named heading](</preview/content/guides/suffix-target#section-2>)",
            "[Missing named heading](</preview/content/guides/suffix-target#%E4%B8%8D%E5%AD%98%E5%9C%A8>)",
        ] {
            assert!(intro.markdown.contains(expected), "{}", intro.markdown);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_rewrites_fragments_to_published_heading_targets() {
        let root = copy_fixture("site-snapshot-published-heading-fragments");
        fs::write(
            root.join("content/guides/target.md"),
            "# 总览\n\n## 第一节\n\n## 版本 v2\n\n## forma-heading-前缀\n\n## 实际别名\n\n## forma-heading-实际别名\n\n## user-content-fn-脚注\n\n## Host Visual — 2026-09-24\n\nText[^脚注].\n\n[^脚注]: Note.\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/intro.md"),
            "# Source\n\n[[target#总览|Omitted title]]\n\n[Title ID](./target.md#section)\n\n[Readable title](./target.md#forma-heading-%E6%80%BB%E8%A7%88)\n\n[[target#缺失版本 v2|Missing mixed]]\n\n[Exact path space](./target.md#%20)\n\n[Alias path space](./target#%20)\n\n[[target#forma-heading-前缀|Prefixed title]]\n\n[[target#forma-heading-实际别名|Existing alias]]\n\n[[target#Host-Visual-—-2026-09-24|Hyphenated title]]\n\n[Footnote](./target.md#user-content-fn-%25E8%2584%259A%25E6%25B3%25A8)\n",
        ).unwrap();
        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let entry = |path: &str| {
            snapshot
                .entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap()
        };
        let intro = entry("content/guides/intro.md");
        let target = entry("content/guides/target.md");
        let url = "/preview/content/guides/target";
        for (label, fragment) in [
            ("Omitted title", "forma-heading-%E6%80%BB%E8%A7%88"),
            ("Title ID", "forma-heading-%E6%80%BB%E8%A7%88"),
            ("Readable title", "forma-heading-%E6%80%BB%E8%A7%88"),
            ("Missing mixed", "%E7%BC%BA%E5%A4%B1%E7%89%88%E6%9C%AC%20v2"),
            ("Exact path space", "%20"),
            ("Alias path space", "%20"),
            ("Prefixed title", "forma-heading"),
            (
                "Existing alias",
                "forma-heading-%E5%AE%9E%E9%99%85%E5%88%AB%E5%90%8D",
            ),
            ("Hyphenated title", "host-visual-2026-09-24"),
            ("Footnote", "user-content-fn-%25E8%2584%259A%25E6%25B3%25A8"),
        ] {
            assert!(
                intro
                    .html
                    .contains(&format!(r#"<a href="{url}#{fragment}">{label}</a>"#)),
                "{label}: {}",
                intro.html
            );
        }
        for id in [
            "forma-heading-总览",
            "forma-heading",
            "forma-heading-实际别名",
            "host-visual-2026-09-24",
            "user-content-fn-%E8%84%9A%E6%B3%A8",
        ] {
            assert!(
                target.html.contains(&format!(r#"id="{id}""#)),
                "{}",
                target.html
            );
        }
        assert!(!target.html.contains(r#"id="section""#), "{}", target.html);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_keeps_omitted_title_reachable_when_body_claims_alias() {
        let root = copy_fixture("site-snapshot-omitted-title-alias-collision");
        fs::write(
            root.join("content/guides/target.md"),
            "# Foo\n\n## Forma heading foo\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/intro.md"),
            "# Source\n\n[[target#Foo|Omitted title]]\n\n[[target#forma-heading-foo|Body ID]]\n",
        )
        .unwrap();
        let snapshot = build_static_site_snapshot(&root).unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        let target = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/target.md")
            .unwrap();
        assert!(
            intro
                .html
                .contains(r#"href="/content/guides/target#foo">Omitted title</a>"#)
        );
        assert!(
            intro
                .html
                .contains(r#"href="/content/guides/target#forma-heading-foo">Body ID</a>"#)
        );
        assert!(
            target
                .html
                .starts_with(r#"<span id="foo" data-forma-heading-anchor=""#)
        );
        assert!(target.html.contains(r#"<h2 id="forma-heading-foo">"#));
        assert_eq!(target.html.matches(r#"id="forma-heading-foo""#).count(), 1);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_resolves_legacy_fragment_spellings_of_omitted_titles() {
        let root = copy_fixture("site-snapshot-omitted-title-legacy-fragments");
        fs::write(
            root.join("content/guides/target.md"),
            "# Hello world\n\n## Body\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/intro.md"),
            "# Source\n\n[Uppercase](target.md#HELLO-WORLD)\n\n[Underscore](target.md#hello_world)\n",
        )
        .unwrap();
        let snapshot = build_static_site_snapshot(&root).unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        let target = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/target.md")
            .unwrap();
        assert!(target.html.contains(r#"id="forma-heading-hello-world""#));
        assert_eq!(
            intro
                .html
                .matches(r#"href="/content/guides/target#forma-heading-hello-world""#)
                .count(),
            2,
            "{}",
            intro.html,
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_keeps_body_anchors_when_both_omitted_title_ids_are_occupied() {
        let root = copy_fixture("site-snapshot-omitted-title-both-ids-occupied");
        fs::write(
            root.join("content/guides/target.md"),
            "# Forma heading foo\n\n## Foo\n\n## Forma heading forma heading foo\n\n## Forma omitted title\n",
        )
        .unwrap();
        fs::write(
            root.join("content/guides/intro.md"),
            "# Source\n\n[[target#Forma heading foo|Omitted title]]\n\n[[target#forma-heading-foo|Body alias]]\n\n[[target#forma-heading-forma-heading-foo|Body ID]]\n",
        )
        .unwrap();
        let snapshot = build_static_site_snapshot(&root).unwrap();
        let entry = |path: &str| {
            snapshot
                .entries
                .iter()
                .find(|entry| entry.path == path)
                .unwrap()
        };
        let intro = entry("content/guides/intro.md");
        let target = entry("content/guides/target.md");
        for (id, label) in [
            ("forma-omitted-title-", "Omitted title"),
            ("forma-heading-foo", "Body alias"),
            ("forma-heading-forma-heading-foo", "Body ID"),
        ] {
            assert!(
                intro.html.contains(&format!(
                    r#"href="/content/guides/target#{id}">{label}</a>"#
                )),
                "{}",
                intro.html,
            );
            assert_eq!(target.html.matches(&format!(r#"id="{id}""#)).count(), 1);
        }
        assert!(
            target
                .html
                .starts_with(r#"<span id="forma-omitted-title-" data-forma-heading-anchor=""#),
            "{}",
            target.html,
        );
        assert!(
            target
                .html
                .contains(r#"<h2 id="foo"><span id="forma-heading-foo""#)
        );
        assert!(
            target
                .html
                .contains(r#"<h2 id="forma-heading-forma-heading-foo">"#)
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_keeps_view_heading_ids_when_prose_precedes_h1() {
        let root = copy_fixture("site-snapshot-view-h1-after-prose");
        let view_path = root.join(".forma/views/guide-table.md");
        let source = fs::read_to_string(&view_path).unwrap();
        let (frontmatter, _) = source[4..].split_once("\n---").unwrap();
        fs::write(
            view_path,
            format!(
                "---\n{frontmatter}\n---\n\nAn introductory paragraph.\n\n# Secondary View title\n\n## Setup\n\n[Setup](#setup)\n\n[Deploy](#deploy)\n\n<!-- forma:content -->\n\n## Deploy\n"
            ),
        )
        .unwrap();
        let snapshot = build_static_site_snapshot(&root).unwrap();
        let view = snapshot
            .views
            .iter()
            .find(|view| view.id == "guide-table")
            .unwrap();
        let html = view.html.as_deref().unwrap();
        for (level, id) in [(1, "secondary-view-title"), (2, "setup"), (2, "deploy")] {
            assert!(
                html.contains(&format!(
                    r#"<h{level} id="{id}"><span id="forma-heading-{id}""#
                )),
                "{html}",
            );
        }
        assert!(html.contains(r##"<a href="#setup">Setup</a>"##));
        assert!(html.contains(r##"<a href="#deploy">Deploy</a>"##));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_preserves_resource_uri_suffix_semantics() {
        let root = copy_fixture("site-snapshot-resource-uri-suffix");
        fs::write(root.join("assets/file.txt"), "Resource").unwrap();
        fs::write(
            root.join("content/guides/intro.md"),
            "# Source\n\n[Resource](../../assets/file.txt?name=a%20b&literal=%2520&embedded=%26x%3Dy&plus=a+b#some%20anchor)\n[Unicode](<../../assets/file.txt?name=中文 value#中文 anchor>)\n[Malformed](../../assets/file.txt?bad=%oops#bad%escape)\n[[../../assets/file.txt?name=a%20b+literal#some%20anchor|Wiki suffix]]\n",
        ).unwrap();
        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        let expected = "/preview/-/raw/assets/file.txt?name=a%20b&literal=%2520&embedded=%26x%3Dy&plus=a+b#some%20anchor";
        let href = intro
            .markdown
            .lines()
            .find_map(|line| {
                line.strip_prefix("[Resource](")
                    .and_then(|href| href.strip_suffix(')'))
            })
            .unwrap();
        assert_eq!(href, expected);
        let url = url::Url::parse(&format!("https://example.test{href}")).unwrap();
        let pairs = url.query_pairs().into_owned().collect::<Vec<_>>();
        assert_eq!(
            pairs,
            vec![
                ("name".into(), "a b".into()),
                ("literal".into(), "%20".into()),
                ("embedded".into(), "&x=y".into()),
                ("plus".into(), "a b".into())
            ]
        );
        assert!(
            intro
                .markdown
                .contains("?name=%E4%B8%AD%E6%96%87%20value#%E4%B8%AD%E6%96%87%20anchor"),
            "{}",
            intro.markdown
        );
        assert!(
            intro.markdown.contains("?bad=%25oops#bad%25escape"),
            "{}",
            intro.markdown
        );
        assert!(intro.markdown.contains("[Wiki suffix](</preview/-/raw/assets/file.txt?name=a%2520b%2Bliteral#some%2520anchor>)"), "{}", intro.markdown);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_rewrites_reference_link_definitions() {
        let root = copy_fixture("site-snapshot-reference-links");
        fs::write(
            root.join("content/guides/a b.md"),
            "# Target\n\n## Hello world\n",
        )
        .unwrap();
        fs::write(root.join("assets/ref image.svg"), "<svg/>").unwrap();
        let source = r#"# Source

[Full][guide] [Guide][] [guide] [External][web] ![Illustration][image]

[guide]: <./a%20b.md#hello%2Dworld> "Guide title"
[guide]: ./duplicate.md
[web]: https://example.test/page
[unused]: ./a%20b.md

> [Quoted][quote]
>
> [quote]:
>     ./a%20b.md

[image]: ../../assets/ref%20image.svg
"#;
        fs::write(root.join("content/guides/intro.md"), source).unwrap();
        let workspace = WorkspaceSnapshot::load(&root).unwrap();
        let analysis = workspace.analyze_document("content/guides/intro.md", source);
        let local_links = analysis
            .references
            .iter()
            .filter(|reference| reference.raw_target.starts_with("./a%20b.md"))
            .collect::<Vec<_>>();
        assert_eq!(local_links.len(), 4);
        for reference in local_links {
            let resolved = workspace
                .resolve_document_reference("content/guides/intro.md", reference)
                .unwrap();
            assert_eq!(resolved.target.unwrap().path, "content/guides/a b.md");
        }
        let snapshot = build_static_site_snapshot_with_root_path(&root, "/preview").unwrap();
        let intro = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/intro.md")
            .unwrap();
        let expected = r#"[guide]: </preview/content/guides/a%20b#hello-world> "Guide title""#;
        assert_eq!(
            intro.markdown.matches(expected).count(),
            1,
            "{}",
            intro.markdown
        );
        assert!(intro.markdown.contains("[guide]: ./duplicate.md"));
        assert!(intro.markdown.contains("[unused]: ./a%20b.md"));
        assert!(intro.markdown.contains("[web]: https://example.test/page"));
        assert_eq!(
            intro
                .html
                .matches(r#"href="/preview/content/guides/a%20b#hello-world""#)
                .count(),
            3
        );
        assert!(
            intro
                .html
                .contains(r#"<a href="/preview/content/guides/a%20b">Quoted</a>"#)
        );
        assert!(
            intro
                .html
                .contains(r#"src="/preview/-/raw/assets/ref%20image.svg""#)
        );
        assert!(
            snapshot
                .resources
                .iter()
                .any(|resource| resource.path == "assets/ref image.svg")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_reports_view_routes_with_invalid_segments() {
        let root = copy_fixture("site-snapshot-invalid-view-segments");
        for name in ["..md", "...md"] {
            fs::write(
                root.join(".forma/views").join(name),
                "---\nkind: view\nmode: list\nsource:\n  type: pages\n---\n",
            )
            .unwrap();
        }
        let check = check_workspace(&root);
        let snapshot = build_static_site_snapshot(&root).unwrap();
        assert_eq!(check.status, OperationStatus::Failed);
        assert_eq!(snapshot.status, OperationStatus::Failed);
        for name in ["..md", "...md"] {
            let path = format!(".forma/views/{name}");
            assert!(
                check.diagnostics.iter().any(|diagnostic| diagnostic.code
                    == crate::routes::ROUTE_INVALID_SEGMENT_CODE
                    && diagnostic.path.as_deref() == Some(&path)),
                "{name}: {:?}",
                check.diagnostics
            );
            let route = crate::routes::view_route_path(name.strip_suffix(".md").unwrap());
            assert!(snapshot.diagnostics.iter().any(|diagnostic| diagnostic.code
                == crate::routes::ROUTE_INVALID_SEGMENT_CODE
                && diagnostic.route_path.as_deref() == Some(&route)));
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_includes_entries_under_local_named_directories() {
        let root = copy_fixture("site-snapshot-local");
        let snapshot = build_static_site_snapshot(&root).unwrap();
        let json = serde_json::to_string(&snapshot).unwrap();

        assert_eq!(snapshot.summary.entries, 3);
        assert!(json.contains("local/private-draft"));
        assert!(json.contains("Local Notes"));
        assert!(json.contains("LOCAL_NAMED_DIRECTORY_SENTINEL"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_excludes_imported_configuration_sources_from_static_content() {
        let root = copy_fixture("site-snapshot-local");
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\n---\n\n# CONFIG_SOURCE_SENTINEL\n",
        )
        .unwrap();

        let snapshot = build_static_site_snapshot(&root).unwrap();
        let json = serde_json::to_string(&snapshot).unwrap();

        assert_eq!(snapshot.summary.entries, 3);
        assert!(
            snapshot
                .entries
                .iter()
                .all(|entry| entry.path != ".forma/local/profile.md")
        );
        assert!(!json.contains("CONFIG_SOURCE_SENTINEL"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_reports_entry_route_collisions_before_artifact_writing() {
        let root = copy_fixture("site-snapshot-route-collision");
        fs::create_dir_all(root.join("content/guides/related")).unwrap();
        fs::write(
            root.join("content/guides/related/index.md"),
            "---\ntitle: Colliding Related\nsummary: Collision fixture.\nstatus: published\n---\n\n# Colliding Related\n",
        )
        .unwrap();

        let snapshot = build_static_site_snapshot(&root).unwrap();

        assert_eq!(snapshot.status, OperationStatus::Failed);
        assert!(
            snapshot.diagnostics.iter().any(|diagnostic| {
                diagnostic.code == "route.collision"
                    && diagnostic.path.as_deref() == Some("content/guides/related/index.md")
                    && diagnostic.actual.as_deref()
                        == Some(
                            "document content/guides/related.md and document content/guides/related/index.md are both at /content/guides/related",
                        )
            }),
            "{:#?}",
            snapshot.diagnostics
        );
        fs::remove_dir_all(root).unwrap();
    }

    fn copy_fixture(name: &str) -> PathBuf {
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/static-site");
        let root = fixture_root(name);
        copy_dir_recursive(&source, &root);
        root
    }

    fn copy_dir_recursive(source: &Path, target: &Path) {
        fs::create_dir_all(target).unwrap();
        for entry in fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            let source_path = entry.path();
            let target_path = target.join(entry.file_name());
            if source_path.is_dir() {
                copy_dir_recursive(&source_path, &target_path);
            } else {
                fs::copy(source_path, target_path).unwrap();
            }
        }
    }

    fn fixture_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-core-{name}-{nonce}"))
    }
    #[test]
    fn readable_fragments_are_not_reslugified() {
        assert_eq!(
            super::resolve_heading_fragment("forma-heading-中文标题", None, |_| None),
            Some("forma-heading-%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98".into())
        );
        assert_eq!(
            super::resolve_heading_fragment("user-content-fn-translator", None, |_| None),
            Some("user-content-fn-translator".into())
        );
    }
    #[test]
    fn readable_aliases_do_not_shadow_historical_heading_ids() {
        let source = "## Forma heading foo\n\n## Foo\n";
        let document = crate::markdown::parse_markdown(source);
        let html = super::render_static_markdown_html(
            source,
            &crate::render::render_all_headings(&document, false),
            false,
        );
        assert_eq!(
            html.matches("id=\"forma-heading-foo\"").count(),
            1,
            "{html}"
        );
        assert!(
            html.contains(
                "<h2 id=\"forma-heading-foo\"><span id=\"forma-heading-forma-heading-foo\""
            )
        );
    }
    #[test]
    fn notes_before_an_omitted_title_keep_old_static_targets() {
        let source = "[^n]: Note\n\n    ## Earlier\n\n# Title\n\n## Body\n\nText[^n]\n";
        let document = crate::markdown::parse_markdown(source);
        let headings = crate::render::render_all_headings(&document, true);
        let html = super::render_static_markdown_html(source, &headings, true);
        assert!(
            html.contains("<h2 id=\"earlier\"><span id=\"forma-heading-body\""),
            "{html}"
        );
        assert!(
            html.contains("<h2 id=\"title\"><span id=\"forma-heading-earlier\""),
            "{html}"
        );
        assert!(!html.contains("<h1"));
    }
    #[test]
    fn leading_title_annotations_remain_navigable() {
        let source = "# Title[^n]\n\n## Body\n\n[^n]: Note\n";
        let document = crate::markdown::parse_markdown(source);
        let html = super::render_static_markdown_html(
            source,
            &crate::render::render_all_headings(&document, true),
            true,
        );
        assert!(html.contains("<h1 id=\"title\">"), "{html}");
        assert!(html.contains("id=\"user-content-fnref-n\""));
        assert!(html.contains("href=\"#user-content-fnref-n\""));
        assert!(html.contains("<h2 id=\"body\">"));
    }

    #[test]
    fn authored_headings_keep_ids_when_generated_footnotes_collide() {
        let source = "\
## User content fn note

## User content fnref note

## User content fnref note 2

Text[^note] and again[^note]. Another note[^note-].

[Authored heading](#user-content-fn-note)

[^note]: Note body.
[^note-]: Another note.
";
        let document = crate::markdown::parse_markdown(source);
        let html = super::render_static_markdown_html(
            source,
            &crate::render::render_all_headings(&document, false),
            false,
        );
        for id in [
            "user-content-fn-note",
            "user-content-fnref-note",
            "user-content-fnref-note-2",
            "user-content-fn-note-",
            "user-content-fnref-note-",
        ] {
            assert_eq!(html.matches(&format!("id=\"{id}\"")).count(), 1, "{html}");
        }
        assert!(
            html.contains("<li id=\"user-content-fn-note--\">"),
            "{html}"
        );
        assert!(
            html.contains("href=\"#user-content-fn-note--\" id=\"user-content-fnref-note--\" data-footnote-ref"),
            "{html}"
        );
        assert!(
            html.contains("href=\"#user-content-fnref-note--\" data-footnote-backref"),
            "{html}"
        );
        assert!(
            html.contains("href=\"#user-content-fnref-note:1\" data-footnote-backref"),
            "{html}"
        );
        assert!(
            html.contains("href=\"#user-content-fn-note\">Authored heading</a>"),
            "{html}"
        );
    }
}
