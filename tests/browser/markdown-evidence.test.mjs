import assert from "node:assert/strict";
import test from "node:test";

import { describeBrowserEvidenceError } from "./markdown-evidence.mjs";

test("failure evidence retains every aggregated cause", () => {
    const error = new AggregateError(
        [new Error("primary write failure"), new Error("pending cleanup failure")],
        "evidence failed",
    );
    const description = describeBrowserEvidenceError(error);
    assert.match(description, /primary write failure/);
    assert.match(description, /pending cleanup failure/);
});

test("nested and cyclic error causes cannot hide failures or recurse forever", () => {
    const error = new Error("outer");
    error.cause = new AggregateError([new Error("inner"), error], "nested");
    const description = describeBrowserEvidenceError(error);
    assert.match(description, /outer/);
    assert.match(description, /inner/);
    assert.match(description, /already reported/);
    assert.equal(describeBrowserEvidenceError("plain failure"), "plain failure");
});
