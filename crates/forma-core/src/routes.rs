//! The public URL layout that every surface shares.
//!
//! Content uses its exact workspace path, including file extensions. The root `/` remains home.
//! Collections use `/~` and Forma's features and endpoints use `/-`.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::config::TaxonomyTermDefinition;
use crate::diagnostics::{Diagnostic, DiagnosticSeverity};
use crate::index::{IndexEntry, IndexView};
use crate::path::FORMA_CONFIG_PATH;

/// The first path segment that belongs to Forma rather than to content.
pub const SYSTEM_ROUTE_SEGMENT: &str = "-";
/// The first path segment for configured logical collections.
pub const TAXONOMY_ROUTE_SEGMENT: &str = "~";
/// The collections overview; each taxonomy and term is a segment below it.
pub const BROWSE_ROUTE_PATH: &str = "/~";
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

/// The route of an indexed document at its exact workspace file path.
pub fn entry_route_path(path: &str) -> String {
    format!("/{}", encode_path(path))
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteDirectory {
    pub path: String,
    pub route_path: String,
    pub output_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro_entry_path: Option<String>,
    pub child_directory_paths: Vec<String>,
    pub entry_paths: Vec<String>,
}

pub(crate) fn route_directories(entries: &[IndexEntry]) -> Vec<RouteDirectory> {
    let mut directories = BTreeMap::<&str, RouteDirectory>::new();
    for entry in entries {
        for path in std::iter::once(&entry.path).chain(entry.variants.iter().map(|v| &v.path)) {
            let mut child = path.as_str();
            let mut file = true;
            while let Some((parent, name)) = child.rsplit_once('/') {
                let directory = directories.entry(parent).or_insert_with(|| {
                    let route_path = directory_route_path(parent);
                    RouteDirectory {
                        path: parent.to_string(),
                        output_path: route_output_path(&route_path),
                        route_path,
                        intro_entry_path: None,
                        child_directory_paths: Vec::new(),
                        entry_paths: Vec::new(),
                    }
                });
                if file {
                    directory.entry_paths.push(child.to_string());
                    if path == &entry.path
                        && (name == "index.md"
                            || (name == "index.mdx" && directory.intro_entry_path.is_none()))
                    {
                        directory.intro_entry_path = Some(path.clone());
                    }
                } else {
                    directory.child_directory_paths.push(child.to_string());
                }
                child = parent;
                file = false;
            }
        }
    }
    directories
        .into_values()
        .map(|mut directory| {
            directory.entry_paths.sort();
            directory.entry_paths.dedup();
            directory.child_directory_paths.sort();
            directory.child_directory_paths.dedup();
            directory
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

/// Normalize an unprefixed request pathname without interpreting encoded path separators
/// as hierarchy. Only typed logical identifier positions can carry such characters.
pub fn canonical_route_path(pathname: &str) -> Option<String> {
    if pathname == "/" {
        return Some("/".to_string());
    }
    if pathname.contains(['?', '#', '\\']) {
        return None;
    }
    let path = pathname.strip_prefix('/')?;
    let path = path.strip_suffix('/').unwrap_or(path);
    let segments = path
        .split('/')
        .map(|segment| percent_decoded(segment, true))
        .collect::<Option<Vec<_>>>()?;
    for (index, segment) in segments.iter().enumerate() {
        if invalid_route_segment(segment) {
            return None;
        }
        let logical = (segments[0] == TAXONOMY_ROUTE_SEGMENT && matches!(index, 1 | 2))
            || (index == 2 && segments[0] == SYSTEM_ROUTE_SEGMENT && segments[1] == "views");
        if !logical && segment.contains(['/', '\\', '\0']) {
            return None;
        }
    }
    let encoded = segments
        .iter()
        .map(|segment| percent_encode_segment(segment))
        .collect::<Vec<_>>()
        .join("/");
    Some(format!("/{encoded}"))
}

pub(crate) fn decode_public_path_once(path: &str) -> String {
    percent_decoded(path, false).unwrap_or_else(|| path.to_string())
}

/// Decode authored Markdown URI path segments without introducing separators or dot segments.
/// A malformed escape preserves its original segment, as in the WebApp reader.
pub(crate) fn decode_markdown_uri_path(path: &str) -> Option<String> {
    let segments = path
        .split('/')
        .map(|segment| {
            let decoded = percent_decoded(segment, true).unwrap_or_else(|| segment.to_string());
            if decoded.contains(['/', '\\'])
                || (decoded != segment && matches!(decoded.as_str(), "." | ".."))
            {
                return None;
            }
            Some(decoded)
        })
        .collect::<Option<Vec<_>>>()?;
    Some(segments.join("/"))
}

fn percent_decoded(path: &str, strict: bool) -> Option<String> {
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
        if strict && bytes[index] == b'%' {
            return None;
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(decoded).ok()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[derive(Default)]
pub(crate) struct ViewRouteAllocation {
    pub ids: BTreeMap<String, String>,
    diagnostics: Vec<Diagnostic>,
}

pub(crate) fn allocate_view_routes(views: &[IndexView]) -> ViewRouteAllocation {
    allocate_view_routes_with(views, |id| {
        Sha256::digest(id.as_bytes())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    })
}

fn allocate_view_routes_with(
    views: &[IndexView],
    digest: impl Fn(&str) -> String,
) -> ViewRouteAllocation {
    struct Derived<'a> {
        view: &'a IndexView,
        base: &'a str,
        hash: String,
        length: usize,
    }

    let mut allocation = ViewRouteAllocation::default();
    let mut by_identity = BTreeMap::<&str, BTreeMap<&str, &IndexView>>::new();
    for view in views {
        by_identity
            .entry(&view.id)
            .or_default()
            .insert(&view.path, view);
    }
    let mut by_base = BTreeMap::<String, Vec<(&IndexView, &str)>>::new();
    for (identity, definitions) in by_identity {
        if definitions.len() > 1 {
            let paths = definitions.into_keys().collect::<Vec<_>>();
            allocation.diagnostics.push(
                Diagnostic::error(
                    ROUTE_COLLISION_CODE,
                    "Multiple definitions share a View configuration identity.",
                )
                .with_path(paths[0])
                .with_actual(format!("View `{identity}`: {}", paths.join(", ")))
                .with_expected(
                    "rename or remove definitions so each View has a unique configuration identity",
                ),
            );
            continue;
        }
        let view = definitions
            .into_values()
            .next()
            .expect("a View has a definition");
        let base = identity.rsplit('/').next().unwrap_or(identity);
        if invalid_route_segment(base) {
            allocation
                .diagnostics
                .push(invalid_segment_diagnostic("View", base).with_path(view.path.clone()));
        } else {
            by_base
                .entry(base.to_ascii_lowercase())
                .or_default()
                .push((view, base));
        }
    }

    let mut natural_names = BTreeMap::new();
    let mut derived = Vec::new();
    for group in by_base.values() {
        if let [(view, base)] = group.as_slice() {
            natural_names.insert(base.to_ascii_lowercase(), view.path.as_str());
            allocation.ids.insert(view.id.clone(), (*base).to_string());
        } else {
            derived.extend(group.iter().map(|&(view, base)| Derived {
                view,
                base,
                hash: digest(&view.id),
                length: 12,
            }));
        }
    }
    while !derived.is_empty() {
        let mut candidates = BTreeMap::<String, Vec<usize>>::new();
        let mut names = Vec::with_capacity(derived.len());
        for (index, item) in derived.iter().enumerate() {
            let candidate = format!("{}--{}", item.base, &item.hash[..item.length]);
            candidates
                .entry(candidate.to_ascii_lowercase())
                .or_default()
                .push(index);
            names.push(candidate);
        }
        let mut retry = false;
        let mut failures = Vec::new();
        for (key, group) in candidates {
            if group.len() == 1 && !natural_names.contains_key(&key) {
                // Keep unconstrained candidates in the comparison set until every other
                // candidate is final. A longer digest can match one of them.
                continue;
            }
            if group.iter().any(|&index| derived[index].length < 64) {
                for &index in &group {
                    derived[index].length = (derived[index].length + 4).min(64);
                }
                retry = true;
            } else {
                let paths = group
                    .iter()
                    .map(|&index| derived[index].view.path.as_str())
                    .chain(natural_names.get(&key).copied())
                    .collect::<BTreeSet<_>>();
                failures.push(
                    Diagnostic::error(
                        ROUTE_COLLISION_CODE,
                        "View routes remain ambiguous after the full digest.",
                    )
                    .with_actual(format!(
                        "route `{}`: {}",
                        view_route_path(&key),
                        paths.into_iter().collect::<Vec<_>>().join(", ")
                    ))
                    .with_expected("rename or move a conflicting View definition"),
                );
            }
        }
        if retry {
            // A later candidate may collide with one that is already fixed at its full
            // length. Do not report final failures until all extension rounds settle.
            continue;
        }
        allocation.diagnostics.extend(failures);
        let mut counts = BTreeMap::<String, usize>::new();
        for name in &names {
            *counts.entry(name.to_ascii_lowercase()).or_default() += 1;
        }
        for (item, name) in derived.into_iter().zip(names) {
            let key = name.to_ascii_lowercase();
            if !natural_names.contains_key(&key) && counts[&key] == 1 {
                allocation.ids.insert(item.view.id.clone(), name);
            }
        }
        break;
    }
    allocation
}

/// A content route occupies one of the two reserved top-level namespaces.
pub const ROUTE_RESERVED_CODE: &str = "route.reserved";
/// A source path or logical identifier cannot be represented as a valid route segment.
pub const ROUTE_INVALID_SEGMENT_CODE: &str = "route.invalidSegment";
/// Distinct owners have the same canonical route or configuration identity.
pub const ROUTE_COLLISION_CODE: &str = "route.collision";
/// Some configured route sources could not be enumerated or read.
pub const ROUTE_PREFLIGHT_INCOMPLETE_CODE: &str = "route.preflightIncomplete";
/// A static export cannot safely publish this output path or keep its owners apart.
pub const ROUTE_STATIC_OUTPUT_CONFLICT_CODE: &str = "route.staticOutputConflict";

pub(crate) fn route_preflight_incomplete(actual: impl Into<String>) -> Diagnostic {
    Diagnostic::error(
        ROUTE_PREFLIGHT_INCOMPLETE_CODE,
        "Could not enumerate every workspace route source.",
    )
    .with_actual(actual)
    .with_expected("readable workspace configuration, directories and documents")
}

pub fn is_blocking_route_diagnostic(diagnostic: &Diagnostic) -> bool {
    diagnostic.severity == DiagnosticSeverity::Error
        && matches!(
            diagnostic.code.as_str(),
            ROUTE_RESERVED_CODE
                | ROUTE_INVALID_SEGMENT_CODE
                | ROUTE_COLLISION_CODE
                | ROUTE_PREFLIGHT_INCOMPLETE_CODE
        )
}

#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct RouteOwner {
    label: String,
    source: Option<String>,
}

struct RouteSource {
    path: String,
    owner: RouteOwner,
}

impl RouteSource {
    fn new(path: impl Into<String>, label: impl Into<String>, source: Option<&str>) -> Self {
        Self {
            path: path.into(),
            owner: RouteOwner {
                label: label.into(),
                source: source.map(str::to_string),
            },
        }
    }
}

/// Check canonical ownership and the generic static artifact layout from the same discovery.
pub(crate) fn route_diagnostics(
    entries: &[IndexEntry],
    views: &[IndexView],
    taxonomies: &BTreeMap<String, serde_yml::Value>,
    terms: &BTreeMap<String, BTreeMap<String, TaxonomyTermDefinition>>,
) -> Vec<Diagnostic> {
    let allocation = allocate_view_routes(views);
    let mut diagnostics = allocation.diagnostics;
    let mut routes = vec![RouteSource::new(
        "/",
        "the workspace home",
        Some(FORMA_CONFIG_PATH),
    )];
    for path in [BROWSE_ROUTE_PATH, VIEWS_ROUTE_PATH, HEALTH_ROUTE_PATH] {
        routes.push(RouteSource::new(
            path,
            format!("the system page {path}"),
            None,
        ));
    }

    let document_paths = entries.iter().flat_map(|entry| {
        std::iter::once(entry.path.as_str())
            .chain(entry.variants.iter().map(|variant| variant.path.as_str()))
    });
    for path in document_paths {
        let route = entry_route_path(path);
        if let Some(diagnostic) = reserved_content_diagnostic(path) {
            diagnostics.push(diagnostic);
            continue;
        }
        if canonical_route_path(&route).is_none() {
            diagnostics.push(
                Diagnostic::error(
                    ROUTE_INVALID_SEGMENT_CODE,
                    "Document route contains an invalid URL path segment.",
                )
                .with_path(path)
                .with_actual(format!("route `{route}`"))
                .with_expected("valid file path segments; rename or exclude the file"),
            );
            continue;
        }
        routes.push(RouteSource::new(
            route,
            format!("document {path}"),
            Some(path),
        ));
    }

    for directory in route_directories(entries) {
        if reserved_content_namespace(&directory.path).is_none()
            && canonical_route_path(&directory.route_path).is_some()
        {
            routes.push(RouteSource::new(
                directory.route_path,
                format!("directory {}/", directory.path),
                Some(&directory.path),
            ));
        }
    }

    for view in views {
        if let Some(id) = allocation.ids.get(&view.id) {
            routes.push(RouteSource::new(
                view_route_path(id),
                format!("view {}", view.path),
                Some(&view.path),
            ));
        }
    }

    for taxonomy_id in taxonomies.keys() {
        let valid_taxonomy = !invalid_route_segment(taxonomy_id);
        if valid_taxonomy {
            routes.push(RouteSource::new(
                taxonomy_route_path(taxonomy_id),
                format!("taxonomy {taxonomy_id}"),
                None,
            ));
        } else {
            diagnostics.push(invalid_segment_diagnostic("Taxonomy", taxonomy_id));
        }
        for term_id in terms.get(taxonomy_id).into_iter().flat_map(BTreeMap::keys) {
            if invalid_route_segment(term_id) {
                diagnostics.push(invalid_segment_diagnostic(
                    "Term",
                    &format!("{taxonomy_id}/{term_id}"),
                ));
            } else if valid_taxonomy {
                routes.push(RouteSource::new(
                    taxonomy_term_route_path(taxonomy_id, term_id),
                    format!("term {term_id:?} in taxonomy {taxonomy_id:?}"),
                    None,
                ));
            }
        }
    }

    diagnostics.extend(collision_diagnostics(&routes));
    diagnostics.extend(static_output_diagnostics(&routes));
    diagnostics
}

fn reserved_content_namespace(path: &str) -> Option<&str> {
    path.split('/')
        .next()
        .filter(|segment| matches!(*segment, SYSTEM_ROUTE_SEGMENT | TAXONOMY_ROUTE_SEGMENT))
}

pub(crate) fn reserved_content_diagnostic(path: &str) -> Option<Diagnostic> {
    let namespace = reserved_content_namespace(path)?;
    Some(
        Diagnostic::error(
            ROUTE_RESERVED_CODE,
            "Document route is inside a reserved top-level namespace.",
        )
        .with_path(path)
        .with_actual(format!("route {}", entry_route_path(path)))
        .with_expected(format!(
            "a top-level segment other than `{namespace}`; rename or exclude the file"
        )),
    )
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

fn describe_owners<'a>(owners: impl IntoIterator<Item = &'a RouteOwner>) -> String {
    owners
        .into_iter()
        .map(|owner| owner.label.as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

fn collision_diagnostics(routes: &[RouteSource]) -> Vec<Diagnostic> {
    let mut groups = BTreeMap::<&str, BTreeSet<&RouteOwner>>::new();
    for route in routes {
        groups.entry(&route.path).or_default().insert(&route.owner);
    }
    groups
        .into_iter()
        .filter(|(_, owners)| owners.len() > 1)
        .map(|(path, owners)| {
            let mut diagnostic = Diagnostic::error(
                ROUTE_COLLISION_CODE,
                "Distinct owners share one canonical route.",
            )
            .with_actual(format!(
                "route `{path}`: {}",
                describe_owners(owners.iter().copied())
            ))
            .with_expected("one owner per route; rename, move, or exclude a conflicting source");
            if let Some(source) = owners.iter().find_map(|owner| owner.source.as_deref()) {
                diagnostic = diagnostic.with_path(source);
            }
            diagnostic
        })
        .collect()
}

/// Validate decoded artifact paths before they are used as filesystem paths.
fn safe_artifact_output(output: &str) -> bool {
    !output.contains(['\\', '\0'])
        && output
            .split('/')
            .all(|segment| !invalid_route_segment(segment))
}

fn static_output_diagnostics(routes: &[RouteSource]) -> Vec<Diagnostic> {
    let mut outputs = BTreeMap::<String, BTreeSet<RouteOwner>>::new();
    for file in STATIC_SITE_ROOT_FILES
        .iter()
        .copied()
        .filter(|file| *file != "index.html")
    {
        outputs
            .entry(file.to_ascii_lowercase())
            .or_default()
            .insert(RouteOwner {
                label: format!("the artifact's root file {file}"),
                source: None,
            });
    }
    let mut diagnostics = Vec::new();
    for route in routes {
        let output = route_output_path(&route.path);
        if !safe_artifact_output(&output) {
            diagnostics.push(static_conflict(
                format!(
                    "`{output}` is not a safe output path for {}",
                    route.owner.label
                ),
                [&route.owner],
            ));
        } else {
            outputs
                .entry(output.to_ascii_lowercase())
                .or_default()
                .insert(route.owner.clone());
        }
    }

    for (file, owners) in &outputs {
        if owners.len() > 1 {
            diagnostics.push(static_conflict(
                format!("`{file}` is shared by {}", describe_owners(owners)),
                owners,
            ));
        }
        let prefix = format!("{file}/");
        let nested = outputs
            .range(prefix.clone()..)
            .take_while(|(path, _)| path.starts_with(&prefix))
            .collect::<Vec<_>>();
        if !nested.is_empty() {
            let descendants = nested
                .iter()
                .flat_map(|(_, owners)| owners.iter())
                .collect::<BTreeSet<_>>();
            diagnostics.push(static_conflict(
                format!(
                    "`{file}` is a file for {} and a required directory for {}",
                    describe_owners(owners),
                    describe_owners(descendants.iter().copied())
                ),
                owners.iter().chain(descendants),
            ));
        }
    }
    diagnostics
}

fn static_conflict<'a>(
    actual: String,
    owners: impl IntoIterator<Item = &'a RouteOwner>,
) -> Diagnostic {
    let mut diagnostic = Diagnostic::warning(
        ROUTE_STATIC_OUTPUT_CONFLICT_CODE,
        "A static site cannot safely publish these route outputs.",
    )
    .with_actual(actual)
    .with_expected(
        "rename or exclude a conflicting source to give each static path one safe owner",
    );
    if let Some(source) = owners.into_iter().find_map(|owner| owner.source.as_deref()) {
        diagnostic = diagnostic.with_path(source);
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
        assert_eq!(entry_route_path("notes/welcome.md"), "/notes/welcome.md");
        assert_eq!(entry_route_path("notes/index.md"), "/notes/index.md");
        assert_eq!(entry_route_path("index.md"), "/index.md");
        assert_eq!(entry_route_path("a b/100%.mdx"), "/a%20b/100%25.mdx");
        assert_eq!(directory_route_path(""), "/");
        assert_eq!(directory_route_path("notes/deep"), "/notes/deep");
        assert_eq!(view_route_path("board"), "/-/views/board");
        assert_eq!(taxonomy_route_path("browse"), "/~/browse");
        assert_eq!(taxonomy_term_route_path("areas", "a/b"), "/~/areas/a%2Fb");
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
        let diagnostics = diagnose(
            &["-/browse.md", "~/areas.md", "-.md", "~.md", "notes/-.md"],
            &[],
            &[],
        );

        assert_eq!(
            codes(&diagnostics),
            vec![
                (
                    ROUTE_RESERVED_CODE,
                    DiagnosticSeverity::Error,
                    Some("-/browse.md")
                ),
                (
                    ROUTE_RESERVED_CODE,
                    DiagnosticSeverity::Error,
                    Some("~/areas.md")
                ),
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
    fn reports_invalid_view_segments_with_source_paths() {
        let paths = [
            ".forma/views/.md",
            ".forma/views/..md",
            ".forma/views/...md",
        ];
        let diagnostics = diagnose(&[], &paths, &[]);
        for path in paths {
            assert!(
                diagnostics.iter().any(
                    |d| d.code == ROUTE_INVALID_SEGMENT_CODE && d.path.as_deref() == Some(path)
                )
            );
        }
    }

    #[test]
    fn requests_canonicalize_one_encoded_segment_at_a_time() {
        for (request, canonical) in [
            ("/", "/"),
            ("/notes/%74opic%2emd/", "/notes/topic.md"),
            ("/notes/a%2520b.mdx", "/notes/a%2520b.mdx"),
            ("/%7e/areas/a%2fb", "/~/areas/a%2Fb"),
            ("/~/areas/a%252Fb", "/~/areas/a%252Fb"),
            ("/-/views/a%2Fb", "/-/views/a%2Fb"),
        ] {
            assert_eq!(canonical_route_path(request).as_deref(), Some(canonical));
        }
        for invalid in [
            "//",
            "/notes//topic.md",
            "/notes/topic.md//",
            "/notes/%2Ftopic.md",
            "/notes/%5Ctopic.md",
            "/notes/%00topic.md",
            "/notes/%2e/topic.md",
            "/notes/%2e%2e/topic.md",
            "/notes/%ff.md",
            "/notes/%2.md",
        ] {
            assert_eq!(canonical_route_path(invalid), None, "{invalid}");
        }
    }

    #[test]
    fn file_directory_and_intro_paths_remain_distinct() {
        let entries = [
            entry("team.md"),
            entry("team/index.mdx"),
            entry("team/index.md"),
            entry("team/notes.md/deep.md"),
        ];
        let directories = route_directories(&entries);
        assert_eq!(
            &directories[0],
            &RouteDirectory {
                path: "team".into(),
                route_path: "/team".into(),
                output_path: "team/index.html".into(),
                intro_entry_path: Some("team/index.md".into()),
                child_directory_paths: vec!["team/notes.md".into()],
                entry_paths: vec!["team/index.md".into(), "team/index.mdx".into()],
            }
        );
        assert_eq!(directories[1].route_path, "/team/notes.md");
        assert!(diagnose(&["team.md", "team/index.md", "team/index.mdx"], &[], &[]).is_empty());
    }

    #[test]
    fn view_routes_are_order_independent_with_case_folded_basenames() {
        let mut views = [
            view(".forma/views/Daily.md"),
            view(".forma/alternate/daily.md"),
            view(".forma/views/100%#special.md"),
        ];
        let first = allocate_view_routes(&views);
        views.reverse();
        let reversed = allocate_view_routes(&views);
        assert!(first.diagnostics.is_empty());
        assert_eq!(first.ids, reversed.ids);
        assert_eq!(first.ids[".forma/views/Daily"], "Daily--274145cb0a22");
        assert_eq!(first.ids[".forma/alternate/daily"], "daily--2145c0d64f7f");
        assert_eq!(first.ids[".forma/views/100%#special"], "100%#special");
    }

    #[test]
    fn view_route_digests_extend_past_natural_names_and_other_prefixes() {
        let views = [
            view("first/board.md"),
            view("second/board.md"),
            view("third/board--aaaaaaaaaaaa.md"),
        ];
        let allocation = allocate_view_routes_with(&views, |id| {
            format!(
                "aaaaaaaaaaaa{}",
                if id.starts_with("first") {
                    "b".repeat(52)
                } else {
                    "c".repeat(52)
                }
            )
        });
        assert!(allocation.diagnostics.is_empty());
        assert_eq!(allocation.ids["first/board"], "board--aaaaaaaaaaaabbbb");
        assert_eq!(allocation.ids["second/board"], "board--aaaaaaaaaaaacccc");
        assert_eq!(
            allocation.ids["third/board--aaaaaaaaaaaa"],
            "board--aaaaaaaaaaaa"
        );
    }

    #[test]
    fn full_view_digest_exhaustion_reports_every_owner_together() {
        let views = [
            view("first/board.md"),
            view("second/board.md"),
            view("third/board.md"),
        ];
        let allocation = allocate_view_routes_with(&views, |_| "a".repeat(64));
        assert!(allocation.ids.is_empty());
        assert_eq!(allocation.diagnostics.len(), 1);
        let diagnostic = &allocation.diagnostics[0];
        assert!(is_blocking_route_diagnostic(diagnostic));
        assert!(
            diagnostic
                .actual
                .as_deref()
                .unwrap()
                .ends_with("first/board.md, second/board.md, third/board.md")
        );
    }

    #[test]
    fn static_outputs_conflicts_group_every_owner_and_keep_logical_routes() {
        let diagnostics = diagnose(
            &[
                "Notes/a.md",
                "notes/b.md",
                "guides/index.html/doc.md",
                "404.html/doc.md",
                "index.html/doc.md",
                "manual/Guide.md",
                "manual/guide.md/child.md",
            ],
            &[],
            &[
                ("areas", &["index.html", "a/b", "a%2Fb", "../escape"]),
                ("areas/a", &["b"]),
            ],
        );
        let conflicts = diagnostics
            .iter()
            .map(|diagnostic| {
                assert_eq!(diagnostic.code, ROUTE_STATIC_OUTPUT_CONFLICT_CODE);
                assert_eq!(diagnostic.severity, DiagnosticSeverity::Warning);
                diagnostic.actual.as_deref().unwrap()
            })
            .collect::<Vec<_>>();
        for (path, owners) in [
            (
                "notes/index.html",
                &["directory Notes/", "directory notes/"][..],
            ),
            ("~/areas/index.html", &["taxonomy areas", "index.html"][..]),
            (
                "404.html",
                &[
                    "directory 404.html/",
                    "document 404.html/doc.md",
                    "the artifact's root file 404.html",
                ][..],
            ),
            (
                "guides/index.html",
                &["directory guides/", "directory guides/index.html/"][..],
            ),
            (
                "index.html",
                &["the workspace home", "directory index.html/"][..],
            ),
            (
                "manual/guide.md/index.html",
                &["directory manual/guide.md/", "document manual/Guide.md"][..],
            ),
            (
                "~/areas/a/b/index.html",
                &[
                    "term \"a/b\" in taxonomy \"areas\"",
                    "term \"b\" in taxonomy \"areas/a\"",
                ][..],
            ),
            ("~/areas/../escape/index.html", &["term \"../escape\""][..]),
        ] {
            assert!(
                conflicts.iter().any(|conflict| conflict.contains(path)
                    && owners.iter().all(|owner| conflict.contains(owner))),
                "{path}: {conflicts:#?}"
            );
        }
        assert!(!conflicts.iter().any(|conflict| conflict.contains("a%2Fb")));
    }
}
