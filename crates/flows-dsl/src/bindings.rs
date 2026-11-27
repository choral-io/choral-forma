use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::{Arc, LazyLock};

use cel::{Context, Env, ExecutionError, Program, RuntimeOptions, Value as CelValue};
use serde_json::{Number, Value};

use crate::contracts::Contracts;
use crate::error::{DefinitionError, ErrorStage, Result, definition};
use crate::values::{ValueBudget, exact_integer};

const MAX_EXPRESSION_BYTES: usize = 1024;
const MAX_CEL_ITERATIONS: u64 = 256;

static CEL_ENV: LazyLock<Arc<Env>> = LazyLock::new(|| {
    let mut env = Env::stdlib();
    env.set_options(RuntimeOptions::default().with_max_iterations(MAX_CEL_ITERATIONS));
    Arc::new(env)
});

pub(crate) type Roots<'a> = BTreeMap<&'a str, (&'a Value, Option<&'a Value>)>;

pub(crate) enum Binding {
    Reference(Reference),
    Expression {
        program: Box<Program>,
        arguments: Vec<(String, Binding)>,
    },
    Object(Vec<(String, Binding)>),
    Array(Vec<Binding>),
    Literal(Value),
}

pub(crate) struct Reference {
    root: String,
    segments: Vec<String>,
}

impl Reference {
    fn compile(token: &str, roots: &BTreeSet<&str>) -> Result<Self> {
        let (root, pointer) = token
            .split_once('#')
            .ok_or_else(|| definition("reference"))?;
        if !roots.contains(root) {
            return Err(definition("unreadable_root"));
        }
        let segments = if pointer.is_empty() {
            Vec::new()
        } else {
            pointer
                .strip_prefix('/')
                .ok_or_else(|| definition("reference"))?
                .split('/')
                .map(|part| part.replace("~1", "/").replace("~0", "~"))
                .collect()
        };
        Ok(Self {
            root: root.to_owned(),
            segments,
        })
    }

    fn read<'a>(
        &self,
        roots: &Roots<'a>,
        contracts: &'a Contracts,
    ) -> Result<(&'a Value, Option<&'a Value>)> {
        let error = |code| DefinitionError::new(ErrorStage::Binding, code);
        let &(mut value, mut schema) = roots
            .get(self.root.as_str())
            .ok_or_else(|| error("unreadable_root"))?;
        for segment in &self.segments {
            match value {
                Value::Array(items) => {
                    let index = segment
                        .parse::<usize>()
                        .ok()
                        .filter(|index| index.to_string() == *segment)
                        .ok_or_else(|| error("absent"))?;
                    value = items.get(index).ok_or_else(|| error("absent"))?;
                    schema = contracts.items(schema);
                }
                Value::Object(properties) => {
                    value = properties.get(segment).ok_or_else(|| error("absent"))?;
                    schema = contracts.property(schema, segment);
                }
                _ => return Err(error("absent")),
            }
        }
        Ok((value, schema))
    }
}

impl Binding {
    pub(crate) fn compile(template: &Value, roots: &BTreeSet<&str>) -> Result<Self> {
        if template.get("$call").is_some() {
            return Err(definition("unsupported_predicate_call"));
        }
        if let Some(token) = template.get("$ref").and_then(Value::as_str) {
            return Ok(Self::Reference(Reference::compile(token, roots)?));
        }
        if let Some(literal) = template.get("$literal") {
            return Ok(Self::Literal(literal.clone()));
        }
        if let Some(expression) = template.get("$expr") {
            let code = expression["code"]
                .as_str()
                .filter(|code| code.len() <= MAX_EXPRESSION_BYTES)
                .ok_or_else(|| definition("expression_syntax"))?;
            let program = CEL_ENV
                .compile(code)
                .map_err(|_| definition("expression_syntax"))?;
            let arguments = expression["args"]
                .as_object()
                .ok_or_else(|| definition("expression_syntax"))?
                .iter()
                .map(|(name, value)| Ok((name.clone(), Self::compile(value, roots)?)))
                .collect::<Result<_>>()?;
            return Ok(Self::Expression {
                program: Box::new(program),
                arguments,
            });
        }
        Ok(match template {
            Value::Object(properties) => Self::Object(
                properties
                    .iter()
                    .map(|(key, value)| Ok((key.clone(), Self::compile(value, roots)?)))
                    .collect::<Result<_>>()?,
            ),
            Value::Array(items) => Self::Array(
                items
                    .iter()
                    .map(|item| Self::compile(item, roots))
                    .collect::<Result<_>>()?,
            ),
            _ => Self::Literal(template.clone()),
        })
    }

    pub(crate) fn evaluate(
        &self,
        roots: &Roots<'_>,
        contracts: &Contracts,
        stage: ErrorStage,
    ) -> Result<Value> {
        self.evaluate_bounded(roots, contracts, stage, 0, &mut ValueBudget::default())
    }

    fn evaluate_bounded(
        &self,
        roots: &Roots<'_>,
        contracts: &Contracts,
        stage: ErrorStage,
        depth: usize,
        budget: &mut ValueBudget,
    ) -> Result<Value> {
        match self {
            Self::Reference(reference) => {
                let (value, _) = reference.read(roots, contracts)?;
                budget.charge(value, depth, stage)?;
                Ok(value.clone())
            }
            Self::Literal(value) => {
                budget.charge(value, depth, stage)?;
                Ok(value.clone())
            }
            Self::Expression { program, arguments } => {
                let mut context = Context::with_env(Arc::clone(&CEL_ENV));
                let mut arguments_budget = ValueBudget::default();
                for (name, argument) in arguments {
                    let cel_argument = if let Self::Reference(reference) = argument {
                        let (value, schema) = reference.read(roots, contracts)?;
                        arguments_budget.charge(value, 0, ErrorStage::Input)?;
                        to_cel(value, schema, contracts)?
                    } else {
                        let value = argument.evaluate_bounded(
                            roots,
                            contracts,
                            ErrorStage::Input,
                            0,
                            &mut arguments_budget,
                        )?;
                        to_cel(&value, None, contracts)?
                    };
                    context.add_variable_from_value(name.clone(), cel_argument);
                }
                let value = evaluate_cel(program, &context, stage)?;
                budget.charge(&value, depth, stage)?;
                Ok(value)
            }
            Self::Object(fields) => {
                budget.charge_node(depth, stage)?;
                let values = fields
                    .iter()
                    .map(|(key, child)| {
                        budget.charge_bytes(key.len(), stage)?;
                        let value =
                            child.evaluate_bounded(roots, contracts, stage, depth + 1, budget)?;
                        Ok((key.clone(), value))
                    })
                    .collect::<Result<_>>()?;
                Ok(Value::Object(values))
            }
            Self::Array(items) => {
                budget.charge_node(depth, stage)?;
                let values = items
                    .iter()
                    .map(|child| child.evaluate_bounded(roots, contracts, stage, depth + 1, budget))
                    .collect::<Result<_>>()?;
                Ok(Value::Array(values))
            }
        }
    }
}

fn to_cel(value: &Value, schema: Option<&Value>, contracts: &Contracts) -> Result<CelValue> {
    let error = |code| DefinitionError::new(ErrorStage::Expression, code);
    Ok(match value {
        Value::Null => CelValue::Null,
        Value::Bool(value) => CelValue::Bool(*value),
        Value::String(value) => CelValue::String(Arc::new(value.clone())),
        Value::Number(number) if contracts.requires_integer(schema) => {
            let integer = exact_integer(number)
                .map_err(|_| error("number_range"))?
                .ok_or_else(|| error("integer"))?;
            CelValue::Int(integer)
        }
        Value::Number(number) => CelValue::Float(
            number
                .as_f64()
                .filter(|value| value.is_finite())
                .ok_or_else(|| error("number_range"))?,
        ),
        Value::Array(items) => CelValue::List(Arc::new(
            items
                .iter()
                .map(|item| to_cel(item, contracts.items(schema), contracts))
                .collect::<Result<_>>()?,
        )),
        Value::Object(properties) => {
            let properties = properties
                .iter()
                .map(|(key, item)| {
                    let value = to_cel(item, contracts.property(schema, key), contracts)?;
                    Ok((key.clone(), value))
                })
                .collect::<Result<HashMap<_, _>>>()?;
            CelValue::from(properties)
        }
    })
}

fn evaluate_cel(program: &Program, context: &Context<'_, '_>, stage: ErrorStage) -> Result<Value> {
    let result = program.execute(context).map_err(|error| {
        let code = match error {
            ExecutionError::IterationBudgetExceeded { .. } => "budget",
            ExecutionError::UndeclaredReference(_) => "undeclared",
            _ => "failed",
        };
        DefinitionError::new(ErrorStage::Expression, code)
    })?;
    Ok(match result {
        CelValue::Null => Value::Null,
        CelValue::Bool(value) => Value::Bool(value),
        CelValue::String(value) => Value::String(Arc::unwrap_or_clone(value)),
        CelValue::Int(value) => Value::Number(value.into()),
        CelValue::UInt(value) => Value::Number(value.into()),
        CelValue::Float(value) => Value::Number(
            Number::from_f64(value).ok_or_else(|| DefinitionError::new(stage, "non_finite"))?,
        ),
        _ => return Err(DefinitionError::new(stage, "unsupported_result")),
    })
}
