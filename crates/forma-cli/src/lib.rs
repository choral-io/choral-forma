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
use axum::response::{IntoResponse, Response};
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
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
}

#[derive(Debug, Parser)]
#[command(name = "forma", disable_version_flag = true)]
pub struct Cli {
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
    let dispatcher = Dispatcher;

    match cli.command {
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
                    init_confirmation_result(&name, &language, timezone.as_deref())?
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
            webapp_dir,
            cors_origins,
        }) => serve(bind, webapp_dir, cors_origins).await,
    }
}

fn print_result(result: &forma_rpc::OperationResult, json: bool, label: &str) {
    if json {
        println!("{}", result.to_json_string());
    } else {
        println!("{label} {}", result.status_label());
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

fn init_confirmation_result(
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
    writeln!(stderr, "  root: .")?;
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
    webapp_dir: Option<PathBuf>,
    cors_origins: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(bind).await?;
    axum::serve(listener, rpc_router_with_options(webapp_dir, cors_origins)?).await?;
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

    let state = AppState {
        dispatcher: Dispatcher,
        webapp_dir,
        cors_origins,
    };

    Ok(Router::new()
        .route("/rpc", post(rpc_handler).options(rpc_preflight_handler))
        .route("/", get(index_handler))
        .route("/{*path}", get(asset_handler))
        .with_state(state))
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
    webapp_asset_response("index.html", state.webapp_dir.as_deref())
}

async fn asset_handler(
    AxumPath(path): AxumPath<String>,
    State(state): State<AppState>,
) -> Response {
    if path == "rpc" {
        return StatusCode::METHOD_NOT_ALLOWED.into_response();
    }
    webapp_asset_response(&path, state.webapp_dir.as_deref())
}

fn webapp_asset_response(path: &str, webapp_dir: Option<&FsPath>) -> Response {
    let normalized = path.trim_start_matches('/');
    let asset_path = if normalized.is_empty() {
        "index.html"
    } else {
        normalized
    };

    if let Some(webapp_dir) = webapp_dir {
        return external_webapp_asset_response(webapp_dir, asset_path);
    }

    let file = if let Some(file) = WEBAPP_DIST.get_file(asset_path) {
        file
    } else if asset_path.starts_with("assets/") {
        return StatusCode::NOT_FOUND.into_response();
    } else if let Some(file) = WEBAPP_DIST.get_file("index.html") {
        file
    } else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let content_type = content_type_for(file.path().to_string_lossy().as_ref());
    let mut response = (StatusCode::OK, file.contents()).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    response.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    response
}

fn external_webapp_asset_response(webapp_dir: &FsPath, asset_path: &str) -> Response {
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
        _ if asset_path.starts_with("assets/") => return StatusCode::NOT_FOUND.into_response(),
        _ => match base.join("index.html").canonicalize() {
            Ok(index) if index.starts_with(&base) => index,
            _ => return StatusCode::NOT_FOUND.into_response(),
        },
    };
    let bytes = match fs::read(&resolved) {
        Ok(bytes) => bytes,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let content_type = content_type_for(resolved.to_string_lossy().as_ref());
    let mut response = (StatusCode::OK, bytes).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static(content_type));
    response.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    response
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
    use axum::http::{Method, Request, StatusCode};
    use tower::ServiceExt;

    use super::{rpc_router, rpc_router_with_options};

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
