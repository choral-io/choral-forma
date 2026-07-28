use std::collections::BTreeMap;

use forma_core::render::ViewRenderFieldValue;
use forma_core::{
    StaticSiteEntry, StaticSiteEntryVariant, StaticSiteRoute, StaticSiteRouteKind,
    StaticSiteSnapshot, StaticSiteTaxonomy, StaticSiteTaxonomyTerm, StaticSiteView, ViewRenderItem,
    ViewRenderOutput,
};

pub(crate) struct StaticPage {
    pub canonical_route: String,
    pub description: String,
    pub language: String,
    pub output_path: String,
    pub title: String,
    pub body: String,
}

pub(crate) fn render_pages(
    snapshot: &StaticSiteSnapshot,
    root_path: &str,
) -> Result<Vec<StaticPage>, String> {
    let canonical_language = validated_language_tag(&snapshot.workspace.canonical_language)?;
    let entries_by_id = snapshot
        .entries
        .iter()
        .map(|entry| (entry.id.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let mut pages = Vec::with_capacity(snapshot.routes.len() + 1);
    pages.push(home_page(snapshot, root_path, &canonical_language));

    for route in &snapshot.routes {
        pages.push(route_page(
            snapshot,
            route,
            &entries_by_id,
            root_path,
            &canonical_language,
        )?);
    }
    disambiguate_metadata(&mut pages);
    pages.sort_by(|left, right| left.output_path.cmp(&right.output_path));
    Ok(pages)
}

fn disambiguate_metadata(pages: &mut [StaticPage]) {
    let mut titles = std::collections::BTreeSet::new();
    let mut descriptions = std::collections::BTreeSet::new();
    for page in pages {
        if !titles.insert(page.title.clone()) {
            let base = page.title.clone();
            let mut suffix = 1_usize;
            loop {
                let candidate = if suffix == 1 {
                    format!("{base} · {}", page.canonical_route)
                } else {
                    format!("{base} · {} · {suffix}", page.canonical_route)
                };
                if titles.insert(candidate.clone()) {
                    page.title = candidate;
                    break;
                }
                suffix += 1;
            }
        }
        if !descriptions.insert(page.description.clone()) {
            let base = page.description.clone();
            let mut suffix = 1_usize;
            loop {
                let candidate = if suffix == 1 {
                    format!("{base} Route: {}.", page.canonical_route)
                } else {
                    format!("{base} Route: {} ({suffix}).", page.canonical_route)
                };
                if descriptions.insert(candidate.clone()) {
                    page.description = candidate;
                    break;
                }
                suffix += 1;
            }
        }
    }
}

fn home_page(
    snapshot: &StaticSiteSnapshot,
    root_path: &str,
    canonical_language: &str,
) -> StaticPage {
    StaticPage {
        canonical_route: "/".to_string(),
        description: format!("Workspace home for {}.", snapshot.workspace.name),
        language: canonical_language.to_string(),
        output_path: "index.html".to_string(),
        title: snapshot.workspace.name.clone(),
        body: workspace_home_body(snapshot, root_path),
    }
}

fn workspace_home_body(snapshot: &StaticSiteSnapshot, root_path: &str) -> String {
    let home = &snapshot.workspace.home;
    if home.html.trim().is_empty() {
        return format!(
            "<header class=\"flex flex-col gap-3\"><p class=\"text-base-content/60 text-sm\">Workspace</p><h1 class=\"text-3xl font-semibold\">{}</h1><p class=\"text-base-content/60\">Browse this Markdown-backed workspace.</p></header>{}",
            escape_html(&snapshot.workspace.name),
            entry_list(snapshot.entries.iter(), root_path),
        );
    }
    format!(
        "<article class=\"flex min-w-0 flex-col gap-5\" data-workspace-home data-reader=\"markdown\">{}</article>",
        home.html,
    )
}

fn route_page(
    snapshot: &StaticSiteSnapshot,
    route: &StaticSiteRoute,
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
    canonical_language: &str,
) -> Result<StaticPage, String> {
    match route.kind {
        StaticSiteRouteKind::Entry => {
            let (title, description, body, language) =
                entry_route_content(snapshot, route, root_path, canonical_language)?
                    .ok_or_else(|| format!("static entry route has no entry: {}", route.path))?;
            Ok(page(route, title, description, body, language))
        }
        StaticSiteRouteKind::View => {
            let view = snapshot
                .views
                .iter()
                .find(|view| view.id == route.id)
                .ok_or_else(|| format!("static View route has no View: {}", route.path))?;
            Ok(page(
                route,
                view.title.clone().unwrap_or_else(|| view.id.clone()),
                format!("{} workspace View.", view.mode),
                view_body(view, entries_by_id, root_path),
                canonical_language.to_string(),
            ))
        }
        StaticSiteRouteKind::Pages => Ok(page(
            route,
            "Pages".to_string(),
            "All published workspace entries.".to_string(),
            format!(
                "<header class=\"flex flex-col gap-2\"><p class=\"text-base-content/60 text-sm\">Workspace</p><h1 class=\"text-3xl font-semibold\">Pages</h1></header>{}",
                entry_list(snapshot.entries.iter(), root_path)
            ),
            canonical_language.to_string(),
        )),
        StaticSiteRouteKind::Views => Ok(page(
            route,
            "Views".to_string(),
            "Configured workspace projections.".to_string(),
            view_list(&snapshot.views, root_path),
            canonical_language.to_string(),
        )),
        StaticSiteRouteKind::Taxonomies => Ok(page(
            route,
            "Browse".to_string(),
            "Browse configured workspace taxonomies.".to_string(),
            taxonomy_list(&snapshot.taxonomies, root_path),
            canonical_language.to_string(),
        )),
        StaticSiteRouteKind::Taxonomy => {
            let taxonomy = snapshot
                .taxonomies
                .iter()
                .find(|taxonomy| taxonomy.id == route.id)
                .ok_or_else(|| format!("static taxonomy route has no taxonomy: {}", route.path))?;
            Ok(page(
                route,
                taxonomy.title.clone(),
                taxonomy
                    .description
                    .clone()
                    .unwrap_or_else(|| "Configured workspace taxonomy.".to_string()),
                taxonomy_body(taxonomy, root_path),
                canonical_language.to_string(),
            ))
        }
        StaticSiteRouteKind::TaxonomyTerm => {
            let (taxonomy_id, term_id) = route
                .id
                .split_once('/')
                .ok_or_else(|| format!("invalid taxonomy term identity: {}", route.id))?;
            let taxonomy = snapshot
                .taxonomies
                .iter()
                .find(|taxonomy| taxonomy.id == taxonomy_id)
                .ok_or_else(|| format!("static term route has no taxonomy: {}", route.path))?;
            let term = taxonomy
                .terms
                .iter()
                .find(|term| term.id == term_id)
                .ok_or_else(|| format!("static term route has no term: {}", route.path))?;
            Ok(page(
                route,
                term.title.clone(),
                term.description
                    .clone()
                    .unwrap_or_else(|| format!("Entries classified as {}.", term.title)),
                term_body(term, entries_by_id, root_path),
                canonical_language.to_string(),
            ))
        }
    }
}

fn page(
    route: &StaticSiteRoute,
    title: String,
    description: String,
    body: String,
    language: String,
) -> StaticPage {
    StaticPage {
        canonical_route: route.path.clone(),
        description,
        language,
        output_path: route.output_path.clone(),
        title,
        body,
    }
}

fn entry_route_content(
    snapshot: &StaticSiteSnapshot,
    route: &StaticSiteRoute,
    root_path: &str,
    canonical_language: &str,
) -> Result<Option<(String, String, String, String)>, String> {
    for entry in &snapshot.entries {
        if entry.id == route.id {
            return Ok(Some((
                entry.title.clone().unwrap_or_else(|| entry.path.clone()),
                entry
                    .summary
                    .clone()
                    .unwrap_or_else(|| "Published workspace entry.".to_string()),
                entry_body(entry, &entry.route_path, root_path),
                canonical_language.to_string(),
            )));
        }
        if let Some(variant) = entry.variants.iter().find(|variant| variant.id == route.id) {
            let language = validated_language_tag(&variant.language)?;
            return Ok(Some((
                variant
                    .title
                    .clone()
                    .unwrap_or_else(|| variant.path.clone()),
                variant
                    .summary
                    .clone()
                    .or_else(|| entry.summary.clone())
                    .unwrap_or_else(|| "Published localized workspace entry.".to_string()),
                variant_body(entry, variant),
                language,
            )));
        }
    }
    Ok(None)
}

fn entry_body(entry: &StaticSiteEntry, route_path: &str, root_path: &str) -> String {
    format!(
        "<article class=\"flex min-w-0 flex-col gap-6\" data-static-entry-id=\"{}\"><header class=\"flex flex-col gap-3\" id=\"entry-top\"><p class=\"text-base-content/60 text-sm\">{}</p><h1 class=\"text-3xl font-semibold\">{}</h1>{}</header><div class=\"flex min-w-0 flex-col gap-5\" data-reader=\"markdown\">{}</div></article>",
        escape_attribute(&entry.id),
        escape_html(&entry.space),
        escape_html(entry.title.as_deref().unwrap_or(&entry.path)),
        optional_summary(entry.summary.as_deref()),
        rewrite_home_fragments(&entry.html, route_path, root_path),
    )
}

fn variant_body(canonical: &StaticSiteEntry, variant: &StaticSiteEntryVariant) -> String {
    format!(
        "<article class=\"flex min-w-0 flex-col gap-6\" data-static-entry-id=\"{}\"><header class=\"flex flex-col gap-3\" id=\"entry-top\"><p class=\"text-base-content/60 text-sm\">{} · {}</p><h1 class=\"text-3xl font-semibold\">{}</h1>{}</header><div class=\"flex min-w-0 flex-col gap-5\" data-reader=\"markdown\">{}</div></article>",
        escape_attribute(&variant.id),
        escape_html(&canonical.space),
        escape_html(&variant.language),
        escape_html(variant.title.as_deref().unwrap_or(&variant.path)),
        optional_summary(variant.summary.as_deref().or(canonical.summary.as_deref())),
        variant.html,
    )
}

fn rewrite_home_fragments(html: &str, route_path: &str, root_path: &str) -> String {
    if route_path != "/" {
        return html.to_string();
    }
    let canonical_prefix = format!("href=\"{}#", public_href(root_path, route_path));
    html.replace(&canonical_prefix, "href=\"#")
}

fn optional_summary(summary: Option<&str>) -> String {
    summary.map_or_else(String::new, |summary| {
        format!(
            "<p class=\"text-base-content/60 text-sm/6\">{}</p>",
            escape_html(summary)
        )
    })
}

fn entry_list<'a>(entries: impl Iterator<Item = &'a StaticSiteEntry>, root_path: &str) -> String {
    let items = entries
        .map(|entry| {
            format!(
                "<li class=\"list-row\"><div class=\"list-col-grow\"><a class=\"link font-medium\" href=\"{}\">{}</a>{}</div><code class=\"text-base-content/60 text-xs\">{}</code></li>",
                escape_attribute(&public_href(root_path, &entry.route_path)),
                escape_html(entry.title.as_deref().unwrap_or(&entry.path)),
                optional_list_summary(entry.summary.as_deref()),
                escape_html(&entry.path),
            )
        })
        .collect::<String>();
    format!(
        "<section class=\"mt-8\"><h2 class=\"text-xl font-semibold\">Entries</h2><ul class=\"list mt-4\">{items}</ul></section>"
    )
}

fn optional_list_summary(summary: Option<&str>) -> String {
    summary.map_or_else(String::new, |summary| {
        format!(
            "<p class=\"text-base-content/60 text-sm\">{}</p>",
            escape_html(summary)
        )
    })
}

fn view_list(views: &[StaticSiteView], root_path: &str) -> String {
    let cards = views
        .iter()
        .map(|view| {
            format!(
                "<li class=\"list-row\"><div class=\"list-col-grow\"><a class=\"link font-medium\" href=\"{}\">{}</a><p class=\"text-base-content/60 text-sm\">{} projection</p></div></li>",
                escape_attribute(&public_href(root_path, &view.route_path)),
                escape_html(view.title.as_deref().unwrap_or(&view.id)),
                escape_html(&view.mode),
            )
        })
        .collect::<String>();
    format!(
        "<header class=\"flex flex-col gap-2\"><p class=\"text-base-content/60 text-sm\">Workspace</p><h1 class=\"text-3xl font-semibold\">Views</h1></header><ul class=\"list mt-8\">{cards}</ul>"
    )
}

fn taxonomy_list(taxonomies: &[StaticSiteTaxonomy], root_path: &str) -> String {
    let items = taxonomies
        .iter()
        .map(|taxonomy| {
            format!(
                "<li class=\"list-row\"><div class=\"list-col-grow\"><a class=\"link font-medium\" href=\"{}\">{}</a>{}</div><span class=\"badge badge-outline badge-sm\">{} terms</span></li>",
                escape_attribute(&public_href(root_path, &taxonomy.route_path)),
                escape_html(&taxonomy.title),
                optional_list_summary(taxonomy.description.as_deref()),
                taxonomy.terms.len(),
            )
        })
        .collect::<String>();
    format!(
        "<header class=\"flex flex-col gap-2\"><p class=\"text-base-content/60 text-sm\">Workspace</p><h1 class=\"text-3xl font-semibold\">Browse</h1></header><ul class=\"list mt-8\">{items}</ul>"
    )
}

fn taxonomy_body(taxonomy: &StaticSiteTaxonomy, root_path: &str) -> String {
    let items = taxonomy
        .terms
        .iter()
        .map(|term| {
            format!(
                "<li class=\"list-row\"><div class=\"list-col-grow\"><a class=\"link font-medium\" href=\"{}\">{}</a>{}</div><span class=\"text-base-content/60 text-sm\">{} entries</span></li>",
                escape_attribute(&public_href(root_path, &term.route_path)),
                escape_html(&term.title),
                optional_list_summary(term.description.as_deref()),
                term.entry_ids.len(),
            )
        })
        .collect::<String>();
    format!(
        "<header class=\"flex flex-col gap-2\"><p class=\"text-base-content/60 text-sm\">Browse</p><h1 class=\"text-3xl font-semibold\">{}</h1>{}</header><ul class=\"list mt-8\">{items}</ul>",
        escape_html(&taxonomy.title),
        optional_summary(taxonomy.description.as_deref()),
    )
}

fn term_body(
    term: &StaticSiteTaxonomyTerm,
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
) -> String {
    let entries = term
        .entry_ids
        .iter()
        .filter_map(|id| entries_by_id.get(id.as_str()).copied());
    format!(
        "<header class=\"flex flex-col gap-2\"><p class=\"text-base-content/60 text-sm\">Browse</p><h1 class=\"text-3xl font-semibold\">{}</h1>{}</header>{}",
        escape_html(&term.title),
        optional_summary(term.description.as_deref()),
        entry_list(entries, root_path),
    )
}

fn view_body(
    view: &StaticSiteView,
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
) -> String {
    let prose = view.html.as_deref().unwrap_or("");
    let projection = view
        .projection
        .as_ref()
        .map_or_else(String::new, |projection| {
            projection_html(projection, entries_by_id, root_path)
        });
    format!(
        "<header class=\"flex flex-col gap-2\"><p class=\"text-base-content/60 text-sm\">Views · {}</p><h1 class=\"text-3xl font-semibold\">{}</h1></header><div class=\"mt-6 flex min-w-0 flex-col gap-5\" data-reader=\"markdown\">{}</div><section class=\"mt-8\" aria-label=\"View projection\">{}</section>",
        escape_html(&view.mode),
        escape_html(view.title.as_deref().unwrap_or(&view.id)),
        prose,
        projection,
    )
}

fn projection_html(
    projection: &ViewRenderOutput,
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
) -> String {
    match projection {
        ViewRenderOutput::List { items } => format!(
            "<ul class=\"list\">{}</ul>",
            projection_items(items, entries_by_id, root_path)
        ),
        ViewRenderOutput::Table { columns, items } => {
            let headings = columns
                .iter()
                .map(|column| format!("<th>{}</th>", escape_html(&column.label)))
                .collect::<String>();
            let rows = items
                .iter()
                .map(|item| {
                    let cells = columns
                        .iter()
                        .map(|column| {
                            format!(
                                "<td>{}</td>",
                                field_html(item.fields.get(&column.field), entries_by_id, root_path)
                            )
                        })
                        .collect::<String>();
                    format!("<tr>{cells}</tr>")
                })
                .collect::<String>();
            format!(
                "<div class=\"overflow-x-auto\"><table class=\"table table-sm\"><thead><tr>{headings}</tr></thead><tbody>{rows}</tbody></table></div>"
            )
        }
        ViewRenderOutput::Kanban { columns, .. } => columns
            .iter()
            .map(|column| {
                format!(
                    "<section class=\"card border-base-300 border\"><div class=\"card-body\"><h2 class=\"card-title\">{}</h2><ul class=\"list\">{}</ul></div></section>",
                    escape_html(&column.label),
                    projection_items(&column.items, entries_by_id, root_path),
                )
            })
            .collect::<String>(),
        ViewRenderOutput::Graph { nodes, edges, .. } => {
            let nodes = nodes
                .iter()
                .map(|node| {
                    let href = entries_by_id
                        .values()
                        .find(|entry| entry.path == node.path)
                        .map(|entry| public_href(root_path, &entry.route_path));
                    let title = node.title.as_deref().unwrap_or(&node.path);
                    href.map_or_else(
                        || format!("<li>{}</li>", escape_html(title)),
                        |href| {
                            format!(
                                "<li><a class=\"link\" href=\"{}\">{}</a></li>",
                                escape_attribute(&href),
                                escape_html(title)
                            )
                        },
                    )
                })
                .collect::<String>();
            let edges = edges
                .iter()
                .map(|edge| {
                    format!(
                        "<li><code>{}</code> → <code>{}</code></li>",
                        escape_html(&edge.source_path),
                        escape_html(&edge.target_path)
                    )
                })
                .collect::<String>();
            format!(
                "<div class=\"grid gap-6 md:grid-cols-2\"><section><h2 class=\"text-lg font-semibold\">Nodes</h2><ul class=\"mt-3 list-disc ps-5\">{nodes}</ul></section><section><h2 class=\"text-lg font-semibold\">Links</h2><ul class=\"mt-3 list-disc ps-5\">{edges}</ul></section></div>"
            )
        }
    }
}

fn projection_items(
    items: &[ViewRenderItem],
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
) -> String {
    items
        .iter()
        .map(|item| {
            let entry = entries_by_id.values().find(|entry| entry.path == item.path);
            let title = item.title.as_deref().unwrap_or(&item.path);
            let content = entry.map_or_else(
                || escape_html(title),
                |entry| {
                    format!(
                        "<a class=\"link font-medium\" href=\"{}\">{}</a>",
                        escape_attribute(&public_href(root_path, &entry.route_path)),
                        escape_html(title)
                    )
                },
            );
            format!("<li class=\"list-row\"><div class=\"list-col-grow\">{content}</div></li>")
        })
        .collect()
}

fn field_html(
    value: Option<&ViewRenderFieldValue>,
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
) -> String {
    match value {
        Some(ViewRenderFieldValue::Value { value }) => escape_html(&display_value(value)),
        Some(ViewRenderFieldValue::Reference { reference }) => {
            reference_html(&reference.path, &reference.title, entries_by_id, root_path)
        }
        Some(ViewRenderFieldValue::ReferenceList { references }) => references
            .iter()
            .map(|reference| {
                reference_html(&reference.path, &reference.title, entries_by_id, root_path)
            })
            .collect::<Vec<_>>()
            .join(", "),
        None => String::new(),
    }
}

fn display_value(value: &serde_yml::Value) -> String {
    match value {
        serde_yml::Value::Null => String::new(),
        serde_yml::Value::String(value) => value.clone(),
        serde_yml::Value::Number(value) => value.to_string(),
        serde_yml::Value::Bool(value) => value.to_string(),
        serde_yml::Value::Sequence(values) => values
            .iter()
            .map(display_value)
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join(", "),
        value => serde_json::to_string(value).unwrap_or_default(),
    }
}

fn reference_html(
    path: &str,
    title: &str,
    entries_by_id: &BTreeMap<&str, &StaticSiteEntry>,
    root_path: &str,
) -> String {
    entries_by_id
        .values()
        .find(|entry| entry.path == path)
        .map_or_else(
            || escape_html(title),
            |entry| {
                format!(
                    "<a class=\"link\" href=\"{}\">{}</a>",
                    escape_attribute(&public_href(root_path, &entry.route_path)),
                    escape_html(title)
                )
            },
        )
}

pub(crate) struct PageShellOptions<'a> {
    pub base_url: &'a str,
    pub embedded_index: &'a str,
    pub noindex: bool,
    pub page: &'a StaticPage,
    pub root_path: &'a str,
    pub workspace_name: &'a str,
    pub workspace_logo: Option<(&'a str, &'a str)>,
}

pub(crate) fn page_shell(options: PageShellOptions<'_>) -> String {
    let canonical = format!(
        "{}{}",
        options.base_url,
        public_href(options.root_path, &options.page.canonical_route)
    );
    let document_title = if options.page.title == options.workspace_name {
        options.page.title.clone()
    } else {
        format!("{} · {}", options.page.title, options.workspace_name)
    };
    let root_href = public_href(options.root_path, "/");
    let pages_href = public_href(options.root_path, "/pages");
    let views_href = public_href(options.root_path, "/views");
    let browse_href = public_href(options.root_path, "/browse");
    let logo = options
        .workspace_logo
        .map_or_else(String::new, |(path, alt)| {
            format!(
                "<img class=\"size-7\" src=\"{}\" alt=\"{}\" />",
                escape_attribute(path),
                escape_attribute(alt)
            )
        });
    let config = serde_json::json!({
        "baseUrl": options.base_url,
        "dataBaseUrl": public_href(options.root_path, "/data"),
        "rootPath": options.root_path,
    })
    .to_string()
    .replace('<', "\\u003c")
    .replace('\u{2028}', "\\u2028")
    .replace('\u{2029}', "\\u2029");
    let assets = embedded_head_assets(options.embedded_index, options.root_path);
    let robots = options
        .noindex
        .then_some("<meta name=\"robots\" content=\"noindex, nofollow\" />")
        .unwrap_or("");
    format!(
        "<!doctype html><html lang=\"{language}\"><head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" /><title>{title_text}</title><meta name=\"description\" content=\"{description}\" /><link rel=\"canonical\" href=\"{canonical}\" /><meta property=\"og:type\" content=\"website\" /><meta property=\"og:title\" content=\"{title_attribute}\" /><meta property=\"og:description\" content=\"{description}\" /><meta property=\"og:url\" content=\"{canonical}\" /><meta name=\"twitter:card\" content=\"summary\" /><meta name=\"twitter:title\" content=\"{title_attribute}\" /><meta name=\"twitter:description\" content=\"{description}\" />{robots}{assets}<script id=\"forma-static-workspace\" type=\"application/json\">{config}</script></head><body><div id=\"root\"><div class=\"bg-base-100 text-base-content min-h-screen\" data-static-fallback><header class=\"border-base-300 bg-base-100 border-b\"><nav aria-label=\"Primary\" class=\"navbar mx-auto max-w-6xl gap-3 px-4\"><a class=\"navbar-start min-w-0 gap-2 font-semibold\" href=\"{root_href}\">{logo}<span class=\"truncate\">{workspace}</span></a><div class=\"navbar-end gap-1\"><a class=\"btn btn-ghost btn-sm\" href=\"{pages_href}\">Pages</a><a class=\"btn btn-ghost btn-sm\" href=\"{views_href}\">Views</a><a class=\"btn btn-ghost btn-sm\" href=\"{browse_href}\">Browse</a></div></nav></header><main class=\"mx-auto w-full max-w-6xl px-4 py-10\">{body}</main></div></div></body></html>",
        language = escape_attribute(&options.page.language),
        title_text = escape_html(&document_title),
        title_attribute = escape_attribute(&document_title),
        description = escape_attribute(&options.page.description),
        canonical = escape_attribute(&canonical),
        workspace = escape_html(options.workspace_name),
        body = options.page.body,
    )
}

pub(crate) fn not_found_page(workspace_name: &str, language: &str) -> StaticPage {
    StaticPage {
        canonical_route: "/404.html".to_string(),
        description: "The requested static workspace route was not found.".to_string(),
        language: language.to_string(),
        output_path: "404.html".to_string(),
        title: "Not found".to_string(),
        body: format!(
            "<section class=\"card border-base-300 border\"><div class=\"card-body\"><p class=\"text-base-content/60 text-sm\">{}</p><h1 class=\"card-title\">Not found</h1><p>The requested static workspace route was not found.</p></div></section>",
            escape_html(workspace_name)
        ),
    }
}

fn validated_language_tag(value: &str) -> Result<String, String> {
    let value = value.trim();
    let mut segments = value.split('-');
    let Some(primary) = segments.next() else {
        return Err("static page language must be a valid language tag".to_string());
    };
    if primary.is_empty()
        || primary.len() > 8
        || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return Err(format!(
            "static page language is not a safe language tag: {value}"
        ));
    }
    if segments.any(|segment| {
        segment.is_empty()
            || segment.len() > 8
            || !segment.bytes().all(|byte| byte.is_ascii_alphanumeric())
    }) {
        return Err(format!(
            "static page language is not a safe language tag: {value}"
        ));
    }
    Ok(value.to_string())
}

fn embedded_head_assets(index: &str, root_path: &str) -> String {
    let Some(head) = index
        .split_once("<head")
        .and_then(|(_, rest)| rest.split_once('>'))
        .map(|(_, rest)| rest)
        .and_then(|rest| rest.split_once("</head>").map(|(head, _)| head))
    else {
        return String::new();
    };
    let mut tags = Vec::new();
    let mut cursor = 0;
    while cursor < head.len() {
        let link = head[cursor..].find("<link").map(|index| cursor + index);
        let script = head[cursor..].find("<script").map(|index| cursor + index);
        let start = match (link, script) {
            (Some(left), Some(right)) => left.min(right),
            (Some(value), None) | (None, Some(value)) => value,
            (None, None) => break,
        };
        if head[start..].starts_with("<link") {
            let Some(end) = head[start..].find('>') else {
                break;
            };
            tags.push(&head[start..=start + end]);
            cursor = start + end + 1;
        } else {
            let Some(end) = head[start..].find("</script>") else {
                break;
            };
            tags.push(&head[start..start + end + "</script>".len()]);
            cursor = start + end + "</script>".len();
        }
    }
    tags.into_iter()
        .filter(|tag| !tag.contains("/src/main."))
        .map(|tag| root_embedded_url(tag, root_path))
        .collect()
}

fn root_embedded_url(tag: &str, root_path: &str) -> String {
    let prefix = if root_path == "/" { "" } else { root_path };
    if tag.contains("=\"./") {
        tag.replace("=\"./", &format!("=\"{prefix}/"))
    } else {
        tag.replace("=\"/", &format!("=\"{prefix}/"))
    }
}

pub(crate) fn public_href(root_path: &str, logical_path: &str) -> String {
    if root_path == "/" {
        logical_path.to_string()
    } else if logical_path == "/" {
        format!("{root_path}/")
    } else {
        format!("{root_path}{logical_path}")
    }
}

pub(crate) fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn escape_attribute(value: &str) -> String {
    escape_html(value)
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

pub(crate) fn sitemap_xml(base_url: &str, root_path: &str, pages: &[StaticPage]) -> String {
    let urls = pages
        .iter()
        .map(|page| {
            let url = format!(
                "{}{}",
                base_url,
                public_href(root_path, &page.canonical_route)
            );
            format!("<url><loc>{}</loc></url>", escape_html(&url))
        })
        .collect::<String>();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">{urls}</urlset>\n"
    )
}

#[cfg(test)]
mod tests {
    use super::{
        PageShellOptions, StaticPage, display_value, escape_html, page_shell, public_href,
        root_embedded_url, validated_language_tag,
    };
    use serde::Deserialize;
    use serde_yml::Value;

    #[derive(Deserialize)]
    struct StaticFieldDisplayFixture {
        display: String,
        value: Value,
    }

    #[test]
    fn static_html_helpers_escape_and_root_urls() {
        assert_eq!(
            escape_html("<Forma & Friends>"),
            "&lt;Forma &amp; Friends&gt;"
        );
        assert_eq!(public_href("/", "/pages"), "/pages");
        assert_eq!(public_href("/preview", "/"), "/preview/");
        assert_eq!(public_href("/preview", "/raw/a.png"), "/preview/raw/a.png");
        assert_eq!(
            root_embedded_url(
                r#"<script type="module" src="./assets/app.js"></script>"#,
                "/preview"
            ),
            r#"<script type="module" src="/preview/assets/app.js"></script>"#
        );
    }

    #[test]
    fn static_html_field_values_match_the_static_field_display_fixture() {
        let fixtures: Vec<StaticFieldDisplayFixture> = serde_json::from_str(include_str!(
            "../../../fixtures/forma-validation/samples/projections/static-field-display.json"
        ))
        .unwrap();

        for fixture in fixtures {
            assert_eq!(display_value(&fixture.value), fixture.display);
        }
    }

    #[test]
    fn static_page_shell_escapes_metadata_and_visible_text() {
        let page = StaticPage {
            canonical_route: "/".to_string(),
            description: "\"><script>alert(1)</script>".to_string(),
            language: "zh-Hans".to_string(),
            output_path: "index.html".to_string(),
            title: "Forma \"<unsafe>".to_string(),
            body: "<p>trusted body</p>".to_string(),
        };
        let html = page_shell(PageShellOptions {
            base_url: "https://example.test",
            embedded_index: "",
            noindex: false,
            page: &page,
            root_path: "/",
            workspace_name: "Workspace \"<unsafe>",
            workspace_logo: None,
        });
        assert!(!html.contains("<script>alert(1)</script>"));
        assert!(html.contains("Forma &quot;&lt;unsafe&gt;"));
        assert!(html.contains("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"));
        assert!(html.contains(r#"<html lang="zh-Hans">"#));
        assert!(html.contains(r#"<script id="forma-static-workspace" type="application/json">"#));
        assert!(!html.contains("window.__FORMA_STATIC_WORKSPACE__"));
        assert!(html.contains(r#""dataBaseUrl":"/data""#));
    }

    #[test]
    fn static_page_languages_accept_safe_tags_and_reject_markup_or_paths() {
        assert_eq!(validated_language_tag("en-US").unwrap(), "en-US");
        assert_eq!(validated_language_tag("zh-Hans").unwrap(), "zh-Hans");
        for language in ["", "en_US", "en\"><script>", "../en", "en--US"] {
            assert!(validated_language_tag(language).is_err(), "{language}");
        }
    }
}
