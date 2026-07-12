import type {
    DashboardEntrySummary,
    DashboardTaxonomy,
    DashboardTaxonomyTerm,
    DashboardViewSummary,
    WorkspaceDashboardResult,
} from "@choral-forma/shared";

export type TaxonomyNode = { type: "taxonomy"; value: DashboardTaxonomy };
export type TermNode = { type: "term"; taxonomyId: string; value: DashboardTaxonomyTerm };
export type EntryNode = { type: "entry"; value: DashboardEntrySummary };
export type ViewsNode = { type: "views" };
export type ViewNode = { type: "view"; value: DashboardViewSummary };
export type FormaTreeNode = TaxonomyNode | TermNode | EntryNode | ViewsNode | ViewNode;

export function viewIconName(kind: string): string {
    switch (kind) {
        case "list":
            return "list";
        case "table":
            return "table-properties";
        case "kanban":
            return "kanban";
        case "graph":
            return "network";
        default:
            return "eye";
    }
}

export function treeNodeCommandId(node: FormaTreeNode): "forma.openViewPreview" | "vscode.open" | undefined {
    if (node.type === "view") return "forma.openViewPreview";
    if (node.type === "entry") return "vscode.open";
    return undefined;
}

export function workspaceTreeRoots(dashboard: WorkspaceDashboardResult | undefined): FormaTreeNode[] {
    if (!dashboard) return [];
    return [
        ...dashboard.taxonomies.map((value): TaxonomyNode => ({ type: "taxonomy", value })),
        ...(dashboard.views.length > 0 ? ([{ type: "views" }] satisfies ViewsNode[]) : []),
    ];
}

export function workspaceTreeChildren(
    dashboard: WorkspaceDashboardResult | undefined,
    node: FormaTreeNode,
): FormaTreeNode[] {
    if (!dashboard) return [];
    if (node.type === "taxonomy") {
        return node.value.terms.map((value): TermNode => ({ type: "term", taxonomyId: node.value.id, value }));
    }
    if (node.type === "term") {
        return node.value.entries.map((value): EntryNode => ({ type: "entry", value }));
    }
    if (node.type === "views") {
        return dashboard.views.map((value): ViewNode => ({ type: "view", value }));
    }
    return [];
}
