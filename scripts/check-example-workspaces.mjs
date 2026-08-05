import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const examplesRoot = resolve(repoRoot, "examples");
const customerWorkspace = resolve(repoRoot, "examples/fde-customer-project-workspace");
const practiceWorkspace = resolve(repoRoot, "examples/fde-team-practice-workspace");
const referenceFields = new Set([
    "relatedTo",
    "sources",
    "sourceProjects",
    "results",
    "customerRef",
    "projectRef",
    "projectRefs",
]);
const forbiddenField =
    /^(auto|automatic|sync|synchronization|promotion|autoPromotion|automaticPromotion|autoImport|autoShare)$/i;
const sensitiveField = /(password|secret|api[-_]?key|access[-_]?token|bearer|credential|endpoint|email|phone)/i;
const positiveAutomationClaim =
    /\b(?:automatic(?:ally)?\s+(?:import|sync(?:hronize)?|promot(?:e|ion)|share)|(?:import|sync(?:hronize)?|promot(?:e|ion)|share)\s+automatic(?:ally)?)\b/i;

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

function allFiles(root) {
    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const path = resolve(root, entry.name);
        if (entry.isDirectory()) files.push(...allFiles(path));
        else files.push(path);
    }
    return files;
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

function readFrontmatter(path) {
    const source = readFileSync(path, "utf8");
    if (!source.startsWith("---\n")) return {};
    const end = source.indexOf("\n---", 4);
    if (end === -1) throw new Error(`missing frontmatter terminator: ${path}`);
    return parseSimpleFrontmatter(source.slice(4, end));
}

function scalar(value) {
    const trimmed = value.trim();
    if (trimmed === "[]") return [];
    if (trimmed === "{}") return {};
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).replaceAll('\\"', '"');
    }
    return trimmed;
}

function parseSimpleFrontmatter(body) {
    const result = {};
    let listKey = null;
    for (const line of body.split("\n")) {
        const topLevel = /^(\w[\w-]*):(?:\s*(.*))?$/.exec(line);
        if (topLevel) {
            const [, key, rawValue = ""] = topLevel;
            result[key] = rawValue.trim() === "" ? [] : scalar(rawValue);
            listKey = rawValue.trim() === "" ? key : null;
            continue;
        }
        const listItem = /^\s+-\s+(.*)$/.exec(line);
        if (listItem && listKey) {
            if (!Array.isArray(result[listKey])) result[listKey] = [];
            result[listKey].push(scalar(listItem[1]));
        }
    }
    return result;
}

function relativeLabel(path) {
    return relative(repoRoot, path).split(sep).join("/");
}

function resolveLocalRef(workspaceRoot, value, field, ownerPath, errors) {
    if (typeof value !== "string" || value.length === 0) {
        errors.push(`${relativeLabel(ownerPath)}:${field}: reference must be a non-empty string`);
        return;
    }
    if (
        value.includes("fde-customer-project-workspace") ||
        value.includes("fde-team-practice-workspace") ||
        value.includes("ENG-SYN-001") ||
        value.startsWith("/") ||
        value.includes("..") ||
        value.startsWith("file:")
    ) {
        errors.push(`${relativeLabel(ownerPath)}:${field}: cross-workspace or external reference ${value}`);
        return;
    }
    const candidate = value.endsWith(".md") ? value : `${value}.md`;
    const absolute = resolve(workspaceRoot, candidate);
    const workspaceRelative = relative(workspaceRoot, absolute);
    if (workspaceRelative.startsWith(`..${sep}`) || workspaceRelative === ".." || !existsSync(absolute)) {
        errors.push(`${relativeLabel(ownerPath)}:${field}: unresolved workspace-local reference ${value}`);
    }
}

function checkWorkspaceBoundary(workspaceRoot, errors, counters, { strictRelativePaths = false } = {}) {
    const workspaceFiles = allFiles(workspaceRoot);
    const workspaceConfigPath = resolve(workspaceRoot, ".forma.md");
    const workspaceConfig = readFrontmatter(workspaceConfigPath);
    for (const importedPath of workspaceConfig.imports ?? []) {
        if (
            typeof importedPath !== "string" ||
            importedPath.startsWith("/") ||
            importedPath.includes("..") ||
            importedPath.includes("fde-customer-project-workspace") ||
            importedPath.includes("fde-team-practice-workspace")
        ) {
            counters.crossWorkspaceImport += 1;
            errors.push(`${relativeLabel(workspaceConfigPath)}: cross-workspace import ${importedPath}`);
        }
    }

    for (const path of workspaceFiles) {
        const source = readFileSync(path, "utf8");
        const label = relativeLabel(path);
        if (/(?:^|[\s"'`(])\/(?:Users|private|var|tmp|Volumes)\//m.test(source)) {
            counters.originalPath += 1;
            errors.push(`${label}: external absolute path`);
        }
        if (
            /file:\/\//i.test(source) ||
            (strictRelativePaths &&
                (path.endsWith(".md") || path.endsWith(".forma.md")) &&
                /(^|[\s"'`(])\.\.\//m.test(source))
        ) {
            counters.originalPath += 1;
            errors.push(`${label}: external file path`);
        }
        if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(source)) {
            counters.sensitiveData += 1;
            errors.push(`${label}: email-like sensitive value`);
        }
        if (/\b(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s`"']+/i.test(source)) {
            counters.sensitiveData += 1;
            errors.push(`${label}: credential-like assignment`);
        }

        if (!path.endsWith(".md")) continue;
        const frontmatter = readFrontmatter(path);
        for (const [field, value] of Object.entries(frontmatter)) {
            if (forbiddenField.test(field)) {
                counters.automaticPromotion += 1;
                errors.push(`${label}: forbidden automation field ${field}`);
            }
            if (sensitiveField.test(field)) {
                counters.sensitiveData += 1;
                errors.push(`${label}: sensitive frontmatter field ${field}`);
            }
            if (referenceFields.has(field)) {
                const values = Array.isArray(value) ? value : [value];
                for (const reference of values) {
                    const before = errors.length;
                    resolveLocalRef(workspaceRoot, reference, field, path, errors);
                    if (errors.length > before) counters.crossWorkspaceEntryRef += 1;
                }
            }
            if (field === "engagementKey" || field === "sourceEngagementKey") {
                if (value === "ENG-SYN-001") continue;
                if (typeof value !== "string") errors.push(`${label}:${field}: narrative key must be scalar text`);
            }
            if (
                value !== null &&
                value !== undefined &&
                JSON.stringify(value).includes("ENG-SYN-001") &&
                !["engagementKey", "sourceEngagementKey", "title", "summary"].includes(field)
            ) {
                counters.engagementKeyMisuse += 1;
                errors.push(`${label}:${field}: ENG-SYN-001 is only allowed as a narrative scalar key`);
            }
        }
    }
}

function checkRelatedArtifacts(exampleWorkspaces, errors, counters) {
    const artifacts = [
        resolve(repoRoot, "README.md"),
        resolve(repoRoot, ".github/workflows/ci.yml"),
        resolve(repoRoot, "scripts/check-example-workspaces.mjs"),
        ...exampleWorkspaces.map(({ path }) => resolve(path, "README.md")),
    ];
    for (const path of artifacts) {
        const source = readFileSync(path, "utf8");
        const label = relativeLabel(path);
        if (/(?:^|[\s"'`(])\/(?:Users|private|var|tmp|Volumes)\//m.test(source) || /file:\/\//i.test(source)) {
            counters.originalPath += 1;
            errors.push(`${label}: related artifact contains an external absolute/file URL`);
        }
        if (!path.endsWith(".mjs") && /(^|[\s"'`(])\.\.\//m.test(source)) {
            counters.originalPath += 1;
            errors.push(`${label}: related document contains an external relative path`);
        }
        if (
            /\b(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s`"']+/i.test(source) ||
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(source)
        ) {
            counters.sensitiveData += 1;
            errors.push(`${label}: related artifact contains sensitive-looking data`);
        }
        for (const line of source.split("\n")) {
            if (
                positiveAutomationClaim.test(line) &&
                !/\b(?:no|not|never|without|does not|do not|must not|cannot)\b/i.test(line)
            ) {
                counters.automaticPromotion += 1;
                errors.push(`${label}: positive automatic sharing/import/sync/promotion claim`);
            }
        }
        if (
            !path.endsWith(".mjs") &&
            /\b(?:path|import|entryRef|join|auth|authorization|sync|promotion)\b[^\n]*ENG-SYN-001/i.test(source)
        ) {
            counters.engagementKeyMisuse += 1;
            errors.push(
                `${label}: ENG-SYN-001 is used near a path, import, reference, join, auth, sync, or promotion claim`,
            );
        }
    }
}

function requirePracticeContract(errors) {
    const cardPath = resolve(practiceWorkspace, "evidence-cards/acknowledgement-window-comparison.md");
    const card = readFrontmatter(cardPath);
    const sources = card.sourceProjects ?? [];
    const sourceSet = new Set(sources);
    if (!Array.isArray(sources) || sources.length < 2 || sourceSet.size < 2) {
        errors.push("practice evidence card must cite at least two distinct source projects");
    }
    for (const source of sources) resolveLocalRef(practiceWorkspace, source, "sourceProjects", cardPath, errors);
    if (typeof card.environmentDifference !== "string" || card.environmentDifference.trim() === "") {
        errors.push("practice evidence card is missing environmentDifference");
    }
    if (typeof card.counterexample !== "string" || card.counterexample.trim() === "") {
        errors.push("practice evidence card is missing counterexample");
    }
    if (typeof card.revalidationReason !== "string" || card.revalidationReason.trim() === "") {
        errors.push("practice evidence card is missing revalidationReason");
    }
    if (!Array.isArray(card.results) || card.results.length < 3) {
        errors.push("practice evidence card must retain positive, negative, and adjusted result references");
    }

    const environments = sources.map(
        (source) => readFrontmatter(resolve(practiceWorkspace, `${source}.md`)).environment,
    );
    if (new Set(environments).size < 2) errors.push("practice source projects must have different environments");
    return { sourceCount: sources.length, environmentCount: new Set(environments).size };
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

function checkFormaWorkspace(formaBin, workspacePath, label, errors) {
    for (const [operation, args] of [
        ["summary", ["config", "summary", "--sources", "--json"]],
        ["check", ["check", "--json"]],
        ["health", ["workspace", "health", "--json"]],
    ]) {
        const result = run(formaBin, ["--workspace", workspacePath, ...args], repoRoot);
        const parsed = parseJsonResult(result, `${label} ${operation}`, errors);
        if (!parsed) continue;
        if (parsed.status !== "passed" || parsed.summary?.errors !== 0 || parsed.summary?.warnings !== 0) {
            errors.push(`${label} ${operation}: expected passed with zero errors/warnings: ${JSON.stringify(parsed)}`);
        }
        console.log(
            `${label}-${operation}=status:${parsed.status} errors:${parsed.summary?.errors ?? "?"} warnings:${parsed.summary?.warnings ?? "?"}`,
        );
    }
}

function checkFixture(errors) {
    const fixtureRoot = resolve(customerWorkspace, "engineering/fixture");
    const commands = [
        {
            label: "fixture-positive",
            config: "config/staging.json",
            input: "fixtures/staging-events.json",
            expectedExit: 0,
            expectedOutput: "fixture=ack-window profile=staging cases=4 passed=4 failed=0",
        },
        {
            label: "fixture-negative",
            config: "config/production-naive.json",
            input: "fixtures/production-events.json",
            expectedExit: 1,
            expectedOutput: "fixture=ack-window profile=production-naive cases=4 passed=2 failed=2",
        },
        {
            label: "fixture-adjusted",
            config: "config/production-adjusted.json",
            input: "fixtures/production-events.json",
            expectedExit: 0,
            expectedOutput: "fixture=ack-window profile=production-adjusted cases=4 passed=4 failed=0",
        },
    ];
    for (const command of commands) {
        const result = run(
            "node",
            ["scripts/run-regression.mjs", "--config", command.config, "--input", command.input],
            fixtureRoot,
        );
        const output = result.stdout.trim();
        if (result.exitStatus !== command.expectedExit || output !== command.expectedOutput) {
            errors.push(
                `${command.label}: expected exit ${command.expectedExit} and ${command.expectedOutput}, got exit ${result.exitStatus} and ${output}`,
            );
        }
        console.log(`${command.label}=exit:${result.exitStatus} output:${output}`);
    }
    const tests = run("node", ["--test", "tests/ack-window.test.mjs"], fixtureRoot);
    if (tests.exitStatus !== 0)
        errors.push(`fixture-tests: expected exit 0, got ${tests.exitStatus}: ${tests.stderr || tests.stdout}`);
    console.log(`fixture-tests=exit:${tests.exitStatus}`);
}

try {
    const options = parseOptions(process.argv.slice(2));
    const formaBin = options.formaBin.includes(sep) ? resolve(repoRoot, options.formaBin) : options.formaBin;
    const errors = [];
    const counters = {
        crossWorkspaceImport: 0,
        crossWorkspaceEntryRef: 0,
        originalPath: 0,
        automaticPromotion: 0,
        sensitiveData: 0,
        engagementKeyMisuse: 0,
    };

    const version = run(formaBin, ["--version"], repoRoot);
    if (version.exitStatus !== 0)
        throw new Error(`unable to run Forma CLI ${formaBin}: ${version.stderr || version.stdout}`);
    console.log(`forma-version=${version.stdout.trim()}`);

    const exampleWorkspaces = discoverExampleWorkspaces();
    if (exampleWorkspaces.length === 0) throw new Error("no example workspace with .forma.md was discovered");
    const fdeWorkspacePaths = new Set([customerWorkspace, practiceWorkspace]);
    for (const workspace of exampleWorkspaces) {
        checkWorkspaceBoundary(workspace.path, errors, counters, {
            strictRelativePaths: fdeWorkspacePaths.has(workspace.path),
        });
    }
    checkRelatedArtifacts(exampleWorkspaces, errors, counters);
    const practiceContract = requirePracticeContract(errors);
    console.log(
        `example-workspaces=${exampleWorkspaces.length} names=${exampleWorkspaces.map(({ name }) => name).join(",")}`,
    );
    console.log(
        `practice-sources=${practiceContract.sourceCount} environments=${practiceContract.environmentCount} counterexample=present revalidation-reason=present`,
    );
    console.log(`boundary-cross-workspace-import=${counters.crossWorkspaceImport}`);
    console.log(`boundary-cross-workspace-entryRef=${counters.crossWorkspaceEntryRef}`);
    console.log(`boundary-original-path=${counters.originalPath}`);
    console.log(`boundary-automatic-promotion=${counters.automaticPromotion}`);
    console.log(`boundary-sensitive-data=${counters.sensitiveData}`);
    console.log(`boundary-engagement-key-misuse=${counters.engagementKeyMisuse}`);

    for (const workspace of exampleWorkspaces) checkFormaWorkspace(formaBin, workspace.path, workspace.name, errors);
    checkFixture(errors);

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
