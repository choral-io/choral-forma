import type { DashboardViewProjection } from "@/data/workspace-client";
import { ViewCalendarProjection as Projection, TemporalHostProvider } from "@choral-forma/temporal-view";
import { Link, useLocation } from "react-router";

export function ViewCalendarProjection({
    projection,
}: {
    projection: Extract<DashboardViewProjection, { kind: "calendar" }>;
}) {
    const location = useLocation();
    return (
        <TemporalHostProvider value={{ Link, navigationKey: location.key }}>
            <Projection projection={projection} />
        </TemporalHostProvider>
    );
}
