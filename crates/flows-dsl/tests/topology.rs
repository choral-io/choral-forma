use flows_dsl::{execution_topology, validate_execution};
use serde_json::{Value, json};

const REVIEW: &str = include_str!("../examples/review-handoff.yaml");
const PUBLICATION: &str = include_str!("../examples/knowledge-publication-exits.yaml");

fn topology(source: &str) -> Value {
    serde_json::from_str(&execution_topology(source).unwrap()).unwrap()
}

#[test]
fn review_and_publication_match_the_versioned_graphs() {
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/execution-topologies.json")).unwrap();
    assert_eq!(topology(REVIEW), expected["review-handoff.yaml"]);
    assert_eq!(
        topology(PUBLICATION),
        expected["knowledge-publication-exits.yaml"]
    );
}

#[test]
fn preserves_dependency_aliases_and_normalizes_exit_filters() {
    let list = PUBLICATION.replace("exit: applied }", "exit: [applied] }");
    assert_eq!(topology(&list), topology(PUBLICATION));
    let audit = format!(
        "{PUBLICATION}\n    - id: audit\n      needs:\n        settled: {{from: publication, require: success, exit: [closed, applied]}}\n        published: {{from: publication, require: output}}\n      input: {{bind: true}}\n      call: {{target: audit@1}}"
    );
    let graph = topology(&audit);
    let audit = graph["steps"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] == "audit")
        .unwrap();
    let needs = audit["needs"].as_array().unwrap();
    assert_eq!(needs.len(), 2);
    assert!(needs.contains(&json!({"alias":"settled","from":"publication","require":"success","exit":["closed","applied"]})));
    assert!(needs.contains(&json!({"alias":"published","from":"publication","require":"output"})));
    assert_eq!(
        graph["deliveryCandidates"],
        json!(["closeProposal", "enqueueIndex"])
    );
}

#[test]
fn pure_and_completion_only_definitions_project_their_delivery_candidates() {
    let pure = topology(include_str!("../examples/boolean-handoff.yaml"));
    assert_eq!(pure["entry"], "receive");
    assert_eq!(pure["deliveryCandidates"], json!(["deliver"]));
    assert_eq!(pure["steps"][0]["kind"], "process");
    let completion = topology(
        "dsl: choral/flows-v1-beta.2\ndefinition: {id: example, steps: [{id: invoke, input: {}, call: {target: finish@1}}]}",
    );
    assert_eq!(completion["deliveryCandidates"], json!([]));
}

#[test]
fn topology_reports_the_execution_compilers_diagnostics() {
    for (source, error) in [
        (
            "dsl: choral/flows-v1-beta.2\nschemas: {Any: true}".to_owned(),
            "definition:schemas_only",
        ),
        (
            REVIEW.replace(
                "request: { from: register }",
                "request: { from: register, collect: item }",
            ),
            "definition:unsupported_watch",
        ),
        (
            PUBLICATION.replace("exit: applied }", "exit: unknown }"),
            "definition:dependency",
        ),
    ] {
        let diagnostic = execution_topology(&source).unwrap_err();
        assert_eq!(diagnostic.to_string(), error);
        assert_eq!(diagnostic, validate_execution(&source).unwrap_err());
    }
}
