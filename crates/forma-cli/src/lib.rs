use std::io::{self, IsTerminal, Write};
use std::net::SocketAddr;

use axum::Router;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::header::CONTENT_TYPE;
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use clap::{Parser, Subcommand};
use forma_rpc::{
    CheckRequest, CreateRequest, Dispatcher, IndexCheckRequest, IndexRebuildRequest, InitRequest,
    InspectRequest, ListRequest, Operation, OperationRequest,
};
use serde_yml::Value;

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
    Index {
        #[command(subcommand)]
        command: IndexCommand,
    },
    Serve {
        #[arg(long, default_value = "127.0.0.1:0")]
        bind: SocketAddr,
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
        Some(Command::Serve { bind }) => serve(bind).await,
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

pub async fn serve(bind: SocketAddr) -> Result<(), Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(bind).await?;
    axum::serve(listener, rpc_router()).await?;
    Ok(())
}

pub fn rpc_router() -> Router {
    Router::new()
        .route("/rpc", post(rpc_handler))
        .with_state(Dispatcher)
}

async fn rpc_handler(State(dispatcher): State<Dispatcher>, body: Bytes) -> Response {
    let mut response = (StatusCode::OK, dispatcher.handle_json_rpc_text(&body)).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    response
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
    use axum::body::{Body, to_bytes};
    use axum::http::{Method, Request, StatusCode};
    use tower::ServiceExt;

    use super::rpc_router;

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
}
