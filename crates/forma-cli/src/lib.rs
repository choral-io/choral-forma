use std::fs;
use std::io::{self, IsTerminal, Write};
use std::net::SocketAddr;
use std::path::{Component, Path as FsPath, PathBuf};

use axum::Router;
use axum::body::Bytes;
use axum::extract::{Path as AxumPath, State};
use axum::http::header::{
    ACCESS_CONTROL_ALLOW_HEADERS, ACCESS_CONTROL_ALLOW_METHODS, ACCESS_CONTROL_ALLOW_ORIGIN,
    CONTENT_TYPE, HeaderName, ORIGIN, VARY,
};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Redirect, Response};
use axum::routing::{get, post};
use clap::{Parser, Subcommand};
use forma_rpc::{
    CheckRequest, ConfigInspectRequest, CreateRequest, Dispatcher, IndexCheckRequest,
    IndexRebuildRequest, InitRequest, InspectRequest, ListRequest, Operation, OperationRequest,
};
use include_dir::{Dir, include_dir};
use serde_yml::Value;

static WEBAPP_DIST: Dir<'_> = include_dir!("$OUT_DIR/webapp-dist");

#[derive(Debug, Clone)]
struct AppState {
    dispatcher: Dispatcher,
    workspace_root: PathBuf,
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
    root_path: String,
}

#[derive(Debug, Parser)]
#[command(name = "forma", disable_version_flag = true)]
pub struct Cli {
    #[arg(short = 'V', long)]
    version: bool,
    #[arg(short = 'w', long = "workspace", global = true, default_value = ".")]
    workspace: PathBuf,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    Init {
        #[arg(long)]
        name: String,
        #[arg(long, default_value = "en")]
        language: String,
        #[arg(long)]
        timezone: Option<String>,
        #[arg(short = 'y', long)]
        yes: bool,
        #[arg(long)]
        json: bool,
    },
    Check {
        #[arg(long)]
        json: bool,
    },
    Create {
        collection: String,
        #[arg(long = "input", value_parser = parse_input_pair)]
        inputs: Vec<(String, Value)>,
        #[arg(long)]
        json: bool,
    },
    Inspect {
        #[arg(long)]
        collection: Option<String>,
        locator: String,
        #[arg(long)]
        json: bool,
    },
    List {
        #[arg(long)]
        collection: String,
        #[arg(long)]
        json: bool,
    },
    Config {
        #[command(subcommand)]
        command: ConfigCommand,
    },
    Index {
        #[command(subcommand)]
        command: IndexCommand,
    },
    Serve {
        #[arg(long, default_value = "127.0.0.1:0")]
        bind: SocketAddr,
        #[arg(long, default_value = "/")]
        root_path: String,
        #[arg(long)]
        webapp_dir: Option<PathBuf>,
        #[arg(long = "cors-origin")]
        cors_origins: Vec<String>,
    },
}

#[derive(Debug, Subcommand)]
enum IndexCommand {
    Check {
        #[arg(long)]
        json: bool,
    },
    Rebuild {
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum ConfigCommand {
    Inspect {
        #[arg(long)]
        path: Option<String>,
        #[arg(long)]
        json: bool,
    },
}

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    run_cli(cli).await
}

async fn run_cli(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    let Cli {
        version,
        workspace,
        command,
    } = cli;
    let dispatcher = Dispatcher::new(&workspace);

    if version {
        println!("forma {}", forma_core::version());
        return Ok(());
    }

    match command {
        None => {
            println!("forma {}", forma_core::version());
            Ok(())
        }
        Some(Command::Init {
            name,
            language,
            timezone,
            yes,
            json,
        }) => {
            if !yes
                && let Some(result) =
                    init_confirmation_result(&workspace, &name, &language, timezone.as_deref())?
            {
                print_result(&result, json, "init");
                exit_if_failed(&result);
                return Ok(());
            }
            let result = dispatcher.dispatch(OperationRequest::Init(InitRequest {
                name,
                language,
                timezone,
            }))?;
            print_result(&result, json, "init");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Check { json }) => {
            let result = dispatcher.dispatch(OperationRequest::Check(CheckRequest::default()))?;
            print_result(&result, json, "check");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Create {
            collection,
            inputs,
            json,
        }) => {
            let result = dispatcher.dispatch(OperationRequest::Create(CreateRequest {
                collection,
                inputs: inputs.into_iter().collect(),
            }))?;
            print_result(&result, json, "create");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Inspect {
            collection,
            locator,
            json,
        }) => {
            let request = if let Some(collection) = collection {
                InspectRequest {
                    path: None,
                    collection: Some(collection),
                    entry: Some(locator),
                }
            } else {
                InspectRequest {
                    path: Some(locator),
                    collection: None,
                    entry: None,
                }
            };
            let result = dispatcher.dispatch(OperationRequest::Inspect(request))?;
            print_result(&result, json, "inspect");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::List { collection, json }) => {
            let result = dispatcher.dispatch(OperationRequest::List(ListRequest { collection }))?;
            print_result(&result, json, "list");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Config { command }) => match command {
            ConfigCommand::Inspect { path, json } => {
                let result =
                    dispatcher.dispatch(OperationRequest::ConfigInspect(ConfigInspectRequest {
                        path,
                    }))?;
                print_result(&result, json, "config inspect");
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Index { command }) => match command {
            IndexCommand::Check { json } => {
                let result = dispatcher
                    .dispatch(OperationRequest::IndexCheck(IndexCheckRequest::default()))?;
                print_result(&result, json, "index check");
                exit_if_failed(&result);
                Ok(())
            }
            IndexCommand::Rebuild { json } => {
                let result = dispatcher.dispatch(OperationRequest::IndexRebuild(
                    IndexRebuildRequest::default(),
                ))?;
                print_result(&result, json, "index rebuild");
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Serve {
            bind,
            root_path,
            webapp_dir,
            cors_origins,
        }) => {
            serve(
                bind,
                root_path,
                webapp_dir,
                cors_origins,
                dispatcher,
                workspace,
            )
            .await
        }
    }
}

fn print_result(result: &forma_rpc::OperationResult, json: bool, label: &str) {
    if json {
        println!("{}", result.to_json_string());
    } else {
        println!("{label} {}", result.status_label());
        for diagnostic in &result.diagnostics {
            print_diagnostic(diagnostic);
        }
        if result.status == forma_core::OperationStatus::Warning {
            for diagnostic in &result.diagnostics {
                if diagnostic.code == "index.stale" {
                    println!("run `forma index rebuild` to refresh the summary index");
                    break;
                }
            }
        }
    }
}

fn print_diagnostic(diagnostic: &forma_core::Diagnostic) {
    let severity = match diagnostic.severity {
        forma_core::DiagnosticSeverity::Error => "error",
        forma_core::DiagnosticSeverity::Warning => "warning",
        forma_core::DiagnosticSeverity::Info => "info",
    };
    if let Some(path) = &diagnostic.path {
        println!(
            "{severity} {}: {} ({path})",
            diagnostic.code, diagnostic.message
        );
    } else {
        println!("{severity} {}: {}", diagnostic.code, diagnostic.message);
    }
}

fn init_confirmation_result(
    root: &FsPath,
    name: &str,
    language: &str,
    timezone: Option<&str>,
) -> Result<Option<forma_rpc::OperationResult>, Box<dyn std::error::Error>> {
    let resolved_timezone = timezone
        .map(ToString::to_string)
        .unwrap_or_else(forma_core::detect_environment_timezone);

    if !io::stdin().is_terminal() || !io::stderr().is_terminal() {
        return Ok(Some(forma_rpc::OperationResult::failed(
            Operation::Init,
            forma_core::Diagnostic::error(
                "init.confirmationRequired",
                "Init requires confirmation in interactive shells; pass --yes in non-interactive environments.",
            ),
        )));
    }

    let mut stderr = io::stderr();
    writeln!(stderr, "Forma will initialize a workspace with:")?;
    writeln!(stderr, "  root: {}", root.display())?;
    writeln!(stderr, "  name: {name}")?;
    writeln!(stderr, "  language: {language}")?;
    writeln!(stderr, "  timezone: {resolved_timezone}")?;
    writeln!(
        stderr,
        "It will create .forma/ configuration, starter templates, starter views, content directories, and .forma/index.summary.json."
    )?;
    write!(stderr, "Continue? [y/N] ")?;
    stderr.flush()?;

    let mut answer = String::new();
    io::stdin().read_line(&mut answer)?;
    let confirmed = matches!(answer.trim(), "y" | "Y" | "yes" | "YES" | "Yes");
    if confirmed {
        Ok(None)
    } else {
        Ok(Some(forma_rpc::OperationResult::failed(
            Operation::Init,
            forma_core::Diagnostic::error("init.cancelled", "Init was cancelled by the user."),
        )))
    }
}

fn exit_if_failed(result: &forma_rpc::OperationResult) {
    if matches!(result.status, forma_core::OperationStatus::Failed) {
        std::process::exit(1);
    }
}

fn parse_input_pair(value: &str) -> Result<(String, Value), String> {
    let Some((key, raw_value)) = value.split_once('=') else {
        return Err("expected KEY=VALUE".to_string());
    };
    if key.trim().is_empty() {
        return Err("input key is empty".to_string());
    }
    Ok((key.to_string(), Value::String(raw_value.to_string())))
}

pub async fn serve(
    bind: SocketAddr,
    root_path: String,
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
    dispatcher: Dispatcher,
    workspace_root: PathBuf,
) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(bind).await?;
    let local_addr = listener.local_addr()?;
    println!("forma serve listening on http://{local_addr}");
    axum::serve(
        listener,
        rpc_router_with_dispatcher_and_workspace(
            webapp_dir,
            cors_origins,
            dispatcher,
            workspace_root,
            root_path,
        )?,
    )
    .await?;
    Ok(())
}

pub fn rpc_router() -> Router {
    rpc_router_with_options(None, Vec::new())
        .expect("embedded webapp assets should always be routable")
}

fn rpc_router_with_options(
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
) -> Result<Router, Box<dyn std::error::Error>> {
    rpc_router_with_options_and_root_path(webapp_dir, cors_origins, "/")
}

fn rpc_router_with_options_and_root_path(
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
    root_path: impl AsRef<str>,
) -> Result<Router, Box<dyn std::error::Error>> {
    rpc_router_with_dispatcher(
        webapp_dir,
        cors_origins,
        Dispatcher::default(),
        root_path.as_ref().to_string(),
    )
}

fn rpc_router_with_dispatcher(
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
    dispatcher: Dispatcher,
    root_path: String,
) -> Result<Router, Box<dyn std::error::Error>> {
    rpc_router_with_dispatcher_and_workspace(
        webapp_dir,
        cors_origins,
        dispatcher,
        PathBuf::from("."),
        root_path,
    )
}

fn rpc_router_with_dispatcher_and_workspace(
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
    dispatcher: Dispatcher,
    workspace_root: PathBuf,
    root_path: String,
) -> Result<Router, Box<dyn std::error::Error>> {
    if let Some(webapp_dir) = &webapp_dir {
        if !webapp_dir.is_dir() {
            return Err(format!(
                "webapp asset directory does not exist or is not a directory: {}",
                webapp_dir.display()
            )
            .into());
        }
    }
    let cors_origins = validate_cors_origins(cors_origins)?;
    let root_path = normalize_root_path(&root_path)?;

    let state = AppState {
        dispatcher,
        workspace_root,
        webapp_dir,
        cors_origins,
        root_path: root_path.clone(),
    };

    if root_path == "/" {
        Ok(Router::new()
            .route("/rpc", post(rpc_handler).options(rpc_preflight_handler))
            .route("/raw/{*path}", get(raw_workspace_file))
            .route("/", get(index_handler))
            .route("/{*path}", get(asset_handler))
            .with_state(state))
    } else {
        let rpc_route = format!("{root_path}/rpc");
        let raw_route = format!("{root_path}/raw/{{*path}}");
        let root_route = format!("{root_path}/");
        let asset_route = format!("{root_path}/{{*path}}");
        let redirect_target = app_root_location(&root_path);
        Ok(Router::new()
            .route(&rpc_route, post(rpc_handler).options(rpc_preflight_handler))
            .route(&raw_route, get(raw_workspace_file))
            .route(
                &root_path,
                get(move || async move { Redirect::temporary(&redirect_target) }),
            )
            .route(&root_route, get(index_handler))
            .route(&asset_route, get(asset_handler))
            .with_state(state))
    }
}

async fn raw_workspace_file(
    AxumPath(path): AxumPath<String>,
    State(state): State<AppState>,
) -> Response {
    let workspace_path = match forma_core::WorkspacePath::parse_cli(&path) {
        Ok(path) => path.as_str().to_string(),
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    if !is_raw_workspace_path_allowed(&workspace_path) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Some(media_type) = forma_core::media_type_for_workspace_path(&workspace_path) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let base = match state.workspace_root.canonicalize() {
        Ok(base) => base,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let file_path = state.workspace_root.join(&workspace_path);
    let resolved = match file_path.canonicalize() {
        Ok(resolved) if resolved.starts_with(&base) && resolved.is_file() => resolved,
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    let bytes = match tokio::fs::read(resolved).await {
        Ok(bytes) => bytes,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    let mut response = (StatusCode::OK, bytes).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(media_type));
    response.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    response
}

fn is_raw_workspace_path_allowed(path: &str) -> bool {
    // Mirrors files.list local-only exclusions until the rule is exposed by forma-core.
    let normalized = path.to_ascii_lowercase();
    normalized != ".forma/overrides/local.yml" && !normalized.starts_with(".forma/local/")
}

async fn rpc_handler(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let mut response =
        (StatusCode::OK, state.dispatcher.handle_json_rpc_text(&body)).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    apply_rpc_cors(&headers, &state, &mut response);
    response
}

async fn rpc_preflight_handler(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let mut response = StatusCode::NO_CONTENT.into_response();
    apply_rpc_cors(&headers, &state, &mut response);
    if response.headers().contains_key(ACCESS_CONTROL_ALLOW_ORIGIN) {
        response.headers_mut().insert(
            ACCESS_CONTROL_ALLOW_METHODS,
            HeaderValue::from_static("POST, OPTIONS"),
        );
        response.headers_mut().insert(
            ACCESS_CONTROL_ALLOW_HEADERS,
            HeaderValue::from_static("content-type"),
        );
    }
    response
}

fn validate_cors_origins(origins: Vec<String>) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    for origin in &origins {
        if origin.trim().is_empty() || origin == "*" {
            return Err("cors origin must be an explicit origin, not empty or wildcard".into());
        }
        HeaderValue::from_str(origin)
            .map_err(|_| format!("cors origin is not a valid header value: {origin}"))?;
    }
    Ok(origins)
}

fn apply_rpc_cors(request_headers: &HeaderMap, state: &AppState, response: &mut Response) {
    if state.cors_origins.is_empty() {
        return;
    }
    let Some(origin) = request_headers.get(ORIGIN) else {
        return;
    };
    let Ok(origin_text) = origin.to_str() else {
        return;
    };
    if state
        .cors_origins
        .iter()
        .any(|allowed| allowed == origin_text)
    {
        response
            .headers_mut()
            .insert(ACCESS_CONTROL_ALLOW_ORIGIN, origin.clone());
        response
            .headers_mut()
            .insert(VARY, HeaderValue::from_static("Origin"));
    }
}

async fn index_handler(State(state): State<AppState>) -> Response {
    webapp_asset_response(
        "index.html",
        state.webapp_dir.as_deref(),
        state.root_path.as_str(),
    )
}

async fn asset_handler(
    AxumPath(path): AxumPath<String>,
    State(state): State<AppState>,
) -> Response {
    if path == "rpc" {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    webapp_asset_response(&path, state.webapp_dir.as_deref(), state.root_path.as_str())
}

fn webapp_asset_response(path: &str, webapp_dir: Option<&FsPath>, root_path: &str) -> Response {
    let normalized = path.trim_start_matches('/');
    let asset_path = if normalized.is_empty() {
        "index.html"
    } else {
        normalized
    };

    if let Some(webapp_dir) = webapp_dir {
        return external_webapp_asset_response(webapp_dir, asset_path, root_path);
    }

    let Some(file) = WEBAPP_DIST.get_file(asset_path) else {
        if should_redirect_to_app_root(asset_path) {
            return Redirect::temporary(&app_root_location(root_path)).into_response();
        }
        return StatusCode::NOT_FOUND.into_response();
    };

    webapp_file_response(
        asset_path,
        file.path().to_string_lossy().as_ref(),
        file.contents(),
        root_path,
    )
}

fn external_webapp_asset_response(
    webapp_dir: &FsPath,
    asset_path: &str,
    root_path: &str,
) -> Response {
    let Some(asset_path) = safe_asset_path(asset_path) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let base = match webapp_dir.canonicalize() {
        Ok(base) => base,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let candidate = base.join(&asset_path);
    let resolved = match candidate.canonicalize() {
        Ok(resolved) if resolved.starts_with(&base) => resolved,
        _ if should_redirect_to_app_root(&asset_path) => {
            return Redirect::temporary(&app_root_location(root_path)).into_response();
        }
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    let bytes = match fs::read(&resolved) {
        Ok(bytes) => bytes,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    webapp_file_response(
        &asset_path,
        resolved.to_string_lossy().as_ref(),
        bytes.as_slice(),
        root_path,
    )
}

fn webapp_file_response(
    asset_path: &str,
    source_path: &str,
    contents: &[u8],
    root_path: &str,
) -> Response {
    let content_type = content_type_for(source_path);
    let body = if asset_path == "index.html" {
        let html = String::from_utf8_lossy(contents);
        inject_base_href(&html, root_path).into_bytes()
    } else {
        contents.to_vec()
    };
    let mut response = (StatusCode::OK, body).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    response.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    response
}

fn inject_base_href(html: &str, root_path: &str) -> String {
    let base = format!(r#"<base href="{}">"#, app_root_location(root_path));
    if let Some(head_index) = html.find("<head>") {
        let insert_at = head_index + "<head>".len();
        let mut output = String::with_capacity(html.len() + base.len() + 1);
        output.push_str(&html[..insert_at]);
        output.push('\n');
        output.push_str(&base);
        output.push_str(&html[insert_at..]);
        output
    } else {
        format!("{base}\n{html}")
    }
}

fn safe_asset_path(path: &str) -> Option<String> {
    let path = FsPath::new(path);
    if path.is_absolute() {
        return None;
    }
    let mut segments = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) => segments.push(segment.to_string_lossy().to_string()),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    if segments.is_empty() {
        Some("index.html".to_string())
    } else {
        Some(segments.join("/"))
    }
}

fn normalize_root_path(value: &str) -> Result<String, Box<dyn std::error::Error>> {
    let value = value.trim();
    if value.is_empty() {
        return Ok("/".to_string());
    }
    if !value.starts_with('/') {
        return Err("root path must start with `/`".into());
    }
    if value.contains('?') || value.contains('#') {
        return Err("root path must not include a query string or fragment".into());
    }
    let normalized = value.trim_end_matches('/');
    if normalized.is_empty() {
        return Ok("/".to_string());
    }
    if safe_asset_path(normalized.trim_start_matches('/')).is_none() {
        return Err("root path must be a safe absolute URL path".into());
    }
    Ok(normalized.to_string())
}

fn app_root_location(root_path: &str) -> String {
    if root_path == "/" {
        "/".to_string()
    } else {
        format!("{root_path}/")
    }
}

fn should_redirect_to_app_root(path: &str) -> bool {
    if path.starts_with("assets/") {
        return false;
    }
    let extension = FsPath::new(path)
        .extension()
        .and_then(|extension| extension.to_str());
    matches!(extension, None | Some("md"))
}

fn content_type_for(path: &str) -> &'static str {
    match path.rsplit('.').next() {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("json") => "application/json",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    }
}

trait StatusLabel {
    fn status_label(&self) -> &'static str;
}

impl StatusLabel for forma_rpc::OperationResult {
    fn status_label(&self) -> &'static str {
        match self.status {
            forma_core::OperationStatus::Passed => "passed",
            forma_core::OperationStatus::Warning => "warning",
            forma_core::OperationStatus::Failed => "failed",
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use axum::body::{Body, to_bytes};
    use axum::http::{Method, Request, StatusCode, header};
    use forma_rpc::Dispatcher;
    use tower::ServiceExt;

    use super::{
        rpc_router, rpc_router_with_dispatcher, rpc_router_with_dispatcher_and_workspace,
        rpc_router_with_options, rpc_router_with_options_and_root_path,
    };

    #[tokio::test]
    async fn rpc_router_exposes_json_rpc_handler() {
        let response = rpc_router()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/rpc")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"jsonrpc":"2.0","id":"1","method":"check","params":{}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        let body = String::from_utf8_lossy(&body);
        assert!(body.contains(r#""jsonrpc":"2.0""#));
        assert!(body.contains(r#""operation":"check""#));
    }

    #[tokio::test]
    async fn rpc_router_uses_configured_workspace_root() {
        let root = fixture_root("rpc-workspace-root");
        fs::create_dir_all(&root).unwrap();
        forma_core::init_workspace(&root, "RPC Workspace", "en", Some("UTC")).unwrap();

        let response =
            rpc_router_with_dispatcher(None, Vec::new(), Dispatcher::new(&root), "/".to_string())
                .unwrap()
                .oneshot(
                    Request::builder()
                        .method(Method::POST)
                        .uri("/rpc")
                        .header("content-type", "application/json")
                        .body(Body::from(
                            r#"{"jsonrpc":"2.0","id":"1","method":"config.inspect","params":{}}"#,
                        ))
                        .unwrap(),
                )
                .await
                .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        let body = String::from_utf8_lossy(&body);
        assert!(body.contains(r#""name":"RPC Workspace""#));

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_serves_embedded_webapp_assets() {
        let response = rpc_router()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        let body = String::from_utf8_lossy(&body);
        assert!(body.contains(r#"<title>Choral Forma</title>"#));
    }

    #[tokio::test]
    async fn rpc_router_does_not_fallback_missing_assets_to_index() {
        let response = rpc_router()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/assets/missing.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn rpc_router_redirects_workspace_like_paths_to_app_root() {
        let response = rpc_router()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/notes/users/workspace-note")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
        assert_eq!(response.headers().get("location").unwrap(), "/");
    }

    #[tokio::test]
    async fn rpc_router_mounts_under_configured_root_path() {
        let router = rpc_router_with_options_and_root_path(None, Vec::new(), "/forma").unwrap();

        let index_response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/forma/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(index_response.status(), StatusCode::OK);
        let index_body = to_bytes(index_response.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let index_body = String::from_utf8_lossy(&index_body);
        assert!(index_body.contains(r#"<base href="/forma/">"#));
        assert!(
            index_body.find(r#"<base href="/forma/">"#)
                < index_body
                    .find("<script")
                    .or_else(|| index_body.find("<link"))
        );

        let rpc_response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/forma/rpc")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(rpc_response.status(), StatusCode::NO_CONTENT);

        let root_response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/forma")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(root_response.status(), StatusCode::TEMPORARY_REDIRECT);
        assert_eq!(root_response.headers().get("location").unwrap(), "/forma/");

        let bad_path_response = router
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/forma/notes/users/workspace-note")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(bad_path_response.status(), StatusCode::TEMPORARY_REDIRECT);
        assert_eq!(
            bad_path_response.headers().get("location").unwrap(),
            "/forma/"
        );
    }

    #[tokio::test]
    async fn rpc_router_serves_raw_workspace_resources_under_root_path() {
        let root = fixture_root("raw-resource-route");
        fs::create_dir_all(root.join("assets")).unwrap();
        forma_core::init_workspace(&root, "Raw Route", "en", Some("UTC")).unwrap();
        fs::write(root.join("assets/logo.png"), b"\x89PNG\r\n\x1a\n").unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/assets/logo.png")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE).unwrap(),
            "image/png"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_rejects_raw_workspace_path_traversal() {
        let root = fixture_root("raw-route-traversal");
        fs::create_dir_all(&root).unwrap();
        forma_core::init_workspace(&root, "Raw Route Traversal", "en", Some("UTC")).unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/../.forma/workspace.yml")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_rejects_raw_local_only_workspace_files() {
        let root = fixture_root("raw-route-local-only");
        fs::create_dir_all(&root).unwrap();
        forma_core::init_workspace(&root, "Raw Route Local Only", "en", Some("UTC")).unwrap();
        fs::create_dir_all(root.join(".forma/overrides")).unwrap();
        fs::write(root.join(".forma/overrides/local.yml"), "collections: {}\n").unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/.forma/overrides/local.yml")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_rejects_raw_local_only_workspace_files_case_variants() {
        let root = fixture_root("raw-route-local-only-case");
        fs::create_dir_all(&root).unwrap();
        forma_core::init_workspace(&root, "Raw Route Local Only Case", "en", Some("UTC")).unwrap();
        fs::create_dir_all(root.join(".forma/overrides")).unwrap();
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(root.join(".forma/overrides/local.yml"), "collections: {}\n").unwrap();
        fs::write(root.join(".forma/local/secret.png"), b"\x89PNG\r\n\x1a\n").unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        for uri in [
            "/forma/raw/.FORMA/overrides/local.yml",
            "/forma/raw/.FORMA/local/secret.png",
        ] {
            let response = app
                .clone()
                .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::NOT_FOUND);
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn rpc_router_rejects_raw_workspace_symlink_escape() {
        let root = fixture_root("raw-route-symlink-escape");
        let outside = fixture_root("raw-route-symlink-outside");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        forma_core::init_workspace(&root, "Raw Route Symlink", "en", Some("UTC")).unwrap();
        fs::write(outside.join("logo.png"), b"\x89PNG\r\n\x1a\n").unwrap();
        std::os::unix::fs::symlink(outside.join("logo.png"), root.join("assets/logo.png")).unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/assets/logo.png")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_can_serve_external_webapp_assets() {
        let root = fixture_root("external-webapp");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(
            root.join("index.html"),
            r#"<!doctype html><title>External Forma</title>"#,
        )
        .unwrap();
        fs::write(root.join("assets/app.js"), "console.log('external');").unwrap();

        let index_response = rpc_router_with_options(Some(root.clone()), Vec::new())
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(index_response.status(), StatusCode::OK);
        let index_body = to_bytes(index_response.into_body(), 1024 * 1024)
            .await
            .unwrap();
        assert!(String::from_utf8_lossy(&index_body).contains("External Forma"));

        let asset_response = rpc_router_with_options(Some(root.clone()), Vec::new())
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/assets/app.js")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(asset_response.status(), StatusCode::OK);
        assert_eq!(
            asset_response.headers().get("content-type").unwrap(),
            "text/javascript; charset=utf-8"
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_rejects_external_asset_path_traversal() {
        let root = fixture_root("external-webapp-traversal");
        fs::create_dir_all(&root).unwrap();
        fs::write(
            root.join("index.html"),
            r#"<!doctype html><title>Safe</title>"#,
        )
        .unwrap();

        let response = rpc_router_with_options(Some(root.clone()), Vec::new())
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/../Cargo.toml")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_allows_configured_rpc_cors_origin() {
        let response = rpc_router_with_options(None, vec!["http://localhost:5173".to_string()])
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/rpc")
                    .header("origin", "http://localhost:5173")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"jsonrpc":"2.0","id":"1","method":"check","params":{}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .unwrap(),
            "http://localhost:5173"
        );
    }

    #[tokio::test]
    async fn rpc_router_rejects_unconfigured_rpc_cors_origin() {
        let response = rpc_router_with_options(None, vec!["http://localhost:5173".to_string()])
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/rpc")
                    .header("origin", "http://localhost:9999")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        r#"{"jsonrpc":"2.0","id":"1","method":"check","params":{}}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert!(
            response
                .headers()
                .get("access-control-allow-origin")
                .is_none()
        );
    }

    #[tokio::test]
    async fn rpc_router_handles_rpc_cors_preflight() {
        let response = rpc_router_with_options(None, vec!["http://localhost:5173".to_string()])
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/rpc")
                    .header("origin", "http://localhost:5173")
                    .header("access-control-request-method", "POST")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-origin")
                .unwrap(),
            "http://localhost:5173"
        );
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-methods")
                .unwrap(),
            "POST, OPTIONS"
        );
    }

    #[test]
    fn rpc_router_rejects_wildcard_cors_origin() {
        assert!(rpc_router_with_options(None, vec!["*".to_string()]).is_err());
    }

    fn fixture_root(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-cli-{name}-{unique}"))
    }
}
