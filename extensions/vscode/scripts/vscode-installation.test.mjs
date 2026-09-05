import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findInstalledVSCode, installedTestConfiguration, resolveVSCodeVersion } from "./vscode-installation.mjs";

function installation(t, version, quality = "stable", applicationName = "code") {
    const root = mkdtempSync(join(tmpdir(), "forma-installed-vscode-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const candidate = { executablePath: join(root, "code"), appPath: join(root, "resources/app") };
    mkdirSync(candidate.appPath, { recursive: true });
    writeFileSync(candidate.executablePath, "");
    chmodSync(candidate.executablePath, 0o755);
    writeFileSync(join(candidate.appPath, "package.json"), JSON.stringify({ version }));
    writeFileSync(join(candidate.appPath, "product.json"), JSON.stringify({ quality, applicationName }));
    return candidate;
}

test("reuse requires the exact stable editor version and retains isolated test configuration", (t) => {
    const candidate = installation(t, "1.123.2");
    assert.deepEqual(installedTestConfiguration("1.123.2", [candidate]), {
        version: "1.123.2",
        useInstallation: { fromPath: candidate.executablePath },
    });
    assert.deepEqual(installedTestConfiguration("1.123.1", [candidate]), { version: "1.123.1" });
    assert.equal(findInstalledVSCode("1.123.2", [installation(t, "1.123.2", "insider")]), undefined);
    assert.equal(findInstalledVSCode("1.123.2", [installation(t, "1.123.2", "stable", "other-editor")]), undefined);
    for (const argv of [["--code-version", "1.136.1"], ["--code-version=1.136.1"]]) {
        assert.deepEqual(installedTestConfiguration("1.123.2", [candidate], argv), { version: "1.123.2" });
    }
    rmSync(candidate.executablePath);
    assert.equal(findInstalledVSCode("1.123.2", [candidate]), undefined);
});

test("stable resolves to an exact release and failure cannot silently use an older local editor", async () => {
    assert.equal(
        await resolveVSCodeVersion("stable", async () => ({ ok: true, json: async () => ["1.136.1", "1.136.0"] })),
        "1.136.1",
    );
    assert.equal(
        await resolveVSCodeVersion("1.123.2", () => {
            throw new Error("must not fetch");
        }),
        "1.123.2",
    );
    await assert.rejects(
        resolveVSCodeVersion("stable", async () => ({ ok: false, status: 503 })),
        /HTTP 503/u,
    );
    await assert.rejects(
        resolveVSCodeVersion("stable", async () => ({ ok: true, json: async () => [] })),
        /no concrete version/u,
    );
});
