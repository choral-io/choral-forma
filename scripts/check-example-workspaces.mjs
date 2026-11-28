import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
    checkFdeEngineeringFixture,
    checkFdePartitionContracts,
    checkFdeStaticExport,
    checkFdeWorkspaceBoundaries,
    fdeStaticExampleRoutes,
} from "./check-fde-example-contracts.mjs";

import { readManifest } from "./static-site-artifact.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const examplesRoot = resolve(repoRoot, "examples");
const staticExampleRoutes = new Map([
    ["minimal-workspace", ["/notes/welcome.md", "/-/views/notes"]],
    ["software-product-rd-workspace", ["/validation"]],
    ...fdeStaticExampleRoutes,
]);

function parseOptions(argv) {
    const options = { formaBin: process.env.FORMA_BIN ?? "forma" };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--") continue;
        if (argument === "--forma-bin") {
            options.formaBin = argv[index + 1];
            index += 1;
        } else {
            throw new Error(`unknown option ${argument}`);
        }
    }
    return options;
}

function discoverExampleWorkspaces() {
    return readdirSync(examplesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(resolve(examplesRoot, entry.name, ".forma.md")))
        .map((entry) => ({
            name: entry.name,
            path: resolve(examplesRoot, entry.name),
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

function run(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, encoding: "utf8" });
    return {
        exitStatus: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}

function parseJsonResult(result, label, errors) {
    if (result.exitStatus !== 0) {
        errors.push(`${label}: process exited ${result.exitStatus}: ${result.stderr || result.stdout}`);
        return null;
    }
    try {
        return JSON.parse(result.stdout);
    } catch {
        errors.push(`${label}: expected JSON output: ${result.stdout}`);
        return null;
    }
}

function checkFormaWorkspace(readFormaJson, workspacePath, label, errors) {
    let summary;
    for (const [operation, args] of [
        ["summary", ["config", "summary", "--sources", "--json"]],
        ["check", ["check", "--json"]],
        ["health", ["workspace", "health", "--json"]],
    ]) {
        const parsed = readFormaJson(workspacePath, args, `${label} ${operation}`);
        if (!parsed) continue;
        if (operation === "summary") summary = parsed;
        if (parsed.status !== "passed" || parsed.summary?.errors !== 0 || parsed.summary?.warnings !== 0) {
            errors.push(`${label} ${operation}: expected passed with zero errors/warnings: ${JSON.stringify(parsed)}`);
        }
        console.log(
            `${label}-${operation}=status:${parsed.status} errors:${parsed.summary?.errors ?? "?"} warnings:${parsed.summary?.warnings ?? "?"}`,
        );
    }
    return summary;
}

async function checkStaticExample(readFormaJson, workspace, output, errors) {
    const label = `${workspace.name} static export`;
    const baseUrl = "https://example.test";
    const rootPath = "/preview";
    const parsed = readFormaJson(
        workspace.path,
        ["site", "build", "--out", output, "--base-url", baseUrl, "--root-path", rootPath, "--json"],
        label,
    );
    if (!parsed) return;
    if (parsed.operation !== "site.build" || parsed.status !== "passed" || parsed.counts?.warnings !== 0) {
        errors.push(`${label}: expected passed with zero warnings: ${JSON.stringify(parsed)}`);
        return;
    }

    try {
        const { config, manifest } = await readManifest(output);
        if (config.rootPath !== rootPath || config.artifactId !== parsed.artifactId) {
            errors.push(`${label}: artifact configuration differs from the build result or requested root path`);
        }
        const sitemap = readFileSync(resolve(output, "sitemap.xml"), "utf8");
        for (const path of ["/", ...(staticExampleRoutes.get(workspace.name) ?? [])]) {
            const route = manifest.routes.find((route) => route.path === path);
            if (!route || !statSync(resolve(output, route.outputPath), { throwIfNoEntry: false })?.isFile()) {
                errors.push(`${label}: missing HTML output for ${path}`);
            }
            if (!sitemap.includes(`<loc>${baseUrl}${rootPath}${path}</loc>`)) {
                errors.push(`${label}: sitemap is missing ${rootPath}${path}`);
            }
        }

        checkFdeStaticExport(workspace, manifest, output, label, errors);
        console.log(`${workspace.name}-static=status:${parsed.status} routes:${manifest.routes.length}`);
    } catch (error) {
        errors.push(`${label}: ${error.message}`);
    }
}

try {
    const options = parseOptions(process.argv.slice(2));
    const formaBin = options.formaBin.includes(sep) ? resolve(repoRoot, options.formaBin) : options.formaBin;
    const errors = [];
    const readFormaJson = (workspacePath, args, label) =>
        parseJsonResult(run(formaBin, ["--workspace", workspacePath, ...args], repoRoot), label, errors);

    const version = run(formaBin, ["--version"], repoRoot);
    if (version.exitStatus !== 0)
        throw new Error(`unable to run Forma CLI ${formaBin}: ${version.stderr || version.stdout}`);
    console.log(`forma-version=${version.stdout.trim()}`);

    const exampleWorkspaces = discoverExampleWorkspaces();
    if (exampleWorkspaces.length === 0) throw new Error("no example workspace with .forma.md was discovered");
    const boundaryReport = checkFdeWorkspaceBoundaries(exampleWorkspaces, errors);
    console.log(
        `example-workspaces=${exampleWorkspaces.length} names=${exampleWorkspaces.map(({ name }) => name).join(",")}`,
    );
    for (const line of boundaryReport) console.log(line);

    for (const workspace of exampleWorkspaces) {
        const summary = checkFormaWorkspace(readFormaJson, workspace.path, workspace.name, errors);
        checkFdePartitionContracts(readFormaJson, workspace.path, workspace.name, summary, errors);
    }
    const exportRoot = mkdtempSync(resolve(realpathSync(tmpdir()), "forma-example-exports-"));
    try {
        for (const workspace of exampleWorkspaces.filter(({ name }) => name !== "getting-started-workspace")) {
            await checkStaticExample(readFormaJson, workspace, resolve(exportRoot, workspace.name), errors);
        }
    } finally {
        rmSync(exportRoot, { recursive: true, force: true });
    }
    checkFdeEngineeringFixture(run, errors);

    if (errors.length > 0) {
        for (const error of errors) console.error(`example-gate-error=${error}`);
        process.exitCode = 1;
    } else {
        console.log("examples=status:passed");
    }
} catch (error) {
    console.error(`example-gate-error=${error.message}`);
    process.exitCode = 1;
}
