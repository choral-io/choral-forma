import type { GraphProjection } from "@choral-forma/graph-view";

import type { DashboardViewProjection } from "@/data/workspace-client";

export type DashboardGraphProjection = Extract<DashboardViewProjection, { kind: "graph" }>;

export function mapDashboardGraphProjection(projection: DashboardGraphProjection): GraphProjection {
    const legendByKey = new Map(projection.legend.map((item) => [item.key, item]));
    return {
        legend: projection.legend.map(({ key, label, color }) => ({ key, label, color })),
        nodes: projection.nodes.map((node) => ({
            id: node.id,
            path: node.path,
            title: node.title,
            kind: node.kind,
            classification: node.classification
                ? {
                      key: node.classification.key,
                      label: node.classification.label,
                      color: legendByKey.get(node.classification.key)?.color,
                  }
                : undefined,
        })),
        edges: projection.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourcePath: edge.sourcePath,
            targetPath: edge.targetPath,
            fragment: edge.fragment,
            fragmentKind: edge.fragmentKind,
            intent: edge.intent,
            referenceSource: edge.referenceSource,
            label: edge.label,
            field: edge.field,
            semanticType: edge.semanticType,
        })),
    };
}

export function activeGraphNodeId(projection: DashboardGraphProjection, pathname: string): string | null {
    return projection.nodes.find((node) => node.routePath === pathname)?.id ?? null;
}
