import assert from "node:assert/strict";
import test from "node:test";

import { resolveVsixOutput } from "./package-output.mjs";

test("derives the default VSIX filename from extension manifest identity", () => {
    assert.equal(
        resolveVsixOutput({
            manifest: { name: "forma", version: "1.2.3" },
            temporaryDirectory: "/tmp/package-output",
        }),
        "/tmp/package-output/forma-1.2.3.vsix",
    );
});

test("preserves an explicit VSIX_OUT override", () => {
    assert.equal(
        resolveVsixOutput({
            manifest: { name: "forma", version: "1.2.3" },
            override: "/artifacts/custom.vsix",
            temporaryDirectory: "/tmp/package-output",
        }),
        "/artifacts/custom.vsix",
    );
});
