import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { minimumVSCodeVersion } from "./vscode-compatibility.mjs";

test("the tested editor matches the install floor and types cannot introduce newer APIs", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.equal(manifest.engines.vscode, `^${minimumVSCodeVersion}`);
    const types = /^~(\d+)\.(\d+)\.\d+$/u.exec(manifest.devDependencies["@types/vscode"]);
    assert.ok(types, "keep declaration updates within a single API series");
    const [major, minor] = minimumVSCodeVersion.split(".").map(Number);
    assert.ok(Number(types[1]) < major || (Number(types[1]) === major && Number(types[2]) <= minor));
});
