import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { prepareStaticEnhancement } from "./data/static-enhancement";
import { isStaticWorkspaceClient } from "./data/workspace-client-source";
import { applyThemePreference, readThemePreference } from "./lib/theme-preference";
import { createAppRouter, preloadDashboardRoutes } from "./router";
import "./styles/globals.css";

applyThemePreference(readThemePreference(), false);

// Fetch the route chunk alongside the workspace request instead of after it. A
// failure here surfaces through the route error boundary when the route mounts.
void preloadDashboardRoutes().catch(() => undefined);

const root = document.getElementById("root");

if (!root) {
    throw new Error("Root element #root was not found.");
}
const rootElement = root;

async function mountApplication() {
    if (isStaticWorkspaceClient) {
        try {
            await prepareStaticEnhancement(window.location.pathname);
        } catch (error) {
            console.warn("Static enhancement was skipped; the generated page remains available.", error);
            return;
        }
    }

    createRoot(rootElement).render(
        <StrictMode>
            <RouterProvider router={createAppRouter()} />
        </StrictMode>,
    );
}

void mountApplication();
