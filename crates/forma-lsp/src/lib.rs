use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::{Duration, Instant};

use forma_core::{
    DiagnosticLocation as CoreDiagnosticLocation, DiagnosticSeverity as CoreDiagnosticSeverity,
    DocumentAnalysis, DocumentCompletionKind, DocumentDiagnostic as CoreDocumentDiagnostic,
    DocumentReference, DocumentReferenceSyntax, ManagedDocumentKind, ReferenceFragmentLocation,
    ReferenceResolveResult, SourceSpan, WorkspaceSession, project_inline_code_references,
    project_markdown_fenced_references,
};
use lsp_server::{Connection, ErrorCode, Message, Notification, Request, Response};
use lsp_types::notification::{
    DidChangeTextDocument, DidChangeWatchedFiles, DidCloseTextDocument, DidOpenTextDocument,
    DidSaveTextDocument, Exit, Initialized, Notification as _, PublishDiagnostics,
};
use lsp_types::request::{
    Completion, DocumentLinkRequest, GotoDefinition, HoverRequest, References, RegisterCapability,
    Request as _, UnregisterCapability,
};
use lsp_types::{
    CodeDescription, CompletionItem, CompletionItemKind, CompletionOptions, CompletionParams,
    CompletionResponse, CompletionTextEdit, Diagnostic as LspDiagnostic,
    DiagnosticSeverity as LspDiagnosticSeverity, DidChangeTextDocumentParams,
    DidChangeWatchedFilesParams, DidChangeWatchedFilesRegistrationOptions,
    DidCloseTextDocumentParams, DidOpenTextDocumentParams, DidSaveTextDocumentParams, DocumentLink,
    DocumentLinkOptions, DocumentLinkParams, FileChangeType, FileSystemWatcher, GlobPattern,
    GotoDefinitionParams, GotoDefinitionResponse, Hover, HoverContents, HoverParams,
    HoverProviderCapability, InitializeParams, Location, LocationLink, MarkupContent, MarkupKind,
    NumberOrString, OneOf, Position, PositionEncodingKind, PublishDiagnosticsParams, Range,
    ReferenceParams, Registration, RegistrationParams, RelativePattern, SaveOptions,
    ServerCapabilities, TextDocumentSyncCapability, TextDocumentSyncKind, TextDocumentSyncOptions,
    TextDocumentSyncSaveOptions, TextEdit, Unregistration, UnregistrationParams, Uri,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use url::Url;

const FORMA_INSTALLATION_DOCUMENTATION_URL: &str =
    "https://github.com/choral-io/choral-forma#installing-forma";

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
    #[error("invalid Forma LSP initialization options: {0}")]
    InvalidInitializationOptions(String),
}

#[derive(Debug, Clone)]
struct OpenDocument {
    path: String,
    source: Option<String>,
    kind: ManagedDocumentKind,
    version: Option<i32>,
}

#[derive(Debug, Clone, PartialEq)]
struct PublishedDiagnostics {
    diagnostics: Vec<LspDiagnostic>,
    version: Option<i32>,
}

struct Server {
    root: PathBuf,
    editor_root: PathBuf,
    session: WorkspaceSession,
    client_profile: ClientBehaviorProfile,
    open_documents: BTreeMap<Uri, OpenDocument>,
    published_diagnostics: BTreeMap<Uri, PublishedDiagnostics>,
    expected_extension_version: Option<String>,
    recently_refreshed_saves: BTreeMap<String, Instant>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct WatchRegistration {
    id: String,
    patterns: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum ClientBehaviorProfile {
    Generic,
    Zed,
    Vscode,
}

impl ClientBehaviorProfile {
    fn from_client_name(name: Option<&str>) -> Self {
        let name = name.map(str::trim).map(str::to_ascii_lowercase);
        match name.as_deref() {
            Some(name) if name.starts_with("zed") => Self::Zed,
            Some("visual studio code" | "vscode") => Self::Vscode,
            _ => Self::Generic,
        }
    }

    fn from_initialize_params(params: &InitializeParams) -> Result<Self, LspError> {
        let inferred = Self::from_client_name(
            params
                .client_info
                .as_ref()
                .map(|client| client.name.as_str()),
        );
        let Some(options) = params
            .initialization_options
            .as_ref()
            .filter(|options| !options.is_null())
        else {
            return Ok(inferred);
        };
        let options = serde_json::from_value::<FormaInitializationOptions>(options.clone())
            .map_err(|error| LspError::InvalidInitializationOptions(error.to_string()))?;
        let Some(requested) = options.client_profile else {
            return Ok(inferred);
        };
        if requested != inferred {
            return Err(LspError::InvalidInitializationOptions(format!(
                "client profile `{requested:?}` does not match client `{inferred:?}`"
            )));
        }
        Ok(requested)
    }

    fn uses_zed_file_urls(self) -> bool {
        self == Self::Zed
    }

    fn provides_markdown_fragment_fallback(self) -> bool {
        self == Self::Zed
    }

    fn projects_code_example_links(self) -> bool {
        self == Self::Zed
    }

    fn provides_positionless_wikilink_definitions(self) -> bool {
        self == Self::Vscode
    }

    fn integration_name(self) -> Option<&'static str> {
        match self {
            Self::Generic => None,
            Self::Zed => Some("Forma for Zed"),
            Self::Vscode => Some("Forma for VS Code"),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FormaInitializationOptions {
    #[serde(default)]
    client_profile: Option<ClientBehaviorProfile>,
    #[serde(default)]
    extension_version: Option<String>,
}

pub fn run(root: impl AsRef<Path>) -> Result<(), LspError> {
    let editor_root = absolute_path(root.as_ref())?;
    let root = fs::canonicalize(&editor_root)?;
    let (connection, io_threads) = Connection::stdio();
    run_connection_with_editor_root(connection, root, editor_root)?;
    io_threads.join()?;
    Ok(())
}

#[cfg(test)]
fn run_connection(connection: Connection, root: PathBuf) -> Result<(), LspError> {
    run_connection_with_editor_root(connection, root.clone(), root)
}

fn run_connection_with_editor_root(
    connection: Connection,
    root: PathBuf,
    editor_root: PathBuf,
) -> Result<(), LspError> {
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
    let client_profile = match ClientBehaviorProfile::from_initialize_params(&initialize_params) {
        Ok(profile) => profile,
        Err(error) => {
            connection
                .sender
                .send(Message::Response(Response::new_err(
                    initialize_id,
                    ErrorCode::InvalidParams as i32,
                    error.to_string(),
                )))
                .map_err(|_| LspError::ChannelClosed)?;
            return Ok(());
        }
    };
    let expected_extension_version = initialize_params
        .initialization_options
        .as_ref()
        .filter(|options| !options.is_null())
        .map(|options| serde_json::from_value::<FormaInitializationOptions>(options.clone()))
        .transpose()
        .map_err(|error| LspError::InvalidInitializationOptions(error.to_string()))?
        .and_then(|options| options.extension_version)
        .filter(|version| !version.trim().is_empty());
    connection
        .sender
        .send(Message::Response(Response::new_ok(
            initialize_id,
            serde_json::json!({
            "capabilities": server_capabilities(),
            "serverInfo": {
                "name": "forma",
                "version": forma_core::version(),
            },
            }),
        )))
        .map_err(|_| LspError::ChannelClosed)?;

    let mut server =
        Server::new_with_client_profile_and_editor_root(root, editor_root, client_profile)?;
    server.expected_extension_version = expected_extension_version;
    let mut registered_watchers = None;
    let mut next_request_id = 10_000;
    let mut initialized = false;
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
                if notification.method == Initialized::METHOD {
                    initialized = true;
                }
                for outbound in server.handle_notification(notification)? {
                    connection
                        .sender
                        .send(Message::Notification(outbound))
                        .map_err(|_| LspError::ChannelClosed)?;
                }
                if initialized && supports_dynamic_watchers {
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
        references_provider: Some(OneOf::Left(true)),
        hover_provider: Some(HoverProviderCapability::Simple(true)),
        completion_provider: Some(CompletionOptions {
            resolve_provider: Some(false),
            trigger_characters: Some(vec!["[".to_string(), "#".to_string()]),
            ..Default::default()
        }),
        document_link_provider: Some(DocumentLinkOptions {
            resolve_provider: Some(false),
            work_done_progress_options: Default::default(),
        }),
        ..Default::default()
    }
}

impl Server {
    #[cfg(test)]
    fn new(root: PathBuf) -> Result<Self, LspError> {
        Self::new_with_client_profile(root, ClientBehaviorProfile::Generic)
    }

    #[cfg(test)]
    fn new_with_client_profile(
        root: PathBuf,
        client_profile: ClientBehaviorProfile,
    ) -> Result<Self, LspError> {
        Self::new_with_client_profile_and_editor_root(root.clone(), root, client_profile)
    }

    fn new_with_client_profile_and_editor_root(
        root: PathBuf,
        editor_root: PathBuf,
        client_profile: ClientBehaviorProfile,
    ) -> Result<Self, LspError> {
        Ok(Self {
            session: WorkspaceSession::load(&root)?,
            root,
            editor_root,
            client_profile,
            open_documents: BTreeMap::new(),
            published_diagnostics: BTreeMap::new(),
            expected_extension_version: None,
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
            HoverRequest::METHOD => serde_json::from_value::<HoverParams>(request.params)
                .map_err(LspError::from)
                .and_then(|params| self.hover(params))
                .and_then(json_value),
            Completion::METHOD => serde_json::from_value::<CompletionParams>(request.params)
                .map_err(LspError::from)
                .and_then(|params| self.completion(params))
                .and_then(json_value),
            References::METHOD => serde_json::from_value::<ReferenceParams>(request.params)
                .map_err(LspError::from)
                .and_then(|params| self.references(params))
                .and_then(json_value),
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

    fn handle_notification(
        &mut self,
        notification: Notification,
    ) -> Result<Vec<Notification>, LspError> {
        match notification.method.as_str() {
            Initialized::METHOD => self.publish_version_advisory(),
            DidOpenTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidOpenTextDocumentParams>(notification.params)?;
                let uri = params.text_document.uri.clone();
                self.open_document(params)?;
                self.refresh_diagnostics_for_uri(&uri)
            }
            DidChangeTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidChangeTextDocumentParams>(notification.params)?;
                let uri = params.text_document.uri.clone();
                self.change_document(params)?;
                self.refresh_diagnostics_for_uri(&uri)
            }
            DidCloseTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidCloseTextDocumentParams>(notification.params)?;
                let uri = params.text_document.uri.clone();
                self.close_document(params)?;
                self.clear_diagnostics(&uri)
            }
            DidSaveTextDocument::METHOD => {
                let params =
                    serde_json::from_value::<DidSaveTextDocumentParams>(notification.params)?;
                let uri = params.text_document.uri.clone();
                if self.save_document(params)? {
                    self.refresh_open_document_diagnostics()
                } else {
                    self.refresh_diagnostics_for_uri(&uri)
                }
            }
            DidChangeWatchedFiles::METHOD => {
                let params =
                    serde_json::from_value::<DidChangeWatchedFilesParams>(notification.params)?;
                if self.change_watched_files(params)? {
                    self.refresh_open_document_diagnostics()
                } else {
                    Ok(Vec::new())
                }
            }
            _ => Ok(Vec::new()),
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
                version: Some(params.text_document.version),
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
                version: Some(params.text_document.version),
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

    fn save_document(&mut self, params: DidSaveTextDocumentParams) -> Result<bool, LspError> {
        let uri = params.text_document.uri;
        let path = self.workspace_path(&uri)?;
        let kind = self.session.snapshot().document_kind(&path)?;
        if let Some(source) = params.text {
            let version = self
                .open_documents
                .get(&uri)
                .and_then(|document| document.version);
            if kind.is_language_document() {
                self.session.set_document(&path, source.clone())?;
            }
            self.open_documents.insert(
                uri,
                OpenDocument {
                    path: path.clone(),
                    source: kind.is_language_document().then_some(source),
                    kind,
                    version,
                },
            );
        }
        let affects_configuration = self.session.snapshot().affects_configuration(&path)?;
        let mut refreshed = false;
        if (kind.is_language_document() || affects_configuration)
            && self.refresh_snapshot("a save", affects_configuration)
        {
            self.recently_refreshed_saves.insert(path, Instant::now());
            refreshed = true;
        }
        Ok(refreshed)
    }

    fn change_watched_files(
        &mut self,
        params: DidChangeWatchedFilesParams,
    ) -> Result<bool, LspError> {
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
        Ok(relevant && self.refresh_snapshot("a watched-file change", reanalyze_documents))
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

    fn refresh_open_document_diagnostics(&mut self) -> Result<Vec<Notification>, LspError> {
        let uris = self.open_documents.keys().cloned().collect::<Vec<_>>();
        let mut notifications = Vec::new();
        for uri in uris {
            notifications.extend(self.refresh_diagnostics_for_uri(&uri)?);
        }
        Ok(notifications)
    }

    fn refresh_diagnostics_for_uri(&mut self, uri: &Uri) -> Result<Vec<Notification>, LspError> {
        let Some(document) = self.open_documents.get(uri).cloned() else {
            return self.clear_diagnostics(uri);
        };
        if !document.kind.is_language_document() {
            return self.clear_diagnostics(uri);
        }
        let source = match document.source {
            Some(source) => source,
            None => fs::read_to_string(self.root.join(&document.path))?,
        };
        let mut diagnostics = self
            .session
            .document_diagnostics(&document.path)?
            .iter()
            .map(|diagnostic| lsp_diagnostic(&source, diagnostic))
            .collect::<Vec<_>>();
        if let Some((advisory_uri, advisory)) = self.version_advisory_diagnostic()?
            && advisory_uri == *uri
        {
            diagnostics.push(advisory);
        }
        self.update_published_diagnostics(uri, diagnostics, document.version)
    }

    fn publish_version_advisory(&mut self) -> Result<Vec<Notification>, LspError> {
        let Some((uri, diagnostic)) = self.version_advisory_diagnostic()? else {
            return Ok(Vec::new());
        };
        self.update_published_diagnostics(&uri, vec![diagnostic], None)
    }

    fn version_advisory_diagnostic(&self) -> Result<Option<(Uri, LspDiagnostic)>, LspError> {
        let Some(expected) = self.expected_extension_version.as_deref() else {
            return Ok(None);
        };
        let Some(integration_name) = self.client_profile.integration_name() else {
            return Ok(None);
        };
        let actual = forma_core::version();
        if expected == actual {
            return Ok(None);
        }
        let uri = self.path_uri(forma_core::FORMA_CONFIG_PATH)?;
        let documentation_uri = Uri::from_str(FORMA_INSTALLATION_DOCUMENTATION_URL)
            .map_err(|_| LspError::InvalidFileUri(FORMA_INSTALLATION_DOCUMENTATION_URL.into()))?;
        let diagnostic = LspDiagnostic {
            range: self.version_advisory_range(),
            severity: Some(LspDiagnosticSeverity::WARNING),
            code: Some(NumberOrString::String(
                "forma.cliVersionMismatch".to_string(),
            )),
            code_description: Some(CodeDescription {
                href: documentation_uri,
            }),
            source: Some("forma".to_string()),
            message: format!(
                "Forma CLI {actual} does not match {integration_name} {expected}. Install the matching CLI from {FORMA_INSTALLATION_DOCUMENTATION_URL}"
            ),
            ..Default::default()
        };
        Ok(Some((uri, diagnostic)))
    }

    fn version_advisory_range(&self) -> Range {
        let end_character = fs::read_to_string(self.root.join(forma_core::FORMA_CONFIG_PATH))
            .ok()
            .and_then(|source| source.chars().next())
            .map(|character| character.len_utf16() as u32)
            .unwrap_or(0);
        Range::new(Position::new(0, 0), Position::new(0, end_character))
    }

    fn update_published_diagnostics(
        &mut self,
        uri: &Uri,
        diagnostics: Vec<LspDiagnostic>,
        version: Option<i32>,
    ) -> Result<Vec<Notification>, LspError> {
        if diagnostics.is_empty() {
            if self.published_diagnostics.remove(uri).is_none() {
                return Ok(Vec::new());
            }
            return Ok(vec![publish_diagnostics_notification(
                uri.clone(),
                Vec::new(),
                version,
            )?]);
        }
        let state = PublishedDiagnostics {
            diagnostics: diagnostics.clone(),
            version,
        };
        if self
            .published_diagnostics
            .get(uri)
            .is_some_and(|published| published == &state)
        {
            return Ok(Vec::new());
        }
        self.published_diagnostics.insert(uri.clone(), state);
        Ok(vec![publish_diagnostics_notification(
            uri.clone(),
            diagnostics,
            version,
        )?])
    }

    fn clear_diagnostics(&mut self, uri: &Uri) -> Result<Vec<Notification>, LspError> {
        if let Some((advisory_uri, advisory)) = self.version_advisory_diagnostic()?
            && advisory_uri == *uri
        {
            return self.update_published_diagnostics(uri, vec![advisory], None);
        }
        self.update_published_diagnostics(uri, Vec::new(), None)
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
        let Some((reference, origin_span)) = offset
            .and_then(|offset| definition_reference_at(self.client_profile, &analysis, offset))
        else {
            return Ok(None);
        };
        if is_external_target(&reference.raw_target)
            || self.local_resource_uri(&path, reference).is_some()
        {
            return Ok(None);
        }
        if !self
            .client_profile
            .provides_positionless_wikilink_definitions()
            && is_positionless_wikilink(reference)
            && self.editor_reference_uri(&path, reference)?.is_some()
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

    fn hover(&self, params: HoverParams) -> Result<Option<Hover>, LspError> {
        let uri = &params.text_document_position_params.text_document.uri;
        let Some((path, source, analysis)) = self.document_context(uri)? else {
            return Ok(None);
        };
        let offset = offset_at_position(&source, params.text_document_position_params.position);
        let Some((reference, span)) = offset
            .and_then(|offset| definition_reference_at(self.client_profile, &analysis, offset))
            .filter(|(reference, _)| {
                definition_ownership(self.client_profile, reference) == DefinitionOwnership::Forma
            })
        else {
            return Ok(None);
        };
        if is_external_target(&reference.raw_target)
            || self.local_resource_uri(&path, reference).is_some()
        {
            return Ok(None);
        }

        let result = self.session.resolve_document_reference(&path, reference)?;
        let markdown = if result.target.is_none() && result.candidates.is_empty() {
            self.session
                .resolve_managed_path_reference(&path, reference)?
                .map(|target| managed_path_hover_markdown(reference, &target.path))
                .unwrap_or_else(|| reference_hover_markdown(reference, &result))
        } else {
            reference_hover_markdown(reference, &result)
        };
        Ok(Some(Hover {
            contents: HoverContents::Markup(MarkupContent {
                kind: MarkupKind::Markdown,
                value: markdown,
            }),
            range: Some(source_span_range(&source, span)),
        }))
    }

    fn completion(&self, params: CompletionParams) -> Result<Option<CompletionResponse>, LspError> {
        let uri = &params.text_document_position.text_document.uri;
        let Some((path, source, _)) = self.document_context(uri)? else {
            return Ok(None);
        };
        let Some(cursor_byte) = offset_at_position(&source, params.text_document_position.position)
        else {
            return Ok(None);
        };
        let Some(completion) = self.session.complete_document(&path, cursor_byte)? else {
            return Ok(None);
        };
        let range = source_span_range(&source, completion.replace_span);
        let items = completion
            .candidates
            .into_iter()
            .enumerate()
            .map(|(index, candidate)| CompletionItem {
                label: candidate.label.clone(),
                kind: Some(match candidate.kind {
                    DocumentCompletionKind::Entry
                    | DocumentCompletionKind::Heading
                    | DocumentCompletionKind::Block => CompletionItemKind::REFERENCE,
                }),
                detail: candidate.detail,
                filter_text: Some(format!("{} {}", candidate.label, candidate.insert_text)),
                sort_text: Some(format!("{index:08}")),
                text_edit: Some(CompletionTextEdit::Edit(TextEdit {
                    range,
                    new_text: candidate.insert_text,
                })),
                ..Default::default()
            })
            .collect::<Vec<_>>();
        Ok(Some(CompletionResponse::Array(items)))
    }

    fn references(&self, params: ReferenceParams) -> Result<Option<Vec<Location>>, LspError> {
        let uri = &params.text_document_position.text_document.uri;
        let Some((path, source, _)) = self.document_context(uri)? else {
            return Ok(None);
        };
        let Some(cursor_byte) = offset_at_position(&source, params.text_document_position.position)
        else {
            return Ok(None);
        };
        let occurrences = self
            .session
            .references_for_document_position(&path, cursor_byte)?;
        let sources = load_source_cache(
            occurrences
                .iter()
                .map(|occurrence| occurrence.source_path.as_str()),
            |source_path| self.source_for_path(source_path),
        )?;
        let locations = occurrences
            .into_iter()
            .map(|occurrence| {
                let source = sources
                    .get(&occurrence.source_path)
                    .expect("every reference source should be loaded into the request cache");
                Ok(Location::new(
                    self.path_uri(&occurrence.source_path)?,
                    source_span_range(source, occurrence.span),
                ))
            })
            .collect::<Result<Vec<_>, LspError>>()?;
        Ok(Some(locations))
    }

    fn document_links(
        &self,
        params: DocumentLinkParams,
    ) -> Result<Option<Vec<DocumentLink>>, LspError> {
        let uri = &params.text_document.uri;
        let Some((path, source, analysis)) = self.document_context(uri)? else {
            return Ok(Some(Vec::new()));
        };
        let mut links = Vec::new();
        for reference in analysis.references.iter().filter(|reference| {
            matches!(
                reference.syntax,
                DocumentReferenceSyntax::Wikilink | DocumentReferenceSyntax::ObsidianEmbed
            )
        }) {
            let target = if is_external_target(&reference.raw_target) {
                Uri::from_str(&reference.raw_target).ok()
            } else if let Some(target) = self.local_resource_uri(&path, reference) {
                Some(target)
            } else if is_positionless_wikilink(reference) {
                self.editor_reference_uri(&path, reference)?
            } else {
                None
            };
            let Some(target) = target else {
                continue;
            };
            links.extend(document_links_for_reference(
                &source,
                reference,
                target,
                "Open Forma link",
            ));
        }

        if self.client_profile.projects_code_example_links() {
            for reference in project_inline_code_references(&source) {
                let Some(target) = self.editor_reference_uri(&path, &reference)? else {
                    continue;
                };
                links.extend(document_links_for_reference(
                    &source,
                    &reference,
                    target,
                    "Open inline Markdown example link",
                ));
            }

            for reference in project_markdown_fenced_references(&source) {
                let Some(target) = self.editor_reference_uri(&path, &reference)? else {
                    continue;
                };
                links.extend(document_links_for_reference(
                    &source,
                    &reference,
                    target,
                    "Open Markdown example link",
                ));
            }
        }
        Ok(Some(links))
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
        if extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("mdx") {
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
        let relative = target.strip_prefix(&self.root).ok()?;
        let url = Url::from_file_path(self.editor_root.join(relative)).ok()?;
        Uri::from_str(url.as_str()).ok()
    }

    fn editor_reference_uri(
        &self,
        source_path: &str,
        reference: &DocumentReference,
    ) -> Result<Option<Uri>, LspError> {
        if is_external_target(&reference.raw_target) {
            return Ok(Uri::from_str(&reference.raw_target).ok());
        }
        if let Some(target) = self.local_resource_uri(source_path, reference) {
            return Ok(Some(target));
        }

        let Some(target) = self
            .session
            .resolve_document_reference(source_path, reference)?
            .target
        else {
            return Ok(None);
        };
        let Ok(mut url) = Url::from_file_path(self.editor_root.join(&target.path)) else {
            return Ok(None);
        };
        if let Some(location) = target.fragment_location {
            url.set_fragment(Some(&format!("L{}:{}", location.line, location.column)));
        } else if self.client_profile.uses_zed_file_urls() {
            return Ok(Uri::from_str(&format!("zed://file{}", url.path())).ok());
        }
        Ok(Uri::from_str(url.as_str()).ok())
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
            .strip_prefix(&self.editor_root)
            .or_else(|_| path.strip_prefix(&self.root))
            .map_err(|_| LspError::OutsideWorkspace(path.clone()))?;
        validate_workspace_relative_path(&self.root, relative)
            .map_err(|_| LspError::OutsideWorkspace(path.clone()))?;
        Ok(relative
            .components()
            .map(|component| component.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/"))
    }

    fn path_uri(&self, path: &str) -> Result<Uri, LspError> {
        let path = self.editor_root.join(path);
        let url = Url::from_file_path(&path)
            .map_err(|_| LspError::InvalidFileUri(path.display().to_string()))?;
        Uri::from_str(url.as_str())
            .map_err(|_| LspError::InvalidFileUri(path.display().to_string()))
    }
}

fn absolute_path(path: &Path) -> Result<PathBuf, std::io::Error> {
    if path.is_absolute() {
        Ok(path.to_path_buf())
    } else {
        Ok(std::env::current_dir()?.join(path))
    }
}

fn validate_workspace_relative_path(root: &Path, relative: &Path) -> Result<(), std::io::Error> {
    let candidate = root.join(relative);
    let boundary_target = if candidate.exists() {
        candidate.canonicalize()?
    } else if let Some(parent) = candidate.parent() {
        parent
            .canonicalize()?
            .join(candidate.file_name().unwrap_or_default())
    } else {
        candidate
    };
    if boundary_target.starts_with(root) {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "path escapes the Forma workspace",
        ))
    }
}

fn json_value(value: impl Serialize) -> Result<serde_json::Value, LspError> {
    Ok(serde_json::to_value(value)?)
}

fn publish_diagnostics_notification(
    uri: Uri,
    diagnostics: Vec<LspDiagnostic>,
    version: Option<i32>,
) -> Result<Notification, LspError> {
    Ok(Notification {
        method: PublishDiagnostics::METHOD.to_string(),
        params: serde_json::to_value(PublishDiagnosticsParams::new(uri, diagnostics, version))?,
    })
}

fn lsp_diagnostic(source: &str, item: &CoreDocumentDiagnostic) -> LspDiagnostic {
    let range = item
        .span
        .map(|span| source_span_range(source, span))
        .unwrap_or_else(|| core_diagnostic_location_range(item));
    LspDiagnostic {
        range,
        severity: Some(match item.diagnostic.severity {
            CoreDiagnosticSeverity::Error => LspDiagnosticSeverity::ERROR,
            CoreDiagnosticSeverity::Warning => LspDiagnosticSeverity::WARNING,
            CoreDiagnosticSeverity::Info => LspDiagnosticSeverity::INFORMATION,
        }),
        code: Some(NumberOrString::String(item.diagnostic.code.clone())),
        source: Some("forma".to_string()),
        message: item.diagnostic.message.clone(),
        ..Default::default()
    }
}

fn core_diagnostic_location_range(item: &CoreDocumentDiagnostic) -> Range {
    let (line, character) = match item.diagnostic.location.as_ref() {
        Some(CoreDiagnosticLocation::Body { line, column }) => (
            line.unwrap_or(1).saturating_sub(1) as u32,
            column.unwrap_or(1).saturating_sub(1) as u32,
        ),
        _ => (0, 0),
    };
    let position = Position::new(line, character);
    Range::new(position, position)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DefinitionOwnership {
    Forma,
    NativeMarkdown,
    MarkdownFragmentFallback,
}

fn definition_ownership(
    client_profile: ClientBehaviorProfile,
    reference: &DocumentReference,
) -> DefinitionOwnership {
    match reference.syntax {
        // Keep ordinary Markdown navigation editor-owned. Forma only fills the narrow gap where
        // Zed resolves the document but does not reliably navigate to an in-document heading.
        DocumentReferenceSyntax::MarkdownLink
            if reference.fragment.is_some()
                && client_profile.provides_markdown_fragment_fallback() =>
        {
            DefinitionOwnership::MarkdownFragmentFallback
        }
        DocumentReferenceSyntax::MarkdownLink | DocumentReferenceSyntax::MarkdownImage => {
            DefinitionOwnership::NativeMarkdown
        }
        DocumentReferenceSyntax::Frontmatter
        | DocumentReferenceSyntax::Wikilink
        | DocumentReferenceSyntax::ObsidianEmbed => DefinitionOwnership::Forma,
    }
}

fn is_positionless_wikilink(reference: &DocumentReference) -> bool {
    reference.fragment.is_none()
        && matches!(
            reference.syntax,
            DocumentReferenceSyntax::Wikilink | DocumentReferenceSyntax::ObsidianEmbed
        )
}

fn definition_reference_at(
    client_profile: ClientBehaviorProfile,
    analysis: &DocumentAnalysis,
    offset: usize,
) -> Option<(&DocumentReference, SourceSpan)> {
    analysis.references.iter().find_map(|reference| {
        let ownership = definition_ownership(client_profile, reference);
        if ownership == DefinitionOwnership::NativeMarkdown {
            return None;
        }
        let spans = match reference.syntax {
            DocumentReferenceSyntax::Frontmatter => {
                [reference.target_span, reference.fragment_span, None]
            }
            DocumentReferenceSyntax::MarkdownLink
            | DocumentReferenceSyntax::Wikilink
            | DocumentReferenceSyntax::ObsidianEmbed => [
                reference.target_span,
                reference.fragment_span,
                reference.label_span,
            ],
            DocumentReferenceSyntax::MarkdownImage => return None,
        };
        spans
            .into_iter()
            .flatten()
            .find(|span| span.start_byte <= offset && offset < span.end_byte)
            .map(|span| (reference, span))
    })
}

fn reference_hover_markdown(
    reference: &DocumentReference,
    result: &ReferenceResolveResult,
) -> String {
    let label = match reference.syntax {
        DocumentReferenceSyntax::Frontmatter => "Forma entry reference",
        DocumentReferenceSyntax::Wikilink => "Forma wikilink",
        DocumentReferenceSyntax::ObsidianEmbed => "Forma embed",
        DocumentReferenceSyntax::MarkdownLink | DocumentReferenceSyntax::MarkdownImage => {
            "Forma reference"
        }
    };
    let mut lines = vec![format!("**{label}**")];

    if let Some(target) = &result.target {
        if let Some(title) = target.title.as_deref() {
            lines.push(String::new());
            lines.push(format!("### {}", escape_markdown_text(title)));
        }
        lines.push(String::new());
        lines.push(format!("- Path: {}", markdown_inline_code(&target.path)));
        lines.push(format!("- Space: {}", markdown_inline_code(&target.space)));
        if let Some(kind) = target.kind.as_deref() {
            lines.push(format!("- Kind: {}", markdown_inline_code(kind)));
        }
        if let Some(fragment) = target.fragment.as_deref() {
            lines.push(format!("- Fragment: {}", markdown_inline_code(fragment)));
        }
    } else {
        lines.push(String::new());
        lines.push(format!(
            "Target: {}",
            markdown_inline_code(reference.raw_target.trim())
        ));
        if !result.candidates.is_empty() {
            lines.push(String::new());
            lines.push("Candidates:".to_string());
            for candidate in &result.candidates {
                let title = candidate
                    .title
                    .as_deref()
                    .map(escape_markdown_text)
                    .map(|title| format!(" — {title}"))
                    .unwrap_or_default();
                lines.push(format!(
                    "- {}{title}",
                    markdown_inline_code(&candidate.path)
                ));
            }
        }
    }

    if let Some(field) = reference.field.as_deref() {
        lines.push(format!("- Field: {}", markdown_inline_code(field)));
    }

    if !result.diagnostics.is_empty() {
        lines.push(String::new());
        for diagnostic in &result.diagnostics {
            lines.push(format!(
                "> **{}:** {}",
                markdown_inline_code(&diagnostic.code),
                escape_markdown_text(&diagnostic.message)
            ));
        }
    }

    lines.join("\n")
}

fn managed_path_hover_markdown(reference: &DocumentReference, target_path: &str) -> String {
    let label = match reference.syntax {
        DocumentReferenceSyntax::ObsidianEmbed => "Forma embed",
        _ => "Forma wikilink",
    };
    let mut lines = vec![
        format!("**{label}**"),
        String::new(),
        format!("- Path: {}", markdown_inline_code(target_path)),
    ];
    if let Some(fragment) = reference.fragment.as_deref() {
        lines.push(format!("- Fragment: {}", markdown_inline_code(fragment)));
    }
    lines.join("\n")
}

fn markdown_inline_code(value: &str) -> String {
    let longest_run = value
        .split(|character| character != '`')
        .map(str::len)
        .max()
        .unwrap_or(0);
    let fence = "`".repeat(longest_run + 1);
    let needs_padding = value.starts_with(['`', ' ']) || value.ends_with(['`', ' ']);
    if needs_padding {
        format!("{fence} {value} {fence}")
    } else {
        format!("{fence}{value}{fence}")
    }
}

fn escape_markdown_text(value: &str) -> String {
    let normalized = value.replace('\r', " ").replace('\n', " ");
    let mut escaped = String::with_capacity(normalized.len());
    for character in normalized.chars() {
        if matches!(
            character,
            '\\' | '`' | '*' | '_' | '{' | '}' | '[' | ']' | '<' | '>' | '#' | '+' | '-' | '!'
        ) {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
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

fn document_links_for_reference(
    source: &str,
    reference: &DocumentReference,
    target: Uri,
    tooltip: &str,
) -> Vec<DocumentLink> {
    document_link_spans(reference)
        .into_iter()
        .map(|span| DocumentLink {
            range: source_span_range(source, span),
            target: Some(target.clone()),
            tooltip: Some(tooltip.to_string()),
            data: None,
        })
        .collect()
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

fn load_source_cache<'a>(
    paths: impl IntoIterator<Item = &'a str>,
    mut load: impl FnMut(&str) -> Result<String, LspError>,
) -> Result<BTreeMap<String, String>, LspError> {
    let mut sources = BTreeMap::new();
    for path in paths {
        if !sources.contains_key(path) {
            sources.insert(path.to_string(), load(path)?);
        }
    }
    Ok(sources)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::thread;
    use std::time::Duration;

    use lsp_server::{Connection, ErrorCode, Message, Notification, Request, RequestId};
    use lsp_types::{
        CompletionResponse, CompletionTextEdit, DocumentLink, GotoDefinitionResponse, Hover,
        HoverContents, InitializeParams, Location, LocationLink, Position,
        PublishDiagnosticsParams, Range, Uri,
    };
    use serde_json::json;

    use super::{
        ClientBehaviorProfile, DefinitionOwnership, ManagedDocumentKind, Server,
        definition_ownership, load_source_cache, offset_at_position, position_at_offset,
        run_connection,
    };

    #[test]
    fn selects_explicit_client_behavior_profiles() {
        assert_eq!(
            ClientBehaviorProfile::from_client_name(Some("Zed")),
            ClientBehaviorProfile::Zed
        );
        assert_eq!(
            ClientBehaviorProfile::from_client_name(Some("Zed Preview")),
            ClientBehaviorProfile::Zed
        );
        assert_eq!(
            ClientBehaviorProfile::from_client_name(Some("Visual Studio Code")),
            ClientBehaviorProfile::Vscode
        );
        assert_eq!(
            ClientBehaviorProfile::from_client_name(Some("Other Editor")),
            ClientBehaviorProfile::Generic
        );
        assert_eq!(
            ClientBehaviorProfile::from_client_name(None),
            ClientBehaviorProfile::Generic
        );
    }

    #[test]
    fn validates_explicit_initialization_profile_against_client_identity() {
        let matching: InitializeParams = serde_json::from_value(json!({
            "clientInfo": { "name": "Visual Studio Code", "version": "test" },
            "capabilities": {},
            "initializationOptions": { "clientProfile": "vscode" },
        }))
        .unwrap();
        assert_eq!(
            ClientBehaviorProfile::from_initialize_params(&matching).unwrap(),
            ClientBehaviorProfile::Vscode
        );

        let mismatched: InitializeParams = serde_json::from_value(json!({
            "clientInfo": { "name": "Visual Studio Code", "version": "test" },
            "capabilities": {},
            "initializationOptions": { "clientProfile": "zed" },
        }))
        .unwrap();
        assert!(ClientBehaviorProfile::from_initialize_params(&mismatched).is_err());

        let unknown: InitializeParams = serde_json::from_value(json!({
            "clientInfo": { "name": "Visual Studio Code", "version": "test" },
            "capabilities": {},
            "initializationOptions": { "clientProfile": "vscode", "extra": true },
        }))
        .unwrap();
        assert!(ClientBehaviorProfile::from_initialize_params(&unknown).is_err());
    }

    #[test]
    fn rejects_invalid_client_profile_with_an_initialize_error() {
        let root = fixture_root().canonicalize().unwrap();
        let (server_connection, client_connection) = Connection::memory();
        let server = thread::spawn(move || run_connection(server_connection, root));

        send_request(
            &client_connection,
            1,
            "initialize",
            json!({
                "processId": null,
                "clientInfo": { "name": "Visual Studio Code", "version": "test" },
                "capabilities": {},
                "initializationOptions": { "clientProfile": "zed" },
            }),
        );
        let response = receive_raw_response(&client_connection);
        assert_eq!(response.id, RequestId::from(1));
        assert_eq!(
            response.error.unwrap().code,
            ErrorCode::InvalidParams as i32
        );
        server.join().unwrap().unwrap();
    }

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
    fn loads_each_reference_source_once_per_request() {
        let mut reads = BTreeMap::<String, usize>::new();
        let sources = load_source_cache(["a.md", "a.md", "b.md", "a.md"], |path| {
            *reads.entry(path.to_string()).or_default() += 1;
            Ok(format!("source for {path}"))
        })
        .unwrap();

        assert_eq!(reads.get("a.md"), Some(&1));
        assert_eq!(reads.get("b.md"), Some(&1));
        assert_eq!(
            sources.get("a.md").map(String::as_str),
            Some("source for a.md")
        );
        assert_eq!(
            sources.get("b.md").map(String::as_str),
            Some("source for b.md")
        );
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
        assert!(
            server
                .hover(
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
    fn publishes_updates_deduplicates_and_clears_document_diagnostics() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("notes/lsp-diagnostics.md"));
        let invalid = "---\ntitle: Diagnostics\nsummary: \"\"\n---\n\nSee 😀 [[missing]].\n";

        let opened = server
            .handle_notification(Notification {
                method: "textDocument/didOpen".to_string(),
                params: json!({
                    "textDocument": {
                        "uri": source_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": invalid,
                    }
                }),
            })
            .unwrap();
        assert_eq!(opened.len(), 1);
        let published: PublishDiagnosticsParams =
            serde_json::from_value(opened[0].params.clone()).unwrap();
        assert_eq!(published.version, Some(1));
        assert_eq!(published.diagnostics.len(), 1);
        assert_eq!(
            published.diagnostics[0].code,
            Some(lsp_types::NumberOrString::String(
                "reference.unresolved".to_string()
            ))
        );
        let missing_start = position_at_offset(invalid, invalid.find("missing").unwrap());
        assert_eq!(published.diagnostics[0].range.start, missing_start);

        let repeated = server
            .handle_notification(Notification {
                method: "textDocument/didChange".to_string(),
                params: json!({
                    "textDocument": { "uri": source_uri, "version": 1 },
                    "contentChanges": [{ "text": invalid }],
                }),
            })
            .unwrap();
        assert!(repeated.is_empty());

        let valid = "---\ntitle: Diagnostics\nsummary: \"\"\n---\n\nSee [[members/sam-rivera]].\n";
        let cleared = server
            .handle_notification(Notification {
                method: "textDocument/didChange".to_string(),
                params: json!({
                    "textDocument": { "uri": source_uri, "version": 2 },
                    "contentChanges": [{ "text": valid }],
                }),
            })
            .unwrap();
        assert_eq!(cleared.len(), 1);
        let cleared: PublishDiagnosticsParams =
            serde_json::from_value(cleared[0].params.clone()).unwrap();
        assert_eq!(cleared.version, Some(2));
        assert!(cleared.diagnostics.is_empty());

        let reopened = server
            .handle_notification(Notification {
                method: "textDocument/didChange".to_string(),
                params: json!({
                    "textDocument": { "uri": source_uri, "version": 3 },
                    "contentChanges": [{ "text": invalid }],
                }),
            })
            .unwrap();
        assert_eq!(reopened.len(), 1);
        let closed = server
            .handle_notification(Notification {
                method: "textDocument/didClose".to_string(),
                params: json!({ "textDocument": { "uri": source_uri } }),
            })
            .unwrap();
        assert_eq!(closed.len(), 1);
        let closed: PublishDiagnosticsParams =
            serde_json::from_value(closed[0].params.clone()).unwrap();
        assert_eq!(closed.version, None);
        assert!(closed.diagnostics.is_empty());
    }

    #[test]
    fn publishes_a_linked_advisory_for_mismatched_editor_extension_versions() {
        let root = fixture_root().canonicalize().unwrap();
        for (profile, integration_name) in [
            (ClientBehaviorProfile::Zed, "Forma for Zed"),
            (ClientBehaviorProfile::Vscode, "Forma for VS Code"),
        ] {
            let mut server = Server::new_with_client_profile(root.clone(), profile).unwrap();
            server.expected_extension_version = Some("9.9.9".to_string());

            let notifications = server
                .handle_notification(Notification {
                    method: "initialized".to_string(),
                    params: json!({}),
                })
                .unwrap();

            assert_eq!(notifications.len(), 1);
            let published: PublishDiagnosticsParams =
                serde_json::from_value(notifications[0].params.clone()).unwrap();
            assert_eq!(published.uri, file_uri(root.join(".forma.md")));
            assert_eq!(published.version, None);
            assert_eq!(published.diagnostics.len(), 1);
            let diagnostic = &published.diagnostics[0];
            assert_eq!(
                diagnostic.range,
                Range::new(Position::new(0, 0), Position::new(0, 1))
            );
            assert_eq!(
                diagnostic.code,
                Some(lsp_types::NumberOrString::String(
                    "forma.cliVersionMismatch".to_string()
                ))
            );
            assert_eq!(
                diagnostic.severity,
                Some(lsp_types::DiagnosticSeverity::WARNING)
            );
            assert!(diagnostic.message.contains(forma_core::version()));
            assert!(diagnostic.message.contains("9.9.9"));
            assert!(diagnostic.message.contains(integration_name));
            assert_eq!(
                diagnostic
                    .code_description
                    .as_ref()
                    .map(|description| description.href.as_str()),
                Some("https://github.com/choral-io/choral-forma#installing-forma")
            );

            let repeated = server
                .handle_notification(Notification {
                    method: "initialized".to_string(),
                    params: json!({}),
                })
                .unwrap();
            assert!(repeated.is_empty());
        }

        let mut matching =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Zed).unwrap();
        matching.expected_extension_version = Some(forma_core::version().to_string());
        assert!(
            matching
                .handle_notification(Notification {
                    method: "initialized".to_string(),
                    params: json!({}),
                })
                .unwrap()
                .is_empty()
        );

        let mut generic = Server::new(root).unwrap();
        generic.expected_extension_version = Some("9.9.9".to_string());
        assert!(
            generic
                .handle_notification(Notification {
                    method: "initialized".to_string(),
                    params: json!({}),
                })
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn isolates_content_and_version_diagnostics_by_uri() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Zed).unwrap();
        server.expected_extension_version = Some("9.9.9".to_string());
        let config_uri = file_uri(root.join(".forma.md"));
        let first_uri = file_uri(root.join("notes/first-diagnostic.md"));
        let second_uri = file_uri(root.join("notes/second-diagnostic.md"));
        server
            .handle_notification(Notification {
                method: "initialized".to_string(),
                params: json!({}),
            })
            .unwrap();
        for (uri, version) in [(&first_uri, 1), (&second_uri, 1)] {
            server
                .handle_notification(Notification {
                    method: "textDocument/didOpen".to_string(),
                    params: json!({
                        "textDocument": {
                            "uri": uri,
                            "languageId": "markdown",
                            "version": version,
                            "text": "---\ntitle: Diagnostic\nsummary: \"\"\n---\n\n[[missing]]\n",
                        }
                    }),
                })
                .unwrap();
        }
        assert_eq!(server.published_diagnostics.len(), 3);
        assert!(server.published_diagnostics.contains_key(&config_uri));
        assert!(server.published_diagnostics.contains_key(&first_uri));
        assert!(server.published_diagnostics.contains_key(&second_uri));

        server
            .handle_notification(Notification {
                method: "textDocument/didChange".to_string(),
                params: json!({
                    "textDocument": { "uri": first_uri, "version": 2 },
                    "contentChanges": [{
                        "text": "---\ntitle: Diagnostic\nsummary: \"\"\n---\n\n[[members/sam-rivera]]\n"
                    }],
                }),
            })
            .unwrap();
        assert_eq!(server.published_diagnostics.len(), 2);
        assert!(server.published_diagnostics.contains_key(&config_uri));
        assert!(server.published_diagnostics.contains_key(&second_uri));

        server
            .handle_notification(Notification {
                method: "textDocument/didClose".to_string(),
                params: json!({ "textDocument": { "uri": second_uri } }),
            })
            .unwrap();
        assert_eq!(server.published_diagnostics.len(), 1);
        assert!(server.published_diagnostics.contains_key(&config_uri));
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
                .is_none()
        );
        let links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": page_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(links.len(), 1);
        assert!(
            links[0]
                .target
                .as_ref()
                .unwrap()
                .as_str()
                .ends_with("/members/sam-rivera.md")
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
    fn uses_zed_definition_fallback_for_markdown_fragment_links() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Zed).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-navigation-ownership.md"));
        let source = "[Native](../members/sam-rivera.md#sam-rivera)\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let reference = &server
            .session
            .document_analysis("tasks/lsp-navigation-ownership.md")
            .unwrap()
            .references[0];
        assert_eq!(
            definition_ownership(ClientBehaviorProfile::Zed, reference),
            DefinitionOwnership::MarkdownFragmentFallback
        );

        let markdown_label = definition_links_at(&server, source_uri.clone(), source, "Native", 2);
        let markdown_target = definition_links_at(
            &server,
            source_uri.clone(),
            source,
            "../members/sam-rivera.md",
            2,
        );
        let markdown_fragment = definition_links_at(&server, source_uri, source, "#sam-rivera", 2);
        assert_eq!(markdown_label.len(), 1);
        assert_eq!(markdown_target.len(), 1);
        assert_eq!(markdown_fragment.len(), 1);
        assert_eq!(markdown_label[0].target_uri, markdown_target[0].target_uri);
        assert_eq!(
            markdown_label[0].target_uri,
            markdown_fragment[0].target_uri
        );
        assert!(
            markdown_label[0]
                .target_uri
                .as_str()
                .ends_with("/members/sam-rivera.md")
        );
        assert!(markdown_label[0].target_range.start < markdown_label[0].target_range.end);
    }

    #[test]
    fn leaves_plain_markdown_links_to_native_navigation() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-navigation-ownership.md"));
        let source = "[Plain](../members/sam-rivera.md)\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let reference = &server
            .session
            .document_analysis("tasks/lsp-navigation-ownership.md")
            .unwrap()
            .references[0];
        assert_eq!(
            definition_ownership(ClientBehaviorProfile::Generic, reference),
            DefinitionOwnership::NativeMarkdown
        );
        assert!(definition_links_at(&server, source_uri.clone(), source, "Plain", 2).is_empty());
        assert!(
            definition_links_at(&server, source_uri, source, "../members/sam-rivera.md", 2)
                .is_empty()
        );
    }

    #[test]
    fn leaves_markdown_fragment_links_to_native_navigation_for_conservative_clients() {
        let root = fixture_root().canonicalize().unwrap();
        let source = "[Native](../members/sam-rivera.md#sam-rivera)\n";
        for profile in [
            ClientBehaviorProfile::Generic,
            ClientBehaviorProfile::Vscode,
        ] {
            let mut server = Server::new_with_client_profile(root.clone(), profile).unwrap();
            let source_uri = file_uri(root.join("tasks/lsp-navigation-ownership.md"));
            open_markdown_source(&mut server, source_uri.clone(), source);
            let reference = &server
                .session
                .document_analysis("tasks/lsp-navigation-ownership.md")
                .unwrap()
                .references[0];
            assert_eq!(
                definition_ownership(profile, reference),
                DefinitionOwnership::NativeMarkdown
            );
            assert!(definition_links_at(&server, source_uri, source, "#sam-rivera", 2).is_empty());
        }
    }

    #[test]
    fn navigates_wikilink_target_fragment_and_alias() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-navigation-ownership.md"));
        let source =
            "[[members/sam-rivera#Sam Rivera|Sam]]\n[[members/sam-rivera#Missing|Missing]]\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        assert!(definition_links_at(&server, source_uri.clone(), source, "[[", 0).is_empty());
        assert!(definition_links_at(&server, source_uri.clone(), source, "]]", 1).is_empty());

        let target =
            definition_links_at(&server, source_uri.clone(), source, "members/sam-rivera", 2);
        let fragment = definition_links_at(&server, source_uri.clone(), source, "#Sam Rivera", 2);
        let alias = definition_links_at(&server, source_uri.clone(), source, "|Sam", 2);
        assert_eq!(target.len(), 1);
        assert_eq!(target[0].target_uri, fragment[0].target_uri);
        assert_eq!(target[0].target_uri, alias[0].target_uri);
        assert_eq!(target[0].target_range, fragment[0].target_range);
        assert_eq!(target[0].target_range, alias[0].target_range);
        assert!(target[0].target_range.start < target[0].target_range.end);
        assert_eq!(
            target[0].origin_selection_range.unwrap().start,
            position_at_offset(source, source.find("members/sam-rivera").unwrap())
        );
        assert_eq!(
            alias[0].origin_selection_range.unwrap().start,
            position_at_offset(source, source.find("|Sam").unwrap() + 1)
        );
        assert!(definition_links_at(&server, source_uri, source, "|Missing", 2).is_empty());
    }

    #[test]
    fn opens_positionless_zed_wikilinks_without_forcing_a_target_selection() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Zed).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-positionless-navigation.md"));
        let source = "[[members/sam-rivera|Sam]]\n[[members/sam-rivera#Sam Rivera|Heading]]\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri.clone() } }))
                    .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(links.len(), 2);
        assert_eq!(
            links
                .iter()
                .map(
                    |link| &source[offset_at_position(source, link.range.start).unwrap()
                        ..offset_at_position(source, link.range.end).unwrap()]
                )
                .collect::<Vec<_>>(),
            vec!["members/sam-rivera", "Sam"]
        );
        assert!(links.iter().all(|link| {
            let target = link.target.as_ref().unwrap().as_str();
            target.starts_with("zed://file/") && target.ends_with("/members/sam-rivera.md")
        }));

        assert!(
            definition_links_at(&server, source_uri.clone(), source, "members/sam-rivera", 2,)
                .is_empty()
        );
        assert!(definition_links_at(&server, source_uri.clone(), source, "|Sam", 2).is_empty());
        assert_eq!(
            definition_links_at(&server, source_uri.clone(), source, "#Sam Rivera", 2).len(),
            1
        );
        assert_eq!(
            definition_links_at(&server, source_uri, source, "|Heading", 2).len(),
            1
        );
    }

    #[test]
    fn provides_positionless_wikilink_definitions_for_vscode() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Vscode).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-positionless-navigation.md"));
        let source = "[[members/sam-rivera|Sam]]\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let target =
            definition_links_at(&server, source_uri.clone(), source, "members/sam-rivera", 2);
        let alias = definition_links_at(&server, source_uri, source, "|Sam", 2);
        assert_eq!(target.len(), 1);
        assert_eq!(alias.len(), 1);
        assert_eq!(target[0].target_uri, alias[0].target_uri);
        assert!(
            target[0]
                .target_uri
                .as_str()
                .ends_with("/members/sam-rivera.md")
        );
    }

    #[cfg(unix)]
    #[test]
    fn preserves_editor_visible_uris_for_symlinked_workspace_roots() {
        use std::os::unix::fs::symlink;

        let root = fixture_root().canonicalize().unwrap();
        let alias_parent = temporary_path("uri-alias");
        fs::create_dir_all(&alias_parent).unwrap();
        let editor_root = alias_parent.join("workspace");
        symlink(&root, &editor_root).unwrap();
        let mut server = Server::new_with_client_profile_and_editor_root(
            root,
            editor_root.clone(),
            ClientBehaviorProfile::Vscode,
        )
        .unwrap();
        let source_path = editor_root.join("tasks/lsp-positionless-navigation.md");
        let source_uri = raw_file_uri(source_path);
        let source = "[[members/sam-rivera|Sam]]\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let target = definition_links_at(&server, source_uri, source, "members/sam-rivera", 2);
        assert_eq!(target.len(), 1);
        assert!(target[0].target_uri.as_str().contains(&format!(
            "/{}/workspace/members/sam-rivera.md",
            alias_parent.file_name().unwrap().to_string_lossy()
        )));
        fs::remove_dir_all(alias_parent).unwrap();
    }

    #[test]
    fn projects_links_from_inline_and_markdown_fenced_code() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Zed).unwrap();
        let source_uri = file_uri(root.join("tasks/lsp-code-inert.md"));
        let source = "Inline `[Sam](../members/sam-rivera.md#sam-rivera)`, `[[members/sam-rivera]]`, and `![[members/sam-rivera]]`.\n\n```rust\nlet literal = \"[[members/sam-rivera]]\";\n```\n\n```md\n[Sam](../members/sam-rivera.md#sam-rivera)\n[[members/sam-rivera#Sam Rivera|Sam]]\n```\n\n```markdown\n[Mira](../members/mira-chen.md)\n[[members/mira-chen|Mira]]\n```\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let target_offsets = source
            .match_indices("members/sam-rivera")
            .map(|(offset, _)| offset)
            .collect::<Vec<_>>();
        assert_eq!(target_offsets.len(), 6);
        for offset in target_offsets {
            let position = position_at_offset(source, offset);
            assert!(
                definition_links(
                    &server,
                    source_uri.clone(),
                    position.line,
                    position.character,
                )
                .is_empty()
            );
        }

        let analysis = server
            .session
            .document_analysis("tasks/lsp-code-inert.md")
            .unwrap();
        assert!(analysis.references.is_empty());
        let links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri.clone() } }))
                    .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(links.len(), 12);
        assert_eq!(
            links
                .iter()
                .map(
                    |link| &source[offset_at_position(source, link.range.start).unwrap()
                        ..offset_at_position(source, link.range.end).unwrap()]
                )
                .collect::<Vec<_>>(),
            vec![
                "../members/sam-rivera.md#sam-rivera",
                "Sam",
                "members/sam-rivera",
                "members/sam-rivera",
                "../members/sam-rivera.md#sam-rivera",
                "Sam",
                "members/sam-rivera#Sam Rivera",
                "Sam",
                "../members/mira-chen.md",
                "Mira",
                "members/mira-chen",
                "Mira",
            ]
        );
        let sam_target = links[0].target.as_ref().unwrap().as_str();
        assert!(sam_target.starts_with("file://"));
        assert!(sam_target.contains("/members/sam-rivera.md#L"));
        assert_eq!(links[1].target.as_ref().unwrap().as_str(), sam_target);
        assert!(
            links[2]
                .target
                .as_ref()
                .unwrap()
                .as_str()
                .starts_with("zed://file/")
        );
        assert!(
            links[2]
                .target
                .as_ref()
                .unwrap()
                .as_str()
                .ends_with("/members/sam-rivera.md")
        );
        assert_eq!(links[3].target, links[2].target);
        let mira_target = links[8].target.as_ref().unwrap().as_str();
        assert!(mira_target.starts_with("zed://file/"));
        assert!(mira_target.ends_with("/members/mira-chen.md"));
        assert_eq!(links[9].target.as_ref().unwrap().as_str(), mira_target);
    }

    #[test]
    fn keeps_code_example_navigation_zed_only() {
        let root = fixture_root().canonicalize().unwrap();
        let source = "[[members/sam-rivera]] `[[members/sam-rivera]]`\n\n```md\n[[members/sam-rivera]]\n```\n";
        for profile in [
            ClientBehaviorProfile::Generic,
            ClientBehaviorProfile::Vscode,
        ] {
            let mut server = Server::new_with_client_profile(root.clone(), profile).unwrap();
            let source_uri = file_uri(root.join("tasks/lsp-code-inert.md"));
            open_markdown_source(&mut server, source_uri.clone(), source);
            let links = server
                .document_links(
                    serde_json::from_value(json!({ "textDocument": { "uri": source_uri } }))
                        .unwrap(),
                )
                .unwrap()
                .unwrap();
            assert_eq!(links.len(), 1);
            assert!(
                links[0]
                    .target
                    .as_ref()
                    .is_some_and(|target| target.as_str().starts_with("file://"))
            );
            let inline_position = position_at_offset(source, source.find('`').unwrap() + 3);
            assert!(
                server
                    .hover(
                        serde_json::from_value(json!({
                            "textDocument": { "uri": source_uri },
                            "position": inline_position,
                        }))
                        .unwrap(),
                    )
                    .unwrap()
                    .is_none()
            );
        }
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
        let hover = hover_at(&server, source_uri.clone(), source, "topics/target", 2).unwrap();
        assert!(hover_markdown(&hover).contains("topics/target.md"));
        assert!(hover_markdown(&hover).contains("Target heading"));
        assert!(definition_links(&server, source_uri, 0, 45).is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn emits_document_links_for_positionless_external_and_local_wikilinks() {
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
        assert_eq!(links.len(), 6);
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
        assert!(
            links[4]
                .target
                .as_ref()
                .is_some_and(|target| target.as_str().ends_with("/members/sam-rivera.md"))
        );
        assert!(
            hover_at(
                &server,
                source_uri.clone(),
                source,
                "../assets/markdown-hero.png",
                2,
            )
            .is_none()
        );
        assert!(hover_at(&server, source_uri, source, "https://example.com", 2).is_none());
    }

    #[test]
    fn serves_initialize_full_text_overlays_definition_hover_and_document_links() {
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
                "clientInfo": { "name": "Zed", "version": "test" },
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
        assert_eq!(capabilities["referencesProvider"], true);
        assert_eq!(capabilities["hoverProvider"], true);
        assert_eq!(capabilities["completionProvider"]["resolveProvider"], false);
        assert_eq!(
            capabilities["documentLinkProvider"]["resolveProvider"],
            false
        );
        assert!(capabilities.get("semanticTokensProvider").is_none());

        send_notification(&client_connection, "initialized", json!({}));
        assert_no_server_message(&client_connection);
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
                .unwrap()
                .as_str()
                .starts_with("zed://file/")
                && link
                    .target
                    .as_ref()
                    .unwrap()
                    .as_str()
                    .ends_with("/members/sam-rivera.md")
        }));

        send_request(
            &client_connection,
            9,
            "textDocument/hover",
            json!({
                "textDocument": { "uri": source_uri },
                "position": { "line": 5, "character": 10 },
            }),
        );
        let hover: Option<Hover> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        assert!(hover_markdown(&hover.unwrap()).contains("members/sam-rivera.md"));

        send_request(
            &client_connection,
            11,
            "textDocument/references",
            json!({
                "textDocument": { "uri": source_uri },
                "position": { "line": 5, "character": 10 },
                "context": { "includeDeclaration": false },
            }),
        );
        let references: Option<Vec<Location>> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        assert!(!references.unwrap().is_empty());

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
                .unwrap()
                .as_str()
                .ends_with("/members/mira-chen.md")
        }));

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
    fn transports_push_diagnostics_over_the_lsp_connection() {
        let root = fixture_root().canonicalize().unwrap();
        let source_uri = file_uri(root.join("notes/lsp-push-diagnostics.md"));
        let root_uri = file_uri(root.clone());
        let (server_connection, client_connection) = Connection::memory();
        let server = thread::spawn(move || run_connection(server_connection, root));

        send_request(
            &client_connection,
            30,
            "initialize",
            json!({
                "processId": null,
                "clientInfo": { "name": "Zed", "version": "test" },
                "capabilities": {},
                "rootUri": root_uri,
            }),
        );
        receive_response(&client_connection);
        send_notification(&client_connection, "initialized", json!({}));
        assert_no_server_message(&client_connection);

        send_notification(
            &client_connection,
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": source_uri,
                    "languageId": "markdown",
                    "version": 1,
                    "text": "---\ntitle: Diagnostics\nsummary: \"\"\n---\n\n[[missing]]\n",
                }
            }),
        );
        let published = receive_server_notification(&client_connection);
        assert_eq!(published.method, "textDocument/publishDiagnostics");
        let params: PublishDiagnosticsParams = serde_json::from_value(published.params).unwrap();
        assert_eq!(params.version, Some(1));
        assert_eq!(params.diagnostics.len(), 1);

        send_notification(
            &client_connection,
            "textDocument/didChange",
            json!({
                "textDocument": { "uri": source_uri, "version": 2 },
                "contentChanges": [{
                    "text": "---\ntitle: Diagnostics\nsummary: \"\"\n---\n\n[[members/sam-rivera]]\n"
                }],
            }),
        );
        let cleared = receive_server_notification(&client_connection);
        let params: PublishDiagnosticsParams = serde_json::from_value(cleared.params).unwrap();
        assert_eq!(params.version, Some(2));
        assert!(params.diagnostics.is_empty());

        send_request(&client_connection, 31, "shutdown", serde_json::Value::Null);
        receive_response(&client_connection);
        send_notification(&client_connection, "exit", serde_json::Value::Null);
        server.join().unwrap().unwrap();
    }

    #[test]
    fn transports_initialization_options_into_the_initialized_advisory() {
        let root = fixture_root().canonicalize().unwrap();
        let config_uri = file_uri(root.join(".forma.md"));
        let root_uri = file_uri(root.clone());
        let (server_connection, client_connection) = Connection::memory();
        let server = thread::spawn(move || run_connection(server_connection, root));

        send_request(
            &client_connection,
            32,
            "initialize",
            json!({
                "processId": null,
                "clientInfo": { "name": "Zed", "version": "test" },
                "capabilities": {},
                "initializationOptions": {
                    "clientProfile": "zed",
                    "extensionVersion": "9.9.9"
                },
                "rootUri": root_uri,
            }),
        );
        receive_response(&client_connection);
        send_notification(&client_connection, "initialized", json!({}));
        let published = receive_server_notification(&client_connection);
        let params: PublishDiagnosticsParams = serde_json::from_value(published.params).unwrap();
        assert_eq!(params.uri, config_uri);
        assert_eq!(params.diagnostics.len(), 1);
        assert_eq!(
            params.diagnostics[0].code,
            Some(lsp_types::NumberOrString::String(
                "forma.cliVersionMismatch".to_string()
            ))
        );
        assert_eq!(
            params.diagnostics[0].range,
            Range::new(Position::new(0, 0), Position::new(0, 1))
        );

        send_request(&client_connection, 33, "shutdown", serde_json::Value::Null);
        receive_response(&client_connection);
        send_notification(&client_connection, "exit", serde_json::Value::Null);
        server.join().unwrap().unwrap();
    }

    #[test]
    fn serves_configured_view_overlays_without_changing_saved_scope() {
        let root = copied_fixture("configured-view-protocol");
        let view_path = root.join(".forma/views/lsp-protocol.md");
        let saved = "---\nschemaVersion: 1\nkind: view\nmode: list\ntitle: Saved LSP View\nsource:\n  type: pages\n---\n\n# Saved LSP View\n\nSee [[members/sam-rivera|Sam]].\n";
        fs::write(&view_path, saved).unwrap();
        let root = root.canonicalize().unwrap();
        let view_uri = file_uri(view_path);
        let root_uri = file_uri(root.clone());
        let (server_connection, client_connection) = Connection::memory();
        let server_root = root.clone();
        let server = thread::spawn(move || run_connection(server_connection, server_root));

        send_request(
            &client_connection,
            20,
            "initialize",
            json!({
                "processId": null,
                "capabilities": {},
                "rootUri": root_uri,
            }),
        );
        receive_response(&client_connection);
        send_notification(&client_connection, "initialized", json!({}));
        assert_no_server_message(&client_connection);

        let overlay = "---\nschemaVersion: 1\nkind: view\nmode: list\ntitle: Unsaved LSP View\nsource:\n  type: pages\n---\n\n# Unsaved LSP View\n\nSee [[members/mira-chen#Mira Chen|Mira]].\n";
        let link_line = overlay
            .lines()
            .position(|line| line.contains("[[members/mira-chen"))
            .unwrap() as u32;
        let link_source = overlay.lines().nth(link_line as usize).unwrap();
        let alias_character = (link_source.find("|Mira").unwrap() + 2) as u32;
        send_notification(
            &client_connection,
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": view_uri,
                    "languageId": "markdown",
                    "version": 1,
                    "text": overlay,
                }
            }),
        );

        send_request(
            &client_connection,
            21,
            "textDocument/definition",
            json!({
                "textDocument": { "uri": view_uri },
                "position": { "line": link_line, "character": alias_character },
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
        assert!(locations[0].target_range.start < locations[0].target_range.end);

        send_request(
            &client_connection,
            23,
            "textDocument/documentLink",
            json!({ "textDocument": { "uri": view_uri } }),
        );
        let links: Option<Vec<DocumentLink>> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        assert!(links.unwrap().is_empty());

        send_notification(
            &client_connection,
            "textDocument/didSave",
            json!({
                "textDocument": { "uri": view_uri },
                "text": overlay,
            }),
        );
        send_request(
            &client_connection,
            24,
            "textDocument/definition",
            json!({
                "textDocument": { "uri": view_uri },
                "position": { "line": link_line, "character": alias_character },
            }),
        );
        let definition: Option<GotoDefinitionResponse> =
            serde_json::from_value(receive_response(&client_connection).result.unwrap()).unwrap();
        let GotoDefinitionResponse::Link(locations) = definition.unwrap() else {
            panic!("expected the configured View to remain managed after save");
        };
        assert!(
            locations[0]
                .target_uri
                .as_str()
                .ends_with("/members/mira-chen.md")
        );

        send_notification(
            &client_connection,
            "textDocument/didClose",
            json!({ "textDocument": { "uri": view_uri } }),
        );
        send_request(&client_connection, 25, "shutdown", serde_json::Value::Null);
        receive_response(&client_connection);
        send_notification(&client_connection, "exit", serde_json::Value::Null);
        server.join().unwrap().unwrap();
        fs::remove_dir_all(root).unwrap();
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
        assert_no_server_message(&client_connection);
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
    fn hovers_resolved_unresolved_and_ambiguous_forma_references() {
        let root = copied_fixture("reference-hover");
        for directory in ["notes/a", "notes/b"] {
            fs::create_dir_all(root.join(directory)).unwrap();
            fs::write(
                root.join(directory).join("same.md"),
                format!("---\ntitle: {directory}\nsummary: \"\"\n---\n\n# Same\n"),
            )
            .unwrap();
        }
        fs::write(
            root.join("notes/multiline.md"),
            "---\ntitle: |-\n  Multi\n  Line\nsummary: \"\"\n---\n\n# Multi Line\n",
        )
        .unwrap();
        let root = root.canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("notes/hover.md"));
        let source = "---\ntitle: Hover\nsummary: \"\"\n---\n\n[[members/sam-rivera|Sam]]\n😀 ![[members/sam-rivera#Sam Rivera|Portrait]]\n[[missing]]\n[[same]]\n[[notes/multiline]]\n";
        open_markdown_source(&mut server, source_uri.clone(), source);
        let analyses = server.session.document_analysis_count();
        let builds = server.session.snapshot_build_count();

        let resolved =
            hover_at(&server, source_uri.clone(), source, "members/sam-rivera", 2).unwrap();
        let resolved_markdown = hover_markdown(&resolved);
        assert!(resolved_markdown.contains("Forma wikilink"));
        assert!(resolved_markdown.contains("Sam Rivera"));
        assert!(resolved_markdown.contains("members/sam-rivera.md"));

        let fragment = hover_at(&server, source_uri.clone(), source, "#Sam Rivera", 2).unwrap();
        assert!(hover_markdown(&fragment).contains("Fragment: `Sam Rivera`"));
        let label = hover_at(&server, source_uri.clone(), source, "|Portrait", 2).unwrap();
        assert!(hover_markdown(&label).contains("Forma embed"));
        assert_eq!(
            label.range.unwrap().start,
            position_at_offset(source, source.find("Portrait").unwrap())
        );

        let unresolved = hover_at(&server, source_uri.clone(), source, "missing", 2).unwrap();
        let unresolved_markdown = hover_markdown(&unresolved);
        assert!(unresolved_markdown.contains("reference.unresolved"));
        assert!(unresolved_markdown.contains("Reference cannot be resolved"));

        let ambiguous = hover_at(&server, source_uri.clone(), source, "same", 2).unwrap();
        let ambiguous_markdown = hover_markdown(&ambiguous);
        assert!(ambiguous_markdown.contains("reference.ambiguous"));
        assert!(ambiguous_markdown.contains("notes/a/same.md"));
        assert!(ambiguous_markdown.contains("notes/b/same.md"));

        let multiline =
            hover_at(&server, source_uri.clone(), source, "notes/multiline", 2).unwrap();
        assert!(hover_markdown(&multiline).contains("### Multi Line"));
        assert!(!hover_markdown(&multiline).contains("### Multi\nLine"));

        assert_eq!(server.session.document_analysis_count(), analyses);
        assert_eq!(server.session.snapshot_build_count(), builds);

        let changed = "---\ntitle: Hover\nsummary: \"\"\n---\n\nSee [[members/mira-chen|Mira]].\n";
        server
            .change_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri, "version": 2 },
                    "contentChanges": [{ "text": changed }],
                }))
                .unwrap(),
            )
            .unwrap();
        let overlay = hover_at(
            &server,
            file_uri(root.join("notes/hover.md")),
            changed,
            "members/mira-chen",
            2,
        )
        .unwrap();
        assert!(hover_markdown(&overlay).contains("Mira Chen"));
        assert_eq!(server.session.snapshot_build_count(), builds);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn resolves_explicit_mdx_references_for_hover_definition_and_fragments() {
        let root = copied_fixture("explicit-mdx-lsp-navigation");
        let members_space_path = root.join(".forma/spaces/members.md");
        let members_space = fs::read_to_string(&members_space_path).unwrap();
        fs::write(
            &members_space_path,
            members_space.replace("members/**/*.md", "members/**/*"),
        )
        .unwrap();
        fs::write(
            root.join("members/mdx-person.mdx"),
            "---\nname: MDX Person\ndescription: \"\"\n---\n\n# MDX Person\n\n## Profile\n",
        )
        .unwrap();

        let root = root.canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/mdx-navigation.md"));
        let source = "[[members/mdx-person.mdx#Profile|MDX profile]]\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let reference = &server
            .session
            .document_analysis("tasks/mdx-navigation.md")
            .unwrap()
            .references[0];
        assert!(
            server
                .local_resource_uri("tasks/mdx-navigation.md", reference)
                .is_none()
        );

        let hover = hover_at(
            &server,
            source_uri.clone(),
            source,
            "members/mdx-person.mdx",
            2,
        )
        .unwrap();
        assert!(hover_markdown(&hover).contains("MDX Person"));
        assert!(hover_markdown(&hover).contains("members/mdx-person.mdx"));
        assert!(hover_markdown(&hover).contains("Fragment: `Profile`"));

        let target = definition_links_at(
            &server,
            source_uri.clone(),
            source,
            "members/mdx-person.mdx",
            2,
        );
        let fragment = definition_links_at(&server, source_uri, source, "#Profile", 2);
        assert_eq!(target.len(), 1);
        assert_eq!(fragment.len(), 1);
        assert_eq!(target[0].target_uri, fragment[0].target_uri);
        assert!(
            target[0]
                .target_uri
                .as_str()
                .ends_with("/members/mdx-person.mdx")
        );
        assert_eq!(target[0].target_range, fragment[0].target_range);
        assert!(target[0].target_range.start < target[0].target_range.end);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn hovers_schema_declared_entry_references_but_not_ordinary_markdown_links() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/hover-entry-ref.md"));
        let source = "---\ntitle: Hover\nsummary: ordinary text\nowners:\n  - members/sam-rivera\n---\n\n[Sam](../members/sam-rivera.md)\n";
        open_markdown_source(&mut server, source_uri.clone(), source);

        let owner = hover_at(&server, source_uri.clone(), source, "members/sam-rivera", 2).unwrap();
        let owner_markdown = hover_markdown(&owner);
        assert!(owner_markdown.contains("Forma entry reference"));
        assert!(owner_markdown.contains("Field: `owners`"));

        assert!(hover_at(&server, source_uri, source, "../members/sam-rivera.md", 2,).is_none());
    }

    #[test]
    fn completes_wikilink_targets_and_unsaved_fragments_with_utf16_text_edits() {
        let root = fixture_root().canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_uri = file_uri(root.join("tasks/completion.md"));
        let source = "---\r\ntitle: Completion\r\nsummary: \"\"\r\n---\r\n\r\n😀 [[Sam";
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
        let builds = server.session.snapshot_build_count();
        let analyses = server.session.document_analysis_count();
        let response = server
            .completion(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri },
                    "position": position_at_offset(source, source.len()),
                }))
                .unwrap(),
            )
            .unwrap()
            .unwrap();
        let CompletionResponse::Array(items) = response else {
            panic!("expected completion item array");
        };
        let sam = items
            .iter()
            .find(|item| {
                item.text_edit.as_ref().is_some_and(|edit| {
                    matches!(edit, CompletionTextEdit::Edit(edit) if edit.new_text == "members/sam-rivera")
                })
            })
            .expect("Sam Rivera completion should use its canonical path");
        assert_eq!(sam.label, "Sam Rivera");
        let CompletionTextEdit::Edit(edit) = sam.text_edit.as_ref().unwrap() else {
            panic!("expected a text edit");
        };
        assert_eq!(
            edit.range,
            Range::new(
                position_at_offset(source, source.len() - "Sam".len()),
                position_at_offset(source, source.len()),
            )
        );
        assert_eq!(server.session.snapshot_build_count(), builds);
        assert_eq!(server.session.document_analysis_count(), analyses);

        let target_uri = file_uri(root.join("members/sam-rivera.md"));
        let target =
            "---\nname: Sam Rivera\ndescription: \"\"\n---\n\n# Sam Rivera\n\n## Unsaved 目标 😀\n";
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": target_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": target,
                    }
                }))
                .unwrap(),
            )
            .unwrap();
        let fragment_source =
            "---\ntitle: Completion\nsummary: \"\"\n---\n\n[[members/sam-rivera#Uns";
        server
            .change_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri, "version": 2 },
                    "contentChanges": [{ "text": fragment_source }],
                }))
                .unwrap(),
            )
            .unwrap();
        let response = server
            .completion(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri },
                    "position": position_at_offset(fragment_source, fragment_source.len()),
                }))
                .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert!(matches!(
            response,
            CompletionResponse::Array(items)
                if items.iter().any(|item| item.label == "Unsaved 目标 😀")
        ));

        let entry_ref = "---\ntitle: Completion\nsummary: \"\"\nowners:\n  - Sam\n---\n";
        let entry_ref_cursor = entry_ref.find("\n---\n").unwrap();
        server
            .change_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri, "version": 3 },
                    "contentChanges": [{ "text": entry_ref }],
                }))
                .unwrap(),
            )
            .unwrap();
        let response = server
            .completion(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri },
                    "position": position_at_offset(entry_ref, entry_ref_cursor),
                }))
                .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert!(matches!(
            response,
            CompletionResponse::Array(items) if items.iter().any(|item| {
                matches!(
                    item.text_edit.as_ref(),
                    Some(CompletionTextEdit::Edit(edit))
                        if edit.new_text == "members/sam-rivera"
                )
            })
        ));

        let code = "---\ntitle: Completion\nsummary: \"\"\n---\n\n`[[Sam";
        server
            .change_document(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_uri, "version": 4 },
                    "contentChanges": [{ "text": code }],
                }))
                .unwrap(),
            )
            .unwrap();
        assert!(
            server
                .completion(
                    serde_json::from_value(json!({
                        "textDocument": { "uri": source_uri },
                        "position": position_at_offset(code, code.len()),
                    }))
                    .unwrap(),
                )
                .unwrap()
                .is_none()
        );
        assert!(super::server_capabilities().completion_provider.is_some());
    }

    #[test]
    fn finds_reference_locations_from_saved_and_unsaved_documents() {
        let root = copied_fixture("find-references");
        let source_a_path = root.join("tasks/reference-source-a.md");
        let source_b_path = root.join("tasks/reference-source-b.md");
        fs::write(
            &source_a_path,
            "---\ntitle: Source A\nsummary: \"\"\nowners: []\n---\n\n[[members/sam-rivera]]\n",
        )
        .unwrap();
        let source_b = "---\ntitle: Source B\nsummary: \"\"\nowners:\n  - members/sam-rivera\n---\n\n![[members/sam-rivera#Sam Rivera]]\n";
        fs::write(&source_b_path, source_b).unwrap();
        let root = root.canonicalize().unwrap();
        let mut server = Server::new(root.clone()).unwrap();
        let source_a_uri = file_uri(source_a_path);
        let overlay = "---\ntitle: Source A\nsummary: \"\"\nowners: []\n---\n\n😀 [[members/sam-rivera]] and [[members/sam-rivera#Sam Rivera]].\n[Native](../members/sam-rivera.md)\n";
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": source_a_uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": overlay,
                    }
                }))
                .unwrap(),
            )
            .unwrap();
        let builds = server.session.snapshot_build_count();
        let cursor = overlay.find("members/sam-rivera").unwrap() + 4;
        let locations = server
            .references(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_a_uri },
                    "position": position_at_offset(overlay, cursor),
                    "context": { "includeDeclaration": true },
                }))
                .unwrap(),
            )
            .unwrap()
            .unwrap();

        assert!(locations.len() >= 4);
        assert_eq!(
            locations
                .iter()
                .filter(|location| location.uri == source_a_uri)
                .count(),
            2
        );
        assert_eq!(
            locations
                .iter()
                .filter(|location| location.uri == file_uri(source_b_path.clone()))
                .count(),
            2
        );
        let first_start = overlay.find("members/sam-rivera").unwrap();
        assert!(locations.iter().any(|location| {
            location.uri == source_a_uri
                && location.range.start == position_at_offset(overlay, first_start)
        }));
        let without_declaration = server
            .references(
                serde_json::from_value(json!({
                    "textDocument": { "uri": source_a_uri },
                    "position": position_at_offset(overlay, cursor),
                    "context": { "includeDeclaration": false },
                }))
                .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(without_declaration, locations);
        assert_eq!(server.session.snapshot_build_count(), builds);

        let native_cursor = overlay.find("../members/sam-rivera.md").unwrap() + 5;
        assert!(
            server
                .references(
                    serde_json::from_value(json!({
                        "textDocument": { "uri": source_a_uri },
                        "position": position_at_offset(overlay, native_cursor),
                        "context": { "includeDeclaration": false },
                    }))
                    .unwrap(),
                )
                .unwrap()
                .unwrap()
                .is_empty()
        );
        assert!(super::server_capabilities().references_provider.is_some());
    }

    #[test]
    fn validates_the_getting_started_navigation_fixture_and_local_resources() {
        let root = fixture_root().canonicalize().unwrap();
        let server =
            Server::new_with_client_profile(root.clone(), ClientBehaviorProfile::Zed).unwrap();
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
        let inert_section_start = source
            .find("## Code Examples Stay Semantically Inert")
            .unwrap();
        assert!(
            analysis
                .references
                .iter()
                .all(|reference| reference.syntax_span.end_byte <= inert_section_start),
            "references inside inert code: {:?}",
            analysis
                .references
                .iter()
                .filter(|reference| reference.syntax_span.end_byte > inert_section_start)
                .map(|reference| &source
                    [reference.syntax_span.start_byte..reference.syntax_span.end_byte])
                .collect::<Vec<_>>()
        );

        let links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": source_uri } })).unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(links.len(), 18);
        assert_eq!(
            links
                .iter()
                .map(
                    |link| &source[offset_at_position(&source, link.range.start).unwrap()
                        ..offset_at_position(&source, link.range.end).unwrap()]
                )
                .collect::<Vec<_>>(),
            vec![
                "members/sam-rivera",
                "members/mira-chen",
                "Mira Chen",
                "members/sam-rivera",
                "../members/sam-rivera.md#sam-rivera",
                "Sam Rivera",
                "members/sam-rivera",
                "members/sam-rivera",
                "../members/sam-rivera.md",
                "Sam Rivera",
                "../members/sam-rivera.md#sam-rivera",
                "Sam Rivera",
                "https://forma.choral.io",
                "Choral Forma website",
                "members/sam-rivera",
                "members/sam-rivera#Sam Rivera",
                "Sam Rivera heading",
                "members/sam-rivera",
            ]
        );

        let image_document = file_uri(root.join("notes/markdown-reader.md"));
        let image_links = server
            .document_links(
                serde_json::from_value(json!({ "textDocument": { "uri": image_document } }))
                    .unwrap(),
            )
            .unwrap()
            .unwrap();
        assert_eq!(image_links.len(), 8);
        assert!(image_links.iter().all(|link| {
            link.target
                .as_ref()
                .is_some_and(|target| target.as_str().ends_with(".md"))
        }));
        assert!(image_links.iter().all(|link| {
            !link
                .target
                .as_ref()
                .unwrap()
                .as_str()
                .contains("markdown-hero.png")
        }));
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/getting-started-workspace")
    }

    fn copied_fixture(name: &str) -> PathBuf {
        let root = temporary_path(name);
        copy_dir(&fixture_root(), &root);
        root
    }

    fn temporary_path(name: &str) -> PathBuf {
        let unique = format!(
            "forma-lsp-{name}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        std::env::temp_dir().join(unique)
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

    fn raw_file_uri(path: PathBuf) -> Uri {
        url::Url::from_file_path(path)
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

    fn open_markdown_source(server: &mut Server, uri: Uri, source: &str) {
        server
            .open_document(
                serde_json::from_value(json!({
                    "textDocument": {
                        "uri": uri,
                        "languageId": "markdown",
                        "version": 1,
                        "text": source,
                    }
                }))
                .unwrap(),
            )
            .unwrap();
    }

    fn definition_links_at(
        server: &Server,
        uri: Uri,
        source: &str,
        needle: &str,
        inner_byte_offset: usize,
    ) -> Vec<LocationLink> {
        assert!(inner_byte_offset < needle.len());
        let needle_start = source
            .find(needle)
            .unwrap_or_else(|| panic!("expected source to contain {needle:?}"));
        let position = position_at_offset(source, needle_start + inner_byte_offset);
        definition_links(server, uri, position.line, position.character)
    }

    fn hover_at(
        server: &Server,
        uri: Uri,
        source: &str,
        needle: &str,
        inner_byte_offset: usize,
    ) -> Option<Hover> {
        assert!(inner_byte_offset < needle.len());
        let needle_start = source
            .find(needle)
            .unwrap_or_else(|| panic!("expected source to contain {needle:?}"));
        let position = position_at_offset(source, needle_start + inner_byte_offset);
        server
            .hover(
                serde_json::from_value(json!({
                    "textDocument": { "uri": uri },
                    "position": position,
                }))
                .unwrap(),
            )
            .unwrap()
    }

    fn hover_markdown(hover: &Hover) -> &str {
        match &hover.contents {
            HoverContents::Markup(markup) => &markup.value,
            _ => panic!("expected Markdown hover content"),
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

    #[track_caller]
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

    #[track_caller]
    fn receive_server_notification(connection: &Connection) -> Notification {
        match connection
            .receiver
            .recv_timeout(Duration::from_secs(2))
            .expect("expected server notification")
        {
            Message::Notification(notification) => notification,
            message => panic!("expected server notification, got {message:?}"),
        }
    }

    fn assert_no_server_message(connection: &Connection) {
        assert!(
            connection
                .receiver
                .recv_timeout(Duration::from_millis(100))
                .is_err(),
            "server sent a message before the protocol state allowed it"
        );
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
