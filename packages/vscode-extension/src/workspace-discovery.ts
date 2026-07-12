import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";

export type PathExists = (path: string) => Promise<boolean>;

export async function discoverWorkspaceRoots(
    folderRoots: string[],
    activeDocument: string | undefined,
    exists: PathExists,
): Promise<string[]> {
    const roots = new Set<string>();
    for (const folder of folderRoots) {
        const boundary = normalize(folder);
        if (await exists(join(boundary, ".forma.md"))) roots.add(boundary);
        if (activeDocument && isInside(boundary, activeDocument)) {
            const nearest = await findNearestWorkspaceRoot(activeDocument, boundary, exists);
            if (nearest) roots.add(nearest);
        }
    }
    return [...roots].sort();
}

export async function findNearestWorkspaceRoot(
    documentPath: string,
    folderBoundary: string,
    exists: PathExists,
): Promise<string | undefined> {
    const boundary = normalize(resolve(folderBoundary));
    let current = normalize(dirname(resolve(documentPath)));
    if (!isInside(boundary, current)) return undefined;
    while (isInside(boundary, current)) {
        if (await exists(join(current, ".forma.md"))) return current;
        if (current === boundary) break;
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return undefined;
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
