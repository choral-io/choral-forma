import type {
    DashboardEntrySummary,
    DashboardViewSummary,
    ExplorerTaxonomy,
    ExplorerTaxonomyTerm,
    WorkspaceExplorerResult,
} from "@choral-forma/shared";

export type TaxonomyNode = { type: "taxonomy"; value: ExplorerTaxonomy };
export type TermNode = { type: "term"; taxonomyId: string; value: ExplorerTaxonomyTerm };
export type EntryNode = { type: "entry"; value: DashboardEntrySummary };
export type ViewsNode = { type: "views" };
export type ViewNode = { type: "view"; value: DashboardViewSummary };
export type LoadMoreNode = { type: "loadMore"; taxonomyId: string; termId: string; cursor: string };
export type FormaTreeNode = TaxonomyNode | TermNode | EntryNode | ViewsNode | ViewNode | LoadMoreNode;

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

export function treeNodeIconName(node: FormaTreeNode): string {
    switch (node.type) {
        case "loadMore":
            return "ellipsis";
        case "taxonomy":
            return "tags";
        case "term":
            return node.value.status === "passed" ? "folder" : "triangle-alert";
        case "views":
            return "panels-top-left";
        case "view":
            return viewIconName(node.value.kind);
        case "entry":
            return "file-text";
    }
}

export function treeNodeCommandId(node: FormaTreeNode): "forma.openViewPreview" | "vscode.open" | undefined {
    if (node.type === "view") return "forma.openViewPreview";
    if (node.type === "entry") return "vscode.open";
    return undefined;
}

export function workspaceTreeRoots(explorer: WorkspaceExplorerResult | undefined): FormaTreeNode[] {
    if (!explorer) return [];
    return [
        ...explorer.taxonomies.map((value): TaxonomyNode => ({ type: "taxonomy", value })),
        ...(explorer.views.length > 0 ? ([{ type: "views" }] satisfies ViewsNode[]) : []),
    ];
}

export function workspaceTreeChildren(
    explorer: WorkspaceExplorerResult | undefined,
    node: FormaTreeNode,
    termEntries: DashboardEntrySummary[] = [],
    nextCursor?: string,
): FormaTreeNode[] {
    if (!explorer) return [];
    if (node.type === "taxonomy") {
        return node.value.terms.map((value): TermNode => ({ type: "term", taxonomyId: node.value.id, value }));
    }
    if (node.type === "term") {
        return [
            ...termEntries.map((value): EntryNode => ({ type: "entry", value })),
            ...(nextCursor
                ? ([
                      {
                          type: "loadMore",
                          taxonomyId: node.taxonomyId,
                          termId: node.value.id,
                          cursor: nextCursor,
                      },
                  ] satisfies LoadMoreNode[])
                : []),
        ];
    }
    if (node.type === "views") {
        return explorer.views.map((value): ViewNode => ({ type: "view", value }));
    }
    return [];
}
