use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use forma_core::{
    FormaMarkdownDocument, OperationStatus, check_workspace, embedded_doc, inspect_entry_by_path,
    load_workspace, resolve_create_inputs, resolve_runtime_values,
};
use markdown::{ParseOptions, mdast::Node, to_mdast};
use serde_yml::Value;

fn examples(id: &str) -> Vec<Value> {
    let doc = embedded_doc(id).unwrap().expect("embedded documentation");
    let Node::Root(root) = to_mdast(&doc.body, &ParseOptions::gfm()).unwrap() else {
        panic!("documentation should parse as Markdown");
    };
    root.children
        .into_iter()
        .filter_map(|node| {
            let Node::Code(code) = node else {
                return None;
            };
            if !matches!(code.lang.as_deref(), Some("yaml" | "md" | "markdown")) {
                return None;
            }
            Some(if code.value.starts_with("---\n") {
                FormaMarkdownDocument::parse(&code.value)
                    .frontmatter
                    .value
                    .expect("example frontmatter")
            } else {
                serde_yml::from_str(&code.value).expect("example YAML")
            })
        })
        .collect()
}

fn example(id: &str, predicate: impl Fn(&Value) -> bool) -> Value {
    examples(id)
        .into_iter()
        .find(predicate)
        .expect("documentation should provide the example")
}

struct Workspace {
    root: PathBuf,
    config: Value,
}

impl Workspace {
    fn new(label: &str) -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "forma-schema-docs-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir(&root).unwrap();
        let config = example("workspace.first-slice-config", |value| {
            value.get("workspace").is_some()
        });
        let workspace = Self { root, config };
        workspace.write(
            ".forma/spaces/index.md",
            &example("workspace.first-slice-config", |value| {
                value["kind"] == "taxonomy"
            }),
        );
        workspace.save_config();
        workspace
    }

    fn write(&self, path: &str, value: &Value) {
        let path = self.root.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(
            path,
            format!("---\n{}---\n", serde_yml::to_string(value).unwrap()),
        )
        .unwrap();
    }

    fn save_config(&self) {
        self.write(".forma.md", &self.config);
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        if !std::thread::panicking() {
            fs::remove_dir_all(&self.root).unwrap();
        }
    }
}

fn assert_clean(root: &Path) {
    let result = check_workspace(root);
    assert_eq!(result.status, OperationStatus::Passed, "{result:?}");
    assert_eq!(result.summary.errors, 0, "{result:?}");
    assert_eq!(result.summary.warnings, 0, "{result:?}");
}

#[test]
fn basic_schema_example_needs_no_named_types() {
    let workspace = Workspace::new("basic");
    let mut group = example("workspace.schemas", |value| value["kind"] == "term");
    group["schema"] = example("workspace.schemas", |value| {
        value.get("schema").is_some() && value.get("kind").is_none()
    })["schema"]
        .clone();
    workspace.write(".forma/spaces/entries.md", &group);
    let mut entry = example("workspace.schemas", |value| value.get("count").is_some());
    workspace.write("entries/example.md", &entry);

    assert!(
        load_workspace(&workspace.root)
            .unwrap()
            .config
            .types
            .is_empty()
    );
    assert_clean(&workspace.root);
    let inspected = inspect_entry_by_path(&workspace.root, "entries/example.md").unwrap();
    for (field, value) in entry.as_mapping().unwrap() {
        assert_eq!(inspected.entry.metadata[field.as_str().unwrap()], *value);
    }

    entry["count"] = Value::String("2".to_string());
    workspace.write("entries/example.md", &entry);
    let invalid = check_workspace(&workspace.root);
    assert_eq!(invalid.status, OperationStatus::Failed);
    assert!(
        invalid
            .diagnostics
            .iter()
            .any(|item| item.code == "schema.type.invalid")
    );
}

#[test]
fn named_type_examples_require_declarations_and_follow_configured_sources() {
    for relocated in [false, true] {
        let mut workspace = Workspace::new(if relocated { "relocated" } else { "named" });
        let mut types =
            example("workspace.schemas", |value| value.get("types").is_some())["types"].clone();
        let mut group = example("workspace.schemas", |value| value["kind"] == "term");
        let (group_path, content_dir) = if relocated {
            let map = types.as_mapping_mut().unwrap();
            let enum_type = map.remove(Value::String("entryState".into())).unwrap();
            let mut reference_type = map.remove(Value::String("relatedEntry".into())).unwrap();
            reference_type["source"] = Value::String("config/catalog".into());
            map.insert(Value::String("publicationState".into()), enum_type);
            map.insert(Value::String("linkedDocument".into()), reference_type);
            group["schema"]["fields"]["state"]["type"] = Value::String("publicationState".into());
            group["schema"]["fields"]["related"]["type"] = Value::String("linkedDocument".into());
            group["id"] = Value::String("catalog".into());
            group["include"] = serde_yml::from_str("[records/**/*.md]").unwrap();
            workspace.config["imports"]
                .as_sequence_mut()
                .unwrap()
                .push(Value::String("config/catalog.md".into()));
            ("config/catalog.md", "records")
        } else {
            (".forma/spaces/entries.md", "entries")
        };
        workspace.config["types"] = types;
        workspace.save_config();
        workspace.write(group_path, &group);

        for (name, other, state) in [("first", "second", "draft"), ("second", "first", "ready")] {
            let entry = serde_yml::to_value(serde_json::json!({
                "title": name,
                "state": state,
                "related": format!("{content_dir}/{other}.md")
            }))
            .unwrap();
            workspace.write(&format!("{content_dir}/{name}.md"), &entry);
        }

        assert_clean(&workspace.root);
        let inspected =
            inspect_entry_by_path(&workspace.root, &format!("{content_dir}/first.md")).unwrap();
        assert_eq!(inspected.status, OperationStatus::Passed);
        assert!(inspected.entry.refs.iter().any(|reference| {
            reference.target_path == format!("{content_dir}/second.md")
                && reference.resolved_title.as_deref() == Some("second")
        }));

        workspace
            .config
            .as_mapping_mut()
            .unwrap()
            .remove(Value::String("types".into()));
        workspace.save_config();
        let invalid = check_workspace(&workspace.root);
        assert_eq!(invalid.status, OperationStatus::Failed);
        assert!(
            invalid
                .diagnostics
                .iter()
                .any(|item| item.code == "schema.type.invalid")
        );
    }
}

#[test]
fn template_runtime_default_uses_a_declared_workspace_value() {
    let mut workspace = Workspace::new("runtime");
    workspace.config["runtime"] = example("workspace.configuration", |value| {
        value.get("runtime").is_some()
    })["runtime"]
        .clone();
    workspace.save_config();
    let mut config = load_workspace(&workspace.root).unwrap().config;
    let runtime = resolve_runtime_values(&config, workspace.root.to_str().unwrap());
    assert!(runtime.diagnostics.is_empty(), "{:?}", runtime.diagnostics);

    let defaults = example("workspace.templates", |value| {
        value["create"]["inputs"].get("createdAt").is_some()
    });
    let inputs = serde_yml::from_value(defaults["create"]["inputs"].clone()).unwrap();
    let resolved = resolve_create_inputs(&inputs, &BTreeMap::new(), &runtime);
    assert!(
        resolved.diagnostics.is_empty(),
        "{:?}",
        resolved.diagnostics
    );
    assert_eq!(
        Some(&resolved.values["createdAt"]),
        runtime.get("buildTime")
    );
    assert!(resolved.values["createdAt"].as_str().is_some());

    config.runtime.values.clear();
    let empty_runtime = resolve_runtime_values(&config, workspace.root.to_str().unwrap());
    let without_runtime = resolve_create_inputs(&inputs, &BTreeMap::new(), &empty_runtime);
    assert!(!without_runtime.diagnostics.is_empty());
}
