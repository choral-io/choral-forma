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
            "forma-gantt-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )));
        f.write(".forma.md", &format!("---\nworkspace:\n  name: Gantt\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: {zone}\nimports: [config/*.md]\n---\n"));
        f.write("config/collections.md", "---\nkind: taxonomy\nid: collections\nprojection: contentGroups\ntitle: Collections\n---\n");
        f.write("config/exhibitions.md", &format!("---\nkind: term\ntaxonomy: collections\nid: exhibitions\ntitle: Exhibitions\ninclude: ['exhibitions/*.md']\nschema:\n  type: object\n  fields:\n    opensOn:\n      type: {kind}\n    closesOn:\n      type: {kind}\n    isMilestone: {{type: boolean}}\n    predecessors:\n      type: list\n      items: {{type: entryRef}}\n    otherRefs:\n      type: list\n      items: {{type: entryRef}}\n---\n"));
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
    fn view(&self, gantt: &str) {
        self.write("config/gantt.md", &format!("---\nkind: view\nmode: gantt\ntitle: Gantt\nsource:\n  type: pages\n  taxonomy:\n    collections: [exhibitions]\ngantt:\n  {gantt}\n---\n# Gantt\n\n<!-- forma:content -->\n"));
    }
    fn entry(&self, name: &str, fields: &str) {
        self.write(
            &format!("exhibitions/{name}.md"),
            &format!("---\ntitle: {name}\n{fields}\n---\n# {name}\n"),
        );
    }
    fn render(&self) -> forma_core::ViewRenderResult {
        render_view(&self.0, "config/gantt", BTreeMap::new()).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

fn projection(f: &Fixture) -> serde_json::Value {
    let result = f.render();
    assert!(result.render.is_some(), "{result:?}");
    let value = serde_json::to_value(result.render.unwrap()).unwrap();
    let nodes = value["nodes"].as_array().unwrap();
    let rows = value["rows"].as_array().unwrap();
    assert_eq!(value["counts"]["candidates"], nodes.len());
    assert_eq!(value["counts"]["scheduled"], rows.len());
    for node in nodes {
        let d = &node["dependencies"];
        assert_eq!(
            d["declared"].as_u64().unwrap(),
            d["predecessors"].as_array().unwrap().len() as u64
                + [
                    "outsideSelection",
                    "unresolved",
                    "duplicates",
                    "selfReferences"
                ]
                .iter()
                .map(|k| d[k].as_u64().unwrap())
                .sum::<u64>()
        );
    }
    for edge in value["edges"].as_array().unwrap() {
        for key in ["from", "to"] {
            assert!(nodes.iter().any(|n| n["path"] == edge[key]));
        }
        let anchored = ["from", "to"].iter().all(|key| {
            nodes
                .iter()
                .any(|n| n["path"] == edge[key] && n["status"] == "scheduled")
        });
        assert_eq!(
            edge["status"],
            if anchored { "anchored" } else { "unanchored" }
        );
    }
    let decoded: ViewRenderOutput = serde_json::from_value(value.clone()).unwrap();
    assert_eq!(serde_json::to_value(decoded).unwrap(), value);
    value
}

#[test]
fn graph_includes_invalid_unscheduled_nodes_and_cycles() {
    let f = Fixture::new("date", "UTC");
    f.view("start: {field: fields.opensOn}\n  end: {field: fields.closesOn}\n  dependencies: {field: fields.predecessors}\n  milestone: {field: fields.isMilestone}");
    f.entry("a", "opensOn: '2028-02-29'\nisMilestone: true\npredecessors: [exhibitions/b.md, exhibitions/c.md]");
    f.entry("b", "predecessors: [exhibitions/a.md]");
    f.entry(
        "c",
        "opensOn: '2027-02-29'\npredecessors: [exhibitions/b.md]",
    );
    let p = projection(&f);
    assert_eq!(
        p["counts"],
        serde_json::json!({"candidates":3,"scheduled":1,"unscheduled":1,"invalid":1})
    );
    assert_eq!(p["edges"].as_array().unwrap().len(), 4);
    assert_eq!(p["rows"][0]["milestone"], true);
    assert_eq!(p["rows"][0]["afterLastDate"], "2028-03-01");
    let result = f.render();
    let cycles: Vec<_> = result
        .diagnostics
        .iter()
        .filter(|d| d.code == "view.ganttDependencyCycle")
        .collect();
    assert_eq!(cycles.len(), 1);
    for path in ["exhibitions/a.md", "exhibitions/b.md", "exhibitions/c.md"] {
        assert!(cycles[0].message.contains(path));
    }
}

#[test]
fn duplicate_self_unresolved_and_filtered_targets_have_disjoint_counts() {
    let f = Fixture::new("date", "UTC");
    f.entry("a", "opensOn: '2028-01-01'\npredecessors: [missing.md, exhibitions/a.md, exhibitions/a.md, exhibitions/b.md, missing.md, exhibitions/b.md]\notherRefs: [exhibitions/c.md]");
    f.entry("b", "opensOn: '2028-01-02'");
    f.entry("c", "opensOn: '2028-01-03'");
    f.view("start: {field: fields.opensOn}\n  dependencies: {field: fields.predecessors}");
    let path = f.0.join("config/gantt.md");
    fs::write(
        &path,
        fs::read_to_string(&path).unwrap().replace(
            "gantt:\n",
            "query:\n  all:\n    - field: fields.title\n      op: equals\n      value: a\ngantt:\n",
        ),
    )
    .unwrap();
    let p = projection(&f);
    assert_eq!(
        p["nodes"][0]["dependencies"],
        serde_json::json!({"declared":6,"outsideSelection":1,"unresolved":2,"duplicates":2,"selfReferences":1,"predecessors":[]})
    );
    assert_eq!(p["edges"], serde_json::json!([]));
    assert!(!p.to_string().contains("exhibitions/b.md"));
    assert!(
        f.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.ganttDependencySelf")
    );
}

#[test]
fn wrong_bindings_collapse_with_ten_samples_and_keep_intervals() {
    let f = Fixture::new("date", "UTC");
    for i in 0..15 {
        f.entry(&format!("row-{i:02}"), "opensOn: '2028-01-01'");
    }
    f.view("start: {field: fields.opensOn}\n  dependencies: {field: fields.opensOn}\n  milestone: {field: fields.opensOn}");
    let p = projection(&f);
    assert_eq!(p["counts"]["scheduled"], 15);
    let result = f.render();
    for code in [
        "view.ganttDependencyFieldInvalid",
        "view.ganttMilestoneFieldInvalid",
    ] {
        let ds: Vec<_> = result
            .diagnostics
            .iter()
            .filter(|d| d.code == code)
            .collect();
        assert_eq!(ds.len(), 11);
        assert!(ds.iter().any(|d| d.actual.as_deref() == Some("15")));
    }
}

#[test]
fn dates_points_milestones_and_boundaries_reuse_calendar() {
    let f = Fixture::new("date", "UTC");
    f.view("start: {field: fields.opensOn}\n  end: {field: fields.closesOn}\n  milestone: {field: fields.isMilestone}");
    f.entry(
        "span",
        "opensOn: '2027-12-28'\nclosesOn: '2028-01-03'\nisMilestone: true",
    );
    f.entry("upper", "opensOn: '9999-12-31'");
    f.entry("zero", "opensOn: '0000-01-01'");
    f.entry("bad-flag", "opensOn: '2028-01-01'\nisMilestone: 'yes'");
    let p = projection(&f);
    assert_eq!(p["counts"]["invalid"], 2);
    assert_eq!(p["rows"][0]["afterLastDate"], "2028-01-04");
    assert_eq!(p["rows"][0]["milestone"], true);
    assert_eq!(p["rows"][1]["milestone"], false);
    assert!(
        !f.render()
            .diagnostics
            .iter()
            .any(|d| d.code == "view.ganttMilestoneFieldInvalid")
    );
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
        "point",
        "opensOn: '2026-11-01T06:00:00Z'\nclosesOn: '2026-11-01T06:00:00Z'",
    );
    let p = projection(&f);
    assert_eq!(p["rows"][0]["afterLastDate"], "2026-03-09");
    assert_eq!(p["rows"][1]["afterLastDate"], "2026-11-02");
    assert!(p["rows"][2]["temporal"]["endExclusive"].is_null());
    assert_eq!(p["rows"][2]["milestone"], false);
}

#[test]
fn empty_source_still_validates_dsl_and_timezone() {
    let f = Fixture::new("date", "UTC");
    assert_eq!(projection(&f)["counts"]["candidates"], 0);
    for binding in [
        "start: {field: opensOn}",
        "start: {field: fields.opensOn}\n  unknown: true",
        "start: {field: fields.opensOn}\n  dependencies: {field: fields.predecessors, relation: finishToFinish}",
    ] {
        f.view(binding);
        assert!(f.render().render.is_none());
    }
    let f = Fixture::new("date", "Invalid/Zone");
    assert!(f.render().render.is_none());
}

#[test]
fn shared_wire_fixture_matches_real_core_output() {
    let root =
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/getting-started-workspace");
    let result = render_view(root, ".forma/views/gantt", BTreeMap::new()).unwrap();
    let expected: serde_json::Value = serde_json::from_str(include_str!(
        "../../../packages/shared/src/fixtures/gantt-core.json"
    ))
    .unwrap();
    assert_eq!(
        serde_json::to_value(result.render.unwrap()).unwrap(),
        expected
    );
}

#[test]
fn nested_dependencies_match_exact_field_and_count_malformed_items() {
    let f = Fixture::new("date", "UTC");
    f.write("config/exhibitions.md", "---\nkind: term\ntaxonomy: collections\nid: exhibitions\ntitle: Exhibitions\ninclude: ['exhibitions/*.md']\nschema:\n  type: object\n  fields:\n    opensOn: {type: date}\n    schedule:\n      type: object\n      fields:\n        predecessors:\n          type: list\n          items: {type: entryRef}\n    predecessors:\n      type: list\n      items: {type: entryRef}\n---\n");
    f.view("start: {field: fields.opensOn}\n  dependencies: {field: fields.schedule.predecessors}");
    f.entry("a", "opensOn: '2028-01-01'\nschedule:\n  predecessors: [missing.md, exhibitions/b.md, null, 42, exhibitions/b.md]\npredecessors: [exhibitions/c.md]");
    f.entry("b", "opensOn: '2028-01-02'");
    f.entry("c", "schedule: {predecessors: null}");
    let p = projection(&f);
    assert_eq!(
        p["nodes"][0]["dependencies"],
        serde_json::json!({
            "declared":5,"outsideSelection":0,"unresolved":3,"duplicates":1,
            "selfReferences":0,"predecessors":["exhibitions/b.md"]
        })
    );
    assert_eq!(p["nodes"][1]["dependencies"]["declared"], 0);
    assert_eq!(p["nodes"][2]["dependencies"]["declared"], 0);
    assert_eq!(p["edges"].as_array().unwrap().len(), 1);
}

#[test]
fn scalar_dependencies_and_json_pair_edge_ids_are_preserved() {
    let f = Fixture::new("date", "UTC");
    f.write("config/exhibitions.md", "---\nkind: term\ntaxonomy: collections\nid: exhibitions\ntitle: Exhibitions\ninclude: ['exhibitions/*.md']\nschema:\n  type: object\n  fields:\n    opensOn: {type: date}\n    predecessors: {type: entryRef}\n---\n");
    f.view("start: {field: fields.opensOn}\n  dependencies: {field: fields.predecessors}");
    f.entry("a->b", "opensOn: '2028-01-01'");
    f.entry(
        "c",
        "opensOn: '2028-01-02'\npredecessors: 'exhibitions/a->b.md'",
    );
    let p = projection(&f);
    assert_eq!(p["nodes"][1]["dependencies"]["declared"], 1);
    assert_eq!(
        p["edges"][0]["id"],
        "[\"exhibitions/a->b.md\",\"exhibitions/c.md\"]"
    );
    assert_eq!(p["edges"][0]["status"], "anchored");
}
