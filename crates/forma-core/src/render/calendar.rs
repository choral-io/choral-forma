use super::temporal::{Binding, civil, normalize};
use super::*;
use crate::schema::parse_space_schema;
use chrono::DateTime;
use chrono_tz::Tz;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CalendarCounts {
    pub candidates: usize,
    pub scheduled: usize,
    pub unscheduled: usize,
    pub invalid: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CalendarEntry {
    pub path: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub classification: Option<CalendarClassification>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CalendarClassification {
    pub label: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub path: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub classification: Option<CalendarClassification>,
    pub temporal: CalendarTemporal,
    pub first_date: String,
    pub after_last_date: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CalendarTemporal {
    Date {
        start: String,
        #[serde(rename = "endExclusive")]
        end_exclusive: String,
    },
    Datetime {
        start: String,
        #[serde(rename = "endExclusive")]
        end_exclusive: Option<String>,
    },
}

impl CalendarEvent {
    /// Deterministic, locale-neutral labels for semantic static output.
    pub fn range_label(&self, time_zone: &str) -> String {
        match &self.temporal {
            CalendarTemporal::Date {
                start,
                end_exclusive,
            } => {
                let last = civil(end_exclusive)
                    .and_then(|date| date.pred_opt())
                    .map(|date| date.to_string())
                    .unwrap_or_else(|| start.clone());
                if *start == last {
                    format!("{start} · All day")
                } else {
                    format!("{start} – {last} · All day")
                }
            }
            CalendarTemporal::Datetime {
                start,
                end_exclusive,
            } => {
                let display = |value: &str| {
                    DateTime::parse_from_rfc3339(value)
                        .ok()
                        .zip(time_zone.parse::<Tz>().ok())
                        .map(|(date, zone)| date.with_timezone(&zone).to_rfc3339())
                        .unwrap_or_else(|| value.into())
                };
                end_exclusive.as_ref().map_or_else(
                    || format!("{} ({time_zone})", display(start)),
                    |end| {
                        format!(
                            "{} – {} ({time_zone}, end exclusive)",
                            display(start),
                            display(end)
                        )
                    },
                )
            }
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Definition {
    start: Binding,
    end: Option<Binding>,
    #[serde(default = "monday")]
    first_day_of_week: String,
    presentation: Option<Presentation>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Presentation {
    events: GraphNodePresentationDefinition,
}

fn monday() -> String {
    "monday".into()
}

fn definition(value: Option<&Value>) -> Option<Definition> {
    let result: Definition = serde_yml::from_value(value?.clone()).ok()?;
    let valid_binding = |binding: &Binding| {
        binding.field.strip_prefix("fields.").is_some_and(|path| {
            path.split('.')
                .all(|part| !part.is_empty() && !part.contains(['[', ']']))
        })
    };
    (valid_binding(&result.start)
        && result.end.as_ref().is_none_or(valid_binding)
        && matches!(result.first_day_of_week.as_str(), "monday" | "sunday"))
    .then_some(result)
}

pub(super) fn validate(
    value: Option<&Value>,
    config: &WorkspaceConfig,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> bool {
    let mut valid = true;
    if definition(value).is_none() {
        diagnostics.push(Diagnostic::error("view.calendarBindingInvalid", "Calendar requires start.field (fields.<path>), optional end.field, and firstDayOfWeek monday or sunday.")
            .with_path(path).with_location(DiagnosticLocation::Frontmatter { field: "calendar".into(), index: None }));
        valid = false;
    }
    if config.workspace.timezone.parse::<Tz>().is_err() {
        diagnostics.push(
            Diagnostic::error(
                "view.calendarTimezoneInvalid",
                "Calendar requires a valid workspace IANA timezone.",
            )
            .with_path(path),
        );
        valid = false;
    }
    if let Some(color_by) = definition(value)
        .and_then(|def| def.presentation)
        .and_then(|presentation| presentation.events.color_by)
    {
        let error = match (&color_by.taxonomy, &color_by.field) {
            (Some(taxonomy), None) if config.taxonomies.contains_key(taxonomy) => None,
            (Some(_), None) => Some((
                "view.calendarTaxonomyMissing",
                "Calendar color taxonomy is not configured.",
            )),
            (None, Some(field)) if is_supported_graph_color_field(field) => None,
            _ => Some((
                "view.calendarColorByInvalid",
                "Calendar color source requires exactly one taxonomy or fields.<path> field.",
            )),
        };
        if let Some((code, message)) = error {
            diagnostics.push(
                Diagnostic::error(code, message)
                    .with_path(path)
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: "calendar.presentation.events.colorBy".into(),
                        index: None,
                    }),
            );
            valid = false;
        }
    }
    valid
}

fn classification(
    item: &RenderCandidate,
    def: &Definition,
    config: &WorkspaceConfig,
) -> Option<CalendarClassification> {
    classify(
        item,
        def.presentation
            .as_ref()
            .and_then(|p| p.events.color_by.as_ref()),
        config,
    )
}

pub(super) fn classify(
    item: &RenderCandidate,
    source: Option<&GraphNodeColorByDefinition>,
    config: &WorkspaceConfig,
) -> Option<CalendarClassification> {
    let source = source?;
    let (classification, color) = match (&source.taxonomy, &source.field) {
        (Some(taxonomy), None) => {
            let classification = graph_taxonomy_classification(item, config, taxonomy);
            let color = match classification.terms.as_slice() {
                [term] => config
                    .terms
                    .get(taxonomy)
                    .and_then(|terms| terms.get(term))
                    .and_then(|term| term.display.color.clone())
                    .or_else(|| taxonomy_display(config, taxonomy).color),
                _ => None,
            };
            (classification, color)
        }
        (None, Some(field)) => graph_field_classification_and_color(item, field),
        _ => return None,
    };
    Some(CalendarClassification {
        label: classification.label,
        color,
    })
}

pub(super) fn render(
    items: &[RenderCandidate],
    view: &ViewDefinition,
    config: &WorkspaceConfig,
    model: &ResolvedWorkspaceModel,
    view_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<ViewRenderOutput> {
    let def = definition(view.calendar.as_ref())?;
    if let Some(field) = def
        .presentation
        .as_ref()
        .and_then(|p| p.events.color_by.as_ref())
        .and_then(|c| c.field.as_deref())
    {
        let cardinality = graph_field_legend(items, field)
            .iter()
            .filter(|item| item.color.is_some())
            .count();
        if cardinality > GRAPH_COLOR_CARDINALITY_WARNING_THRESHOLD {
            diagnostics.push(
                Diagnostic::warning(
                    "view.calendarColorCardinalityHigh",
                    "Calendar color field has more than 24 distinct scalar values.",
                )
                .with_path(view_path),
            );
        }
    }
    let zone = config.workspace.timezone.parse::<Tz>().ok()?;
    let mut schemas = BTreeMap::new();
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
    let mut counts = CalendarCounts {
        candidates: items.len(),
        scheduled: 0,
        unscheduled: 0,
        invalid: 0,
    };
    let mut events = Vec::new();
    let mut unscheduled = Vec::new();
    for item in items {
        match normalize(item, &def.start, def.end.as_ref(), &schemas, zone) {
            Ok(Some(value)) => {
                let event = CalendarEvent {
                    path: item.path.clone(),
                    title: item.title.clone().unwrap_or_else(|| item.path.clone()),
                    classification: classification(item, &def, config),
                    temporal: value.temporal,
                    first_date: value.first_date,
                    after_last_date: value.after_last_date,
                };
                events.push(event);
            }
            Ok(None) => unscheduled.push(CalendarEntry {
                path: item.path.clone(),
                title: item.title.clone().unwrap_or_else(|| item.path.clone()),
                classification: classification(item, &def, config),
            }),
            Err((code, field, message)) => {
                counts.invalid += 1;
                diagnostics.push(
                    Diagnostic::warning(
                        format!("view.calendar{}", code.suffix()),
                        format!(
                            "{} Calendar View: {view_path}.",
                            message.replace("Temporal", "Calendar")
                        ),
                    )
                    .with_path(&item.path)
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: field.trim_start_matches("fields.").into(),
                        index: None,
                    }),
                );
            }
        }
    }
    if view.sort.is_empty() {
        events.sort_by(|a, b| {
            let key = |event: &CalendarEvent| match &event.temporal {
                CalendarTemporal::Date { .. } => (0, None),
                CalendarTemporal::Datetime { start, .. } => {
                    (1, DateTime::parse_from_rfc3339(start).ok())
                }
            };
            a.first_date
                .cmp(&b.first_date)
                .then_with(|| key(a).cmp(&key(b)))
                .then_with(|| a.path.cmp(&b.path))
        });
    }
    counts.scheduled = events.len();
    counts.unscheduled = unscheduled.len();
    Some(ViewRenderOutput::Calendar {
        time_zone: config.workspace.timezone.clone(),
        first_day_of_week: def.first_day_of_week,
        counts,
        events,
        unscheduled,
    })
}
