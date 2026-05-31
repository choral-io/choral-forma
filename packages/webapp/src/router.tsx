import { Route, Routes } from "react-router";

import { App } from "@/app/App";
import {
    DashboardRoute,
    DocumentRoute,
    DocumentsRoute,
    FallbackRoute,
    SpaceRoute,
    SpacesRoute,
    ViewRoute,
    ViewsRoute,
} from "@/features/dashboard/DashboardHome";

export const routes = (
    <Routes>
        <Route path="/" Component={App}>
            <Route index Component={DashboardRoute} />
            <Route path="documents" Component={DocumentsRoute} />
            <Route path="documents/:documentId" Component={DocumentRoute} />
            <Route path="spaces" Component={SpacesRoute} />
            <Route path="spaces/:spaceId" Component={SpaceRoute} />
            <Route path="views" Component={ViewsRoute} />
            <Route path="views/:viewId" Component={ViewRoute} />
            <Route path="*" Component={FallbackRoute} />
        </Route>
    </Routes>
);
