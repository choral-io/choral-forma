import { mermaidPolicy, validateMermaidSource, type ValidatedMermaidDiagram } from "./policy";

export interface MermaidRenderReservation {
    diagramId: string;
}

export interface MermaidRenderScope {
    acceptOutput(reservation: MermaidRenderReservation, bytes: number): boolean;
    dispose(): void;
    reserve(diagram: ValidatedMermaidDiagram): MermaidRenderReservation | undefined;
    readonly signal: AbortSignal;
}

interface ScopeTotals {
    diagrams: number;
    outputBytes: number;
    relations: number;
    sourceBytes: number;
    statements: number;
    structuralNodes: number;
}

export function createMermaidRenderScope(scopeId: string): MermaidRenderScope {
    const abortController = new AbortController();
    const acceptedOutputs = new Set<string>();
    const totals: ScopeTotals = {
        diagrams: 0,
        outputBytes: 0,
        relations: 0,
        sourceBytes: 0,
        statements: 0,
        structuralNodes: 0,
    };
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    return {
        acceptOutput(reservation, bytes) {
            if (
                disposed ||
                abortController.signal.aborted ||
                !Number.isSafeInteger(bytes) ||
                bytes < 0 ||
                acceptedOutputs.has(reservation.diagramId) ||
                totals.outputBytes + bytes > mermaidPolicy.scope.maxOutputBytes
            ) {
                return false;
            }
            totals.outputBytes += bytes;
            acceptedOutputs.add(reservation.diagramId);
            return true;
        },
        dispose() {
            if (disposed) {
                return;
            }
            disposed = true;
            if (deadline) {
                clearTimeout(deadline);
            }
            abortController.abort();
        },
        reserve(diagram) {
            if (disposed || abortController.signal.aborted) {
                return undefined;
            }
            const validation = validateMermaidSource(diagram.source);
            if (!validation.ok || validation.diagram.model.kind !== diagram.model.kind) {
                return undefined;
            }
            const metrics = validation.diagram.metrics;
            const next = {
                diagrams: totals.diagrams + 1,
                relations: totals.relations + metrics.relations,
                sourceBytes: totals.sourceBytes + metrics.bytes,
                statements: totals.statements + metrics.statements,
                structuralNodes: totals.structuralNodes + metrics.structuralNodes,
            };
            if (
                next.diagrams > mermaidPolicy.scope.maxDiagrams ||
                next.sourceBytes > mermaidPolicy.scope.maxSourceBytes ||
                next.statements > mermaidPolicy.scope.maxStatements ||
                next.structuralNodes > mermaidPolicy.scope.maxStructuralNodes ||
                next.relations > mermaidPolicy.scope.maxRelations
            ) {
                return undefined;
            }
            deadline ??= setTimeout(() => {
                abortController.abort();
            }, mermaidPolicy.scope.timeoutMs);
            Object.assign(totals, next);
            return { diagramId: `forma-mermaid-${safeId(scopeId)}-${String(next.diagrams)}` };
        },
        signal: abortController.signal,
    };
}

function safeId(value: string) {
    return value.replace(/[^A-Za-z0-9_-]/g, "-");
}
