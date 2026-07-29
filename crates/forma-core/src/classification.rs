use std::collections::BTreeSet;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::scan::WorkspaceScanPlan;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ManagedDocumentKind {
    Content,
    View,
    Control,
    Unmanaged,
}

impl ManagedDocumentKind {
    pub fn is_language_document(self) -> bool {
        matches!(self, Self::Content | Self::View)
    }

    pub fn is_scope_relevant(self) -> bool {
        !matches!(self, Self::Unmanaged)
    }
}

pub(crate) fn classify_managed_document(
    source_path: &str,
    scan_plan: &WorkspaceScanPlan,
    control_paths: &BTreeSet<String>,
    view_paths: &BTreeSet<String>,
) -> ManagedDocumentKind {
    if !matches!(
        Path::new(source_path)
            .extension()
            .and_then(|value| value.to_str()),
        Some("md" | "mdx")
    ) {
        return ManagedDocumentKind::Unmanaged;
    }
    if view_paths.contains(source_path) {
        return ManagedDocumentKind::View;
    }
    if scan_plan.taxonomy_patterns().is_match(source_path) {
        return ManagedDocumentKind::Content;
    }
    if control_paths.contains(source_path) || scan_plan.config_patterns().is_match(source_path) {
        return ManagedDocumentKind::Control;
    }
    ManagedDocumentKind::Unmanaged
}
