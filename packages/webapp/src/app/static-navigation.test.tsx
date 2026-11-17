// @vitest-environment jsdom

import { useWorkspacePage } from "@/features/workspace/use-workspace-page";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation } from "react-router";
import { expect, it, vi } from "vitest";

import { App } from "./App";
import { WorkspaceLink } from "./workspace-navigation";

const testArtifact = vi.hoisted(() => ({
    dashboard: { entries: [], directories: [], taxonomies: [], views: [] },
    prepared: new Map<string, { entry?: { title: string } }>(),
    listeners: new Set<() => void>(),
    prepare: vi.fn<(path: string) => Promise<void>>(),
}));
vi.mock("@/data/workspace-client-source", () => ({
    isStaticWorkspaceClient: true,
    workspaceClient: {},
}));
vi.mock("@/data/static-enhancement", () => ({
    readPreparedStaticEnhancement: () => ({ dashboard: testArtifact.dashboard }),
    readPreparedStaticRoute: (path: string) => testArtifact.prepared.get(path),
    subscribePreparedStaticRoutes: (listener: () => void) => {
        testArtifact.listeners.add(listener);
        return () => {
            testArtifact.listeners.delete(listener);
        };
    },
    hasStaticRoute: (path: string) => ["/a.md", "/b.md"].includes(path),
    prepareStaticRoute: testArtifact.prepare,
}));
vi.mock("@/features/workspace/WorkspaceSidebar", () => ({
    WorkspaceSidebar: () => null,
}));
vi.mock("@/features/workspace/QuickOpenDialog", () => ({
    QuickOpenDialog: () => null,
}));

function TestPage() {
    const { pathname } = useLocation();
    const { entry } = useWorkspacePage();
    return (
        <main>
            <h1>{pathname}</h1>
            {entry && <p>{entry.title}</p>}
            <WorkspaceLink to="/b.md?keep=one&keep=two#target">Page B</WorkspaceLink>
        </main>
    );
}

function prepareRoute(path: string, title: string) {
    testArtifact.prepared.set(path, { entry: { title } });
    for (const listener of testArtifact.listeners) listener();
}

async function actAndFlush(action: () => void) {
    await act(async () => {
        action();
        // Let router and test-client continuations run before checking the committed view.
        await Promise.resolve();
    });
}

async function withApp(check: (container: HTMLElement) => Promise<void>) {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    testArtifact.prepared.clear();
    prepareRoute("/a.md", "Prepared A");
    testArtifact.prepare.mockReset();
    const original = window.location.href;
    const originalState: unknown = history.state;
    history.replaceState({ idx: 0 }, "", "/a.md");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const router = createBrowserRouter([{ path: "/", Component: App, children: [{ path: "*", Component: TestPage }] }]);
    const provider: ReactNode = <RouterProvider router={router} />;
    try {
        await actAndFlush(() => {
            root.render(provider);
        });
        await check(container);
    } finally {
        act(() => {
            root.unmount();
        });
        router.dispose();
        container.remove();
        history.replaceState(originalState, "", original);
        vi.unstubAllGlobals();
    }
}

it("commits a validated click with the URL, route and suffix on the first update", async () => {
    testArtifact.prepare.mockResolvedValue(undefined);
    await withApp(async (container) => {
        let ready!: () => void;
        const result = new Promise<void>((resolve) => {
            ready = resolve;
        });
        testArtifact.prepare.mockReturnValue(result);
        const click = container.querySelector<HTMLAnchorElement>("main a");
        if (!click) throw new Error("Missing test navigation link");
        await actAndFlush(() => {
            click.click();
        });
        expect(container.querySelector("h1")?.textContent).toBe("/a.md");
        expect(window.location.pathname).toBe("/a.md");
        await actAndFlush(() => {
            prepareRoute("/b.md", "Prepared B");
            ready();
        });
        expect(container.querySelector("h1")?.textContent).toBe("/b.md");
        expect(window.location.pathname).toBe("/b.md");
        expect(window.location.search + window.location.hash).toBe("?keep=one&keep=two#target");
    });
});

it("replaces the old body on uncached POP and retries at the same history entry", async () => {
    await withApp(async (container) => {
        let fail!: (reason: Error) => void;
        const result = new Promise<void>((_, reject) => {
            fail = reject;
        });
        testArtifact.prepare.mockReturnValueOnce(result);
        testArtifact.prepare.mockImplementationOnce((path) => {
            prepareRoute(path, "Prepared B");
            return Promise.resolve();
        });
        const length = history.length;
        await actAndFlush(() => {
            history.replaceState({ idx: 1, key: "history-b" }, "", "/b.md?stay=1#target");
            window.dispatchEvent(new PopStateEvent("popstate"));
        });
        expect(container.querySelector("h1")).toBeNull();
        expect(container.querySelector("main")?.ariaLabel).toBe("Loading workspace route");
        await actAndFlush(() => {
            fail(new Error("Offline"));
        });
        expect(window.location.pathname).toBe("/b.md");
        expect(container.querySelector("h1")).toBeNull();
        const retry = container.querySelector<HTMLButtonElement>("[data-workspace-route-failure] button");
        if (!retry) throw new Error("Missing POP recovery");
        await actAndFlush(() => {
            retry.click();
        });
        expect(container.querySelector("h1")?.textContent).toBe("/b.md");
        expect(container.querySelector("main p")?.textContent).toBe("Prepared B");
        expect(history.length).toBe(length);
        expect(window.location.search + window.location.hash).toBe("?stay=1#target");
    });
});
