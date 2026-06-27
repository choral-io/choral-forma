use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

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
    #[serde(rename = "files.list")]
    FilesList,
    #[serde(rename = "workspace.dashboard")]
    WorkspaceDashboard,
    #[serde(rename = "inspect")]
    Inspect,
    #[serde(rename = "list")]
    List,
    #[serde(rename = "tasks.list")]
    TasksList,
    #[serde(rename = "board.show")]
    BoardShow,
    #[serde(rename = "tasks.inspect")]
    TasksInspect,
    #[serde(rename = "create")]
    Create,
    #[serde(rename = "init")]
    Init,
    #[serde(rename = "view.render")]
    ViewRender,
    #[serde(rename = "file.render")]
    FileRender,
    #[serde(rename = "file.references")]
    FileReferences,
    #[serde(rename = "workspace.health")]
    WorkspaceHealth,
    #[serde(rename = "skills.list")]
    SkillsList,
    #[serde(rename = "skills.get")]
    SkillsGet,
}

impl Operation {
    pub fn method(self) -> &'static str {
        match self {
            Self::Check => "check",
            Self::ConfigInspect => "config.inspect",
            Self::FilesList => "files.list",
            Self::WorkspaceDashboard => "workspace.dashboard",
            Self::Inspect => "inspect",
            Self::List => "list",
            Self::TasksList => "tasks.list",
            Self::BoardShow => "board.show",
            Self::TasksInspect => "tasks.inspect",
            Self::Create => "create",
            Self::Init => "init",
            Self::ViewRender => "view.render",
            Self::FileRender => "file.render",
            Self::FileReferences => "file.references",
            Self::WorkspaceHealth => "workspace.health",
            Self::SkillsList => "skills.list",
            Self::SkillsGet => "skills.get",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum OperationRequest {
    Check(CheckRequest),
    ConfigInspect(ConfigInspectRequest),
    FilesList(FilesListRequest),
    WorkspaceDashboard(WorkspaceDashboardRequest),
    Inspect(InspectRequest),
    List(ListRequest),
    TasksList(TasksListRequest),
    BoardShow(BoardShowRequest),
    TasksInspect(TasksInspectRequest),
    Create(CreateRequest),
    Init(InitRequest),
    ViewRender(ViewRenderRequest),
    FileRender(FileRenderRequest),
    FileReferences(FileReferencesRequest),
    WorkspaceHealth(WorkspaceHealthRequest),
    SkillsList(SkillsListRequest),
    SkillsGet(SkillsGetRequest),
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

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct FilesListRequest {}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDashboardRequest {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct InspectRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ListRequest {
    pub space: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct TasksListRequest {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct BoardShowRequest {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct TasksInspectRequest {
    pub path_or_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct CreateRequest {
    pub space: String,
    #[serde(default)]
    pub inputs: BTreeMap<String, serde_yml::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct InitRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderRequest {
    pub view: String,
    #[serde(default)]
    pub params: BTreeMap<String, serde_yml::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct FileRenderRequest {
    pub path: String,
    #[serde(default = "default_render_format")]
    pub format: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct FileReferencesRequest {
    pub path: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceHealthRequest {}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct SkillsListRequest {}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[serde(rename_all = "camelCase")]
pub struct SkillsGetRequest {
    pub id: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(flatten)]
    pub data: BTreeMap<String, Value>,
}

impl OperationResult {
    pub fn to_json_string(&self) -> String {
        serde_json::to_string(self).expect("operation results should serialize")
    }

    pub fn failed(operation: Operation, diagnostic: forma_core::Diagnostic) -> Self {
        let diagnostics = vec![diagnostic];
        let summary = forma_core::DiagnosticSummary::from_diagnostics(&diagnostics);
        Self {
            schema_version: SCHEMA_VERSION,
            operation: operation.method().to_string(),
            status: summary.status(),
            summary: Some(summary),
            diagnostics,
            path: None,
            data: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Error)]
pub enum OperationError {
    #[error("invalid params")]
    InvalidParams,
    #[error("operation failed")]
    Failed,
}

#[derive(Debug, Clone)]
pub struct Dispatcher {
    root: PathBuf,
}

impl Default for Dispatcher {
    fn default() -> Self {
        Self::new(".")
    }
}

impl Dispatcher {
    pub fn new(root: impl AsRef<Path>) -> Self {
        Self {
            root: root.as_ref().to_path_buf(),
        }
    }

    pub fn dispatch(&self, request: OperationRequest) -> Result<OperationResult, OperationError> {
        let root = &self.root;
        match request {
            OperationRequest::Check(_) => {
                Ok(OperationResult::from(forma_core::check_workspace(root)))
            }
            OperationRequest::ConfigInspect(request) => {
                forma_core::inspect_config(root, request.path.as_deref())
                    .map(OperationResult::from)
                    .or_else(|error| Ok(core_error_result(Operation::ConfigInspect, error)))
            }
            OperationRequest::FilesList(_) => forma_core::list_files(root)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::FilesList, error))),
            OperationRequest::WorkspaceDashboard(_) => forma_core::workspace_dashboard(root)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::WorkspaceDashboard, error))),
            OperationRequest::Inspect(request) => {
                match (request.path, request.space, request.entry) {
                    (Some(path), None, None) => forma_core::inspect_entry_by_path(root, &path)
                        .map(OperationResult::from)
                        .or_else(|error| Ok(core_error_result(Operation::Inspect, error))),
                    (None, Some(space), Some(entry)) => {
                        forma_core::inspect_entry_by_space(root, &space, &entry)
                            .map(OperationResult::from)
                            .or_else(|error| Ok(core_error_result(Operation::Inspect, error)))
                    }
                    _ => Err(OperationError::InvalidParams),
                }
            }
            OperationRequest::List(request) => forma_core::list_space(root, &request.space)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::List, error))),
            OperationRequest::TasksList(_) => forma_core::tasks_list(root)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::TasksList, error))),
            OperationRequest::BoardShow(_) => forma_core::board_show(root)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::BoardShow, error))),
            OperationRequest::TasksInspect(request) => {
                forma_core::tasks_inspect(root, &request.path_or_id)
                    .map(OperationResult::from)
                    .or_else(|error| Ok(core_error_result(Operation::TasksInspect, error)))
            }
            OperationRequest::Create(request) => {
                forma_core::create_entry(root, &request.space, request.inputs)
                    .map(OperationResult::from)
                    .or_else(|error| Ok(core_error_result(Operation::Create, error)))
            }
            OperationRequest::Init(request) => forma_core::init_workspace(
                root,
                request
                    .name
                    .as_deref()
                    .unwrap_or("Untitled Forma Workspace"),
                request.language.as_deref().unwrap_or("en"),
                request.timezone.as_deref().unwrap_or("UTC"),
            )
            .map(OperationResult::from)
            .or_else(|error| Ok(core_error_result(Operation::Init, error))),
            OperationRequest::ViewRender(request) => {
                forma_core::render_view(root, &request.view, request.params)
                    .map(OperationResult::from)
                    .or_else(|error| Ok(core_error_result(Operation::ViewRender, error)))
            }
            OperationRequest::FileRender(request) => {
                forma_core::render_file(root, &request.path, &request.format)
                    .map(OperationResult::from)
                    .or_else(|error| Ok(core_error_result(Operation::FileRender, error)))
            }
            OperationRequest::FileReferences(request) => {
                forma_core::list_file_references(root, &request.path)
                    .map(OperationResult::from)
                    .or_else(|error| Ok(core_error_result(Operation::FileReferences, error)))
            }
            OperationRequest::WorkspaceHealth(_) => forma_core::operations::workspace_health(root)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::WorkspaceHealth, error))),
            OperationRequest::SkillsList(_) => forma_core::skills_list(root)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::SkillsList, error))),
            OperationRequest::SkillsGet(request) => forma_core::skills_get(root, &request.id)
                .map(OperationResult::from)
                .or_else(|error| Ok(core_error_result(Operation::SkillsGet, error))),
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

fn core_error_result(operation: Operation, error: forma_core::OperationError) -> OperationResult {
    OperationResult::failed(operation, forma_core::operation_error_diagnostic(error))
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
        "inspect" => serde_json::from_value::<InspectRequest>(params)
            .map(OperationRequest::Inspect)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "list" => serde_json::from_value::<ListRequest>(params)
            .map(OperationRequest::List)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "tasks.list" => serde_json::from_value::<TasksListRequest>(params)
            .map(OperationRequest::TasksList)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "board.show" => serde_json::from_value::<BoardShowRequest>(params)
            .map(OperationRequest::BoardShow)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "tasks.inspect" => serde_json::from_value::<TasksInspectRequest>(params)
            .map(OperationRequest::TasksInspect)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "create" => serde_json::from_value::<CreateRequest>(params)
            .map(OperationRequest::Create)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "init" => serde_json::from_value::<InitRequest>(params)
            .map(OperationRequest::Init)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "view.render" => serde_json::from_value::<ViewRenderRequest>(params)
            .map(OperationRequest::ViewRender)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "file.render" => serde_json::from_value::<FileRenderRequest>(params)
            .map(OperationRequest::FileRender)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "file.references" => serde_json::from_value::<FileReferencesRequest>(params)
            .map(OperationRequest::FileReferences)
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
        "files.list" => serde_json::from_value::<FilesListRequest>(params)
            .map(OperationRequest::FilesList)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "workspace.health" => serde_json::from_value::<WorkspaceHealthRequest>(params)
            .map(OperationRequest::WorkspaceHealth)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "skills.list" => serde_json::from_value::<SkillsListRequest>(params)
            .map(OperationRequest::SkillsList)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "skills.get" => serde_json::from_value::<SkillsGetRequest>(params)
            .map(OperationRequest::SkillsGet)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        "workspace.dashboard" => serde_json::from_value::<WorkspaceDashboardRequest>(params)
            .map(OperationRequest::WorkspaceDashboard)
            .map_err(|_| {
                JsonRpcFailure::without_id(
                    JsonRpcErrorCode::InvalidParams,
                    "Invalid params.",
                    "params.invalid",
                )
            }),
        _ => Err(JsonRpcFailure::without_id(
            JsonRpcErrorCode::MethodNotFound,
            "Method not found.",
            "method.notFound",
        )),
    }
}

impl From<forma_core::CheckResult> for OperationResult {
    fn from(result: forma_core::CheckResult) -> Self {
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data: BTreeMap::new(),
        }
    }
}

impl From<forma_core::SkillsListResult> for OperationResult {
    fn from(result: forma_core::SkillsListResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("skills".to_string(), json!(result.skills));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::SkillsGetResult> for OperationResult {
    fn from(result: forma_core::SkillsGetResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        if let Some(skill) = result.skill {
            data.insert("skill".to_string(), json!(skill));
        }
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::CreateResult> for OperationResult {
    fn from(result: forma_core::CreateResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("created".to_string(), json!(result.created));
        data.insert("inputs".to_string(), json!(result.inputs));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::InitResult> for OperationResult {
    fn from(result: forma_core::InitResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("writtenPaths".to_string(), json!(result.written_paths));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::InspectResult> for OperationResult {
    fn from(result: forma_core::InspectResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("entry".to_string(), json!(result.entry));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::ListResult> for OperationResult {
    fn from(result: forma_core::ListResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("space".to_string(), json!(result.space));
        data.insert("entries".to_string(), json!(result.entries));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::TasksListResult> for OperationResult {
    fn from(result: forma_core::TasksListResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("tasks".to_string(), json!(result.tasks));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::BoardShowResult> for OperationResult {
    fn from(result: forma_core::BoardShowResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("columns".to_string(), json!(result.columns));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::TasksInspectResult> for OperationResult {
    fn from(result: forma_core::TasksInspectResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("guidelines".to_string(), json!(result.guidelines));
        data.insert("task".to_string(), json!(result.task));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::ConfigInspectResult> for OperationResult {
    fn from(result: forma_core::ConfigInspectResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("config".to_string(), json!(result.config));
        data.insert("sources".to_string(), json!(result.sources));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::FilesListResult> for OperationResult {
    fn from(result: forma_core::FilesListResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("files".to_string(), json!(result.files));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::WorkspaceDashboardResult> for OperationResult {
    fn from(result: forma_core::WorkspaceDashboardResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("spaces".to_string(), json!(result.spaces));
        data.insert("entries".to_string(), json!(result.entries));
        data.insert("views".to_string(), json!(result.views));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::ViewRenderResult> for OperationResult {
    fn from(result: forma_core::ViewRenderResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        if let Some(view) = result.view {
            data.insert("view".to_string(), json!(view));
        }
        if let Some(render) = result.render {
            data.insert("render".to_string(), json!(render));
        }
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::FileRenderResult> for OperationResult {
    fn from(result: forma_core::FileRenderResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("file".to_string(), json!(result.file));
        data.insert("render".to_string(), json!(result.render));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::FileReferencesResult> for OperationResult {
    fn from(result: forma_core::FileReferencesResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("file".to_string(), json!(result.file));
        data.insert("outgoing".to_string(), json!(result.outgoing));
        data.insert("backlinks".to_string(), json!(result.backlinks));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

impl From<forma_core::operations::WorkspaceHealthResult> for OperationResult {
    fn from(result: forma_core::operations::WorkspaceHealthResult) -> Self {
        let mut data = BTreeMap::new();
        data.insert("workspace".to_string(), json!(result.workspace));
        data.insert("findings".to_string(), json!(result.findings));
        Self {
            schema_version: result.schema_version,
            operation: result.operation,
            status: result.status,
            summary: Some(result.summary),
            diagnostics: result.diagnostics,
            path: None,
            data,
        }
    }
}

fn default_render_format() -> String {
    "html".to_string()
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
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_json::json;

    use super::{Dispatcher, JsonRpcErrorCode};

    fn copy_starter_workspace(root: &Path) {
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/forma-starter-kit");
        copy_dir_recursive(&source, root);
        remove_guideline_references(root);
        clear_starter_content(root);
    }

    fn copy_dir_recursive(source: &Path, target: &Path) {
        fs::create_dir_all(target).unwrap();
        for entry in fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            let source_path = entry.path();
            let target_path = target.join(entry.file_name());
            if source_path.is_dir() {
                copy_dir_recursive(&source_path, &target_path);
            } else {
                fs::copy(&source_path, &target_path).unwrap();
            }
        }
    }

    fn clear_starter_content(root: &Path) {
        for directory in ["notes", "tasks", "members", "guidelines"] {
            let path = root.join(directory);
            if path.exists() {
                fs::remove_dir_all(&path).unwrap();
            }
            fs::create_dir_all(path).unwrap();
        }
    }

    fn remove_guideline_references(root: &Path) {
        let config_path = root.join(".forma.md");
        let config = fs::read_to_string(&config_path).unwrap();
        fs::write(
            &config_path,
            config.replace(
                "\nguidelines:\n  - \"guidelines/workspace-operations.md\"\n  - \"guidelines/task-selection.md\"\n",
                "\n",
            ),
        )
        .unwrap();

        let tasks_path = root.join(".forma/spaces/tasks.md");
        let tasks = fs::read_to_string(&tasks_path).unwrap();
        fs::write(
            &tasks_path,
            tasks.replace(
                "guidelines:\n  - \"guidelines/workspace-operations.md\"\n",
                "",
            ),
        )
        .unwrap();
    }

    fn write_config(root: &Path, yaml: &str) {
        fs::write(
            root.join(".forma.md"),
            format!("---\n{}---\n\n# Forma Workspace\n", yaml),
        )
        .unwrap();
    }

    #[test]
    fn json_rpc_rejects_parse_errors() {
        let response = Dispatcher::default().handle_json_rpc(b"{");

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
        let response = Dispatcher::default()
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
        let response = Dispatcher::default()
            .handle_json_rpc(br#"{"jsonrpc":"2.0","method":"check","params":{}}"#);

        assert_eq!(response["id"], serde_json::Value::Null);
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(response["error"]["data"]["code"], "request.idRequired");
    }

    #[test]
    fn json_rpc_rejects_missing_jsonrpc() {
        let response =
            Dispatcher::default().handle_json_rpc(br#"{"id":"1","method":"check","params":{}}"#);

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(response["error"]["data"]["code"], "request.jsonrpcRequired");
    }

    #[test]
    fn json_rpc_rejects_missing_method() {
        let response =
            Dispatcher::default().handle_json_rpc(br#"{"jsonrpc":"2.0","id":"1","params":{}}"#);

        assert_eq!(response["id"], "1");
        assert_eq!(
            response["error"]["code"],
            JsonRpcErrorCode::InvalidRequest as i64
        );
        assert_eq!(response["error"]["data"]["code"], "request.methodRequired");
    }

    #[test]
    fn json_rpc_reports_method_not_found() {
        let response = Dispatcher::default().handle_json_rpc(
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
        let response = Dispatcher::default()
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
        let response = Dispatcher::default().handle_json_rpc(
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
        let response = Dispatcher::default()
            .handle_json_rpc(br#"{"jsonrpc":"2.0","id":"1","method":"check","params":{}}"#);

        assert!(response.get("error").is_none());
        assert_eq!(response["jsonrpc"], "2.0");
        assert_eq!(response["id"], "1");
        assert_eq!(response["result"]["schemaVersion"], 1);
        assert_eq!(response["result"]["operation"], "check");
        assert_eq!(response["result"]["status"], "failed");
        assert_eq!(
            response["result"]["summary"],
            json!({"errors":1,"warnings":0,"infos":0})
        );
    }

    #[test]
    fn json_rpc_dispatches_init() {
        let root = fixture_root("init-rpc");
        fs::create_dir_all(&root).unwrap();

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"init","params":{"name":"Acme Content"}}"#,
        );

        assert_eq!(response["result"]["operation"], "init");
        assert_eq!(response["result"]["status"], "passed");
        assert_eq!(response["result"]["workspace"]["name"], "Acme Content");
        assert!(root.join(".forma.md").is_file());
        assert!(root.join(".agents/skills/forma-cli/SKILL.md").is_file());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_rejects_legacy_file_methods() {
        let root = fixture_root("legacy-file-methods");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);

        for method in ["entry.render", "references.list"] {
            let body = format!(
                r#"{{"jsonrpc":"2.0","id":"1","method":"{method}","params":{{"path":"notes/source.md"}}}}"#
            );
            let response = Dispatcher::new(&root).handle_json_rpc(body.as_bytes());

            assert_eq!(response["id"], "1");
            assert_eq!(
                response["error"]["code"],
                JsonRpcErrorCode::MethodNotFound as i64
            );
            assert_eq!(response["error"]["data"]["code"], "method.notFound");
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_file_render() {
        let root = fixture_root("file-render-rpc");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"file.render","params":{"path":"notes/source.md","format":"html"}}"#,
        );
        assert_eq!(response["result"]["operation"], "file.render");
        assert_eq!(response["result"]["file"]["path"], "notes/source.md");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_file_references() {
        let root = fixture_root("file-references-rpc");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"file.references","params":{"path":"notes/source.md"}}"#,
        );
        assert_eq!(response["result"]["operation"], "file.references");
        assert_eq!(response["result"]["file"]["path"], "notes/source.md");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_workspace_dashboard() {
        let root = fixture_root("workspace-dashboard-rpc");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: Dashboard source\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"workspace.dashboard","params":{}}"#,
        );

        assert_eq!(response["result"]["operation"], "workspace.dashboard");
        assert_eq!(
            response["result"]["workspace"]["name"],
            "Choral Forma Example"
        );
        assert!(response["result"]["spaces"].as_array().unwrap().len() >= 3);
        assert_eq!(response["result"]["entries"][0]["path"], "notes/source.md");
        assert!(response["result"]["views"].as_array().unwrap().len() >= 3);
        assert!(
            response["result"]["views"]
                .as_array()
                .unwrap()
                .iter()
                .any(|view| view["kind"] == "table")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_workspace_health() {
        let root = fixture_root("knowledge-health-rpc");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n\nMissing [[notes/missing]].\n",
        )
        .unwrap();

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"workspace.health","params":{}}"#,
        );

        assert_eq!(response["result"]["operation"], "workspace.health");
        assert_eq!(
            response["result"]["workspace"]["name"],
            "Choral Forma Example"
        );
        assert_eq!(response["result"]["status"], "warning");
        assert_eq!(
            response["result"]["findings"][0]["category"],
            "brokenReference"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_skills_list_and_get() {
        let root = fixture_root("skills-rpc");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Skills RPC\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/authoring.md"),
            "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Authoring\n\n## Agent Skill\n\nFollow the workflow.\n",
        )
        .unwrap();

        let list = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"skills.list","params":{}}"#,
        );
        assert_eq!(list["result"]["operation"], "skills.list");
        assert_eq!(list["result"]["skills"][0]["id"], "forma-cli-core");
        assert!(
            list["result"]["skills"]
                .as_array()
                .unwrap()
                .iter()
                .any(|skill| skill["id"] == "markdown-authoring")
        );

        let get = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"2","method":"skills.get","params":{"id":"markdown-authoring"}}"#,
        );
        assert_eq!(get["result"]["operation"], "skills.get");
        assert!(
            get["result"]["skill"]["content"]
                .as_str()
                .unwrap()
                .contains("Follow the workflow.")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_tasks_list_and_inspect() {
        let root = fixture_root("tasks-rpc");
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join("knowledge/tasks")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Tasks RPC\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n",
        );
        fs::write(
            root.join(".forma/spaces/tasks.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Tasks\ninclude:\n  - knowledge/tasks/**/*.md\ncreate:\n  directory: knowledge/tasks\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/task.md\n  inputs:\n    title:\n      required: true\n    slug:\n      default: \"{{ input.title }}\"\n      transform: slugify\nconventions:\n  titleField: title\n  summaryField: summary\n---\n\n# Tasks\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/task.md"),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/ship-cli.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Ship CLI\nsummary: Add CLI task inventory commands.\npriority: P0\nreadiness: ready\nowner: Alex Chen\n---\n\n# Ship CLI\n",
        )
        .unwrap();

        let list = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"tasks.list","params":{}}"#,
        );
        assert_eq!(list["result"]["operation"], "tasks.list");
        assert_eq!(
            list["result"]["tasks"][0]["path"],
            "knowledge/tasks/ship-cli.md"
        );

        let inspect = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"2","method":"tasks.inspect","params":{"pathOrId":"ship-cli"}}"#,
        );
        assert_eq!(inspect["result"]["operation"], "tasks.inspect");
        assert_eq!(inspect["result"]["task"]["title"], "Ship CLI");
        assert_eq!(inspect["result"]["task"]["priority"], "P0");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_dispatches_board_show() {
        let root = fixture_root("board-show-rpc");
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join("knowledge/tasks")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Board RPC\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\ninclude:\n  - .forma/spaces/*.md\n",
        );
        fs::write(
            root.join(".forma/spaces/tasks.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Tasks\ninclude:\n  - knowledge/tasks/**/*.md\ncreate:\n  directory: knowledge/tasks\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/task.md\n  inputs:\n    title:\n      required: true\n    slug:\n      default: \"{{ input.title }}\"\n      transform: slugify\nconventions:\n  titleField: title\n  summaryField: summary\n---\n\n# Tasks\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/task.md"),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/alpha.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Alpha\nsummary: Needs refinement\n---\n\n# Alpha\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/bravo.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Bravo\nsummary: Ready\nreadiness: ready\n---\n\n# Bravo\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/charlie.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Charlie\nsummary: Blocked\nreadiness: blocked\n---\n\n# Charlie\n",
        )
        .unwrap();

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"board.show","params":{}}"#,
        );
        assert_eq!(response["result"]["operation"], "board.show");
        assert_eq!(response["result"]["workspace"]["name"], "Board RPC");
        assert_eq!(response["result"]["columns"][0]["id"], "backlog");
        assert_eq!(
            response["result"]["columns"][0]["tasks"][0]["path"],
            "knowledge/tasks/alpha.md"
        );
        assert_eq!(response["result"]["columns"][1]["id"], "ready");
        assert_eq!(
            response["result"]["columns"][1]["tasks"][0]["path"],
            "knowledge/tasks/bravo.md"
        );
        assert_eq!(response["result"]["columns"][2]["id"], "doing");
        assert_eq!(response["result"]["columns"][3]["id"], "reviewing");
        assert_eq!(response["result"]["columns"][4]["id"], "blocked");
        assert_eq!(
            response["result"]["columns"][4]["tasks"][0]["path"],
            "knowledge/tasks/charlie.md"
        );
        assert_eq!(response["result"]["columns"][5]["id"], "done");
        assert_eq!(response["result"]["columns"][6]["id"], "cancelled");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn json_rpc_file_render_invalid_format_reports_neutral_input_diagnostic() {
        let root = fixture_root("file-render-invalid-format");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);

        let response = handle_json_rpc(
            &root,
            br#"{"jsonrpc":"2.0","id":"1","method":"file.render","params":{"path":"notes/missing.md","format":"pdf"}}"#,
        );

        assert_eq!(response["result"]["operation"], "file.render");
        assert_eq!(
            response["result"]["diagnostics"][0]["code"],
            "operation.inputInvalid"
        );
        assert_eq!(
            response["result"]["diagnostics"][0]["message"],
            "Operation input is invalid."
        );
        assert_ne!(
            response["result"]["diagnostics"][0]["code"],
            "create.inputInvalid"
        );

        fs::remove_dir_all(root).unwrap();
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
        assert_eq!(
            serde_json::to_value(super::Operation::FilesList).unwrap(),
            "files.list"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::WorkspaceDashboard).unwrap(),
            "workspace.dashboard"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::Inspect).unwrap(),
            "inspect"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::List).unwrap(),
            "list"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::TasksList).unwrap(),
            "tasks.list"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::BoardShow).unwrap(),
            "board.show"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::TasksInspect).unwrap(),
            "tasks.inspect"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::Create).unwrap(),
            "create"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::ViewRender).unwrap(),
            "view.render"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::FileRender).unwrap(),
            "file.render"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::FileReferences).unwrap(),
            "file.references"
        );
        assert_eq!(
            serde_json::to_value(super::Operation::WorkspaceHealth).unwrap(),
            "workspace.health"
        );
    }

    fn fixture_root(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-rpc-{name}-{unique}"))
    }

    fn handle_json_rpc(root: &std::path::Path, body: &[u8]) -> serde_json::Value {
        Dispatcher::new(root).handle_json_rpc(body)
    }
}
