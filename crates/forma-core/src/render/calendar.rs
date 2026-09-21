use super::*;
use crate::schema::{SchemaNode, parse_space_schema};
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, SecondsFormat, Utc};
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

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Binding {
    field: String,
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
    let source = def.presentation.as_ref()?.events.color_by.as_ref()?;
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

#[derive(Clone, Copy, PartialEq, Eq)]
enum TemporalType {
    Date,
    Datetime,
}

fn field_node<'a>(
    schema: &'a SchemaNode,
    path: &str,
) -> Result<Option<&'a SchemaNode>, &'static str> {
    let mut node = schema;
    for part in path.split('.') {
        let SchemaNode::Object { fields, .. } = node else {
            return Err("Calendar binding cannot traverse a scalar or list.");
        };
        let Some(next) = fields.get(part) else {
            return Ok(None);
        };
        node = next;
    }
    Ok(Some(node))
}

fn field_type(
    item: &RenderCandidate,
    binding: &Binding,
    schemas: &BTreeMap<(String, String), Result<SchemaNode, String>>,
) -> Result<TemporalType, &'static str> {
    let mut found = None;
    for (taxonomy, terms) in &item.taxonomies {
        for term in terms {
            let Some(schema) = schemas.get(&(taxonomy.clone(), term.clone())) else {
                continue;
            };
            let schema = schema
                .as_ref()
                .map_err(|_| "Applicable schema is invalid.")?;
            let Some(node) = field_node(schema, &binding.field[7..])? else {
                continue;
            };
            let kind = match node {
                SchemaNode::Date { .. } => TemporalType::Date,
                SchemaNode::DateTime { .. } => TemporalType::Datetime,
                _ => {
                    return Err(
                        "Calendar binding must resolve to a scalar date or datetime schema field.",
                    );
                }
            };
            if found.is_some_and(|previous| previous != kind) {
                return Err("Calendar field types conflict across applicable schemas.");
            }
            found = Some(kind);
        }
    }
    found.ok_or("Calendar field has no date or datetime schema declaration.")
}

type Failure = (&'static str, String, &'static str);
fn failure(code: &'static str, field: &str, message: &'static str) -> Failure {
    (code, field.into(), message)
}

fn civil(value: &str) -> Option<NaiveDate> {
    if value.len() != 10 || value.as_bytes()[4] != b'-' || value.as_bytes()[7] != b'-' {
        return None;
    }
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()?;
    ((1..=9999).contains(&date.year()) && date.to_string() == value).then_some(date)
}
fn next(date: NaiveDate) -> Option<NaiveDate> {
    date.succ_opt().filter(|date| date.year() <= 9999)
}

fn normalize(
    item: &RenderCandidate,
    def: &Definition,
    schemas: &BTreeMap<(String, String), Result<SchemaNode, String>>,
    zone: Tz,
) -> Result<Option<CalendarEvent>, Failure> {
    let start_field = &def.start.field;
    let end_field = def.end.as_ref().map_or(start_field, |end| &end.field);
    let kind = field_type(item, &def.start, schemas)
        .map_err(|msg| failure("view.calendarFieldTypeInvalid", start_field, msg))?;
    if let Some(end) = &def.end {
        let end_kind = field_type(item, end, schemas)
            .map_err(|msg| failure("view.calendarFieldTypeInvalid", end_field, msg))?;
        if kind != end_kind {
            return Err(failure(
                "view.calendarIntervalInvalid",
                end_field,
                "Start and end schema types must agree.",
            ));
        }
    }
    let start = value_for_target(item, start_field).filter(|value| !value.is_null());
    let end = def
        .end
        .as_ref()
        .and_then(|end| value_for_target(item, &end.field))
        .filter(|value| !value.is_null());
    let Some(start) = start else {
        return if end.is_some() {
            Err(failure(
                "view.calendarIntervalInvalid",
                end_field,
                "End has no start.",
            ))
        } else {
            Ok(None)
        };
    };
    let invalid_start = || {
        failure(
            "view.calendarDateInvalid",
            start_field,
            "Start is not a valid date or offset datetime.",
        )
    };
    let invalid_end = || {
        failure(
            "view.calendarDateInvalid",
            end_field,
            "End is not a valid date or offset datetime.",
        )
    };
    let invalid_interval = || {
        failure(
            "view.calendarIntervalInvalid",
            end_field,
            "Interval is reversed or exceeds the supported date range.",
        )
    };
    let start = start.as_str().ok_or_else(invalid_start)?;
    let end = end
        .as_ref()
        .map(|value| value.as_str().ok_or_else(invalid_end))
        .transpose()?;
    let (temporal, first_date, after_last_date) = match kind {
        TemporalType::Date => {
            let start = civil(start).ok_or_else(invalid_start)?;
            let end = end
                .map(|value| civil(value).ok_or_else(invalid_end))
                .transpose()?
                .unwrap_or(start);
            if end < start {
                return Err(invalid_interval());
            }
            let after = next(end).ok_or_else(invalid_interval)?;
            (
                CalendarTemporal::Date {
                    start: start.to_string(),
                    end_exclusive: after.to_string(),
                },
                start,
                after,
            )
        }
        TemporalType::Datetime => {
            let start = DateTime::parse_from_rfc3339(start)
                .map_err(|_| invalid_start())?
                .with_timezone(&Utc);
            let end = end
                .map(|value| {
                    DateTime::parse_from_rfc3339(value)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|_| invalid_end())
                })
                .transpose()?;
            if end.is_some_and(|end| end < start) {
                return Err(invalid_interval());
            }
            let end = end.filter(|end| *end != start);
            let first = start.with_timezone(&zone).date_naive();
            let last = end.unwrap_or(start).with_timezone(&zone);
            let after = if end.is_some() && last.time() == NaiveTime::MIN {
                last.date_naive()
            } else {
                next(last.date_naive()).ok_or_else(invalid_interval)?
            };
            if !(1..=9999).contains(&first.year()) || !(1..=9999).contains(&after.year()) {
                return Err(invalid_interval());
            }
            (
                CalendarTemporal::Datetime {
                    start: start.to_rfc3339_opts(SecondsFormat::AutoSi, true),
                    end_exclusive: end.map(|end| end.to_rfc3339_opts(SecondsFormat::AutoSi, true)),
                },
                first,
                after,
            )
        }
    };
    Ok(Some(CalendarEvent {
        path: item.path.clone(),
        title: item.title.clone().unwrap_or_else(|| item.path.clone()),
        classification: None,
        temporal,
        first_date: first_date.to_string(),
        after_last_date: after_last_date.to_string(),
    }))
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
        match normalize(item, &def, &schemas, zone) {
            Ok(Some(mut event)) => {
                event.classification = classification(item, &def, config);
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
                    Diagnostic::warning(code, format!("{message} Calendar View: {view_path}."))
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
