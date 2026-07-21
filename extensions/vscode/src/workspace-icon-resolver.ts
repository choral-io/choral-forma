import { isSupportedDisplayIcon } from "@choral-forma/shared";
import * as vscode from "vscode";

import type { TreeNodePresentation } from "./workspace-tree-presentation.ts";

type ResolvedIcon = { light: vscode.Uri; dark: vscode.Uri };

export class WorkspaceIconResolver {
    constructor(private readonly extensionUri: vscode.Uri) {}

    resolve(presentation: TreeNodePresentation): ResolvedIcon {
        const icon = isSupportedDisplayIcon(presentation.icon) ? presentation.icon : "folder";
        const base = vscode.Uri.joinPath(this.extensionUri, "media", "icons", "lucide");
        return {
            light: vscode.Uri.joinPath(base, "light", `${icon}.svg`),
            dark: vscode.Uri.joinPath(base, "dark", `${icon}.svg`),
        };
    }
}
