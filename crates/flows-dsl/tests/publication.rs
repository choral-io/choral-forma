use flows_dsl::{DefinitionError, replay_execution, validate_execution};
use serde_json::{Value, json};

const SOURCE: &str = include_str!("../examples/knowledge-publication-exits.yaml");

fn journals() -> Value {
    serde_json::from_str(include_str!("fixtures/publication-journals.json")).unwrap()
}

fn facts(path: &str) -> Vec<Value> {
    journals()[path]["facts"].as_array().unwrap().clone()
}

fn replay(source: &str, facts: &[Value]) -> Result<Value, DefinitionError> {
    let fixture = journals();
    let encoded = replay_execution(
        source,
        fixture["revision"].as_str().unwrap(),
        fixture["instance"].as_str().unwrap(),
        fixture["inputJson"].as_str().unwrap(),
        &json!({"version":1,"facts":facts}).to_string(),
    )?;
    Ok(serde_json::from_str(&encoded).unwrap())
}

#[test]
fn applied_delivers_only_the_index_reply_and_closed_never_enqueues() {
    let inventory: Value = serde_json::from_str(&validate_execution(SOURCE).unwrap()).unwrap();
    assert_eq!(inventory["delivery"], Value::Null);
    assert_eq!(
        inventory["deliveryCandidates"],
        json!(["closeProposal", "enqueueIndex"])
    );
    assert_eq!(
        inventory["calls"],
        json!([{"position":"createProposal","target":"createKnowledgeProposal@1"},{"position":"enqueueIndex","target":"enqueueKnowledgeIndex@1"}])
    );
    for path in ["applied", "closed"] {
        let journal = facts(path);
        for n in 0..=journal.len() {
            let snapshot = replay(SOURCE, &journal[..n]).unwrap();
            let twice: Vec<_> = journal[..n].iter().chain(&journal[..n]).cloned().collect();
            assert_eq!(replay(SOURCE, &twice).unwrap(), snapshot);
            if n < journal.len() {
                assert_eq!(snapshot["status"], "waiting");
                assert!(snapshot.get("deliveryJson").is_none());
            } else {
                assert_eq!(snapshot["status"], "completed");
                let delivered: Value =
                    serde_json::from_str(snapshot["deliveryJson"].as_str().unwrap()).unwrap();
                let expected = if path == "closed" {
                    json!({"sourceId":"source-1","proposalId":"proposal-1","status":"closed","entryId":null,"revisionId":null})
                } else {
                    json!({"sourceId":"source-1","status":"index-requested","entryId":"entry-1","revisionId":"revision-2"})
                };
                assert_eq!(delivered, expected);
            }
            let calls = snapshot["calls"].as_array().unwrap();
            if path == "applied" && (3..5).contains(&n) {
                assert_eq!(calls.len(), 1);
                assert_eq!(calls[0]["address"]["position"], "enqueueIndex");
                assert_eq!(
                    calls[0]["state"],
                    if n == 3 { "ready" } else { "awaitingOutcome" }
                );
                assert_eq!(
                    serde_json::from_str::<Value>(calls[0]["inputJson"].as_str().unwrap()).unwrap(),
                    json!({"sourceId":"source-1","entryId":"entry-1","revisionId":"revision-1"})
                );
            } else {
                assert!(
                    calls
                        .iter()
                        .all(|c| c["address"]["position"] != "enqueueIndex")
                );
            }
            if n >= 3 {
                assert_eq!(snapshot["exits"]["publication"], path);
            }
        }
    }
    let mut closed = facts("closed");
    closed.push(facts("applied")[3].clone());
    assert_eq!(
        replay(SOURCE, &closed).unwrap_err().to_string(),
        "execution:not_ready"
    );
}

#[test]
fn index_failure_or_unknown_status_cannot_deliver_another_branch() {
    let mut applied = facts("applied");
    applied[4]["event"] = json!({"kind":"unknown"});
    let failed = replay(SOURCE, &applied).unwrap();
    assert_eq!(failed["status"], "failed");
    assert_eq!(failed["failure"]["error"], "execution:unknown_outcome");
    assert!(failed.get("deliveryJson").is_none());
    let mut invalid = facts("closed");
    invalid[2]["event"]["payloadJson"] =
        json!(r#"{"status":"other","entryId":null,"revisionId":null}"#);
    assert_eq!(
        replay(SOURCE, &invalid).unwrap_err().to_string(),
        "input:contract"
    );
}

#[test]
fn filters_must_name_declared_watcher_exits_and_preserve_delivery_on_each_path() {
    for (original, replacement, code) in [
        (
            "exit: applied }",
            "exit: unknown }",
            "definition:dependency",
        ),
        ("exit: applied }", "exit: [] }", "definition:schema"),
        (
            "exit: applied }",
            "exit: [applied, applied] }",
            "definition:schema",
        ),
        (
            "exit: applied }",
            "exit: [applied, closed] }",
            "definition:entry_or_delivery",
        ),
        (
            "from: publication, require: output, exit: applied",
            "from: createProposal, require: output, exit: applied",
            "definition:dependency",
        ),
    ] {
        let changed = SOURCE.replace(original, replacement);
        assert_ne!(changed, SOURCE);
        assert_eq!(validate_execution(&changed).unwrap_err().to_string(), code);
    }
    let (one_path, _) = SOURCE.split_once("    - id: closeProposal").unwrap();
    assert_eq!(
        validate_execution(one_path).unwrap_err().to_string(),
        "definition:entry_or_delivery"
    );
    let both = format!(
        "{SOURCE}\n    - id: impossible\n      needs: {{a: {{from: closeProposal, require: success}}, b: {{from: enqueueIndex, require: success}}}}\n      input: {{bind: true}}\n      output: {{bind: true}}"
    );
    assert_eq!(
        validate_execution(&both).unwrap_err().to_string(),
        "definition:entry_or_delivery"
    );
}

#[test]
fn exclusion_propagates_through_ordinary_work_and_success_dependencies() {
    let chained = format!(
        r#"{SOURCE}
    - id: finalIndex
      needs: {{ack: {{from: enqueueIndex, require: output}}}}
      input: {{bind: {{$ref: 'ack#'}}}}
      output: {{bind: {{$ref: '$input#'}}}}"#
    );
    for path in ["closed", "applied"] {
        let journal = facts(path);
        assert_eq!(
            replay(&chained, &journal).unwrap(),
            replay(SOURCE, &journal).unwrap()
        );
    }

    // This terminal has no formal output. It owes work only on the named exit.
    let audit = format!(
        r#"{SOURCE}
    - id: audit
      needs: {{recorded: {{from: publication, require: success, exit: [applied]}}}}
      input: {{bind: true}}
      call: {{target: audit@1}}"#
    );
    assert_eq!(
        replay(&audit, &facts("closed")).unwrap(),
        replay(SOURCE, &facts("closed")).unwrap()
    );
    let required = replay(&audit, &facts("applied")).unwrap();
    assert_eq!(required["status"], "waiting");
    assert_eq!(required["calls"][0]["target"], "audit@1");
    let list = SOURCE.replace("exit: applied }", "exit: [applied] }");
    assert_eq!(
        validate_execution(&list).unwrap(),
        validate_execution(SOURCE).unwrap()
    );
    assert_eq!(
        replay(&list, &facts("applied")).unwrap(),
        replay(SOURCE, &facts("applied")).unwrap()
    );
}
