import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { routes } from "./router";
import "./styles/globals.css";

const root = document.getElementById("root");

if (!root) {
    throw new Error("Root element #root was not found.");
}

createRoot(root).render(
    <StrictMode>
        <BrowserRouter>{routes}</BrowserRouter>
    </StrictMode>,
);
