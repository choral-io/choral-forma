use flows_dsl::{DEFINITION_PROFILE, DefinitionError, ErrorStage, PREVIEW_VERSION};
use flows_dsl::{run_definition, validate_definition};
use serde_json::{Value, json};

const HANDOFF: &str = include_str!("../examples/boolean-handoff.yaml");
const DECIMAL: &str = "1.0000000000000001";

fn reference(value: &str) -> Value {
    json!({"$ref": value})
}

fn expression(code: &str, arguments: Value) -> Value {
    json!({"$expr": {"lang": "choral-cel/v1", "code": code, "args": arguments}})
}

fn single(input: Value, output: Value) -> String {
    json!({
        "dsl": DEFINITION_PROFILE,
        "definition": {"id": "test", "steps": [{
            "id": "entry", "input": input, "output": {"bind": output}
        }]},
    })
    .to_string()
}

fn assert_error(result: Result<String, DefinitionError>, stage: ErrorStage, code: &str) {
    let error = result.unwrap_err();
    assert_eq!((error.stage(), error.code()), (stage, code));
    assert_eq!(error.to_string(), format!("{}:{code}", stage.as_str()));
}

#[test]
fn preview_and_handoff_are_independent_of_authored_step_order() {
    let preview: Value = serde_json::from_str(&validate_definition(HANDOFF).unwrap()).unwrap();
    assert_eq!(
        preview,
        json!({
            "kind": "definition", "profile": DEFINITION_PROFILE, "version": PREVIEW_VERSION,
            "id": "deliverDecision", "entry": "receive", "delivery": "deliver",
            "steps": [
                {"id": "receive", "needs": []},
                {"id": "deliver", "needs": [
                    {"alias": "decision", "from": "receive", "require": "output"},
                ]},
            ],
        }),
    );
    let entry = HANDOFF.find("    - id: receive").unwrap();
    let delivery = HANDOFF.find("    - id: deliver").unwrap();
    let reordered = format!(
        "{}{}\n{}",
        &HANDOFF[..entry],
        &HANDOFF[delivery..],
        &HANDOFF[entry..delivery],
    );
    assert_eq!(
        validate_definition(&reordered).unwrap(),
        preview.to_string()
    );
    for source in [HANDOFF, &reordered] {
        assert_eq!(
            run_definition(source, r#"{"approved":false}"#).unwrap(),
            "false"
        );
        assert_error(
            run_definition(source, r#"{"approved":0}"#),
            ErrorStage::Input,
            "contract",
        );
    }
}

#[test]
fn s02_1_only_declared_handoffs_expose_upstream_values() {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/explicit-handoff-cases.json")).unwrap();
    let input = fixture["inputJson"].as_str().unwrap();
    let explicit_handoff = include_str!("../examples/memo-handoff.yaml");
    assert_eq!(
        run_definition(explicit_handoff, input).unwrap(),
        fixture["expectedDeliveryJson"].as_str().unwrap(),
    );

    let decision_only = &fixture["decisionOnly"];
    let mut source = decision_only["source"].clone();
    assert_eq!(
        run_definition(&source.to_string(), input).unwrap(),
        decision_only["expectedDeliveryJson"].as_str().unwrap(),
    );

    // Keep the declared dependency on `forward` while attempting to read `receive`.
    source["definition"]["steps"][2]["input"]["bind"] = fixture["privateReadBinding"].clone();
    assert_error(
        validate_definition(&source.to_string()),
        ErrorStage::Definition,
        "unreadable_root",
    );
}

#[test]
fn s02_2_present_json_values_deliver_and_missing_fields_fail() {
    let fixture: Value =
        serde_json::from_str(include_str!("fixtures/value-presence-cases.json")).unwrap();
    let source = fixture["source"].to_string();
    for case in fixture["present"].as_array().unwrap() {
        let input = case["inputJson"].as_str().unwrap();
        assert_eq!(
            run_definition(&source, input).unwrap(),
            case["expectedDeliveryJson"].as_str().unwrap(),
            "{input}",
        );
    }
    assert_error(
        run_definition(&source, fixture["missingInputJson"].as_str().unwrap()),
        ErrorStage::Binding,
        "absent",
    );
}

#[test]
fn exact_json_handoff_and_rounded_cel_follow_official_vectors() {
    let cases: Value =
        serde_json::from_str(include_str!("fixtures/handoff-and-replay-cases.json")).unwrap();
    let handoff = &cases["handoff"];
    let schema: Value = serde_json::from_str(handoff["schemaJson"].as_str().unwrap()).unwrap();
    let source = json!({
        "dsl": DEFINITION_PROFILE,
        "definition": {"id": "precise", "steps": [
            {"id": "receive", "input": {"schema": schema},
             "output": {"bind": reference("$input#")}},
            {"id": "deliver", "needs": {"value": {"from": "receive", "require": "output"}},
             "input": {"bind": reference("value#")}, "output": {"bind": handoff["directBinding"]}},
        ]},
    })
    .to_string();
    let output = run_definition(&source, handoff["inputJson"].as_str().unwrap()).unwrap();
    assert_eq!(output, handoff["expectedDeliveryJson"].as_str().unwrap());
    assert_eq!(run_definition(&source, &output).unwrap(), output);
    let rounded = single(
        json!({"schema": schema}),
        handoff["expressionBinding"].clone(),
    );
    assert_eq!(
        run_definition(&rounded, &output).unwrap(),
        handoff["expectedExpressionResult"].to_string(),
    );

    let admission = &cases["admission"];
    let schema: Value = serde_json::from_str(admission["schemaJson"].as_str().unwrap()).unwrap();
    let source = single(json!({"schema": schema}), reference("$input#"));
    assert_error(
        run_definition(&source, admission["inputJson"].as_str().unwrap()),
        ErrorStage::Input,
        "contract",
    );
}

#[test]
fn official_numeric_vectors_choose_cel_types_without_losing_precision() {
    let cases: Vec<Value> =
        serde_json::from_str(include_str!("fixtures/numeric-binding-cases.json")).unwrap();
    assert_eq!(cases.len(), 16);
    for case in cases {
        let input_contract = match case.get("schema") {
            Some(schema) => json!({"schema": schema}),
            None => json!({}),
        };
        let source = single(
            input_contract,
            expression(
                case["code"].as_str().unwrap(),
                json!({"n": reference("$input#")}),
            ),
        );
        let result = run_definition(&source, case["inputJson"].as_str().unwrap());
        match case.get("errorAt") {
            Some(stage) => assert_eq!(
                result.unwrap_err().stage().as_str(),
                stage.as_str().unwrap()
            ),
            None => assert_eq!(result.unwrap(), case["expected"].to_string(), "{case}"),
        }
    }
}

#[test]
fn exact_yaml_schema_bounds_apply_before_cel() {
    let source = r#"
dsl: choral/flows-v1-beta.2
definition:
  id: yamlPrecision
  steps:
    - id: receive
      input: {schema: {type: number, minimum: 1.0000000000000001}}
      output: {bind: {$ref: "$input#"}}
"#;
    assert_error(run_definition(source, "1"), ErrorStage::Input, "contract");
    assert_eq!(run_definition(source, DECIMAL).unwrap(), DECIMAL);
}

#[test]
fn local_named_schemas_project_through_properties_items_and_dependency_outputs() {
    let source = r#"
dsl: choral/flows-v1-beta.2
schemas:
  integerAmount: {type: integer}
  amount: {$ref: integerAmount}
  data:
    type: object
    properties:
      amounts:
        type: array
        items: {$ref: amount}
    additionalProperties: {$ref: amount}
definition:
  id: nested
  steps:
    - id: receive
      input: {schema: {$ref: data}}
      output: {schema: {$ref: data}, bind: {$ref: "$input#"}}
    - id: deliver
      needs: {data: {from: receive, require: output}}
      input:
        bind:
          $expr:
            lang: choral-cel/v1
            code: 'type(n) == int && n == 3 && type(d.a) == int && d.a == 4'
            args:
              n: {$ref: "data#/amounts/0"}
              d: {$ref: "data#"}
      output: {bind: {$ref: "$input#"}}
"#;
    assert_eq!(
        run_definition(source, r#"{"amounts":[3.0],"a":4e0}"#).unwrap(),
        "true",
    );
    assert_error(
        run_definition(source, r#"{"amounts":[3.5],"a":4e0}"#),
        ErrorStage::Input,
        "contract",
    );
}

#[test]
fn nullable_integer_uses_int_and_a_number_alternative_uses_double() {
    for (types, cel_type) in [
        (json!(["null", "integer"]), "int"),
        (json!(["integer", "number"]), "double"),
        (json!(["number", "integer"]), "double"),
    ] {
        let source = single(
            json!({"schema": {"type": types}}),
            expression(
                &format!("type(n) == {cel_type}"),
                json!({"n": reference("$input#")}),
            ),
        );
        assert_eq!(run_definition(&source, "3.0").unwrap(), "true");
    }
}

#[test]
fn schema_resource_documents_validate_without_running() {
    let source = r#"
dsl: choral/flows-v1-beta.2
schemas:
  integer: {type: integer}
  alias: {$ref: integer}
"#;
    let preview: Value = serde_json::from_str(&validate_definition(source).unwrap()).unwrap();
    assert_eq!(
        preview,
        json!({"kind":"schemas","profile":DEFINITION_PROFILE,"version":PREVIEW_VERSION}),
    );
    assert_error(
        run_definition(source, "null"),
        ErrorStage::Definition,
        "schemas_only",
    );
}

#[test]
fn validation_rejects_unreadable_references_unsupported_profiles_and_external_contracts() {
    assert_error(
        validate_definition(&HANDOFF.replace(DEFINITION_PROFILE, "1.0.3")),
        ErrorStage::Definition,
        "schema",
    );
    assert_error(
        validate_definition(&single(json!({}), reference("hidden#"))),
        ErrorStage::Definition,
        "unreadable_root",
    );
    for reference_name in [
        "unavailable",
        "file:///readonly/schema.json",
        "https://example.invalid/schema",
    ] {
        let source = single(
            json!({"schema": {"$ref": reference_name}}),
            reference("$input#"),
        );
        assert_error(
            validate_definition(&source),
            ErrorStage::Definition,
            "contract",
        );
    }
    let cycle = r#"
dsl: choral/flows-v1-beta.2
schemas:
  first: {$ref: second}
  second: {$ref: first}
"#;
    assert_error(
        validate_definition(cycle),
        ErrorStage::Definition,
        "contract",
    );
}

#[test]
fn beta2_call_policy_passes_grammar_only_with_the_tolerate_value() {
    let source = format!(
        "dsl: {DEFINITION_PROFILE}\ndefinition:\n  id: supplierQuotes\n  steps:\n    - id: supplier\n      input: {{}}\n      call: {{target: supplier@1, onFailure: tolerate}}\n"
    );
    assert_error(
        validate_definition(&source),
        ErrorStage::Definition,
        "unsupported_step",
    );
    assert_error(
        validate_definition(&source.replace("tolerate", "ignore")),
        ErrorStage::Definition,
        "schema",
    );
}

#[test]
fn duplicate_input_keys_and_cel_budget_or_unbound_variables_fail_closed() {
    assert_error(
        run_definition(HANDOFF, r#"{"approved":false,"approved":false}"#),
        ErrorStage::Input,
        "invalid_key",
    );
    for code in ["privateSecret", "hostFunction()"] {
        let source = single(json!({}), expression(code, json!({})));
        assert_error(
            run_definition(&source, "null"),
            ErrorStage::Expression,
            "undeclared",
        );
    }
    let list = "[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]";
    let code = format!("{list}.all(x, {list}.all(y, x > 0 && y > 0)) || true");
    let source = single(json!({}), expression(&code, json!({})));
    assert_error(
        run_definition(&source, "null"),
        ErrorStage::Expression,
        "budget",
    );
}

#[test]
fn reserved_serde_marker_remains_ordinary_input_data() {
    let source = single(json!({}), reference("$input#"));
    let input = r#"{"$serde_json::private::Number":"7"}"#;
    assert_eq!(run_definition(&source, input).unwrap(), input);
}

#[test]
fn quoted_merge_like_key_remains_ordinary_json_data() {
    let source = single(json!({}), reference("$input#"));
    let input = r#"{"<<":false}"#;
    assert_eq!(run_definition(&source, input).unwrap(), input);
}

#[test]
fn json_inputs_decode_unicode_surrogate_pairs() {
    let source = single(json!({}), reference("$input#"));
    for (input, expected) in [
        (r#""\uD83D\uDE00""#, r#""😀""#),
        (r#"{"\uD83D\uDE00":["\uD83D\uDE00"]}"#, r#"{"😀":["😀"]}"#),
    ] {
        assert_eq!(run_definition(&source, input).unwrap(), expected);
    }
}

#[test]
fn json_definitions_decode_unicode_surrogate_pairs() {
    let source = single(json!({}), json!({"$literal": "😀"})).replace('😀', r"\uD83D\uDE00");
    validate_definition(&source).unwrap();
    assert_eq!(run_definition(&source, "null").unwrap(), r#""😀""#);
}

#[test]
fn json_decoding_preserves_key_and_size_checks() {
    let source = single(json!({}), reference("$input#"));
    assert_error(
        run_definition(&source, r#"[{"😀":1,"\uD83D\uDE00":2}]"#),
        ErrorStage::Input,
        "invalid_key",
    );
    assert_error(
        run_definition(&source, r#""\uD83D""#),
        ErrorStage::Input,
        "syntax",
    );
    let nested = format!("{}null{}", "[".repeat(33), "]".repeat(33));
    assert_error(run_definition(&source, &nested), ErrorStage::Input, "depth");
    let wide = format!("[{}0]", "0,".repeat(8191));
    assert_error(run_definition(&source, &wide), ErrorStage::Input, "size");
}

#[test]
fn independent_steps_preview_and_fail_in_the_same_order_after_reordering() {
    let mut document = json!({
        "dsl": DEFINITION_PROFILE,
        "definition": {"id": "diamond", "steps": [
            {"id": "start", "input": {}, "output": {"bind": reference("$input#")}},
            {
                "id": "alpha",
                "needs": {"source": {"from": "start", "require": "output"}},
                "input": {"bind": reference("source#/missing")},
                "output": {"bind": reference("$input#")},
            },
            {
                "id": "beta",
                "needs": {"source": {"from": "start", "require": "output"}},
                "input": {"bind": reference("source#")},
                "output": {"schema": {"type": "string"}, "bind": reference("$input#")},
            },
            {
                "id": "finish",
                "needs": {
                    "a": {"from": "alpha", "require": "output"},
                    "b": {"from": "beta", "require": "output"},
                },
                "input": {"bind": [reference("a#"), reference("b#")]},
                "output": {"bind": reference("$input#")},
            },
        ]},
    });
    let original = document.to_string();
    document["definition"]["steps"]
        .as_array_mut()
        .unwrap()
        .swap(1, 2);
    let reordered = document.to_string();
    for source in [&original, &reordered] {
        assert_error(run_definition(source, "{}"), ErrorStage::Binding, "absent");
    }
    assert_eq!(
        validate_definition(&original).unwrap(),
        validate_definition(&reordered).unwrap(),
    );
}
