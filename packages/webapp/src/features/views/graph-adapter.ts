import type { GraphProjection } from "@choral-forma/graph-view";
import { normalizeGraphProjection } from "@choral-forma/graph-view/projection";

import type { DashboardViewProjection } from "@/data/workspace-client";

export type DashboardGraphProjection = Extract<DashboardViewProjection, { kind: "graph" }>;

export function mapDashboardGraphProjection(projection: DashboardGraphProjection): GraphProjection {
    return normalizeGraphProjection(projection);
}

export function activeGraphNodeId(projection: DashboardGraphProjection, pathname: string): string | null {
    return projection.nodes.find((node) => node.routePath === pathname)?.id ?? null;
}
