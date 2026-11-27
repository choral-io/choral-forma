use std::fmt;
use std::str::{Chars, FromStr};

use serde::de::{Deserializer, Error as DeError, MapAccess, SeqAccess, Visitor};
use serde_json::{Map, Number, Value, value::RawValue};
use yaml_rust2::{Event, Yaml, parser::Parser, scanner::TScalarStyle};

use crate::error::{DefinitionError, ErrorStage, Result};

pub(crate) const MAX_BYTES: usize = 262_144;
const MAX_DEPTH: usize = 32;
const MAX_NODES: usize = 8192;
const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

pub(crate) fn parse(source: &str, stage: ErrorStage) -> Result<Value> {
    let error = |code| DefinitionError::new(stage, code);
    if source.len() > MAX_BYTES {
        return Err(error("size"));
    }
    let mut budget = ParseBudget {
        stage,
        remaining: MAX_NODES,
    };
    if let Ok(raw) = serde_json::from_str::<&RawValue>(source) {
        return parse_json(raw, 0, &mut budget);
    }
    if stage == ErrorStage::Input {
        return Err(error("syntax"));
    }
    let mut reader = Reader {
        parser: Parser::new_from_str(source),
        budget,
    };
    if !matches!(reader.next()?, Event::StreamStart)
        || !matches!(reader.next()?, Event::DocumentStart)
    {
        return Err(error("syntax"));
    }
    let start = reader.next()?;
    let value = reader.value(start, 0)?;
    if !matches!(reader.next()?, Event::DocumentEnd) || !matches!(reader.next()?, Event::StreamEnd)
    {
        return Err(error("document_count"));
    }
    Ok(value)
}

struct ParseBudget {
    stage: ErrorStage,
    remaining: usize,
}

impl ParseBudget {
    fn error(&self, code: &'static str) -> DefinitionError {
        DefinitionError::new(self.stage, code)
    }

    fn charge_node(&mut self, depth: usize) -> Result<()> {
        self.charge_token()?;
        if depth > MAX_DEPTH {
            return Err(self.error("depth"));
        }
        Ok(())
    }

    fn charge_token(&mut self) -> Result<()> {
        self.remaining = self
            .remaining
            .checked_sub(1)
            .ok_or_else(|| self.error("size"))?;
        Ok(())
    }

    fn number(&self, token: &str) -> Result<Value> {
        let number = Number::from_str(token).map_err(|_| self.error("non_json_number"))?;
        number_parts(&number.to_string()).ok_or_else(|| self.error("number_range"))?;
        Ok(Value::Number(number))
    }
}

fn parse_json(raw: &RawValue, depth: usize, budget: &mut ParseBudget) -> Result<Value> {
    budget.charge_node(depth)?;
    let token = raw.get();
    let syntax = budget.error("syntax");
    // Select containers explicitly so numeric lexemes and authored object keys stay distinct.
    let mut rejection = None;
    let visitor = JsonContainer {
        depth,
        budget,
        rejection: &mut rejection,
    };
    let decoded = match token.as_bytes().first() {
        Some(b'{') => serde_json::Deserializer::from_str(token).deserialize_map(visitor),
        Some(b'[') => serde_json::Deserializer::from_str(token).deserialize_seq(visitor),
        Some(b'"') => serde_json::from_str::<String>(token).map(Value::String),
        Some(b't') => Ok(Value::Bool(true)),
        Some(b'f') => Ok(Value::Bool(false)),
        Some(b'n') => Ok(Value::Null),
        _ => return budget.number(token),
    };
    decoded.map_err(|_| rejection.unwrap_or(syntax))
}

struct JsonContainer<'a> {
    depth: usize,
    budget: &'a mut ParseBudget,
    rejection: &'a mut Option<DefinitionError>,
}

impl JsonContainer<'_> {
    fn reject<E: DeError>(&mut self, error: DefinitionError) -> E {
        *self.rejection = Some(error);
        E::custom(error)
    }
}

impl<'de> Visitor<'de> for JsonContainer<'_> {
    type Value = Value;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON object or array")
    }

    fn visit_map<M: MapAccess<'de>>(
        mut self,
        mut map: M,
    ) -> std::result::Result<Self::Value, M::Error> {
        let mut values = Map::new();
        while let Some(key) = map.next_key::<String>()? {
            if values.contains_key(&key) {
                return Err(self.reject(self.budget.error("invalid_key")));
            }
            self.budget
                .charge_token()
                .map_err(|error| self.reject(error))?;
            let raw = map.next_value::<&'de RawValue>()?;
            let value =
                parse_json(raw, self.depth + 1, self.budget).map_err(|error| self.reject(error))?;
            values.insert(key, value);
        }
        Ok(Value::Object(values))
    }

    fn visit_seq<S: SeqAccess<'de>>(
        mut self,
        mut seq: S,
    ) -> std::result::Result<Self::Value, S::Error> {
        let mut values = Vec::new();
        while let Some(raw) = seq.next_element::<&'de RawValue>()? {
            let value =
                parse_json(raw, self.depth + 1, self.budget).map_err(|error| self.reject(error))?;
            values.push(value);
        }
        Ok(Value::Array(values))
    }
}

struct Reader<'source> {
    parser: Parser<Chars<'source>>,
    budget: ParseBudget,
}

impl Reader<'_> {
    fn error(&self, code: &'static str) -> DefinitionError {
        self.budget.error(code)
    }

    fn next(&mut self) -> Result<Event> {
        self.parser
            .next_token()
            .map(|(event, _)| event)
            .map_err(|_| self.error("syntax"))
    }

    fn value(&mut self, start: Event, depth: usize) -> Result<Value> {
        self.budget.charge_node(depth)?;
        match start {
            Event::MappingStart(0, None) => {
                let mut output = Map::new();
                loop {
                    let start = self.next()?;
                    if matches!(start, Event::MappingEnd) {
                        break;
                    }
                    let Event::Scalar(key, style, 0, None) = start else {
                        return Err(self.error("non_string_key"));
                    };
                    let Value::String(key) = self.scalar(key, style)? else {
                        return Err(self.error("non_string_key"));
                    };
                    if (style == TScalarStyle::Plain && key == "<<") || output.contains_key(&key) {
                        return Err(self.error("invalid_key"));
                    }
                    self.budget.charge_token()?;
                    let start = self.next()?;
                    output.insert(key, self.value(start, depth + 1)?);
                }
                Ok(Value::Object(output))
            }
            Event::SequenceStart(0, None) => {
                let mut output = Vec::new();
                loop {
                    let start = self.next()?;
                    if matches!(start, Event::SequenceEnd) {
                        break;
                    }
                    output.push(self.value(start, depth + 1)?);
                }
                Ok(Value::Array(output))
            }
            Event::Scalar(token, style, 0, None) => self.scalar(token, style),
            _ => Err(self.error("unsupported_yaml")),
        }
    }

    fn scalar(&self, token: String, style: TScalarStyle) -> Result<Value> {
        if style != TScalarStyle::Plain {
            return Ok(Value::String(token));
        }
        // Keep the original decimal token even when YAML has recognized its numeric kind.
        // The JSON compatibility boundary excludes non-JSON numeric spellings.
        if matches!(token.as_str(), "NULL" | "Null") {
            return Ok(Value::Null);
        }
        match Yaml::from_str(&token) {
            Yaml::Null => Ok(Value::Null),
            Yaml::Boolean(value) => Ok(Value::Bool(value)),
            Yaml::Integer(_) | Yaml::Real(_) => self.budget.number(&token),
            _ => Ok(Value::String(token)),
        }
    }
}

fn number_parts(token: &str) -> Option<(&str, i32)> {
    let (mantissa, exponent) = match token.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, exponent.parse::<i32>().ok()?),
        None => (token, 0),
    };
    (exponent.unsigned_abs() <= 10_000 && mantissa.len() <= 1024).then_some((mantissa, exponent))
}

/// Classify an exact number before any conversion to double.
pub(crate) fn exact_integer(number: &Number) -> std::result::Result<Option<i64>, ()> {
    let text = number.to_string();
    let (mantissa, exponent) = number_parts(&text).ok_or(())?;
    let negative = mantissa.starts_with('-');
    let mantissa = mantissa.trim_start_matches('-');
    let (whole, fractional) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let digits = format!("{whole}{fractional}");
    let digits = digits.trim_start_matches('0');
    if digits.is_empty() {
        return Ok(Some(0));
    }
    let scale = exponent - fractional.len() as i32;
    let (significant, padding) = if scale < 0 {
        let cut = scale.unsigned_abs() as usize;
        if cut >= digits.len()
            || !digits[digits.len() - cut..]
                .bytes()
                .all(|digit| digit == b'0')
        {
            return Ok(None);
        }
        (&digits[..digits.len() - cut], 0)
    } else {
        (digits, scale as usize)
    };
    if significant.len() + padding > 16 {
        return Err(());
    }
    let integer = significant.parse::<i64>().map_err(|_| ())? * 10_i64.pow(padding as u32);
    if integer > MAX_SAFE_INTEGER {
        return Err(());
    }
    Ok(Some(if negative { -integer } else { integer }))
}

#[derive(Default)]
pub(crate) struct ValueBudget {
    nodes: usize,
    bytes: usize,
}

impl ValueBudget {
    /// Charge copied values before cloning them so repeated references cannot amplify memory use.
    pub(crate) fn charge(&mut self, value: &Value, depth: usize, stage: ErrorStage) -> Result<()> {
        self.charge_node(depth, stage)?;
        match value {
            Value::Number(number) => {
                exact_integer(number).map_err(|_| DefinitionError::new(stage, "number_range"))?;
                self.charge_bytes(number.to_string().len(), stage)?;
            }
            Value::String(text) => self.charge_bytes(text.len(), stage)?,
            Value::Object(values) => {
                for (key, value) in values {
                    self.charge_bytes(key.len(), stage)?;
                    self.charge(value, depth + 1, stage)?;
                }
            }
            Value::Array(values) => {
                for value in values {
                    self.charge(value, depth + 1, stage)?;
                }
            }
            _ => {}
        }
        Ok(())
    }

    pub(crate) fn charge_node(&mut self, depth: usize, stage: ErrorStage) -> Result<()> {
        self.nodes += 1;
        if self.nodes > MAX_NODES || depth > MAX_DEPTH {
            return Err(DefinitionError::new(stage, "size"));
        }
        Ok(())
    }

    pub(crate) fn charge_bytes(&mut self, bytes: usize, stage: ErrorStage) -> Result<()> {
        self.bytes += bytes;
        if self.bytes > MAX_BYTES {
            return Err(DefinitionError::new(stage, "size"));
        }
        Ok(())
    }
}
