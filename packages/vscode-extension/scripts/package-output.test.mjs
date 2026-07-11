import assert from "node:assert/strict";
import test from "node:test";

import { resolveVsixOutput } from "./package-output.mjs";

test("derives the default VSIX filename from extension manifest identity", () => {
    assert.equal(
        resolveVsixOutput({
            manifest: { name: "forma", version: "0.1.0-alpha.14" },
            temporaryDirectory: "/tmp/package-output",
        }),
        "/tmp/package-output/forma-0.1.0-alpha.14.vsix",
    );
});

test("preserves an explicit VSIX_OUT override", () => {
    assert.equal(
        resolveVsixOutput({
            manifest: { name: "forma", version: "0.1.0-alpha.14" },
            override: "/artifacts/custom.vsix",
            temporaryDirectory: "/tmp/package-output",
        }),
        "/artifacts/custom.vsix",
    );
});
