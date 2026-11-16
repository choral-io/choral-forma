//! The public URL layout that every surface shares.
//!
//! Content owns the root namespace: a page or a directory is served at its workspace path, so
//! `notes/welcome.md` is `/notes/welcome` and the workspace root, whose page is `.forma.md`, is
//! `/`. Everything Forma adds lives under the single reserved segment `-`: collections at
//! `/-/browse/<taxonomy>/<term>`, views at `/-/views/<id>`, health, raw files, the RPC endpoint,
//! and static artifact data. Each position in a URL has exactly one owner, so a configured name
//! never shadows a system route; the diagnostics here report the few content names that would.

use std::collections::{BTreeMap, BTreeSet};

use crate::config::TaxonomyTermDefinition;
use crate::diagnostics::Diagnostic;
use crate::index::{IndexEntry, IndexView};
use crate::path::FORMA_CONFIG_PATH;

/// The first path segment that belongs to Forma rather than to content.
pub const SYSTEM_ROUTE_SEGMENT: &str = "-";
/// The collections overview; each taxonomy and term is a segment below it.
pub const BROWSE_ROUTE_PATH: &str = "/-/browse";
/// The views overview; each view is a segment below it.
pub const VIEWS_ROUTE_PATH: &str = "/-/views";
/// The workspace health page.
pub const HEALTH_ROUTE_PATH: &str = "/-/health";
/// The prefix for raw workspace files served beside the reader.
pub const RAW_ROUTE_PREFIX: &str = "/-/raw";
/// The JSON-RPC endpoint of a local server.
pub const RPC_ROUTE_PATH: &str = "/-/rpc";
/// The static artifact's data files, which the enhanced reader loads.
pub const STATIC_DATA_ROUTE_PATH: &str = "/-/data";
/// Files a static artifact keeps at its root beside `index.html`, because hosts, crawlers, and
/// the artifact writer look for them there. Everything else an artifact adds is under `-/`.
pub const STATIC_SITE_ROOT_FILES: &[&str] = &[
    "index.html",
    "404.html",
    "sitemap.xml",
    "robots.txt",
    "_headers",
    ".forma-site-artifact",
];

/// The route of an indexed document: its workspace path without the Markdown extension, with an
/// `index` file standing for its directory.
pub fn entry_route_path(path: &str) -> String {
    format!("/{}", encode_path(&entry_page_path(path)))
}

/// The route of a directory's page; the empty path is the workspace root, `/`.
pub fn directory_route_path(directory: &str) -> String {
    format!("/{}", encode_path(directory))
}

pub fn view_route_path(id: &str) -> String {
    format!("{VIEWS_ROUTE_PATH}/{}", percent_encode_segment(id))
}

pub fn taxonomy_route_path(id: &str) -> String {
    format!("{BROWSE_ROUTE_PATH}/{}", percent_encode_segment(id))
}

pub fn taxonomy_term_route_path(taxonomy_id: &str, term_id: &str) -> String {
    format!(
        "{}/{}",
        taxonomy_route_path(taxonomy_id),
        percent_encode_segment(term_id)
    )
}

/// The URL of a raw workspace file.
pub fn raw_route_path(path: &str) -> String {
    format!("{RAW_ROUTE_PREFIX}/{}", encode_path(path))
}

/// A document path as its page path: no Markdown extension, and `x/index` as `x`.
pub(crate) fn entry_page_path(path: &str) -> String {
    let without_extension = path
        .strip_suffix(".md")
        .or_else(|| path.strip_suffix(".mdx"))
        .unwrap_or(path);
    without_extension
        .strip_suffix("/index")
        .filter(|value| !value.is_empty())
        .unwrap_or(without_extension)
        .to_string()
}

/// Every directory that holds one of the paths, by its path from the workspace root.
pub(crate) fn directory_paths<'a>(paths: impl IntoIterator<Item = &'a str>) -> BTreeSet<String> {
    paths
        .into_iter()
        .flat_map(|path| {
            let segments = path.split('/').collect::<Vec<_>>();
            (1..segments.len())
                .map(move |length| segments[..length].join("/"))
                .collect::<Vec<_>>()
        })
        .collect()
}

pub(crate) fn encode_path(path: &str) -> String {
    if path.is_empty() {
        return String::new();
    }
    path.split('/')
        .map(percent_encode_segment)
        .collect::<Vec<_>>()
        .join("/")
}

pub(crate) fn percent_encode_segment(segment: &str) -> String {
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

/// The artifact file a static host serves for a route.
pub(crate) fn route_output_path(route_path: &str) -> String {
    let path = route_path.trim_matches('/');
    if path.is_empty() {
        "index.html".to_string()
    } else {
        format!("{}/index.html", decode_public_path_once(path))
    }
}

pub(crate) fn decode_public_path_once(path: &str) -> String {
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

/// The public id of a view in a static artifact: the last segment of its path id.
pub(crate) fn public_view_id(view: &IndexView) -> String {
    view.id
        .rsplit('/')
        .next()
        .unwrap_or(view.id.as_str())
        .to_string()
}

/// Diagnostic code for a document whose route lands in the reserved `-` segment.
pub const ROUTE_RESERVED_CODE: &str = "route.reserved";
/// Diagnostic code for a document route segment or taxonomy or term id that cannot be a URL segment.
pub const ROUTE_INVALID_SEGMENT_CODE: &str = "route.invalidSegment";
/// Diagnostic code for two sources served at the same route.
pub const ROUTE_COLLISION_CODE: &str = "route.collision";
/// Diagnostic code for routes a static artifact cannot hold apart. Workspace checks report it as
/// a warning, since a local server still serves them; static publication treats it as an error.
pub const ROUTE_STATIC_OUTPUT_CONFLICT_CODE: &str = "route.staticOutputConflict";

struct RouteSource {
    path: String,
    /// The workspace source, when the route comes from one, so the diagnostic points at a file.
    source: Option<String>,
    label: String,
}

/// Reports the routes that cannot be served as the workspace names them: documents in the reserved
/// `-` segment, invalid URL segments, two sources on one route, and
/// routes a static artifact would write over one another.
pub(crate) fn route_diagnostics(
    entries: &[IndexEntry],
    views: &[IndexView],
    taxonomies: &BTreeMap<String, serde_yml::Value>,
    terms: &BTreeMap<String, BTreeMap<String, TaxonomyTermDefinition>>,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let mut routes = vec![RouteSource {
        path: "/".to_string(),
        source: Some(FORMA_CONFIG_PATH.to_string()),
        label: "the workspace home".to_string(),
    }];
    for path in [BROWSE_ROUTE_PATH, VIEWS_ROUTE_PATH, HEALTH_ROUTE_PATH] {
        routes.push(RouteSource {
            path: path.to_string(),
            source: None,
            label: format!("the system page {path}"),
        });
    }

    let document_paths = entries
        .iter()
        .flat_map(|entry| {
            std::iter::once(entry.path.as_str())
                .chain(entry.variants.iter().map(|variant| variant.path.as_str()))
        })
        .collect::<Vec<_>>();
    for path in &document_paths {
        let route = entry_route_path(path);
        if route.split('/').nth(1) == Some(SYSTEM_ROUTE_SEGMENT) {
            diagnostics.push(
                Diagnostic::error(
                    ROUTE_RESERVED_CODE,
                    "Document route is inside the segment reserved for Forma's own pages.",
                )
                .with_path(path.to_string())
                .with_actual(format!("route {route}"))
                .with_expected(format!(
                    "a top-level name other than `{SYSTEM_ROUTE_SEGMENT}`; rename the file or directory, or exclude it"
                )),
            );
            continue;
        }
        if route.split('/').skip(1).any(invalid_route_segment) {
            diagnostics.push(
                Diagnostic::error(
                    ROUTE_INVALID_SEGMENT_CODE,
                    "Document route contains an invalid URL path segment.",
                )
                .with_path(path.to_string())
                .with_actual(format!("route `{route}`"))
                .with_expected("no empty, `.`, or `..` segments; rename or exclude the file"),
            );
            continue;
        }
        routes.push(RouteSource {
            path: route,
            source: Some(path.to_string()),
            label: format!("document {path}"),
        });
    }
    let page_routes = routes
        .iter()
        .map(|route| route.path.clone())
        .collect::<BTreeSet<_>>();
    for directory in directory_paths(
        document_paths
            .iter()
            .copied()
            .filter(|path| path.split('/').next() != Some(SYSTEM_ROUTE_SEGMENT)),
    ) {
        let route = directory_route_path(&directory);
        if !page_routes.contains(&route) {
            routes.push(RouteSource {
                path: route,
                source: None,
                label: format!("directory {directory}/"),
            });
        }
    }

    for view in views {
        routes.push(RouteSource {
            path: view_route_path(&public_view_id(view)),
            source: Some(view.path.clone()),
            label: format!("view {}", view.path),
        });
    }

    for taxonomy_id in taxonomies.keys() {
        if invalid_route_segment(taxonomy_id) {
            diagnostics.push(invalid_segment_diagnostic("Taxonomy", taxonomy_id));
            continue;
        }
        routes.push(RouteSource {
            path: taxonomy_route_path(taxonomy_id),
            source: None,
            label: format!("taxonomy {taxonomy_id}"),
        });
        for term_id in terms.get(taxonomy_id).into_iter().flat_map(BTreeMap::keys) {
            if invalid_route_segment(term_id) {
                diagnostics.push(invalid_segment_diagnostic(
                    "Term",
                    &format!("{taxonomy_id}/{term_id}"),
                ));
                continue;
            }
            routes.push(RouteSource {
                path: taxonomy_term_route_path(taxonomy_id, term_id),
                source: None,
                label: format!("term {taxonomy_id}/{term_id}"),
            });
        }
    }

    diagnostics.extend(collision_diagnostics(&routes));
    diagnostics.extend(static_output_diagnostics(&routes));
    diagnostics
}

fn invalid_route_segment(id: &str) -> bool {
    matches!(id, "" | "." | "..")
}

fn invalid_segment_diagnostic(kind: &str, id: &str) -> Diagnostic {
    Diagnostic::error(
        ROUTE_INVALID_SEGMENT_CODE,
        format!("{kind} id cannot be a URL path segment."),
    )
    .with_actual(format!("id `{id}`"))
    .with_expected("an id other than an empty string, `.`, or `..`")
}

fn collision_diagnostics(routes: &[RouteSource]) -> Vec<Diagnostic> {
    let mut seen = BTreeMap::<&str, &RouteSource>::new();
    let mut diagnostics = Vec::new();
    for route in routes {
        let Some(existing) = seen.insert(route.path.as_str(), route) else {
            continue;
        };
        let mut diagnostic = Diagnostic::error(
            ROUTE_COLLISION_CODE,
            "Two sources are served at the same route.",
        )
        .with_actual(format!(
            "{} and {} are both at {}",
            existing.label, route.label, route.path
        ))
        .with_expected("one source per route; rename or exclude one of them");
        if let Some(source) = route.source.as_ref().or(existing.source.as_ref()) {
            diagnostic = diagnostic.with_path(source.clone());
        }
        diagnostics.push(diagnostic);
    }
    diagnostics
}

/// Routes a static artifact cannot hold apart: output paths that differ only in case, and an
/// output file standing where another route needs a directory, such as a page named
/// `index.html` or a root page named after a file the artifact keeps at its root.
fn static_output_diagnostics(routes: &[RouteSource]) -> Vec<Diagnostic> {
    struct Owner<'a> {
        label: String,
        source: Option<&'a str>,
    }
    // The home route writes the root `index.html`; the other root files belong to the artifact.
    let mut outputs = STATIC_SITE_ROOT_FILES
        .iter()
        .filter(|file| **file != "index.html")
        .map(|file| {
            (
                file.to_ascii_lowercase(),
                Owner {
                    label: format!("the artifact's root file {file}"),
                    source: None,
                },
            )
        })
        .collect::<BTreeMap<_, _>>();
    let mut diagnostics = Vec::new();
    let mut seen_routes = BTreeSet::new();
    for route in routes {
        if !seen_routes.insert(route.path.as_str()) {
            continue;
        }
        let output = route_output_path(&route.path);
        let key = output.to_ascii_lowercase();
        if let Some(owner) = outputs.get(&key) {
            diagnostics.push(static_conflict(
                route,
                owner.label.as_str(),
                owner.source,
                format!("both write {output}"),
            ));
        } else {
            outputs.insert(
                key,
                Owner {
                    label: route.label.clone(),
                    source: route.source.as_deref(),
                },
            );
        }
    }
    let by_output = routes
        .iter()
        .map(|route| (route_output_path(&route.path).to_ascii_lowercase(), route))
        .collect::<BTreeMap<_, _>>();
    for (file, owner) in &outputs {
        let directory = format!("{file}/");
        let Some((nested, route)) = by_output
            .range(directory.clone()..)
            .next()
            .filter(|(key, _)| key.starts_with(&directory))
        else {
            continue;
        };
        diagnostics.push(static_conflict(
            route,
            owner.label.as_str(),
            owner.source,
            format!("{file} is a file, so {nested} cannot be written inside it"),
        ));
    }
    diagnostics
}

fn static_conflict(
    route: &RouteSource,
    other: &str,
    other_source: Option<&str>,
    actual: String,
) -> Diagnostic {
    let mut diagnostic = Diagnostic::warning(
        ROUTE_STATIC_OUTPUT_CONFLICT_CODE,
        "A static site cannot hold these routes apart.",
    )
    .with_actual(format!("{} and {other}: {actual}", route.label))
    .with_expected(
        "names that differ in more than case and are not `index.html`; rename one of them",
    );
    if let Some(source) = route.source.as_deref().or(other_source) {
        diagnostic = diagnostic.with_path(source.to_string());
    }
    diagnostic
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::DisplayOptions;
    use crate::diagnostics::DiagnosticSeverity;

    fn entry(path: &str) -> IndexEntry {
        IndexEntry {
            path: path.to_string(),
            space: "notes".to_string(),
            taxonomies: BTreeMap::new(),
            kind: None,
            title: None,
            omit_leading_title: false,
            summary: None,
            variants: Vec::new(),
            refs: Vec::new(),
        }
    }

    fn view(path: &str) -> IndexView {
        IndexView {
            id: path.trim_end_matches(".md").to_string(),
            path: path.to_string(),
            surface: "page".to_string(),
            mode: "table".to_string(),
            space: None,
            source: None,
            title: None,
            display: DisplayOptions::default(),
        }
    }

    fn term() -> TaxonomyTermDefinition {
        TaxonomyTermDefinition {
            title: "Term".to_string(),
            display: DisplayOptions::default(),
            description: None,
            include_patterns: Vec::new(),
        }
    }

    fn diagnose(entries: &[&str], views: &[&str], terms: &[(&str, &[&str])]) -> Vec<Diagnostic> {
        let taxonomies = terms
            .iter()
            .map(|(taxonomy, _)| (taxonomy.to_string(), serde_yml::Value::Null))
            .collect();
        let terms = terms
            .iter()
            .map(|(taxonomy, ids)| {
                (
                    taxonomy.to_string(),
                    ids.iter().map(|id| (id.to_string(), term())).collect(),
                )
            })
            .collect();
        route_diagnostics(
            &entries.iter().map(|path| entry(path)).collect::<Vec<_>>(),
            &views.iter().map(|path| view(path)).collect::<Vec<_>>(),
            &taxonomies,
            &terms,
        )
    }

    fn codes(diagnostics: &[Diagnostic]) -> Vec<(&str, DiagnosticSeverity, Option<&str>)> {
        diagnostics
            .iter()
            .map(|diagnostic| {
                (
                    diagnostic.code.as_str(),
                    diagnostic.severity,
                    diagnostic.path.as_deref(),
                )
            })
            .collect()
    }

    #[test]
    fn content_owns_the_root_and_forma_owns_the_reserved_segment() {
        assert_eq!(entry_route_path("notes/welcome.md"), "/notes/welcome");
        assert_eq!(entry_route_path("notes/index.md"), "/notes");
        assert_eq!(entry_route_path("index.md"), "/index");
        assert_eq!(entry_route_path("a b/100%.mdx"), "/a%20b/100%25");
        assert_eq!(directory_route_path(""), "/");
        assert_eq!(directory_route_path("notes/deep"), "/notes/deep");
        assert_eq!(view_route_path("board"), "/-/views/board");
        assert_eq!(taxonomy_route_path("browse"), "/-/browse/browse");
        assert_eq!(
            taxonomy_term_route_path("areas", "a/b"),
            "/-/browse/areas/a%2Fb"
        );
        assert_eq!(
            raw_route_path("assets/logo 1.svg"),
            "/-/raw/assets/logo%201.svg"
        );
    }

    #[test]
    fn names_that_match_system_pages_need_no_reservation() {
        let diagnostics = diagnose(
            &[
                "pages/a.md",
                "browse/b.md",
                "assets/c.md",
                "views.md",
                "-notes/d.md",
            ],
            &[".forma/views/browse.md"],
            &[("pages", &["views", "health"]), ("browse", &["browse"])],
        );

        assert_eq!(codes(&diagnostics), Vec::new());
    }

    #[test]
    fn reports_documents_inside_the_reserved_segment() {
        let diagnostics = diagnose(&["-/browse.md", "-.md", "notes/-.md"], &[], &[]);

        assert_eq!(
            codes(&diagnostics),
            vec![
                (
                    ROUTE_RESERVED_CODE,
                    DiagnosticSeverity::Error,
                    Some("-/browse.md")
                ),
                (ROUTE_RESERVED_CODE, DiagnosticSeverity::Error, Some("-.md")),
            ]
        );
    }

    #[test]
    fn reports_ids_that_are_not_url_segments() {
        let diagnostics = diagnose(&[], &[], &[(".", &["x"]), ("areas", &["..", "ok"])]);

        assert_eq!(
            codes(&diagnostics),
            vec![
                (ROUTE_INVALID_SEGMENT_CODE, DiagnosticSeverity::Error, None),
                (ROUTE_INVALID_SEGMENT_CODE, DiagnosticSeverity::Error, None),
            ]
        );
        assert_eq!(diagnostics[0].actual.as_deref(), Some("id `.`"));
        assert_eq!(diagnostics[1].actual.as_deref(), Some("id `areas/..`"));
    }

    #[test]
    fn reports_two_documents_on_one_route() {
        let diagnostics = diagnose(&["team.md", "team/index.md"], &[], &[]);

        assert_eq!(
            codes(&diagnostics),
            vec![(
                ROUTE_COLLISION_CODE,
                DiagnosticSeverity::Error,
                Some("team/index.md")
            )]
        );
        assert_eq!(
            diagnostics[0].actual.as_deref(),
            Some("document team.md and document team/index.md are both at /team")
        );
    }

    #[test]
    fn warns_about_routes_a_static_artifact_cannot_hold_apart() {
        let diagnostics = diagnose(
            &[
                "Notes/a.md",
                "notes/b.md",
                "guides/index.html.md",
                "404.html.md",
                "index.html.md",
            ],
            &[],
            &[("areas", &["index.html"])],
        );

        let conflicts = diagnostics
            .iter()
            .map(|diagnostic| {
                assert_eq!(diagnostic.code, ROUTE_STATIC_OUTPUT_CONFLICT_CODE);
                assert_eq!(diagnostic.severity, DiagnosticSeverity::Warning);
                diagnostic.actual.clone().unwrap_or_default()
            })
            .collect::<Vec<_>>();
        assert_eq!(
            conflicts,
            vec![
                "directory notes/ and directory Notes/: both write notes/index.html",
                "term areas/index.html and taxonomy areas: -/browse/areas/index.html is a file, so -/browse/areas/index.html/index.html cannot be written inside it",
                "document 404.html.md and the artifact's root file 404.html: 404.html is a file, so 404.html/index.html cannot be written inside it",
                "document guides/index.html.md and directory guides/: guides/index.html is a file, so guides/index.html/index.html cannot be written inside it",
                "document index.html.md and the workspace home: index.html is a file, so index.html/index.html cannot be written inside it",
            ]
        );
    }
}
