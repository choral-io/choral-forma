import { Route, Routes } from "react-router";

import { App } from "@/app/App";
import {
    DashboardRoute,
    EntryRoute,
    FallbackRoute,
    PagesRoute,
    SpaceRoute,
    SpacesRoute,
    ViewRoute,
    ViewsRoute,
} from "@/features/dashboard/DashboardHome";

export const routes = (
    <Routes>
        <Route path="/" Component={App}>
            <Route index Component={DashboardRoute} />
            <Route path="pages" Component={PagesRoute} />
            <Route path="pages/*" Component={EntryRoute} />
            <Route path="spaces" Component={SpacesRoute} />
            <Route path="spaces/:spaceId" Component={SpaceRoute} />
            <Route path="views" Component={ViewsRoute} />
            <Route path="views/:viewId" Component={ViewRoute} />
            <Route path="*" Component={FallbackRoute} />
        </Route>
    </Routes>
);
