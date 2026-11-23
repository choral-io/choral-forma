import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { constants } from "node:fs";
import {
    access,
    appendFile,
    cp,
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    readlink,
    realpath,
    rename,
    rm,
    stat,
    writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, promisify } from "node:util";

import ts from "typescript";

import { observeReader, sectionHeading } from "./reader-browser-diagnostics.mjs";

import {
    runStaticNavigationFailureScenarios,
    staticNavigationBrowserAssertions,
} from "./static-navigation-browser-scenarios.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(root, "node_modules", ".bin", "wrangler");
const execute = promisify(execFile);
const shaPattern = /^[0-9a-f]{64}$/u;
const artifactSchema = 4;
const pass = /^(passed|warning)$/u;
const requiredGroups = ["positive", "negative", "candidate"];
const selector = 'script[data-forma-static-workspace][type="application/json"]';
const schema = 1;

class HostMismatch extends Error {}

function sha256(data) {
    return createHash("sha256").update(data).digest("hex");
}

function assertOutside(directory, path, description) {
    const file = relative(directory, path);
    assert(file === ".." || file.startsWith(`..${sep}`) || isAbsolute(file), description);
}

function artifactFile(directory, path) {
    assert(typeof path === "string" && !path.includes("\\"));
    assert(
        path.split("/").every((part) => part && part !== "." && part !== ".."),
        `Unsafe artifact path: ${path}`,
    );
    return resolve(directory, path);
}

export async function fileTreeDigest(directory) {
    const files = [];
    async function visit(path) {
        const target = path ? artifactFile(directory, path) : directory;
        const item = await lstat(target);
        if (item.isDirectory()) {
            for (const child of await readdir(target)) {
                await visit(path ? `${path}/${child}` : child);
            }
        } else {
            assert(item.isFile(), `Artifact entry is not a regular file: ${path}`);
            files.push(path);
        }
    }
    await visit("");
    files.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const tree = createHash("sha256");
    for (const path of files) {
        const utf8 = Buffer.from(path);
        const length = Buffer.alloc(8);
        length.writeBigUInt64BE(BigInt(utf8.length));
        tree.update(length).update(utf8);
        tree.update(Buffer.from(sha256(await readFile(artifactFile(directory, path))), "hex"));
    }
    return { treeSha256: tree.digest("hex"), fileCount: files.length };
}

export async function readHostConfig(path) {
    const content = await readFile(path);
    const parsed = ts.parseConfigFileTextToJson(path, content.toString());
    assert(!parsed.error && parsed.config, "Unable to read deployment configuration");
    const config = parsed.config;
    const deploymentFields = new Set([
        "$schema",
        "name",
        "compatibility_date",
        "compatibility_flags",
        "workers_dev",
        "preview_urls",
        "routes",
        "assets",
    ]);
    const assetFields = new Set(["directory", "not_found_handling", "html_handling"]);
    assert(
        Object.keys(config).every((key) => deploymentFields.has(key)),
        "Production configuration is not asset-only",
    );
    assert(
        config.assets && Object.keys(config.assets).every((key) => assetFields.has(key)),
        "Unexpected Cloudflare assets configuration",
    );
    assert(typeof config.compatibility_date === "string" && typeof config.assets.directory === "string");
    const local = {
        compatibility_date: config.compatibility_date,
        compatibility_flags: config.compatibility_flags ?? [],
        assets: {
            html_handling: config.assets.html_handling,
            not_found_handling: config.assets.not_found_handling,
        },
    };
    return {
        local,
        configuredDirectory: resolve(dirname(path), config.assets.directory),
        configSha256: sha256(content),
        localHostConfigSha256: sha256(JSON.stringify(local)),
    };
}

function bootstrap(html) {
    const data = html.match(/<script\s+data-forma-static-workspace\s+type="application\/json">([^]*?)<\/script>/u);
    if (!data) throw new HostMismatch("HTML is missing the Forma bootstrap");
    const config = JSON.parse(data[1]);
    assert.equal(config.runtimeVersion, 1);
    assert.equal(config.dataSchemaVersion, artifactSchema);
    assert.match(config.artifactId, shaPattern);
    assert.match(config.rootPath, /^\/(?:[A-Za-z0-9_~.-]+(?:\/[A-Za-z0-9_~.-]+)*)?$/u);
    assert(!config.rootPath.split("/").some((segment) => segment === "." || segment === ".."));
    const prefix = config.rootPath === "/" ? "" : config.rootPath;
    assert.equal(config.dataBaseUrl, `${prefix}/-/data/${config.artifactId}`);
    return config;
}

function validateEnvelope(record, artifactId) {
    assert.equal(record.schemaVersion, artifactSchema);
    assert.equal(record.artifactId, artifactId);
}

function routeIdentity({ id, kind, path, outputPath, sourcePath, taxonomyId }) {
    return { id, kind, path, outputPath, sourcePath, taxonomyId };
}

function sameTarget(actual, expected) {
    return JSON.stringify(routeIdentity(actual ?? {})) === JSON.stringify(routeIdentity(expected));
}

export async function readManifest(directory) {
    const config = bootstrap(await readFile(artifactFile(directory, "index.html"), "utf8"));
    const dataPath = `-/data/${config.artifactId}`;
    const manifest = JSON.parse(await readFile(artifactFile(directory, `${dataPath}/dashboard.json`), "utf8"));
    validateEnvelope(manifest, config.artifactId);
    assert.match(manifest.status, pass);
    for (const key of ["routes", "entries", "directories", "views", "resources"]) assert(Array.isArray(manifest[key]));
    assert.equal(new Set(manifest.routes.map(({ path }) => path)).size, manifest.routes.length);
    const home = manifest.routes.find(({ kind }) => kind === "home");
    assert(home && sameTarget(config.pageTarget, home) && config.pageRoutePath === home.path);
    const details = [...manifest.entries.flatMap((entry) => [entry, ...entry.variants]), ...manifest.views];
    assert.equal(new Set(details.map((detail) => detail.dataPath)).size, details.length);
    for (const detail of details) assert.match(detail.dataPath, /^(?:entries|views)\/[0-9a-f]{64}\.json$/u);
    return { config, dataPath, manifest, details };
}

async function candidateBinding({ artifactDir, sourceSha, config, report }) {
    assert.match(sourceSha, /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
    assertOutside(
        artifactDir,
        resolve(await realpath(dirname(report)), report.split(sep).at(-1)),
        "Report must be outside the artifact directory",
    );
    const [host, tree] = await Promise.all([readHostConfig(config), fileTreeDigest(artifactDir)]);
    const marker = await readFile(artifactFile(artifactDir, "-/.forma-source-sha"), "utf8");
    assert(marker.trim() === sourceSha, "Artifact source marker does not match the candidate");
    const { config: bootstrapConfig, ...data } = await readManifest(artifactDir);
    if (process.env.GITHUB_ACTIONS === "true") {
        assert.equal(host.configuredDirectory, artifactDir, "CI artifact does not match the deployment configuration");
        assert.match(process.env.GITHUB_RUN_ID ?? "", /^\d+$/u);
        assert.equal(process.env.GITHUB_SHA, sourceSha);
    }
    assert.equal(bootstrapConfig.rootPath, "/", "Candidate artifact must target the configured origin root");
    const { configSha256, localHostConfigSha256 } = host;
    const binding = {
        sourceSha,
        artifactId: bootstrapConfig.artifactId,
        configSha256,
        localHostConfigSha256,
        ...tree,
        workflowRunId: process.env.GITHUB_RUN_ID ?? null,
    };
    return { binding, data: { config: bootstrapConfig, ...data }, host };
}

export async function verifyReport(options) {
    const { binding } = await candidateBinding(options);
    const report = JSON.parse(await readFile(options.report, "utf8"));
    assert.equal(report.schemaVersion, schema);
    assert.equal(report.status, "passed");
    assert.equal(report.completed, true);
    for (const [key, value] of Object.entries(binding))
        assert.equal(report[key], value, `Site verification ${key} mismatch`);
    for (const key of requiredGroups) {
        assert.equal(report.groups?.[key]?.status, "passed", `Site verification ${key} group incomplete`);
        assert(report.groups[key].assertions > 0, `Site verification ${key} group has no assertions`);
    }
    assert.equal(report.cleanup?.status, "passed");
    assert.deepEqual(report.failures, []);
    for (const key of ["forma", "wrangler", "playwright", "chromium"]) assert(report.versions?.[key]);
    if (report.localSource) {
        assert.notEqual(process.env.GITHUB_ACTIONS, "true", "Local worktree evidence cannot authorize CI deployment");
        assert.deepEqual(
            await localSourceIdentity(root, report.localSource.formaBin),
            report.localSource,
            "Local candidate source changed since verification",
        );
    }
    return binding;
}

function requestPath(path) {
    return path.replace(/\/+$/u, "").split("/").map(decodeURIComponent);
}

async function request(origin, path, signal) {
    let url = new URL(path, origin);
    const chain = [];
    for (let redirects = 0; redirects < 6; redirects += 1) {
        const response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        });
        chain.push({ path: url.pathname, status: response.status, media: response.headers.get("content-type") });
        const location = response.headers.get("location");
        if (![301, 302, 303, 307, 308].includes(response.status) || !location) return { response, chain };
        const redirect = new URL(location, url);
        await response.body?.cancel();
        if (
            redirect.origin !== origin ||
            url.search !== redirect.search ||
            JSON.stringify(requestPath(url.pathname)) !== JSON.stringify(requestPath(redirect.pathname))
        ) {
            throw new HostMismatch(`Host rewrote the request target: ${url.pathname} → ${redirect.pathname}`);
        }
        url = redirect;
    }
    throw new HostMismatch(`Host redirect chain did not finish: ${path}`);
}

async function requireResponse(origin, path, media, signal) {
    const { response, chain } = await request(origin, path, signal);
    if (response.status !== 200 || !media.test(response.headers.get("content-type") ?? "")) {
        await response.body?.cancel();
        throw new HostMismatch(`Unexpected response for ${path}: ${JSON.stringify(chain)}`);
    }
    return response;
}

function publicPath(config, path) {
    if (config.rootPath === "/") return path;
    return `${config.rootPath}${path}`;
}

async function pageProbe(origin, config, expected, signal, directory) {
    const path = publicPath(config, expected.path);
    const response = await requireResponse(origin, path, /^text\/html\b/iu, signal);
    const html = await response.text();
    const actual = bootstrap(html);
    if (
        actual.artifactId !== config.artifactId ||
        actual.rootPath !== config.rootPath ||
        actual.pageRoutePath !== expected.path ||
        !sameTarget(actual.pageTarget, expected) ||
        !html.includes("data-static-fallback")
    ) {
        throw new HostMismatch(`Host delivered different static content for ${path}`);
    }
    if (directory) {
        const written = await readFile(artifactFile(directory, expected.outputPath), "utf8");
        if (html !== written) throw new HostMismatch(`Host returned different HTML bytes for ${path}`);
    }
    return html;
}

function validateDetail(payload, detail, artifactId) {
    validateEnvelope(payload, artifactId);
    assert.equal(payload.routePath, detail.routePath);
    if (detail.configId) {
        for (const field of ["configId", "publicId", "sourcePath"]) assert.equal(payload[field], detail[field]);
    } else {
        assert.equal(payload.path, detail.path);
    }
}

async function probeArtifact(origin, directory, data, signal) {
    const { config, dataPath, manifest, details } = data;
    const dashboard = await requireResponse(
        origin,
        `${config.dataBaseUrl}/dashboard.json`,
        /^application\/json\b/iu,
        signal,
    );
    assert.equal(
        sha256(Buffer.from(await dashboard.arrayBuffer())),
        sha256(await readFile(artifactFile(directory, `${dataPath}/dashboard.json`))),
    );
    const kinds = new Set();
    const samples = [];
    for (const route of manifest.routes) {
        await pageProbe(origin, config, route, signal, directory);
        const path = publicPath(config, route.path);
        if (!kinds.has(route.kind) || /%[\dA-F]{2}/u.test(path)) {
            kinds.add(route.kind);
            samples.push({ path, target: routeIdentity(route) });
        }
    }
    for (const detail of details) {
        const response = await requireResponse(
            origin,
            `${config.dataBaseUrl}/${detail.dataPath}`,
            /^application\/json\b/iu,
            signal,
        );
        const served = await response.text();
        assert.equal(served, await readFile(artifactFile(directory, `${dataPath}/${detail.dataPath}`), "utf8"));
        validateDetail(JSON.parse(served), detail, config.artifactId);
    }
    for (const resource of manifest.resources) {
        const response = await requireResponse(
            origin,
            resource.publicPath,
            new RegExp(`^${RegExp.escape(resource.mediaType)}(?:;|$)`, "iu"),
            signal,
        );
        assert.equal(
            sha256(Buffer.from(await response.arrayBuffer())),
            sha256(await readFile(artifactFile(directory, resource.outputPath))),
        );
    }
    return {
        assertions: manifest.routes.length + details.length + manifest.resources.length + 1,
        samples,
    };
}

async function port() {
    const server = createServer();
    const listening = once(server, "listening");
    server.listen(0, "127.0.0.1");
    await listening;
    const value = server.address().port;
    await new Promise((done, fail) => server.close((error) => (error ? fail(error) : done())));
    return value;
}

async function stopService(processId, closed) {
    function kill(signal) {
        try {
            process.kill(-processId, signal);
        } catch (error) {
            if (error.code !== "ESRCH") throw error;
        }
    }
    kill("SIGTERM");
    const timeout = setTimeout(() => kill("SIGKILL"), 4_000);
    try {
        return await closed;
    } finally {
        clearTimeout(timeout);
        kill("SIGKILL");
    }
}

function hostEnvironment(temporary) {
    return {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:CLOUDFLARE_|CF_)/u.test(key))),
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_LOG: "log",
        WRANGLER_LOG_PATH: resolve(temporary, "wrangler-logs"),
    };
}

async function withHost(context, directory, name, operation) {
    const { temporary, host, signal } = context;
    signal.throwIfAborted();
    const configuration = resolve(temporary, `${name}-wrangler.json`);
    await writeFile(
        configuration,
        JSON.stringify({
            ...host.local,
            name: `forma-site-regression-${name}`,
            workers_dev: false,
            preview_urls: false,
            assets: { ...host.local.assets, directory },
        }),
    );
    return withLocalService(
        context,
        name,
        wrangler,
        temporary,
        (address) => [
            "dev",
            "--local",
            "--ip",
            "127.0.0.1",
            "--port",
            String(address),
            "--config",
            configuration,
            "--persist-to",
            resolve(temporary, `${name}-state`),
            "--show-interactive-dev-session=false",
        ],
        operation,
    );
}

async function withLocalService(context, name, binary, cwd, args, operation) {
    const { temporary, signal, processes } = context;
    const address = await port();
    const origin = `http://127.0.0.1:${address}`;
    const child = spawn(binary, args(address), {
        cwd,
        env: hostEnvironment(temporary),
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    child.stdout.on("data", (chunk) => {
        log += chunk;
    });
    child.stderr.on("data", (chunk) => {
        log += chunk;
    });
    const closed = once(child, "close");
    try {
        const startup = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
        let ready = false;
        while (!ready) {
            startup.throwIfAborted();
            if (child.exitCode !== null || child.signalCode !== null)
                throw new Error(`Local process exited during ${name} startup`);
            const probe = await fetch(origin, { signal: startup }).catch(() => undefined);
            if (probe) {
                await probe.body?.cancel();
                ready = true;
            } else {
                await delay(150, undefined, { signal: startup });
            }
        }
        return await operation(origin);
    } catch (error) {
        error.message += `\nLocal process ${name}: ${log.slice(-2000)}`;
        throw error;
    } finally {
        if (child.pid) {
            const [code, termination] = await stopService(child.pid, closed);
            processes.push({ name, code, termination });
        } else {
            await closed;
        }
        await writeFile(resolve(temporary, `${name}-service.log`), log);
    }
}

export function command(bin, args, options) {
    const timeout = options.timeout ?? 30_000;
    const running = execute(bin, args, { maxBuffer: 16 * 1024 * 1024, ...options, timeout });
    const timeoutWatchdog = setTimeout(() => running.child.kill("SIGKILL"), timeout + 4_000);
    let abortWatchdog;
    const watchdogAfterAbort = () => {
        abortWatchdog = setTimeout(() => running.child.kill("SIGKILL"), 4_000);
    };
    options.signal?.addEventListener("abort", watchdogAfterAbort, { once: true });
    return running.finally(() => {
        clearTimeout(timeoutWatchdog);
        clearTimeout(abortWatchdog);
        options.signal?.removeEventListener("abort", watchdogAfterAbort);
    });
}

async function browserProbe(context, origin, name, data, samples, fixture) {
    const { temporary, options, signal, processes } = context;
    const session = `forma-site-${process.pid}-${name}`;
    const configuration = resolve(temporary, `${name}-browser.json`);
    await writeFile(
        configuration,
        JSON.stringify({
            browser: {
                browserName: "chromium",
                launchOptions: { executablePath: options.chromiumExecutable, headless: true },
                contextOptions: { reducedMotion: "no-preference" },
            },
        }),
    );
    const outputPath = resolve(temporary, `${name}-browser.js`);
    const browserInputs = { origin, samples, fixture, base: data.config.dataBaseUrl, root: data.config.rootPath };
    await writeFile(
        outputPath,
        `async (page) => { return (${browserChecks.toString()})(page, ${JSON.stringify(browserInputs)}, ${runStaticNavigationFailureScenarios.toString()}, ${observeReader}, ${sectionHeading}); }`,
    );
    const invoke = async (args, cleanup = false) => {
        try {
            const { stdout, stderr } = await command(options.playwrightCli, [`-s=${session}`, ...args], {
                cwd: temporary,
                signal: cleanup ? undefined : signal,
                timeout: cleanup ? 15_000 : 120_000,
            });
            if (/^### Error\b/mu.test(stdout + stderr)) throw new Error(stdout + stderr);
            return stdout;
        } catch (error) {
            const detail = `${error.message}\n${error.stdout ?? ""}${error.stderr ?? ""}`;
            await writeFile(resolve(temporary, `${name}-${args[0]}-browser-failed.log`), detail);
            throw new Error(detail, { cause: error });
        }
    };
    try {
        await invoke(["open", "--config", configuration, "--idle-timeout", "150000"]);
        const output = await invoke(["run-code", "--filename", outputPath]);
        await writeFile(resolve(temporary, `${name}-browser.log`), output);
        const record = output.match(/FORMA_CHECKS_(\d+)_([0-9a-f]+)/u);
        assert(record, `No test completion marker from Playwright: ${output}`);
        assert.equal(
            Number(record[1]),
            samples.length * 4 + (fixture ? 4 + staticNavigationBrowserAssertions : 0),
            "Browser assertions incomplete",
        );
        return { assertions: Number(record[1]), browserVersion: Buffer.from(record[2], "hex").toString() };
    } finally {
        try {
            await invoke(["close"], true);
            processes.push({ name: `${name}-browser`, code: 0 });
        } catch (error) {
            processes.push({ name: `${name}-browser`, cleanupError: error.message });
            throw error;
        }
    }
}

async function browserChecks(
    page,
    { origin, samples, fixture, base, root },
    runNavigationScenarios,
    observe,
    headingForSection,
) {
    let assertions = 0;
    function expect(condition, diagnostic) {
        if (!condition) throw new Error(diagnostic);
    }
    const browser = page.context().browser();
    const withoutJavaScript = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
    const rpcRequests = [];
    page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/-/rpc")) rpcRequests.push(request.url());
    });
    async function verifyLinkIcons(surface) {
        await surface.evaluate(async () => {
            const family = "Lucide Link Icons";
            for (const [kind, glyph] of Object.entries({ external: "\ue0b9", anchor: "\ue0ef" })) {
                const link = document.querySelector(`main a[data-link-kind="${kind}"]`);
                if (!link) throw new Error(`Missing ${kind} link in the browser fixture`);
                const icon = getComputedStyle(link, "::after");
                if (!icon.content.includes(glyph) || !icon.fontFamily.includes(family))
                    throw new Error(`Incorrect ${kind} link icon style`);
                const faces = await document.fonts.load(`16px "${family}"`, glyph).catch((error) => {
                    throw new Error(`Could not load the ${kind} link icon font: ${error.message}`);
                });
                if (faces.length === 0) throw new Error(`Missing font face for the ${kind} link icon`);
            }
        });
        assertions += 1;
    }
    async function currentTarget(probe, initialHeading) {
        await page.locator("[data-enhancement-ready][data-workspace-route]").waitFor({ timeout: 12_000 });
        const routes = await page.locator("[data-enhancement-ready]").getAttribute("data-workspace-route");
        expect(routes === probe.target.path, `Unexpected enhanced route ${routes}, expected ${probe.target.path}`);
        const boot = await page.locator("script[data-forma-static-workspace]").textContent();
        const target = JSON.parse(boot).pageTarget;
        expect(
            target.id === probe.target.id &&
                target.kind === probe.target.kind &&
                target.sourcePath === probe.target.sourcePath &&
                target.taxonomyId === probe.target.taxonomyId,
            `HTML target changed for ${probe.path}`,
        );
        expect(
            !(await page.locator("[data-static-fallback]").count()),
            `Static fallback survived enhancement: ${probe.path}`,
        );
        const main = page.locator("[data-enhancement-ready] main");
        if (["entry", "view", "taxonomy", "taxonomyTerm"].includes(probe.target.kind)) {
            await main
                .getByRole("heading", { level: 1, name: initialHeading, exact: true })
                .and(main.locator("h1").first())
                .waitFor({ timeout: 12_000 });
        } else {
            await main.locator("h1").first().waitFor({ timeout: 12_000 });
        }
    }
    const enhancedSnapshot = await observe(page);
    let snapshot = enhancedSnapshot;
    try {
        const staticPage = await withoutJavaScript.newPage();
        const initialSnapshot = await observe(staticPage);
        for (const probe of samples) {
            const url = origin + probe.path + "?keep=1&keep=2";
            snapshot = initialSnapshot;
            const response = await staticPage.goto(url);
            expect(
                response.status() === 200 && (await staticPage.locator("[data-static-fallback]").count()) === 1,
                `Initial static HTML failed ${probe.path}`,
            );
            const initialHeading = (await staticPage.locator("main h1").first().innerText()).trim();
            assertions += 1;
            const staticReload = await staticPage.reload();
            expect(
                staticReload.status() === 200 && (await staticPage.locator("[data-static-fallback]").count()) === 1,
                `Static refresh failed ${probe.path}`,
            );
            assertions += 1;
            snapshot = enhancedSnapshot;
            await page.goto(url);
            await currentTarget(probe, initialHeading);
            expect(new URL(page.url()).search === "?keep=1&keep=2", `Canonical route lost the query: ${probe.path}`);
            assertions += 1;
            await page.reload();
            await currentTarget(probe, initialHeading);
            assertions += 1;
        }
        if (fixture) {
            const home = origin + (root === "/" ? "/" : root);
            const target = root === "/" ? fixture.target : root + fixture.target;
            const url = origin + target + "?keep=1&keep=2#fixture-section";
            snapshot = initialSnapshot;
            await staticPage.goto(url);
            expect(
                await staticPage.evaluate(() => document.querySelector(":target")?.id === "fixture-section"),
                "Static direct fragment did not identify the section",
            );
            assertions += 1;
            await staticPage.goto(home);
            await staticPage.getByRole("link", { name: "Cloudflare fixture link", exact: true }).click();
            await staticPage.waitForURL(url);
            expect(
                await staticPage.evaluate(() => document.querySelector(":target")?.id === "fixture-section"),
                "Static link click did not retain the explicit query and fragment",
            );
            assertions += 1;
            snapshot = enhancedSnapshot;
            await page.goto(url);
            await headingForSection(page, "fixture-section", "Fixture Section").waitFor({ timeout: 12_000 });
            expect(
                await page.evaluate(
                    () => location.hash === "#fixture-section" && !!document.getElementById("fixture-section"),
                ),
                "Direct enhancement did not retain the fragment target",
            );
            assertions += 1;
            await verifyLinkIcons(page);
            assertions += await runNavigationScenarios(page, { origin, base, root, fixture }, observe);
        }
        expect(rpcRequests.length === 0, `Static enhancement attempted RPC: ${rpcRequests.join(", ")}`);
        // CLI result formatting is human-oriented. This line supplies a machine-readable completion sentinel.
        return `FORMA_CHECKS_${assertions}_${Buffer.from(await browser.version()).toString("hex")}`;
    } catch (error) {
        throw new Error(`${error.message}\nDiagnostics: ${JSON.stringify(await snapshot())}`, { cause: error });
    } finally {
        await withoutJavaScript.close();
    }
}

async function writeFixture(temporary, name) {
    const workspace = resolve(temporary, `${name}-workspace`);
    await cp(resolve(root, "examples/minimal-workspace"), workspace, { recursive: true });
    const mainConfig = resolve(workspace, ".forma.md");
    const main = await readFile(mainConfig, "utf8");
    await writeFile(
        mainConfig,
        main
            .replace('    - "en"\n', '    - "en"\n    - "zh-Hans"\n')
            .replace('  - ".forma/spaces/*.md"', '  - ".forma/spaces/*.md"\n  - ".forma/views/other/*.md"'),
    );
    const changes = {
        "notes/with space.md":
            "# Fixture Exact Note\n\n## Fixture Section\n\n![Fixture Diagram](../diagram.svg)\n\n[External resource](https://example.com/) and [this section](#fixture-section).\n\nText.[^route-check]\n\n[^route-check]: Route footnote.\n",
        "notes/with space.zh-hans.md": "# Fixture Translated Note\n\n## Fixture Section\n",
        "notes/.index.md": "# Fixture Directory Introduction\n\n## Directory Section\n",
        "notes/report.html.md": "# Fixture Dotted Note\n",
        "notes/percent%2F.md": "# Fixture Literal Escape\n",
        "diagram.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>\n',
    };
    for (const [path, content] of Object.entries(changes)) await writeFile(resolve(workspace, path), content);
    await appendFile(
        mainConfig,
        [
            "\n[Cloudflare fixture link](notes/with%20space.md?keep=1&keep=2#fixture-section)",
            "[Cloudflare alternate link](notes/report.html.md)",
            "[Cloudflare directory link](notes/?keep=1&keep=2#directory-section)",
            "[Cloudflare variant link](notes/with%20space.zh-hans.md?keep=1&keep=2#fixture-section)",
            ...Array.from({ length: 25 }, (_, index) => `Cloudflare navigation fixture paragraph ${index + 1}.`),
            "",
        ].join("\n\n"),
    );
    const viewDirectory = resolve(workspace, ".forma/views/other");
    await mkdir(viewDirectory);
    const view = await readFile(resolve(workspace, ".forma/views/notes.md"), "utf8");
    await writeFile(resolve(viewDirectory, "notes.md"), view.replaceAll("Notes", "Fixture Colliding View"));
    await writeFile(resolve(workspace, ".forma/views/gate.md"), view.replaceAll("Notes", "Fixture Gate View"));
    return workspace;
}

async function addTaxonomy(workspace, filename, id, terms) {
    const directory = resolve(workspace, ".forma", "spaces");
    await writeFile(
        resolve(directory, `${filename}.md`),
        `---\nschemaVersion: 1\nkind: taxonomy\nid: ${JSON.stringify(id)}\ntitle: ${filename}\nmode: multiple\n---\n\n# ${filename}\n\n<!-- forma:content -->\n`,
    );
    for (const [offset, term] of terms.entries()) {
        await writeFile(
            resolve(directory, `${filename}-${offset}.md`),
            `---\nschemaVersion: 1\nkind: term\nid: ${JSON.stringify(term)}\ntaxonomy: ${JSON.stringify(id)}\ntitle: ${filename} Term ${offset}\n---\n\n# ${filename} Term ${offset}\n\n<!-- forma:content -->\n`,
        );
    }
}

async function formaResult(context, workspace, args) {
    const options = { cwd: workspace, signal: context.signal, timeout: 60_000 };
    try {
        const { stdout } = await command(context.options.formaBin, [...args, "--json"], options);
        return { code: 0, data: JSON.parse(stdout) };
    } catch (error) {
        if (typeof error.code !== "number" || !error.stdout) throw error;
        return { code: error.code, data: JSON.parse(error.stdout) };
    }
}

async function buildFixture(context, workspace, output, rootPath) {
    return formaResult(context, workspace, [
        "site",
        "build",
        "--out",
        output,
        "--root-path",
        rootPath,
        "--base-url",
        "https://fixture.example",
    ]);
}

function requireBuild(build) {
    assert.equal(build.code, 0, JSON.stringify(build.data));
    assert.equal(build.data.status, "passed");
}

function checkStatus(check, status) {
    assert.equal(check.data.operation, "check");
    assert.equal(check.data.status, status, JSON.stringify(check.data));
}

async function positiveGroup(context) {
    const workspace = await writeFixture(context.temporary, "positive");
    await addTaxonomy(workspace, "LiteralTaxonomy", "a%2Fb", [
        "中文 空格",
        "a%2Fb",
        "a%25b",
        "a+b",
        "hash#q?",
        "report.html",
    ]);
    let assertions = 0;
    const builds = [];
    for (const [name, rootPath] of [
        ["root", "/"],
        ["preview", "/preview"],
    ]) {
        context.signal.throwIfAborted();
        const result = { rootPath, status: "failed", http: 0, browser: 0 };
        builds.push(result);
        try {
            const hosting = resolve(context.temporary, `positive-${name}-hosting`);
            if (rootPath !== "/") await mkdir(hosting);
            const output = rootPath === "/" ? hosting : resolve(hosting, "preview");
            requireBuild(await buildFixture(context, workspace, output, rootPath));
            const data = await readManifest(output);
            assert.equal(data.config.rootPath, rootPath);
            result.artifactId = data.config.artifactId;
            const requiredKinds = [
                "home",
                "taxonomies",
                "taxonomy",
                "taxonomyTerm",
                "directory",
                "entry",
                "views",
                "view",
                "health",
            ];
            assert(requiredKinds.every((kind) => data.manifest.routes.some((route) => route.kind === kind)));
            assert(data.manifest.resources.some(({ path }) => path === "diagram.svg"));
            assert(data.manifest.entries.some(({ variants }) => variants.length > 0));
            assert(data.manifest.routes.some((route) => route.kind === "taxonomyTerm" && route.id === "a%2Fb"));
            const fixture = data.manifest.entries.find(({ path }) => path === "notes/with space.md");
            const other = data.manifest.entries.find(({ path }) => path === "notes/report.html.md");
            const view = data.manifest.views.find(({ publicId }) => publicId === "gate");
            assert(fixture && other && view && fixture.variants[0]);
            await withHost(context, hosting, `positive-${name}`, async (origin) => {
                const probe = await probeArtifact(origin, output, data, context.signal);
                result.http = probe.assertions;
                assertions += probe.assertions;
                const browser = await browserProbe(context, origin, `positive-${name}`, data, probe.samples, {
                    target: fixture.routePath,
                    dataPath: fixture.dataPath,
                    otherPath: other.routePath,
                    variantPath: fixture.variants[0].routePath,
                    viewPath: view.routePath,
                    viewTitle: view.title,
                });
                if (context.browserVersion) assert.equal(browser.browserVersion, context.browserVersion);
                context.browserVersion = browser.browserVersion;
                result.browser = browser.assertions;
                assertions += browser.assertions;
            });
            result.status = "passed";
        } catch (error) {
            result.diagnostic = error.stack ?? String(error);
        }
    }
    const failed = builds.filter((build) => build.status === "failed");
    if (failed.length) {
        const error = new Error(
            failed.map((build) => `Positive verification failed at ${build.rootPath}\n${build.diagnostic}`).join("\n"),
        );
        error.progress = { assertions, builds };
        throw error;
    }
    return { assertions, builds };
}

function diagnostic(result, severity, code) {
    return result.data.diagnostics?.some((item) => item.severity === severity && item.code === code);
}

async function assertRpcAllows(context, workspace, fixture) {
    await withLocalService(
        context,
        `${fixture.name}-rpc`,
        context.options.formaBin,
        workspace,
        (address) => ["serve", "--bind", `127.0.0.1:${address}`],
        async (origin) => {
            const response = await fetch(`${origin}/-/rpc`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "workspace.dashboard", params: {} }),
                signal: AbortSignal.any([context.signal, AbortSignal.timeout(10_000)]),
            });
            assert.equal(response.status, 200);
            const { result, error } = await response.json();
            assert(!error && result, JSON.stringify(error));
            assert.match(result.status, pass);
            assert.equal(result.routeProjectionVersion, 2);
            const taxonomy = result.taxonomies.find(({ id }) => id === fixture.id);
            assert(taxonomy, `RPC omitted taxonomy ${fixture.id}`);
            for (const id of fixture.terms)
                assert(
                    taxonomy.terms.some((term) => term.id === id),
                    `RPC omitted term ${id}`,
                );
        },
    );
}

async function outputNamesAreEquivalent(parent, [first, second]) {
    const probe = await mkdtemp(resolve(parent, "unicode-names-"));
    try {
        await mkdir(resolve(probe, first));
        try {
            await mkdir(resolve(probe, second));
            return false;
        } catch (error) {
            if (error.code !== "EEXIST") throw error;
            const original = await lstat(resolve(probe, first));
            const alias = await lstat(resolve(probe, second));
            assert(alias.isDirectory() && alias.dev === original.dev && alias.ino === original.ino);
            return true;
        }
    } finally {
        await rm(probe, { recursive: true, force: true });
    }
}

async function verifyUnicodeOutputs(context) {
    const pairs = [
        { kind: "NFC/NFD", terms: ["é", "e\u0301"] },
        { kind: "non-ASCII case", terms: ["Å", "å"] },
    ];
    const fixture = {
        name: "unicode-filesystem-equivalence",
        id: "unicode",
        terms: pairs.flatMap(({ terms }) => terms),
    };
    const workspace = await writeFixture(context.temporary, fixture.name);
    const output = resolve(context.temporary, `${fixture.name}-output`);
    requireBuild(await buildFixture(context, workspace, output, "/"));
    const previous = await fileTreeDigest(output);
    for (const pair of pairs) pair.equivalent = await outputNamesAreEquivalent(context.temporary, pair.terms);

    await addTaxonomy(workspace, "Unicode", fixture.id, fixture.terms);
    const check = await formaResult(context, workspace, ["check"]);
    assert.equal(check.code, 0, JSON.stringify(check.data));
    checkStatus(check, "passed");
    await assertRpcAllows(context, workspace, fixture);

    const build = await buildFixture(context, workspace, output, "/");
    const folded = pairs.filter(({ equivalent }) => equivalent);
    if (folded.length) {
        assert.notEqual(build.code, 0, JSON.stringify(build.data));
        assert.equal(build.data.status, "failed");
        const conflicts = build.data.diagnostics.filter(
            ({ code, severity }) => code === "route.staticOutputConflict" && severity === "error",
        );
        assert.equal(conflicts.length, folded.length, JSON.stringify(build.data.diagnostics));
        for (const pair of pairs) {
            const paths = pair.terms.map((term) => `/~/unicode/${encodeURIComponent(term)}`);
            assert.equal(
                conflicts.some(({ actual }) => paths.every((path) => actual?.includes(path))),
                pair.equivalent,
                JSON.stringify(build.data.diagnostics),
            );
        }
        assert.deepEqual(await fileTreeDigest(output), previous, "Unicode preflight changed the active artifact");
        return { fixture: fixture.name, pairs, code: "route.staticOutputConflict" };
    }

    requireBuild(build);
    const data = await readManifest(output);
    const hostResults = [];
    await withHost(context, output, fixture.name, async (origin) => {
        await pageProbe(
            origin,
            data.config,
            data.manifest.routes.find(({ kind }) => kind === "home"),
            context.signal,
            output,
        );
        for (const term of fixture.terms) {
            const path = `/~/unicode/${encodeURIComponent(term)}`;
            const route = data.manifest.routes.find((route) => route.path === path && route.id === term);
            assert(route, `Distinct Unicode owner did not reach the manifest: ${path}`);
            try {
                await pageProbe(origin, data.config, route, context.signal, output);
                hostResults.push({ path, status: "passed" });
            } catch (error) {
                if (!(error instanceof HostMismatch)) throw error;
                hostResults.push({ path, code: "site.cloudflareTargetIncompatible", message: error.message });
            }
        }
    });
    return { fixture: fixture.name, pairs, hostResults };
}

async function negativeGroup(context) {
    let assertions = 0;
    const diagnostics = [];
    const fixtures = [
        { name: "taxonomy-slash", id: "a/b", terms: [], hostPath: "/~/a%2Fb" },
        { name: "term-slash", id: "edge", terms: ["a/b"], hostPath: "/~/edge/a%2Fb" },
        {
            name: "index-file-prefix",
            id: "edge",
            terms: ["index.html"],
            mayBeHostOnly: true,
            hostPath: "/~/edge/index.html",
        },
        { name: "segment-overlap", id: "edge", terms: ["a/b"], second: { id: "edge/a", terms: ["b"] } },
        { name: "unsafe-component", id: "edge", terms: ["unsafe\\path"] },
        { name: "filesystem-equivalence", id: "edge", terms: ["Case", "case"] },
    ];
    for (const fixture of fixtures) {
        const workspace = await writeFixture(context.temporary, fixture.name);
        await addTaxonomy(workspace, "Edge", fixture.id, fixture.terms);
        if (fixture.second) await addTaxonomy(workspace, "SecondEdge", fixture.second.id, fixture.second.terms);
        const output = resolve(context.temporary, `${fixture.name}-output`);
        const check = await formaResult(context, workspace, ["check"]);
        const build = await buildFixture(context, workspace, output, "/");
        if (!fixture.hostPath || (fixture.mayBeHostOnly && build.code !== 0)) {
            assert.equal(check.code, 0, JSON.stringify(check.data));
            checkStatus(check, "warning");
            assert(diagnostic(check, "warning", "route.staticOutputConflict"), JSON.stringify(check.data));
            assert(build.code !== 0 && build.data.status === "failed");
            assert(diagnostic(build, "error", "route.staticOutputConflict"), JSON.stringify(build.data));
            diagnostics.push({ fixture: fixture.name, code: "route.staticOutputConflict" });
        } else {
            assert.equal(check.code, 0, JSON.stringify(check.data));
            checkStatus(check, "passed");
            requireBuild(build);
            const data = await readManifest(output);
            const target = data.manifest.routes.find(({ path }) => path === fixture.hostPath);
            assert(target, `Negative target ${fixture.hostPath} did not reach the manifest`);
            await withHost(context, output, fixture.name, async (origin) => {
                const control = data.manifest.routes.find(({ kind }) => kind === "home");
                await pageProbe(origin, data.config, control, context.signal, output);
                const dashboard = await requireResponse(
                    origin,
                    `${data.config.dataBaseUrl}/dashboard.json`,
                    /^application\/json\b/iu,
                    context.signal,
                );
                validateEnvelope(await dashboard.json(), data.config.artifactId);
                await assert.rejects(pageProbe(origin, data.config, target, context.signal), (error) => {
                    if (!(error instanceof HostMismatch)) return false;
                    diagnostics.push({
                        fixture: fixture.name,
                        code: "site.cloudflareTargetIncompatible",
                        message: error.message,
                    });
                    return true;
                });
            });
        }
        await assertRpcAllows(context, workspace, fixture);
        assertions += 2;
    }
    diagnostics.push(await verifyUnicodeOutputs(context));
    assertions += 2;
    return { assertions, diagnostics };
}

async function candidateGroup(context, data) {
    return withHost(context, context.options.artifactDir, "candidate", async (origin) => {
        const probe = await probeArtifact(origin, context.options.artifactDir, data, context.signal);
        const browser = await browserProbe(context, origin, "candidate", data, probe.samples);
        if (context.browserVersion) assert.equal(browser.browserVersion, context.browserVersion);
        context.browserVersion = browser.browserVersion;
        return {
            assertions: probe.assertions + browser.assertions,
            http: probe.assertions,
            browser: browser.assertions,
        };
    });
}

async function writeReport(path, report) {
    const staging = `${path}.${process.pid}.tmp`;
    try {
        await writeFile(staging, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
        await rename(staging, path);
    } finally {
        await rm(staging, { force: true });
    }
}

async function executeGate(options) {
    const { artifactDir, report: reportPath } = options;
    const reportDirectory = await realpath(dirname(reportPath));
    assertOutside(
        artifactDir,
        resolve(reportDirectory, reportPath.split(sep).at(-1)),
        "Report must be outside the artifact directory",
    );
    const temporary = await mkdtemp(resolve(await realpath(tmpdir()), "forma-cloudflare-"));
    const report = {
        schemaVersion: schema,
        status: "failed",
        completed: false,
        sourceSha: options.sourceSha,
        groups: {},
        versions: {},
        cleanup: { status: "failed", processes: [] },
        failures: [],
    };
    const abort = new AbortController();
    if (options.localSource) report.localSource = options.localSource;
    const onInterrupt = () => abort.abort(new Error("Cloudflare verification interrupted"));
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onInterrupt);
    try {
        const { binding, data, host } = await candidateBinding(options);
        Object.assign(report, binding);
        const context = { options, host, temporary, signal: abort.signal, processes: report.cleanup.processes };
        for (const binary of [options.formaBin, options.playwrightCli, options.chromiumExecutable, wrangler]) {
            await access(binary, constants.X_OK);
        }
        for (const [key, bin] of [
            ["forma", options.formaBin],
            ["wrangler", wrangler],
            ["playwright", options.playwrightCli],
        ]) {
            const { stdout, stderr } = await command(bin, ["--version"], {
                cwd: temporary,
                signal: abort.signal,
                env: hostEnvironment(temporary),
            });
            report.versions[key] = stdout.trim() || stderr.trim().split("\n")[0];
            assert(report.versions[key], `Version missing for ${key}`);
        }
        for (const [name, run] of [
            ["positive", positiveGroup],
            ["negative", negativeGroup],
            ["candidate", candidateGroup],
        ]) {
            abort.signal.throwIfAborted();
            try {
                report.groups[name] = { status: "passed", ...(await run(context, data)) };
            } catch (error) {
                report.groups[name] = { status: "failed", diagnostic: error.message, ...error.progress };
                report.failures.push(`${name}: ${error.stack ?? String(error)}`);
            }
        }
        report.versions.chromium = context.browserVersion;
        const ending = await candidateBinding(options);
        assert.deepEqual(ending.binding, binding, "Artifact or configuration changed during verification");
        if (options.localSource)
            assert.deepEqual(
                await localSourceIdentity(root, options.localSource.formaBin),
                options.localSource,
                "Local candidate source changed during verification",
            );
        abort.signal.throwIfAborted();
        report.completed = requiredGroups.every((name) => report.groups[name]?.status === "passed");
        if (!report.completed) report.evidenceDirectory = temporary;
    } catch (error) {
        report.failures.push(error.stack ?? String(error));
        report.evidenceDirectory = temporary;
    } finally {
        process.removeListener("SIGINT", onInterrupt);
        process.removeListener("SIGTERM", onInterrupt);
        try {
            assert(!report.cleanup.processes.some(({ cleanupError }) => cleanupError), "Process cleanup failed");
            if (report.completed) await rm(temporary, { recursive: true, force: true });
            report.cleanup.status = "passed";
        } catch (error) {
            report.failures.push(error.stack ?? String(error));
        }
        if (report.completed && report.failures.length === 0) report.status = "passed";
        await writeReport(reportPath, report);
    }
    assert.equal(
        report.status,
        "passed",
        `Cloudflare verification failed; see ${reportPath}\n${report.failures.join("\n")}`,
    );
    console.log(JSON.stringify({ status: report.status, report: reportPath, groups: report.groups }));
}

const gateInputs = [
    "forma-bin",
    "artifact-dir",
    "source-sha",
    "config",
    "playwright-cli",
    "chromium-executable",
    "report",
];
const verifyInputs = ["artifact-dir", "source-sha", "config", "report"];
/** The origin CI builds the production artifact for; local candidates use the same one. */
const productionBaseUrl = "https://forma.choral.io";
const localDirectory = resolve(root, "target", "site-cloudflare");

export function strictGateInputs(environment = process.env) {
    return environment.GITHUB_ACTIONS === "true" || /^(?:true|1)$/iu.test(environment.CI ?? "");
}

/** Local evidence identifies the working tree; HEAD alone is only its baseline. */
export async function localSourceIdentity(directory, formaBin) {
    const git = async (args) => (await execute("git", args, { cwd: directory, maxBuffer: 64 * 1024 * 1024 })).stdout;
    const baselineSha = (await git(["rev-parse", "HEAD"])).trim();
    const paths = [
        ...new Set(
            (await git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])).split("\0").filter(Boolean),
        ),
    ].sort();
    const digest = createHash("sha256");
    for (const path of paths) {
        const absolute = resolve(directory, path);
        const item = await lstat(absolute).catch((error) => {
            if (error.code === "ENOENT") return null;
            throw error;
        });
        const content = !item
            ? null
            : item.isSymbolicLink()
              ? await readlink(absolute)
              : item.isFile()
                ? sha256(await readFile(absolute))
                : "directory";
        digest.update(JSON.stringify([path, item?.mode ?? null, content]) + "\n");
    }
    return {
        kind: "local-worktree",
        releaseEvidence: false,
        baselineSha,
        dirty: (await git(["status", "--porcelain", "-z", "--untracked-files=all"])).length > 0,
        worktreeSha256: digest.digest("hex"),
        formaBin: resolve(formaBin),
        formaBinSha256: sha256(await readFile(formaBin)),
    };
}

/** Names every required input a run lacks, instead of failing on the first undefined path. */
export function missingInputs(values, verifyOnly) {
    return (verifyOnly ? verifyInputs : gateInputs).filter((name) => !values[name]);
}

/**
 * Fills the gate's inputs for a local run, the way CI prepares them: the debug `forma` binary,
 * a fresh production artifact with its source marker, the checked-out commit, the repository's
 * deployment configuration, and the Playwright CLI and Chromium found on this machine. Inputs
 * given on the command line are kept. CI always passes every input explicitly.
 */
export async function localGateInputs(values, environment = process.env) {
    const filled = { ...values };
    filled["forma-bin"] ??= resolve(root, "target", "debug", process.platform === "win32" ? "forma.exe" : "forma");
    filled.config ??= resolve(root, "wrangler.jsonc");
    filled.report ??= resolve(localDirectory, "report.json");
    filled["source-sha"] ??= (await execute("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
    filled["playwright-cli"] ??=
        environment.FORMA_SITE_PLAYWRIGHT_CLI ?? (await findOnPath("playwright-cli", environment));
    filled["chromium-executable"] ??= environment.FORMA_SITE_CHROMIUM ?? (await findPlaywrightChromium(environment));
    if (!filled["artifact-dir"]) {
        filled.localSource = await localSourceIdentity(root, filled["forma-bin"]);
        assert.equal(
            filled["source-sha"],
            filled.localSource.baselineSha,
            "Local build source-sha must name its baseline HEAD",
        );
        const artifactDir = resolve(localDirectory, "site");
        await mkdir(localDirectory, { recursive: true });
        await execute(
            filled["forma-bin"],
            ["site", "build", "--out", artifactDir, "--base-url", productionBaseUrl, "--json"],
            { cwd: root, maxBuffer: 64 * 1024 * 1024 },
        );
        await writeFile(resolve(artifactDir, "-", ".forma-source-sha"), `${filled["source-sha"]}\n`);
        filled["artifact-dir"] = artifactDir;
    }
    return filled;
}

async function findOnPath(name, environment) {
    const extensions = process.platform === "win32" ? (environment.PATHEXT ?? ".EXE;.CMD").split(";") : [""];
    for (const directory of (environment.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) {
        for (const extension of extensions) {
            const candidate = resolve(directory || ".", `${name}${extension}`);
            if (await isExecutable(candidate)) return candidate;
        }
    }
    return undefined;
}

/** The newest Chromium in the Playwright browser cache, where `playwright install chromium` puts it. */
async function findPlaywrightChromium(environment) {
    const cache =
        environment.PLAYWRIGHT_BROWSERS_PATH ??
        (process.platform === "darwin"
            ? resolve(environment.HOME ?? "", "Library", "Caches", "ms-playwright")
            : process.platform === "win32"
              ? resolve(environment.LOCALAPPDATA ?? "", "ms-playwright")
              : resolve(environment.HOME ?? "", ".cache", "ms-playwright"));
    const builds = (await readdir(cache).catch(() => []))
        .map((name) => /^chromium-(\d+)$/u.exec(name))
        .filter(Boolean)
        .sort((left, right) => Number(right[1]) - Number(left[1]))
        .map((match) => match[0]);
    const executables =
        {
            darwin: [
                ["chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"],
                ["chrome-mac-x64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"],
                ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"],
            ],
            linux: [
                ["chrome-linux64", "chrome"],
                ["chrome-linux", "chrome"],
            ],
            win32: [
                ["chrome-win64", "chrome.exe"],
                ["chrome-win", "chrome.exe"],
            ],
        }[process.platform] ?? [];
    for (const build of builds) {
        for (const parts of executables) {
            const candidate = resolve(cache, build, ...parts);
            if (await isExecutable(candidate)) return candidate;
        }
    }
    return undefined;
}

async function isExecutable(path) {
    try {
        await access(path, constants.X_OK);
        return (await stat(path)).isFile();
    } catch {
        return false;
    }
}

async function main() {
    const { values: given } = parseArgs({
        options: {
            "forma-bin": { type: "string" },
            "artifact-dir": { type: "string" },
            "source-sha": { type: "string" },
            "config": { type: "string" },
            "playwright-cli": { type: "string" },
            "chromium-executable": { type: "string" },
            "report": { type: "string" },
            "verify-only": { type: "boolean" },
        },
    });
    const verifyOnly = given["verify-only"] === true;
    // CI must name its exact artifact and tools; only a local gate run fills them in.
    const strict = strictGateInputs();
    // Invalidate the previous success before discovery or a build can fail.
    // Verification must never rewrite the report it is checking.
    const reportPath = given.report ?? (!strict && !verifyOnly ? resolve(localDirectory, "report.json") : undefined);
    if (!verifyOnly && reportPath) {
        const artifactDir = resolve(given["artifact-dir"] ?? resolve(localDirectory, "site"));
        assertOutside(artifactDir, resolve(reportPath), "Report must be outside the artifact directory");
        await mkdir(dirname(resolve(reportPath)), { recursive: true });
        const physicalArtifactDir = await realpath(artifactDir).catch((error) => {
            if (error.code === "ENOENT") return artifactDir;
            throw error;
        });
        assertOutside(
            physicalArtifactDir,
            resolve(await realpath(dirname(resolve(reportPath))), resolve(reportPath).split(sep).at(-1)),
            "Report must be outside the artifact directory",
        );
        await writeReport(resolve(reportPath), {
            schemaVersion: schema,
            status: "failed",
            completed: false,
            phase: "preparing",
            failures: [],
        });
    }
    try {
        const values = verifyOnly || strict ? given : await localGateInputs(given);
        const missing = missingInputs(values, verifyOnly);
        assert(
            missing.length === 0,
            `Missing ${missing.map((name) => `--${name}`).join(", ")}. ` +
                (verifyOnly
                    ? "--verify-only checks a report against an existing artifact, so every input is required."
                    : "Install Chromium with `playwright-cli install chromium`, or set FORMA_SITE_PLAYWRIGHT_CLI and FORMA_SITE_CHROMIUM."),
        );
        const options = {
            artifactDir: resolve(values["artifact-dir"]),
            sourceSha: values["source-sha"],
            config: resolve(values.config),
            report: resolve(values.report),
        };
        if (verifyOnly) {
            console.log(JSON.stringify(await verifyReport(options)));
            return;
        }
        await executeGate({
            ...options,
            formaBin: resolve(values["forma-bin"]),
            playwrightCli: resolve(values["playwright-cli"]),
            chromiumExecutable: resolve(values["chromium-executable"]),
            localSource: values.localSource,
        });
    } catch (error) {
        if (!verifyOnly && reportPath) {
            const report = JSON.parse(await readFile(resolve(reportPath), "utf8"));
            if (report.phase === "preparing")
                await writeReport(resolve(reportPath), { ...report, failures: [error.message] });
        }
        throw error;
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
