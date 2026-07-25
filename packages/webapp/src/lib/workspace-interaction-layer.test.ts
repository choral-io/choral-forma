import { describe, expect, it } from "vitest";

import { acquireWorkspaceInteractionLayer, subscribeWorkspaceInteractionLayer } from "./workspace-interaction-layer";

describe("workspace interaction layer", () => {
    it("stays occupied until every expanded-view lease is released", () => {
        const occupancy: boolean[] = [];
        const unsubscribe = subscribeWorkspaceInteractionLayer((occupied) => {
            occupancy.push(occupied);
        });

        const releaseGraph = acquireWorkspaceInteractionLayer();
        const releaseMermaid = acquireWorkspaceInteractionLayer();
        releaseGraph();
        releaseGraph();
        releaseMermaid();

        expect(occupancy).toEqual([false, true, false]);
        unsubscribe();
    });
});
