import { posix } from "node:path";

export function editorUriToProtocol(uri: string, rootUri: string): string {
    const editor = new URL(uri);
    const root = new URL(rootUri);
    if (editor.protocol !== root.protocol || editor.host !== root.host || !isWithin(root.pathname, editor.pathname)) {
        throw new Error("Forma LSP document URI is outside the active workspace root.");
    }
    if (root.protocol === "file:") return editor.toString();
    if (root.protocol !== "vscode-remote:") {
        throw new Error(`Forma LSP does not support the ${root.protocol} workspace scheme.`);
    }
    return `file://${editor.pathname}${editor.search}${editor.hash}`;
}

export function protocolUriToEditor(uri: string, rootUri: string): string {
    const protocol = new URL(uri);
    if (protocol.protocol !== "file:") return protocol.toString();
    const root = new URL(rootUri);
    if (!isWithin(root.pathname, protocol.pathname)) {
        throw new Error("Forma LSP target URI is outside the active workspace root.");
    }
    if (root.protocol === "file:") return protocol.toString();
    if (root.protocol !== "vscode-remote:") {
        throw new Error(`Forma LSP does not support the ${root.protocol} workspace scheme.`);
    }
    return `${root.protocol}//${root.host}${protocol.pathname}${protocol.search}${protocol.hash}`;
}

function isWithin(rootPath: string, candidatePath: string): boolean {
    const root = decodeURIComponent(rootPath);
    const candidate = decodeURIComponent(candidatePath);
    const value = posix.relative(root, candidate);
    return value === "" || (!value.startsWith("..") && !posix.isAbsolute(value));
}
