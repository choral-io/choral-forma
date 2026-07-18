import { isSupportedDisplayIcon } from "@choral-forma/shared";
import * as vscode from "vscode";

import {
    colorizeBundledLucideSvg,
    configuredIconColor,
    svgDataUri,
    uniformThemeIconPath,
} from "./workspace-icon-cache-utils.ts";
import type { TreeNodePresentation } from "./workspace-tree-presentation.ts";

const maximumCachedIcons = 256;
type ResolvedIcon = { light: vscode.Uri; dark: vscode.Uri };

export class WorkspaceIconCache implements vscode.Disposable {
    private readonly pending = new Map<string, Promise<vscode.Uri>>();
    private readonly resolved = new Map<string, vscode.Uri>();
    private readonly themeSubscription: vscode.Disposable;

    constructor(
        private readonly extensionUri: vscode.Uri,
        refresh: () => void,
    ) {
        this.themeSubscription = vscode.window.onDidChangeActiveColorTheme(refresh);
    }

    async resolve(presentation: TreeNodePresentation): Promise<ResolvedIcon> {
        const icon = isSupportedDisplayIcon(presentation.icon) ? presentation.icon : "folder";
        const fallback = this.bundledIcon(icon);
        const color = configuredIconColor(presentation.color, isHighContrastTheme(vscode.window.activeColorTheme.kind));
        if (!color) return fallback;

        const key = `${icon}\0${color}`;
        const cached = this.resolved.get(key);
        if (cached) {
            this.resolved.delete(key);
            this.resolved.set(key, cached);
            return this.presentColoredIcon(cached, fallback);
        }
        const existing = this.pending.get(key);
        if (existing) return this.presentColoredIcon(await existing, fallback);
        const load = this.resolveColoredIcon(icon, color).finally(() => this.pending.delete(key));
        this.pending.set(key, load);
        try {
            const resolved = await load;
            this.remember(key, resolved);
            return this.presentColoredIcon(resolved, fallback);
        } catch {
            return fallback;
        }
    }

    dispose(): void {
        this.resolved.clear();
        this.themeSubscription.dispose();
    }

    private remember(key: string, uri: vscode.Uri): void {
        this.resolved.delete(key);
        this.resolved.set(key, uri);
        while (this.resolved.size > maximumCachedIcons) {
            const oldestKey = this.resolved.keys().next().value;
            if (!oldestKey) break;
            this.resolved.delete(oldestKey);
        }
    }

    private bundledIcon(name: string): { light: vscode.Uri; dark: vscode.Uri } {
        const base = vscode.Uri.joinPath(this.extensionUri, "media", "icons", "lucide");
        return {
            light: vscode.Uri.joinPath(base, "light", `${name}.svg`),
            dark: vscode.Uri.joinPath(base, "dark", `${name}.svg`),
        };
    }

    private presentColoredIcon(uri: vscode.Uri, fallback: { light: vscode.Uri; dark: vscode.Uri }): ResolvedIcon {
        return isHighContrastTheme(vscode.window.activeColorTheme.kind) ? fallback : uniformThemeIconPath(uri);
    }

    private async resolveColoredIcon(icon: string, color: string): Promise<vscode.Uri> {
        const source = await vscode.workspace.fs.readFile(this.bundledIcon(icon).light);
        const colored = colorizeBundledLucideSvg(new TextDecoder().decode(source), color);
        return vscode.Uri.parse(svgDataUri(colored));
    }
}

function isHighContrastTheme(kind: vscode.ColorThemeKind): boolean {
    return kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight;
}
