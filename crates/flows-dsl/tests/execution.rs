use flows_dsl::{DefinitionError, replay_execution, run_definition, validate_execution};
use serde_json::{Value, json};

const SOURCE: &str = include_str!("../examples/review-handoff.yaml");
const JOURNAL: &str = include_str!("fixtures/review-journal.json");
const INPUT: &str = r#"{"matterId":"M-42","initialHandoffId":"H-0","amount":1.0000000000000001}"#;
const DELIVERY: &str =
    r#"{"amount":1.0000000000000001,"matterId":"M-42","predecessor":"H-0","receipt":"R-1"}"#;

fn facts() -> Vec<Value> {
    serde_json::from_str::<Value>(JOURNAL).unwrap()["facts"]
        .as_array()
        .unwrap()
        .clone()
}

fn replay(source: &str, input: &str, facts: &[Value]) -> Result<Value, DefinitionError> {
    let journal = json!({"version":1,"facts":facts}).to_string();
    let snapshot = replay_execution(source, "review-v1", "sample-42", input, &journal)?;
    Ok(serde_json::from_str(&snapshot).unwrap())
}

#[test]
fn review_handoff_survives_every_restart_and_duplicate() {
    let preview: Value = serde_json::from_str(&validate_execution(SOURCE).unwrap()).unwrap();
    assert_eq!(preview["entry"], "register");
    assert_eq!(preview["delivery"], "handoff");
    assert_eq!(preview["submissions"], json!(["review/submission"]));
    assert_eq!(
        preview["calls"],
        json!([{"position":"register","target":"registerReview@1"},{"position":"journal","target":"registerReceipt@1"}])
    );
    let facts = facts();
    for n in 0..=facts.len() {
        let snapshot = replay(SOURCE, INPUT, &facts[..n]).unwrap();
        if n > 0 {
            // Redeliver the complete prefix after restart, even once the Watcher closes.
            let duplicate: Vec<_> = facts[..n].iter().chain(&facts[..n]).cloned().collect();
            assert_eq!(snapshot, replay(SOURCE, INPUT, &duplicate).unwrap());
        }
        assert_eq!(
            snapshot["status"],
            if n == 5 { "completed" } else { "waiting" }
        );
        assert_eq!(
            snapshot.get("deliveryJson").and_then(Value::as_str),
            (n >= 3).then_some(DELIVERY)
        );
        match n {
            0 | 1 => {
                assert_eq!(
                    snapshot["calls"][0]["state"],
                    if n == 0 { "ready" } else { "awaitingOutcome" }
                );
                assert_eq!(
                    snapshot["calls"][0]["inputJson"],
                    r#"{"handoffId":"H-0","matterId":"M-42"}"#
                );
                assert_eq!(snapshot["waits"][0]["accepting"], false);
            }
            2 => {
                assert_eq!(snapshot["calls"], json!([]));
                assert_eq!(snapshot["waits"][0]["accepting"], true);
                assert_eq!(snapshot["waits"][0]["address"], facts[2]["address"]);
            }
            _ => {
                assert_eq!(snapshot["waits"], json!([]));
                assert_eq!(snapshot["exits"]["review"], "recorded");
            }
        }
    }
}

#[test]
fn invalid_or_misaddressed_submissions_do_not_change_an_open_review() {
    let facts = facts();
    let invalid = |prefix: usize, fact: Value| {
        let mut journal = facts[..prefix].to_vec();
        journal.push(fact);
        replay(SOURCE, INPUT, &journal).unwrap_err().to_string()
    };
    assert_eq!(invalid(0, facts[2].clone()), "execution:not_open");
    assert_eq!(invalid(0, facts[1].clone()), "execution:not_dispatched");
    for field in ["revision", "instance", "position"] {
        let mut fact = facts[2].clone();
        fact["address"][field] = json!("other");
        assert_eq!(invalid(2, fact), "execution:address");
    }
    let mut bad = facts[2].clone();
    bad["event"]["payloadJson"] = json!(r#"{"receipt":""}"#);
    assert_eq!(invalid(2, bad), "input:contract");
    assert_eq!(
        replay(SOURCE, INPUT, &facts[..2]).unwrap()["waits"][0]["count"],
        0
    );
    let mut late = facts[2].clone();
    late["event"]["id"] = json!("late");
    assert_eq!(invalid(5, late), "execution:not_open");
    let mut changed = facts[2].clone();
    changed["event"]["payloadJson"] = json!(r#"{"receipt":"other"}"#);
    assert_eq!(invalid(5, changed), "execution:conflict");
}

fn last_event(kind: &str) -> Vec<Value> {
    let mut facts = facts();
    facts[4]["event"] = json!({"kind":kind});
    facts
}

#[test]
fn confirmed_failure_is_attributable_and_unknown_outcome_never_permits_redispatch() {
    let tolerant = SOURCE.replace(
        "target: registerReceipt@1",
        "target: registerReceipt@1, onFailure: tolerate",
    );
    for (source, kind, expected) in [
        (
            SOURCE,
            "confirmedFailure",
            Some("execution:confirmed_failure"),
        ),
        (&tolerant, "confirmedFailure", None),
        (&tolerant, "unknown", Some("execution:unknown_outcome")),
    ] {
        let facts = last_event(kind);
        let result = replay(source, INPUT, &facts).unwrap();
        assert_eq!(result["calls"], json!([]));
        assert_eq!(result["deliveryJson"], DELIVERY);
        assert_eq!(result["failure"]["error"].as_str(), expected);
        if expected.is_some() {
            assert_eq!(result["status"], "failed");
            assert_eq!(result["failure"]["position"], "journal");
        } else {
            assert_eq!(result["status"], "completed");
            assert_eq!(result["tolerated"], json!([facts[4]["address"]]));
        }
        let mut conflicting = facts.clone();
        conflicting.push(self::facts()[4].clone());
        assert_eq!(
            replay(source, INPUT, &conflicting).unwrap_err().to_string(),
            "execution:conflict"
        );
    }
}

#[test]
fn tolerated_failure_supplies_neither_success_nor_a_null_delivery() {
    let source = SOURCE.replace(
        "target: registerReview@1",
        "target: registerReview@1\n        onFailure: tolerate",
    );
    let mut journal = facts()[..2].to_vec();
    journal[1]["event"] = json!({"kind":"confirmedFailure"});
    let blocked = replay(&source, INPUT, &journal).unwrap();
    assert_eq!(blocked["status"], "failed");
    assert_eq!(blocked["tolerated"], json!([journal[0]["address"]]));
    assert_eq!(
        blocked["failure"]["error"],
        "execution:unsatisfied_dependency"
    );
    assert!(blocked.get("deliveryJson").is_none());
    let call = "dsl: choral/flows-v1-beta.2\ndefinition:\n  id: x\n  steps:\n    - id: register\n      input: {}\n      call: {target: supplier@1, onFailure: tolerate}\n";
    assert_eq!(
        replay(call, "null", &journal).unwrap()["status"],
        "completed"
    );
    let call = format!("{call}      output: {{}}\n");
    assert_eq!(
        replay(&call, "null", &journal).unwrap()["failure"]["error"],
        "execution:missing_delivery"
    );
    journal[1]["event"] = json!({"kind":"returned","payloadJson":"null"});
    assert_eq!(
        replay(&call, "null", &journal).unwrap()["deliveryJson"],
        "null"
    );
}

#[test]
fn receipt_success_with_an_invalid_bound_output_is_a_durable_failure() {
    let source = SOURCE.replace(
        "target: registerReview@1",
        "target: registerReview@1\n        onFailure: tolerate",
    );
    for (payload, error) in [
        (r#"{"registered": false}"#, "output:contract"),
        ("null", "binding:absent"),
    ] {
        let mut facts = facts()[..2].to_vec();
        facts[1]["event"]["payloadJson"] = json!(payload);
        let result = replay(&source, INPUT, &facts).unwrap();
        assert_eq!(result["failure"]["error"], error);
        assert_eq!(result["calls"], json!([]));
        assert_eq!(result["tolerated"], json!([]));
    }
}

#[test]
fn distinct_submissions_freeze_in_adoption_order_and_choose_the_first_eligible_case() {
    let source = SOURCE.replace("input: { schema: { $ref: Review } }","input: {}")
        .replace("when: true","when: { $expr: { lang: choral-cel/v1, args: { n: { $ref: 'submission#/count' } }, code: 'type(n) == int && n >= 2' } }")
        .replace("    - id: handoff", "          - on: submission\n            exit: other\n            when: { $expr: { lang: choral-cel/v1, args: { n: { $ref: 'submission#/count' } }, code: 'n == 2' } }\n            output: { bind: null }\n\n    - id: handoff")
        .replace("receipt: { $ref: \"submission#/results/0/receipt\" }","receipt: { $ref: \"submission#/results\" }");
    let mut journal = facts()[..3].to_vec();
    journal[2]["event"]["payloadJson"] = json!(r#"{"n":[1.0000000000000001,3],"ok":true}"#);
    let mut duplicate = journal[2].clone();
    duplicate["event"]["payloadJson"] = json!(r#"{"ok":true,"n":[10000000000000001e-16,3.0]}"#);
    journal.push(duplicate.clone());
    assert_eq!(
        replay(&source, INPUT, &journal).unwrap()["waits"][0]["count"],
        1
    );
    let mut conflict = duplicate.clone();
    conflict["event"]["payloadJson"] = json!(r#"{"ok":1,"n":[1.0000000000000001,3]}"#);
    journal.push(conflict);
    assert_eq!(
        replay(&source, INPUT, &journal).unwrap_err().to_string(),
        "execution:conflict"
    );
    journal.pop();
    duplicate["event"]["id"] = json!("review-2");
    journal.push(duplicate);
    let result = replay(&source, INPUT, &journal).unwrap();
    assert_eq!(result["exits"]["review"], "recorded");
    let delivered: Value = serde_json::from_str(result["deliveryJson"].as_str().unwrap()).unwrap();
    assert_eq!(delivered["receipt"].as_array().unwrap().len(), 2);
    assert_eq!(delivered["receipt"][0]["n"][1].to_string(), "3");
    assert_eq!(delivered["receipt"][1]["n"][1].to_string(), "3.0");
}

#[test]
fn pure_definitions_agree_with_the_original_entry_point() {
    let source = include_str!("../examples/boolean-handoff.yaml");
    let input = r#"{"approved":false}"#;
    assert_eq!(
        replay(source, input, &[]).unwrap()["deliveryJson"],
        run_definition(source, input).unwrap()
    );
    assert_eq!(
        run_definition(SOURCE, INPUT).unwrap_err().to_string(),
        "definition:unsupported_step"
    );
}

#[test]
fn invalid_provider_json_is_replayable_and_never_tolerated() {
    let source = SOURCE.replace(
        "target: registerReview@1",
        "target: registerReview@1\n        onFailure: tolerate",
    );
    let mut facts = facts()[..2].to_vec();
    facts[1]["event"]["payloadJson"] = json!("{invalid");
    facts.push(facts[1].clone());
    let result = replay(&source, INPUT, &facts).unwrap();
    assert_eq!(result["failure"]["error"], "output:syntax");
    assert_eq!(result["calls"], json!([]));
    facts[2]["event"]["payloadJson"] = json!("false");
    assert_eq!(
        replay(&source, INPUT, &facts).unwrap_err().to_string(),
        "execution:conflict"
    );
}

#[test]
fn replay_validation_requires_an_ordinary_delivery_and_unique_exits() {
    let (watch, _) = SOURCE.split_once("    - id: handoff").unwrap();
    assert_eq!(
        validate_execution(watch).unwrap_err().to_string(),
        "definition:entry_or_delivery"
    );
    let duplicate = SOURCE.replace("    - id: handoff", "          - on: submission\n            exit: recorded\n            when: false\n            output: {bind: false}\n    - id: handoff");
    assert_eq!(
        validate_execution(&duplicate).unwrap_err().to_string(),
        "definition:duplicate_exit"
    );
}

#[test]
fn blocked_required_steps_have_a_stable_failure_position() {
    let mut steps = vec![
        json!({"id":"register","input":{},"call":{"target":"check@1","onFailure":"tolerate"}}),
    ];
    for id in ["zeta", "alpha"] {
        steps.push(json!({"id":id,"needs":{"checked":{"from":"register","require":"success"}},"input":{"bind":true},"call":{"target":"after@1"}}));
    }
    let mut facts = facts()[..2].to_vec();
    facts[1]["event"] = json!({"kind":"confirmedFailure"});
    for _ in 0..2 {
        let source =
            json!({"dsl":flows_dsl::DEFINITION_PROFILE,"definition":{"id":"check","steps":steps}})
                .to_string();
        assert_eq!(
            replay(&source, "null", &facts).unwrap()["failure"]["position"],
            "alpha"
        );
        steps.swap(1, 2);
    }
}

#[test]
fn only_named_protocol_objects_are_admitted() {
    for journal in [
        r#"[1,[]]"#,
        r#"{"version":1,"facts":[[{},{}]]}"#,
        r#"{"version":1,"facts":[{"address":["review-v1","sample-42","register"],"event":{"kind":"dispatch"}}]}"#,
        r#"{"version":1,"facts":[{"address":{"revision":"review-v1","instance":"sample-42","position":"register"},"event":["dispatch"]}]}"#,
    ] {
        let error = replay_execution(SOURCE, "review-v1", "sample-42", INPUT, journal).unwrap_err();
        assert_eq!(error.to_string(), "execution:journal");
    }
}

#[test]
fn a_dispatch_keeps_space_for_its_outcome() {
    let facts = facts();
    let mut prefix = vec![facts[0].clone(); 255];
    assert_eq!(
        replay(SOURCE, INPUT, &prefix).unwrap()["calls"][0]["state"],
        "awaitingOutcome"
    );
    prefix.push(facts[0].clone());
    assert_eq!(
        replay(SOURCE, INPUT, &prefix).unwrap_err().to_string(),
        "execution:journal_capacity"
    );
    prefix[255]["event"] = json!({"kind":"returnTooLarge"});
    assert_eq!(
        replay(SOURCE, INPUT, &prefix).unwrap()["failure"]["error"],
        "output:size"
    );
}

#[test]
fn local_output_budget_bounds_the_whole_observation() {
    // A small submission can copy a large authored literal. Bound cumulative results.
    let source = SOURCE
        .replace(
            "output: { bind: { $ref: \"$input#\" } }",
            &format!("output: {{bind: '{}'}}", "a".repeat(140_000)),
        )
        .replace("when: true", "when: false");
    let mut prefix = facts()[..3].to_vec();
    assert_eq!(
        replay(&source, INPUT, &prefix).unwrap()["waits"][0]["count"],
        1
    );
    let mut second = prefix[2].clone();
    second["event"]["id"] = json!("another");
    prefix.push(second);
    assert_eq!(
        replay(&source, INPUT, &prefix).unwrap()["failure"]["error"],
        "output:size"
    );
}

#[test]
fn a_named_watcher_exit_enables_the_required_receipt() {
    let source = SOURCE.replace(
        "    - id: journal\n      needs: { reviewed: { from: review, require: output } }",
        "    - id: journal\n      needs: { reviewed: { from: review, require: output, exit: recorded } }",
    );
    let inventory = validate_execution(&source).unwrap();
    assert_eq!(inventory, validate_execution(SOURCE).unwrap());
    let journal = facts();
    for n in 0..=journal.len() {
        assert_eq!(
            replay(&source, INPUT, &journal[..n]).unwrap(),
            replay(SOURCE, INPUT, &journal[..n]).unwrap()
        );
    }
}
