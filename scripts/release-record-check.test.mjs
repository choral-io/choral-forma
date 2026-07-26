import assert from "node:assert/strict";
import test from "node:test";

import { assertReleaseRecordHasBacklink, releaseRecordPath } from "./release-record-check.mjs";

const TAG = "v0.1.24";
const RECORD_PATH = "knowledge/releases/forma-v0.1.24.md";

test("derives the release-record path from a v-prefixed tag", () => {
    assert.equal(releaseRecordPath(TAG), RECORD_PATH);
    assert.throws(() => releaseRecordPath("0.1.24"), /v-prefixed tag/u);
});

test("allows unrelated workspace-health warnings", () => {
    assert.equal(
        assertReleaseRecordHasBacklink(
            {
                findings: [
                    {
                        category: "noBacklinks",
                        path: "knowledge/releases/forma-v0.1.23.md",
                    },
                ],
            },
            TAG,
        ),
        RECORD_PATH,
    );
});

test("rejects a no-backlink finding for the target release record", () => {
    assert.throws(
        () =>
            assertReleaseRecordHasBacklink(
                {
                    diagnostics: [
                        {
                            code: "workspaceHealth.noBacklinks",
                            path: RECORD_PATH,
                        },
                    ],
                },
                TAG,
            ),
        /Forma Release And Delivery Ledger/u,
    );
});
