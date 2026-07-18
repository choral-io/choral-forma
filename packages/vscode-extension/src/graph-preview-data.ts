import type { GraphProjection } from "@choral-forma/graph-view";
import type { ViewRenderOutput } from "@choral-forma/shared";

export type GraphRenderOutput = Extract<ViewRenderOutput, { kind: "graph" }>;

export type PreviewGraphData = {
    schemaVersion: 1;
    activeNodeId: string | null;
    projection: GraphRenderOutput;
};

export function mapPreviewGraphProjection(projection: GraphRenderOutput): GraphProjection {
    const legend = projection.legend ?? [];
    const legendByKey = new Map(legend.map((item) => [item.key, item]));
    return {
        legend: legend.map(({ key, label, color }) => ({ key, label, ...(color ? { color } : {}) })),
        nodes: projection.nodes.map((node) => {
            const classification = node.classification;
            const color = classification ? legendByKey.get(classification.key)?.color : undefined;
            return {
                id: node.id,
                path: node.path,
                ...(node.title ? { title: node.title } : {}),
                ...(node.kind ? { kind: node.kind } : {}),
                ...(classification
                    ? {
                          classification: {
                              key: classification.key,
                              label: classification.label,
                              ...(color ? { color } : {}),
                          },
                      }
                    : {}),
            };
        }),
        edges: projection.edges.map((edge) => ({ ...edge })),
    };
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
