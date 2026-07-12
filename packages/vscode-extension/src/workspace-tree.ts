import * as vscode from "vscode";

import { GenerationRefresh } from "./generation-refresh.ts";
import type { FormaRuntime } from "./runtime.ts";
import {
    type FormaTreeNode,
    treeNodeCommandId,
    viewIconName,
    workspaceTreeChildren,
    workspaceTreeRoots,
} from "./workspace-tree-model.ts";

export class FormaWorkspaceExplorer implements vscode.Disposable {
    private dashboard: Awaited<ReturnType<FormaRuntime["workspaceDashboard"]>>;
    private readonly changed = new vscode.EventEmitter<FormaTreeNode | undefined>();
    private readonly treeView: vscode.TreeView<FormaTreeNode>;
    private readonly extensionUri: vscode.Uri;
    private readonly refreshes = new GenerationRefresh();

    constructor(
        private readonly runtime: FormaRuntime,
        context: vscode.ExtensionContext,
    ) {
        this.extensionUri = context.extensionUri;
        this.treeView = vscode.window.createTreeView("forma.workspace", {
            treeDataProvider: {
                onDidChangeTreeData: this.changed.event,
                getTreeItem: (node) => this.treeItem(node),
                getChildren: (node) =>
                    node ? workspaceTreeChildren(this.dashboard, node) : workspaceTreeRoots(this.dashboard),
            },
            showCollapseAll: true,
        });
        context.subscriptions.push(this, this.treeView);
    }

    async refresh(): Promise<void> {
        await this.refreshes.run(this.runtime.analysisGeneration, async () => {
            try {
                this.dashboard = await this.runtime.workspaceDashboard();
            } catch (error) {
                this.dashboard = undefined;
                this.runtime.logResult({ explorerError: error instanceof Error ? error.message : String(error) });
            }
            this.treeView.message = this.dashboard ? "" : "No active Forma workspace.";
            this.changed.fire(undefined);
        });
    }

    dispose(): void {
        this.changed.dispose();
    }

    private treeItem(node: FormaTreeNode): vscode.TreeItem {
        if (node.type === "taxonomy") {
            const item = new vscode.TreeItem(node.value.title, vscode.TreeItemCollapsibleState.Collapsed);
            item.id = `taxonomy:${node.value.id}`;
            item.description = String(node.value.terms.length);
            item.tooltip = node.value.description ?? `${node.value.title} taxonomy`;
            item.iconPath = new vscode.ThemeIcon("symbol-enum");
            return item;
        }
        if (node.type === "term") {
            const item = new vscode.TreeItem(node.value.title, vscode.TreeItemCollapsibleState.Collapsed);
            item.id = `term:${node.taxonomyId}:${node.value.id}`;
            item.description = String(node.value.entryCount);
            item.tooltip = node.value.description ?? `${node.value.title} — ${String(node.value.entryCount)} entries`;
            item.iconPath = new vscode.ThemeIcon(node.value.status === "passed" ? "folder-library" : "warning");
            return item;
        }
        if (node.type === "views") {
            const item = new vscode.TreeItem("Views", vscode.TreeItemCollapsibleState.Collapsed);
            item.id = "views";
            item.description = String(this.dashboard?.views.length ?? 0);
            item.iconPath = this.lucideIcon("panels-top-left");
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
        item.iconPath =
            node.type === "view" ? this.lucideIcon(viewIconName(node.value.kind)) : new vscode.ThemeIcon("markdown");
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

    private lucideIcon(name: string): { light: vscode.Uri; dark: vscode.Uri } {
        const base = vscode.Uri.joinPath(this.extensionUri, "media", "icons", "lucide");
        return {
            light: vscode.Uri.joinPath(base, "light", `${name}.svg`),
            dark: vscode.Uri.joinPath(base, "dark", `${name}.svg`),
        };
    }
}
