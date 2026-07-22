import { Route, Routes } from "react-router";

import { App } from "@/app/App";
import {
    DashboardRoute,
    EntryRoute,
    FallbackRoute,
    HealthRoute,
    PagesRoute,
    TaxonomiesRoute,
    TaxonomyRoute,
    TaxonomyTermRoute,
    ViewRoute,
    ViewsRoute,
} from "@/features/dashboard/DashboardHome";

export const routes = (
    <Routes>
        <Route path="/" Component={App}>
            <Route index Component={DashboardRoute} />
            <Route path="pages" Component={PagesRoute} />
            <Route path="pages/*" Component={EntryRoute} />
            <Route path="taxonomies" Component={TaxonomiesRoute} />
            <Route path="views" Component={ViewsRoute} />
            <Route path="views/*" Component={ViewRoute} />
            <Route path="health" Component={HealthRoute} />
            <Route path=":taxonomyId" Component={TaxonomyRoute} />
            <Route path=":taxonomyId/:termId" Component={TaxonomyTermRoute} />
            <Route path="*" Component={FallbackRoute} />
        </Route>
    </Routes>
);
