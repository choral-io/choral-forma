use forma_core::{ViewRenderOutput, render_view};
use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new(kind: &str, zone: &str) -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let f = Self(std::env::temp_dir().join(format!(
            "forma-calendar-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )));
        f.write(".forma.md", &format!("---\nworkspace:\n  name: Calendar\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: {zone}\nimports: [config/*.md]\n---\n"));
        f.write("config/collections.md", "---\nkind: taxonomy\nid: collections\nprojection: contentGroups\ntitle: Collections\n---\n");
        f.write("config/exhibitions.md", &format!("---\nkind: term\ntaxonomy: collections\nid: exhibitions\ntitle: Exhibitions\ninclude: ['exhibitions/*.md']\nschema:\n  type: object\n  fields:\n    opensOn:\n      type: {kind}\n    closesOn:\n      type: {kind}\n---\n"));
        f.view("start: {field: fields.opensOn}\n  end: {field: fields.closesOn}");
        f
    }
    fn write(&self, path: &str, content: &str) {
        let content = if path == ".forma.md" || path.starts_with("config/") {
            content.replacen("---\n", "---\nschemaVersion: 1\n", 1)
        } else {
            content.into()
        };
        let path = self.0.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }
    fn view(&self, calendar: &str) {
        self.write("config/calendar.md", &format!("---\nkind: view\nmode: calendar\ntitle: Calendar\nsource:\n  type: pages\n  taxonomy:\n    collections: [exhibitions]\ncalendar:\n  {calendar}\n---\n# Calendar\n\n<!-- forma:content -->\n"));
    }
    fn entry(&self, name: &str, fields: &str) {
        self.write(
            &format!("exhibitions/{name}.md"),
            &format!("---\ntitle: {name}\n{fields}\n---\n# {name}\n"),
        );
    }
    fn render(&self) -> forma_core::ViewRenderResult {
        render_view(&self.0, "config/calendar", BTreeMap::new()).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn shared_wire_fixture_matches_real_core_output() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/temporal-views");
    let result = render_view(root, "config/calendar", BTreeMap::new()).unwrap();
    let expected: serde_json::Value = serde_json::from_str(include_str!(
        "../../../packages/shared/src/fixtures/calendar-core.json"
    ))
    .unwrap();
    assert_eq!(
        serde_json::to_value(result.render.unwrap()).unwrap(),
        expected
    );
    // Independent oracles prevent a regenerated, reduced fixture from passing.
    assert_eq!(expected["timeZone"], "Asia/Kuala_Lumpur");
    assert_eq!(expected["firstDayOfWeek"], "sunday");
    assert_eq!(
        expected["counts"],
        serde_json::json!({"candidates":6,"scheduled":4,"unscheduled":1,"invalid":1})
    );
    let events = expected["events"].as_array().unwrap();
    assert_eq!(events.len(), 4);
    assert_eq!(
        events[0]["temporal"],
        serde_json::json!({"kind":"date","start":"2028-02-28","endExclusive":"2028-03-02"})
    );
    assert_eq!(events[1]["classification"]["color"], "#123456");
    assert_eq!(
        events[2]["temporal"],
        serde_json::json!({"kind":"datetime","start":"2028-03-02T15:00:00Z","endExclusive":"2028-03-02T16:00:00Z"})
    );
    assert_eq!(events[2]["firstDate"], "2028-03-02");
    assert_eq!(events[2]["afterLastDate"], "2028-03-03");
    assert_eq!(
        events[3]["temporal"],
        serde_json::json!({"kind":"datetime","start":"2028-03-02T16:30:00Z","endExclusive":null})
    );
    assert_eq!(events[3]["firstDate"], "2028-03-03");
    assert_eq!(
        events[3]["classification"],
        serde_json::json!({"label":"Unclassified","color":null})
    );
    assert_eq!(
        expected["unscheduled"],
        serde_json::json!([{"path":"exhibits/all-day/unscheduled.md","title":"Unscheduled Exhibit","classification":{"label":"Preparation","color":"#16A34A"}}])
    );
    for event in events {
        for gantt_only in ["milestone", "progress", "dependencies"] {
            assert!(event.get(gantt_only).is_none(), "{gantt_only}");
        }
    }
    assert!(expected.get("nodes").is_none());
    assert!(expected.get("edges").is_none());
    assert!(!expected.to_string().contains("hidden.md"));
    for code in ["entryRef.unresolved", "view.calendarIntervalInvalid"] {
        assert!(result.diagnostics.iter().any(|d| d.code == code), "{code}");
    }
}

#[test]
fn calendar_field_colors_reuse_graph_palette_and_preserve_neutral_values() {
    let f = Fixture::new("date", "UTC");
    for (name, value) in [
        ("a", "Painting"),
        ("b", "Painting"),
        ("hex", "'#ffffff'"),
        ("list", "[Painting]"),
        ("missing", "null"),
    ] {
        f.entry(name, &format!("opensOn: '2026-09-01'\ncategory: {value}"));
    }
    f.view("start: {field: fields.opensOn}\n  presentation:\n    events:\n      colorBy: {field: fields.category}");
    f.write("config/graph.md", "---\nkind: view\nmode: graph\nsource:\n  type: pages\n  include: ['exhibitions/*.md']\ngraph:\n  presentation:\n    nodes:\n      colorBy: {field: fields.category}\n---\n# Graph\n\n<!-- forma:content -->\n");
    let Some(ViewRenderOutput::Graph { legend, .. }) =
        render_view(&f.0, "config/graph", BTreeMap::new())
            .unwrap()
            .render
    else {
        panic!("graph");
    };
    let Some(ViewRenderOutput::Calendar { events, .. }) = f.render().render else {
        panic!("calendar");
    };
    for event in &events {
        let classification: &forma_core::CalendarClassification =
            event.classification.as_ref().unwrap();
        assert_eq!(
            classification.color,
            legend
                .iter()
                .find(|item| item.label == classification.label)
                .unwrap()
                .color
        );
    }
    assert_eq!(
        events
            .iter()
            .find(|e| e.title == "hex")
            .unwrap()
            .classification
            .as_ref()
            .unwrap()
            .color
            .as_deref(),
        Some("#FFFFFF")
    );
    for title in ["list", "missing"] {
        let classification = events
            .iter()
            .find(|e| e.title == title)
            .unwrap()
            .classification
            .as_ref()
            .unwrap();
        assert_eq!(classification.label, "Unclassified");
        assert_eq!(classification.color, None);
    }
    f.view("start: {field: fields.opensOn}");
    let value = serde_json::to_value(f.render().render.unwrap()).unwrap();
    assert!(value["events"][0].get("classification").is_none());
}

#[test]
fn calendar_taxonomy_colors_and_invalid_sources_are_explicit() {
    let f = Fixture::new("date", "UTC");
    f.entry("a", "opensOn: '2026-09-01'");
    let path = f.0.join("config/exhibitions.md");
    let source = fs::read_to_string(&path).unwrap().replace(
        "title: Exhibitions",
        "title: Exhibitions\ndisplay:\n  color: '#123456'",
    );
    fs::write(path, source).unwrap();
    f.view("start: {field: fields.opensOn}\n  presentation:\n    events:\n      colorBy: {taxonomy: collections}");
    let Some(ViewRenderOutput::Calendar { events, .. }) = f.render().render else {
        panic!("calendar");
    };
    let classification = events[0].classification.as_ref().unwrap();
    assert_eq!(classification.label, "Exhibitions");
    assert_eq!(classification.color.as_deref(), Some("#123456"));
    for (source, code) in [
        ("{taxonomy: absent}", "view.calendarTaxonomyMissing"),
        ("{field: title}", "view.calendarColorByInvalid"),
        (
            "{taxonomy: collections, field: fields.category}",
            "view.calendarColorByInvalid",
        ),
    ] {
        f.view(&format!("start: {{field: fields.opensOn}}\n  presentation:\n    events:\n      colorBy: {source}"));
        let result = f.render();
        assert!(result.render.is_none());
        assert!(result.diagnostics.iter().any(|d| d.code == code));
    }
}

#[test]
fn calendar_taxonomy_fallback_and_multiple_matches_stay_consistent() {
    let f = Fixture::new("date", "UTC");
    f.write("config/areas.md", "---\nkind: taxonomy\nid: areas\ntitle: Areas\nmode: multiple\ndisplay:\n  color: '#64748B'\n---\n");
    f.write("config/area-a.md", "---\nkind: term\ntaxonomy: areas\nid: a\ntitle: Area A\ninclude: ['exhibitions/a.md', 'exhibitions/both.md']\n---\n");
    f.write("config/area-b.md", "---\nkind: term\ntaxonomy: areas\nid: b\ntitle: Area B\ninclude: ['exhibitions/both.md']\ndisplay:\n  color: '#123456'\n---\n");
    for name in ["a", "both", "none"] {
        f.entry(name, "opensOn: '2026-09-01'");
    }
    f.view("start: {field: fields.opensOn}\n  presentation:\n    events:\n      colorBy: {taxonomy: areas}");
    let Some(ViewRenderOutput::Calendar { events, .. }) = f.render().render else {
        panic!("calendar");
    };
    for event in events {
        let classification = event.classification.unwrap();
        if event.title == "a" {
            assert_eq!(classification.color.as_deref(), Some("#64748B"));
        } else {
            assert_eq!(classification.color, None);
        }
    }
}

#[test]
fn calendar_selection_and_configured_sort_precede_projection() {
    let f = Fixture::new("date", "UTC");
    f.entry("a", "opensOn: '2028-03-01'\nvisible: true");
    f.entry("b", "opensOn: '2028-02-01'\nvisible: true");
    f.entry("filtered", "opensOn: 'bad'\nvisible: false");
    f.view("start: {field: fields.opensOn}");
    let path = f.0.join("config/calendar.md");
    let source = fs::read_to_string(&path).unwrap().replacen("calendar:\n", "query:\n  all:\n    - field: fields.visible\n      op: equals\n      value: true\nsort:\n  - field: fields.title\n    direction: desc\ncalendar:\n", 1);
    fs::write(path, source).unwrap();
    let result = f.render();
    assert!(
        !result
            .diagnostics
            .iter()
            .any(|d| d.code == "view.calendarDateInvalid")
    );
    let Some(ViewRenderOutput::Calendar { counts, events, .. }) = result.render else {
        panic!("{result:?}");
    };
    assert_eq!(counts.candidates, 2);
    assert_eq!(
        events.iter().map(|e| e.title.as_str()).collect::<Vec<_>>(),
        ["b", "a"]
    );
}

#[test]
fn calendar_nested_bindings_reject_list_traversal_and_mixed_end_types() {
    let f = Fixture::new("date", "UTC");
    f.write("config/exhibitions.md", "---\nkind: term\ntaxonomy: collections\nid: exhibitions\ntitle: Exhibitions\ninclude: ['exhibitions/*.md']\nschema:\n  type: object\n  fields:\n    schedule:\n      type: object\n      fields:\n        start: {type: date}\n        end: {type: datetime}\n    dates:\n      type: list\n      items: {type: date}\n---\n");
    f.entry(
        "nested",
        "schedule:\n  start: '2028-02-29'\n  end: '2028-03-01T10:00:00Z'\ndates: ['2028-02-29']",
    );
    f.view("start: {field: fields.schedule.start}");
    assert!(
        matches!(f.render().render, Some(ViewRenderOutput::Calendar { counts, .. }) if counts.scheduled == 1)
    );
    f.view("start: {field: fields.schedule.start}\n  end: {field: fields.schedule.end}");
    assert!(
        f.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.calendarIntervalInvalid")
    );
    f.view("start: {field: fields.dates.start}");
    assert!(
        f.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.calendarFieldTypeInvalid")
    );
}

#[test]
fn calendar_date_intervals_counts_and_serialization_follow_nonstandard_configuration() {
    let f = Fixture::new("date", "Europe/Paris");
    f.entry("leap", "opensOn: '2028-02-28'\nclosesOn: '2028-03-01'");
    f.entry("point", "opensOn: '2028-02-29'");
    f.entry("same", "opensOn: '2028-03-01'\nclosesOn: '2028-03-01'");
    f.entry("unscheduled", "");
    f.entry("bad", "opensOn: '2027-02-29'");
    f.entry("reverse", "opensOn: '2028-03-02'\nclosesOn: '2028-03-01'");
    f.entry("orphan", "closesOn: '2028-03-01'");
    f.entry("overflow", "opensOn: '9999-12-31'");
    let result = f.render();
    let Some(ViewRenderOutput::Calendar {
        counts,
        events,
        unscheduled,
        ..
    }) = &result.render
    else {
        panic!("{result:?}");
    };
    assert_eq!(
        (
            counts.candidates,
            counts.scheduled,
            counts.unscheduled,
            counts.invalid
        ),
        (8, 3, 1, 4)
    );
    assert_eq!(events[0].first_date, "2028-02-28");
    assert_eq!(events[0].after_last_date, "2028-03-02");
    assert_eq!(events[1].after_last_date, "2028-03-01");
    assert_eq!(events[2].after_last_date, "2028-03-02");
    assert_eq!(unscheduled[0].title, "unscheduled");
    let json = serde_json::to_value(&result.render).unwrap();
    assert_eq!(json["events"][0]["temporal"]["kind"], "date");
    assert!(json["events"][0].get("fields").is_none());
    assert_eq!(
        serde_json::from_value::<ViewRenderOutput>(json).unwrap(),
        result.render.unwrap()
    );
}

#[test]
fn calendar_datetime_uses_civil_days_across_dst_and_midnight() {
    let f = Fixture::new("datetime", "America/New_York");
    f.entry(
        "spring",
        "opensOn: '2026-03-08T00:00:00-05:00'\nclosesOn: '2026-03-09T00:00:00-04:00'",
    );
    f.entry(
        "fall",
        "opensOn: '2026-11-01T00:00:00-04:00'\nclosesOn: '2026-11-02T00:00:00-05:00'",
    );
    f.entry(
        "equal",
        "opensOn: '2026-11-01T06:00:00Z'\nclosesOn: '2026-11-01T06:00:00Z'",
    );
    f.entry("offsetless", "opensOn: '2026-11-01T01:30:00'");
    let result = f.render();
    let Some(ViewRenderOutput::Calendar { events, counts, .. }) = result.render else {
        panic!("{result:?}");
    };
    assert_eq!(counts.invalid, 1);
    assert_eq!(
        (&events[0].first_date[..], &events[0].after_last_date[..]),
        ("2026-03-08", "2026-03-09")
    );
    assert_eq!(
        (&events[1].first_date[..], &events[1].after_last_date[..]),
        ("2026-11-01", "2026-11-02")
    );
    assert_eq!(
        serde_json::to_value(&events[2].temporal).unwrap()["endExclusive"],
        serde_json::Value::Null
    );
}

#[test]
fn calendar_point_uses_workspace_timezone_and_invalid_config_never_falls_back() {
    let f = Fixture::new("datetime", "Asia/Shanghai");
    f.entry("point", "opensOn: '2026-09-20T16:30:00Z'");
    let result = f.render();
    let Some(ViewRenderOutput::Calendar { events, .. }) = result.render else {
        panic!("{result:?}");
    };
    assert_eq!(events[0].first_date, "2026-09-21");
    f.view("start: {field: opensOn}");
    assert!(
        f.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.calendarBindingInvalid")
    );
    let bad = Fixture::new("date", "Not/AZone");
    assert!(
        bad.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.calendarTimezoneInvalid")
    );
    assert!(bad.render().render.is_none());
}

#[test]
fn calendar_rejects_string_inference_and_conflicting_applicable_schemas() {
    let f = Fixture::new("string", "UTC");
    f.entry("string", "opensOn: '2028-02-29'");
    assert!(
        f.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.calendarFieldTypeInvalid")
    );
    let f = Fixture::new("date", "UTC");
    f.entry("overlap", "opensOn: '2028-02-29'");
    f.write("config/other.md", "---\nkind: term\ntaxonomy: collections\nid: other\ntitle: Other\ninclude: ['exhibitions/*.md']\nschema:\n  type: object\n  fields:\n    opensOn: {type: string}\n---\n");
    let result = f.render();
    // Existing workspace membership validation rejects ambiguous schemas before
    // Calendar candidate selection; do not bypass that shared contract.
    assert!(
        result
            .diagnostics
            .iter()
            .any(|d| d.code == "page.schemaMembership.ambiguous"),
        "{result:?}"
    );
    assert!(
        matches!(result.render, Some(ViewRenderOutput::Calendar { counts, .. }) if counts.candidates == 0)
    );
}

#[test]
fn calendar_empty_projection_is_valid_and_missing_end_binding_is_optional() {
    let f = Fixture::new("date", "UTC");
    assert_eq!(f.render().summary.errors, 0);
    f.view("start: {field: fields.opensOn}\n  firstDayOfWeek: sunday");
    f.entry("one", "opensOn: '2028-01-01'");
    let result = f.render();
    let Some(ViewRenderOutput::Calendar {
        first_day_of_week,
        counts,
        ..
    }) = result.render
    else {
        panic!("{result:?}");
    };
    assert_eq!(first_day_of_week, "sunday");
    assert_eq!(counts.scheduled, 1);
}
