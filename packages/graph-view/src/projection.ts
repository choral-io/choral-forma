import type { GraphEdgeInput, GraphProjection } from "./types.ts";

type GraphProjectionSource = {
    nodes: readonly GraphProjectionSourceNode[];
    edges: readonly GraphEdgeInput[];
    legend?: readonly GraphProjectionSourceLegendItem[];
};

type GraphProjectionSourceNode = {
    id: string;
    path: string;
    title?: string;
    kind?: string;
    classification?: {
        key: string;
        label: string;
    };
};

type GraphProjectionSourceLegendItem = {
    key: string;
    label: string;
    color?: string;
};

export function normalizeGraphProjection(projection: GraphProjectionSource): GraphProjection {
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
