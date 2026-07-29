use std::collections::BTreeMap;
use std::fmt;
use std::sync::Arc;

use crate::config::{SemanticType, SpaceDefinition, WorkspaceConfig};
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::path::WorkspacePath;
use crate::scan::WorkspaceScanPlan;

macro_rules! typed_id {
    ($name:ident) => {
        #[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
        pub struct $name(String);

        impl $name {
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str(self.as_str())
            }
        }
    };
}

typed_id!(TaxonomyId);
typed_id!(TermId);
typed_id!(ContentGroupId);
typed_id!(SemanticTypeId);

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct TaxonomyTermId {
    taxonomy: TaxonomyId,
    term: TermId,
}

impl TaxonomyTermId {
    pub fn new(taxonomy: impl Into<String>, term: impl Into<String>) -> Self {
        Self {
            taxonomy: TaxonomyId::new(taxonomy),
            term: TermId::new(term),
        }
    }

    pub fn taxonomy(&self) -> &TaxonomyId {
        &self.taxonomy
    }

    pub fn term(&self) -> &TermId {
        &self.term
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigProvenance {
    source_path: String,
}

impl ConfigProvenance {
    pub fn new(source_path: impl Into<String>) -> Self {
        Self {
            source_path: source_path.into(),
        }
    }

    pub fn source_path(&self) -> &str {
        &self.source_path
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigProjection {
    ContentGroups,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TypedTaxonomyNode {
    id: TaxonomyId,
    projection: Option<ConfigProjection>,
    provenance: ConfigProvenance,
}

impl TypedTaxonomyNode {
    pub(crate) fn new(
        id: TaxonomyId,
        projection: Option<ConfigProjection>,
        provenance: ConfigProvenance,
    ) -> Self {
        Self {
            id,
            projection,
            provenance,
        }
    }

    pub fn id(&self) -> &TaxonomyId {
        &self.id
    }

    pub fn projection(&self) -> Option<ConfigProjection> {
        self.projection
    }

    pub fn provenance(&self) -> &ConfigProvenance {
        &self.provenance
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TypedTermNode {
    id: TaxonomyTermId,
    provenance: ConfigProvenance,
    content_group_candidate: Option<SpaceDefinition>,
}

impl TypedTermNode {
    pub(crate) fn new(
        id: TaxonomyTermId,
        provenance: ConfigProvenance,
        content_group_candidate: Option<SpaceDefinition>,
    ) -> Self {
        Self {
            id,
            provenance,
            content_group_candidate,
        }
    }

    pub fn id(&self) -> &TaxonomyTermId {
        &self.id
    }

    pub fn provenance(&self) -> &ConfigProvenance {
        &self.provenance
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TypedSemanticTypeNode {
    id: SemanticTypeId,
    provenance: ConfigProvenance,
}

impl TypedSemanticTypeNode {
    pub(crate) fn new(id: SemanticTypeId, provenance: ConfigProvenance) -> Self {
        Self { id, provenance }
    }

    pub fn id(&self) -> &SemanticTypeId {
        &self.id
    }

    pub fn provenance(&self) -> &ConfigProvenance {
        &self.provenance
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TypedConfigGraph {
    root: ConfigProvenance,
    taxonomies: BTreeMap<TaxonomyId, TypedTaxonomyNode>,
    terms: BTreeMap<TaxonomyTermId, TypedTermNode>,
    semantic_types: BTreeMap<SemanticTypeId, TypedSemanticTypeNode>,
}

impl TypedConfigGraph {
    pub(crate) fn new(root: ConfigProvenance) -> Self {
        Self {
            root,
            taxonomies: BTreeMap::new(),
            terms: BTreeMap::new(),
            semantic_types: BTreeMap::new(),
        }
    }

    pub(crate) fn insert_taxonomy(&mut self, node: TypedTaxonomyNode) {
        self.taxonomies.insert(node.id.clone(), node);
    }

    pub(crate) fn insert_term(&mut self, node: TypedTermNode) {
        self.terms.insert(node.id.clone(), node);
    }

    pub(crate) fn insert_semantic_type(&mut self, node: TypedSemanticTypeNode) {
        self.semantic_types.insert(node.id.clone(), node);
    }

    pub fn root(&self) -> &ConfigProvenance {
        &self.root
    }

    pub fn taxonomies(&self) -> &BTreeMap<TaxonomyId, TypedTaxonomyNode> {
        &self.taxonomies
    }

    pub fn terms(&self) -> &BTreeMap<TaxonomyTermId, TypedTermNode> {
        &self.terms
    }

    pub fn semantic_types(&self) -> &BTreeMap<SemanticTypeId, TypedSemanticTypeNode> {
        &self.semantic_types
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedWorkspaceModel {
    config_graph: TypedConfigGraph,
    content_groups: BTreeMap<ContentGroupId, SpaceDefinition>,
    content_group_terms: BTreeMap<TaxonomyTermId, ContentGroupId>,
    semantic_type_targets: BTreeMap<SemanticTypeId, ContentGroupId>,
    scan_plan: Arc<WorkspaceScanPlan>,
}

impl ResolvedWorkspaceModel {
    pub fn config_graph(&self) -> &TypedConfigGraph {
        &self.config_graph
    }

    pub fn content_groups(&self) -> &BTreeMap<ContentGroupId, SpaceDefinition> {
        &self.content_groups
    }

    pub fn content_group(&self, id: &str) -> Option<&SpaceDefinition> {
        self.content_groups.get(&ContentGroupId::new(id))
    }

    #[cfg(test)]
    pub(crate) fn content_group_mut(&mut self, id: &str) -> Option<&mut SpaceDefinition> {
        self.content_groups.get_mut(&ContentGroupId::new(id))
    }

    pub fn content_group_for_taxonomy_term(
        &self,
        taxonomy_id: &str,
        term_id: &str,
    ) -> Option<&SpaceDefinition> {
        let content_group_id = self
            .content_group_terms
            .get(&TaxonomyTermId::new(taxonomy_id, term_id))?;
        self.content_groups.get(content_group_id)
    }

    pub fn content_group_term_ids(
        &self,
    ) -> impl Iterator<Item = (&TaxonomyTermId, &ContentGroupId)> {
        self.content_group_terms.iter()
    }

    pub fn semantic_type_target(&self, type_id: &str) -> Option<&ContentGroupId> {
        self.semantic_type_targets
            .get(&SemanticTypeId::new(type_id))
    }

    pub fn scan_plan(&self) -> &WorkspaceScanPlan {
        &self.scan_plan
    }

    pub fn scan_plan_arc(&self) -> Arc<WorkspaceScanPlan> {
        Arc::clone(&self.scan_plan)
    }
}

#[derive(Debug, Clone)]
pub(crate) struct ResolvedWorkspaceRelationships {
    config_graph: TypedConfigGraph,
    content_groups: BTreeMap<ContentGroupId, SpaceDefinition>,
    content_group_terms: BTreeMap<TaxonomyTermId, ContentGroupId>,
    semantic_type_targets: BTreeMap<SemanticTypeId, ContentGroupId>,
}

impl ResolvedWorkspaceRelationships {
    pub(crate) fn resolve(
        config_graph: TypedConfigGraph,
        types: &BTreeMap<String, SemanticType>,
        diagnostics: &mut Vec<Diagnostic>,
    ) -> Self {
        let explicit_projections = config_graph
            .taxonomies
            .values()
            .filter(|node| node.projection == Some(ConfigProjection::ContentGroups))
            .collect::<Vec<_>>();

        let projected_taxonomy = match explicit_projections.as_slice() {
            [] => legacy_content_group_taxonomy(&config_graph, diagnostics),
            [node] => Some(node.id.clone()),
            nodes => {
                for node in nodes {
                    diagnostics.push(
                        Diagnostic::error(
                            "config.projection.multipleContentGroups",
                            "Only one taxonomy may declare `projection: contentGroups`.",
                        )
                        .with_path(node.provenance.source_path.clone())
                        .with_location(DiagnosticLocation::Frontmatter {
                            field: "projection".to_string(),
                            index: None,
                        })
                        .with_actual("contentGroups")
                        .with_expected("one configured content-group projection"),
                    );
                }
                None
            }
        };

        let mut content_groups = BTreeMap::new();
        let mut content_group_terms = BTreeMap::new();
        let mut content_group_sources = BTreeMap::new();
        if let Some(taxonomy_id) = projected_taxonomy {
            for (term_id, node) in &config_graph.terms {
                if term_id.taxonomy != taxonomy_id {
                    continue;
                }
                let Some(definition) = node.content_group_candidate.clone() else {
                    continue;
                };
                let content_group_id = ContentGroupId::new(term_id.term.as_str());
                add_source_aliases(
                    &mut content_group_sources,
                    node.provenance.source_path(),
                    &content_group_id,
                );
                content_group_terms.insert(term_id.clone(), content_group_id.clone());
                content_groups.insert(content_group_id, definition);
            }
        }

        let mut semantic_type_targets = BTreeMap::new();
        for (type_name, semantic_type) in types {
            let SemanticType::EntryRef { source, .. } = semantic_type else {
                continue;
            };
            let provenance = config_graph
                .semantic_types
                .get(&SemanticTypeId::new(type_name))
                .map(TypedSemanticTypeNode::provenance)
                .unwrap_or_else(|| config_graph.root());
            match WorkspacePath::parse_config(source) {
                Ok(path) => {
                    if let Some(content_group_id) = content_group_sources.get(path.as_str()) {
                        semantic_type_targets
                            .insert(SemanticTypeId::new(type_name), content_group_id.clone());
                    } else {
                        diagnostics.push(
                            Diagnostic::error(
                                "config.type.sourceMissing",
                                format!(
                                    "Type `{type_name}` source does not reference a configured content group."
                                ),
                            )
                            .with_path(provenance.source_path())
                            .with_location(DiagnosticLocation::Config {
                                field: format!("types.{type_name}.source"),
                            })
                            .with_actual(source.clone()),
                        );
                    }
                }
                Err(error) => diagnostics.push(
                    Diagnostic::error(
                        "config.pathInvalid",
                        format!("Type `{type_name}` source path is invalid: {error}."),
                    )
                    .with_path(provenance.source_path())
                    .with_location(DiagnosticLocation::Config {
                        field: format!("types.{type_name}.source"),
                    })
                    .with_actual(source.clone()),
                ),
            }
        }

        Self {
            config_graph,
            content_groups,
            content_group_terms,
            semantic_type_targets,
        }
    }

    pub(crate) fn compatibility_spaces(&self) -> BTreeMap<String, SpaceDefinition> {
        self.content_groups
            .iter()
            .map(|(id, definition)| (id.as_str().to_string(), definition.clone()))
            .collect()
    }

    pub(crate) fn content_groups(&self) -> &BTreeMap<ContentGroupId, SpaceDefinition> {
        &self.content_groups
    }

    pub(crate) fn content_group_for_taxonomy_term(
        &self,
        taxonomy_id: &str,
        term_id: &str,
    ) -> Option<&SpaceDefinition> {
        let content_group_id = self
            .content_group_terms
            .get(&TaxonomyTermId::new(taxonomy_id, term_id))?;
        self.content_groups.get(content_group_id)
    }

    pub(crate) fn content_group_term_ids(
        &self,
    ) -> impl Iterator<Item = (&TaxonomyTermId, &ContentGroupId)> {
        self.content_group_terms.iter()
    }

    pub(crate) fn finish(self, scan_plan: Arc<WorkspaceScanPlan>) -> ResolvedWorkspaceModel {
        ResolvedWorkspaceModel {
            config_graph: self.config_graph,
            content_groups: self.content_groups,
            content_group_terms: self.content_group_terms,
            semantic_type_targets: self.semantic_type_targets,
            scan_plan,
        }
    }
}

fn legacy_content_group_taxonomy(
    graph: &TypedConfigGraph,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<TaxonomyId> {
    let taxonomy_id = TaxonomyId::new("spaces");
    let provenance = graph
        .taxonomies
        .get(&taxonomy_id)
        .map(TypedTaxonomyNode::provenance)
        .or_else(|| {
            graph
                .terms
                .iter()
                .find(|(id, _)| id.taxonomy == taxonomy_id)
                .map(|(_, node)| node.provenance())
        })?;
    diagnostics.push(
        Diagnostic::warning(
            "config.projection.compatibilitySpaces",
            "Taxonomy id `spaces` is using the legacy content-group compatibility adapter.",
        )
        .with_path(provenance.source_path())
        .with_location(DiagnosticLocation::Frontmatter {
            field: "projection".to_string(),
            index: None,
        })
        .with_actual("id: spaces")
        .with_expected("projection: contentGroups"),
    );
    Some(taxonomy_id)
}

fn add_source_aliases(
    aliases: &mut BTreeMap<String, ContentGroupId>,
    public_path: &str,
    content_group_id: &ContentGroupId,
) {
    aliases.insert(public_path.to_string(), content_group_id.clone());
    if let Some(without_extension) = public_path
        .strip_suffix(".md")
        .or_else(|| public_path.strip_suffix(".mdx"))
    {
        aliases.insert(without_extension.to_string(), content_group_id.clone());
    }
}

pub(crate) fn resolve_workspace_model(
    config_graph: TypedConfigGraph,
    config: &WorkspaceConfig,
    bootstrap_scan_plan: WorkspaceScanPlan,
    config_sources: impl IntoIterator<Item = String>,
    diagnostics: &mut Vec<Diagnostic>,
) -> (
    BTreeMap<String, SpaceDefinition>,
    Arc<ResolvedWorkspaceModel>,
) {
    let relationships =
        ResolvedWorkspaceRelationships::resolve(config_graph, &config.types, diagnostics);
    let compatibility_spaces = relationships.compatibility_spaces();
    let scan_plan =
        WorkspaceScanPlan::resolve(bootstrap_scan_plan, config, &relationships, config_sources);
    diagnostics.extend(scan_plan.diagnostics().iter().cloned());
    (
        compatibility_spaces,
        Arc::new(relationships.finish(scan_plan)),
    )
}
