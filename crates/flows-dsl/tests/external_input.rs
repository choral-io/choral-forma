use flows_dsl::{
    execution_input_schema, replay_execution, validate_execution, validate_execution_input,
};
use serde_json::{Value, json};

const SOURCE: &str = include_str!("../examples/input-contracts.json");
const ENTRY: &str = "register";
const SUBMISSION: &str = "review/submission";
const VALID: &str = r#"{"amount":1.0000000000000002}"#;
const EXACT_BOUND: &str = r#"{"amount":1.0000000000000001}"#;

fn changed_source(change: impl FnOnce(&mut Value)) -> String {
    let mut document: Value = serde_json::from_str(SOURCE).unwrap();
    change(&mut document);
    document.to_string()
}

fn step_inputs(document: &mut Value, input: Value) {
    let steps = document["definition"]["steps"].as_array_mut().unwrap();
    steps[0]["input"] = input.clone();
    steps[1]["watch"]["observe"]["submission"]["input"] = input;
}

#[test]
fn standalone_contracts_contain_only_the_reachable_resources_at_each_position() {
    let inventory: Value = serde_json::from_str(&validate_execution(SOURCE).unwrap()).unwrap();
    assert_eq!(inventory["entry"], ENTRY);
    assert_eq!(inventory["submissions"], json!([SUBMISSION]));
    for position in [ENTRY, SUBMISSION] {
        let text = execution_input_schema(SOURCE, position).unwrap();
        let schema: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(
            schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema"
        );
        assert_eq!(
            schema["$defs"]["name-Amount"]["exclusiveMinimum"].to_string(),
            "1.0000000000000001"
        );
        let defs = schema["$defs"].as_object().unwrap();
        if position == ENTRY {
            assert_eq!(defs.len(), 2);
            assert_eq!(schema["$ref"], "#/$defs/name-Request");
            assert_eq!(defs["name-Request"]["title"], "Registration request");
        } else {
            assert_eq!(defs.len(), 3);
            assert_eq!(schema["$ref"], "#/$defs/name-Review");
            assert_eq!(defs["name-Review"]["$ref"], "#/$defs/name-Receipt");
            let receipt = &defs["name-Receipt"];
            assert_eq!(
                receipt["description"],
                "An independently supplied review receipt."
            );
            let fields = &receipt["properties"];
            assert_eq!(
                fields["otherAmounts"]["items"]["$ref"],
                "#/$defs/name-Amount"
            );
            assert_eq!(fields["$ref"]["const"], json!({"$ref":"literal-data"}));
            assert_eq!(fields["labels"]["enum"], json!([{"$ref":"literal-label"}]));
        }
        let standalone = jsonschema::draft202012::options().build(&schema).unwrap();
        for (input, allowed) in [(VALID, true), (EXACT_BOUND, false), ("{}", false)] {
            assert_eq!(
                standalone.is_valid(&serde_json::from_str(input).unwrap()),
                allowed
            );
            assert_eq!(
                validate_execution_input(SOURCE, position, input).is_ok(),
                allowed
            );
        }
    }
}

#[test]
fn omitted_and_boolean_and_inline_schemas_work_for_both_input_kinds() {
    for (input, schema, accepted) in [
        (json!({}), json!(true), true),
        (json!({"schema":true}), json!(true), true),
        (json!({"schema":false}), json!(false), false),
        (
            json!({"schema":{"type":"null"}}),
            json!({"$schema":"https://json-schema.org/draft/2020-12/schema","type":"null"}),
            true,
        ),
    ] {
        let source = changed_source(|d| step_inputs(d, input));
        for position in [ENTRY, SUBMISSION] {
            assert_eq!(
                serde_json::from_str::<Value>(&execution_input_schema(&source, position).unwrap())
                    .unwrap(),
                schema
            );
            assert_eq!(
                validate_execution_input(&source, position, "null").is_ok(),
                accepted
            );
            if !accepted {
                assert_eq!(
                    validate_execution_input(&source, position, "null")
                        .unwrap_err()
                        .to_string(),
                    "input:contract"
                );
            }
        }
    }
}

#[test]
fn only_inventory_input_positions_resolve_and_the_whole_definition_is_checked_first() {
    for position in [
        "",
        "handoff",
        "review",
        "review/registration",
        "submission",
        "register/submission",
        "review/submission/extra",
        "missing",
    ] {
        assert_eq!(
            execution_input_schema(SOURCE, position)
                .unwrap_err()
                .to_string(),
            "execution:position"
        );
        assert_eq!(
            validate_execution_input(SOURCE, position, "invalid")
                .unwrap_err()
                .to_string(),
            "execution:position"
        );
    }
    for invalid in [
        changed_source(|d| d["schemas"]["Review"] = json!({"$ref":"missing"})),
        changed_source(|d| d["schemas"]["Amount"] = json!({"$ref":"Review"})),
    ] {
        assert_eq!(
            execution_input_schema(&invalid, ENTRY)
                .unwrap_err()
                .to_string(),
            "definition:contract"
        );
        assert_eq!(
            validate_execution_input(&invalid, ENTRY, "null")
                .unwrap_err()
                .to_string(),
            "definition:contract"
        );
    }
}

fn fact(position: &str, event: Value) -> Value {
    json!({"address":{"revision":"r","instance":"i","position":position},"event":event})
}

#[test]
fn static_and_live_input_checks_agree_before_any_output_binding() {
    let open = [
        fact(ENTRY, json!({"kind":"dispatch"})),
        fact(ENTRY, json!({"kind":"returned","payloadJson":"null"})),
    ];
    let deep = format!("{}0{}", "[".repeat(34), "]".repeat(34));
    let wide = format!("[{}]", vec!["0"; 8200].join(","));
    let oversized = " ".repeat(262145);
    for (input, error) in [
        (VALID, None),
        (EXACT_BOUND, Some("input:contract")),
        ("amount: 2", Some("input:syntax")),
        (r#"{"x":1,"x":2}"#, Some("input:invalid_key")),
        ("9007199254740992", Some("input:number_range")),
        (&deep, Some("input:depth")),
        (&wide, Some("input:size")),
        (&oversized, Some("input:size")),
    ] {
        let mut facts = open.to_vec();
        facts.push(fact(
            SUBMISSION,
            json!({"kind":"submission","id":"receipt-1","payloadJson":input}),
        ));
        for (position, entry, journal) in [
            (ENTRY, input, json!({"version":1,"facts":[]})),
            (SUBMISSION, VALID, json!({"version":1,"facts":facts})),
        ] {
            let check = validate_execution_input(SOURCE, position, input)
                .err()
                .map(|e| e.to_string());
            let replay = replay_execution(SOURCE, "r", "i", entry, &journal.to_string())
                .err()
                .map(|e| e.to_string());
            assert_eq!(check.as_deref(), error);
            assert_eq!(check, replay);
        }
    }
    let early = json!({"version":1,"facts":[fact(SUBMISSION,json!({"kind":"submission","id":"early","payloadJson":VALID}))]});
    assert!(validate_execution_input(SOURCE, SUBMISSION, VALID).is_ok());
    assert_eq!(
        replay_execution(SOURCE, "r", "i", VALID, &early.to_string())
            .unwrap_err()
            .to_string(),
        "execution:not_open"
    );
}

#[test]
fn entry_preflight_checks_normalized_fixed_input_size_without_advancing_replay() {
    let source = changed_source(|d| step_inputs(d, json!({})));
    let padding = "a".repeat(262144 - r#"["",1e0]"#.len());
    let input = format!(r#"["{padding}",1e0]"#);
    assert_eq!(input.len(), 262144);
    assert_eq!(
        validate_execution_input(&source, ENTRY, &input)
            .unwrap_err()
            .to_string(),
        "input:size"
    );
    // Replay historically reports this during entry activation, as a failed projection.
    let projection: Value = serde_json::from_str(
        &replay_execution(&source, "r", "i", &input, r#"{"version":1,"facts":[]}"#).unwrap(),
    )
    .unwrap();
    assert_eq!(projection["failure"]["error"], "input:size");
    assert!(validate_execution_input(&source, SUBMISSION, &input).is_ok());
}
