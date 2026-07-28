import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { prepareStaticEnhancement } from "./data/static-enhancement";
import { staticRouterBasename } from "./data/static-runtime";
import { isStaticWorkspaceClient } from "./data/workspace-client-source";
import { applyThemePreference, readThemePreference } from "./lib/theme-preference";
import { routes } from "./router";
import "./styles/globals.css";

applyThemePreference(readThemePreference(), false);

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
            <BrowserRouter basename={staticRouterBasename()}>{routes}</BrowserRouter>
        </StrictMode>,
    );
}

void mountApplication();
