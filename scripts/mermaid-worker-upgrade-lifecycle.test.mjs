import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { terminateChildProcess } from "../packages/webapp/scripts/child-process.mjs";

test("waits for the child close event after requesting termination", async () => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.signalCode = null;
    child.kill = (signal) => {
        assert.equal(signal, "SIGTERM");
        return true;
    };

    let settled = false;
    const termination = terminateChildProcess(child).then(() => {
        settled = true;
    });

    await Promise.resolve();
    assert.equal(settled, false);

    child.exitCode = 0;
    child.signalCode = "SIGTERM";
    child.emit("close", 0, "SIGTERM");
    await termination;

    assert.equal(settled, true);
});
