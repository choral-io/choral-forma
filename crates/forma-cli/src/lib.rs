use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::net::SocketAddr;
use std::path::{Component, Path as FsPath, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, UNIX_EPOCH};

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
use clap::{Parser, Subcommand, ValueEnum};
use forma_rpc::{
    CheckRequest, ConfigInspectRequest, CreateRequest, Dispatcher, DocsGetRequest, DocsListRequest,
    InitRequest, InspectRequest, ListRequest, OperationRequest, ReferenceResolveRequest,
    SkillsGetRequest, SkillsListRequest, ViewRenderRequest, WorkspaceDashboardRequest,
    WorkspaceExplorerEntriesRequest, WorkspaceExplorerRequest, WorkspaceHealthRequest,
};
use include_dir::{Dir, include_dir};
use serde_json::Value as JsonValue;
use serde_yml::Value;

mod site;
mod static_html;

static WEBAPP_DIST: Dir<'_> = include_dir!("$OUT_DIR/webapp-dist");
static STATIC_WEBAPP_DIST: Dir<'_> = include_dir!("$OUT_DIR/webapp-static-dist");

const RPC_CACHE_VALIDATION_INTERVAL: Duration = Duration::from_millis(200);
const RPC_CACHE_MAX_RESPONSES: usize = 128;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct RpcCacheKey {
    method: String,
    params: String,
}

#[derive(Debug)]
struct CacheableRpcRequest {
    id: JsonValue,
    key: RpcCacheKey,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RpcCacheLease {
    generation: u64,
}

#[derive(Debug, Default)]
struct RpcResponseCache {
    generation: u64,
    responses: HashMap<RpcCacheKey, JsonValue>,
}

#[derive(Debug, Default)]
struct RpcCacheValidation {
    fingerprint: Option<u64>,
    last_validated: Option<Instant>,
    watch_set: Option<WorkspaceWatchSet>,
}

#[derive(Debug, Default)]
struct RpcCacheRuntime {
    responses: Mutex<RpcResponseCache>,
    validation: Mutex<RpcCacheValidation>,
}

#[derive(Debug)]
struct WorkspaceWatchSet {
    scan_plan: Arc<forma_core::WorkspaceScanPlan>,
}

impl RpcResponseCache {
    fn lease(&self) -> RpcCacheLease {
        RpcCacheLease {
            generation: self.generation,
        }
    }

    fn lookup(&self, request: &CacheableRpcRequest) -> Option<String> {
        let response = self.responses.get(&request.key)?.clone();
        response_with_rpc_id(response, request.id.clone())
    }

    fn store(
        &mut self,
        lease: RpcCacheLease,
        request: CacheableRpcRequest,
        response: JsonValue,
    ) -> bool {
        if lease.generation != self.generation || response.get("result").is_none() {
            return false;
        }
        if self.responses.len() >= RPC_CACHE_MAX_RESPONSES {
            self.responses.clear();
        }
        self.responses.insert(request.key, response);
        true
    }

    fn invalidate(&mut self) {
        self.generation = self.generation.wrapping_add(1);
        self.responses.clear();
    }
}

impl RpcCacheValidation {
    fn refresh(&mut self, workspace_root: &FsPath) -> bool {
        if self
            .last_validated
            .is_some_and(|last_validated| last_validated.elapsed() < RPC_CACHE_VALIDATION_INTERVAL)
        {
            return false;
        }
        self.last_validated = Some(Instant::now());

        if self.watch_set.is_none() {
            let watch_set = workspace_watch_set(workspace_root);
            let Ok(fingerprint) = workspace_fingerprint(workspace_root, &watch_set) else {
                self.fingerprint = None;
                self.watch_set = Some(watch_set);
                return true;
            };
            self.fingerprint = Some(fingerprint);
            self.watch_set = Some(watch_set);
            return false;
        }

        let watch_set = self
            .watch_set
            .as_ref()
            .expect("watch set was checked above");
        let Ok(fingerprint) = workspace_fingerprint(workspace_root, watch_set) else {
            self.fingerprint = None;
            return true;
        };
        if self.fingerprint != Some(fingerprint) {
            let watch_set = workspace_watch_set(workspace_root);
            let Ok(fingerprint) = workspace_fingerprint(workspace_root, &watch_set) else {
                self.fingerprint = None;
                self.watch_set = Some(watch_set);
                return true;
            };
            self.fingerprint = Some(fingerprint);
            self.watch_set = Some(watch_set);
            return true;
        }
        false
    }

    fn invalidate(&mut self) {
        self.last_validated = None;
    }
}

impl RpcCacheRuntime {
    fn start_request(
        &self,
        workspace_root: &FsPath,
        request: &CacheableRpcRequest,
    ) -> Option<(RpcCacheLease, Option<String>)> {
        self.refresh(workspace_root);
        let cache = self.responses.lock().ok()?;
        Some((cache.lease(), cache.lookup(request)))
    }

    fn store(
        &self,
        lease: RpcCacheLease,
        request: CacheableRpcRequest,
        response: JsonValue,
    ) -> bool {
        self.responses
            .lock()
            .is_ok_and(|mut cache| cache.store(lease, request, response))
    }

    fn refresh(&self, workspace_root: &FsPath) {
        let Ok(mut validation) = self.validation.lock() else {
            self.invalidate_responses();
            return;
        };
        if validation.refresh(workspace_root) {
            self.invalidate_responses();
        }
    }

    fn invalidate(&self) {
        self.invalidate_responses();
        if let Ok(mut validation) = self.validation.lock() {
            validation.invalidate();
        }
    }

    fn invalidate_responses(&self) {
        if let Ok(mut cache) = self.responses.lock() {
            cache.invalidate();
        }
    }
}

fn cacheable_rpc_request(body: &[u8]) -> Option<CacheableRpcRequest> {
    let request = serde_json::from_slice::<JsonValue>(body).ok()?;
    let object = request.as_object()?;
    let id = object.get("id")?.clone();
    let method = object.get("method")?.as_str()?;
    if method == "file.render"
        && object
            .get("params")
            .and_then(JsonValue::as_object)
            .and_then(|params| params.get("format"))
            .and_then(JsonValue::as_str)
            == Some("source")
    {
        return None;
    }
    if !matches!(
        method,
        "workspace.dashboard"
            | "workspace.explorer"
            | "workspace.explorerEntries"
            | "workspace.health"
            | "view.render"
            | "file.render"
            | "file.references"
    ) {
        return None;
    }

    Some(CacheableRpcRequest {
        id,
        key: RpcCacheKey {
            method: method.to_string(),
            params: serde_json::to_string(object.get("params").unwrap_or(&JsonValue::Null)).ok()?,
        },
    })
}

fn is_mutating_rpc_request(body: &[u8]) -> bool {
    serde_json::from_slice::<JsonValue>(body)
        .ok()
        .and_then(|request| request.get("method")?.as_str().map(str::to_string))
        .is_some_and(|method| matches!(method.as_str(), "create" | "init"))
}

fn complete_rpc_request(
    rpc_cache: &RpcCacheRuntime,
    body: &[u8],
    cacheable_request: Option<CacheableRpcRequest>,
    cache_lease: Option<RpcCacheLease>,
    response: JsonValue,
) -> String {
    let response_text = response.to_string();
    if is_mutating_rpc_request(body) {
        rpc_cache.invalidate();
    } else if let (Some(request), Some(lease)) = (cacheable_request, cache_lease) {
        rpc_cache.store(lease, request, response);
    }
    response_text
}

fn response_with_rpc_id(mut response: JsonValue, id: JsonValue) -> Option<String> {
    response.as_object_mut()?.insert("id".to_string(), id);
    Some(response.to_string())
}

fn workspace_watch_set(root: &FsPath) -> WorkspaceWatchSet {
    let scan_plan = forma_core::WorkspaceSnapshot::load(root)
        .map(|snapshot| snapshot.scan_plan())
        .unwrap_or_else(|_| Arc::new(forma_core::WorkspaceScanPlan::bootstrap(root)));
    WorkspaceWatchSet { scan_plan }
}

fn workspace_fingerprint(root: &FsPath, watch_set: &WorkspaceWatchSet) -> std::io::Result<u64> {
    let mut hasher = DefaultHasher::new();
    for path in watch_set.scan_plan.watch_patterns().matching_files()? {
        fingerprint_workspace_file(root, &path, &mut hasher)?;
    }
    Ok(hasher.finish())
}

fn fingerprint_workspace_file(
    root: &FsPath,
    path: &FsPath,
    hasher: &mut DefaultHasher,
) -> std::io::Result<()> {
    let metadata = fs::metadata(path)?;
    let relative = path.strip_prefix(root).unwrap_or(path);
    let relative = relative.to_string_lossy().replace('\\', "/");
    relative.hash(hasher);
    metadata.len().hash(hasher);
    let modified = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    modified.as_secs().hash(hasher);
    modified.subsec_nanos().hash(hasher);
    Ok(())
}

#[derive(Debug, Clone)]
struct AppState {
    dispatcher: Dispatcher,
    rpc_cache: Arc<RpcCacheRuntime>,
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
    Check {
        #[arg(long)]
        json: bool,
    },
    Create {
        space: String,
        #[arg(long = "input", value_parser = parse_input_pair)]
        inputs: Vec<(String, Value)>,
        #[arg(long)]
        json: bool,
    },
    Init {
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        language: Option<String>,
        #[arg(long)]
        timezone: Option<String>,
        #[arg(long)]
        json: bool,
    },
    Inspect {
        #[arg(long)]
        space: Option<String>,
        locator: String,
        #[arg(long)]
        json: bool,
    },
    List {
        #[arg(long)]
        space: String,
        #[arg(long)]
        json: bool,
    },
    View {
        #[command(subcommand)]
        command: ViewCommand,
    },
    Reference {
        #[command(subcommand)]
        command: ReferenceCommand,
    },
    Docs {
        #[command(subcommand)]
        command: DocsCommand,
    },
    Config {
        #[command(subcommand)]
        command: ConfigCommand,
    },
    Workspace {
        #[command(subcommand)]
        command: WorkspaceCommand,
    },
    Skills {
        #[command(subcommand)]
        command: SkillsCommand,
    },
    Site {
        #[command(subcommand)]
        command: SiteCommand,
    },
    /// Run the Forma language server over stdio.
    Lsp,
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
enum ConfigCommand {
    Inspect {
        #[arg(long)]
        path: Option<String>,
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum ViewCommand {
    Render {
        view: String,
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum ReferenceCommand {
    Resolve {
        #[arg(long)]
        source: String,
        #[arg(long)]
        target: String,
        #[arg(long, value_enum, default_value_t = ReferenceIntentArg::Reference)]
        intent: ReferenceIntentArg,
        #[arg(long)]
        fragment: Option<String>,
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum ReferenceIntentArg {
    Reference,
    Link,
    Embed,
}

impl From<ReferenceIntentArg> for forma_core::ReferenceIntent {
    fn from(value: ReferenceIntentArg) -> Self {
        match value {
            ReferenceIntentArg::Reference => Self::Reference,
            ReferenceIntentArg::Link => Self::Link,
            ReferenceIntentArg::Embed => Self::Embed,
        }
    }
}

#[derive(Debug, Subcommand)]
enum DocsCommand {
    List {
        #[arg(long)]
        json: bool,
    },
    Get {
        id: String,
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum WorkspaceCommand {
    Dashboard {
        #[arg(long)]
        json: bool,
    },
    Explorer {
        #[arg(long)]
        json: bool,
    },
    ExplorerEntries {
        #[arg(long)]
        taxonomy: String,
        #[arg(long)]
        term: String,
        #[arg(long)]
        cursor: Option<String>,
        #[arg(long, default_value_t = 100)]
        limit: usize,
        #[arg(long)]
        json: bool,
    },
    Health {
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum SkillsCommand {
    List {
        #[arg(long)]
        json: bool,
    },
    Get {
        id: String,
        #[arg(long)]
        full: bool,
        #[arg(long)]
        json: bool,
    },
}

#[derive(Debug, Subcommand)]
enum SiteCommand {
    Build {
        #[arg(long)]
        out: PathBuf,
        #[arg(long)]
        base_url: String,
        #[arg(long, default_value = "/")]
        root_path: String,
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
        Some(Command::Check { json }) => {
            let result = dispatcher.dispatch(OperationRequest::Check(CheckRequest::default()))?;
            print_result(&result, json, "check");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Create {
            space,
            inputs,
            json,
        }) => {
            let result = dispatcher.dispatch(OperationRequest::Create(CreateRequest {
                space,
                inputs: inputs.into_iter().collect(),
            }))?;
            print_result(&result, json, "create");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Init {
            name,
            language,
            timezone,
            json,
        }) => {
            let result = dispatcher.dispatch(OperationRequest::Init(InitRequest {
                name,
                language,
                timezone,
            }))?;
            print_result(&result, json, "init");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::Inspect {
            space,
            locator,
            json,
        }) => {
            let request = if let Some(space) = space {
                InspectRequest {
                    path: None,
                    space: Some(space),
                    entry: Some(locator),
                }
            } else {
                InspectRequest {
                    path: Some(locator),
                    space: None,
                    entry: None,
                }
            };
            let result = dispatcher.dispatch(OperationRequest::Inspect(request))?;
            print_result(&result, json, "inspect");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::List { space, json }) => {
            let result = dispatcher.dispatch(OperationRequest::List(ListRequest { space }))?;
            print_result(&result, json, "list");
            exit_if_failed(&result);
            Ok(())
        }
        Some(Command::View { command }) => match command {
            ViewCommand::Render { view, json } => {
                let result =
                    dispatcher.dispatch(OperationRequest::ViewRender(ViewRenderRequest {
                        view,
                        params: Default::default(),
                    }))?;
                print_result(&result, json, "view render");
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Reference { command }) => match command {
            ReferenceCommand::Resolve {
                source,
                target,
                intent,
                fragment,
                json,
            } => {
                let result = dispatcher.dispatch(OperationRequest::ReferenceResolve(
                    ReferenceResolveRequest {
                        source_path: source,
                        target,
                        intent: intent.into(),
                        fragment,
                    },
                ))?;
                print_result(&result, json, "reference resolve");
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Docs { command }) => match command {
            DocsCommand::List { json } => {
                let result = dispatcher.dispatch(OperationRequest::DocsList(DocsListRequest {}))?;
                print_docs_list_result(&result, json);
                exit_if_failed(&result);
                Ok(())
            }
            DocsCommand::Get { id, json } => {
                let result =
                    dispatcher.dispatch(OperationRequest::DocsGet(DocsGetRequest { id }))?;
                print_docs_get_result(&result, json);
                exit_if_failed(&result);
                Ok(())
            }
        },
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
        Some(Command::Workspace { command }) => match command {
            WorkspaceCommand::Dashboard { json } => {
                let result = dispatcher.dispatch(OperationRequest::WorkspaceDashboard(
                    WorkspaceDashboardRequest::default(),
                ))?;
                print_result(&result, json, "workspace dashboard");
                exit_if_failed(&result);
                Ok(())
            }
            WorkspaceCommand::Explorer { json } => {
                let result = dispatcher.dispatch(OperationRequest::WorkspaceExplorer(
                    WorkspaceExplorerRequest::default(),
                ))?;
                print_result(&result, json, "workspace explorer");
                exit_if_failed(&result);
                Ok(())
            }
            WorkspaceCommand::ExplorerEntries {
                taxonomy,
                term,
                cursor,
                limit,
                json,
            } => {
                let result = dispatcher.dispatch(OperationRequest::WorkspaceExplorerEntries(
                    WorkspaceExplorerEntriesRequest {
                        taxonomy_id: taxonomy,
                        term_id: term,
                        cursor,
                        limit: Some(limit),
                    },
                ))?;
                print_result(&result, json, "workspace explorer entries");
                exit_if_failed(&result);
                Ok(())
            }
            WorkspaceCommand::Health { json } => {
                let result = dispatcher.dispatch(OperationRequest::WorkspaceHealth(
                    WorkspaceHealthRequest::default(),
                ))?;
                print_result(&result, json, "workspace health");
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Skills { command }) => match command {
            SkillsCommand::List { json } => {
                let result = dispatcher
                    .dispatch(OperationRequest::SkillsList(SkillsListRequest::default()))?;
                print_skills_list_result(&result, json);
                exit_if_failed(&result);
                Ok(())
            }
            SkillsCommand::Get { id, full, json } => {
                let result = dispatcher
                    .dispatch(OperationRequest::SkillsGet(SkillsGetRequest { id, full }))?;
                print_skill_get_result(&result, json);
                exit_if_failed(&result);
                Ok(())
            }
        },
        Some(Command::Site { command }) => match command {
            SiteCommand::Build {
                out,
                base_url,
                root_path,
                json,
            } => {
                let root_path = normalize_root_path(&root_path)?;
                match site::build_site(
                    &workspace,
                    site::SiteBuildOptions {
                        out,
                        base_url,
                        root_path,
                    },
                    &STATIC_WEBAPP_DIST,
                ) {
                    Ok(result) => print_site_build_result(&result, json),
                    Err(error) => {
                        print_site_build_failure(&error, json);
                        std::process::exit(1);
                    }
                }
                Ok(())
            }
        },
        Some(Command::Lsp) => Ok(forma_lsp::run(workspace)?),
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

fn print_site_build_result(result: &site::SiteBuildResult, json: bool) {
    if json {
        println!(
            "{}",
            serde_json::to_string(result).expect("site result is serializable")
        );
        return;
    }
    let status = match result.status {
        forma_core::OperationStatus::Passed => "passed",
        forma_core::OperationStatus::Warning => "warning",
        forma_core::OperationStatus::Failed => "failed",
    };
    println!("site build {status}");
    println!("output {}", result.output);
    println!("routes {}", result.counts.routes);
    println!("assets {}", result.counts.assets);
    for diagnostic in &result.diagnostics {
        let diagnostic = forma_core::Diagnostic {
            severity: diagnostic.severity,
            code: diagnostic.code.clone(),
            message: diagnostic.message.clone(),
            path: diagnostic.path.clone(),
            location: diagnostic.location.clone(),
            actual: diagnostic.actual.clone(),
            expected: diagnostic.expected.clone(),
        };
        print_diagnostic(&diagnostic);
    }
}

fn print_site_build_failure(error: &str, json: bool) {
    if json {
        println!(
            "{}",
            serde_json::json!({
                "schemaVersion": 1,
                "operation": "site.build",
                "status": "failed",
                "summary": { "errors": 1, "warnings": 0, "infos": 0 },
                "diagnostics": [{
                    "severity": "error",
                    "code": "site.buildFailed",
                    "message": error,
                }],
            })
        );
    } else {
        eprintln!("error site.buildFailed: {error}");
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
    }
}

fn print_skills_list_result(result: &forma_rpc::OperationResult, json: bool) {
    if json {
        println!("{}", result.to_json_string());
        return;
    }

    println!("skills list {}", result.status_label());
    for diagnostic in &result.diagnostics {
        print_diagnostic(diagnostic);
    }
    if let Some(skills) = result.data.get("skills").and_then(|value| value.as_array()) {
        for skill in skills {
            let id = skill
                .get("id")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            let title = skill
                .get("title")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            let source = skill
                .get("sourcePath")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            println!("{id}\t{title}\t{source}");
        }
    }
}

fn print_docs_list_result(result: &forma_rpc::OperationResult, json: bool) {
    if json {
        println!("{}", result.to_json_string());
    } else {
        println!("docs list {}", result.status_label());
        for diagnostic in &result.diagnostics {
            print_diagnostic(diagnostic);
        }
        if let Some(docs) = result.data.get("docs").and_then(|value| value.as_array()) {
            for doc in docs {
                let id = doc.get("id").and_then(|value| value.as_str()).unwrap_or("");
                let title = doc
                    .get("title")
                    .and_then(|value| value.as_str())
                    .unwrap_or("");
                let path = doc
                    .get("path")
                    .and_then(|value| value.as_str())
                    .unwrap_or("");
                println!("{id}\t{title}\t{path}");
            }
        }
    }
}

fn print_docs_get_result(result: &forma_rpc::OperationResult, json: bool) {
    if json {
        println!("{}", result.to_json_string());
    } else if let Some(doc) = result.data.get("doc") {
        let body = doc
            .get("body")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        print!("{body}");
        if !body.ends_with('\n') {
            println!();
        }
    } else {
        for diagnostic in &result.diagnostics {
            eprint_diagnostic(diagnostic);
        }
    }
}

fn print_skill_get_result(result: &forma_rpc::OperationResult, json: bool) {
    if json {
        println!("{}", result.to_json_string());
        return;
    }

    if let Some(content) = result
        .data
        .get("skill")
        .and_then(|skill| skill.get("content"))
        .and_then(|content| content.as_str())
    {
        print!("{content}");
        if !content.ends_with('\n') {
            println!();
        }
        if !matches!(result.status, forma_core::OperationStatus::Passed) {
            for diagnostic in &result.diagnostics {
                eprint_diagnostic(diagnostic);
            }
        }
    } else {
        println!("skills get {}", result.status_label());
        for diagnostic in &result.diagnostics {
            print_diagnostic(diagnostic);
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

fn eprint_diagnostic(diagnostic: &forma_core::Diagnostic) {
    let severity = match diagnostic.severity {
        forma_core::DiagnosticSeverity::Error => "error",
        forma_core::DiagnosticSeverity::Warning => "warning",
        forma_core::DiagnosticSeverity::Info => "info",
    };
    if let Some(path) = &diagnostic.path {
        eprintln!(
            "{severity} {}: {} ({path})",
            diagnostic.code, diagnostic.message
        );
    } else {
        eprintln!("{severity} {}: {}", diagnostic.code, diagnostic.message);
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
    if let Some(webapp_dir) = &webapp_dir
        && !webapp_dir.is_dir()
    {
        return Err(format!(
            "webapp asset directory does not exist or is not a directory: {}",
            webapp_dir.display()
        )
        .into());
    }
    let cors_origins = validate_cors_origins(cors_origins)?;
    let root_path = normalize_root_path(&root_path)?;

    let state = AppState {
        dispatcher,
        rpc_cache: Arc::new(RpcCacheRuntime::default()),
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
    if !forma_core::is_public_workspace_path_allowed(&state.workspace_root, &workspace_path) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Some(media_type) = forma_core::media_type_for_workspace_path(&workspace_path) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    serve_workspace_file(&state.workspace_root, &workspace_path, media_type).await
}

async fn serve_workspace_file(
    workspace_root: &FsPath,
    workspace_path: &str,
    media_type: &'static str,
) -> Response {
    let base = match workspace_root.canonicalize() {
        Ok(base) => base,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let file_path = workspace_root.join(workspace_path);
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

async fn rpc_handler(State(state): State<AppState>, headers: HeaderMap, body: Bytes) -> Response {
    let dispatcher = state.dispatcher.clone();
    let rpc_cache = state.rpc_cache.clone();
    let workspace_root = state.workspace_root.clone();
    let body = body.to_vec();
    let result = tokio::task::spawn_blocking(move || {
        let cacheable_request = cacheable_rpc_request(&body);
        let (cache_lease, cached_response) = cacheable_request
            .as_ref()
            .and_then(|request| rpc_cache.start_request(&workspace_root, request))
            .map(|(lease, response)| (Some(lease), response))
            .unwrap_or((None, None));
        if let Some(response) = cached_response {
            return response;
        }

        let response = dispatcher.handle_json_rpc(&body);
        complete_rpc_request(&rpc_cache, &body, cacheable_request, cache_lease, response)
    })
    .await
    .unwrap_or_else(|error| {
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": null,
            "error": {
                "code": -32603,
                "message": "Internal error.",
                "data": { "code": "operation.failed", "detail": error.to_string() },
            },
        })
        .to_string()
    });
    let mut response = (StatusCode::OK, result).into_response();
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
        if should_serve_spa_index(asset_path) {
            let Some(index_file) = WEBAPP_DIST.get_file("index.html") else {
                return StatusCode::NOT_FOUND.into_response();
            };
            return webapp_file_response(
                "index.html",
                index_file.path().to_string_lossy().as_ref(),
                index_file.contents(),
                root_path,
            );
        }
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
        _ if should_serve_spa_index(&asset_path) => {
            return external_webapp_asset_response(webapp_dir, "index.html", root_path);
        }
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
    if let Some(base_index) = html.find("<base") {
        let end_index = html[base_index..]
            .find('>')
            .map(|offset| base_index + offset + 1)
            .unwrap_or(base_index);
        let mut output = String::with_capacity(html.len() + base.len());
        output.push_str(&html[..base_index]);
        output.push_str(&base);
        output.push_str(&html[end_index..]);
        return output;
    }
    if let Some(insert_at) = first_resource_tag_index(html) {
        let mut output = String::with_capacity(html.len() + base.len() + 1);
        output.push_str(&html[..insert_at]);
        output.push_str(&base);
        output.push('\n');
        output.push_str(&html[insert_at..]);
        return output;
    }
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

fn first_resource_tag_index(html: &str) -> Option<usize> {
    ["<script", "<link", "<style"]
        .into_iter()
        .filter_map(|needle| html.find(needle))
        .min()
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
    let normalized = value.trim_end_matches('/');
    if normalized.is_empty() {
        return Ok("/".to_string());
    }
    if normalized.starts_with("//")
        || normalized.contains("//")
        || normalized.split('/').skip(1).any(|segment| {
            segment.is_empty()
                || segment == "."
                || segment == ".."
                || !segment.bytes().all(|byte| {
                    byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~')
                })
        })
    {
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

fn should_serve_spa_index(path: &str) -> bool {
    let route = path.trim_matches('/');
    let segments = route.split('/').collect::<Vec<_>>();
    let configured_classification_route = matches!(segments.len(), 1 | 2)
        && segments[0] != "assets"
        && segments
            .iter()
            .all(|segment| !segment.is_empty() && !segment.contains('.'));

    matches!(route, "pages" | "taxonomies" | "views")
        || route.starts_with("pages/")
        || route.starts_with("views/")
        || configured_classification_route
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
    use std::path::Path;
    use std::sync::{Arc, Barrier};
    use std::thread;
    use std::time::{Instant, SystemTime, UNIX_EPOCH};

    use axum::body::{Body, Bytes, to_bytes};
    use axum::http::{HeaderMap, Method, Request, StatusCode, header};
    use forma_rpc::Dispatcher;
    use serde_json::json;
    use tower::ServiceExt;

    use super::{
        AppState, RpcCacheRuntime, cacheable_rpc_request, complete_rpc_request, inject_base_href,
        is_mutating_rpc_request, normalize_root_path, response_with_rpc_id, rpc_handler,
        rpc_router, rpc_router_with_dispatcher, rpc_router_with_dispatcher_and_workspace,
        rpc_router_with_options, rpc_router_with_options_and_root_path, should_serve_spa_index,
        workspace_fingerprint, workspace_watch_set,
    };

    #[test]
    fn root_path_accepts_only_normalized_url_segments() {
        assert_eq!(normalize_root_path("").unwrap(), "/");
        assert_eq!(normalize_root_path("/preview").unwrap(), "/preview");
        assert_eq!(normalize_root_path("/docs/v1/").unwrap(), "/docs/v1");
        for invalid in [
            "preview",
            "//evil.test",
            "/a//b",
            "/a/../b",
            "/%2e%2e",
            "/a b",
            "/a\\b",
            "/a\nb",
        ] {
            assert!(normalize_root_path(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn spa_index_supports_direct_taxonomy_and_term_routes() {
        for path in ["spaces", "spaces/tasks", "/spaces/tasks/"] {
            assert!(should_serve_spa_index(path), "expected SPA route: {path}");
        }
    }

    #[test]
    fn spa_index_rejects_assets_files_and_deeper_classification_paths() {
        for path in [
            "assets",
            "assets/app.js",
            "favicon.ico",
            "spaces/tasks/extra",
        ] {
            assert!(
                !should_serve_spa_index(path),
                "expected asset route: {path}"
            );
        }
    }

    #[test]
    fn rpc_cache_key_ignores_json_rpc_request_ids() {
        let first = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"first","method":"file.render","params":{"path":"notes/one.md","format":"markdown"}}"#,
        )
        .unwrap();
        let second = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"second","method":"file.render","params":{"path":"notes/one.md","format":"markdown"}}"#,
        )
        .unwrap();

        assert_eq!(first.key, second.key);
        assert_ne!(first.id, second.id);
        assert!(
            cacheable_rpc_request(br#"{"jsonrpc":"2.0","id":"3","method":"create","params":{}}"#)
                .is_none()
        );
    }

    #[test]
    fn file_render_source_requests_are_not_cached() {
        assert!(
            cacheable_rpc_request(
                br#"{"jsonrpc":"2.0","id":"1","method":"file.render","params":{"path":"notes/one.md","format":"source"}}"#,
            )
            .is_none()
        );
        assert!(
            cacheable_rpc_request(
                br#"{"jsonrpc":"2.0","id":"2","method":"file.render","params":{"path":"notes/one.md","format":"markdown"}}"#,
            )
            .is_some()
        );
    }

    #[test]
    fn mutating_rpc_requests_are_classified_explicitly() {
        for method in ["create", "init"] {
            let body = format!(r#"{{"jsonrpc":"2.0","id":"1","method":"{method}","params":{{}}}}"#);
            assert!(is_mutating_rpc_request(body.as_bytes()), "{method}");
        }
        assert!(!is_mutating_rpc_request(
            br#"{"jsonrpc":"2.0","id":"1","method":"workspace.dashboard","params":{}}"#
        ));
    }

    #[test]
    fn stale_in_flight_response_is_rejected_after_generation_changes() {
        let runtime = Arc::new(RpcCacheRuntime::default());
        let stale_request = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"stale","method":"workspace.dashboard","params":{}}"#,
        )
        .unwrap();
        let stale_lease = runtime.responses.lock().unwrap().lease();
        let stale_started = Arc::new(Barrier::new(2));
        let allow_stale_store = Arc::new(Barrier::new(2));

        let stale_runtime = runtime.clone();
        let stale_started_worker = stale_started.clone();
        let allow_stale_store_worker = allow_stale_store.clone();
        let stale_store = thread::spawn(move || {
            stale_started_worker.wait();
            allow_stale_store_worker.wait();
            stale_runtime.store(
                stale_lease,
                stale_request,
                json!({
                    "jsonrpc": "2.0",
                    "id": "stale",
                    "result": { "version": "stale" },
                }),
            )
        });

        stale_started.wait();
        runtime.invalidate();
        let fresh_request = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"fresh","method":"workspace.dashboard","params":{}}"#,
        )
        .unwrap();
        let fresh_lease = runtime.responses.lock().unwrap().lease();
        assert!(runtime.store(
            fresh_lease,
            fresh_request,
            json!({
                "jsonrpc": "2.0",
                "id": "fresh",
                "result": { "version": "fresh" },
            }),
        ));
        allow_stale_store.wait();
        assert!(!stale_store.join().unwrap());

        let lookup = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"lookup","method":"workspace.dashboard","params":{}}"#,
        )
        .unwrap();
        let response = runtime.responses.lock().unwrap().lookup(&lookup).unwrap();
        let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();
        assert_eq!(response["id"], "lookup");
        assert_eq!(response["result"]["version"], "fresh");
    }

    #[test]
    fn mutation_completion_immediately_invalidates_cached_responses() {
        let runtime = RpcCacheRuntime::default();
        let cached_request = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"cached","method":"workspace.dashboard","params":{}}"#,
        )
        .unwrap();
        let lease = runtime.responses.lock().unwrap().lease();
        assert!(runtime.store(
            lease,
            cached_request,
            json!({
                "jsonrpc": "2.0",
                "id": "cached",
                "result": { "version": "before-mutation" },
            }),
        ));
        let generation_before = runtime.responses.lock().unwrap().generation;
        runtime.validation.lock().unwrap().last_validated = Some(Instant::now());

        complete_rpc_request(
            &runtime,
            br#"{"jsonrpc":"2.0","id":"create","method":"create","params":{}}"#,
            None,
            None,
            json!({
                "jsonrpc": "2.0",
                "id": "create",
                "result": { "status": "passed" },
            }),
        );

        let cache = runtime.responses.lock().unwrap();
        assert_eq!(cache.generation, generation_before + 1);
        assert!(cache.responses.is_empty());
        drop(cache);
        assert!(runtime.validation.lock().unwrap().last_validated.is_none());
    }

    #[test]
    fn cold_validation_establishes_a_baseline_without_invalidating_responses() {
        let root = fixture_root("workspace-cache-cold-baseline");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join(".forma.md"), "# Forma\n").unwrap();
        let runtime = RpcCacheRuntime::default();
        let cached_request = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"cached","method":"workspace.dashboard","params":{}}"#,
        )
        .unwrap();
        let lease = runtime.responses.lock().unwrap().lease();
        assert!(runtime.store(
            lease,
            cached_request,
            json!({
                "jsonrpc": "2.0",
                "id": "cached",
                "result": { "version": "baseline" },
            }),
        ));

        let lookup = cacheable_rpc_request(
            br#"{"jsonrpc":"2.0","id":"lookup","method":"workspace.dashboard","params":{}}"#,
        )
        .unwrap();
        let (lease_after_validation, response) = runtime.start_request(&root, &lookup).unwrap();

        assert_eq!(lease_after_validation.generation, lease.generation);
        assert!(response.is_some());
        assert!(runtime.validation.lock().unwrap().fingerprint.is_some());
        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_handler_reuses_cached_responses_and_preserves_request_ids() {
        let root = fixture_root("rpc-cache-handler-hit");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        let rpc_cache = Arc::new(RpcCacheRuntime::default());
        let state = AppState {
            dispatcher: Dispatcher::new(&root),
            rpc_cache: rpc_cache.clone(),
            workspace_root: root.clone(),
            webapp_dir: None,
            cors_origins: Vec::new(),
            root_path: "/".to_string(),
        };

        let first = rpc_handler(
            axum::extract::State(state.clone()),
            HeaderMap::new(),
            Bytes::from_static(
                br#"{"jsonrpc":"2.0","id":"first","method":"workspace.dashboard","params":{}}"#,
            ),
        )
        .await;
        let first = response_json(first).await;
        assert_eq!(first["id"], "first");
        assert!(first.get("result").is_some());
        assert_eq!(rpc_cache.responses.lock().unwrap().responses.len(), 1);

        fs::remove_dir_all(&root).unwrap();
        rpc_cache.validation.lock().unwrap().last_validated = Some(Instant::now());
        let second = rpc_handler(
            axum::extract::State(state),
            HeaderMap::new(),
            Bytes::from_static(
                br#"{"jsonrpc":"2.0","id":"second","method":"workspace.dashboard","params":{}}"#,
            ),
        )
        .await;
        let second = response_json(second).await;
        assert_eq!(second["id"], "second");
        assert!(second.get("result").is_some());
    }

    #[tokio::test]
    async fn rpc_handler_invalidates_cached_responses_after_external_changes() {
        let root = fixture_root("rpc-cache-handler-invalidation");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        let rpc_cache = Arc::new(RpcCacheRuntime::default());
        let state = AppState {
            dispatcher: Dispatcher::new(&root),
            rpc_cache: rpc_cache.clone(),
            workspace_root: root.clone(),
            webapp_dir: None,
            cors_origins: Vec::new(),
            root_path: "/".to_string(),
        };
        let request = Bytes::from_static(
            br#"{"jsonrpc":"2.0","id":"first","method":"workspace.dashboard","params":{}}"#,
        );

        let first = response_json(
            rpc_handler(
                axum::extract::State(state.clone()),
                HeaderMap::new(),
                request,
            )
            .await,
        )
        .await;
        assert_eq!(
            first["result"]["workspace"]["name"],
            "Choral Forma Getting Started Workspace"
        );
        let generation = rpc_cache.responses.lock().unwrap().generation;

        let config_path = root.join(".forma.md");
        let config = fs::read_to_string(&config_path).unwrap().replace(
            "Choral Forma Getting Started Workspace",
            "Externally Updated Workspace",
        );
        fs::write(config_path, config).unwrap();
        rpc_cache.validation.lock().unwrap().last_validated = None;

        let second = response_json(
            rpc_handler(
                axum::extract::State(state),
                HeaderMap::new(),
                Bytes::from_static(
                    br#"{"jsonrpc":"2.0","id":"second","method":"workspace.dashboard","params":{}}"#,
                ),
            )
            .await,
        )
        .await;
        assert_eq!(
            second["result"]["workspace"]["name"],
            "Externally Updated Workspace"
        );
        assert_eq!(
            rpc_cache.responses.lock().unwrap().generation,
            generation + 1
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn cached_rpc_response_keeps_the_callers_request_id() {
        let response = response_with_rpc_id(
            json!({ "jsonrpc": "2.0", "id": "first", "result": { "ok": true } }),
            json!("second"),
        )
        .unwrap();

        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&response).unwrap()["id"],
            "second"
        );
    }

    #[test]
    fn workspace_fingerprint_changes_when_workspace_content_changes() {
        let root = fixture_root("workspace-cache-fingerprint");
        fs::create_dir_all(&root).unwrap();
        write_watch_config(&root, &["note.md"]);
        fs::write(root.join("note.md"), "# First\n").unwrap();
        let watch_set = workspace_watch_set(&root);
        let first = workspace_fingerprint(&root, &watch_set).unwrap();

        fs::write(root.join("note.md"), "# Second content\n").unwrap();
        let second = workspace_fingerprint(&root, &watch_set).unwrap();

        assert_ne!(first, second);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_fingerprint_includes_explicit_local_named_imports() {
        let root = fixture_root("workspace-cache-explicit-local-named-import-fingerprint");
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        write_watch_config(&root, &[".forma/local/profile.md"]);
        fs::write(root.join(".forma/local/profile.md"), "# First\n").unwrap();
        let watch_set = workspace_watch_set(&root);
        let first = workspace_fingerprint(&root, &watch_set).unwrap();

        fs::write(root.join(".forma/local/profile.md"), "# Second content\n").unwrap();
        let second = workspace_fingerprint(&root, &watch_set).unwrap();

        assert_ne!(first, second);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_fingerprint_ignores_unconfigured_directories() {
        let root = fixture_root("workspace-cache-unconfigured-directory");
        fs::create_dir_all(root.join("knowledge")).unwrap();
        fs::create_dir_all(root.join(".worktrees/other")).unwrap();
        write_watch_config(&root, &["knowledge/**/*.md"]);
        fs::write(root.join("knowledge/entry.md"), "# Entry\n").unwrap();
        fs::write(root.join(".worktrees/other/entry.md"), "# First\n").unwrap();
        let watch_set = workspace_watch_set(&root);
        let first = workspace_fingerprint(&root, &watch_set).unwrap();

        fs::write(root.join(".worktrees/other/entry.md"), "# Second content\n").unwrap();
        let second = workspace_fingerprint(&root, &watch_set).unwrap();

        assert_eq!(first, second);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_fingerprint_includes_configured_worktree_content() {
        let root = fixture_root("workspace-cache-configured-worktree");
        fs::create_dir_all(root.join(".worktrees/other")).unwrap();
        write_watch_config(&root, &[".worktrees/**/*.md"]);
        fs::write(root.join(".worktrees/other/entry.md"), "# First\n").unwrap();
        let watch_set = workspace_watch_set(&root);
        let first = workspace_fingerprint(&root, &watch_set).unwrap();

        fs::write(root.join(".worktrees/other/entry.md"), "# Second content\n").unwrap();
        let second = workspace_fingerprint(&root, &watch_set).unwrap();

        assert_ne!(first, second);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn bootstrap_watch_set_ignores_invalid_import_patterns() {
        let root = fixture_root("workspace-cache-invalid-import-fallback");
        let outside = fixture_root("workspace-cache-invalid-import-fallback-outside");
        fs::create_dir_all(root.join("notes")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        write_watch_config(&root, &["../outside/**/*.md", "notes/**/*.md"]);
        fs::write(root.join("notes/entry.md"), "# First\n").unwrap();
        fs::write(outside.join("entry.md"), "# Outside\n").unwrap();
        let watch_set = workspace_watch_set(&root);
        let first = workspace_fingerprint(&root, &watch_set).unwrap();

        fs::write(outside.join("entry.md"), "# Changed outside\n").unwrap();
        assert_eq!(first, workspace_fingerprint(&root, &watch_set).unwrap());

        fs::write(root.join("notes/entry.md"), "# Changed inside\n").unwrap();
        assert_ne!(first, workspace_fingerprint(&root, &watch_set).unwrap());
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    fn write_watch_config(root: &Path, imports: &[&str]) {
        let imports = imports
            .iter()
            .map(|pattern| format!("  - {pattern:?}"))
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(
            root.join(".forma.md"),
            format!("---\nimports:\n{imports}\n---\n\n# Forma\n"),
        )
        .unwrap();
    }

    async fn response_json(response: axum::response::Response) -> serde_json::Value {
        let body = to_bytes(response.into_body(), 8 * 1024 * 1024)
            .await
            .unwrap();
        serde_json::from_slice(&body).unwrap()
    }

    fn copy_starter_workspace(root: &Path) {
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/getting-started-workspace");
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

    #[test]
    fn inject_base_href_inserts_before_resource_tags() {
        let html = r#"<html><head><link rel="modulepreload" href="/assets/app.js"><script src="/assets/app.js"></script></head></html>"#;

        let output = inject_base_href(html, "/forma");

        assert!(output.contains(r#"<base href="/forma/">"#));
        assert!(
            output.find(r#"<base href="/forma/">"#)
                < output.find("<link").or_else(|| output.find("<script"))
        );
    }

    #[test]
    fn inject_base_href_replaces_existing_base_tag() {
        let html = r#"<html><head><base href="/old/"><link rel="stylesheet" href="style.css"></head></html>"#;

        let output = inject_base_href(html, "/forma");

        assert!(output.contains(r#"<base href="/forma/">"#));
        assert!(!output.contains(r#"<base href="/old/">"#));
        assert_eq!(output.matches("<base").count(), 1);
    }

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
        copy_starter_workspace(&root);

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
        assert!(body.contains(r#""name":"Choral Forma Getting Started Workspace""#));

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
                    .uri("/notes/members/workspace-note")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::TEMPORARY_REDIRECT);
        assert_eq!(response.headers().get("location").unwrap(), "/");
    }

    #[tokio::test]
    async fn rpc_router_falls_back_spa_page_routes_to_index() {
        let response = rpc_router()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/pages/notes/getting-started")
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
        if let Some(first_resource) = index_body
            .find("<script")
            .or_else(|| index_body.find("<link"))
        {
            assert!(index_body.find(r#"<base href="/forma/">"#) < Some(first_resource));
        }

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
                    .uri("/forma/notes/members/workspace-note")
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

        let page_response = rpc_router_with_options_and_root_path(None, Vec::new(), "/forma")
            .unwrap()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri("/forma/pages/notes/getting-started")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(page_response.status(), StatusCode::OK);
        let page_body = to_bytes(page_response.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let page_body = String::from_utf8_lossy(&page_body);
        assert!(page_body.contains(r#"<base href="/forma/">"#));
    }

    #[tokio::test]
    async fn rpc_router_serves_raw_workspace_resources_under_root_path() {
        let root = fixture_root("raw-resource-route");
        fs::create_dir_all(root.join("assets")).unwrap();
        copy_starter_workspace(&root);
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
    async fn rpc_router_does_not_expose_public_forma_asset_route() {
        let root = fixture_root("public-forma-asset-route-disabled");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join(".forma/assets")).unwrap();
        fs::write(root.join(".forma/assets/logo.svg"), "<svg></svg>").unwrap();

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
                    .uri("/forma/_forma/assets/logo.svg")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_rejects_raw_workspace_path_traversal() {
        let root = fixture_root("raw-route-traversal");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);

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
                    .uri("/forma/raw/../.forma.md")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_rejects_raw_config_entry_but_serves_non_config_forma_assets() {
        let root = fixture_root("raw-route-rejects-forma-internal");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join(".forma/assets")).unwrap();
        fs::write(root.join(".forma/assets/logo.svg"), "<svg></svg>").unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        let config_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/.forma.md")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(config_response.status(), StatusCode::NOT_FOUND);

        let asset_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/.forma/assets/logo.svg")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(asset_response.status(), StatusCode::OK);

        fs::write(root.join(".forma.md"), "---\nworkspace: [\n---\n").unwrap();
        let invalid_config_response = app
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/.forma/assets/logo.svg")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(invalid_config_response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_serves_local_named_resources_but_rejects_imported_config_sources() {
        let root = fixture_root("raw-route-forma-local");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(root.join(".forma/local/secret.png"), b"\x89PNG\r\n\x1a\n").unwrap();
        fs::write(
            root.join(".forma/local/profile.md"),
            "---\nworkspace:\n  timezone: Europe/Paris\n---\n",
        )
        .unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        let resource_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/.forma/local/secret.png")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resource_response.status(), StatusCode::OK);

        let config_response = app
            .oneshot(
                Request::builder()
                    .uri("/forma/raw/.forma/local/profile.md")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(config_response.status(), StatusCode::NOT_FOUND);

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_serves_raw_forma_local_workspace_file_case_variants() {
        let root = fixture_root("raw-route-forma-local-case");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join(".FORMA/local")).unwrap();
        fs::write(root.join(".FORMA/local/secret.png"), b"\x89PNG\r\n\x1a\n").unwrap();

        let app = rpc_router_with_dispatcher_and_workspace(
            None,
            Vec::new(),
            Dispatcher::new(&root),
            root.clone(),
            "/forma".into(),
        )
        .unwrap();

        for uri in ["/forma/raw/.FORMA/local/secret.png"] {
            let response = app
                .clone()
                .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rpc_router_serves_raw_project_ignored_files() {
        let root = fixture_root("raw-route-gitignore-not-special");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(root.join(".gitignore"), "private/\n").unwrap();
        fs::create_dir_all(root.join("private")).unwrap();
        fs::write(root.join("private/secret.png"), b"\x89PNG\r\n\x1a\n").unwrap();

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
                    .uri("/forma/raw/private/secret.png")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn rpc_router_rejects_raw_workspace_symlink_escape() {
        let root = fixture_root("raw-route-symlink-escape");
        let outside = fixture_root("raw-route-symlink-outside");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        copy_starter_workspace(&root);
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
