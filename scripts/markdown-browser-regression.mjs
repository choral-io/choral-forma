import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { markdownBrowserPhases, parseMarkdownBrowserPhase } from "./markdown-browser-protocol.mjs";
import { markdownBrowserScenarios } from "./markdown-browser-scenarios.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execute = promisify(execFile);
const binary = join(root, "target", "debug", process.platform === "win32" ? "forma.exe" : "forma");
await mkdir(join(root, "packages/webapp/.tmp"), { recursive: true });
const artifacts = await mkdtemp(join(root, "packages/webapp/.tmp/markdown-browser-"));
const temporary = await mkdtemp(join(await realpath(tmpdir()), "forma-markdown-browser-"));
const workspace = join(temporary, "workspace");
const site = join(temporary, "site");
let calloutBoundaries;
const session = `forma-md-${process.pid}`;
const cli = process.env.PLAYWRIGHT_CLI ?? "playwright-cli";
const abort = new AbortController();
let interrupted;
let testResult;
let cleanupPromise;
let backend;
let staticServer;
let browserStarted = false;
let backendLog = "";
const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
};

async function command(file, args, timeout = 60_000, cleaning = false, label = "command") {
    let active;
    let watchdog;
    try {
        if (!cleaning) abort.signal.throwIfAborted();
        const running = execute(file, args, {
            cwd: root,
            timeout,
            maxBuffer: 8 * 1024 * 1024,
            signal: cleaning ? undefined : abort.signal,
            killSignal: "SIGTERM",
        });
        active = running.child;
        watchdog = setTimeout(() => {
            if (active?.pid && active.exitCode === null && active.signalCode === null) active.kill("SIGKILL");
        }, timeout + 5000);
        const result = await running;
        const output = result.stdout + result.stderr;
        await writeFile(join(artifacts, `${label}.log`), output);
        return output;
    } catch (error) {
        await writeFile(join(artifacts, `${label}.log`), `${error.stdout ?? ""}${error.stderr ?? ""}\n${error.stack}`);
        throw error;
    } finally {
        // In particular, let playwright-cli forward SIGTERM to its starting daemon.
        try {
            await stop(active);
        } finally {
            clearTimeout(watchdog);
        }
    }
}
async function browserCommand(...args) {
    const output = await command(
        cli,
        [`-s=${session}`, ...args],
        args[0] === "close" ? 10_000 : 120_000,
        args[0] === "close",
        args[0],
    );
    if (/^### Error(?:\r?\n|$)/mu.test(output)) throw new Error(output);
    return output;
}
async function stop(child) {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    const closed = once(child, "close");
    child.kill("SIGTERM");
    const kill = setTimeout(() => child.kill("SIGKILL"), 5000);
    try {
        await closed;
    } finally {
        clearTimeout(kill);
    }
}
for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
]) {
    process.on(signal, () => {
        if (interrupted) return;
        interrupted = signal;
        process.exitCode = code;
        abort.abort(new Error(`Interrupted by ${signal}`));
    });
}

try {
    console.log(`Artifacts: ${artifacts}`);
    await writeFile(join(artifacts, "run.json"), JSON.stringify({ session, temporary, pid: process.pid }));
    calloutBoundaries = JSON.parse(
        await readFile(join(root, "fixtures/forma-validation/cases/markdown-callout-boundaries.json"), "utf8"),
    );
    const readingCases = JSON.parse(
        await readFile(join(root, "fixtures/forma-validation/cases/markdown-reading-p1.json"), "utf8"),
    );
    await command(cli, ["--version"], 10_000, false, "version");
    await cp(join(root, "examples/minimal-workspace"), workspace, { recursive: true });
    await rm(join(workspace, "notes"), { recursive: true });
    await mkdir(join(workspace, "notes"));
    await mkdir(join(workspace, "graph"));
    for (const name of [
        "images.md",
        "image-links.md",
        "viewers.md",
        "callouts.md",
        "callout-review.md",
        "reading-p1.md",
        "callout-compatibility.md",
        "callout-interaction.md",
        "callout-layout.md",
        "image-viewer.svg",
        "image-viewer-tall.svg",
    ]) {
        await cp(join(root, "fixtures/forma-validation/samples/markdown", name), join(workspace, "notes", name));
    }
    await mkdir(join(workspace, "notes/resource-directory.txt"));
    await writeFile(
        join(workspace, "notes/resource-directory.txt/index.md"),
        "# Directory entry\n\n## Details\n\nDirectory alias content.\n",
    );
    await writeFile(join(workspace, "notes/raw-source.txt"), "FORMA_RAW_SOURCE_BROWSER_PROBE\n");
    await writeFile(
        join(workspace, "notes/raw-source.txt.md"),
        "# Raw source sidecar\n\n[Original source](./raw-source.txt?download=1#part)\n\n[Directory entry](./resource-directory.txt#details)\n",
    );
    for (const fixture of readingCases) {
        await writeFile(join(workspace, "notes", `p1-${fixture.id}.md`), `# Reading P1\n\n${fixture.source}\n`);
    }
    await writeFile(
        join(workspace, "notes/callout-boundaries.md"),
        // Retain the basic sample's authored fragment destination in the combined page.
        "# Exact callout boundaries\n\n## Basic callouts\n\n" +
            calloutBoundaries.map((fixture) => `## ${fixture.id}\n\n${fixture.source}`).join("\n\n"),
    );
    await writeFile(
        join(workspace, ".forma/spaces/graph.md"),
        '---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Graph fixture\ninclude:\n  - "graph/**/*.md"\n---\n',
    );
    await writeFile(join(workspace, "graph/selected.md"), "---\ntitle: Selected node\n---\n\n# Selected node\n");
    await writeFile(
        join(workspace, ".forma/views/graph.md"),
        "---\nschemaVersion: 1\nkind: view\ntitle: Browser graph\nmode: graph\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - graph\ngraph:\n  edges:\n    - source: body\n      intent: link\n---\n",
    );

    abort.signal.throwIfAborted();
    backend = spawn(
        binary,
        ["serve", "-w", workspace, "--webapp-dir", join(root, "packages/webapp/dist"), "--bind", "127.0.0.1:0"],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    const origin = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("WebApp server did not become ready")), 30_000);
        const finish = (error, value) => {
            clearTimeout(timer);
            error ? reject(error) : resolve(value);
        };
        abort.signal.addEventListener("abort", () => finish(abort.signal.reason), { once: true });
        const consume = (data) => {
            backendLog += data;
            const match = backendLog.match(/forma serve listening on (http:\/\/127\.0\.0\.1:\d+)/u);
            if (match) finish(undefined, match[1]);
        };
        backend.stdout.on("data", consume);
        backend.stderr.on("data", consume);
        backend.once("error", (error) => finish(error));
        backend.once("exit", (code) => finish(new Error(`WebApp exited ${code}: ${backendLog}`)));
    });
    abort.signal.throwIfAborted();
    staticServer = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            if (!pathname.startsWith("/preview/")) throw new Error("Outside root");
            let file = resolve(site, pathname.slice("/preview/".length));
            if (file !== site && !file.startsWith(site + sep)) throw new Error("Outside site");
            if ((await stat(file)).isDirectory()) file = join(file, "index.html");
            response.setHeader("Content-Type", mime[extname(file)] ?? "application/octet-stream");
            response.end(await readFile(file));
        } catch {
            response.writeHead(404);
            response.end("Not found");
        }
    });
    staticServer.listen(0, "127.0.0.1");
    await once(staticServer, "listening");
    const staticOrigin = `http://127.0.0.1:${staticServer.address().port}`;
    const build = await command(
        binary,
        [
            "site",
            "build",
            "-w",
            workspace,
            "--out",
            site,
            "--base-url",
            staticOrigin,
            "--root-path",
            "/preview",
            "--json",
        ],
        60_000,
        false,
        "static-build",
    );
    await writeFile(join(artifacts, "static-build.json"), build);
    if (JSON.parse(build).status !== "passed") throw new Error("Static build failed");
    const options = {
        artifacts,
        calloutBoundaries,
        readingCases,
        hosts: [
            { name: "webapp", origin, root: "", graph: "/views/.forma/views/graph" },
            { name: "static", origin: staticOrigin, root: "/preview", graph: "/views/graph/" },
        ],
    };
    abort.signal.throwIfAborted();
    browserStarted = true;
    await browserCommand("open", "--browser", process.env.FORMA_BROWSER ?? "chromium");
    const results = [];
    // Bound each host independently; growing syntax coverage must not consume
    // the interaction suite's cumulative command deadline.
    const phases = markdownBrowserPhases(options.hosts, readingCases.length, calloutBoundaries.length);
    const completedPhases = [];
    for (const phase of phases) {
        abort.signal.throwIfAborted();
        const scenario = join(temporary, `scenarios-${phase.name}.js`);
        await writeFile(
            scenario,
            `async page => (${markdownBrowserScenarios.toString()})(page, ${JSON.stringify({ ...options, ...phase })})`,
        );
        const output = await command(
            cli,
            [`-s=${session}`, "run-code", `--filename=${scenario}`],
            120_000,
            false,
            `run-code-${phase.name}`,
        );
        const result = parseMarkdownBrowserPhase(output, phase);
        results.push(...result.results);
        completedPhases.push({ name: phase.name, checks: result.results });
        await writeFile(join(artifacts, "phase-results.json"), JSON.stringify(completedPhases, null, 2));
        console.log(`Completed browser phase: ${phase.name}`);
    }
    testResult = { status: "FORMA_MARKDOWN_BROWSER_PASSED", results };
} catch (error) {
    console.error(`Browser regression failed; artifacts: ${artifacts}`);
    await writeFile(
        join(artifacts, "failure.json"),
        JSON.stringify({ status: interrupted ? "interrupted" : "failed", signal: interrupted, error: error.stack }),
    );
    if (!interrupted) throw error;
} finally {
    await cleanup();
}
if (testResult && !interrupted) {
    await writeFile(join(artifacts, "result.json"), JSON.stringify(testResult, null, 2));
    process.stdout.write(JSON.stringify(testResult, null, 2) + `\nArtifacts: ${artifacts}\n`);
}

function cleanup() {
    return (cleanupPromise ??= (async () => {
        const errors = [];
        const attempt = async (action) => {
            try {
                await action();
            } catch (error) {
                errors.push(error.stack);
            }
        };
        // Startup has settled before finally runs: a close cannot race a later open.
        if (browserStarted) await attempt(() => browserCommand("close"));
        await attempt(() => stop(backend));
        if (staticServer)
            await attempt(async () => {
                staticServer.closeAllConnections();
                await new Promise((resolve, reject) =>
                    staticServer.close((error) => (error ? reject(error) : resolve())),
                );
            });
        await attempt(() => writeFile(join(artifacts, "backend.log"), backendLog));
        await attempt(() => rm(temporary, { recursive: true, force: true }));
        await writeFile(
            join(artifacts, "cleanup.json"),
            JSON.stringify(
                {
                    status: errors.length ? "failed" : "passed",
                    interrupted,
                    backend: backend
                        ? { pid: backend.pid, exitCode: backend.exitCode, signal: backend.signalCode }
                        : null,
                    errors,
                },
                null,
                2,
            ),
        );
        if (errors.length) throw new Error(`Cleanup failed: ${errors.join("; ")}`);
    })());
}
