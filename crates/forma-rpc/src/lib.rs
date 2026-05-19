use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

pub const SCHEMA_VERSION: u16 = 1;

/// Returns the core version visible to RPC adapters.
pub fn core_version() -> &'static str {
    forma_core::version()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Operation {
    #[serde(rename = "check")]
    Check,
    #[serde(rename = "config.inspect")]
    ConfigInspect,
}

impl Operation {
    pub fn method(self) -> &'static str {
        match self {
            Self::Check => "check",
            Self::ConfigInspect => "config.inspect",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OperationRequest {
    Check(CheckRequest),
    ConfigInspect(ConfigInspectRequest),
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct CheckRequest {}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInspectRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: forma_core::OperationStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<forma_core::DiagnosticSummary>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diagnostics: Vec<forma_core::Diagnostic>,
}

impl OperationResult {
    fn passed(operation: Operation) -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            operation: operation.method().to_string(),
            status: forma_core::OperationStatus::Passed,
            summary: Some(forma_core::DiagnosticSummary::default()),
            diagnostics: Vec::new(),
        }
    }

    pub fn to_json_string(&self) -> String {
        serde_json::to_string(self).expect("operation results should serialize")
    }
}

#[derive(Debug, Error)]
pub enum OperationError {
    #[error("invalid params")]
    InvalidParams,
    #[error("operation failed")]
    Failed,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct Dispatcher;

impl Dispatcher {
    pub fn dispatch(&self, request: OperationRequest) -> Result<OperationResult, OperationError> {
        match request {
            OperationRequest::Check(_) => Ok(OperationResult::passed(Operation::Check)),
            OperationRequest::ConfigInspect(_) => {
                Ok(OperationResult::passed(Operation::ConfigInspect))
            }
        }
    }

    pub fn handle_json_rpc(&self, body: &[u8]) -> Value {
        let value = match serde_json::from_slice::<Value>(body) {
            Ok(value) => value,
            Err(_) => {
                return json_rpc_error(
                    Value::Null,
                    JsonRpcErrorCode::ParseError,
                    "Parse error.",
                    "parse.error",
                );
            }
        };

        let request = match JsonRpcRequest::from_value(value) {
            Ok(request) => request,
            Err(error) => return error.into_response(),
        };

        let id = request.id.clone();
        let operation = match operation_from_method(&request.method, request.params) {
            Ok(operation) => operation,
            Err(error) => return error.with_id(id).into_response(),
        };

        match self.dispatch(operation) {
            Ok(result) => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": result,
            }),
            Err(OperationError::InvalidParams) => JsonRpcFailure::new(
                id,
                JsonRpcErrorCode::InvalidParams,
                "Invalid params.",
                "params.invalid",
            )
            .into_response(),
            Err(OperationError::Failed) => JsonRpcFailure::new(
                id,
                JsonRpcErrorCode::InternalError,
                "Internal error.",
                "operation.failed",
            )
            .into_response(),
        }
    }

    pub fn handle_json_rpc_text(&self, body: &[u8]) -> String {
        self.handle_json_rpc(body).to_string()
    }
}

#[derive(Debug, Clone)]
struct JsonRpcRequest {
    id: Value,
    method: String,
    params: Option<Value>,
}

impl JsonRpcRequest {
    fn from_value(value: Value) -> Result<Self, JsonRpcFailure> {
        let Value::Object(mut object) = value else {
            let code = if value.is_array() {
                "request.batchUnsupported"
            } else {
                "request.objectRequired"
            };
            return Err(JsonRpcFailure::new(
                Value::Null,
                JsonRpcErrorCode::InvalidRequest,
                "Invalid Request.",
                code,
            ));
        };

        let id = match object.remove("id") {
            Some(id) => id,
            None => {
                return Err(JsonRpcFailure::new(
                    Value::Null,
                    JsonRpcErrorCode::InvalidRequest,
                    "Invalid Request.",
                    "request.idRequired",
                ));
            }
        };

        match object.remove("jsonrpc") {
            Some(Value::String(version)) if version == "2.0" => {}
            _ => {
                return Err(JsonRpcFailure::new(
                    id,
                    JsonRpcErrorCode::InvalidRequest,
                    "Invalid Request.",
                    "request.jsonrpcRequired",
                ));
            }
        }

        let method = match object.remove("method") {
            Some(Value::String(method)) if !method.is_empty() => method,
            _ => {
                return Err(JsonRpcFailure::new(
                    id,
                    JsonRpcErrorCode::InvalidRequest,
                    "Invalid Request.",
                    "request.methodRequired",
                ));
            }
        };

        Ok(Self {
            id,
            method,
            params: object.remove("params"),
        })
    }
}

fn operation_from_method(
    method: &str,
    params: Option<Value>,
) -> Result<OperationRequest, JsonRpcFailure> {
    let params = match params {
        Some(Value::Object(params)) => Value::Object(params),
        Some(_) => {
            return Err(JsonRpcFailure::without_id(
                JsonRpcErrorCode::InvalidParams,
                "Invalid params.",
                "params.invalid",
            ));
        }
        None => json!({}),
    };

    match method {
        "check" => serde_json::from_value::<CheckRequest>(params)
            .map(OperationRequest::Check)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "config.inspect" => match serde_json::from_value::<ConfigInspectRequest>(params) {
            Ok(request) => {
                if let Some(path) = request.path.as_deref()
                    && forma_core::WorkspacePath::parse_cli(path).is_err()
                {
                    return Err(JsonRpcFailure::without_id(
                        JsonRpcErrorCode::InvalidParams,
                        "Invalid params.",
                        "params.invalid",
                    ));
                }
                Ok(OperationRequest::ConfigInspect(request))
            }
            Err(_) => Err(JsonRpcFailure::without_id(
                JsonRpcErrorCode::InvalidParams,
                "Invalid params.",
                "params.invalid",
            )),
        },
        _ => Err(JsonRpcFailure::without_id(
            JsonRpcErrorCode::MethodNotFound,
            "Method not found.",
            "method.notFound",
        )),
    }
}

#[derive(Debug, Clone)]
struct JsonRpcFailure {
    id: Value,
    code: JsonRpcErrorCode,
    message: &'static str,
    data_code: &'static str,
}

impl JsonRpcFailure {
    fn new(
        id: Value,
        code: JsonRpcErrorCode,
        message: &'static str,
        data_code: &'static str,
    ) -> Self {
        Self {
            id,
            code,
            message,
            data_code,
        }
    }

    fn without_id(code: JsonRpcErrorCode, message: &'static str, data_code: &'static str) -> Self {
        Self::new(Value::Null, code, message, data_code)
    }

    fn with_id(mut self, id: Value) -> Self {
        self.id = id;
        self
    }

    fn into_response(self) -> Value {
        json_rpc_error(self.id, self.code, self.message, self.data_code)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i64)]
pub enum JsonRpcErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
}

fn json_rpc_error(
    id: Value,
    code: JsonRpcErrorCode,
    message: &'static str,
    data_code: &'static str,
) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code as i64,
            "message": message,
            "data": {
                "code": data_code,
                "details": [],
            },
        },
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{Dispatcher, JsonRpcErrorCode};

    #[test]
    fn json_rpc_rejects_parse_errors() {
        let response = Dispatcher.handle_json_rpc(b"{");

        assert!(response.get("result").is_none());
        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(response["id"], serde_json::Value::Null);
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::ParseError as i64
        );
        assert_eq!(response["error"]["data"]["code"], "parse.error");
    }

    #[test]
    fn json_rpc_rejects_invalid_requests() {
        let response = Dispatcher
            .handle_json_rpc(br#"[{"jsonrpc":"2.0","id":1,"method":"check","params":{}}]"#);

        assert_eq!(response["id"], serde_json::Value::Null);
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(
            response["error"]["data"]["code"],
            "request.batchUnsupported"
        );
    }

    #[test]
    fn json_rpc_rejects_notifications() {
        let response =
            Dispatcher.handle_json_rpc(br#"{"jsonrpc":"2.0","method":"check","params":{}}"#);

        assert_eq!(response["id"], serde_json::Value::Null);
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(response["error"]["data"]["code"], "request.idRequired");
    }

    #[test]
    fn json_rpc_rejects_missing_jsonrpc() {
        let response = Dispatcher.handle_json_rpc(br#"{"id":"1","method":"check","params":{}}"#);

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(response["error"]["data"]["code"], "request.jsonrpcRequired");
    }

    #[test]
    fn json_rpc_rejects_missing_method() {
        let response = Dispatcher.handle_json_rpc(br#"{"jsonrpc":"2.0","id":"1","params":{}}"#);

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(response["error"]["data"]["code"], "request.methodRequired");
    }

    #[test]
    fn json_rpc_reports_method_not_found() {
        let response = Dispatcher.handle_json_rpc(
            br#"{"jsonrpc":"2.0","id":"1","method":"missing.operation","params":{}}"#,
        );

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::MethodNotFound as i64
        );
        assert_eq!(response["error"]["data"]["code"], "method.notFound");
    }

    #[test]
    fn json_rpc_reports_invalid_params() {
        let response = Dispatcher
            .handle_json_rpc(br#"{"jsonrpc":"2.0","id":"1","method":"check","params":[]}"#);

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidParams as i64
        );
        assert_eq!(response["error"]["data"]["code"], "params.invalid");
    }

    #[test]
    fn json_rpc_rejects_unknown_params() {
        let response = Dispatcher.handle_json_rpc(
            br#"{"jsonrpc":"2.0","id":"1","method":"check","params":{"unexpected":true}}"#,
        );

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidParams as i64
        );
        assert_eq!(response["error"]["data"]["code"], "params.invalid");
    }

    #[test]
    fn json_rpc_dispatches_successfully() {
        let response = Dispatcher
            .handle_json_rpc(br#"{"jsonrpc":"2.0","id":"1","method":"check","params":{}}"#);

        assert!(response.get("error").is_none());
        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(response["id"], "1");
        assert_eq!(response["result"]["schemaVersion"], 1);
        assert_eq!(response["result"]["operation"], "check");
        assert_eq!(response["result"]["status"], "passed");
        assert_eq!(
            response["result"]["summary"],
            json!({"errors":0,"warnings":0,"infos":0})
        );
    }

    #[test]
    fn operation_names_are_json_facing_method_names() {
        assert_eq!(
            serde_json::to_value(super::Operation::Check).unwrap(),
            "check"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::ConfigInspect).unwrap(),
            "config.inspect"
        );
    }
}
