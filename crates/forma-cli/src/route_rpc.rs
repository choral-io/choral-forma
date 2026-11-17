use std::collections::{HashMap, hash_map::DefaultHasher};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use forma_core::{Diagnostic, DiagnosticSummary, WorkspaceScanPlan, WorkspaceSnapshot};
use forma_rpc::{Operation, OperationError, OperationRequest, OperationResult};
use serde_json::Value;

use crate::{
    RPC_CACHE_MAX_RESPONSES, RPC_CACHE_VALIDATION_INTERVAL, RpcCacheKey, WorkspaceWatchSet,
    workspace_watch_set,
};

static NEXT_SESSION: AtomicU64 = AtomicU64::new(0);

pub(super) struct RouteRpc {
    session: String,
    refresh_lock: Mutex<()>,
    state: Mutex<RouteState>,
}

#[derive(Default)]
struct RouteState {
    sequence: u64,
    last_check: Option<Instant>,
    current: Option<Arc<RouteVersion>>,
}

struct RouteVersion {
    token: String,
    snapshot: Option<WorkspaceSnapshot>,
    diagnostics: Vec<Diagnostic>,
    watch: WorkspaceWatchSet,
    stamp: Option<u64>,
    responses: Mutex<HashMap<RpcCacheKey, OperationResult>>,
}

impl RouteVersion {
    fn available(&self) -> bool {
        self.snapshot.is_some() && self.diagnostics.is_empty()
    }

    fn response_failure(&self, operation: Operation) -> OperationResult {
        if self.available() {
            return OperationResult::failed(
                operation,
                Diagnostic::error("route.generationMismatch", "Workspace routes have changed."),
            );
        }
        let mut result = OperationResult::failed(
            operation,
            Diagnostic::error("route.unavailable", "Workspace routes are unavailable."),
        );
        result.diagnostics.extend(self.diagnostics.iter().cloned());
        result.summary = Some(DiagnosticSummary::from_diagnostics(&result.diagnostics));
        result
    }
}

impl std::fmt::Debug for RouteRpc {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RouteRpc")
            .field("session", &self.session)
            .finish_non_exhaustive()
    }
}

impl Default for RouteRpc {
    fn default() -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let instance = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
        Self {
            session: format!("{}-{now}-{instance}", std::process::id()),
            refresh_lock: Mutex::new(()),
            state: Mutex::new(RouteState::default()),
        }
    }
}

impl RouteRpc {
    pub(super) fn preflight(&self, root: &Path) -> Result<(), String> {
        let current = self.current(root);
        if current.available() {
            return Ok(());
        }
        Err(current
            .diagnostics
            .iter()
            .map(|diagnostic| {
                format!(
                    "{}: {}{}",
                    diagnostic.code,
                    diagnostic.message,
                    diagnostic
                        .actual
                        .as_deref()
                        .map_or_else(String::new, |actual| format!(" ({actual})"))
                )
            })
            .collect::<Vec<_>>()
            .join("\n"))
    }

    fn current(&self, root: &Path) -> Arc<RouteVersion> {
        let _refresh = self.refresh_lock.lock().unwrap();
        let previous = {
            let state = self.state.lock().unwrap();
            if let Some(current) = &state.current
                && state
                    .last_check
                    .is_some_and(|at| at.elapsed() < RPC_CACHE_VALIDATION_INTERVAL)
            {
                return current.clone();
            }
            state.current.clone()
        };
        if let Some(current) = &previous
            && let Some(previous_stamp) = current.stamp
            && route_fingerprint(root, &current.watch.scan_plan) == Some(previous_stamp)
        {
            self.state.lock().unwrap().last_check = Some(Instant::now());
            return current.clone();
        }

        let (snapshot, diagnostics, watch, stamp) = match WorkspaceSnapshot::load_for_routes(root) {
            Ok(snapshot) => {
                let watch = WorkspaceWatchSet {
                    scan_plan: snapshot.scan_plan(),
                };
                let stamp = route_fingerprint(root, &watch.scan_plan);
                let consistent = stamp.is_some()
                    && snapshot.route_sources_match_workspace()
                    && route_fingerprint(root, &watch.scan_plan) == stamp;
                let mut diagnostics = snapshot
                    .discovery()
                    .diagnostics
                    .iter()
                    .filter(|diagnostic| {
                        forma_core::routes::is_blocking_route_diagnostic(diagnostic)
                    })
                    .cloned()
                    .collect::<Vec<_>>();
                let incomplete_scan = diagnostics
                    .iter()
                    .any(|diagnostic| diagnostic.code == "route.preflightIncomplete");
                if consistent {
                    let stamp = if incomplete_scan { None } else { stamp };
                    (Some(snapshot), diagnostics, watch, stamp)
                } else {
                    if !incomplete_scan {
                        diagnostics.push(incomplete(
                            "Workspace inputs could not be verified for this route generation.",
                        ));
                    }
                    (None, diagnostics, watch, None)
                }
            }
            Err(error) => {
                let watch = workspace_watch_set(root);
                (None, vec![incomplete(&error.to_string())], watch, None)
            }
        };
        let mut state = self.state.lock().unwrap();
        state.sequence += 1;
        let version = Arc::new(RouteVersion {
            token: format!("{}:{}", self.session, state.sequence),
            snapshot,
            diagnostics,
            watch,
            stamp,
            responses: Mutex::new(HashMap::new()),
        });
        state.current = Some(version.clone());
        state.last_check = Some(Instant::now());
        version
    }

    pub(super) fn invalidate(&self) {
        let _refresh = self.refresh_lock.lock().unwrap();
        let mut state = self.state.lock().unwrap();
        state.last_check = None;
        state.current = None;
    }

    pub(super) fn dispatch(
        &self,
        root: &Path,
        request: OperationRequest,
        operation: Operation,
        cache_key: Option<&RpcCacheKey>,
    ) -> Result<OperationResult, OperationError> {
        self.dispatch_using(
            root,
            request,
            operation,
            cache_key,
            OperationRequest::dispatch_route_read,
        )
    }

    fn dispatch_using(
        &self,
        root: &Path,
        request: OperationRequest,
        operation: Operation,
        cache_key: Option<&RpcCacheKey>,
        read: impl FnOnce(
            OperationRequest,
            &WorkspaceSnapshot,
        ) -> Result<OperationResult, OperationError>,
    ) -> Result<OperationResult, OperationError> {
        let expected = request.expected_route_generation();
        if expected.is_some_and(|value| value.is_empty() || value.len() > 256 || !value.is_ascii())
        {
            return Err(OperationError::InvalidParams);
        }
        let current = self.current(root);
        let alive = current.available() && expected.is_none_or(|token| token == current.token);
        let mut result = if alive {
            let cached =
                cache_key.and_then(|key| current.responses.lock().unwrap().get(key).cloned());
            if let Some(result) = cached {
                result
            } else {
                read(request, current.snapshot.as_ref().unwrap())?
            }
        } else {
            current.response_failure(operation)
        };
        let latest = self.current(root);
        if current.token != latest.token {
            result = latest.response_failure(operation);
        } else if alive && let Some(key) = cache_key {
            let mut responses = current.responses.lock().unwrap();
            if responses.len() >= RPC_CACHE_MAX_RESPONSES {
                responses.clear();
            }
            responses.insert(key.clone(), result.clone());
        }
        result.data.insert(
            "routeGeneration".into(),
            Value::String(latest.token.clone()),
        );
        Ok(result)
    }

    #[cfg(test)]
    pub(super) fn cached_responses(&self, root: &Path) -> usize {
        self.current(root).responses.lock().unwrap().len()
    }

    #[cfg(test)]
    pub(super) fn expire_validation(&self) {
        self.state.lock().unwrap().last_check = None;
    }
}

fn incomplete(message: &str) -> Diagnostic {
    Diagnostic::error(
        "route.preflightIncomplete",
        "Route preflight did not complete.",
    )
    .with_actual(message)
}

fn route_fingerprint(root: &Path, scan_plan: &WorkspaceScanPlan) -> Option<u64> {
    let mut stamp = DefaultHasher::new();
    for path in scan_plan.watch_patterns().matching_files_strict().ok()? {
        crate::fingerprint_workspace_file(root, &path, &mut stamp).ok()?;
        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                matches!(
                    extension.to_ascii_lowercase().as_str(),
                    "md" | "mdx" | "yaml" | "yml" | "json"
                )
            })
        {
            fs::read(&path).ok()?.hash(&mut stamp);
        }
    }
    Some(stamp.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_computed_detail_cannot_escape_after_invalidation() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples/minimal-workspace");
        let runtime = RouteRpc::default();
        let original = runtime.current(&root);
        assert!(original.available());
        let result = runtime
            .dispatch_using(
                &root,
                OperationRequest::WorkspaceDashboard(Default::default()),
                Operation::WorkspaceDashboard,
                None,
                |request, snapshot| {
                    let computed = request.dispatch_route_read(snapshot)?;
                    assert!(computed.data.contains_key("home"));
                    runtime.invalidate();
                    Ok(computed)
                },
            )
            .unwrap();
        assert_ne!(result.data["routeGeneration"], original.token);
        assert_eq!(result.diagnostics[0].code, "route.generationMismatch");
        assert!(!result.data.contains_key("home"));
    }
}
