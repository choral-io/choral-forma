use serde_json::{Value, json};

use crate::{DEFINITION_PROFILE, Operation, Result, Step, compile_execution, parse_document};

/// Return the version-1 static topology of an executable Definition as JSON.
/// The topology identifies dependency edges, Watcher observations and possible deliveries.
/// It requires only the Definition source and uses the same admission checks as validation for replay.
pub fn execution_topology(source: &str) -> Result<String> {
    let document = parse_document(source)?;
    let plan = compile_execution(&document)?;
    Ok(json!({
        "version": 1,
        "profile": DEFINITION_PROFILE,
        "id": plan.id,
        "entry": plan.entry().id,
        "deliveryCandidates": plan.deliveries.iter().map(|&i| plan.steps[i].id).collect::<Vec<_>>(),
        "steps": plan.order.iter().map(|&i| step_topology(&plan.steps[i])).collect::<Vec<_>>(),
    })
    .to_string())
}

fn step_topology(step: &Step<'_>) -> Value {
    match &step.operation {
        Operation::Pure => json!({"id": step.id, "kind": "process", "needs": step.needs}),
        Operation::Call { target, .. } => json!({
            "id": step.id, "kind": "call", "needs": step.needs, "target": target,
        }),
        Operation::Watch(watcher) => {
            // Compilation uses the single direct observation as a scheduling dependency.
            // Its authored owner is watch.observe. The submission has its own success gate.
            let direct = &step.needs[0];
            json!({
                "id": step.id, "kind": "watch", "needs": [],
                "observe": [
                    {"alias": direct.alias, "from": direct.from},
                    {"alias": watcher.local, "position": watcher.position(step.id), "needs": [&watcher.local_need]},
                ],
                "cases": watcher.exits().map(|exit| json!({"on": watcher.local, "exit": exit})).collect::<Vec<_>>(),
            })
        }
    }
}
