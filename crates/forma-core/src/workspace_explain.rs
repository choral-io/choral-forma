use std::collections::BTreeSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::boundary::{WorkspaceBoundary, WorkspaceBoundaryError};
use crate::classification::{ManagedDocumentKind, classify_managed_document};
use crate::config::{FormaWorkspace, load_workspace};
use crate::diagnostics::{Diagnostic, DiagnosticSummary, OperationStatus};
use crate::index::{Discovery, discover_loaded_workspace, resolve_space_entry_path};
use crate::model::{ContentGroupId, ResolvedWorkspaceModel};
use crate::operations::{OperationError, WorkspaceSummary};
use crate::path::WorkspacePath;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplainResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub target: WorkspaceExplainTarget,
    pub content_groups: Vec<WorkspaceExplainContentGroupCandidate>,
    pub taxonomies: Vec<WorkspaceExplainTaxonomyMembership>,
    pub effective: WorkspaceExplainEffective,
    pub provenance: WorkspaceExplainProvenance,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplainTarget {
    pub path: String,
    pub exists: bool,
    pub kind: ManagedDocumentKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplainContentGroupCandidate {
    pub id: String,
    pub matched_include_patterns: Vec<String>,
    pub selected: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplainTaxonomyMembership {
    pub taxonomy: String,
    pub term: String,
    pub matched_patterns: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_group: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplainEffective {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub selected_content_group: Option<String>,
    pub schema_configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template: Option<String>,
    pub create_configured: bool,
    pub guidelines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplainProvenance {
    pub sources: Vec<String>,
}

pub fn explain_workspace_path(
    root: impl AsRef<Path>,
    path: &str,
) -> Result<WorkspaceExplainResult, OperationError> {
    let path = WorkspacePath::parse_cli(path)?;
    let workspace = load_workspace(root.as_ref())?;
    let discovery = discover_loaded_workspace(&workspace);
    explain_loaded_workspace(&workspace, discovery, path)
}

pub fn explain_workspace_entry(
    root: impl AsRef<Path>,
    space: &str,
    entry: &str,
) -> Result<WorkspaceExplainResult, OperationError> {
    let workspace = load_workspace(root.as_ref())?;
    let discovery = discover_loaded_workspace(&workspace);
    let path = resolve_space_entry_path(&discovery.index.entries, space, entry)?;
    let path = WorkspacePath::parse_config(path)
        .expect("the summary index contains workspace-relative paths");
    explain_loaded_workspace(&workspace, discovery, path)
}

fn explain_loaded_workspace(
    workspace: &FormaWorkspace,
    discovery: Discovery,
    path: WorkspacePath,
) -> Result<WorkspaceExplainResult, OperationError> {
    let path_str = path.as_str();
    let boundary = WorkspaceBoundary::new(&workspace.root)?;
    let exists = match boundary.resolve_existing_file(&path) {
        Ok(_) => true,
        Err(WorkspaceBoundaryError::NotFound { .. }) => false,
        Err(error) => return Err(error.into()),
    };

    let view_paths = discovery
        .index
        .views
        .iter()
        .map(|view| view.path.clone())
        .collect::<BTreeSet<_>>();
    let scan_plan = workspace.model.scan_plan();
    let kind =
        classify_managed_document(path_str, scan_plan, scan_plan.control_paths(), &view_paths);
    let selected_content_group = selected_content_group(&discovery, path_str);
    let content_groups = content_group_candidates(
        &workspace.model,
        path_str,
        selected_content_group.as_deref(),
    );
    let taxonomies = taxonomy_memberships(&workspace.model, path_str);
    let effective = effective_configuration(workspace, selected_content_group.as_deref());
    let provenance = relevant_provenance(workspace, path_str, &content_groups, &taxonomies);

    let mut diagnostics = workspace.diagnostics.clone();
    for diagnostic in discovery
        .diagnostics
        .into_iter()
        .filter(|diagnostic| diagnostic.path.as_deref() == Some(path_str))
    {
        if !diagnostics.contains(&diagnostic) {
            diagnostics.push(diagnostic);
        }
    }
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(WorkspaceExplainResult {
        schema_version: 1,
        operation: "workspace.explain".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: None,
        },
        target: WorkspaceExplainTarget {
            path: path_str.to_string(),
            exists,
            kind,
        },
        content_groups,
        taxonomies,
        effective,
        provenance,
        summary,
        diagnostics,
    })
}

fn selected_content_group(discovery: &Discovery, path: &str) -> Option<String> {
    discovery.index.entries.iter().find_map(|entry| {
        (entry.path == path || entry.variants.iter().any(|variant| variant.path == path))
            .then(|| entry.space.clone())
    })
}

fn content_group_candidates(
    model: &ResolvedWorkspaceModel,
    path: &str,
    selected_content_group: Option<&str>,
) -> Vec<WorkspaceExplainContentGroupCandidate> {
    model
        .scan_plan()
        .space_patterns()
        .iter()
        .filter_map(|(id, patterns)| {
            let matched_include_patterns = patterns.matching_patterns(path);
            (!matched_include_patterns.is_empty()).then(|| WorkspaceExplainContentGroupCandidate {
                id: id.clone(),
                matched_include_patterns,
                selected: selected_content_group == Some(id.as_str()),
            })
        })
        .collect()
}

fn taxonomy_memberships(
    model: &ResolvedWorkspaceModel,
    path: &str,
) -> Vec<WorkspaceExplainTaxonomyMembership> {
    model
        .scan_plan()
        .taxonomy_term_patterns()
        .iter()
        .flat_map(|(taxonomy, terms)| {
            terms.iter().filter_map(move |(term, patterns)| {
                let matched_patterns = patterns.matching_patterns(path);
                (!matched_patterns.is_empty()).then(|| WorkspaceExplainTaxonomyMembership {
                    taxonomy: taxonomy.clone(),
                    term: term.clone(),
                    matched_patterns,
                    content_group: model
                        .content_group_id_for_taxonomy_term(taxonomy, term)
                        .map(|id| id.as_str().to_string()),
                })
            })
        })
        .collect()
}

fn effective_configuration(
    workspace: &FormaWorkspace,
    selected_content_group: Option<&str>,
) -> WorkspaceExplainEffective {
    let content_group = selected_content_group.and_then(|id| workspace.model.content_group(id));
    let mut guidelines = workspace.config.guidelines.clone();
    if let Some(content_group) = content_group {
        for guideline in &content_group.guidelines {
            if !guidelines.contains(guideline) {
                guidelines.push(guideline.clone());
            }
        }
    }

    WorkspaceExplainEffective {
        selected_content_group: selected_content_group.map(str::to_string),
        schema_configured: content_group.is_some(),
        template: content_group
            .filter(|content_group| !content_group.template.is_empty())
            .map(|content_group| content_group.template.clone()),
        create_configured: content_group
            .is_some_and(|content_group| content_group.create.is_some()),
        guidelines,
    }
}

fn relevant_provenance(
    workspace: &FormaWorkspace,
    target_path: &str,
    content_groups: &[WorkspaceExplainContentGroupCandidate],
    taxonomies: &[WorkspaceExplainTaxonomyMembership],
) -> WorkspaceExplainProvenance {
    let model = &workspace.model;
    let graph = model.config_graph();
    let mut sources = BTreeSet::from([graph.root().source_path().to_string()]);

    for membership in taxonomies {
        if let Some(taxonomy) = graph
            .taxonomies()
            .get(&crate::model::TaxonomyId::new(&membership.taxonomy))
        {
            sources.insert(taxonomy.provenance().source_path().to_string());
        }
        if let Some(term) = graph.terms().get(&crate::model::TaxonomyTermId::new(
            &membership.taxonomy,
            &membership.term,
        )) {
            sources.insert(term.provenance().source_path().to_string());
        }
    }

    for candidate in content_groups {
        add_content_group_provenance(model, &candidate.id, &mut sources);
    }

    if workspace
        .config_sources
        .iter()
        .any(|source| source.path == target_path)
    {
        sources.insert(target_path.to_string());
    }
    for (id, content_group) in model.content_groups() {
        if content_group.template == target_path
            || content_group
                .guidelines
                .iter()
                .any(|guideline| guideline == target_path)
        {
            add_content_group_provenance(model, id.as_str(), &mut sources);
        }
    }

    WorkspaceExplainProvenance {
        sources: sources.into_iter().collect(),
    }
}

fn add_content_group_provenance(
    model: &ResolvedWorkspaceModel,
    content_group_id: &str,
    sources: &mut BTreeSet<String>,
) {
    let graph = model.config_graph();
    for (term_id, mapped_content_group_id) in model.content_group_term_ids() {
        if mapped_content_group_id != &ContentGroupId::new(content_group_id) {
            continue;
        }
        if let Some(taxonomy) = graph.taxonomies().get(term_id.taxonomy()) {
            sources.insert(taxonomy.provenance().source_path().to_string());
        }
        if let Some(term) = graph.terms().get(term_id) {
            sources.insert(term.provenance().source_path().to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{explain_workspace_entry, explain_workspace_path};
    use crate::{ManagedDocumentKind, OperationError};

    #[test]
    fn explains_configured_content_with_qualified_memberships_and_effective_config() {
        let root = fixture_root("configured-content");
        write_explain_fixture(&root);
        fs::write(root.join("content/item.md"), "---\ntitle: Item\n---\n").unwrap();

        let result = explain_workspace_path(&root, "content/item.md").unwrap();

        assert_eq!(result.operation, "workspace.explain");
        assert_eq!(result.target.path, "content/item.md");
        assert!(result.target.exists);
        assert_eq!(result.target.kind, ManagedDocumentKind::Content);
        assert_eq!(result.content_groups.len(), 1);
        assert_eq!(result.content_groups[0].id, "notes");
        assert_eq!(
            result.content_groups[0].matched_include_patterns,
            ["content/**/*.md"]
        );
        assert!(result.content_groups[0].selected);
        assert_eq!(result.taxonomies.len(), 2);
        assert_eq!(result.taxonomies[0].taxonomy, "areas");
        assert_eq!(result.taxonomies[0].term, "notes");
        assert_eq!(result.taxonomies[0].content_group.as_deref(), Some("notes"));
        assert_eq!(result.taxonomies[1].taxonomy, "labels");
        assert_eq!(result.taxonomies[1].term, "notes");
        assert_eq!(result.taxonomies[1].content_group, None);
        assert_eq!(
            result.effective.selected_content_group.as_deref(),
            Some("notes")
        );
        assert!(result.effective.schema_configured);
        assert_eq!(
            result.effective.template.as_deref(),
            Some("controls/template.md")
        );
        assert!(result.effective.create_configured);
        assert_eq!(
            result.effective.guidelines,
            ["controls/root-guide.md", "controls/space-guide.md"]
        );
        assert!(result.provenance.sources.contains(&".forma.md".to_string()));
        assert!(
            result
                .provenance
                .sources
                .contains(&".forma/nodes/notes.md".to_string())
        );
        assert!(
            result
                .provenance
                .sources
                .windows(2)
                .all(|sources| sources[0] < sources[1])
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn distinguishes_unmanaged_control_view_and_explainable_missing_paths() {
        let root = fixture_root("path-kinds");
        write_explain_fixture(&root);
        fs::write(root.join("loose.md"), "# Loose\n").unwrap();

        let unmanaged = explain_workspace_path(&root, "loose.md").unwrap();
        assert!(unmanaged.target.exists);
        assert_eq!(unmanaged.target.kind, ManagedDocumentKind::Unmanaged);
        assert!(unmanaged.content_groups.is_empty());

        let control = explain_workspace_path(&root, "controls/template.md").unwrap();
        assert_eq!(control.target.kind, ManagedDocumentKind::Control);
        assert!(
            control
                .provenance
                .sources
                .contains(&".forma/nodes/notes.md".to_string())
        );

        let view = explain_workspace_path(&root, ".forma/nodes/list-view.md").unwrap();
        assert_eq!(view.target.kind, ManagedDocumentKind::View);
        assert!(view.content_groups.is_empty());

        let missing = explain_workspace_path(&root, "content/missing.md").unwrap();
        assert!(!missing.target.exists);
        assert_eq!(missing.target.kind, ManagedDocumentKind::Content);
        assert_eq!(missing.content_groups.len(), 1);
        assert!(!missing.content_groups[0].selected);
        assert_eq!(missing.effective.selected_content_group, None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_all_candidates_but_only_the_actual_index_selection() {
        let root = fixture_root("ambiguous-content-groups");
        write_explain_fixture(&root);
        fs::write(
            root.join("shared/ambiguous.md"),
            "---\ntitle: Ambiguous\n---\n",
        )
        .unwrap();

        let result = explain_workspace_path(&root, "shared/ambiguous.md").unwrap();

        assert_eq!(
            result
                .content_groups
                .iter()
                .map(|candidate| candidate.id.as_str())
                .collect::<Vec<_>>(),
            ["notes", "other"]
        );
        assert!(
            result
                .content_groups
                .iter()
                .all(|candidate| !candidate.selected)
        );
        assert_eq!(result.effective.selected_content_group, None);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "taxonomy.membership.ambiguous")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reuses_entry_locator_errors_and_rejects_traversal_and_symlinks() {
        let root = fixture_root("locator-boundary");
        write_explain_fixture(&root);
        fs::write(root.join("content/unique.md"), "---\ntitle: Unique\n---\n").unwrap();

        let located = explain_workspace_entry(&root, "notes", "unique").unwrap();
        assert_eq!(located.target.path, "content/unique.md");
        assert!(matches!(
            explain_workspace_entry(&root, "notes", "missing"),
            Err(OperationError::EntryNotFound)
        ));
        assert!(matches!(
            explain_workspace_path(&root, "../outside.md"),
            Err(OperationError::InvalidPath(_))
        ));

        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(root.join("content/unique.md"), root.join("linked.md"))
                .unwrap();
            assert!(matches!(
                explain_workspace_path(&root, "linked.md"),
                Err(OperationError::Boundary(
                    crate::WorkspaceBoundaryError::Symlink { .. }
                ))
            ));
        }

        fs::remove_dir_all(root).unwrap();
    }

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-workspace-explain-{name}-{unique}"))
    }

    fn write_explain_fixture(root: &Path) {
        for directory in [".forma/nodes", "content", "shared", "controls"] {
            fs::create_dir_all(root.join(directory)).unwrap();
        }
        fs::write(
            root.join(".forma.md"),
            r#"---
schemaVersion: 1
workspace:
  name: Explain Fixture
  canonicalLanguage: en
  supportedLanguages: [en]
  timezone: UTC
imports:
  - .forma/nodes/*.md
guidelines:
  - controls/root-guide.md
---
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/nodes/areas.md"),
            r#"---
schemaVersion: 1
kind: taxonomy
id: areas
projection: contentGroups
title: Areas
mode: primary
---
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/nodes/labels.md"),
            r#"---
schemaVersion: 1
kind: taxonomy
id: labels
title: Labels
mode: multiple
---
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/nodes/notes.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: areas
id: notes
title: Notes
include:
  - content/**/*.md
  - shared/**/*.md
create:
  directory: content
  filename: "{{ input.slug }}.md"
  template: controls/template.md
guidelines:
  - controls/space-guide.md
schema:
  type: object
  fields:
    title:
      type: string
---
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/nodes/other.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: areas
id: other
title: Other
include:
  - shared/**/*.md
schema:
  type: object
  fields: {}
---
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/nodes/notes-label.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: labels
id: notes
title: Notes Label
include:
  - content/**/*.md
---
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/nodes/list-view.md"),
            r#"---
schemaVersion: 1
kind: view
mode: list
title: List View
source:
  type: pages
---
"#,
        )
        .unwrap();
        fs::write(root.join("controls/template.md"), "# {{ input.title }}\n").unwrap();
        fs::write(root.join("controls/root-guide.md"), "# Root guide\n").unwrap();
        fs::write(root.join("controls/space-guide.md"), "# Space guide\n").unwrap();
    }
}
