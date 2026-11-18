import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { parseMarkdownBrowserPhase } from "./markdown-browser-protocol.mjs";
import { readerBrowserChecks, readerBrowserRegressionSource } from "./reader-browser-regressions.mjs";

const cli = process.env.FORMA_SITE_PLAYWRIGHT_CLI;
const chromium = process.env.FORMA_SITE_CHROMIUM;
if (!cli || !chromium) throw new Error("Set FORMA_SITE_PLAYWRIGHT_CLI and FORMA_SITE_CHROMIUM");
await access(chromium, constants.X_OK);
const temporary = await mkdtemp(join(tmpdir(), "forma-reader-browser-"));
const configuration = join(temporary, "browser.json");
const scenario = join(temporary, "scenario.cjs");
const execute = promisify(execFile);
const abort = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => abort.abort(new Error(`Interrupted by ${signal}`)));
}

async function command(args, cleanup = false) {
    const { stdout, stderr } = await execute(cli, [`-s=${basename(temporary)}`, ...args], {
        cwd: temporary,
        signal: cleanup ? undefined : abort.signal,
        timeout: cleanup ? 15_000 : 90_000,
        maxBuffer: 8 * 1024 * 1024,
    }).catch((error) => {
        throw new Error(`${error.message}\n${error.stdout ?? ""}${error.stderr ?? ""}`, { cause: error });
    });
    if (/^### Error\b/mu.test(stdout + stderr)) throw new Error(stdout + stderr);
    return stdout;
}

try {
    await writeFile(
        configuration,
        JSON.stringify({
            browser: { browserName: "chromium", launchOptions: { executablePath: chromium, headless: true } },
        }),
    );
    await writeFile(scenario, readerBrowserRegressionSource());
    let result;
    let failure;
    try {
        await command(["open", "--config", configuration, "--idle-timeout", "120000"]);
        const output = await command(["run-code", "--filename", scenario]);
        result = parseMarkdownBrowserPhase(output, {
            name: "reader-test-regressions",
            expectedResults: readerBrowserChecks,
            expectedSourceCases: {},
        });
    } catch (error) {
        failure = error;
        throw error;
    } finally {
        await command(["close"], true).catch((error) => {
            if (failure) throw new AggregateError([failure, error], "Browser check and cleanup failed");
            throw error;
        });
    }
    abort.signal.throwIfAborted();
    console.log(JSON.stringify(result));
} finally {
    await rm(temporary, { recursive: true, force: true });
}
