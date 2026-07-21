import type { GraphProjection } from "@choral-forma/graph-view";
import { normalizeGraphProjection } from "@choral-forma/graph-view/projection";
import type { ViewRenderOutput } from "@choral-forma/shared";

export type GraphRenderOutput = Extract<ViewRenderOutput, { kind: "graph" }>;

export type PreviewGraphData = {
    schemaVersion: 1;
    activeNodeId: string | null;
    projection: GraphRenderOutput;
};

export function mapPreviewGraphProjection(projection: GraphRenderOutput): GraphProjection {
    return normalizeGraphProjection(projection);
}

export function parsePreviewGraphData(value: string): PreviewGraphData | undefined {
    try {
        const candidate: unknown = JSON.parse(value);
        if (!isRecord(candidate) || candidate.schemaVersion !== 1 || !isRecord(candidate.projection)) return undefined;
        if (candidate.projection.kind !== "graph" || !Array.isArray(candidate.projection.nodes)) return undefined;
        if (!Array.isArray(candidate.projection.edges)) return undefined;
        if (candidate.activeNodeId !== null && typeof candidate.activeNodeId !== "string") return undefined;
        return candidate as PreviewGraphData;
    } catch {
        return undefined;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
