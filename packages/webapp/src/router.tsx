import { lazy, type ComponentType } from "react";
import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router";

import { App } from "@/app/App";
import { RouteErrorBoundary } from "@/app/RouteErrorBoundary";
import type * as RoutePagesModule from "@/features/route-pages";
import { systemRouteSegment, taxonomyRouteSegment } from "@/lib/workspace-routes";
import { staticRouterBasename } from "./data/static-runtime";

const DashboardRoute = lazyDashboardRoute("DashboardRoute");
const EntryRoute = lazyDashboardRoute("EntryRoute");
const FallbackRoute = lazyDashboardRoute("FallbackRoute");
const HealthRoute = lazyDashboardRoute("HealthRoute");
const TaxonomiesRoute = lazyDashboardRoute("TaxonomiesRoute");
const TaxonomyRoute = lazyDashboardRoute("TaxonomyRoute");
const TaxonomyTermRoute = lazyDashboardRoute("TaxonomyTermRoute");
const ViewRoute = lazyDashboardRoute("ViewRoute");
const ViewsRoute = lazyDashboardRoute("ViewsRoute");

/**
 * Every route is re-exported from one module, so this is a single chunk boundary
 * rather than per-route splitting. Starting the request before the shell needs it
 * keeps the chunk from queueing behind the workspace dashboard request.
 */
export function preloadDashboardRoutes() {
    return import("@/features/route-pages");
}

function lazyDashboardRoute(exportName: keyof typeof RoutePagesModule) {
    return lazy(async () => {
        const module = await preloadDashboardRoutes();
        return { default: module[exportName] as ComponentType };
    });
}

/**
 * File and directory routes are selected from the workspace projection. Logical collections and
 * application capabilities have separate first segments.
 */
const routeElements = (
    <Route errorElement={<RouteErrorBoundary />} path="/" Component={App}>
        <Route index Component={DashboardRoute} />
        <Route path={systemRouteSegment}>
            <Route index element={<Navigate replace to="/" />} />
            <Route path="views" Component={ViewsRoute} />
            <Route path="views/*" Component={ViewRoute} />
            <Route path="health" Component={HealthRoute} />
            <Route path="*" Component={FallbackRoute} />
        </Route>
        <Route path={taxonomyRouteSegment}>
            <Route index Component={TaxonomiesRoute} />
            <Route path=":taxonomyId" Component={TaxonomyRoute} />
            <Route path=":taxonomyId/:termId" Component={TaxonomyTermRoute} />
            <Route path="*" Component={FallbackRoute} />
        </Route>
        <Route path="*" Component={EntryRoute} />
    </Route>
);

export function createAppRouter() {
    return createBrowserRouter(createRoutesFromElements(routeElements), {
        basename: staticRouterBasename(),
    });
}
