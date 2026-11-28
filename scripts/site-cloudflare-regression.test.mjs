import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { appendFile, mkdir, mkdtemp, open, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium } from "@playwright/test";

import {
    browserCoverage,
    command,
    localGateInputs,
    localSourceIdentity,
    missingInputs,
    readHostConfig,
    strictGateInputs,
    verifyReport,
    waitForBrowserRunner,
} from "./site-cloudflare-regression.mjs";
import { fileTreeDigest } from "./static-site-artifact.mjs";

const execute = promisify(execFile);
const script = fileURLToPath(new URL("./site-cloudflare-regression.mjs", import.meta.url));
const artifactId = "b".repeat(64);
const sourceSha = process.env.GITHUB_ACTIONS === "true" ? process.env.GITHUB_SHA : "a".repeat(40);
const target = { kind: "home", id: "home", path: "/", sourcePath: ".forma.md", outputPath: "index.html" };
const configSource =
    '{"compatibility_date":"2026-07-28","assets":{"directory":"site","html_handling":"drop-trailing-slash","not_found_handling":"404-page",},}\n';

async function fixture(t) {
    const root = await mkdtemp(join(tmpdir(), "forma-site-report-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const artifactDir = join(root, "site");
    const config = join(root, "wrangler.jsonc");
    const report = join(root, "report.json");
    const dataPath = `-/data/${artifactId}`;
    const bootstrap = {
        runtimeVersion: 1,
        dataSchemaVersion: 4,
        artifactId,
        pageRoutePath: "/",
        pageTarget: target,
        rootPath: "/",
        dataBaseUrl: `/${dataPath}`,
    };
    await mkdir(join(artifactDir, dataPath), { recursive: true });
    await writeFile(
        join(artifactDir, "index.html"),
        `<script data-forma-static-workspace type="application/json">${JSON.stringify(bootstrap)}</script>`,
    );
    await writeFile(
        join(artifactDir, dataPath, "dashboard.json"),
        JSON.stringify({
            schemaVersion: 4,
            artifactId,
            status: "passed",
            routes: [target],
            entries: [],
            directories: [],
            views: [],
            resources: [],
        }),
    );
    await writeFile(join(artifactDir, "-/.forma-source-sha"), `${sourceSha}\n`);
    await writeFile(config, configSource);
    const { configSha256, localHostConfigSha256 } = await readHostConfig(config);
    const valid = {
        schemaVersion: 1,
        status: "passed",
        completed: true,
        sourceSha,
        artifactId,
        configSha256,
        localHostConfigSha256,
        ...(await fileTreeDigest(artifactDir)),
        workflowRunId: process.env.GITHUB_RUN_ID ?? null,
        cleanup: { status: "passed", processes: [] },
        failures: [],
        groups: Object.fromEntries(
            ["positive", "negative", "candidate"].map((name) => [name, { status: "passed", assertions: 1 }]),
        ),
        versions: { forma: "forma", wrangler: "4.162.0", playwright: "0.1.24", chromium: "Chromium" },
    };
    await writeFile(report, JSON.stringify(valid));
    return { root, artifactDir, config, report, sourceSha, valid };
}

test("verification binds the report and entire candidate even when a changed file is hidden", async (t) => {
    const options = await fixture(t);
    await verifyReport(options);
    const hidden = join(options.artifactDir, ".hidden");
    await writeFile(hidden, "new hidden file");
    await assert.rejects(verifyReport(options), /treeSha256 mismatch/u);
    await rm(hidden);
    await appendFile(join(options.artifactDir, "index.html"), "\n");
    await assert.rejects(verifyReport(options), /treeSha256 mismatch/u);
});

test("verification rejects missing, failed or incomplete verification and mismatches", async (t) => {
    const options = await fixture(t);
    for (const [changed, expected] of [
        [{ sourceSha: "c".repeat(40) }, /sourceSha mismatch/u],
        [{ artifactId: "c".repeat(64) }, /artifactId mismatch/u],
        [{ workflowRunId: "unexpected" }, /workflowRunId mismatch/u],
        [{ completed: false }, /true/u],
        [{ status: "failed" }, /passed/u],
        [{ groups: {} }, /positive group incomplete/u],
        [{ cleanup: { status: "failed" } }, /passed/u],
    ]) {
        await writeFile(options.report, JSON.stringify({ ...options.valid, ...changed }));
        await assert.rejects(verifyReport(options), expected);
    }
    await rm(options.report);
    await assert.rejects(verifyReport(options), { code: "ENOENT" });
});

test("host semantics and the production config are verified independently", async (t) => {
    const options = await fixture(t);
    await writeFile(options.config, configSource.replace("404-page", "none"));
    const changed = await readHostConfig(options.config);
    assert.notEqual(changed.localHostConfigSha256, options.valid.localHostConfigSha256);
    await assert.rejects(verifyReport(options), /configSha256 mismatch/u);
    await writeFile(options.report, JSON.stringify({ ...options.valid, configSha256: changed.configSha256 }));
    await assert.rejects(verifyReport(options), /localHostConfigSha256 mismatch/u);
    await assert.rejects(verifyReport({ ...options, sourceSha: "c".repeat(40) }), /source marker/u);
});

test("the full-file fingerprint rejects links and is stable independent of creation order", async (t) => {
    const options = await fixture(t);
    const first = join(options.root, "first");
    const second = join(options.root, "second");
    await mkdir(first);
    await mkdir(second);
    for (const [directory, order] of [
        [first, ["a", ".hidden"]],
        [second, [".hidden", "a"]],
    ]) {
        for (const name of order) await writeFile(join(directory, name), name);
    }
    assert.deepEqual(await fileTreeDigest(first), await fileTreeDigest(second));
    if (process.platform !== "win32") {
        await symlink(join(second, "a"), join(first, "linked"));
        await assert.rejects(fileTreeDigest(first), /not a regular file/u);
    }
});

function coverageAttachment(record) {
    return {
        name: "cloudflare-browser-coverage",
        contentType: "application/json",
        body: Buffer.from(JSON.stringify(record)).toString("base64"),
    };
}

test("a browser case must run exactly once and report its complete assertion coverage", () => {
    const name = "positive-root";
    const evidence = { name, assertions: 96, browserVersion: "159.0.8154.6" };
    const result = { status: "passed", retry: 0, attachments: [coverageAttachment(evidence)] };
    const test = { status: "expected", expectedStatus: "passed", results: [result] };
    const spec = { title: name, tests: [test] };
    const report = { errors: [], suites: [{ suites: [{ specs: [spec] }] }] };
    const withSpecs = (specs) => ({ ...report, suites: [{ specs }] });
    const withTest = (overrides) => withSpecs([{ ...spec, tests: [{ ...test, ...overrides }] }]);
    const withResult = (overrides) => withTest({ results: [{ ...result, ...overrides }] });
    const withEvidence = (overrides) =>
        withResult({ attachments: [coverageAttachment({ ...evidence, ...overrides })] });

    assert.deepEqual(browserCoverage(report, name, 96), { assertions: 96, browserVersion: "159.0.8154.6" });
    for (const invalid of [withSpecs([]), withSpecs([spec, spec]), withSpecs([{ ...spec, title: "candidate" }])]) {
        assert.throws(() => browserCoverage(invalid, name, 96), /Expected exactly one Playwright test/u);
    }
    for (const invalid of [
        withTest({ status: "skipped", expectedStatus: "skipped", results: [] }),
        withResult({ status: "interrupted" }),
        withResult({ status: "failed" }),
        withTest({ expectedStatus: "failed", results: [{ ...result, status: "failed" }] }),
        withTest({
            status: "flaky",
            results: [
                { ...result, status: "failed" },
                { ...result, retry: 1 },
            ],
        }),
        withResult({ retry: 1 }),
        withSpecs([{ ...spec, tests: [test, test] }]),
    ]) {
        assert.throws(() => browserCoverage(invalid, name, 96), /must run once and pass/u);
    }
    assert.throws(
        () => browserCoverage({ ...report, errors: [{ message: "runner failed" }] }, name, 96),
        /Playwright errors/u,
    );
    for (const attachments of [[], [coverageAttachment(evidence), coverageAttachment(evidence)]]) {
        assert.throws(
            () => browserCoverage(withResult({ attachments }), name, 96),
            /Missing or duplicate browser coverage/u,
        );
    }
    assert.throws(() => browserCoverage(withEvidence({ name: "candidate" }), name, 96), /candidate/u);
    assert.throws(() => browserCoverage(withEvidence({ assertions: 95 }), name, 96), /Browser assertions incomplete/u);
    assert.throws(() => browserCoverage(withEvidence({ browserVersion: "" }), name, 96), /Missing Chromium version/u);
});

test("a missing browser fails the real entrypoint and replaces any stale passed report", async (t) => {
    const options = await fixture(t);
    await assert.rejects(
        execute(process.execPath, [
            script,
            "--artifact-dir",
            options.artifactDir,
            "--source-sha",
            options.sourceSha,
            "--config",
            options.config,
            "--report",
            options.report,
            "--forma-bin",
            process.execPath,
            "--chromium-executable",
            join(options.root, "missing-browser"),
        ]),
    );
    const report = JSON.parse(await readFile(options.report, "utf8"));
    assert.equal(report.status, "failed");
    assert.equal(report.completed, false);
    assert.equal(report.cleanup.status, "passed");
    assert.match(report.failures[0], /missing-browser/u);
    t.after(() => rm(report.evidenceDirectory, { force: true, recursive: true }));
    await assert.rejects(verifyReport(options), /passed/u);
});

test("a subprocess timeout fails the gate command", async () => {
    await assert.rejects(command(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], { timeout: 100 }), {
        killed: true,
        signal: "SIGTERM",
    });
});

test("a browser runner that exits zero after the outer deadline is rejected", async () => {
    const { promise: closed, resolve, reject } = Promise.withResolvers();
    const signals = [];
    const child = {
        exitCode: null,
        signalCode: null,
        kill(signal) {
            signals.push(signal);
            this.exitCode = 0;
            resolve([0, null]);
            return true;
        },
    };
    const deadline = setTimeout(() => reject(new Error("Browser runner was never interrupted")), 5_000);
    try {
        await assert.rejects(waitForBrowserRunner(child, closed, new AbortController().signal, 1), {
            name: "TimeoutError",
        });
        assert.deepEqual(signals, ["SIGINT"]);
        assert.deepEqual(await closed, [0, null]);
    } finally {
        clearTimeout(deadline);
    }
});

test("names every input a gate or verify-only run lacks", () => {
    assert.deepEqual(missingInputs({ config: "wrangler.jsonc" }, true), ["artifact-dir", "source-sha", "report"]);
    assert.deepEqual(missingInputs({}, false), [
        "forma-bin",
        "artifact-dir",
        "source-sha",
        "config",
        "chromium-executable",
        "report",
    ]);
});

test("fills a local gate run with the repository's tools and pinned Chromium", async () => {
    const given = { "artifact-dir": "site", "source-sha": sourceSha };
    const filled = await localGateInputs(given, {});
    assert.equal(filled["chromium-executable"], chromium.executablePath());
    assert.equal(filled["artifact-dir"], "site");
    assert.equal(filled["source-sha"], sourceSha);
    assert.match(filled.config, /wrangler\.jsonc$/u);
    assert.deepEqual(missingInputs(filled, false), []);

    const environment = { FORMA_SITE_CHROMIUM: "env-chrome" };
    assert.equal((await localGateInputs(given, environment))["chromium-executable"], "env-chrome");
    const overridden = await localGateInputs({ ...given, "chromium-executable": "explicit-chrome" }, environment);
    assert.equal(overridden["chromium-executable"], "explicit-chrome");
});

test("a failed local preparation build replaces any stale passed report", async (t) => {
    const options = await fixture(t);
    const environment = {
        ...process.env,
        CI: "false",
        GITHUB_ACTIONS: "false",
    };

    // Node is deliberately not a Forma binary: the auto-build must fail without starting browsers.
    const head = (await execute("git", ["rev-parse", "HEAD"])).stdout.trim();
    await assert.rejects(
        execute(
            process.execPath,
            [
                script,
                "--source-sha",
                head,
                "--config",
                options.config,
                "--report",
                options.report,
                "--forma-bin",
                process.execPath,
                "--chromium-executable",
                process.execPath,
            ],
            { env: environment },
        ),
    );
    const report = JSON.parse(await readFile(options.report, "utf8"));
    assert.equal(report.status, "failed");
    assert.equal(report.completed, false);
    assert.match(report.failures[0], /Command failed/u);
    assert.equal(report.phase, "preparing");
});

test("CI and verify-only never discover missing inputs; verification leaves reports untouched", async (t) => {
    const options = await fixture(t);
    for (const environment of [{ CI: "true" }, { CI: "1" }, { GITHUB_ACTIONS: "true" }]) {
        assert.equal(strictGateInputs(environment), true);
        await writeFile(options.report, JSON.stringify(options.valid));
        await assert.rejects(
            execute(process.execPath, [script, "--report", options.report], {
                env: { ...process.env, CI: "false", GITHUB_ACTIONS: "false", ...environment },
            }),
            /Missing --forma-bin, --artifact-dir, --source-sha, --config, --chromium-executable/u,
        );
        assert.equal(JSON.parse(await readFile(options.report, "utf8")).status, "failed");
    }
    assert.equal(strictGateInputs({ CI: "false" }), false);
    assert.equal(strictGateInputs({}), false);
    const original = JSON.stringify(options.valid);
    await writeFile(options.report, original);
    await assert.rejects(
        execute(process.execPath, [script, "--verify-only", "--report", options.report]),
        /Missing --artifact-dir, --source-sha, --config/u,
    );
    assert.equal(await readFile(options.report, "utf8"), original);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    test(`verify-only interrupted by ${signal} produces no success and leaves the report untouched`, async (t) => {
        if (process.platform === "win32") return t.skip("The test requires a POSIX FIFO and process signals");
        const { root, artifactDir, sourceSha, report } = await fixture(t);
        const original = await readFile(report);
        const config = join(root, "blocked-config.jsonc");
        await execute("mkfifo", [config]);
        const running = execute(
            process.execPath,
            [
                script,
                "--verify-only",
                "--artifact-dir",
                artifactDir,
                "--source-sha",
                sourceSha,
                "--config",
                config,
                "--report",
                report,
            ],
            { timeout: 10_000, killSignal: "SIGKILL" },
        );
        const result = running.then(
            ({ stdout }) => ({ stdout, signal: null }),
            ({ stdout, signal }) => ({ stdout, signal }),
        );
        let writer;
        try {
            // The nonblocking write end opens only once verification reaches the config read.
            while (!writer) {
                writer = await open(config, constants.O_WRONLY | constants.O_NONBLOCK).catch((error) => {
                    if (error.code !== "ENXIO") throw error;
                });
                if (writer) break;
                assert.equal(running.child.exitCode, null, "Verifier exited before reading the configuration");
                assert.equal(running.child.signalCode, null, "Verifier stopped before reading the configuration");
                await delay(10);
            }
            assert(running.child.kill(signal));
            // Release the unchanged config only if the verifier keeps running after the signal.
            if ((await Promise.race([result, delay(100)])) === undefined) {
                await writer.writeFile(configSource).catch((error) => {
                    if (error.code !== "EPIPE") throw error;
                });
            }
            await writer.close();
            writer = undefined;
            assert.deepEqual(await result, { stdout: "", signal });
        } finally {
            await writer?.close();
            if (running.child.exitCode === null && running.child.signalCode === null) running.child.kill();
            await result;
        }
        assert.deepEqual(await readFile(report), original);
    });
}

test("a temporary directory failure preserves the failed report and its cause", async (t) => {
    const options = await fixture(t);
    const missingTemp = join(options.root, "missing-temporary-directory");
    await writeFile(options.report, JSON.stringify(options.valid));
    await assert.rejects(
        execute(
            process.execPath,
            [
                script,
                "--artifact-dir",
                options.artifactDir,
                "--source-sha",
                options.sourceSha,
                "--config",
                options.config,
                "--report",
                options.report,
                "--forma-bin",
                process.execPath,
                "--chromium-executable",
                process.execPath,
            ],
            { env: { ...process.env, CI: "true", TMPDIR: missingTemp, TMP: missingTemp, TEMP: missingTemp } },
        ),
        /ENOENT/u,
    );
    const report = JSON.parse(await readFile(options.report, "utf8"));
    assert.equal(report.status, "failed");
    assert.equal(report.completed, false);
    assert(report.failures[0].includes(missingTemp));
});

test("preparation cannot replace a site file through an aliased artifact directory", async (t) => {
    const options = await fixture(t);
    const artifactAlias = join(options.root, "alias");
    await symlink(options.artifactDir, artifactAlias, process.platform === "win32" ? "junction" : "dir");
    const siteFile = join(options.artifactDir, "index.html");
    const before = await readFile(siteFile, "utf8");
    await assert.rejects(
        execute(process.execPath, [script, "--artifact-dir", artifactAlias, "--report", siteFile], {
            env: { ...process.env, CI: "true" },
        }),
        /Report must be outside the artifact directory/u,
    );
    assert.equal(await readFile(siteFile, "utf8"), before);
});

test("local source identity distinguishes the baseline, dirty files and the executed binary", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "forma-source-identity-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const git = (args) => execute("git", args, { cwd: directory });
    await git(["init", "--quiet"]);
    await writeFile(join(directory, "source"), "original");
    await writeFile(join(directory, ".gitignore"), "ignored\n");
    await git(["add", "."]);
    await git([
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--quiet",
        "-m",
        "fixture",
    ]);
    const first = await localSourceIdentity(directory, process.execPath);
    assert.equal(first.kind, "local-worktree");
    assert.equal(first.releaseEvidence, false);
    assert.equal(first.dirty, false);
    await writeFile(join(directory, "ignored"), "local-only");
    assert.deepEqual(await localSourceIdentity(directory, process.execPath), first);
    await writeFile(join(directory, "source"), "changed");
    const changed = await localSourceIdentity(directory, process.execPath);
    assert.equal(changed.dirty, true);
    assert.equal(changed.baselineSha, first.baselineSha);
    assert.notEqual(changed.worktreeSha256, first.worktreeSha256);
    await writeFile(join(directory, "new-file"), "new");
    const added = await localSourceIdentity(directory, process.execPath);
    assert.notEqual(added.worktreeSha256, changed.worktreeSha256);
    await rm(join(directory, "source"));
    const removed = await localSourceIdentity(directory, process.execPath);
    assert.notEqual(removed.worktreeSha256, added.worktreeSha256);
    const otherBinary = join(directory, "ignored");
    const binaryChanged = await localSourceIdentity(directory, otherBinary);
    assert.notEqual(binaryChanged.formaBinSha256, removed.formaBinSha256);
});

test("verify-only rejects changed local source evidence and never alters the report", async (t) => {
    if (process.env.GITHUB_ACTIONS === "true")
        return t.skip("Local source reports are intentionally forbidden in deployment CI");
    const options = await fixture(t);
    const repository = fileURLToPath(new URL("..", import.meta.url));
    const localSource = await localSourceIdentity(repository, process.execPath);
    await writeFile(options.report, JSON.stringify({ ...options.valid, localSource }));
    await verifyReport(options);
    for (const change of [{ worktreeSha256: "0".repeat(64) }, { formaBinSha256: "0".repeat(64) }]) {
        const contents = JSON.stringify({ ...options.valid, localSource: { ...localSource, ...change } });
        await writeFile(options.report, contents);
        await assert.rejects(verifyReport(options), /Local candidate source changed since verification/u);
        assert.equal(await readFile(options.report, "utf8"), contents);
    }
});
