import { mermaidDiagramKinds, mermaidPolicy, type MermaidDiagramKind } from "./policy";

export const mermaidWorkerProtocolVersion = 1;

export interface MermaidRenderTheme {
    accent: string;
    bg: string;
    border: string;
    fg: string;
    font: string;
    surface: string;
    transparent: boolean;
}

export interface MermaidWorkerRenderRequest {
    kind: MermaidDiagramKind;
    maxOutputBytes: number;
    protocolVersion: number;
    source: string;
    taskId: number;
    theme: MermaidRenderTheme;
    type: "render";
}

export type MermaidWorkerRequest = MermaidWorkerRenderRequest;

export interface MermaidWorkerRenderSuccess {
    outputBytes: number;
    protocolVersion: number;
    svg: string;
    taskId: number;
    type: "rendered";
}

export interface MermaidWorkerRenderFailure {
    error: string;
    protocolVersion: number;
    taskId: number;
    type: "failed";
}

export type MermaidWorkerResponse = MermaidWorkerRenderFailure | MermaidWorkerRenderSuccess;

export function isMermaidWorkerRequest(value: unknown): value is MermaidWorkerRequest {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value as Partial<MermaidWorkerRequest>;
    const theme = candidate.theme as Partial<MermaidRenderTheme> | undefined;
    return (
        candidate.type === "render" &&
        candidate.protocolVersion === mermaidWorkerProtocolVersion &&
        typeof candidate.taskId === "number" &&
        Number.isSafeInteger(candidate.taskId) &&
        candidate.taskId > 0 &&
        typeof candidate.source === "string" &&
        typeof candidate.maxOutputBytes === "number" &&
        Number.isSafeInteger(candidate.maxOutputBytes) &&
        candidate.maxOutputBytes > 0 &&
        candidate.maxOutputBytes <= mermaidPolicy.output.maxBytes &&
        typeof candidate.kind === "string" &&
        (mermaidDiagramKinds as readonly string[]).includes(candidate.kind) &&
        typeof theme?.accent === "string" &&
        typeof theme.bg === "string" &&
        typeof theme.border === "string" &&
        typeof theme.fg === "string" &&
        typeof theme.font === "string" &&
        typeof theme.surface === "string" &&
        typeof theme.transparent === "boolean"
    );
}
