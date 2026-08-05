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

const partitionContracts = new Map([
    [
        customerWorkspace,
        [
            {
                group: "overview",
                path: "overview/engagement-map.md",
                include: "overview/**/*.md",
                template: ".forma/spaces/templates/overview.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "relatedTo"],
            },
            {
                group: "customers",
                path: "customers/c-017.md",
                include: "customers/**/*.md",
                template: ".forma/spaces/templates/customer-fact.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "customerKey",
                    "environment",
                    "relatedTo",
                ],
            },
            {
                group: "communications",
                path: "communications/discovery-call.md",
                include: "communications/**/*.md",
                template: ".forma/spaces/templates/communication-index.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "sourceId",
                    "sourceKind",
                    "relatedTo",
                ],
            },
            {
                group: "asks",
                path: "asks/acknowledgement-window.md",
                include: "asks/**/*.md",
                template: ".forma/spaces/templates/ask.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "customerKey",
                    "sources",
                    "relatedTo",
                ],
            },
            {
                group: "issues",
                path: "issues/delayed-acknowledgement.md",
                include: "issues/**/*.md",
                template: ".forma/spaces/templates/issue.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "customerKey",
                    "environment",
                    "sources",
                    "relatedTo",
                ],
            },
            {
                group: "proposals",
                path: "proposals/environment-aware-ack-window.md",
                include: "proposals/**/*.md",
                template: ".forma/spaces/templates/proposal.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "sources", "relatedTo"],
            },
            {
                group: "decisions",
                path: "decisions/use-replay-guard-and-profile-specific-window.md",
                include: "decisions/**/*.md",
                template: ".forma/spaces/templates/decision.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "sources", "relatedTo"],
            },
            {
                group: "tasks",
                path: "tasks/inspect-environment.md",
                include: "tasks/**/*.md",
                template: ".forma/spaces/templates/task.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "relatedTo"],
            },
            {
                group: "runbooks",
                path: "runbooks/investigate-delayed-acknowledgement.md",
                include: "runbooks/**/*.md",
                template: ".forma/spaces/templates/runbook.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "sources", "relatedTo"],
            },
            {
                group: "guidelines",
                path: "guidelines/customer-project-operations.md",
                include: "guidelines/**/*.md",
                template: ".forma/spaces/templates/guideline.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "relatedTo"],
            },
            {
                group: "engineering",
                path: "engineering/collector.md",
                include: "engineering/**/*.md",
                template: ".forma/spaces/templates/engineering.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "relatedTo"],
            },
            {
                group: "verifications",
                path: "verifications/acknowledgement-window-validation.md",
                include: "verifications/**/*.md",
                template: ".forma/spaces/templates/verification.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "result",
                    "exitStatus",
                    "commands",
                    "expected",
                    "failureConditions",
                    "relatedTo",
                    "sources",
                ],
            },
        ],
    ],
    [
        practiceWorkspace,
        [
            {
                group: "overview",
                path: "overview/practice-map.md",
                include: "overview/**/*.md",
                template: ".forma/spaces/templates/overview.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "sourceProjects",
                    "relatedTo",
                ],
            },
            {
                group: "customers",
                path: "customers/c-017.md",
                include: "customers/**/*.md",
                template: ".forma/spaces/templates/customer-index.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "customerKey",
                    "environment",
                    "allowedShare",
                    "relatedTo",
                ],
            },
            {
                group: "projects",
                path: "projects/p-042.md",
                include: "projects/**/*.md",
                template: ".forma/spaces/templates/project-observation.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "sourceEngagementKey",
                    "customerKey",
                    "projectKey",
                    "environment",
                    "customerRef",
                    "sources",
                    "allowedShare",
                    "relatedTo",
                ],
            },
            {
                group: "communications",
                path: "communications/p-042-source-index.md",
                include: "communications/**/*.md",
                template: ".forma/spaces/templates/source-index.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "sourceId",
                    "sourceKind",
                    "projectRef",
                    "relatedTo",
                ],
            },
            {
                group: "evidence-cards",
                path: "evidence-cards/acknowledgement-window-comparison.md",
                include: "evidence-cards/**/*.md",
                template: ".forma/spaces/templates/evidence-card.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "sourceProjects",
                    "results",
                    "environmentDifference",
                    "counterexample",
                    "revalidationReason",
                    "relatedTo",
                ],
            },
            {
                group: "verification",
                path: "verification/p-042-staging-result.md",
                include: "verification/**/*.md",
                template: ".forma/spaces/templates/verification-result.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "projectKey",
                    "environment",
                    "result",
                    "exitStatus",
                    "actual",
                    "projectRef",
                    "relatedTo",
                ],
            },
            {
                group: "proposals",
                path: "proposals/acknowledgement-window-diagnostic-pattern.md",
                include: "proposals/**/*.md",
                template: ".forma/spaces/templates/practice-proposal.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "sources", "relatedTo"],
            },
            {
                group: "reviews",
                path: "reviews/acknowledgement-window-review.md",
                include: "reviews/**/*.md",
                template: ".forma/spaces/templates/human-review.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "decision",
                    "humanReviewRole",
                    "reason",
                    "sources",
                    "relatedTo",
                ],
            },
            {
                group: "patterns",
                path: "patterns/acknowledgement-window-diagnostic.md",
                include: "patterns/**/*.md",
                template: ".forma/spaces/templates/pattern.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "applicability",
                    "limits",
                    "counterexample",
                    "sources",
                    "relatedTo",
                ],
            },
            {
                group: "guidelines",
                path: "guidelines/practice-distillation.md",
                include: "guidelines/**/*.md",
                template: ".forma/spaces/templates/practice-guideline.md",
                required: ["title", "summary", "type", "status", "synthetic", "engagementKey", "sources", "relatedTo"],
            },
            {
                group: "reusable-templates",
                path: "reusable-templates/evidence-card-template.md",
                include: "reusable-templates/**/*.md",
                template: ".forma/spaces/templates/reusable-template.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "applicability",
                    "limits",
                    "sources",
                    "relatedTo",
                ],
            },
            {
                group: "revalidations",
                path: "revalidations/p-051-revalidation.md",
                include: "revalidations/**/*.md",
                template: ".forma/spaces/templates/revalidation.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "projectKey",
                    "environment",
                    "projectRef",
                    "sources",
                    "result",
                    "reason",
                    "revalidationReason",
                    "relatedTo",
                ],
            },
            {
                group: "roles",
                path: "roles/source-fde.md",
                include: "roles/**/*.md",
                template: ".forma/spaces/templates/role.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "ownerRole",
                    "relatedTo",
                ],
            },
            {
                group: "portfolio-observation",
                path: "portfolio-observation/engagement-syn-001.md",
                include: "portfolio-observation/**/*.md",
                template: ".forma/spaces/templates/portfolio-observation.md",
                required: [
                    "title",
                    "summary",
                    "type",
                    "status",
                    "synthetic",
                    "engagementKey",
                    "stage",
                    "blockerClass",
                    "lastHealthStatus",
                    "ownerRole",
                    "projectRefs",
                    "relatedTo",
                ],
            },
        ],
    ],
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

function checkPartitionContracts(formaBin, workspacePath, label, errors) {
    const contracts = partitionContracts.get(workspacePath);
    if (!contracts) return;
    const partitionGuideline =
        workspacePath === customerWorkspace
            ? "guidelines/partition-contracts.md"
            : "guidelines/practice-partition-contracts.md";
    const skillId =
        workspacePath === customerWorkspace ? "customer-partition-contracts" : "practice-partition-contracts";

    const summaryResult = run(
        formaBin,
        ["--workspace", workspacePath, "config", "summary", "--sources", "--json"],
        repoRoot,
    );
    const summary = parseJsonResult(summaryResult, `${label} partition summary`, errors);
    if (!summary) return;

    const skillResult = run(formaBin, ["--workspace", workspacePath, "skills", "get", skillId, "--json"], repoRoot);
    const skill = parseJsonResult(skillResult, `${label} partition skill`, errors);
    if (skill) {
        const content = skill.skill?.content ?? "";
        if (skill.status !== "passed" || skill.skill?.sourcePath !== partitionGuideline) {
            errors.push(`${label} partition skill did not resolve ${partitionGuideline}`);
        }
        if (!content.includes("## Agent Skill")) {
            errors.push(`${label} partition skill is missing the projected Agent Skill section`);
        }
        for (const contract of contracts) {
            if (!content.includes(`\`${contract.group}/\``)) {
                errors.push(`${label} partition skill is missing the ${contract.group}/ routing entry`);
            }
        }
    }
    console.log(`${label}-partition-skill=status:${errors.length === 0 ? "passed" : "failed"}`);

    const groups = new Map((summary.contentGroups ?? []).map((group) => [group.id, group]));
    const expectedGroups = new Set(contracts.map(({ group }) => group));
    for (const group of groups.keys()) {
        if (!expectedGroups.has(group))
            errors.push(`${label} partition contract has unexpected content group ${group}`);
    }
    for (const group of expectedGroups) {
        if (!groups.has(group)) errors.push(`${label} partition contract is missing content group ${group}`);
    }

    for (const contract of contracts) {
        const before = errors.length;
        const group = groups.get(contract.group);
        if (!group) {
            console.log(`${label}-partition=${contract.group} path=${contract.path} status:failed`);
            continue;
        }
        if (!group.includePatterns?.includes(contract.include)) {
            errors.push(`${label} ${contract.group}: expected include pattern ${contract.include}`);
        }
        if (group.entryCount < 1) {
            errors.push(`${label} ${contract.group}: expected at least one entry`);
        }
        if (group.create?.template !== contract.template) {
            errors.push(
                `${label} ${contract.group}: expected template ${contract.template}, got ${group.create?.template ?? "missing"}`,
            );
        }
        if (!group.guidelines?.includes(partitionGuideline)) {
            errors.push(`${label} ${contract.group}: missing partition contract guideline`);
        }
        const schemaFields = new Map((group.schemaFields ?? []).map((field) => [field.path, field]));
        for (const field of contract.required) {
            if (!schemaFields.get(field)?.required) {
                errors.push(`${label} ${contract.group}: schema field ${field} must be required`);
            }
        }

        const explainResult = run(
            formaBin,
            ["--workspace", workspacePath, "workspace", "explain", contract.path, "--json"],
            repoRoot,
        );
        const explain = parseJsonResult(explainResult, `${label} ${contract.group} explain`, errors);
        if (explain) {
            if (explain.status !== "passed" || explain.target?.kind !== "content") {
                errors.push(`${label} ${contract.group}: explain did not resolve a content entry`);
            }
            if (explain.effective?.selectedContentGroup !== contract.group) {
                errors.push(
                    `${label} ${contract.group}: explain selected ${explain.effective?.selectedContentGroup ?? "none"}`,
                );
            }
            if (explain.effective?.template !== contract.template) {
                errors.push(`${label} ${contract.group}: explain template ${explain.effective?.template ?? "none"}`);
            }
            if (!explain.effective?.guidelines?.includes(partitionGuideline)) {
                errors.push(`${label} ${contract.group}: explain omitted partition contract guideline`);
            }
        }
        console.log(
            `${label}-partition=${contract.group} path=${contract.path} status:${errors.length === before ? "passed" : "failed"}`,
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

    for (const workspace of exampleWorkspaces) {
        checkFormaWorkspace(formaBin, workspace.path, workspace.name, errors);
        checkPartitionContracts(formaBin, workspace.path, workspace.name, errors);
    }
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
