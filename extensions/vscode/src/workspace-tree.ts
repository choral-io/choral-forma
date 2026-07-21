import type { DashboardEntrySummary } from "@choral-forma/shared";
import * as vscode from "vscode";

import { formatFormaError } from "./forma-client.ts";
import { GenerationRefresh } from "./generation-refresh.ts";
import type { FormaRuntime } from "./runtime.ts";
import { WorkspaceIconResolver } from "./workspace-icon-resolver.ts";
import { workspaceExplorerMessage } from "./workspace-tree-message.ts";
import {
    type FormaTreeNode,
    treeNodeCommandId,
    workspaceTreeChildren,
    workspaceTreeRoots,
} from "./workspace-tree-model.ts";
import { treeNodePresentation } from "./workspace-tree-presentation.ts";

export class FormaWorkspaceExplorer implements vscode.Disposable {
    private explorer: Awaited<ReturnType<FormaRuntime["workspaceExplorer"]>>;
    private readonly termPages = new Map<string, { entries: DashboardEntrySummary[]; nextCursor?: string }>();
    private readonly termLoads = new Map<string, Promise<void>>();
    private readonly changed = new vscode.EventEmitter<FormaTreeNode | undefined>();
    private readonly treeView: vscode.TreeView<FormaTreeNode>;
    private readonly iconResolver: WorkspaceIconResolver;
    private readonly refreshes = new GenerationRefresh();

    constructor(
        private readonly runtime: FormaRuntime,
        context: vscode.ExtensionContext,
    ) {
        this.iconResolver = new WorkspaceIconResolver(context.extensionUri);
        this.treeView = vscode.window.createTreeView("forma.workspace", {
            treeDataProvider: {
                onDidChangeTreeData: this.changed.event,
                getTreeItem: (node) => this.treeItem(node),
                getChildren: async (node) => await this.children(node),
            },
            showCollapseAll: true,
        });
        context.subscriptions.push(
            this,
            this.treeView,
            vscode.commands.registerCommand("forma.loadMoreExplorerEntries", async (node: FormaTreeNode) => {
                if (node.type !== "loadMore") return;
                await this.loadTermPage(node.taxonomyId, node.termId, node.cursor);
                this.changed.fire(undefined);
            }),
        );
    }

    async refresh(): Promise<void> {
        await this.refreshes.run(this.runtime.analysisGeneration, async () => {
            let loadFailed = false;
            try {
                this.explorer = await this.runtime.workspaceExplorer();
                this.termPages.clear();
            } catch (error) {
                loadFailed = true;
                this.explorer = undefined;
                this.termPages.clear();
                this.runtime.logResult({ explorerError: formatFormaError(error) });
            }
            this.treeView.message = workspaceExplorerMessage(
                Boolean(this.explorer),
                loadFailed,
                this.runtime.state.kind,
            );
            this.changed.fire(undefined);
        });
    }

    dispose(): void {
        this.changed.dispose();
    }

    private treeItem(node: FormaTreeNode): vscode.TreeItem {
        if (node.type === "loadMore") {
            const item = new vscode.TreeItem("Load more…", vscode.TreeItemCollapsibleState.None);
            item.id = `load-more:${node.taxonomyId}:${node.termId}:${node.cursor}`;
            item.iconPath = this.iconResolver.resolve(treeNodePresentation(node));
            item.command = {
                command: "forma.loadMoreExplorerEntries",
                title: "Load more entries",
                arguments: [node],
            };
            return item;
        }
        if (node.type === "taxonomy") {
            const item = new vscode.TreeItem(node.value.title, vscode.TreeItemCollapsibleState.Collapsed);
            item.id = `taxonomy:${node.value.id}`;
            item.description = String(node.value.terms.length);
            item.tooltip = node.value.description ?? `${node.value.title} taxonomy`;
            item.iconPath = this.iconResolver.resolve(treeNodePresentation(node));
            return item;
        }
        if (node.type === "term") {
            const item = new vscode.TreeItem(node.value.title, vscode.TreeItemCollapsibleState.Collapsed);
            item.id = `term:${node.taxonomyId}:${node.value.id}`;
            item.description = String(node.value.entryCount);
            item.tooltip = node.value.description ?? `${node.value.title} — ${String(node.value.entryCount)} entries`;
            item.iconPath = this.iconResolver.resolve(treeNodePresentation(node));
            return item;
        }
        if (node.type === "views") {
            const item = new vscode.TreeItem("Views", vscode.TreeItemCollapsibleState.Collapsed);
            item.id = "views";
            item.description = String(this.explorer?.views.length ?? 0);
            item.iconPath = this.iconResolver.resolve(treeNodePresentation(node));
            return item;
        }
        const root = this.runtime.activeRoot;
        const path = node.value.path;
        const item = new vscode.TreeItem(
            node.value.title ?? (node.type === "view" ? node.value.id : node.value.path),
            vscode.TreeItemCollapsibleState.None,
        );
        item.id = `${node.type}:${path}`;
        if (node.value.kind) item.description = node.value.kind;
        item.tooltip = path;
        item.iconPath = this.iconResolver.resolve(treeNodePresentation(node));
        if (root) {
            const uri = this.runtime.uriFor(root, path);
            const command = treeNodeCommandId(node);
            item.resourceUri = uri;
            if (command) {
                item.command = {
                    command,
                    title: node.type === "view" ? "Open View Preview" : "Open Markdown source",
                    arguments: [uri],
                };
            }
        }
        return item;
    }

    private async children(node?: FormaTreeNode): Promise<FormaTreeNode[]> {
        if (!node) return workspaceTreeRoots(this.explorer);
        if (node.type !== "term") return workspaceTreeChildren(this.explorer, node);
        const key = this.termKey(node.taxonomyId, node.value.id);
        if (!this.termPages.has(key)) await this.loadTermPage(node.taxonomyId, node.value.id);
        const page = this.termPages.get(key);
        return workspaceTreeChildren(this.explorer, node, page?.entries, page?.nextCursor);
    }

    private async loadTermPage(taxonomyId: string, termId: string, cursor?: string): Promise<void> {
        const loadKey = `${this.termKey(taxonomyId, termId)}\u0000${cursor ?? "first"}`;
        const active = this.termLoads.get(loadKey);
        if (active) {
            await active;
            return;
        }
        const load = this.performTermPageLoad(taxonomyId, termId, cursor).finally(() => {
            this.termLoads.delete(loadKey);
        });
        this.termLoads.set(loadKey, load);
        await load;
    }

    private async performTermPageLoad(taxonomyId: string, termId: string, cursor?: string): Promise<void> {
        const key = this.termKey(taxonomyId, termId);
        try {
            const result = await this.runtime.workspaceExplorerEntries(taxonomyId, termId, cursor);
            if (!result) return;
            const current = this.termPages.get(key);
            this.termPages.set(key, {
                entries: cursor ? [...(current?.entries ?? []), ...result.entries] : result.entries,
                ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
            });
        } catch (error) {
            this.runtime.logResult({ explorerEntriesError: formatFormaError(error) });
        }
    }

    private termKey(taxonomyId: string, termId: string): string {
        return `${taxonomyId}\u0000${termId}`;
    }
}
