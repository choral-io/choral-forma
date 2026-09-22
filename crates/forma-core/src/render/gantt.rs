use super::temporal::{Binding, FailureKind, field_node, normalize};
use super::*;
use crate::config::SemanticType;
use crate::index::ReferenceSource;
use crate::schema::{SchemaNode, parse_space_schema};
use chrono_tz::Tz;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GanttStatus {
    Scheduled,
    Unscheduled,
    Invalid,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GanttDependencies {
    pub declared: usize,
    pub outside_selection: usize,
    pub unresolved: usize,
    pub duplicates: usize,
    pub self_references: usize,
    pub predecessors: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GanttNode {
    pub path: String,
    pub title: String,
    pub status: GanttStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub classification: Option<CalendarClassification>,
    pub dependencies: GanttDependencies,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GanttRow {
    pub path: String,
    pub temporal: CalendarTemporal,
    pub first_date: String,
    pub after_last_date: String,
    pub milestone: bool,
}

impl GanttRow {
    pub fn range_label(&self, time_zone: &str) -> String {
        CalendarEvent {
            path: self.path.clone(),
            title: String::new(),
            classification: None,
            temporal: self.temporal.clone(),
            first_date: self.first_date.clone(),
            after_last_date: self.after_last_date.clone(),
        }
        .range_label(time_zone)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GanttEdgeStatus {
    Anchored,
    Unanchored,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GanttEdge {
    pub id: String,
    pub from: String,
    pub to: String,
    pub relation: String,
    pub status: GanttEdgeStatus,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Definition {
    start: Binding,
    end: Option<Binding>,
    milestone: Option<Binding>,
    dependencies: Option<DependencyBinding>,
    presentation: Option<Presentation>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DependencyBinding {
    field: String,
    #[serde(default = "finish_to_start")]
    relation: String,
}
fn finish_to_start() -> String {
    "finishToStart".into()
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Presentation {
    rows: GraphNodePresentationDefinition,
}

fn definition(value: Option<&Value>) -> Option<Definition> {
    let def: Definition = serde_yml::from_value(value?.clone()).ok()?;
    (def.start.valid()
        && def.end.as_ref().is_none_or(Binding::valid)
        && def.milestone.as_ref().is_none_or(Binding::valid)
        && def.dependencies.as_ref().is_none_or(|d| {
            Binding {
                field: d.field.clone(),
            }
            .valid()
                && d.relation == "finishToStart"
        }))
    .then_some(def)
}

pub(super) fn validate(
    value: Option<&Value>,
    config: &WorkspaceConfig,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> bool {
    let Some(def) = definition(value) else {
        diagnostics.push(Diagnostic::error("view.ganttBindingInvalid", "Gantt requires fields.<path> bindings and only supports finishToStart dependencies.").with_path(path)
            .with_location(DiagnosticLocation::Frontmatter { field: "gantt".into(), index: None }));
        return false;
    };
    let mut valid = true;
    if config.workspace.timezone.parse::<Tz>().is_err() {
        diagnostics.push(
            Diagnostic::error(
                "view.ganttTimezoneInvalid",
                "Gantt requires a valid workspace IANA timezone.",
            )
            .with_path(path),
        );
        valid = false;
    }
    if let Some(color) = def.presentation.and_then(|p| p.rows.color_by) {
        let supported = match (&color.taxonomy, &color.field) {
            (Some(taxonomy), None) => config.taxonomies.contains_key(taxonomy),
            (None, Some(field)) => is_supported_graph_color_field(field),
            _ => false,
        };
        if !supported {
            diagnostics.push(
                Diagnostic::error(
                    "view.ganttBindingInvalid",
                    "Gantt color source requires one configured taxonomy or fields.<path> field.",
                )
                .with_path(path),
            );
            valid = false;
        }
    }
    valid
}

type Schemas = BTreeMap<(String, String), Result<SchemaNode, String>>;

fn reference_kind(node: &SchemaNode, config: &WorkspaceConfig) -> Option<bool> {
    let scalar = |node: &SchemaNode| match node {
        SchemaNode::EntryRef { .. } => true,
        SchemaNode::Named { name, .. } => {
            matches!(config.types.get(name), Some(SemanticType::EntryRef { .. }))
        }
        _ => false,
    };
    if scalar(node) {
        Some(false)
    } else if let SchemaNode::List { items, .. } = node {
        scalar(items).then_some(true)
    } else {
        None
    }
}

fn auxiliary_binding(
    item: &RenderCandidate,
    field: &str,
    schemas: &Schemas,
    config: &WorkspaceConfig,
    dependency: bool,
) -> Result<(), &'static str> {
    let mut found = None;
    for (taxonomy, terms) in &item.taxonomies {
        for term in terms {
            let Some(schema) = schemas.get(&(taxonomy.clone(), term.clone())) else {
                continue;
            };
            let node = field_node(
                schema
                    .as_ref()
                    .map_err(|_| "Applicable schema is invalid.")?,
                &field[7..],
            )?;
            let Some(node) = node else { continue };
            let kind = if dependency {
                reference_kind(node, config)
            } else {
                matches!(node, SchemaNode::Boolean { .. }).then_some(false)
            }
            .ok_or("Binding has an unsupported schema type.")?;
            if found.is_some_and(|previous| previous != kind) {
                return Err("Binding types conflict across applicable schemas.");
            }
            found = Some(kind);
        }
    }
    found
        .map(|_| ())
        .ok_or("Binding has no applicable schema declaration.")
}

fn dependencies(
    item: &RenderCandidate,
    field: &str,
    selected: &BTreeSet<&str>,
) -> GanttDependencies {
    let declared = match value_for_target(item, field) {
        None | Some(Value::Null) => 0,
        Some(Value::Sequence(values)) => values.len(),
        Some(_) => 1,
    };
    let refs: Vec<_> = item
        .references
        .iter()
        .filter(|r| {
            r.source == ReferenceSource::Frontmatter && r.field.as_deref() == Some(&field[7..])
        })
        .collect();
    let mut result = GanttDependencies {
        declared,
        unresolved: declared.saturating_sub(refs.len()),
        ..Default::default()
    };
    let mut seen = BTreeSet::new();
    for reference in refs {
        let target = &reference.target_path;
        if !seen.insert(target) {
            result.duplicates += 1;
        } else if target == &item.path {
            result.self_references += 1;
        } else if !selected.contains(target.as_str()) {
            result.outside_selection += 1;
        } else {
            result.predecessors.push(target.clone());
        }
    }
    result.predecessors.sort();
    result
}

// Iterative Kosaraju avoids recursion limits for long dependency chains.
fn cyclic_components(nodes: &[GanttNode], edges: &[GanttEdge]) -> Vec<Vec<String>> {
    let indices: BTreeMap<_, _> = nodes
        .iter()
        .enumerate()
        .map(|(i, n)| (n.path.as_str(), i))
        .collect();
    let mut forward = vec![Vec::new(); nodes.len()];
    let mut reverse = forward.clone();
    for e in edges {
        let a = indices[e.from.as_str()];
        let b = indices[e.to.as_str()];
        forward[a].push(b);
        reverse[b].push(a);
    }
    let mut seen = vec![false; nodes.len()];
    let mut order = Vec::new();
    for root in 0..nodes.len() {
        let mut stack = vec![(root, false)];
        while let Some((node, exit)) = stack.pop() {
            if exit {
                order.push(node);
                continue;
            }
            if std::mem::replace(&mut seen[node], true) {
                continue;
            }
            stack.push((node, true));
            stack.extend(forward[node].iter().rev().map(|n| (*n, false)));
        }
    }
    seen.fill(false);
    let mut components = Vec::new();
    for root in order.into_iter().rev() {
        if seen[root] {
            continue;
        }
        let mut component = Vec::new();
        let mut stack = vec![root];
        while let Some(node) = stack.pop() {
            if std::mem::replace(&mut seen[node], true) {
                continue;
            }
            component.push(nodes[node].path.clone());
            stack.extend(&reverse[node]);
        }
        if component.len() > 1 {
            component.sort();
            components.push(component);
        }
    }
    components.sort();
    components
}

pub(super) fn render(
    items: &[RenderCandidate],
    view: &ViewDefinition,
    config: &WorkspaceConfig,
    model: &ResolvedWorkspaceModel,
    view_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<ViewRenderOutput> {
    let def = definition(view.gantt.as_ref())?;
    let zone = config.workspace.timezone.parse::<Tz>().ok()?;
    let mut schemas = Schemas::new();
    for item in items {
        for (taxonomy, terms) in &item.taxonomies {
            for term in terms {
                if let Some(group) = model.content_group_for_taxonomy_term(taxonomy, term) {
                    schemas
                        .entry((taxonomy.clone(), term.clone()))
                        .or_insert_with(|| parse_space_schema(group));
                }
            }
        }
    }
    let selected: BTreeSet<_> = items.iter().map(|i| i.path.as_str()).collect();
    let mut nodes = Vec::new();
    let mut rows = Vec::new();
    let mut grouped: BTreeMap<(String, String, String), Vec<String>> = BTreeMap::new();
    for item in items {
        let mut milestone = false;
        if let Some(binding) = &def.milestone {
            match auxiliary_binding(item, &binding.field, &schemas, config, false) {
                Ok(()) => {
                    milestone = value_for_target(item, &binding.field).and_then(|v| v.as_bool())
                        == Some(true)
                }
                Err(reason) => grouped
                    .entry((
                        "view.ganttMilestoneFieldInvalid".into(),
                        binding.field.clone(),
                        reason.into(),
                    ))
                    .or_default()
                    .push(item.path.clone()),
            }
        }
        let mut deps = GanttDependencies::default();
        if let Some(binding) = &def.dependencies {
            match auxiliary_binding(item, &binding.field, &schemas, config, true) {
                Ok(()) => deps = dependencies(item, &binding.field, &selected),
                Err(reason) => grouped
                    .entry((
                        "view.ganttDependencyFieldInvalid".into(),
                        binding.field.clone(),
                        reason.into(),
                    ))
                    .or_default()
                    .push(item.path.clone()),
            }
            if deps.self_references > 0 {
                diagnostics.push(
                    Diagnostic::warning("view.ganttDependencySelf", "Self dependency omitted.")
                        .with_path(&item.path)
                        .with_location(DiagnosticLocation::Frontmatter {
                            field: binding.field[7..].into(),
                            index: None,
                        }),
                );
            }
        }
        let status = match normalize(item, &def.start, def.end.as_ref(), &schemas, zone) {
            Ok(Some(value)) => {
                rows.push(GanttRow {
                    path: item.path.clone(),
                    temporal: value.temporal,
                    first_date: value.first_date,
                    after_last_date: value.after_last_date,
                    milestone,
                });
                GanttStatus::Scheduled
            }
            Ok(None) => GanttStatus::Unscheduled,
            Err((kind, field, reason)) => {
                let code = format!("view.gantt{}", kind.suffix());
                if kind == FailureKind::FieldType
                    || reason == "Start and end schema types must agree."
                {
                    grouped
                        .entry((code, field, reason.into()))
                        .or_default()
                        .push(item.path.clone());
                } else {
                    diagnostics.push(
                        Diagnostic::warning(code, format!("{reason} Gantt View: {view_path}."))
                            .with_path(&item.path)
                            .with_location(DiagnosticLocation::Frontmatter {
                                field: field[7..].into(),
                                index: None,
                            }),
                    );
                }
                GanttStatus::Invalid
            }
        };
        nodes.push(GanttNode {
            path: item.path.clone(),
            title: item.title.clone().unwrap_or_else(|| item.path.clone()),
            status,
            classification: calendar::classify(
                item,
                def.presentation
                    .as_ref()
                    .and_then(|p| p.rows.color_by.as_ref()),
                config,
            ),
            dependencies: deps,
        });
    }
    for ((code, field, reason), mut paths) in grouped {
        paths.sort();
        paths.dedup();
        diagnostics.push(
            Diagnostic::warning(
                &code,
                format!(
                    "{field}: {reason} {} affected candidates; at most ten samples follow.",
                    paths.len()
                ),
            )
            .with_path(view_path)
            .with_actual(paths.len().to_string()),
        );
        for path in paths.into_iter().take(10) {
            diagnostics.push(
                Diagnostic::warning(&code, &reason)
                    .with_path(path)
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: field[7..].into(),
                        index: None,
                    }),
            );
        }
    }
    nodes.sort_by(|a, b| a.path.cmp(&b.path));
    if view.sort.is_empty() {
        rows.sort_by(|a, b| {
            (&a.first_date, &a.after_last_date, &a.path).cmp(&(
                &b.first_date,
                &b.after_last_date,
                &b.path,
            ))
        });
    }
    let scheduled: BTreeSet<_> = rows.iter().map(|r| r.path.as_str()).collect();
    let mut edges = Vec::new();
    for node in &nodes {
        for from in &node.dependencies.predecessors {
            edges.push(GanttEdge {
                id: serde_json::to_string(&(from, &node.path)).expect("string pair"),
                from: from.clone(),
                to: node.path.clone(),
                relation: finish_to_start(),
                status: if scheduled.contains(from.as_str())
                    && scheduled.contains(node.path.as_str())
                {
                    GanttEdgeStatus::Anchored
                } else {
                    GanttEdgeStatus::Unanchored
                },
            });
        }
    }
    edges.sort_by(|a, b| (&a.from, &a.to).cmp(&(&b.from, &b.to)));
    for component in cyclic_components(&nodes, &edges) {
        diagnostics.push(
            Diagnostic::warning(
                "view.ganttDependencyCycle",
                format!(
                    "Cycle in the selected dependency graph: {}.",
                    component.join(", ")
                ),
            )
            .with_path(view_path),
        );
    }
    let counts = CalendarCounts {
        candidates: nodes.len(),
        scheduled: rows.len(),
        unscheduled: nodes
            .iter()
            .filter(|n| n.status == GanttStatus::Unscheduled)
            .count(),
        invalid: nodes
            .iter()
            .filter(|n| n.status == GanttStatus::Invalid)
            .count(),
    };
    Some(ViewRenderOutput::Gantt {
        time_zone: config.workspace.timezone.clone(),
        counts,
        nodes,
        rows,
        edges,
    })
}
