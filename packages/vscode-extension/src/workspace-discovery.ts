import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";

import type { ConfigInspectResult } from "@choral-forma/shared";

export type PathExists = (path: string) => Promise<boolean>;

export type ConfiguredWorkspace = {
    folderRoot: string;
    configPath: string;
    configRelativePath: string;
    root: string;
};

export function configuredWorkspace(folderRoot: string, configuredPath: string | undefined): ConfiguredWorkspace {
    const trimmedPath = configuredPath?.trim();
    const configRelativePath = trimmedPath?.length ? trimmedPath : ".forma.md";
    if (
        isAbsolute(configRelativePath) ||
        /^[A-Za-z]:/u.test(configRelativePath) ||
        configRelativePath.includes("\\") ||
        configRelativePath.split("/").some((segment) => segment === "..")
    ) {
        throw new Error("forma.workspaceConfig must be a relative path inside its Workspace Folder.");
    }
    if (configRelativePath.split("/").at(-1) !== ".forma.md") {
        throw new Error("forma.workspaceConfig must point to a file named .forma.md.");
    }
    const folder = normalize(resolve(folderRoot));
    const configPath = normalize(resolve(folder, configRelativePath));
    if (!isInside(folder, configPath)) {
        throw new Error("forma.workspaceConfig must stay inside its Workspace Folder.");
    }
    return { folderRoot: folder, configPath, configRelativePath, root: dirname(configPath) };
}

export type WorkspaceDiscovery = {
    roots: string[];
    missing: ConfiguredWorkspace[];
};

export type WorkspaceScope = {
    configPatterns: string[];
    includePatterns: string[];
    configSourcePaths: string[];
};

export function workspaceScopeFromConfig(result: ConfigInspectResult): WorkspaceScope {
    const includePatterns = new Set<string>();
    for (const value of Object.values(result.config.spaces ?? {})) {
        addIncludePatterns(includePatterns, value);
    }
    for (const taxonomy of Object.values(result.config.terms ?? {})) {
        if (!isRecord(taxonomy)) continue;
        for (const term of Object.values(taxonomy)) {
            addIncludePatterns(includePatterns, term);
        }
    }
    return {
        configPatterns: [...new Set(result.sourcePatterns)].sort(),
        includePatterns: [...includePatterns].sort(),
        configSourcePaths: [...new Set(result.sources.map((source) => source.path).filter(Boolean))].sort(),
    };
}

function addIncludePatterns(patterns: Set<string>, value: unknown): void {
    if (!isRecord(value)) return;
    const configured = value.includePatterns;
    if (Array.isArray(configured)) {
        for (const pattern of configured) {
            if (typeof pattern === "string" && pattern) patterns.add(pattern);
        }
    } else if (typeof value.include === "string" && value.include) {
        patterns.add(value.include);
    }
}

export async function discoverWorkspaceRoots(
    configured: ConfiguredWorkspace[],
    exists: PathExists,
): Promise<WorkspaceDiscovery> {
    const roots = new Set<string>();
    const missing = [];
    for (const workspace of configured) {
        if (await exists(workspace.configPath)) roots.add(workspace.root);
        else missing.push(workspace);
    }
    return { roots: [...roots].sort(), missing };
}

export function selectWorkspaceRoot(roots: string[], documentPath: string | undefined): string | undefined {
    if (!documentPath) return roots.length === 1 ? roots[0] : undefined;
    return roots.filter((root) => isInside(root, documentPath)).sort((left, right) => right.length - left.length)[0];
}

export function workspaceRelativePath(root: string, absolutePath: string): string | undefined {
    if (!isInside(root, absolutePath)) return undefined;
    return relative(root, absolutePath).split("\\").join("/");
}

export function shouldRefreshRuntimeForDocument(
    workspaceRootCount: number,
    activeRoot: string | undefined,
    documentRoot: string | undefined,
): boolean {
    return workspaceRootCount === 0 || !documentRoot || documentRoot !== activeRoot;
}

function isInside(parent: string, child: string): boolean {
    const value = relative(resolve(parent), resolve(child));
    return value === "" || (!value.startsWith("..") && !isAbsolute(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
