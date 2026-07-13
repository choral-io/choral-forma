use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use forma_core::{
    DocumentAnalysis, DocumentReference, OperationStatus, ReferenceFragmentLocation,
    WorkspaceSession,
};
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, Response};
use lsp_types::notification::{
    DidChangeTextDocument, DidCloseTextDocument, DidOpenTextDocument, Exit, Notification as _,
};
use lsp_types::request::{DocumentLinkRequest, GotoDefinition, Request as _};
use lsp_types::{
    DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams,
    DocumentLink, DocumentLinkOptions, DocumentLinkParams, GotoDefinitionParams,
    GotoDefinitionResponse, LocationLink, OneOf, Position, PositionEncodingKind, Range,
    ServerCapabilities, TextDocumentSyncCapability, TextDocumentSyncKind, TextDocumentSyncOptions,
    Uri,
};
use serde::Serialize;
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
pub enum LspError {
    #[error("failed to initialize the LSP transport: {0}")]
    Protocol(#[from] lsp_server::ProtocolError),
    #[error("failed to encode or decode an LSP message: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Forma workspace operation failed: {0}")]
    Operation(#[from] forma_core::OperationError),
    #[error("file operation failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("LSP channel closed unexpectedly")]
    ChannelClosed,
    #[error("invalid file URI `{0}`")]
    InvalidFileUri(String),
    #[error("document is outside the Forma workspace: {0}")]
    OutsideWorkspace(PathBuf),
}

#[derive(Debug, Clone)]
struct OpenDocument {
    path: String,
    source: String,
}

struct Server {
    root: PathBuf,
    session: WorkspaceSession,
    open_documents: BTreeMap<Uri, OpenDocument>,
}

pub fn run(root: impl AsRef<Path>) -> Result<(), LspError> {
    let root = fs::canonicalize(root)?;
    let (connection, io_threads) = Connection::stdio();
    run_connection(connection, root)?;
    io_threads.join()?;
    Ok(())
}

fn run_connection(connection: Connection, root: PathBuf) -> Result<(), LspError> {
    let (initialize_id, _) = connection.initialize_start()?;
    connection.initialize_finish(
        initialize_id,
        serde_json::json!({
            "capabilities": server_capabilities(),
            "serverInfo": {
                "name": "forma",
                "version": forma_core::version(),
            },
        }),
    )?;

    let mut server = Server::new(root)?;
    for message in &connection.receiver {
        match message {
            Message::Request(request) => {
                if connection.handle_shutdown(&request)? {
                    break;
                }
                let response = server.handle_request(request);
                connection
                    .sender
                    .send(Message::Response(response))
                    .map_err(|_| LspError::ChannelClosed)?;
            }
            Message::Notification(notification) => {
                if notification.method == Exit::METHOD {
                    break;
                }
                server.handle_notification(notification)?;
            }
            Message::Response(_) => {}
        }
    }
    Ok(())
}

fn server_capabilities() -> ServerCapabilities {
    ServerCapabilities {
        position_encoding: Some(PositionEncodingKind::UTF16),
        text_document_sync: Some(TextDocumentSyncCapability::Options(
            TextDocumentSyncOptions {
                open_close: Some(true),
                change: Some(TextDocumentSyncKind::FULL),
                ..Default::default()
            },
        )),
        definition_provider: Some(OneOf::Left(true)),
        document_link_provider: Some(DocumentLinkOptions {
            resolve_provider: Some(false),
            work_done_progress_options: Default::default(),
        }),
        ..Default::default()
    }
}

impl Server {
    fn new(root: PathBuf) -> Result<Self, LspError> {
        Ok(Self {
            session: WorkspaceSession::load(&root)?,
            root,
            open_documents: BTreeMap::new(),
        })
    }

    fn handle_request(&mut self, request: Request) -> Response {
        let id = request.id.clone();
        let result = match request.method.as_str() {
            GotoDefinition::METHOD => {
                serde_json::from_value::<GotoDefinitionParams>(request.params)
                    .map_err(LspError::from)
                    .and_then(|params| self.definition(params))
                    .and_then(json_value)
            }
            DocumentLinkRequest::METHOD => {
                serde_json::from_value::<DocumentLinkParams>(request.params)
                    .map_err(LspError::from)
                    .and_then(|params| self.document_links(params))
                    .and_then(json_value)
            }
            method => {
                return Response::new_err(
                    id,
                    ErrorCode::MethodNotFound as i32,
                    format!("unsupported request `{method}`"),
                );
            }
        };
        match result {
            Ok(result) => Response::new_ok(id, result),
            Err(error) => Response::new_err(id, ErrorCode::InternalError as i32, error.to_string()),
        }
    }

    fn handle_notification(&mut self, notification: Notification) -> Result<(), LspError> {
        match notification.method.as_str() {
            DidOpenTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidOpenTextDocumentParams>(notification.params)?;
                self.open_document(params)
            }
            DidChangeTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidChangeTextDocumentParams>(notification.params)?;
                self.change_document(params)
            }
            DidCloseTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidCloseTextDocumentParams>(notification.params)?;
                self.close_document(params)
            }
            _ => Ok(()),
        }
    }

    fn open_document(&mut self, params: DidOpenTextDocumentParams) -> Result<(), LspError> {
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        self.session
            .set_document(&path, params.text_document.text.clone())?;
        self.open_documents.insert(
            uri,
            OpenDocument {
                path,
                source: params.text_document.text,
            },
        );
        Ok(())
    }

    fn change_document(&mut self, params: DidChangeTextDocumentParams) -> Result<(), LspError> {
        let Some(change) = params.content_changes.into_iter().last() else {
            return Ok(());
        };
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        self.session.set_document(&path, change.text.clone())?;
        self.open_documents.insert(
            uri,
            OpenDocument {
                path,
                source: change.text,
            },
        );
        Ok(())
    }

    fn close_document(&mut self, params: DidCloseTextDocumentParams) -> Result<(), LspError> {
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        self.session.close_document(&path)?;
        self.open_documents.remove(&uri);
        Ok(())
    }

    fn definition(
        &self,
        params: GotoDefinitionParams,
    ) -> Result<Option<GotoDefinitionResponse>, LspError> {
        let uri = &params.text_document_position_params.text_document.uri;
        let (path, source, analysis) = self.document_context(uri)?;
        let offset = offset_at_position(&source, params.text_document_position_params.position);
        let Some(reference) = offset.and_then(|offset| reference_at(&analysis, offset)) else {
            return Ok(None);
        };
        let result = self.session.resolve_document_reference(&path, reference)?;
        let Some(target) = result.target else {
            return Ok(None);
        };
        let target_uri = self.path_uri(&target.path)?;
        let target_source = self.source_for_path(&target.path)?;
        let target_position = target
            .fragment_location
            .as_ref()
            .map(|location| fragment_position(&target_source, location))
            .unwrap_or_default();
        let target_range = Range::new(target_position, target_position);
        Ok(Some(GotoDefinitionResponse::Link(vec![LocationLink {
            origin_selection_range: Some(span_range(&source, reference)),
            target_uri,
            target_range,
            target_selection_range: target_range,
        }])))
    }

    fn document_links(
        &self,
        params: DocumentLinkParams,
    ) -> Result<Option<Vec<DocumentLink>>, LspError> {
        let uri = &params.text_document.uri;
        let (path, source, analysis) = self.document_context(uri)?;
        let links = analysis
            .references
            .iter()
            .filter_map(|reference| {
                let target = if is_external_target(&reference.raw_target) {
                    Uri::from_str(&reference.raw_target).ok()
                } else {
                    self.session
                        .resolve_document_reference(&path, reference)
                        .ok()
                        .filter(|result| result.status == OperationStatus::Passed)
                        .and_then(|result| result.target)
                        .and_then(|target| self.path_uri(&target.path).ok())
                }?;
                Some(DocumentLink {
                    range: span_range(&source, reference),
                    target: Some(target),
                    tooltip: None,
                    data: None,
                })
            })
            .collect::<Vec<_>>();
        Ok(Some(links))
    }

    fn document_context(&self, uri: &Uri) -> Result<(String, String, DocumentAnalysis), LspError> {
        if let Some(document) = self.open_documents.get(uri) {
            return Ok((
                document.path.clone(),
                document.source.clone(),
                self.session.document_analysis(&document.path)?,
            ));
        }
        let path = self.workspace_path(uri)?;
        let source = fs::read_to_string(self.root.join(&path))?;
        let analysis = self.session.document_analysis(&path)?;
        Ok((path, source, analysis))
    }

    fn source_for_path(&self, path: &str) -> Result<String, LspError> {
        self.open_documents
            .values()
            .find(|document| document.path == path)
            .map(|document| document.source.clone())
            .map(Ok)
            .unwrap_or_else(|| fs::read_to_string(self.root.join(path)).map_err(LspError::from))
    }

    fn workspace_path(&self, uri: &Uri) -> Result<String, LspError> {
        let url = Url::parse(uri.as_str())
            .map_err(|_| LspError::InvalidFileUri(uri.as_str().to_string()))?;
        let path = url
            .to_file_path()
            .map_err(|_| LspError::InvalidFileUri(uri.as_str().to_string()))?;
        let relative = path
            .strip_prefix(&self.root)
            .map_err(|_| LspError::OutsideWorkspace(path.clone()))?;
        Ok(relative
            .components()
            .map(|component| component.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/"))
    }

    fn path_uri(&self, path: &str) -> Result<Uri, LspError> {
        let path = self.root.join(path);
        let url = Url::from_file_path(&path)
            .map_err(|_| LspError::InvalidFileUri(path.display().to_string()))?;
        Uri::from_str(url.as_str())
            .map_err(|_| LspError::InvalidFileUri(path.display().to_string()))
    }
}

fn json_value(value: impl Serialize) -> Result<serde_json::Value, LspError> {
    Ok(serde_json::to_value(value)?)
}

fn reference_at(analysis: &DocumentAnalysis, offset: usize) -> Option<&DocumentReference> {
    analysis
        .references
        .iter()
        .find(|reference| reference.span.start_byte <= offset && offset < reference.span.end_byte)
}

fn span_range(source: &str, reference: &DocumentReference) -> Range {
    Range::new(
        position_at_offset(source, reference.span.start_byte),
        position_at_offset(source, reference.span.end_byte),
    )
}

fn offset_at_position(source: &str, position: Position) -> Option<usize> {
    let mut line_start = 0;
    for _ in 0..position.line {
        let next = source[line_start..].find('\n')?;
        line_start += next + 1;
    }
    let line_end = source[line_start..]
        .find('\n')
        .map(|offset| line_start + offset)
        .unwrap_or(source.len());
    let mut utf16_column = 0;
    for (relative, character) in source[line_start..line_end].char_indices() {
        if utf16_column == position.character {
            return Some(line_start + relative);
        }
        utf16_column += character.len_utf16() as u32;
        if utf16_column > position.character {
            return None;
        }
    }
    (utf16_column == position.character).then_some(line_end)
}

fn position_at_offset(source: &str, offset: usize) -> Position {
    let offset = offset.min(source.len());
    let before = &source[..offset];
    let line = before.bytes().filter(|byte| *byte == b'\n').count() as u32;
    let line_start = before.rfind('\n').map_or(0, |index| index + 1);
    let character = source[line_start..offset].encode_utf16().count() as u32;
    Position::new(line, character)
}

fn fragment_position(source: &str, location: &ReferenceFragmentLocation) -> Position {
    let line = location.line.saturating_sub(1) as u32;
    let scalar_column = location.column.saturating_sub(1);
    let line_source = source.lines().nth(line as usize).unwrap_or_default();
    let byte_column = line_source
        .char_indices()
        .nth(scalar_column)
        .map(|(offset, _)| offset)
        .unwrap_or(line_source.len());
    Position::new(
        line,
        line_source[..byte_column].encode_utf16().count() as u32,
    )
}

fn is_external_target(target: &str) -> bool {
    target.starts_with("http://") || target.starts_with("https://") || target.starts_with("mailto:")
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::thread;
    use std::time::Duration;

    use lsp_server::{Connection, Message, Notification, Request, RequestId};
    use lsp_types::{DocumentLink, GotoDefinitionResponse, Position, Uri};
    use serde_json::json;

    use super::{offset_at_position, position_at_offset, run_connection};

    #[test]
    fn converts_utf16_positions_without_splitting_surrogate_pairs() {
        let source = "a😀中 link";

        assert_eq!(position_at_offset(source, "a😀".len()), Position::new(0, 3));
        assert_eq!(
            offset_at_position(source, Position::new(0, 3)),
            Some("a😀".len())
        );
        assert_eq!(offset_at_position(source, Position::new(0, 2)), None);
    }

    #[test]
    fn serves_initialize_full_text_overlays_definition_and_document_links() {
        let root = fixture_root().canonicalize().unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-unsaved.md"));
        let root_uri = file_uri(root.clone());
        let (server_connection, client_connection) = Connection::memory();
        let server = thread::spawn(move || run_connection(server_connection, root));

        send_request(
            &client_connection,
            1,
            "initialize",
            json!({
                "processId": null,
                "capabilities": {},
                "rootUri": root_uri,
            }),
        );
        let initialize = receive_response(&client_connection);
        assert_eq!(initialize.id, RequestId::from(1));
        let capabilities = initialize.result.unwrap()["capabilities"].clone();
        assert_eq!(capabilities["positionEncoding"], "utf-16");
        assert_eq!(capabilities["textDocumentSync"]["change"], 1);
        assert_eq!(capabilities["definitionProvider"], true);
        assert_eq!(
            capabilities["documentLinkProvider"]["resolveProvider"],
            false
        );

        send_notification(&client_connection, "initialized", json!({}));
        let opened = "---\ntitle: LSP test\nowners:\n  - members/sam-rivera\n---\nSee [[members/sam-rivera|Sam]].\n";
        send_notification(
            &client_connection,
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": source_uri,
                    "languageId": "markdown",
                    "version": 1,
                    "text": opened,
                }
            }),
        );
        send_request(
            &client_connection,
            2,
            "textDocument/documentLink",
            json!({ "textDocument": { "uri": source_uri } }),
        );
        let links: Option<Vec<DocumentLink>> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        let links = links.unwrap();
        assert_eq!(links.len(), 2);
        assert!(links.iter().all(|link| {
            link.target
                .as_ref()
                .is_some_and(|target| target.as_str().ends_with("/members/sam-rivera.md"))
        }));

        let changed = "---\ntitle: LSP test\nowners: []\n---\nSee 😀 [[members/mira-chen|Mira]].\n";
        send_notification(
            &client_connection,
            "textDocument/didChange",
            json!({
                "textDocument": { "uri": source_uri, "version": 2 },
                "contentChanges": [{ "text": changed }],
            }),
        );
        send_request(
            &client_connection,
            3,
            "textDocument/definition",
            json!({
                "textDocument": { "uri": source_uri },
                "position": { "line": 4, "character": 11 },
            }),
        );
        let definition: Option<GotoDefinitionResponse> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        let GotoDefinitionResponse::Link(locations) = definition.unwrap() else {
            panic!("expected a location link response");
        };
        assert_eq!(locations.len(), 1);
        assert!(
            locations[0]
                .target_uri
                .as_str()
                .ends_with("/members/mira-chen.md")
        );
        assert_eq!(
            locations[0].origin_selection_range.unwrap().start.character,
            9
        );

        send_notification(
            &client_connection,
            "textDocument/didClose",
            json!({ "textDocument": { "uri": source_uri } }),
        );
        send_request(&client_connection, 4, "shutdown", serde_json::Value::Null);
        assert_eq!(receive_response(&client_connection).id, RequestId::from(4));
        send_notification(&client_connection, "exit", serde_json::Value::Null);
        server.join().unwrap().unwrap();
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/getting-started-workspace")
    }

    fn file_uri(path: PathBuf) -> Uri {
        let absolute = path.canonicalize().unwrap_or(path);
        url::Url::from_file_path(absolute)
            .unwrap()
            .as_str()
            .parse()
            .unwrap()
    }

    fn send_request(connection: &Connection, id: i32, method: &str, params: serde_json::Value) {
        connection
            .sender
            .send(Message::Request(Request {
                id: RequestId::from(id),
                method: method.to_string(),
                params,
            }))
            .unwrap();
    }

    fn send_notification(connection: &Connection, method: &str, params: serde_json::Value) {
        connection
            .sender
            .send(Message::Notification(Notification {
                method: method.to_string(),
                params,
            }))
            .unwrap();
    }

    fn receive_response(connection: &Connection) -> lsp_server::Response {
        let message = connection
            .receiver
            .recv_timeout(Duration::from_secs(5))
            .unwrap();
        let Message::Response(response) = message else {
            panic!("expected response, received {message:?}");
        };
        if let Some(error) = &response.error {
            panic!("LSP response failed: {error:?}");
        }
        response
    }
}
