use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use super::*;
use crate::diagnostics::OperationStatus;
use crate::index::check_workspace;
use crate::operations::{
    create_entry, create_preview, init_workspace, inspect_entry_by_path, list_files,
    workspace_health,
};
use crate::render::{ViewRenderOutput, render_view};

pub(super) fn observation() -> SliceChoice {
    SliceChoice {
        outcome: "Compare study observations by date and method".into(),
        taxonomy_id: "collections".into(),
        group_id: "observations".into(),
        title: "Study observations".into(),
        fields: [
            (
                "observedOn".into(),
                FieldChoice {
                    kind: FieldKind::Date,
                    label: "Observation date".into(),
                    required: true,
                    reason: "Compare observations over time".into(),
                },
            ),
            (
                "method".into(),
                FieldChoice {
                    kind: FieldKind::Text,
                    label: "Method".into(),
                    required: true,
                    reason: "Compare the measurement method".into(),
                },
            ),
        ]
        .into(),
        view_columns: vec!["observedOn".into(), "method".into()],
        layout: SliceLayout {
            taxonomy_file: ".forma/research.md".into(),
            group_file: ".forma/spaces/observations.md".into(),
            template_file: "scaffolds/observation.md".into(),
            view_file: ".forma/views/observations.md".into(),
            content_directory: "records".into(),
        },
    }
}

pub(super) struct Fixture(pub(super) PathBuf);
impl Fixture {
    pub(super) fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "forma-model-{}-{}-{}",
            {
                static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
                NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            },
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        Self(root)
    }
    // Test materialization only: production compilation deliberately has no
    // filesystem access or apply path until confirmation/preconditions exist.
    fn materialize(&self, files: &[FilePreview]) {
        for file in files {
            let path = self.0.join(&file.path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, &file.content).unwrap();
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn observation_preview_creates_and_retrieves_a_real_entry() {
    let root = Fixture::new();
    assert_eq!(
        init_workspace(&root.0, "Study", "en", "UTC")
            .unwrap()
            .status,
        OperationStatus::Passed
    );
    let before = fs::read(root.0.join(".forma.md")).unwrap();
    let choice = observation();
    let files = compile_slice(&choice).unwrap();
    assert_eq!(files, compile_slice(&choice).unwrap());
    assert!(!root.0.join("records").exists());
    root.materialize(&files);
    assert_eq!(fs::read(root.0.join(".forma.md")).unwrap(), before);
    let check = check_workspace(&root.0);
    assert_eq!(
        check.status,
        OperationStatus::Passed,
        "{:?}",
        check.diagnostics
    );
    let health = workspace_health(&root.0).unwrap();
    assert_eq!(
        health.status,
        OperationStatus::Passed,
        "{:?}",
        health.diagnostics
    );

    let inputs = [
        (
            "title".into(),
            serde_yml::Value::String("Morning observation".into()),
        ),
        (
            "observedOn".into(),
            serde_yml::Value::String("2026-09-09".into()),
        ),
        (
            "method".into(),
            serde_yml::Value::String("Microscopy".into()),
        ),
    ]
    .into();
    let preview = create_preview(&root.0, "observations", inputs).unwrap();
    assert_eq!(
        preview.status,
        OperationStatus::Passed,
        "{:?}",
        preview.diagnostics
    );
    let created = create_entry(
        &root.0,
        "observations",
        [
            (
                "title".into(),
                serde_yml::Value::String("Morning observation".into()),
            ),
            (
                "observedOn".into(),
                serde_yml::Value::String("2026-09-09".into()),
            ),
            (
                "method".into(),
                serde_yml::Value::String("Microscopy".into()),
            ),
        ]
        .into(),
    )
    .unwrap();
    assert_eq!(created.status, OperationStatus::Passed);
    let entry = inspect_entry_by_path(&root.0, "records/morning-observation.md").unwrap();
    assert_eq!(entry.entry.space.as_deref(), Some("observations"));
    assert_eq!(entry.entry.metadata["method"], "Microscopy");
    assert_eq!(entry.entry.metadata["observedOn"], "2026-09-09");
    assert!(
        list_files(&root.0)
            .unwrap()
            .files
            .iter()
            .any(|file| file.path == "records/morning-observation.md")
    );
    let view = render_view(&root.0, ".forma/views/observations", BTreeMap::new()).unwrap();
    assert_eq!(
        view.status,
        OperationStatus::Passed,
        "{:?}",
        view.diagnostics
    );
    let Some(ViewRenderOutput::Table { columns, items }) = view.render else {
        panic!("expected a table")
    };
    assert_eq!(
        columns.iter().map(|c| c.field.as_str()).collect::<Vec<_>>(),
        ["fields.title", "fields.observedOn", "fields.method"]
    );
    assert_eq!(items.len(), 1);
    let after = check_workspace(&root.0);
    assert_eq!(
        after.status,
        OperationStatus::Passed,
        "{:?}",
        after.diagnostics
    );
}

#[test]
fn rejecting_a_field_requires_a_new_consistent_preview() {
    let mut choice = observation();
    let before = compile_slice(&choice).unwrap();
    choice.fields.remove("method");
    assert!(
        compile_slice(&choice).is_err(),
        "the view must not silently retain a rejected field"
    );
    choice.view_columns.retain(|name| name != "method");
    let after = compile_slice(&choice).unwrap();
    assert_eq!(before[0], after[0], "the taxonomy has not changed");
    for index in [1, 2, 3] {
        assert_ne!(before[index].content, after[index].content);
    }
    let root = Fixture::new();
    init_workspace(&root.0, "Study", "en", "UTC").unwrap();
    root.materialize(&after);
    let result = create_preview(
        &root.0,
        "observations",
        [
            (
                "title".into(),
                serde_yml::Value::String("Reduced model".into()),
            ),
            (
                "observedOn".into(),
                serde_yml::Value::String("2026-09-09".into()),
            ),
        ]
        .into(),
    )
    .unwrap();
    assert_eq!(result.status, OperationStatus::Passed);
}

#[test]
fn rejects_ambiguous_or_unsafe_destinations() {
    let mut choice = observation();
    choice.layout.template_file = "./.forma/spaces/observations.md".into();
    assert!(
        compile_slice(&choice).is_err(),
        "aliases must not hide duplicate targets"
    );
    choice = observation();
    choice.layout.content_directory = ".forma".into();
    assert!(compile_slice(&choice).is_err());
    choice = observation();
    choice.layout.group_file = "../outside.md".into();
    assert!(compile_slice(&choice).is_err());
    choice = observation();
    choice.group_id = "observation\ninjected".into();
    assert!(compile_slice(&choice).is_err());
}

#[test]
fn structured_templates_preserve_values_and_omit_optional_fields() {
    let root = Fixture::new();
    init_workspace(&root.0, "Values", "en", "UTC").unwrap();
    let mut choice = observation();
    choice.fields.get_mut("method").unwrap().required = false;
    choice.fields.get_mut("observedOn").unwrap().required = false;
    root.materialize(&compile_slice(&choice).unwrap());
    let title = "A \"quoted\" title: true\nsecond line\n---\ninjected: false";
    let preview = create_preview(
        &root.0,
        "observations",
        [
            ("title".into(), serde_yml::Value::String(title.into())),
            ("slug".into(), serde_yml::Value::String("quoted".into())),
        ]
        .into(),
    )
    .unwrap();
    assert_eq!(
        preview.status,
        OperationStatus::Passed,
        "{:?}",
        preview.diagnostics
    );
    let metadata = preview.content.frontmatter.unwrap();
    assert_eq!(metadata["title"], title);
    assert!(metadata.get("method").is_none());
    assert!(metadata.get("observedOn").is_none());
    let method = "O'Brien\n\"double\"\ntrue: null\n{{ input.title }}";
    let created = create_entry(
        &root.0,
        "observations",
        [
            ("title".into(), serde_yml::Value::String(title.into())),
            ("slug".into(), serde_yml::Value::String("quoted".into())),
            ("method".into(), serde_yml::Value::String(method.into())),
        ]
        .into(),
    )
    .unwrap();
    assert_eq!(created.status, OperationStatus::Passed);
    let entry = inspect_entry_by_path(&root.0, "records/quoted.md").unwrap();
    assert_eq!(entry.entry.metadata["method"], method);
    assert_eq!(entry.entry.metadata["title"], title);
}

#[test]
fn plans_apply_and_create_retrievable_entries_in_three_domains() {
    for (group_id, title, directory) in [
        ("observations", "Study observations", "records"),
        ("decisions", "Technical decisions", "local"),
        ("incidents", "Service incidents", "service-records"),
    ] {
        let root = Fixture::new();
        init_workspace(&root.0, title, "en", "UTC").unwrap();
        let mut choice = observation();
        choice.group_id = group_id.into();
        choice.title = title.into();
        choice.layout.content_directory = directory.into();
        if group_id != "observations" {
            choice.fields.remove("observedOn");
            choice.fields.remove("method");
            let name = if group_id == "decisions" {
                "rationale"
            } else {
                "nextAction"
            };
            choice.fields.insert(
                name.into(),
                FieldChoice {
                    kind: FieldKind::Text,
                    label: name.into(),
                    required: true,
                    reason: "Make the decision or next action retrievable".into(),
                },
            );
            choice.view_columns = vec![name.into()];
        }
        let before = fs::read(root.0.join(".forma.md")).unwrap();
        let plan = prepare_plan(&root.0, &choice).unwrap();
        assert_eq!(plan, prepare_plan(&root.0, &choice).unwrap());
        assert!(
            plan.files
                .iter()
                .all(|file| !root.0.join(&file.path).exists())
        );
        assert!(apply_plan(&root.0, &plan, "yes").is_err());
        let report = apply_plan(&root.0, &plan, &plan.id).unwrap();
        assert_eq!(report.status, ApplyStatus::Applied, "{:?}", report.error);
        assert_eq!(report.written.len(), 4);
        assert_eq!(fs::read(root.0.join(".forma.md")).unwrap(), before);
        assert!(apply_plan(&root.0, &plan, &plan.id).is_err());
        let mut inputs = BTreeMap::from([(
            "title".into(),
            serde_yml::Value::String("First record".into()),
        )]);
        for (name, field) in &choice.fields {
            inputs.insert(
                name.clone(),
                serde_yml::Value::String(
                    match field.kind {
                        FieldKind::Text => "A reviewed choice",
                        FieldKind::Date => "2026-09-09",
                    }
                    .into(),
                ),
            );
        }
        let created = create_entry(&root.0, group_id, inputs).unwrap();
        assert_eq!(created.status, OperationStatus::Passed);
        let entry = inspect_entry_by_path(&root.0, &created.created.path).unwrap();
        assert_eq!(entry.entry.space.as_deref(), Some(group_id));
        assert_eq!(
            crate::operations::list_space(&root.0, group_id)
                .unwrap()
                .entries
                .len(),
            1
        );
        let view = render_view(&root.0, ".forma/views/observations", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { items, .. }) = view.render else {
            panic!("missing table")
        };
        assert_eq!(items.len(), 1);
        assert_eq!(check_workspace(&root.0).status, OperationStatus::Passed);
    }
}

#[test]
fn stale_tampered_conflicting_and_unreachable_plans_do_not_write() {
    let root = Fixture::new();
    init_workspace(&root.0, "Plans", "en", "UTC").unwrap();
    let choice = observation();
    let plan = prepare_plan(&root.0, &choice).unwrap();
    let mut tampered = plan.clone();
    tampered.files[0].content.push_str("# Unauthorized edit\n");
    assert!(apply_plan(&root.0, &tampered, &tampered.id).is_err());
    let other = Fixture::new();
    init_workspace(&other.0, "Plans", "en", "UTC").unwrap();
    assert!(apply_plan(&other.0, &plan, &plan.id).is_err());
    let mut unreachable = choice.clone();
    unreachable.layout.taxonomy_file = "unimported/collections.md".into();
    assert!(prepare_plan(&root.0, &unreachable).is_err());
    fs::write(
        root.0.join(".forma.md"),
        fs::read_to_string(root.0.join(".forma.md")).unwrap() + "\n<!-- changed -->\n",
    )
    .unwrap();
    assert!(apply_plan(&root.0, &plan, &plan.id).is_err());
    assert!(!root.0.join(&choice.layout.taxonomy_file).exists());
    let plan = prepare_plan(&root.0, &choice).unwrap();
    fs::create_dir_all(root.0.join("records")).unwrap();
    fs::write(root.0.join("records/existing.md"), "# Original").unwrap();
    assert!(apply_plan(&root.0, &plan, &plan.id).is_err());
    assert_eq!(
        fs::read_to_string(root.0.join("records/existing.md")).unwrap(),
        "# Original"
    );
    fs::remove_file(root.0.join("records/existing.md")).unwrap();
    let plan = prepare_plan(&root.0, &choice).unwrap();
    fs::create_dir_all(root.0.join(".forma")).unwrap();
    fs::write(root.0.join(&choice.layout.taxonomy_file), "Original").unwrap();
    assert!(apply_plan(&root.0, &plan, &plan.id).is_err());
    assert!(!root.0.join(&choice.layout.group_file).exists());
}

#[cfg(unix)]
#[test]
fn parent_symlink_after_confirmation_is_rejected() {
    let root = Fixture::new();
    let outside = Fixture::new();
    init_workspace(&root.0, "Links", "en", "UTC").unwrap();
    let choice = observation();
    let plan = prepare_plan(&root.0, &choice).unwrap();
    std::os::unix::fs::symlink(&outside.0, root.0.join("scaffolds")).unwrap();
    assert!(apply_plan(&root.0, &plan, &plan.id).is_err());
    assert_eq!(fs::read_dir(&outside.0).unwrap().count(), 0);
    assert!(!root.0.join(&choice.layout.taxonomy_file).exists());
}

#[test]
fn version_two_plan_hides_host_path_but_binds_identical_workspaces() {
    let first = Fixture::new();
    let second = Fixture::new();
    for root in [&first, &second] {
        init_workspace(&root.0, "Identical", "en", "UTC").unwrap();
    }
    let first_plan = prepare_plan(&first.0, &observation()).unwrap();
    let second_plan = prepare_plan(&second.0, &observation()).unwrap();
    assert_eq!(first_plan.preconditions, second_plan.preconditions);
    assert_ne!(first_plan.workspace_id, second_plan.workspace_id);
    assert_ne!(first_plan.id, second_plan.id);
    assert!(apply_plan(&second.0, &first_plan, &first_plan.id).is_err());
    let encoded = serde_json::to_string(&first_plan).unwrap();
    assert!(!encoded.contains(fs::canonicalize(&first.0).unwrap().to_str().unwrap()));
    assert!(!encoded.contains("\"workspace\":"));
    assert_eq!(first_plan.schema_version, 2);
    assert!(first_plan.id.starts_with("gm2-"));
    assert_eq!(
        serde_json::from_str::<FilePlan>(&encoded).unwrap(),
        first_plan
    );
}

#[test]
fn empty_directory_conflicts_do_not_cause_post_write_failure_or_seed_files() {
    let root = Fixture::new();
    init_workspace(&root.0, "Directories", "en", "UTC").unwrap();
    fs::create_dir_all(root.0.join("records/model-validation.md/empty")).unwrap();
    fs::create_dir_all(root.0.join("records/model-validation-1.md")).unwrap();
    let choice = observation();
    let plan = prepare_plan(&root.0, &choice).unwrap();
    assert_eq!(fs::read_dir(root.0.join("records")).unwrap().count(), 2);
    assert!(!root.0.join(&plan.files[0].path).exists());
    let report = apply_plan(&root.0, &plan, &plan.id).unwrap();
    assert_eq!(report.status, ApplyStatus::Applied, "{:?}", report.error);
    assert_eq!(fs::read_dir(root.0.join("records")).unwrap().count(), 2);
    assert!(!root.0.join("records/model-validation-2.md").exists());
}

#[test]
fn planning_rejects_classification_conflicts_exposed_by_a_real_entry() {
    let root = Fixture::new();
    init_workspace(&root.0, "Classification", "en", "UTC").unwrap();
    fs::create_dir(root.0.join(".forma")).unwrap();
    fs::write(
        root.0.join(".forma/other.md"),
        "---\nschemaVersion: 1\nkind: taxonomy\nid: other\nmode: primary\n---\n",
    )
    .unwrap();
    for id in ["first", "second"] {
        fs::write(root.0.join(format!(".forma/{id}.md")), format!("---\nschemaVersion: 1\nkind: term\nid: {id}\ntaxonomy: other\ninclude: ['records/**/*.md']\n---\n")).unwrap();
    }
    assert_eq!(check_workspace(&root.0).status, OperationStatus::Passed);
    let error = prepare_plan(&root.0, &observation()).unwrap_err();
    assert!(
        error.to_string().contains("taxonomy.membership.ambiguous"),
        "{error}"
    );
    assert!(!root.0.join("records").exists());
    assert!(!root.0.join(".forma/research.md").exists());
}

#[test]
fn local_convention_advisory_does_not_change_runtime_eligibility() {
    let root = Fixture::new();
    init_workspace(&root.0, "Distribution", "en", "UTC").unwrap();
    let mut choice = observation();
    choice.layout.group_file = ".forma/local/observations.md".into();
    let plan = prepare_plan(&root.0, &choice).unwrap();
    assert_eq!(plan.advisories.len(), 1);
    assert_eq!(plan.advisories[0].path, choice.layout.group_file);
    assert_eq!(plan.advisories[0].code, "modeling.reviewDistribution");
    let mut changed = plan.clone();
    changed.advisories.clear();
    assert!(apply_plan(&root.0, &changed, &changed.id).is_err());
    assert_eq!(
        apply_plan(&root.0, &plan, &plan.id).unwrap().status,
        ApplyStatus::Applied
    );
}
