/**
 * Every route page is re-exported from this one module so the router keeps a
 * single chunk boundary for them rather than per-route splitting.
 */
export { PagesRoute } from "./browse/PagesRoute";
export { TaxonomiesRoute, TaxonomyRoute, TaxonomyTermRoute } from "./browse/TaxonomyRoutes";
export { HealthRoute } from "./diagnostics/HealthRoute";
export { DashboardRoute, EntryRoute } from "./reader/EntryRoute";
export { ViewRoute } from "./views/ViewRoute";
export { ViewsRoute } from "./views/ViewsRoute";
export { FallbackRoute } from "./workspace/FallbackRoute";
