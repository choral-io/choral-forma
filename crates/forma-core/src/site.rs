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
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent};
use crate::operations::{
    OperationError, ReferenceEdge, WorkspaceSnapshot, document_id_for_path,
    normalized_relative_target, read_operation_diagnostics, reference_edge,
    reference_edge_sort_key, unique_references_by_target,
};
use crate::path::WorkspacePath;
use crate::render::{
    RenderedHeading, ViewRenderDocument, ViewRenderOutput, markdown_with_reference_fallbacks,
    render_headings, render_indexed_view_from_loaded, render_markdown_html,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSiteWorkspace {
    pub name: String,
    pub canonical_language: String,
    pub supported_languages: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<StaticSiteWorkspaceLogo>,
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
    let source = WorkspaceSnapshot::load(root)?;
    build_static_site_snapshot_from_loaded(&source)
}

fn build_static_site_snapshot_from_loaded(
    source: &WorkspaceSnapshot,
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
        );

        let outgoing = unique_references_by_target(entry.refs.iter())
            .into_iter()
            .map(|reference| reference_edge(entry, reference, &discovery.index.entries))
            .collect::<Vec<_>>();
        let mut backlinks = discovery
            .index
            .entries
            .iter()
            .filter(|candidate| candidate.path != entry.path)
            .flat_map(|candidate| {
                unique_references_by_target(
                    candidate
                        .refs
                        .iter()
                        .filter(|reference| reference.target_path == entry.path),
                )
                .into_iter()
                .map(|reference| reference_edge(candidate, reference, &discovery.index.entries))
            })
            .collect::<Vec<_>>();
        backlinks.sort_by_key(reference_edge_sort_key);

        let mut variants = Vec::new();
        for variant in &entry.variants {
            let (rendered, variant_diagnostics) = render_variant(
                workspace.root.as_path(),
                &config_paths,
                &mut resources,
                variant,
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
            markdown: markdown_with_reference_fallbacks(&document),
            html: render_markdown_html(&document),
            headings: render_headings(&document),
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
            route_path: route_path.clone(),
            output_path: route_output_path(&route_path),
            mode: view.mode.clone(),
            title: view.title.clone(),
            display: view.display.clone(),
            space: view.space.clone(),
            document: rendered.document,
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
        && let Some(candidate) = resource_candidate(&logo.path, ".", true, &config_paths)
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
    );
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
            markdown: markdown_with_reference_fallbacks(&document),
            html: render_markdown_html(&document),
            headings: render_headings(&document),
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
        (StaticSiteRouteKind::Taxonomies, "taxonomies", "/taxonomies"),
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
        format!("{path}/index.html")
    }
}

fn collect_document_resources(
    resources: &mut BTreeMap<String, StaticSiteResourceCandidate>,
    config_paths: &BTreeSet<&str>,
    source_path: &str,
    source_route: &str,
    document: &FormaMarkdownDocument,
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
        let Some(candidate) = resource_candidate(&path, source_route, false, config_paths) else {
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
        || target.starts_with('/')
        || target.starts_with('~')
        || target.starts_with('#')
        || target.starts_with("//")
        || target.contains("://")
        || target.starts_with("mailto:")
        || target.starts_with("data:")
    {
        return None;
    }
    let end = target.find(['?', '#']).unwrap_or(target.len());
    let target = &target[..end];
    let normalized = normalized_relative_target(source_path, target)?;
    WorkspacePath::parse_config(&normalized)
        .ok()
        .map(|path| path.as_str().to_string())
}

fn resource_candidate(
    path: &str,
    source_route: &str,
    workspace_presentation: bool,
    config_paths: &BTreeSet<&str>,
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
        public_path: format!("/raw/{encoded}"),
        output_path: format!("raw/{encoded}"),
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
    let mut components = path.split('/');
    let Some(root) = components.next() else {
        return false;
    };
    !root.starts_with('.') && !blocked_roots.contains(&root)
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

    use super::{StaticSiteRouteKind, build_static_site_snapshot};
    use crate::{OperationStatus, ReferenceIntent, ReferenceSource, ViewRenderOutput};

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
                "/taxonomies",
                "taxonomies/index.html",
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
        assert!(!first_json.contains(".forma/"));
        assert!(!first_json.contains("runtime"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn site_snapshot_fixture_exports_references_views_and_resources() {
        let root = copy_fixture("site-snapshot-content");
        let snapshot = build_static_site_snapshot(&root).unwrap();
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

        assert!(intro.markdown.contains("[Related](related.md)"));
        assert!(intro.html.contains("<h2>Overview</h2>"));
        assert_eq!(intro.headings[0].id, "overview");
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
