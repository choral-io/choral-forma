use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::{Duration, Instant};

use forma_core::{
    DocumentAnalysis, DocumentReference, DocumentReferenceSyntax, ManagedDocumentKind,
    ReferenceFragmentLocation, SourceSpan, WorkspaceSession,
};
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, Response};
use lsp_types::notification::{
    DidChangeTextDocument, DidChangeWatchedFiles, DidCloseTextDocument, DidOpenTextDocument,
    DidSaveTextDocument, Exit, Notification as _,
};
use lsp_types::request::{
    DocumentLinkRequest, GotoDefinition, RegisterCapability, Request as _,
    SemanticTokensFullRequest, UnregisterCapability,
};
use lsp_types::{
    DidChangeTextDocumentParams, DidChangeWatchedFilesParams,
    DidChangeWatchedFilesRegistrationOptions, DidCloseTextDocumentParams,
    DidOpenTextDocumentParams, DidSaveTextDocumentParams, DocumentLink, DocumentLinkOptions,
    DocumentLinkParams, FileChangeType, FileSystemWatcher, GlobPattern, GotoDefinitionParams,
    GotoDefinitionResponse, InitializeParams, LocationLink, OneOf, Position, PositionEncodingKind,
    Range, Registration, RegistrationParams, RelativePattern, SaveOptions, SemanticToken,
    SemanticTokenType, SemanticTokens, SemanticTokensFullOptions, SemanticTokensLegend,
    SemanticTokensOptions, SemanticTokensParams, SemanticTokensResult, ServerCapabilities,
    TextDocumentSyncCapability, TextDocumentSyncKind, TextDocumentSyncOptions,
    TextDocumentSyncSaveOptions, Unregistration, UnregistrationParams, Uri,
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
    source: Option<String>,
    kind: ManagedDocumentKind,
}

struct Server {
    root: PathBuf,
    session: WorkspaceSession,
    open_documents: BTreeMap<Uri, OpenDocument>,
    recently_refreshed_saves: BTreeMap<String, Instant>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WatchRegistration {
    id: String,
    patterns: Vec<String>,
}

pub fn run(root: impl AsRef<Path>) -> Result<(), LspError> {
    let root = fs::canonicalize(root)?;
    let (connection, io_threads) = Connection::stdio();
    run_connection(connection, root)?;
    io_threads.join()?;
    Ok(())
}

fn run_connection(connection: Connection, root: PathBuf) -> Result<(), LspError> {
    let (initialize_id, initialize_params) = connection.initialize_start()?;
    let initialize_params = serde_json::from_value::<InitializeParams>(initialize_params)?;
    let supports_dynamic_watchers = initialize_params
        .capabilities
        .workspace
        .as_ref()
        .and_then(|workspace| workspace.did_change_watched_files.as_ref())
        .and_then(|capabilities| capabilities.dynamic_registration)
        .unwrap_or(false);
    let supports_relative_watchers = initialize_params
        .capabilities
        .workspace
        .as_ref()
        .and_then(|workspace| workspace.did_change_watched_files.as_ref())
        .and_then(|capabilities| capabilities.relative_pattern_support)
        .unwrap_or(false);
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
    let mut registered_watchers = None;
    let mut next_request_id = 10_000;
    if supports_dynamic_watchers {
        sync_watcher_registration(
            &connection,
            &server,
            &mut registered_watchers,
            &mut next_request_id,
            supports_relative_watchers,
        )?;
    }
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
                if supports_dynamic_watchers {
                    sync_watcher_registration(
                        &connection,
                        &server,
                        &mut registered_watchers,
                        &mut next_request_id,
                        supports_relative_watchers,
                    )?;
                }
            }
            Message::Response(_) => {}
        }
    }
    Ok(())
}

fn sync_watcher_registration(
    connection: &Connection,
    server: &Server,
    current: &mut Option<WatchRegistration>,
    next_request_id: &mut i32,
    supports_relative_patterns: bool,
) -> Result<(), LspError> {
    let patterns = server.session.snapshot().watch_patterns();
    if current
        .as_ref()
        .is_some_and(|registration| registration.patterns == patterns)
    {
        return Ok(());
    }

    if let Some(previous) = current.take() {
        send_client_request(
            connection,
            next_request_id,
            UnregisterCapability::METHOD,
            UnregistrationParams {
                unregisterations: vec![Unregistration {
                    id: previous.id,
                    method: DidChangeWatchedFiles::METHOD.to_string(),
                }],
            },
        )?;
    }

    let registration_id = format!("forma-watched-files-{}", *next_request_id);
    let base_uri = supports_relative_patterns
        .then(|| server.path_uri(""))
        .transpose()?;
    let options = DidChangeWatchedFilesRegistrationOptions {
        watchers: patterns
            .iter()
            .cloned()
            .map(|pattern| FileSystemWatcher {
                glob_pattern: if let Some(base_uri) = &base_uri {
                    GlobPattern::Relative(RelativePattern {
                        base_uri: OneOf::Right(base_uri.clone()),
                        pattern,
                    })
                } else {
                    GlobPattern::String(pattern)
                },
                kind: None,
            })
            .collect(),
    };
    send_client_request(
        connection,
        next_request_id,
        RegisterCapability::METHOD,
        RegistrationParams {
            registrations: vec![Registration {
                id: registration_id.clone(),
                method: DidChangeWatchedFiles::METHOD.to_string(),
                register_options: Some(serde_json::to_value(options)?),
            }],
        },
    )?;
    *current = Some(WatchRegistration {
        id: registration_id,
        patterns,
    });
    Ok(())
}

fn send_client_request(
    connection: &Connection,
    next_request_id: &mut i32,
    method: &str,
    params: impl Serialize,
) -> Result<(), LspError> {
    let id = *next_request_id;
    *next_request_id += 1;
    connection
        .sender
        .send(Message::Request(Request {
            id: id.into(),
            method: method.to_string(),
            params: serde_json::to_value(params)?,
        }))
        .map_err(|_| LspError::ChannelClosed)
}

fn server_capabilities() -> ServerCapabilities {
    ServerCapabilities {
        position_encoding: Some(PositionEncodingKind::UTF16),
        text_document_sync: Some(TextDocumentSyncCapability::Options(
            TextDocumentSyncOptions {
                open_close: Some(true),
                change: Some(TextDocumentSyncKind::FULL),
                save: Some(TextDocumentSyncSaveOptions::SaveOptions(SaveOptions {
                    include_text: Some(true),
                })),
                ..Default::default()
            },
        )),
        definition_provider: Some(OneOf::Left(true)),
        document_link_provider: Some(DocumentLinkOptions {
            resolve_provider: Some(false),
            work_done_progress_options: Default::default(),
        }),
        semantic_tokens_provider: Some(
            SemanticTokensOptions {
                work_done_progress_options: Default::default(),
                legend: SemanticTokensLegend {
                    token_types: vec![
                        SemanticTokenType::new("formaWikilinkDelimiter"),
                        SemanticTokenType::new("formaLinkTarget"),
                        SemanticTokenType::new("formaLinkFragment"),
                        SemanticTokenType::new("formaLinkLabel"),
                        SemanticTokenType::new("formaEmbedMarker"),
                    ],
                    token_modifiers: Vec::new(),
                },
                range: Some(false),
                full: Some(SemanticTokensFullOptions::Bool(true)),
            }
            .into(),
        ),
        ..Default::default()
    }
}

impl Server {
    fn new(root: PathBuf) -> Result<Self, LspError> {
        Ok(Self {
            session: WorkspaceSession::load(&root)?,
            root,
            open_documents: BTreeMap::new(),
            recently_refreshed_saves: BTreeMap::new(),
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
            SemanticTokensFullRequest::METHOD => {
                serde_json::from_value::<SemanticTokensParams>(request.params)
                    .map_err(LspError::from)
                    .and_then(|params| self.semantic_tokens(params))
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
            DidSaveTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidSaveTextDocumentParams>(notification.params)?;
                self.save_document(params)
            }
            DidChangeWatchedFiles::METHOD => {
                let params =
                    serde_json::from_value::<DidChangeWatchedFilesParams>(notification.params)?;
                self.change_watched_files(params)
            }
            _ => Ok(()),
        }
    }

    fn open_document(&mut self, params: DidOpenTextDocumentParams) -> Result<(), LspError> {
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        let kind = self.session.snapshot().document_kind(&path)?;
        if kind.is_language_document() {
            self.session
                .set_document(&path, params.text_document.text.clone())?;
        }
        self.open_documents.insert(
            uri,
            OpenDocument {
                path,
                source: kind
                    .is_language_document()
                    .then_some(params.text_document.text),
                kind,
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
        let kind = self.session.snapshot().document_kind(&path)?;
        if kind.is_language_document() {
            self.session.set_document(&path, change.text.clone())?;
        } else if self.session.has_document(&path)? {
            self.session.close_document(&path)?;
        }
        self.open_documents.insert(
            uri,
            OpenDocument {
                path,
                source: kind.is_language_document().then_some(change.text),
                kind,
            },
        );
        Ok(())
    }

    fn close_document(&mut self, params: DidCloseTextDocumentParams) -> Result<(), LspError> {
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        if self.session.has_document(&path)? {
            self.session.close_document(&path)?;
        }
        self.open_documents.remove(&uri);
        Ok(())
    }

    fn save_document(&mut self, params: DidSaveTextDocumentParams) -> Result<(), LspError> {
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        let kind = self.session.snapshot().document_kind(&path)?;
        if let Some(source) = params.text {
            if kind.is_language_document() {
                self.session.set_document(&path, source.clone())?;
            }
            self.open_documents.insert(
                uri,
                OpenDocument {
                    path: path.clone(),
                    source: kind.is_language_document().then_some(source),
                    kind,
                },
            );
        }
        let affects_configuration = self.session.snapshot().affects_configuration(&path)?;
        if kind.is_language_document() || affects_configuration {
            if self.refresh_snapshot("a save", affects_configuration) {
                self.recently_refreshed_saves.insert(path, Instant::now());
            }
        }
        Ok(())
    }

    fn change_watched_files(
        &mut self,
        params: DidChangeWatchedFilesParams,
    ) -> Result<(), LspError> {
        self.recently_refreshed_saves
            .retain(|_, saved_at| saved_at.elapsed() < Duration::from_secs(2));
        let mut relevant = false;
        let mut reanalyze_documents = false;
        for change in &params.changes {
            let Some(path) = self.workspace_path(&change.uri).ok() else {
                continue;
            };
            if change.typ == FileChangeType::CHANGED
                && self.recently_refreshed_saves.remove(&path).is_some()
            {
                continue;
            }
            let snapshot = self.session.snapshot();
            let kind = snapshot.document_kind(&path)?;
            let affects_configuration = snapshot.affects_configuration(&path)?;
            relevant |= kind.is_language_document() || affects_configuration;
            reanalyze_documents |= affects_configuration;
        }
        if relevant {
            self.refresh_snapshot("a watched-file change", reanalyze_documents);
        }
        Ok(())
    }

    fn refresh_snapshot(&mut self, reason: &str, reanalyze_documents: bool) -> bool {
        let result = if reanalyze_documents {
            self.session.rebuild_snapshot()
        } else {
            self.session.rebuild_snapshot_preserving_document_analysis()
        };
        if let Err(error) = result {
            eprintln!("Forma LSP kept the previous workspace snapshot after {reason}: {error}");
            return false;
        }
        if let Err(error) = self.reclassify_open_documents() {
            eprintln!("Forma LSP could not reclassify open documents after {reason}: {error}");
        }
        true
    }

    fn reclassify_open_documents(&mut self) -> Result<(), LspError> {
        let documents = self
            .open_documents
            .iter()
            .map(|(uri, document)| (uri.clone(), document.path.clone()))
            .collect::<Vec<_>>();
        for (uri, path) in documents {
            let kind = self.session.snapshot().document_kind(&path)?;
            if let Some(document) = self.open_documents.get_mut(&uri) {
                document.kind = kind;
                if !kind.is_language_document() {
                    document.source = None;
                }
            }
            if kind.is_language_document() {
                if !self.session.has_document(&path)? {
                    let source = fs::read_to_string(self.root.join(&path))?;
                    self.session.set_document(&path, source.clone())?;
                    if let Some(document) = self.open_documents.get_mut(&uri) {
                        document.source = Some(source);
                    }
                }
            } else if self.session.has_document(&path)? {
                self.session.close_document(&path)?;
            }
        }
        Ok(())
    }

    fn definition(
        &self,
        params: GotoDefinitionParams,
    ) -> Result<Option<GotoDefinitionResponse>, LspError> {
        let uri = &params.text_document_position_params.text_document.uri;
        let Some((path, source, analysis)) = self.document_context(uri)? else {
            return Ok(None);
        };
        let offset = offset_at_position(&source, params.text_document_position_params.position);
        let Some((reference, origin_span)) =
            offset.and_then(|offset| definition_reference_at(&analysis, offset))
        else {
            return Ok(None);
        };
        if is_external_target(&reference.raw_target)
            || self.local_resource_uri(&path, reference).is_some()
        {
            return Ok(None);
        }
        if let Some(target) = self
            .session
            .resolve_managed_path_reference(&path, reference)?
        {
            let target_source = self.source_for_path(&target.path)?;
            let target_range = target
                .fragment_location
                .as_ref()
                .map(|location| fragment_range(&target_source, location))
                .unwrap_or_default();
            return Ok(Some(GotoDefinitionResponse::Link(vec![
                self.location_link(&source, origin_span, &target.path, target_range)?,
            ])));
        }
        let result = self.session.resolve_document_reference(&path, reference)?;
        let links = if let Some(target) = result.target {
            if reference.fragment.is_some() && target.fragment_location.is_none() {
                return Ok(None);
            }
            let target_source = self.source_for_path(&target.path)?;
            let target_range = target
                .fragment_location
                .as_ref()
                .map(|location| fragment_range(&target_source, location))
                .unwrap_or_default();
            vec![self.location_link(&source, origin_span, &target.path, target_range)?]
        } else if reference.fragment.is_some() {
            Vec::new()
        } else {
            result
                .candidates
                .iter()
                .map(|candidate| {
                    self.location_link(&source, origin_span, &candidate.path, Range::default())
                })
                .collect::<Result<Vec<_>, _>>()?
        };
        Ok((!links.is_empty()).then(|| GotoDefinitionResponse::Link(links)))
    }

    fn document_links(
        &self,
        params: DocumentLinkParams,
    ) -> Result<Option<Vec<DocumentLink>>, LspError> {
        let uri = &params.text_document.uri;
        let Some((path, source, analysis)) = self.document_context(uri)? else {
            return Ok(Some(Vec::new()));
        };
        let links = analysis
            .references
            .iter()
            .filter(|reference| {
                matches!(
                    reference.syntax,
                    DocumentReferenceSyntax::Wikilink | DocumentReferenceSyntax::ObsidianEmbed
                )
            })
            .flat_map(|reference| {
                let target = if is_external_target(&reference.raw_target) {
                    Uri::from_str(&reference.raw_target).ok()
                } else {
                    self.local_resource_uri(&path, reference)
                };
                let Some(target) = target else {
                    return Vec::new();
                };
                document_link_spans(reference)
                    .into_iter()
                    .map(|span| DocumentLink {
                        range: source_span_range(&source, span),
                        target: Some(target.clone()),
                        tooltip: Some("Open Forma link".to_string()),
                        data: None,
                    })
                    .collect::<Vec<_>>()
            })
            .collect::<Vec<_>>();
        Ok(Some(links))
    }

    fn semantic_tokens(
        &self,
        params: SemanticTokensParams,
    ) -> Result<Option<SemanticTokensResult>, LspError> {
        let Some((_, source, analysis)) = self.document_context(&params.text_document.uri)? else {
            return Ok(Some(
                SemanticTokens {
                    result_id: None,
                    data: Vec::new(),
                }
                .into(),
            ));
        };
        let mut positions = analysis
            .references
            .iter()
            .filter(|reference| {
                matches!(
                    reference.syntax,
                    DocumentReferenceSyntax::Wikilink | DocumentReferenceSyntax::ObsidianEmbed
                )
            })
            .flat_map(|reference| semantic_token_positions(&source, reference))
            .collect::<Vec<_>>();
        positions.sort_unstable_by_key(|(position, _, _)| (position.line, position.character));

        let mut previous = Position::default();
        let data = positions
            .into_iter()
            .map(|(position, length, token_type)| {
                let delta_line = position.line - previous.line;
                let delta_start = if delta_line == 0 {
                    position.character - previous.character
                } else {
                    position.character
                };
                previous = position;
                SemanticToken {
                    delta_line,
                    delta_start,
                    length,
                    token_type,
                    token_modifiers_bitset: 0,
                }
            })
            .collect();

        Ok(Some(
            SemanticTokens {
                result_id: None,
                data,
            }
            .into(),
        ))
    }

    fn document_context(
        &self,
        uri: &Uri,
    ) -> Result<Option<(String, String, DocumentAnalysis)>, LspError> {
        if let Some(document) = self.open_documents.get(uri) {
            if !document.kind.is_language_document() {
                return Ok(None);
            }
            let source = if let Some(source) = &document.source {
                source.clone()
            } else {
                fs::read_to_string(self.root.join(&document.path))?
            };
            return Ok(Some((
                document.path.clone(),
                source,
                self.session.document_analysis(&document.path)?,
            )));
        }
        let path = self.workspace_path(uri)?;
        if !self
            .session
            .snapshot()
            .document_kind(&path)?
            .is_language_document()
        {
            return Ok(None);
        }
        let source = fs::read_to_string(self.root.join(&path))?;
        let analysis = self.session.document_analysis(&path)?;
        Ok(Some((path, source, analysis)))
    }

    fn location_link(
        &self,
        source: &str,
        origin_span: SourceSpan,
        target_path: &str,
        target_range: Range,
    ) -> Result<LocationLink, LspError> {
        Ok(self.location_link_to_uri(
            source,
            origin_span,
            self.path_uri(target_path)?,
            target_range,
        ))
    }

    fn location_link_to_uri(
        &self,
        source: &str,
        origin_span: SourceSpan,
        target_uri: Uri,
        target_range: Range,
    ) -> LocationLink {
        LocationLink {
            origin_selection_range: Some(source_span_range(source, origin_span)),
            target_uri,
            target_range,
            target_selection_range: target_range,
        }
    }

    fn local_resource_uri(&self, source_path: &str, reference: &DocumentReference) -> Option<Uri> {
        let raw_path = reference
            .raw_target
            .split_once('#')
            .map(|(path, _)| path)
            .unwrap_or(&reference.raw_target);
        let extension = Path::new(raw_path).extension()?.to_str()?;
        if extension.eq_ignore_ascii_case("md") {
            return None;
        }
        let source_parent = Path::new(source_path)
            .parent()
            .unwrap_or_else(|| Path::new(""));
        let target = self
            .root
            .join(source_parent)
            .join(raw_path)
            .canonicalize()
            .ok()?;
        if !target.starts_with(&self.root) || !target.is_file() {
            return None;
        }
        let url = Url::from_file_path(target).ok()?;
        Uri::from_str(url.as_str()).ok()
    }

    fn source_for_path(&self, path: &str) -> Result<String, LspError> {
        self.open_documents
            .values()
            .find_map(|document| {
                (document.path == path)
                    .then(|| document.source.clone())
                    .flatten()
            })
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

fn definition_reference_at(
    analysis: &DocumentAnalysis,
    offset: usize,
) -> Option<(&DocumentReference, SourceSpan)> {
    analysis.references.iter().find_map(|reference| {
        let spans = match reference.syntax {
            DocumentReferenceSyntax::MarkdownLink | DocumentReferenceSyntax::MarkdownImage => {
                return None;
            }
            DocumentReferenceSyntax::Frontmatter => {
                [reference.target_span, reference.fragment_span, None]
            }
            DocumentReferenceSyntax::Wikilink | DocumentReferenceSyntax::ObsidianEmbed => [
                reference.target_span,
                reference.fragment_span,
                reference.label_span,
            ],
        };
        spans
            .into_iter()
            .flatten()
            .find(|span| span.start_byte <= offset && offset < span.end_byte)
            .map(|span| (reference, span))
    })
}

fn source_span_range(source: &str, span: SourceSpan) -> Range {
    Range::new(
        position_at_offset(source, span.start_byte),
        position_at_offset(source, span.end_byte),
    )
}

fn document_link_spans(reference: &DocumentReference) -> Vec<SourceSpan> {
    let mut spans = Vec::new();
    if let Some(span) = covering_source_span(reference.target_span, reference.fragment_span) {
        spans.push(span);
    } else if let Some(span) = reference.target_span.or(reference.fragment_span) {
        spans.push(span);
    }
    if let Some(span) = reference.label_span {
        spans.push(span);
    }
    spans
}

fn covering_source_span(
    first: Option<SourceSpan>,
    second: Option<SourceSpan>,
) -> Option<SourceSpan> {
    let first = first?;
    let second = second?;
    Some(SourceSpan {
        start_byte: first.start_byte.min(second.start_byte),
        end_byte: first.end_byte.max(second.end_byte),
        start_line: first.start_line.min(second.start_line),
        start_column: first.start_column,
        end_line: first.end_line.max(second.end_line),
        end_column: second.end_column,
    })
}

fn semantic_token_positions(
    source: &str,
    reference: &DocumentReference,
) -> Vec<(Position, u32, u32)> {
    const DELIMITER: u32 = 0;
    const TARGET: u32 = 1;
    const FRAGMENT: u32 = 2;
    const LABEL: u32 = 3;
    const EMBED_MARKER: u32 = 4;

    let syntax_start = reference.syntax_span.start_byte;
    let syntax_end = reference.syntax_span.end_byte;
    let marker_length = usize::from(reference.syntax == DocumentReferenceSyntax::ObsidianEmbed);
    let mut positions = Vec::new();
    if marker_length == 1 {
        push_semantic_token_range(
            source,
            syntax_start,
            syntax_start + 1,
            EMBED_MARKER,
            &mut positions,
        );
    }
    push_semantic_token_range(
        source,
        syntax_start + marker_length,
        syntax_start + marker_length + 2,
        DELIMITER,
        &mut positions,
    );
    if let Some(span) = reference.target_span {
        push_semantic_token_range(
            source,
            span.start_byte,
            span.end_byte,
            TARGET,
            &mut positions,
        );
    }
    if let Some(span) = reference.fragment_span {
        push_semantic_token_range(
            source,
            span.start_byte,
            span.end_byte,
            FRAGMENT,
            &mut positions,
        );
    }
    if let Some(label_span) = reference.label_span {
        let search_start = reference
            .fragment_span
            .or(reference.target_span)
            .map_or(syntax_start + marker_length + 2, |span| span.end_byte);
        if search_start <= label_span.start_byte
            && let Some(separator) = source[search_start..label_span.start_byte].rfind('|')
        {
            let separator = search_start + separator;
            push_semantic_token_range(source, separator, separator + 1, DELIMITER, &mut positions);
        }
        push_semantic_token_range(
            source,
            label_span.start_byte,
            label_span.end_byte,
            LABEL,
            &mut positions,
        );
    }
    if syntax_end >= 2 {
        push_semantic_token_range(
            source,
            syntax_end - 2,
            syntax_end,
            DELIMITER,
            &mut positions,
        );
    }
    positions
}

fn push_semantic_token_range(
    source: &str,
    start: usize,
    end: usize,
    token_type: u32,
    positions: &mut Vec<(Position, u32, u32)>,
) {
    let start = start.min(source.len());
    let end = end.min(source.len());
    if start >= end {
        return;
    }

    let mut segment_start = start;
    for (relative, character) in source[start..end].char_indices() {
        if character != '\n' {
            continue;
        }
        let segment_end = start + relative;
        push_semantic_token_position(source, segment_start, segment_end, token_type, positions);
        segment_start = segment_end + character.len_utf8();
    }
    push_semantic_token_position(source, segment_start, end, token_type, positions);
}

fn push_semantic_token_position(
    source: &str,
    start: usize,
    mut end: usize,
    token_type: u32,
    positions: &mut Vec<(Position, u32, u32)>,
) {
    if source[start..end].ends_with('\r') {
        end -= 1;
    }
    if start < end {
        positions.push((
            position_at_offset(source, start),
            source[start..end].encode_utf16().count() as u32,
            token_type,
        ));
    }
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

fn fragment_range(source: &str, location: &ReferenceFragmentLocation) -> Range {
    Range::new(
        fragment_position(source, location.line, location.column),
        fragment_position(source, location.end_line, location.end_column),
    )
}

fn fragment_position(source: &str, one_based_line: usize, one_based_column: usize) -> Position {
    let line = one_based_line.saturating_sub(1) as u32;
    let scalar_column = one_based_column.saturating_sub(1);
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
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::thread;
    use std::time::Duration;

    use lsp_server::{Connection, Message, Notification, Request, RequestId};
    use lsp_types::{
        DocumentLink, GotoDefinitionResponse, LocationLink, Position, SemanticTokensResult, Uri,
    };
    use serde_json::json;

    use super::{
        ManagedDocumentKind, Server, offset_at_position, position_at_offset, run_connection,
    };

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
    fn ignores_unmanaged_markdown_lifecycle_and_language_requests() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("scratch.md"));
        let source = "See [[members/sam-rivera]].\n";
        let initial_builds = server.session.snapshot_build_count();
        let initial_analyses = server.session.document_analysis_count();

        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();

        assert_eq!(server.session.snapshot_build_count(), initial_builds);
        assert_eq!(server.session.document_analysis_count(), initial_analyses);
        assert!(
            server
                .open_documents
                .get(&source_uri)
                .is_some_and(|document| document.source.is_none())
        );
        assert!(
            server
                .definition(
                    serde_json::from_value(json!({
                        "textDocument": { "uri": source_uri },
                        "position": { "line": 0, "character": 8 },
                    }))
                    .unwrap(),
                )
                .unwrap()
                .is_none()
        );
        assert_eq!(
            server
                .document_links(
                    serde_json::from_value(json!({ "textDocument": { "uri": source_uri } }),)
                        .unwrap(),
                )
                .unwrap(),
            Some(Vec::new())
        );
        let tokens = server
            .semantic_tokens(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap();
        let SemanticTokensResult::Tokens(tokens) = tokens else {
            panic!("expected empty full semantic tokens");
        };
        assert!(tokens.data.is_empty());

        server
            .save_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri },
                    "text": source,
                }))
                .unwrap(),
            )
            .unwrap();
        assert_eq!(server.session.snapshot_build_count(), initial_builds);
        assert_eq!(server.session.document_analysis_count(), initial_analyses);
    }

    #[test]
    fn avoids_duplicate_refresh_for_save_and_matching_watcher_change() {
        let root = copied_fixture("watcher-deduplication")
            .canonicalize()
            .unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let managed_path = root.join("tasks/validate-editor-link-navigation.md");
        let managed_uri = file_uri(managed_path.clone());
        let source = fs::read_to_string(&managed_path).unwrap();
        let initial_builds = server.session.snapshot_build_count();

        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": managed_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();
        server
            .save_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": managed_uri },
                    "text": fs::read_to_string(&managed_path).unwrap(),
                }))
                .unwrap(),
            )
            .unwrap();
        assert_eq!(server.session.snapshot_build_count(), initial_builds + 1);

        server
            .change_watched_files(
                serde_json::from_value(json!({
                    "changes": [{ "uri": managed_uri, "type": 2 }],
                }))
                .unwrap(),
            )
            .unwrap();
        assert_eq!(server.session.snapshot_build_count(), initial_builds + 1);

        let unmanaged = root.join("scratch.md");
        fs::write(&unmanaged, "# Scratch\n").unwrap();
        server
            .change_watched_files(
                serde_json::from_value(json!({
                    "changes": [{ "uri": file_uri(unmanaged), "type": 1 }],
                }))
                .unwrap(),
            )
            .unwrap();
        assert_eq!(server.session.snapshot_build_count(), initial_builds + 1);

        let created = root.join("tasks/new-managed-page.md");
        fs::write(&created, "# New\n").unwrap();
        server
            .change_watched_files(
                serde_json::from_value(json!({
                    "changes": [{ "uri": file_uri(created), "type": 1 }],
                }))
                .unwrap(),
            )
            .unwrap();
        assert_eq!(server.session.snapshot_build_count(), initial_builds + 2);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn control_save_reclassifies_open_documents_from_saved_configuration() {
        let root = copied_fixture("managed-reclassification");
        fs::create_dir_all(root.join("topics")).unwrap();
        let page_path = root.join("topics/guide.md");
        let page_source = "See [[members/sam-rivera]].\n";
        fs::write(&page_path, page_source).unwrap();
        let config_path = root.join(".forma.md");
        let original_config = fs::read_to_string(&config_path).unwrap();
        let page_uri = file_uri(page_path);
        let config_uri = file_uri(config_path.clone());
        let mut server = Server::new(root.canonicalize().unwrap()).unwrap();
        let initial_analyses = server.session.document_analysis_count();

        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": page_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": "unsaved text is intentionally discarded",
                    }
                }))
                .unwrap(),
            )
            .unwrap();
        assert!(
            server
                .open_documents
                .get(&page_uri)
                .is_some_and(|document| document.source.is_none())
        );

        fs::create_dir_all(root.join(".forma/categories")).unwrap();
        fs::write(
            root.join(".forma/categories/index.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: topics\ntitle: Topics\nmode: primary\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/categories/guides.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: topics\ntitle: Guides\ninclude:\n  - topics/**/*.md\n---\n",
        )
        .unwrap();
        let configured = original_config.replace(
            "  - \".forma/views/*.md\"\n",
            "  - \".forma/views/*.md\"\n  - \".forma/categories/*.md\"\n",
        );
        fs::write(&config_path, &configured).unwrap();
        server
            .save_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": config_uri },
                    "text": configured,
                }))
                .unwrap(),
            )
            .unwrap();

        assert!(
            server
                .open_documents
                .get(&page_uri)
                .is_some_and(|document| {
                    document.kind == ManagedDocumentKind::Content
                        && document.source.as_deref() == Some(page_source)
                })
        );
        assert_eq!(
            server.session.document_analysis_count(),
            initial_analyses + 1
        );
        assert!(
            server
                .definition(
                    serde_json::from_value(json!({
                        "textDocument": { "uri": page_uri },
                        "position": { "line": 0, "character": 8 },
                    }))
                    .unwrap(),
                )
                .unwrap()
                .is_some()
        );

        fs::write(&config_path, &original_config).unwrap();
        server
            .save_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": config_uri },
                    "text": original_config,
                }))
                .unwrap(),
            )
            .unwrap();
        assert!(
            server
                .open_documents
                .get(&page_uri)
                .is_some_and(|document| {
                    document.kind == ManagedDocumentKind::Unmanaged && document.source.is_none()
                })
        );
        assert!(!server.session.has_document("topics/guide.md").unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn navigates_wikilink_target_fragment_and_alias_without_owning_markdown() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-navigation-ownership.md"));
        let source = "[Native](../members/sam-rivera.md#Sam-Rivera)\n[[members/sam-rivera#Sam Rivera|Sam]]\n[[members/sam-rivera#Missing|Missing]]\n";
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();

        assert!(definition_links(&server, source_uri.clone(), 0, 3).is_empty());
        assert!(definition_links(&server, source_uri.clone(), 0, 20).is_empty());
        assert!(definition_links(&server, source_uri.clone(), 1, 1).is_empty());
        assert!(definition_links(&server, source_uri.clone(), 1, 31).is_empty());

        let target = definition_links(&server, source_uri.clone(), 1, 5);
        let fragment = definition_links(&server, source_uri.clone(), 1, 23);
        let alias = definition_links(&server, source_uri.clone(), 1, 33);
        assert_eq!(target.len(), 1);
        assert_eq!(target[0].target_uri, fragment[0].target_uri);
        assert_eq!(target[0].target_uri, alias[0].target_uri);
        assert_eq!(target[0].target_range, fragment[0].target_range);
        assert_eq!(target[0].target_range, alias[0].target_range);
        assert!(target[0].target_range.start < target[0].target_range.end);
        assert_eq!(target[0].origin_selection_range.unwrap().start.character, 2);
        assert_eq!(alias[0].origin_selection_range.unwrap().start.character, 32);
        assert!(definition_links(&server, source_uri, 2, 32).is_empty());
    }

    #[test]
    fn resolves_explicit_wikilink_paths_for_generic_taxonomy_documents() {
        let root = copied_fixture("generic-taxonomy-navigation");
        let config_path = root.join(".forma.md");
        let config = fs::read_to_string(&config_path).unwrap();
        fs::write(
            &config_path,
            config.replace(
                "  - \".forma/views/*.md\"\n",
                "  - \".forma/views/*.md\"\n  - \".forma/categories/*.md\"\n",
            ),
        )
        .unwrap();
        fs::create_dir_all(root.join(".forma/categories")).unwrap();
        fs::write(
            root.join(".forma/categories/index.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: topics\ntitle: Topics\nmode: multiple\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/categories/guides.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: topics\ntitle: Guides\ninclude:\n  - topics/**/*.md\n---\n",
        )
        .unwrap();
        fs::create_dir_all(root.join("topics")).unwrap();
        fs::write(
            root.join("topics/target.md"),
            "# Target\n\n## Target heading\n",
        )
        .unwrap();
        let source_path = root.join("topics/source.md");
        fs::write(&source_path, "").unwrap();
        let root = root.canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(source_path);
        let source = "[[topics/target#Target heading|Target]] [[target]]\n";
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();

        let path = definition_links(&server, source_uri.clone(), 0, 4);
        let alias = definition_links(&server, source_uri.clone(), 0, 34);
        assert_eq!(path.len(), 1);
        assert_eq!(path[0].target_uri, alias[0].target_uri);
        assert!(path[0].target_range.start < path[0].target_range.end);
        assert!(definition_links(&server, source_uri, 0, 45).is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn emits_document_links_only_for_external_or_local_resource_wikilinks() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-document-links.md"));
        let source = "[[../assets/markdown-hero.png|Hero]] [[https://example.com|External]] [[members/sam-rivera|Sam]] [Native](https://example.com)\n";
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();

        let links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(links.len(), 4);
        assert_eq!(links[0].range.start.character, 2);
        assert_eq!(links[1].range.start.character, 30);
        assert!(
            links[0]
                .target
                .as_ref()
                .is_some_and(|target| target.as_str().ends_with("/assets/markdown-hero.png"))
        );
        assert!(
            links[2]
                .target
                .as_ref()
                .is_some_and(|target| target.as_str() == "https://example.com")
        );
    }

    #[test]
    fn emits_theme_roles_for_wikilinks_and_embeds() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-semantic-roles.md"));
        let source =
            "[[members/sam-rivera#Sam Rivera|Sam]] ![[members/sam-rivera#Sam Rivera|Sam]]\n";
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();

        let SemanticTokensResult::Tokens(tokens) = server
            .semantic_tokens(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap()
        else {
            panic!("expected full semantic tokens");
        };
        assert_eq!(
            tokens
                .data
                .iter()
                .map(|token| token.token_type)
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 0, 3, 0, 4, 0, 1, 2, 0, 3, 0]
        );
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
        assert_eq!(
            capabilities["textDocumentSync"]["save"]["includeText"],
            true
        );
        assert_eq!(capabilities["definitionProvider"], true);
        assert_eq!(
            capabilities["documentLinkProvider"]["resolveProvider"],
            false
        );
        assert_eq!(
            capabilities["semanticTokensProvider"]["legend"]["tokenTypes"],
            json!([
                "formaWikilinkDelimiter",
                "formaLinkTarget",
                "formaLinkFragment",
                "formaLinkLabel",
                "formaEmbedMarker",
            ])
        );
        assert_eq!(capabilities["semanticTokensProvider"]["full"], true);

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
        assert!(links.is_empty());

        let changed = "---\ntitle: LSP test\nowners: []\n---\nSee 😀 [[members/mira-chen|Mira]].\n";
        send_notification(
            &client_connection,
            "textDocument/didChange",
            json!({
                "textDocument": { "uri": source_uri, "version": 2 },
                "contentChanges": [{ "text": changed }],
            }),
        );
        send_notification(
            &client_connection,
            "textDocument/didSave",
            json!({
                "textDocument": { "uri": source_uri },
                "text": changed,
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

        send_request(
            &client_connection,
            5,
            "textDocument/semanticTokens/full",
            json!({ "textDocument": { "uri": source_uri } }),
        );
        let tokens: Option<SemanticTokensResult> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        let SemanticTokensResult::Tokens(tokens) = tokens.unwrap() else {
            panic!("expected full semantic tokens");
        };
        assert_eq!(tokens.data.len(), 5);
        assert_eq!(tokens.data[0].delta_line, 4);
        assert_eq!(tokens.data[0].delta_start, 7);
        assert_eq!(tokens.data[0].length, 2);
        assert_eq!(tokens.data[0].token_type, 0);
        assert_eq!(tokens.data[1].delta_start, 2);
        assert_eq!(tokens.data[1].length, 17);
        assert_eq!(tokens.data[1].token_type, 1);
        assert_eq!(tokens.data[2].delta_start, 17);
        assert_eq!(tokens.data[2].length, 1);
        assert_eq!(tokens.data[2].token_type, 0);
        assert_eq!(tokens.data[3].delta_start, 1);
        assert_eq!(tokens.data[3].length, 4);
        assert_eq!(tokens.data[3].token_type, 3);
        assert_eq!(tokens.data[4].delta_start, 4);
        assert_eq!(tokens.data[4].length, 2);
        assert_eq!(tokens.data[4].token_type, 0);

        send_request(&client_connection, 8, "textDocument/definition", json!({}));
        let malformed = receive_raw_response(&client_connection);
        assert_eq!(malformed.id, RequestId::from(8));
        assert!(malformed.error.is_some());

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

    #[test]
    fn registers_and_refreshes_managed_watch_patterns_for_capable_clients() {
        let root = copied_fixture("dynamic-watchers").canonicalize().unwrap();
        let config_path = root.join(".forma.md");
        let config_uri = file_uri(config_path.clone());
        let root_uri = file_uri(root.clone());
        let (server_connection, client_connection) = Connection::memory();
        let server_root = root.clone();
        let server = thread::spawn(move || run_connection(server_connection, server_root));

        send_request(
            &client_connection,
            1,
            "initialize",
            json!({
                "processId": null,
                "capabilities": {
                    "workspace": {
                        "didChangeWatchedFiles": {
                            "dynamicRegistration": true,
                            "relativePatternSupport": true,
                        },
                    },
                },
                "rootUri": root_uri,
            }),
        );
        receive_response(&client_connection);
        send_notification(&client_connection, "initialized", json!({}));

        let initial_registration = receive_server_request(&client_connection);
        assert_eq!(initial_registration.method, "client/registerCapability");
        assert!(
            initial_registration.params["registrations"][0]["registerOptions"]["watchers"][0]
                ["globPattern"]["baseUri"]
                .as_str()
                .is_some_and(|base| base.starts_with("file:"))
        );
        let initial_patterns = watcher_patterns(&initial_registration);
        assert!(initial_patterns.contains(&".forma.md".to_string()));
        assert!(initial_patterns.contains(&"tasks/**/*.md".to_string()));
        respond_ok(&client_connection, initial_registration.id);

        let original_config = fs::read_to_string(&config_path).unwrap();
        let configured = original_config.replace(
            "  - \".forma/views/*.md\"\n",
            "  - \".forma/views/*.md\"\n  - \".forma/categories/*.md\"\n",
        );
        fs::write(&config_path, &configured).unwrap();
        send_notification(
            &client_connection,
            "textDocument/didSave",
            json!({
                "textDocument": { "uri": config_uri },
                "text": configured,
            }),
        );

        let unregistration = receive_server_request(&client_connection);
        assert_eq!(unregistration.method, "client/unregisterCapability");
        respond_ok(&client_connection, unregistration.id);
        let refreshed_registration = receive_server_request(&client_connection);
        assert_eq!(refreshed_registration.method, "client/registerCapability");
        assert!(
            watcher_patterns(&refreshed_registration)
                .contains(&".forma/categories/*.md".to_string())
        );
        respond_ok(&client_connection, refreshed_registration.id);

        send_request(&client_connection, 2, "shutdown", serde_json::Value::Null);
        receive_response(&client_connection);
        send_notification(&client_connection, "exit", serde_json::Value::Null);
        server.join().unwrap().unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn returns_all_ambiguous_definition_candidates_and_rejects_outside_uris() {
        let root = copied_fixture("ambiguous-definition");
        for directory in ["notes/a", "notes/b"] {
            fs::create_dir_all(root.join(directory)).unwrap();
            fs::write(
                root.join(directory).join("same.md"),
                format!("---\ntitle: {directory}\nsummary: \"\"\n---\n\n# Same\n"),
            )
            .unwrap();
        }
        let root = root.canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("notes/unsaved.md"));
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": "See [[same]].\n",
                    }
                }))
                .unwrap(),
            )
            .unwrap();

        let definition = server
            .definition(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri },
                    "position": { "line": 0, "character": 7 },
                }))
                .unwrap(),
            )
            .unwrap()
            .unwrap();
        let GotoDefinitionResponse::Link(mut locations) = definition else {
            panic!("expected ambiguous location links");
        };
        locations.sort_by(|left, right| left.target_uri.cmp(&right.target_uri));
        assert_eq!(locations.len(), 2);
        assert!(
            locations[0]
                .target_uri
                .as_str()
                .ends_with("/notes/a/same.md")
        );
        assert!(
            locations[1]
                .target_uri
                .as_str()
                .ends_with("/notes/b/same.md")
        );

        let outside = file_uri(root.parent().unwrap().join("outside.md"));
        assert!(server.workspace_path(&outside).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn validates_the_getting_started_navigation_fixture_and_local_resources() {
        let root = fixture_root().canonicalize().unwrap();
        let server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/validate-editor-link-navigation.md"));
        let (_, source, analysis) = server.document_context(&source_uri).unwrap().unwrap();

        assert_eq!(
            analysis.references.len(),
            12,
            "references: {:?}",
            analysis
                .references
                .iter()
                .map(|reference| (&reference.field, &reference.raw_target))
                .collect::<Vec<_>>()
        );
        assert_eq!(
            analysis
                .references
                .iter()
                .filter(|reference| reference.field.as_deref() == Some("owners"))
                .map(|reference| reference.index)
                .collect::<Vec<_>>(),
            vec![Some(0), Some(1)]
        );
        assert!(!analysis.references.iter().any(|reference| {
            reference.field.as_deref() == Some("summary")
                || &source[reference.syntax_span.start_byte..reference.syntax_span.end_byte]
                    == "members/not-a-reference"
        }));

        let links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap();
        assert!(links.is_empty());

        let tokens = server
            .semantic_tokens(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap();
        let SemanticTokensResult::Tokens(tokens) = tokens else {
            panic!("expected full semantic tokens");
        };
        assert_eq!(tokens.data.len(), 18);

        let image_document = file_uri(root.join("notes/markdown-reader.md"));
        let image_links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": image_document } }))
                    .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert!(image_links.is_empty());
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/getting-started-workspace")
    }

    fn copied_fixture(name: &str) -> PathBuf {
        let unique = format!(
            "forma-lsp-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let root = std::env::temp_dir().join(unique);
        copy_dir(&fixture_root(), &root);
        root
    }

    fn copy_dir(source: &Path, target: &Path) {
        fs::create_dir_all(target).unwrap();
        for entry in fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            let source_path = entry.path();
            let target_path = target.join(entry.file_name());
            if source_path.is_dir() {
                copy_dir(&source_path, &target_path);
            } else {
                fs::copy(source_path, target_path).unwrap();
            }
        }
    }

    fn file_uri(path: PathBuf) -> Uri {
        let absolute = path.canonicalize().unwrap_or(path);
        url::Url::from_file_path(absolute)
            .unwrap()
            .as_str()
            .parse()
            .unwrap()
    }

    fn definition_links(server: &Server, uri: Uri, line: u32, character: u32) -> Vec<LocationLink> {
        let response = server
            .definition(
                serde_json::from_value(json!({
                    "textDocument": { "uri": uri },
                    "position": { "line": line, "character": character },
                }))
                .unwrap(),
            )
            .unwrap();
        match response {
            Some(GotoDefinitionResponse::Link(links)) => links,
            Some(_) => panic!("expected location links"),
            None => Vec::new(),
        }
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

    fn receive_server_request(connection: &Connection) -> Request {
        match connection
            .receiver
            .recv_timeout(Duration::from_secs(2))
            .unwrap()
        {
            Message::Request(request) => request,
            message => panic!("expected server request, got {message:?}"),
        }
    }

    fn watcher_patterns(request: &Request) -> Vec<String> {
        request.params["registrations"][0]["registerOptions"]["watchers"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|watcher| {
                watcher["globPattern"]
                    .as_str()
                    .or_else(|| watcher["globPattern"]["pattern"].as_str())
                    .map(ToString::to_string)
            })
            .collect()
    }

    fn respond_ok(connection: &Connection, id: RequestId) {
        connection
            .sender
            .send(Message::Response(lsp_server::Response::new_ok(
                id,
                serde_json::Value::Null,
            )))
            .unwrap();
    }

    fn receive_response(connection: &Connection) -> lsp_server::Response {
        let response = receive_raw_response(connection);
        if let Some(error) = &response.error {
            panic!("LSP response failed: {error:?}");
        }
        response
    }

    fn receive_raw_response(connection: &Connection) -> lsp_server::Response {
        let message = connection
            .receiver
            .recv_timeout(Duration::from_secs(5))
            .unwrap();
        let Message::Response(response) = message else {
            panic!("expected response, received {message:?}");
        };
        response
    }
}
