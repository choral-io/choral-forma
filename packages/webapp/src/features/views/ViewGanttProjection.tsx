import type { DashboardViewProjection } from "@/data/workspace-client";
import { ViewGanttProjection as Projection, TemporalHostProvider } from "@choral-forma/temporal-view";
import { Link, useLocation } from "react-router";

export function ViewGanttProjection({
    projection,
}: {
    projection: Extract<DashboardViewProjection, { kind: "gantt" }>;
}) {
    const location = useLocation();
    return (
        <TemporalHostProvider value={{ Link, navigationKey: location.key }}>
            <Projection projection={projection} />
        </TemporalHostProvider>
    );
}
