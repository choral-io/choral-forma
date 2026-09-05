use std::collections::BTreeSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::boundary::{WorkspaceBoundary, WorkspaceBoundaryError};
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::path::{WorkspaceGlob, WorkspacePath};
use crate::scan::WorkspacePatternSet;

/// One effective declaration and its concrete, workspace-relative results.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuidelineSource {
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_group: Option<String>,
    pub field: String,
    pub pattern: String,
    pub paths: Vec<String>,
}

pub(crate) fn resolve_guidelines(
    root: &Path,
    declarations: &[String],
    source_path: &str,
    content_group: Option<&str>,
    sources: &mut Vec<GuidelineSource>,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<String> {
    let mut resolved = Vec::new();
    let mut seen = BTreeSet::new();
    for (index, declaration) in declarations.iter().enumerate() {
        let field = format!("guidelines[{index}]");
        let mut paths = Vec::new();
        if !declaration.contains(['*', '?', '[', '{']) {
            // Preserve exact-path validation (including missing-file errors).
            paths.push(declaration.clone());
        } else {
            let result = WorkspaceGlob::parse_config(declaration);
            match result {
                Err(error) => diagnostics.push(
                    Diagnostic::error(
                        "config.globInvalid",
                        format!("Guideline glob is invalid: {error}."),
                    )
                    .with_path(source_path)
                    .with_location(DiagnosticLocation::Config {
                        field: field.clone(),
                    })
                    .with_actual(declaration.clone()),
                ),
                Ok(glob) => {
                    let scan_root = glob.scan_root(root);
                    let prefix = scan_root
                        .strip_prefix(root)
                        .expect("glob scan root is within workspace");
                    if !prefix.as_os_str().is_empty() {
                        let prefix = prefix.to_string_lossy().replace('\\', "/");
                        let prefix =
                            WorkspacePath::parse_config(&prefix).expect("validated glob prefix");
                        if let Err(error) = WorkspaceBoundary::new(root)
                            .and_then(|boundary| boundary.resolve_scan_root(&prefix))
                            && !matches!(error, WorkspaceBoundaryError::NotFound { .. })
                        {
                            diagnostics.push(Diagnostic::error("config.pathBoundary", "Guideline scan prefix must remain within the workspace without symlink traversal.")
                                .with_path(source_path)
                                .with_location(DiagnosticLocation::Config { field: field.clone() })
                                .with_actual(declaration.clone()));
                            sources.push(GuidelineSource {
                                source_path: source_path.to_string(),
                                content_group: content_group.map(str::to_string),
                                field,
                                pattern: declaration.clone(),
                                paths,
                            });
                            continue;
                        }
                    }
                    let matches = WorkspacePatternSet::from_validated(root, [glob])
                        .matching_files_with_extensions(&["md", "mdx"]);
                    match matches {
                        Err(error) => diagnostics.push(
                            Diagnostic::error(
                                "config.guidelineUnreadable",
                                format!("Guideline glob could not be scanned: {error}."),
                            )
                            .with_path(source_path)
                            .with_location(DiagnosticLocation::Config {
                                field: field.clone(),
                            })
                            .with_actual(declaration.clone()),
                        ),
                        Ok(files) => {
                            for file in files {
                                let path = file
                                    .strip_prefix(root)
                                    .expect("workspace scan returns paths under root")
                                    .to_string_lossy()
                                    .replace('\\', "/");
                                let safe =
                                    WorkspacePath::parse_config(&path).ok().is_some_and(|path| {
                                        WorkspaceBoundary::new(root)
                                            .and_then(|boundary| {
                                                boundary.resolve_existing_file(&path)
                                            })
                                            .is_ok()
                                    });
                                if safe {
                                    paths.push(path);
                                } else {
                                    diagnostics.push(Diagnostic::error("config.pathBoundary", "Guideline match must be a regular file within the workspace without symlink traversal.")
                                        .with_path(source_path)
                                        .with_location(DiagnosticLocation::Config { field: field.clone() })
                                        .with_actual(path));
                                }
                            }
                            paths.sort();
                            if paths.is_empty() {
                                diagnostics.push(
                                    Diagnostic::warning(
                                        "config.guidelineGlobNoMatches",
                                        "Guideline glob matched no Markdown files.",
                                    )
                                    .with_path(source_path)
                                    .with_location(DiagnosticLocation::Config {
                                        field: field.clone(),
                                    })
                                    .with_actual(declaration.clone()),
                                );
                            }
                        }
                    }
                }
            }
        }
        for path in &paths {
            if seen.insert(path.clone()) {
                resolved.push(path.clone());
            }
        }
        sources.push(GuidelineSource {
            source_path: source_path.to_string(),
            content_group: content_group.map(str::to_string),
            field,
            pattern: declaration.clone(),
            paths,
        });
    }
    resolved
}
