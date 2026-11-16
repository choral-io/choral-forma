// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { DashboardTaxonomy, DashboardTaxonomyTerm, WorkspaceDashboard } from "@/data/workspace-client";
import { TaxonomyRoute, TaxonomyTermRoute } from "@/features/browse/TaxonomyRoutes";
import { ViewRoute } from "@/features/views/ViewRoute";

const getViewRender = vi.hoisted(() => vi.fn());
vi.mock("@/data/workspace-client-source", () => ({
    isStaticWorkspaceClient: false,
    workspaceClient: { getViewRender },
}));

const term: DashboardTaxonomyTerm = {
    id: "literal%2F",
    title: "Literal term",
    description: "",
    entryCount: 0,
    entries: [],
    status: "healthy",
};
const taxonomy: DashboardTaxonomy = {
    id: "spaces",
    title: "Spaces",
    mode: "multiple",
    description: "",
    terms: [term],
};
const dashboard: WorkspaceDashboard = {
    workspaceName: "Routing fixture",
    tagline: "",
    status: "healthy",
    taxonomies: [taxonomy],
    spaces: [],
    entries: [],
    diagnostics: [],
    health: { status: "healthy", diagnostics: [], findings: [] },
    views: [],
};
let root: Root | undefined;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    getViewRender.mockResolvedValue({
        document: { beforeProjection: "", afterProjection: "", path: "view.md" },
        projection: { kind: "list", items: [] },
    });
});
afterEach(() => {
    act(() => {
        root?.unmount();
    });
    root = undefined;
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

async function openRoute(pathname: string, fixture = dashboard) {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
        root?.render(
            <MemoryRouter basename="/preview" initialEntries={[`/preview${pathname}`]}>
                <Routes>
                    <Route element={<Outlet context={fixture} />}>
                        <Route path="/-/browse/:taxonomyId" element={<TaxonomyRoute />} />
                        <Route path="/-/browse/:taxonomyId/:termId" element={<TaxonomyTermRoute />} />
                        <Route path="/-/views/*" element={<ViewRoute />} />
                    </Route>
                </Routes>
            </MemoryRouter>,
        );
        await Promise.resolve();
    });
    return container;
}

it("opens a term whose id contains a literal percent-encoded slash", async () => {
    const container = await openRoute("/-/browse/spaces/literal%252F/");
    expect(container.querySelector("main h1")?.textContent).toBe("Literal term");
});

it.each([
    ["literal%2F", "/-/browse/literal%252F/"],
    ["literal/slash", "/-/browse/literal%2Fslash"],
])("opens the taxonomy %s from its canonical route", async (id, pathname) => {
    const fixture = { ...dashboard, taxonomies: [{ ...taxonomy, id, title: "Configured taxonomy" }] };
    const container = await openRoute(pathname, fixture);
    expect(container.querySelector("main h1")?.textContent).toBe("Configured taxonomy");
});

it.each([
    ["literal/slash", "/-/browse/spaces/literal%2Fslash"],
    ["literal%2Fslash", "/-/browse/spaces/literal%252Fslash/"],
])("distinguishes the term %s from an encoded slash", async (id, pathname) => {
    const fixture = {
        ...dashboard,
        taxonomies: [
            {
                ...taxonomy,
                terms: ["literal/slash", "literal%2Fslash"].map((termId) => ({
                    ...term,
                    id: termId,
                    title: termId,
                })),
            },
        ],
    };
    const container = await openRoute(pathname, fixture);
    expect(container.querySelector("main h1")?.textContent).toBe(id);
});

it.each([
    ["literal%2F", "/-/views/literal%252F/"],
    [".forma/views/literal%2F", "/-/views/.forma/views/literal%252F"],
    ["planning/with space", "/-/views/planning/with%20space/"],
])("opens View %s and loads its original id", async (id, pathname) => {
    const fixture: WorkspaceDashboard = {
        ...dashboard,
        views: [{ id, title: "Configured View", kind: "list", description: "", path: `${id}.md` }],
    };
    const container = await openRoute(pathname, fixture);
    expect(container.querySelector("main h1")?.textContent).toBe("Configured View");
    expect(getViewRender).toHaveBeenCalledWith(id, expect.objectContaining({ dashboard: fixture }));
    expect(container.textContent).not.toContain("Loading view projection");
});
