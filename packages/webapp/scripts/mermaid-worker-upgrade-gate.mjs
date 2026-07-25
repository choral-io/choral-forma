import { spawn, spawnSync } from "node:child_process";
import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const webappRoot = fileURLToPath(new URL("..", import.meta.url));
const profileDirectory = await mkdtemp(join(tmpdir(), "forma-mermaid-upgrade-"));
const server = await createServer({
    configFile: join(webappRoot, "vite.config.mjs"),
    logLevel: "error",
    root: webappRoot,
    server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: false,
    },
});
let chrome;

try {
    await server.listen();
    const origin = server.resolvedUrls?.local[0];
    if (!origin) {
        throw new Error("Vite did not expose a local upgrade-gate URL.");
    }

    const gateUrl = new URL("scripts/mermaid-worker-upgrade-gate.html", origin).href;
    const chromePath = await findChrome();
    chrome = spawn(
        chromePath,
        [
            "--headless=new",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-extensions",
            "--disable-sync",
            "--no-default-browser-check",
            "--no-first-run",
            "--remote-debugging-port=0",
            `--user-data-dir=${profileDirectory}`,
            gateUrl,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
    );

    const browserEndpoint = await waitForDevtoolsEndpoint(chrome);
    const target = await waitForPageTarget(browserEndpoint, gateUrl);
    const result = await readGateResult(target.webSocketDebuggerUrl);
    if (!result.ok) {
        throw new Error(result.error ?? "The Mermaid Worker upgrade gate failed.");
    }
    process.stdout.write(`Mermaid Worker upgrade gate passed: ${JSON.stringify(result)}\n`);
} finally {
    chrome?.kill("SIGTERM");
    await server.close();
    await rm(profileDirectory, { force: true, recursive: true });
}

async function findChrome() {
    const configured = [
        process.env.CHROME_BIN,
        process.env.GOOGLE_CHROME_BIN,
        process.env.AGENT_BROWSER_EXECUTABLE_PATH,
    ].filter(Boolean);
    const absoluteCandidates =
        process.platform === "darwin"
            ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
            : process.platform === "win32"
              ? [
                    join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
                    join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
                ]
              : [];

    for (const candidate of [...configured, ...absoluteCandidates]) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Continue to the next explicit candidate.
        }
    }

    const agentBrowserCache = join(homedir(), ".agent-browser/browsers");
    try {
        const cachedBrowsers = (await readdir(agentBrowserCache, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory() && entry.name.startsWith("chrome-"))
            .map((entry) => entry.name)
            .sort()
            .reverse();
        for (const browser of cachedBrowsers) {
            const candidates =
                process.platform === "darwin"
                    ? [
                          join(
                              agentBrowserCache,
                              browser,
                              "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
                          ),
                      ]
                    : [join(agentBrowserCache, browser, "chrome-linux64/chrome")];
            for (const candidate of candidates) {
                try {
                    await access(candidate);
                    return candidate;
                } catch {
                    // Continue to the next cached browser.
                }
            }
        }
    } catch {
        // The agent-browser cache is optional.
    }

    for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
        const lookup = spawnSync(process.platform === "win32" ? "where" : "which", [command], {
            encoding: "utf8",
            env: { ...process.env, PATH: process.env.PATH?.split(delimiter).join(delimiter) },
        });
        const candidate = lookup.stdout.trim().split(/\r?\n/)[0];
        if (lookup.status === 0 && candidate) {
            return candidate;
        }
    }

    throw new Error("Chrome or Chromium is required for the Mermaid Worker upgrade gate. Set CHROME_BIN.");
}

function waitForDevtoolsEndpoint(process) {
    return new Promise((resolve, reject) => {
        let stderr = "";
        const timeout = setTimeout(() => {
            reject(new Error(`Chrome did not expose a DevTools endpoint.\n${stderr}`));
        }, 10_000);
        const finish = (callback, value) => {
            clearTimeout(timeout);
            process.stderr.off("data", onData);
            process.off("exit", onExit);
            callback(value);
        };
        const onData = (chunk) => {
            stderr += chunk.toString();
            const endpoint = /DevTools listening on (ws:\/\/\S+)/.exec(stderr)?.[1];
            if (endpoint) {
                finish(resolve, endpoint);
            }
        };
        const onExit = (code) => {
            finish(reject, new Error(`Chrome exited before the gate started (${String(code)}).\n${stderr}`));
        };
        process.stderr.on("data", onData);
        process.once("exit", onExit);
    });
}

async function waitForPageTarget(browserEndpoint, gateUrl) {
    const endpoint = new URL(browserEndpoint);
    const listUrl = `http://${endpoint.hostname}:${endpoint.port}/json/list`;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const targets = await fetch(listUrl).then((response) => response.json());
        const page = targets.find((target) => target.type === "page" && target.url === gateUrl);
        if (page?.webSocketDebuggerUrl) {
            return page;
        }
        await delay(50);
    }
    throw new Error("Chrome did not open the Mermaid Worker upgrade-gate page.");
}

async function readGateResult(webSocketUrl) {
    const socket = new WebSocket(webSocketUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
    });
    let nextId = 1;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        const request = pending.get(message.id);
        if (!request) {
            return;
        }
        pending.delete(message.id);
        if (message.error) {
            request.reject(new Error(message.error.message));
        } else {
            request.resolve(message.result);
        }
    });
    const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { reject, resolve });
            socket.send(JSON.stringify({ id, method, params }));
        });

    try {
        await send("Runtime.enable");
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
            const evaluation = await send("Runtime.evaluate", {
                expression: "window.__formaMermaidUpgradeGateResult ?? null",
                returnByValue: true,
            });
            const result = evaluation.result?.value;
            if (result) {
                return result;
            }
            await delay(50);
        }
        throw new Error("The Mermaid Worker upgrade gate timed out.");
    } finally {
        socket.close();
    }
}

function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
