import { isSupportedDisplayIcon } from "@choral-forma/shared";
import * as vscode from "vscode";

import {
    colorizeBundledLucideSvg,
    configuredIconColor,
    presentationIconCacheName,
} from "./workspace-icon-cache-utils.ts";
import type { TreeNodePresentation } from "./workspace-tree-presentation.ts";

const maximumCachedIcons = 256;
type ResolvedIcon = vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };

export class WorkspaceIconCache implements vscode.Disposable {
    private readonly pending = new Map<string, Promise<vscode.Uri>>();
    private readonly resolved = new Map<string, vscode.Uri>();
    private readonly themeSubscription: vscode.Disposable;
    private prunePending: Promise<void> | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly globalStorageUri: vscode.Uri,
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
            return cached;
        }
        const existing = this.pending.get(key);
        if (existing) return await existing;
        const load = this.resolveColoredIcon(icon, color).finally(() => this.pending.delete(key));
        this.pending.set(key, load);
        try {
            const resolved = await load;
            this.remember(key, resolved);
            return isHighContrastTheme(vscode.window.activeColorTheme.kind) ? fallback : resolved;
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

    private async resolveColoredIcon(icon: string, color: string): Promise<vscode.Uri> {
        const directory = vscode.Uri.joinPath(this.globalStorageUri, "presentation-icons", "v1");
        const target = vscode.Uri.joinPath(directory, presentationIconCacheName(icon, color));
        try {
            await vscode.workspace.fs.stat(target);
            return target;
        } catch {
            // A missing cache entry is populated from the trusted bundled asset below.
        }

        await vscode.workspace.fs.createDirectory(directory);
        const source = await vscode.workspace.fs.readFile(this.bundledIcon(icon).light);
        const colored = colorizeBundledLucideSvg(new TextDecoder().decode(source), color);
        await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(colored));
        this.schedulePrune(directory);
        return target;
    }

    private schedulePrune(directory: vscode.Uri): void {
        if (this.prunePending) return;
        this.prunePending = this.prune(directory).finally(() => {
            this.prunePending = undefined;
        });
    }

    private async prune(directory: vscode.Uri): Promise<void> {
        try {
            const entries = (await vscode.workspace.fs.readDirectory(directory)).filter(
                ([name, type]) => type === vscode.FileType.File && name.endsWith(".svg"),
            );
            if (entries.length <= maximumCachedIcons) return;
            const files = await Promise.all(
                entries.map(async ([name]) => {
                    const uri = vscode.Uri.joinPath(directory, name);
                    return { uri, modified: (await vscode.workspace.fs.stat(uri)).mtime };
                }),
            );
            files.sort((left, right) => left.modified - right.modified);
            const protectedUris = new Set([...this.resolved.values()].map((uri) => uri.toString()));
            const removable = files.filter(({ uri }) => !protectedUris.has(uri.toString()));
            await Promise.all(
                removable
                    .slice(0, Math.max(0, files.length - maximumCachedIcons))
                    .map(({ uri }) => vscode.workspace.fs.delete(uri)),
            );
        } catch {
            // Cache cleanup is best-effort and never affects Explorer rendering.
        }
    }
}

function isHighContrastTheme(kind: vscode.ColorThemeKind): boolean {
    return kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight;
}
