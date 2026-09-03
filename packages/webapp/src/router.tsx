import { lazy, type ComponentType } from "react";
import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from "react-router";

import { App } from "@/app/App";
import { RouteErrorBoundary } from "@/app/RouteErrorBoundary";
import type * as DashboardHomeModule from "@/features/dashboard/DashboardHome";
import { legacyWorkspaceRouteRedirect } from "@/lib/workspace-routes";
import { staticRouterBasename } from "./data/static-runtime";

const DashboardRoute = lazyDashboardRoute("DashboardRoute");
const EntryRoute = lazyDashboardRoute("EntryRoute");
const FallbackRoute = lazyDashboardRoute("FallbackRoute");
const HealthRoute = lazyDashboardRoute("HealthRoute");
const PagesRoute = lazyDashboardRoute("PagesRoute");
const TaxonomiesRoute = lazyDashboardRoute("TaxonomiesRoute");
const TaxonomyRoute = lazyDashboardRoute("TaxonomyRoute");
const TaxonomyTermRoute = lazyDashboardRoute("TaxonomyTermRoute");
const ViewRoute = lazyDashboardRoute("ViewRoute");
const ViewsRoute = lazyDashboardRoute("ViewsRoute");

/**
 * Every route lives in one dashboard module, so this is a single chunk boundary
 * rather than per-route splitting. Starting the request before the shell needs it
 * keeps the chunk from queueing behind the workspace dashboard request.
 */
export function preloadDashboardRoutes() {
    return import("@/features/dashboard/DashboardHome");
}

function lazyDashboardRoute(exportName: keyof typeof DashboardHomeModule) {
    return lazy(async () => {
        const module = await preloadDashboardRoutes();
        return { default: module[exportName] as ComponentType };
    });
}

const routeElements = (
    <Route errorElement={<RouteErrorBoundary />} path="/" Component={App}>
        <Route index Component={DashboardRoute} />
        <Route path="pages" Component={PagesRoute} />
        <Route path="pages/*" Component={EntryRoute} />
        <Route path="browse" Component={TaxonomiesRoute} />
        <Route
            path="taxonomies"
            element={<Navigate replace to={legacyWorkspaceRouteRedirect("/taxonomies") ?? "/browse"} />}
        />
        <Route path="views" Component={ViewsRoute} />
        <Route path="views/*" Component={ViewRoute} />
        <Route path="health" Component={HealthRoute} />
        <Route path=":taxonomyId" Component={TaxonomyRoute} />
        <Route path=":taxonomyId/:termId" Component={TaxonomyTermRoute} />
        <Route path="*" Component={FallbackRoute} />
    </Route>
);

export function createAppRouter() {
    return createBrowserRouter(createRoutesFromElements(routeElements), {
        basename: staticRouterBasename(),
    });
}
