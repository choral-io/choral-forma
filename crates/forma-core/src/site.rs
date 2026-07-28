//! Deterministic, publication-safe Core input for a later static artifact writer.
//!
//! This module freezes logical routes and artifact paths, but it does not write
//! files, copy resource candidates, or rewrite rendered HTML URLs.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::DisplayOptions;
use crate::diagnostics::{
    Diagnostic, DiagnosticLocation, DiagnosticSeverity, DiagnosticSummary, OperationStatus,
};
use crate::index::{IndexEntry, IndexEntryVariant, IndexView};
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
use crate::{media_type_for_workspace_path, version};

/// Serialized contract version consumed by static artifact writers.
pub const STATIC_SITE_SNAPSHOT_SCHEMA_VERSION: u16 = 1;

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

/// The Markdown body of the workspace root document (`.forma.md`).
///
/// This is deliberately separate from managed entries: the root document
/// describes the workspace and remains the stable source for its root route.
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
    Pages,
    Views,
    Taxonomies,
    Entry,
    View,
    Taxonomy,
    TaxonomyTerm,
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

/// Builds one static snapshot from one shared-only workspace load and discovery.
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
    let mut route_sources = BTreeMap::<String, Option<String>>::new();
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
    let mut entry_headings_by_path = entry_routes_by_path
        .keys()
        .map(|path| {
            read_document(workspace.root.as_path(), path)
                .map(|document| (path.clone(), render_all_headings(&document)))
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
    let workspace_home_headings = render_all_headings(&workspace_home_document);
    entry_headings_by_path.insert(
        FORMA_CONFIG_PATH.to_string(),
        workspace_home_headings.clone(),
    );
    collect_document_resources(
        &mut resources,
        &config_paths,
        FORMA_CONFIG_PATH,
        "/",
        &workspace_home_document,
        root_path,
    );
    let workspace_home_markdown = static_markdown(
        &workspace_home_document,
        FORMA_CONFIG_PATH,
        &entry_routes_by_path,
        &entry_headings_by_path,
        &config_paths,
        root_path,
    );
    let workspace_home_html =
        render_static_markdown_html(&workspace_home_markdown, &workspace_home_headings, false);

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
            &mut resources,
            &config_paths,
            &entry.path,
            &route_path,
            &document,
            root_path,
        );
        let markdown = static_markdown(
            &document,
            &entry.path,
            &entry_routes_by_path,
            &entry_headings_by_path,
            &config_paths,
            root_path,
        );
        let headings = render_all_headings(&document);
        let html = render_static_markdown_html(&markdown, &headings, entry.omit_leading_title);

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
            route_sources.insert(
                rendered.route_path.to_ascii_lowercase(),
                Some(rendered.path.clone()),
            );
            variants.push(rendered);
        }
        variants.sort_by(|left, right| left.path.cmp(&right.path));

        let id = document_id_for_path(&entry.path);
        routes.push(route_for_entry(&id, &entry.path, &route_path));
        route_sources.insert(route_path.to_ascii_lowercase(), Some(entry.path.clone()));
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
        let rendered =
            render_indexed_view_from_loaded(workspace, discovery, &view.id, BTreeMap::new())?;
        let view_document = read_document(workspace.root.as_path(), &view.path)?;
        collect_document_resources(
            &mut resources,
            &config_paths,
            &view.path,
            &route_path,
            &view_document,
            root_path,
        );
        let view_markdown = static_markdown(
            &view_document,
            &view.path,
            &entry_routes_by_path,
            &entry_headings_by_path,
            &config_paths,
            root_path,
        );
        let view_headings = render_all_headings(&view_document);
        let view_html = render_static_markdown_html(&view_markdown, &view_headings, true);
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
        route_sources.insert(route_path.to_ascii_lowercase(), None);
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

    let (taxonomies, taxonomy_routes) = static_taxonomies(workspace, &discovery.index.entries);
    for route in taxonomy_routes {
        route_sources.insert(route.path.to_ascii_lowercase(), None);
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
    diagnostics.extend(route_collision_diagnostics(&routes, &route_sources));
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
    entry_headings_by_path: &BTreeMap<String, Vec<RenderedHeading>>,
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
        resources,
        config_paths,
        &variant.path,
        &route_path,
        &document,
        root_path,
    );
    let markdown = static_markdown(
        &document,
        &variant.path,
        entry_routes_by_path,
        entry_headings_by_path,
        config_paths,
        root_path,
    );
    let headings = render_all_headings(&document);
    let html = render_static_markdown_html(&markdown, &headings, variant.omit_leading_title);
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

fn support_routes() -> Vec<StaticSiteRoute> {
    [
        (StaticSiteRouteKind::Pages, "pages", "/pages"),
        (StaticSiteRouteKind::Views, "views", "/views"),
        (StaticSiteRouteKind::Taxonomies, "browse", "/browse"),
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

fn entry_route_path(path: &str) -> String {
    let without_extension = path
        .strip_suffix(".md")
        .or_else(|| path.strip_suffix(".mdx"))
        .unwrap_or(path);
    let page_path = without_extension
        .strip_suffix("/index")
        .filter(|value| !value.is_empty())
        .unwrap_or(without_extension);
    format!("/pages/{}", encode_path(page_path))
}

fn public_view_id(view: &IndexView) -> String {
    view.id
        .rsplit('/')
        .next()
        .unwrap_or(view.id.as_str())
        .to_string()
}

fn view_route_path(id: &str) -> String {
    format!("/views/{}", percent_encode_segment(id))
}

fn taxonomy_route_path(id: &str) -> String {
    format!("/{}", percent_encode_segment(id))
}

fn taxonomy_term_route_path(taxonomy_id: &str, term_id: &str) -> String {
    format!(
        "{}/{}",
        taxonomy_route_path(taxonomy_id),
        percent_encode_segment(term_id)
    )
}

fn encode_path(path: &str) -> String {
    path.split('/')
        .map(percent_encode_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_encode_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(char::from(*byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn route_output_path(route_path: &str) -> String {
    let path = route_path.trim_matches('/');
    if path.is_empty() {
        "index.html".to_string()
    } else {
        format!("{}/index.html", decode_public_path_once(path))
    }
}

fn decode_public_path_once(path: &str) -> String {
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%'
            && let (Some(high), Some(low)) = (
                bytes.get(index + 1).and_then(|byte| hex_value(*byte)),
                bytes.get(index + 2).and_then(|byte| hex_value(*byte)),
            )
        {
            decoded.push((high << 4) | low);
            index += 3;
            continue;
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(decoded).unwrap_or_else(|_| path.to_string())
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn static_markdown(
    document: &FormaMarkdownDocument,
    source_path: &str,
    entry_routes_by_path: &BTreeMap<String, String>,
    entry_headings_by_path: &BTreeMap<String, Vec<RenderedHeading>>,
    config_paths: &BTreeSet<&str>,
    root_path: &str,
) -> String {
    let mut output = document.body.clone();
    let mut replacements = document
        .references
        .iter()
        .filter_map(|reference| {
            let href = static_reference_href(
                &reference.target,
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
                    let prefix = (matches!(
                        reference.syntax,
                        crate::markdown::FormaReferenceSyntax::ObsidianEmbed
                    ) && href.contains("/raw/"))
                    .then_some("!")
                    .unwrap_or("");
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
    raw_target: &str,
    source_path: &str,
    entry_routes_by_path: &BTreeMap<String, String>,
    entry_headings_by_path: &BTreeMap<String, Vec<RenderedHeading>>,
    config_paths: &BTreeSet<&str>,
    root_path: &str,
) -> Option<String> {
    let target = raw_target.trim();
    if target.is_empty()
        || target
            .chars()
            .any(|character| character.is_control() || character == '>')
    {
        return None;
    }
    if let Some(fragment) = target.strip_prefix('#') {
        return resolve_heading_fragment(fragment, entry_headings_by_path.get(source_path))
            .map(|fragment| format!("#{fragment}"));
    }
    if is_external_target(target) {
        return None;
    }
    let (without_fragment, fragment) = target.split_once('#').unwrap_or((target, ""));
    let (path, query) = without_fragment
        .split_once('?')
        .map_or((without_fragment, ""), |(path, query)| (path, query));
    let normalized = normalized_static_target(source_path, path)?;

    let resolved_entry = resolve_entry_route(&normalized, entry_routes_by_path).or_else(|| {
        let workspace_style_target = path.trim_start_matches('/');
        (workspace_style_target != normalized)
            .then(|| resolve_entry_route(workspace_style_target, entry_routes_by_path))
            .flatten()
    });
    if let Some((target_path, route)) = resolved_entry {
        let mut href = public_url(root_path, route);
        if !fragment.is_empty() {
            href.push('#');
            href.push_str(
                &resolve_heading_fragment(fragment, entry_headings_by_path.get(target_path))
                    .unwrap_or_else(|| slugify_heading(fragment)),
            );
        }
        return Some(href);
    }

    let candidate = resource_candidate(&normalized, ".", false, config_paths, root_path)?;
    let mut href = candidate.public_path;
    if !query.is_empty() {
        href.push('?');
        href.push_str(&encode_url_suffix(query));
    }
    if !fragment.is_empty() {
        href.push('#');
        href.push_str(&encode_url_suffix(fragment));
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

    let suffixes = [
        format!("/{normalized}"),
        format!("/{normalized}.md"),
        format!("/{normalized}.mdx"),
    ];
    let matches = entry_routes_by_path
        .iter()
        .filter(|(path, _)| suffixes.iter().any(|suffix| path.ends_with(suffix)))
        .map(|(path, route)| (path, route))
        .collect::<Vec<_>>();
    (matches.len() == 1).then(|| matches[0])
}

fn resolve_heading_fragment(
    fragment: &str,
    headings: Option<&Vec<RenderedHeading>>,
) -> Option<String> {
    let fragment = fragment.trim();
    if fragment.is_empty() {
        return None;
    }
    let normalized = slugify_heading(fragment);
    headings
        .into_iter()
        .flatten()
        .find(|heading| {
            heading.id.eq_ignore_ascii_case(fragment)
                || heading.text.trim().eq_ignore_ascii_case(fragment)
        })
        .map(|heading| heading.id.clone())
        .or(Some(normalized))
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
    if fragment.is_empty() {
        format!("./{path}")
    } else {
        format!("./{path}#{}", slugify_heading(fragment))
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

fn encode_url_suffix(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~' | b'=' | b'&') {
            encoded.push(char::from(byte));
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
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
    if omit_leading_title
        && let Some(rest) = html.strip_prefix("<h1>")
        && let Some(end) = rest.find("</h1>")
    {
        html = rest[end + "</h1>".len()..]
            .strip_prefix('\n')
            .unwrap_or(&rest[end + "</h1>".len()..])
            .to_string();
    }

    let rendered_headings = headings
        .iter()
        .enumerate()
        .filter(|(index, heading)| !(omit_leading_title && *index == 0 && heading.level == 1))
        .map(|(_, heading)| heading)
        .collect::<Vec<_>>();
    let mut output = String::with_capacity(html.len() + headings.len() * 24);
    let mut cursor = 0;
    let mut heading_index = 0;
    while let Some(relative) = html[cursor..].find("<h") {
        let start = cursor + relative;
        output.push_str(&html[cursor..start]);
        let tag = html.as_bytes().get(start + 2).copied();
        let opening = html.as_bytes().get(start + 3).copied();
        if matches!(tag, Some(b'1'..=b'6')) && opening == Some(b'>') {
            if let Some(heading) = rendered_headings.get(heading_index) {
                output.push_str(&format!(
                    "<h{} id=\"{}\">",
                    char::from(tag.unwrap_or_default()),
                    heading.id
                ));
                heading_index += 1;
                cursor = start + 4;
                continue;
            }
        }
        output.push_str("<h");
        cursor = start + 2;
    }
    output.push_str(&html[cursor..]);
    output
}

fn collect_document_resources(
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
        let Some(path) = normalized_resource_path(source_path, &reference.target) else {
            continue;
        };
        let Some(candidate) =
            resource_candidate(&path, source_route, false, config_paths, root_path)
        else {
            continue;
        };
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

fn normalized_resource_path(source_path: &str, target: &str) -> Option<String> {
    let target = target.trim();
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
    let normalized = normalized_static_target(source_path, target)?;
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
    let encoded = encode_path(path);
    Some(StaticSiteResourceCandidate {
        path: path.to_string(),
        public_path: public_url(root_path, &format!("/raw/{encoded}")),
        output_path: format!("raw/{path}"),
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
    if components.iter().any(|component| {
        component.is_empty()
            || component.starts_with('.')
            || component.eq_ignore_ascii_case("local")
    }) {
        return false;
    }
    !blocked_roots
        .iter()
        .any(|blocked| root.eq_ignore_ascii_case(blocked))
}

fn route_collision_diagnostics(
    routes: &[StaticSiteRoute],
    sources: &BTreeMap<String, Option<String>>,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let mut seen = BTreeMap::<String, &StaticSiteRoute>::new();
    for route in routes {
        let key = route.output_path.to_ascii_lowercase();
        if let Some(existing) = seen.insert(key, route) {
            let mut diagnostic = Diagnostic::error(
                "site.routeCollision",
                "Static routes resolve to the same output path.",
            )
            .with_actual(format!(
                "route {} collides with route {}",
                existing.path, route.path
            ))
            .with_expected("unique route output paths");
            if let Some(Some(path)) = sources.get(&route.path.to_ascii_lowercase()) {
                diagnostic = diagnostic.with_path(path.clone());
            }
            diagnostics.push(diagnostic);
        }
    }
    diagnostics
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
        OperationStatus, ReferenceIntent, ReferenceSource, ViewRenderOutput, WorkspaceSnapshot,
    };

    #[test]
    fn site_snapshot_fixture_is_deterministic_and_preserves_contract() {
        let root = copy_fixture("site-snapshot-contract");
        let first = build_static_site_snapshot(&root).unwrap();
        let second = build_static_site_snapshot(&root).unwrap();
        let first_json = serde_json::to_string_pretty(&first).unwrap();
        let second_json = serde_json::to_string_pretty(&second).unwrap();

        assert_eq!(first_json, second_json);
        assert_eq!(first.schema_version, 1);
        assert_eq!(first.status, OperationStatus::Warning);
        assert_eq!(first.workspace.home.path, ".forma.md");
        assert!(!first.workspace.home.markdown.trim().is_empty());
        assert!(!first.workspace.home.html.trim().is_empty());
        assert_eq!(first.summary.entries, 2);
        assert_eq!(first.summary.views, 2);
        assert_eq!(first.summary.resources, 1);
        assert_eq!(first.summary.taxonomies, 1);
        assert_eq!(first.summary.taxonomy_terms, 1);
        assert_eq!(
            first
                .entries
                .iter()
                .map(|entry| entry.path.as_str())
                .collect::<Vec<_>>(),
            vec!["content/guides/intro.md", "content/guides/related.md"]
        );
        assert!(first.routes.iter().any(|route| {
            route.kind == StaticSiteRouteKind::Entry
                && route.path == "/pages/content/guides/intro"
                && route.output_path == "pages/content/guides/intro/index.html"
        }));
        assert!(first.routes.iter().any(|route| {
            route.kind == StaticSiteRouteKind::View
                && route.path == "/views/guide-table"
                && route.output_path == "views/guide-table/index.html"
        }));
        for (kind, path, output_path) in [
            (StaticSiteRouteKind::Pages, "/pages", "pages/index.html"),
            (StaticSiteRouteKind::Views, "/views", "views/index.html"),
            (
                StaticSiteRouteKind::Taxonomies,
                "/browse",
                "browse/index.html",
            ),
            (
                StaticSiteRouteKind::Taxonomy,
                "/spaces",
                "spaces/index.html",
            ),
            (
                StaticSiteRouteKind::TaxonomyTerm,
                "/spaces/guides",
                "spaces/guides/index.html",
            ),
        ] {
            assert!(first.routes.iter().any(|route| {
                route.kind == kind && route.path == path && route.output_path == output_path
            }));
        }
        assert!(!first_json.contains(root.to_string_lossy().as_ref()));
        assert!(!first_json.contains("LOCAL_ONLY_SENTINEL"));
        assert!(!first_json.contains("runtime"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_fixture_exports_references_views_and_resources() {
        let root = copy_fixture("site-snapshot-content");
        fs::create_dir_all(root.join("content/guides/local")).unwrap();
        fs::write(
            root.join("content/guides/local/private.png"),
            b"LOCAL_RESOURCE_SENTINEL",
        )
        .unwrap();
        let intro_path = root.join("content/guides/intro.md");
        let mut intro_source = fs::read_to_string(&intro_path).unwrap();
        intro_source.push_str("\n![Private](local/private.png)\n");
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
                .contains("[Related](/pages/content/guides/related)")
        );
        assert!(intro.html.contains(r#"<h2 id="overview">Overview</h2>"#));
        assert_eq!(intro.headings[1].id, "overview");
        assert_eq!(intro.outgoing.len(), 1);
        assert_eq!(intro.outgoing[0].target_path, "content/guides/related.md");
        assert_eq!(intro.outgoing[0].intent, ReferenceIntent::Link);
        assert_eq!(intro.outgoing[0].source, ReferenceSource::Body);
        assert_eq!(related.backlinks.len(), 1);
        assert_eq!(related.backlinks[0].source_path, "content/guides/intro.md");

        let resource = &snapshot.resources[0];
        assert_eq!(resource.path, "assets/diagram.svg");
        assert_eq!(resource.public_path, "/raw/assets/diagram.svg");
        assert_eq!(resource.referenced_by, vec!["/pages/content/guides/intro"]);
        assert!(!snapshot_json.contains("LOCAL_RESOURCE_SENTINEL"));
        assert!(!snapshot_json.contains("/raw/content/guides/local/private.png"));
        assert!(intro.markdown.contains("![Private](local/private.png)"));
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
                && diagnostic.route_path.as_deref() == Some("/pages/content/guides/intro")
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
        assert!(intro.html.contains(r#"<h2 id="repeat">Repeat</h2>"#));
        assert!(intro.html.contains(r#"<h2 id="repeat-2">Repeat</h2>"#));
        assert!(
            intro
                .markdown
                .contains("[Related](/preview/pages/content/guides/related#details)")
        );
        assert!(!intro.markdown.contains("#details#Details"));
        assert!(
            intro
                .markdown
                .contains("[Deep](/preview/pages/content/guides/related#section)")
        );
        assert!(
            intro
                .markdown
                .contains("[Workspace-style](</preview/pages/content/guides/related#details>)")
        );
        assert!(
            intro
                .markdown
                .contains("[Bare](</preview/pages/content/guides/related>)")
        );
        let related = snapshot
            .entries
            .iter()
            .find(|entry| entry.path == "content/guides/related.md")
            .unwrap();
        assert!(related.html.contains(r#"<h4 id="section">深入</h4>"#));
        assert!(
            intro
                .markdown
                .contains("](/preview/raw/assets/diagram.svg)")
        );
        assert!(intro.markdown.contains("](https://example.test/a)"));
        assert!(intro.markdown.contains("](mailto:test@example.test)"));
        assert!(intro.markdown.contains("](#repeat)"), "{}", intro.markdown);
        assert!(intro.markdown.contains("](missing.md)"));
        assert_eq!(
            snapshot.resources[0].public_path,
            "/preview/raw/assets/diagram.svg"
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
                .contains(r#"href="/preview/pages/content/guides/related#details""#)
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
                "/pages/content/guides/with%20space",
                "pages/content/guides/with space/index.html",
            ),
            (
                "content/guides/你好.md",
                "/pages/content/guides/%E4%BD%A0%E5%A5%BD",
                "pages/content/guides/你好/index.html",
            ),
            (
                "content/guides/100%.md",
                "/pages/content/guides/100%25",
                "pages/content/guides/100%/index.html",
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
                "/preview/raw/assets/diagram%20space.svg",
                "raw/assets/diagram space.svg",
            ),
            (
                "assets/图.svg",
                "/preview/raw/assets/%E5%9B%BE.svg",
                "raw/assets/图.svg",
            ),
            (
                "assets/100%.svg",
                "/preview/raw/assets/100%25.svg",
                "raw/assets/100%.svg",
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
    fn site_snapshot_shared_only_excludes_imported_local_configuration() {
        let root = copy_fixture("site-snapshot-local");
        let snapshot = build_static_site_snapshot(&root).unwrap();
        let json = serde_json::to_string(&snapshot).unwrap();

        assert_eq!(snapshot.summary.entries, 2);
        assert!(!json.contains("private-draft"));
        assert!(!json.contains("Private"));
        assert!(!json.contains("LOCAL_ONLY_SENTINEL"));
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
                diagnostic.code == "site.routeCollision"
                    && diagnostic.path.as_deref() == Some("content/guides/related/index.md")
                    && diagnostic.actual.as_deref()
                        == Some(
                            "route /pages/content/guides/related collides with route /pages/content/guides/related",
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
}
