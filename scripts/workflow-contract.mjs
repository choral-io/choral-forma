import { parseDocument } from "yaml";

export function parseWorkflow(source, label = "workflow") {
    const document = parseDocument(source, { version: "1.2" });
    if (document.errors.length > 0) {
        throw new Error(`${label} is not valid YAML 1.2: ${document.errors.map(String).join("; ")}`);
    }

    const workflow = document.toJS({ maxAliasCount: 100 });
    if (!isRecord(workflow)) throw new Error(`${label} must contain a mapping`);
    return workflow;
}

export function trigger(workflow, name) {
    return workflow.on?.[name];
}

export function hasTrigger(workflow, name) {
    return Object.hasOwn(workflow.on ?? {}, name);
}

export function workflowInputNames(workflow, triggerName = "workflow_dispatch") {
    return Object.keys(trigger(workflow, triggerName)?.inputs ?? {}).sort();
}

export function workflowJobs(workflow) {
    return workflow.jobs ?? {};
}

export function job(workflow, id) {
    const value = workflowJobs(workflow)[id];
    if (!isRecord(value)) throw new Error(`workflow is missing job ${id}`);
    return value;
}

export function jobNeeds(jobDefinition) {
    const needs = jobDefinition.needs ?? [];
    return (Array.isArray(needs) ? needs : [needs]).filter((value) => typeof value === "string");
}

export function dependsOn(jobDefinition, dependency) {
    return jobNeeds(jobDefinition).includes(dependency);
}

export function normalizedPermissions(workflow, jobDefinition) {
    const permissions = jobDefinition?.permissions ?? workflow.permissions ?? {};
    if (permissions === "read-all") return { "*": "read" };
    if (permissions === "write-all") return { "*": "write" };
    if (permissions === "{}") return {};
    return isRecord(permissions) ? permissions : {};
}

export function permission(workflow, jobDefinition, scope) {
    const permissions = normalizedPermissions(workflow, jobDefinition);
    return permissions[scope] ?? permissions["*"] ?? "none";
}

export function isReadOnly(workflow, jobDefinition) {
    return Object.values(normalizedPermissions(workflow, jobDefinition)).every(
        (value) => value === "read" || value === "none",
    );
}

export function environmentName(jobDefinition) {
    if (typeof jobDefinition.environment === "string") return jobDefinition.environment;
    return jobDefinition.environment?.name;
}

export function jobUses(jobDefinition, action) {
    return (jobDefinition.steps ?? []).some((step) => step?.uses === action);
}

export function jobsUsing(workflow, action) {
    return Object.entries(workflowJobs(workflow))
        .filter(([, jobDefinition]) => jobDefinition.uses === action)
        .map(([id]) => id);
}

export function stepRunCommands(jobDefinition) {
    return (jobDefinition.steps ?? []).flatMap((step) => (typeof step?.run === "string" ? [step.run] : []));
}

export function secretReferences(value) {
    const references = new Set();
    visit(value, (string) => {
        for (const match of string.matchAll(/secrets\.([A-Z0-9_]+)/gu)) references.add(match[1]);
    });
    return [...references].sort();
}

export function releaseContractFailures({ release, releaseCliBuild, releaseVscodeBuild }) {
    const failures = [];
    const releaseJobs = workflowJobs(release);
    const cliBuildJobs = workflowJobs(releaseCliBuild);
    const vscodeBuildJobs = workflowJobs(releaseVscodeBuild);

    if (workflowInputNames(release).join(",") !== "version") {
        failures.push("release workflow_dispatch must expose only the version input");
    }
    if (trigger(release, "push") !== undefined) failures.push("release must not publish from a push trigger");
    if (!hasTrigger(release, "workflow_dispatch")) {
        failures.push("release must be manually dispatched");
    }
    if (!hasTrigger(releaseCliBuild, "workflow_call")) {
        failures.push("release-cli-build must be a reusable workflow_call workflow");
    }
    if (!hasTrigger(releaseVscodeBuild, "workflow_call")) {
        failures.push("release-vscode-build must be a reusable workflow_call workflow");
    }

    const cliBuilderJobs = jobsUsing(release, "./.github/workflows/release-cli-build.yml");
    const vscodeBuilderJobs = jobsUsing(release, "./.github/workflows/release-vscode-build.yml");
    if (cliBuilderJobs.length !== 1) failures.push("release must call the reusable CLI builder exactly once");
    if (vscodeBuilderJobs.length !== 1) failures.push("release must call the reusable VS Code builder exactly once");

    const assemble = releaseJobs["assemble-candidate"];
    const promote = releaseJobs.promote;
    const verify = releaseJobs["verify-published-release"];
    const marketplace = releaseJobs["publish-vscode-marketplace"];
    if (!isRecord(assemble)) {
        failures.push("release must assemble a candidate");
    } else {
        if (!dependsOn(assemble, "build-cli-candidate")) {
            failures.push("candidate assembly must depend on the CLI builder");
        }
        if (!dependsOn(assemble, "build-vscode-candidate")) {
            failures.push("candidate assembly must depend on the VS Code builder");
        }
    }
    if (!isRecord(promote)) {
        failures.push("release must contain a promote job");
    } else {
        if (!dependsOn(promote, "assemble-candidate")) failures.push("promotion must depend on candidate assembly");
        if (environmentName(promote) !== "release-production") {
            failures.push("promotion must use the release-production environment");
        }
        if (permission(release, promote, "contents") !== "write") {
            failures.push("promotion must have contents: write");
        }
    }
    if (!isRecord(verify) || !dependsOn(verify, "promote")) {
        failures.push("published-release verification must depend on promotion");
    }
    if (!isRecord(marketplace)) {
        failures.push("release must contain a Marketplace publication job");
    } else {
        if (!dependsOn(marketplace, "verify-published-release")) {
            failures.push("Marketplace publication must depend on published-release verification");
        }
        if (permission(release, marketplace, "id-token") !== "write") {
            failures.push("Marketplace publication must have id-token: write");
        }
        if (
            stepRunCommands(marketplace).some((command) =>
                /(?:cargo\s+build|pnpm(?:\s+--filter\s+\S+)?\s+(?:build|package:vsix)|vsce\s+package)/u.test(command),
            )
        ) {
            failures.push("Marketplace publication must not rebuild or package the VSIX");
        }
    }

    const readOnlyJobs = [
        ...Object.entries(releaseJobs).map(([id, definition]) => [id, release, definition]),
        ...Object.entries(cliBuildJobs).map(([id, definition]) => [`cli:${id}`, releaseCliBuild, definition]),
        ...Object.entries(vscodeBuildJobs).map(([id, definition]) => [`vscode:${id}`, releaseVscodeBuild, definition]),
    ];
    for (const [id, workflow, jobDefinition] of readOnlyJobs) {
        if (id === "promote" || id === "publish-vscode-marketplace") continue;
        if (!isReadOnly(workflow, jobDefinition)) {
            failures.push(`${id} must retain read-only permissions before publication`);
        }
        if (permission(workflow, jobDefinition, "id-token") === "write") {
            failures.push(`${id} must not have id-token: write`);
        }
    }

    return failures;
}

export function ciContractFailures(workflow) {
    const failures = [];
    const jobs = workflowJobs(workflow);
    const deploy = jobs["deploy-site"];
    const expectedDependencies = Object.keys(jobs)
        .filter((id) => id !== "deploy-site")
        .sort();

    if (!hasTrigger(workflow, "pull_request")) failures.push("CI must run for pull requests");
    const mainBranches = trigger(workflow, "push")?.branches ?? [];
    if (!mainBranches.includes("main")) failures.push("CI must run for pushes to main");
    if (!isRecord(deploy)) {
        failures.push("CI must include a deploy-site job");
        return failures;
    }
    if (environmentName(deploy) !== "forma.choral.io") failures.push("site deployment must use forma.choral.io");
    const deployCondition = String(deploy.if ?? "")
        .replace(/\s+/gu, " ")
        .trim();
    if (
        deployCondition.includes("||") ||
        !/^github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'(?: &&|$)/u.test(deployCondition)
    ) {
        failures.push("site deployment must run only for main pushes");
    }
    const actualDependencies = jobNeeds(deploy).sort();
    if (actualDependencies.join(",") !== expectedDependencies.join(",")) {
        failures.push("site deployment must depend on site and every other CI gate");
    }

    const cloudflareSecrets = new Set(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);
    for (const [id, jobDefinition] of Object.entries(jobs)) {
        for (const reference of secretReferences(jobDefinition)) {
            if (cloudflareSecrets.has(reference) && id !== "deploy-site") {
                failures.push(`Cloudflare secret ${reference} must only appear in deploy-site`);
            }
        }
    }
    const deploySecrets = new Set(secretReferences(deploy));
    for (const secret of cloudflareSecrets) {
        if (!deploySecrets.has(secret)) failures.push(`deploy-site must receive ${secret}`);
    }
    return failures;
}

function visit(value, onString) {
    if (typeof value === "string") return onString(value);
    if (Array.isArray(value)) return value.forEach((item) => visit(item, onString));
    if (isRecord(value)) Object.values(value).forEach((item) => visit(item, onString));
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
