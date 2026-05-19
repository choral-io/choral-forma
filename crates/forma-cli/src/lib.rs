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
    CheckRequest, Dispatcher, IndexCheckRequest, IndexRebuildRequest, OperationRequest,
};

#[derive(Debug, Parser)]
#[command(name = "forma", disable_version_flag = true)]
pub struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    Check {
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
        Some(Command::Check { json }) => {
            let result = dispatcher.dispatch(OperationRequest::Check(CheckRequest::default()))?;
            if json {
                println!("{}", result.to_json_string());
            } else {
                println!("check {}", result.status_label());
            }
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Index { command }) => match command {
            IndexCommand::Check { json } => {
                let result = dispatcher
                    .dispatch(OperationRequest::IndexCheck(IndexCheckRequest::default()))?;
                if json {
                    println!("{}", result.to_json_string());
                } else {
                    println!("index check {}", result.status_label());
                }
                exit_if_failed(&result);
                Ok(())
            }
            IndexCommand::Rebuild { json } => {
                let result = dispatcher.dispatch(OperationRequest::IndexRebuild(
                    IndexRebuildRequest::default(),
                ))?;
                if json {
                    println!("{}", result.to_json_string());
                } else {
                    println!("index rebuild {}", result.status_label());
                }
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Serve { bind }) => serve(bind).await,
    }
}

fn exit_if_failed(result: &forma_rpc::OperationResult) {
    if matches!(result.status, forma_core::OperationStatus::Failed) {
        std::process::exit(1);
    }
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
