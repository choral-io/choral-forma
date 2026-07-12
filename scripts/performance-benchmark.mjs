import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultBinary = join(scriptRoot, "target", "release", "forma");
const realOperations = [
    { id: "config.inspect", args: ["config", "inspect", "--json"] },
    { id: "workspace.dashboard", args: ["workspace", "dashboard", "--json"] },
    {
        id: "inspect",
        args: ["inspect", "knowledge/architecture/forma-performance-engineering.md", "--json"],
    },
    {
        id: "reference.resolve",
        args: [
            "reference",
            "resolve",
            "--source",
            "knowledge/architecture/forma-performance-engineering.md",
            "--target",
            "knowledge/product/product-direction",
            "--intent",
            "link",
            "--json",
        ],
    },
    { id: "view.render", args: ["view", "render", ".forma/views/task-board.md", "--json"] },
];

export function parseArguments(arguments_) {
    const options = {
        mode: "quick",
        workspace: scriptRoot,
        binary: defaultBinary,
        outputDirectory: join(scriptRoot, "target", "performance"),
    };
    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index];
        if (argument === "--mode") options.mode = requiredValue(arguments_, ++index, argument);
        else if (argument === "--workspace") options.workspace = resolve(requiredValue(arguments_, ++index, argument));
        else if (argument === "--binary") options.binary = resolve(requiredValue(arguments_, ++index, argument));
        else if (argument === "--output-directory") {
            options.outputDirectory = resolve(requiredValue(arguments_, ++index, argument));
        } else {
            throw new Error(`Unknown performance benchmark argument: ${argument}`);
        }
    }
    if (!new Set(["quick", "baseline"]).has(options.mode)) {
        throw new Error(`Unsupported performance benchmark mode: ${options.mode}`);
    }
    return options;
}

export function statistics(samples) {
    if (samples.length === 0) throw new Error("Performance statistics require at least one sample.");
    const sorted = [...samples].sort((left, right) => left - right);
    const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
    return {
        samples: sorted.length,
        minimumMs: round(sorted[0]),
        medianMs: round(percentile(0.5)),
        p95Ms: round(percentile(0.95)),
        maximumMs: round(sorted.at(-1)),
    };
}

export async function main(arguments_ = process.argv.slice(2)) {
    const options = parseArguments(arguments_);
    const configuration =
        options.mode === "quick"
            ? { fixtureSizes: [1000], repetitions: 5, measureMemory: false }
            : { fixtureSizes: [100, 500, 1000, 5000], repetitions: 10, measureMemory: true };
    const revision = gitOutput(options.workspace, ["rev-parse", "--short=12", "HEAD"]);
    const dirty = gitOutput(options.workspace, ["status", "--porcelain"]).length > 0;
    const fixtureRoot = await mkdtemp(join(tmpdir(), "forma-performance-"));
    const startedAt = new Date().toISOString();

    try {
        const real = await measureWorkspace({
            binary: options.binary,
            workspace: options.workspace,
            operations: realOperations,
            repetitions: configuration.repetitions,
            measureMemory: configuration.measureMemory,
        });
        const synthetic = [];
        for (const size of configuration.fixtureSizes) {
            const workspace = await createFixture(fixtureRoot, size);
            const middle = Math.floor(size / 2);
            const source = `notes/note-${String(middle).padStart(5, "0")}.md`;
            const target = `notes/note-${String(middle - 1).padStart(5, "0")}`;
            const operations = [
                { id: "workspace.dashboard", args: ["workspace", "dashboard", "--json"] },
                { id: "inspect", args: ["inspect", source, "--json"] },
                {
                    id: "reference.resolve",
                    args: [
                        "reference",
                        "resolve",
                        "--source",
                        source,
                        "--target",
                        target,
                        "--intent",
                        "link",
                        "--json",
                    ],
                },
                { id: "view.render", args: ["view", "render", ".forma/views/all.md", "--json"] },
            ];
            synthetic.push({
                entries: size,
                operations: await measureWorkspace({
                    binary: options.binary,
                    workspace,
                    operations,
                    repetitions: configuration.repetitions,
                    measureMemory: configuration.measureMemory,
                }),
            });
        }

        const report = {
            schemaVersion: 1,
            mode: options.mode,
            startedAt,
            completedAt: new Date().toISOString(),
            revision,
            dirty,
            host: {
                platform: process.platform,
                architecture: process.arch,
                node: process.version,
            },
            binary: options.binary,
            workspace: options.workspace,
            configuration,
            real,
            synthetic,
        };
        await mkdir(options.outputDirectory, { recursive: true });
        const timestamp = startedAt.replaceAll(/[:.]/gu, "-");
        const outputPath = join(
            options.outputDirectory,
            `${options.mode}-${revision}${dirty ? "-dirty" : ""}-${timestamp}.json`,
        );
        await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
        printSummary(report, outputPath);
        return report;
    } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
    }
}

async function measureWorkspace({ binary, workspace, operations, repetitions, measureMemory }) {
    const measurements = [];
    for (const operation of operations) {
        runOperation(binary, workspace, operation.args);
        const results = [];
        for (let index = 0; index < repetitions; index += 1) {
            results.push(runOperation(binary, workspace, operation.args));
        }
        const measurement = {
            operation: operation.id,
            ...statistics(results.map((result) => result.durationMs)),
            outputBytes: results.at(-1).outputBytes,
        };
        if (measureMemory) {
            measurement.peakRssBytes = await peakRss(binary, workspace, operation.args);
        }
        measurements.push(measurement);
    }
    return measurements;
}

function runOperation(binary, workspace, args) {
    const started = performance.now();
    const result = spawnSync(binary, ["--workspace", workspace, ...args], {
        encoding: "utf8",
        maxBuffer: 128 * 1024 * 1024,
    });
    const durationMs = performance.now() - started;
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(
            `${basename(binary)} ${args.join(" ")} failed with ${String(result.status)}: ${result.stderr.slice(0, 2000)}`,
        );
    }
    return { durationMs, outputBytes: Buffer.byteLength(result.stdout) };
}

async function peakRss(binary, workspace, args) {
    return await new Promise((resolvePeak, reject) => {
        const child = spawn(binary, ["--workspace", workspace, ...args], { stdio: "ignore" });
        let maximumKiB = 0;
        const sample = () => {
            if (!child.pid) return;
            const result = spawnSync("/bin/ps", ["-o", "rss=", "-p", String(child.pid)], {
                encoding: "utf8",
            });
            if (result.error || typeof result.stdout !== "string") return;
            const currentKiB = Number.parseInt(result.stdout.trim(), 10);
            if (Number.isFinite(currentKiB)) maximumKiB = Math.max(maximumKiB, currentKiB);
        };
        sample();
        const timer = setInterval(sample, 5);
        child.once("error", (error) => {
            clearInterval(timer);
            reject(error);
        });
        child.once("close", (code) => {
            clearInterval(timer);
            sample();
            if (code !== 0) reject(new Error(`Peak RSS operation failed with ${String(code)}.`));
            else resolvePeak(maximumKiB > 0 ? maximumKiB * 1024 : null);
        });
    });
}

async function createFixture(root, size) {
    const workspace = join(root, String(size));
    await mkdir(join(workspace, ".forma", "spaces"), { recursive: true });
    await mkdir(join(workspace, ".forma", "views"), { recursive: true });
    await mkdir(join(workspace, "notes"), { recursive: true });
    await Promise.all([
        writeFile(
            join(workspace, ".forma.md"),
            `---
schemaVersion: 1
workspace:
  name: Performance Fixture ${size}
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
imports:
  - .forma/spaces/*.md
  - .forma/views/*.md
---
`,
        ),
        writeFile(
            join(workspace, ".forma", "spaces", "index.md"),
            `---
schemaVersion: 1
kind: taxonomy
id: spaces
title: Spaces
mode: primary
---
`,
        ),
        writeFile(
            join(workspace, ".forma", "spaces", "notes.md"),
            `---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
  - notes/**/*.md
schema:
  type: object
  fields:
    title:
      type: string
    kind:
      type: string
---
`,
        ),
        writeFile(
            join(workspace, ".forma", "views", "all.md"),
            `---
schemaVersion: 1
kind: view
title: All Notes
mode: list
source:
  type: pages
  taxonomy:
    spaces:
      - notes
---

# All Notes

<!-- forma:content -->
`,
        ),
    ]);
    const batchSize = 250;
    for (let offset = 0; offset < size; offset += batchSize) {
        await Promise.all(
            Array.from({ length: Math.min(batchSize, size - offset) }, (_, index) => {
                const number = offset + index;
                const slug = `note-${String(number).padStart(5, "0")}`;
                const previous = `note-${String(Math.max(0, number - 1)).padStart(5, "0")}`;
                return writeFile(
                    join(workspace, "notes", `${slug}.md`),
                    `---
title: Note ${number}
kind: note
---

# Note ${number}

Previous: [[notes/${previous}]].
`,
                );
            }),
        );
    }
    return workspace;
}

function printSummary(report, outputPath) {
    console.log(`Forma performance ${report.mode} — ${report.revision}${report.dirty ? " (dirty)" : ""}`);
    printMeasurements("project", report.real);
    for (const fixture of report.synthetic) printMeasurements(`${fixture.entries} entries`, fixture.operations);
    console.log(`Report: ${outputPath}`);
}

function printMeasurements(label, measurements) {
    console.log(`\n${label}`);
    for (const measurement of measurements) {
        const memory = measurement.peakRssBytes ? ` rss=${(measurement.peakRssBytes / 1024 / 1024).toFixed(1)}MiB` : "";
        console.log(
            `- ${measurement.operation}: median=${measurement.medianMs.toFixed(1)}ms p95=${measurement.p95Ms.toFixed(1)}ms max=${measurement.maximumMs.toFixed(1)}ms bytes=${String(measurement.outputBytes)}${memory}`,
        );
    }
}

function gitOutput(workspace, args) {
    const result = spawnSync("git", args, { cwd: workspace, encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
    return result.stdout.trim();
}

function requiredValue(arguments_, index, option) {
    const value = arguments_[index];
    if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`);
    return value;
}

function round(value) {
    return Number(value.toFixed(3));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await main();
}
