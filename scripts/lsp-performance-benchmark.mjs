import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createFixture, statistics } from "./performance-benchmark.mjs";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultBinary = join(scriptRoot, "target", "release", "forma");

export async function main(arguments_ = process.argv.slice(2)) {
    const options = parseArguments(arguments_);
    const repetitions = options.mode === "baseline" ? 50 : 20;
    const sizes = options.mode === "baseline" ? [1000, 5000] : [1000];
    const fixtureRoot = await mkdtemp(join(tmpdir(), "forma-lsp-performance-"));
    const startedAt = new Date().toISOString();

    try {
        const projectSource = [
            "---",
            "title: LSP benchmark",
            "status: doing",
            "owners: []",
            "---",
            "Definition: [[knowledge/product/product-direction#Product Direction]].",
            "Positionless: [[knowledge/product/product-direction]].",
            "Completion: [[knowledge/product/prod",
            "",
        ].join("\n");
        const project = await measureWorkspace({
            binary: options.binary,
            workspace: scriptRoot,
            sourcePath: "knowledge/tasks/lsp-performance-benchmark.md",
            source: projectSource,
            position: { line: 5, character: 20 },
            completionPosition: positionAtOffset(
                projectSource,
                projectSource.indexOf("[[knowledge/product/prod") + "[[knowledge/product/prod".length,
            ),
            repetitions,
        });
        const synthetic = [];
        for (const size of sizes) {
            const workspace = await createFixture(fixtureRoot, size);
            const middle = Math.floor(size / 2);
            const target = `notes/note-${String(middle - 1).padStart(5, "0")}`;
            const sourcePath = `notes/note-${String(middle).padStart(5, "0")}.md`;
            const targetHeading = `Note ${middle - 1}`;
            const completionMarker = "[[notes/note-0";
            const source = `---\ntitle: LSP ${size}\nkind: note\n---\n\n# LSP ${size}\n\nDefinition: [[${target}#${targetHeading}]].\nPositionless: [[${target}]].\nCompletion: ${completionMarker}\n`;
            synthetic.push({
                entries: size,
                ...(await measureWorkspace({
                    binary: options.binary,
                    workspace,
                    sourcePath,
                    source,
                    position: { line: 7, character: 20 },
                    completionPosition: positionAtOffset(
                        source,
                        source.indexOf(completionMarker) + completionMarker.length,
                    ),
                    repetitions,
                })),
            });
        }

        const report = {
            schemaVersion: 1,
            mode: options.mode,
            startedAt,
            completedAt: new Date().toISOString(),
            host: {
                platform: process.platform,
                architecture: process.arch,
                node: process.version,
            },
            binary: options.binary,
            repetitions,
            project,
            synthetic,
            invariants: {
                intentionalIdleWork: false,
                warmRequestsTriggerSnapshotRebuild: false,
                documentAnalysesPerVersion: 1,
                evidence: "WorkspaceSession counters are asserted by forma-core tests.",
            },
        };
        await mkdir(options.outputDirectory, { recursive: true });
        const outputPath = join(
            options.outputDirectory,
            `lsp-${options.mode}-${startedAt.replaceAll(/[:.]/gu, "-")}.json`,
        );
        await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
        printSummary(report, outputPath);
        return report;
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
}

async function measureWorkspace({ binary, workspace, sourcePath, source, position, completionPosition, repetitions }) {
    workspace = await realpath(workspace);
    const process = new LspProcess(binary, workspace);
    try {
        const initializeStarted = performance.now();
        await process.request("initialize", {
            processId: null,
            rootUri: pathToFileURL(workspace).href,
            capabilities: {},
        });
        const initializeMs = performance.now() - initializeStarted;
        process.notify("initialized", {});
        const uri = pathToFileURL(join(workspace, sourcePath)).href;
        process.notify("textDocument/didOpen", {
            textDocument: { uri, languageId: "markdown", version: 1, text: source },
        });

        const definition = { textDocument: { uri }, position };
        const coldDefinition = await timedRequest(process, "textDocument/definition", definition);
        if (!coldDefinition.result) throw new Error(`Definition did not resolve in ${workspace}.`);
        const warmDefinition = [];
        for (let index = 0; index < repetitions; index += 1) {
            warmDefinition.push((await timedRequest(process, "textDocument/definition", definition)).durationMs);
        }
        const documentLink = { textDocument: { uri } };
        const coldDocumentLink = await timedRequest(process, "textDocument/documentLink", documentLink);
        if (!Array.isArray(coldDocumentLink.result) || coldDocumentLink.result.length === 0) {
            throw new Error(`DocumentLink did not resolve in ${workspace}.`);
        }
        const warmDocumentLink = [];
        for (let index = 0; index < repetitions; index += 1) {
            warmDocumentLink.push((await timedRequest(process, "textDocument/documentLink", documentLink)).durationMs);
        }
        const completion = { textDocument: { uri }, position: completionPosition };
        const coldCompletion = await timedRequest(process, "textDocument/completion", completion);
        if (!Array.isArray(coldCompletion.result) || coldCompletion.result.length === 0) {
            throw new Error(`Completion did not return candidates in ${workspace}.`);
        }
        const warmCompletion = [];
        for (let index = 0; index < repetitions; index += 1) {
            warmCompletion.push((await timedRequest(process, "textDocument/completion", completion)).durationMs);
        }
        const references = {
            textDocument: { uri },
            position,
            context: { includeDeclaration: false },
        };
        const coldReferences = await timedRequest(process, "textDocument/references", references);
        if (!Array.isArray(coldReferences.result) || coldReferences.result.length === 0) {
            throw new Error(`References did not return locations in ${workspace}.`);
        }
        const warmReferences = [];
        for (let index = 0; index < repetitions; index += 1) {
            warmReferences.push((await timedRequest(process, "textDocument/references", references)).durationMs);
        }
        const idleBefore = process.resources();
        const idleStarted = performance.now();
        await new Promise((resolveIdle) => setTimeout(resolveIdle, 1_000));
        const resources = process.resources();
        const idleElapsedSeconds = (performance.now() - idleStarted) / 1_000;
        const idleCpuPercent =
            idleBefore.cpuTimeSeconds === null || resources.cpuTimeSeconds === null
                ? null
                : round((Math.max(0, resources.cpuTimeSeconds - idleBefore.cpuTimeSeconds) / idleElapsedSeconds) * 100);
        return {
            initializeMs: round(initializeMs),
            coldDefinitionMs: round(coldDefinition.durationMs),
            warmDefinition: statistics(warmDefinition),
            coldDocumentLinkMs: round(coldDocumentLink.durationMs),
            warmDocumentLink: statistics(warmDocumentLink),
            coldCompletionMs: round(coldCompletion.durationMs),
            warmCompletion: statistics(warmCompletion),
            coldReferencesMs: round(coldReferences.durationMs),
            warmReferences: statistics(warmReferences),
            connectedRssBytes: resources.rssKiB === null ? null : resources.rssKiB * 1024,
            idleCpuPercent,
        };
    } finally {
        await process.close();
    }
}

function positionAtOffset(source, offset) {
    const prefix = source.slice(0, offset);
    const lines = prefix.split("\n");
    return { line: lines.length - 1, character: lines.at(-1).length };
}

class LspProcess {
    constructor(binary, workspace) {
        this.child = spawn(binary, ["--workspace", workspace, "lsp"], {
            stdio: ["pipe", "pipe", "pipe"],
        });
        this.nextId = 1;
        this.pending = new Map();
        this.buffer = Buffer.alloc(0);
        this.stderr = "";
        this.child.stdout.on("data", (chunk) => this.consume(chunk));
        this.child.stderr.on("data", (chunk) => {
            this.stderr += chunk.toString("utf8");
        });
        this.child.on("exit", (code) => {
            const error = new Error(`Forma LSP exited with ${String(code)}: ${this.stderr.slice(0, 2000)}`);
            for (const pending of this.pending.values()) pending.reject(error);
            this.pending.clear();
        });
    }

    request(method, params) {
        const id = this.nextId++;
        return new Promise((resolveRequest, rejectRequest) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                rejectRequest(new Error(`Timed out waiting for ${method}.`));
            }, 10_000);
            this.pending.set(id, {
                resolve: (value) => {
                    clearTimeout(timer);
                    resolveRequest(value);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    rejectRequest(error);
                },
            });
            this.send({ jsonrpc: "2.0", id, method, params });
        });
    }

    notify(method, params) {
        this.send({ jsonrpc: "2.0", method, params });
    }

    send(message) {
        const body = JSON.stringify(message);
        this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    }

    consume(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (true) {
            const headerEnd = this.buffer.indexOf("\r\n\r\n");
            if (headerEnd < 0) return;
            const header = this.buffer.subarray(0, headerEnd).toString("ascii");
            const length = Number.parseInt(/Content-Length:\s*(\d+)/iu.exec(header)?.[1] ?? "", 10);
            if (!Number.isFinite(length)) throw new Error(`Invalid LSP header: ${header}`);
            const bodyStart = headerEnd + 4;
            if (this.buffer.length < bodyStart + length) return;
            const message = JSON.parse(this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8"));
            this.buffer = this.buffer.subarray(bodyStart + length);
            if (message.id === undefined) continue;
            const pending = this.pending.get(message.id);
            if (!pending) continue;
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
            else pending.resolve(message.result);
        }
    }

    resources() {
        if (!this.child.pid) return { rssKiB: null, cpuTimeSeconds: null };
        const result = spawnSync("/bin/ps", ["-o", "rss=,time=", "-p", String(this.child.pid)], {
            encoding: "utf8",
        });
        if (result.error || typeof result.stdout !== "string") {
            return { rssKiB: null, cpuTimeSeconds: null };
        }
        const [rss, cpuTime] = result.stdout.trim().split(/\s+/u);
        return {
            rssKiB: Number.isFinite(Number(rss)) ? Number(rss) : null,
            cpuTimeSeconds: parseCpuTime(cpuTime),
        };
    }

    async close() {
        if (this.child.exitCode !== null) return;
        try {
            await this.request("shutdown", null);
            this.notify("exit", null);
        } catch {
            this.child.kill();
        }
        await new Promise((resolveExit) => {
            if (this.child.exitCode !== null) resolveExit();
            else this.child.once("exit", resolveExit);
        });
    }
}

async function timedRequest(process, method, params) {
    const started = performance.now();
    const result = await process.request(method, params);
    return { durationMs: performance.now() - started, result };
}

function parseArguments(arguments_) {
    const options = {
        mode: "quick",
        binary: defaultBinary,
        outputDirectory: join(scriptRoot, "target", "performance"),
    };
    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index];
        if (argument === "--mode") options.mode = requiredValue(arguments_, ++index, argument);
        else if (argument === "--binary") options.binary = resolve(requiredValue(arguments_, ++index, argument));
        else if (argument === "--output-directory") {
            options.outputDirectory = resolve(requiredValue(arguments_, ++index, argument));
        } else throw new Error(`Unknown LSP performance benchmark argument: ${argument}`);
    }
    if (!new Set(["quick", "baseline"]).has(options.mode)) {
        throw new Error(`Unsupported LSP performance benchmark mode: ${options.mode}`);
    }
    return options;
}

function requiredValue(arguments_, index, option) {
    const value = arguments_[index];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
    return value;
}

function printSummary(report, outputPath) {
    console.log(`Forma LSP performance ${report.mode}`);
    printMeasurement("project", report.project);
    for (const fixture of report.synthetic) printMeasurement(`${fixture.entries} entries`, fixture);
    console.log(`Report: ${outputPath}`);
}

function printMeasurement(label, measurement) {
    const rss = measurement.connectedRssBytes
        ? `${(measurement.connectedRssBytes / 1024 / 1024).toFixed(1)} MiB`
        : "n/a";
    console.log(
        `${label}: init=${measurement.initializeMs.toFixed(1)}ms definition=${measurement.coldDefinitionMs.toFixed(1)}/${measurement.warmDefinition.p95Ms.toFixed(1)}ms completion=${measurement.coldCompletionMs.toFixed(1)}/${measurement.warmCompletion.p95Ms.toFixed(1)}ms references=${measurement.coldReferencesMs.toFixed(1)}/${measurement.warmReferences.p95Ms.toFixed(1)}ms rss=${rss} idle-cpu=${String(measurement.idleCpuPercent)}%`,
    );
}

function round(value) {
    return Number(value.toFixed(3));
}

function parseCpuTime(value) {
    if (!value) return null;
    const parts = value.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
