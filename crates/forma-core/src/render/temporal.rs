use super::*;
use crate::schema::SchemaNode;
use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, SecondsFormat, Utc};
use chrono_tz::Tz;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Binding {
    pub(super) field: String,
}
impl Binding {
    pub(super) fn valid(&self) -> bool {
        self.field.strip_prefix("fields.").is_some_and(|path| {
            path.split('.')
                .all(|part| !part.is_empty() && !part.contains(['[', ']']))
        })
    }
}
pub(super) struct Normalized {
    pub(super) temporal: CalendarTemporal,
    pub(super) first_date: String,
    pub(super) after_last_date: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum TemporalType {
    Date,
    Datetime,
}

pub(super) fn field_node<'a>(
    schema: &'a SchemaNode,
    path: &str,
) -> Result<Option<&'a SchemaNode>, &'static str> {
    let mut node = schema;
    for part in path.split('.') {
        let SchemaNode::Object { fields, .. } = node else {
            return Err("Temporal binding cannot traverse a scalar or list.");
        };
        let Some(next) = fields.get(part) else {
            return Ok(None);
        };
        node = next;
    }
    Ok(Some(node))
}

pub(super) fn field_type(
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
                        "Temporal binding must resolve to a scalar date or datetime schema field.",
                    );
                }
            };
            if found.is_some_and(|previous| previous != kind) {
                return Err("Temporal field types conflict across applicable schemas.");
            }
            found = Some(kind);
        }
    }
    found.ok_or("Temporal field has no date or datetime schema declaration.")
}

pub(super) type Failure = (FailureKind, String, &'static str);
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum FailureKind {
    FieldType,
    Date,
    Interval,
}
impl FailureKind {
    pub(super) fn suffix(self) -> &'static str {
        match self {
            Self::FieldType => "FieldTypeInvalid",
            Self::Date => "DateInvalid",
            Self::Interval => "IntervalInvalid",
        }
    }
}
fn failure(code: FailureKind, field: &str, message: &'static str) -> Failure {
    (code, field.into(), message)
}

pub(super) fn civil(value: &str) -> Option<NaiveDate> {
    if value.len() != 10 || value.as_bytes()[4] != b'-' || value.as_bytes()[7] != b'-' {
        return None;
    }
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()?;
    ((1..=9999).contains(&date.year()) && date.to_string() == value).then_some(date)
}
fn next(date: NaiveDate) -> Option<NaiveDate> {
    date.succ_opt().filter(|date| date.year() <= 9999)
}

pub(super) fn normalize(
    item: &RenderCandidate,
    start_binding: &Binding,
    end_binding: Option<&Binding>,
    schemas: &BTreeMap<(String, String), Result<SchemaNode, String>>,
    zone: Tz,
) -> Result<Option<Normalized>, Failure> {
    let start_field = &start_binding.field;
    let end_field = end_binding.map_or(start_field, |end| &end.field);
    let kind = field_type(item, start_binding, schemas)
        .map_err(|msg| failure(FailureKind::FieldType, start_field, msg))?;
    if let Some(end) = end_binding {
        let end_kind = field_type(item, end, schemas)
            .map_err(|msg| failure(FailureKind::FieldType, end_field, msg))?;
        if kind != end_kind {
            return Err(failure(
                FailureKind::Interval,
                end_field,
                "Start and end schema types must agree.",
            ));
        }
    }
    let start = value_for_target(item, start_field).filter(|value| !value.is_null());
    let end = end_binding
        .and_then(|end| value_for_target(item, &end.field))
        .filter(|value| !value.is_null());
    let Some(start) = start else {
        return if end.is_some() {
            Err(failure(
                FailureKind::Interval,
                end_field,
                "End has no start.",
            ))
        } else {
            Ok(None)
        };
    };
    let invalid_start = || {
        failure(
            FailureKind::Date,
            start_field,
            "Start is not a valid date or offset datetime.",
        )
    };
    let invalid_end = || {
        failure(
            FailureKind::Date,
            end_field,
            "End is not a valid date or offset datetime.",
        )
    };
    let invalid_interval = || {
        failure(
            FailureKind::Interval,
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
    Ok(Some(Normalized {
        temporal,
        first_date: first_date.to_string(),
        after_last_date: after_last_date.to_string(),
    }))
}
