import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const shaPattern = /^[0-9a-f]{64}$/u;
const artifactSchema = 4;

export class HostMismatch extends Error {}

export function sha256(data) {
    return createHash("sha256").update(data).digest("hex");
}

export function artifactFile(directory, path) {
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

export function bootstrap(html) {
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

export function validateEnvelope(record, artifactId) {
    assert.equal(record.schemaVersion, artifactSchema);
    assert.equal(record.artifactId, artifactId);
}

export function routeIdentity({ id, kind, path, outputPath, sourcePath, taxonomyId }) {
    return { id, kind, path, outputPath, sourcePath, taxonomyId };
}

export function sameTarget(actual, expected) {
    return JSON.stringify(routeIdentity(actual ?? {})) === JSON.stringify(routeIdentity(expected));
}

export async function readManifest(directory) {
    const config = bootstrap(await readFile(artifactFile(directory, "index.html"), "utf8"));
    const dataPath = `-/data/${config.artifactId}`;
    const manifest = JSON.parse(await readFile(artifactFile(directory, `${dataPath}/dashboard.json`), "utf8"));
    validateEnvelope(manifest, config.artifactId);
    assert.match(manifest.status, /^(passed|warning)$/u);
    for (const key of ["routes", "entries", "directories", "views", "resources"]) assert(Array.isArray(manifest[key]));
    assert.equal(new Set(manifest.routes.map(({ path }) => path)).size, manifest.routes.length);
    const home = manifest.routes.find(({ kind }) => kind === "home");
    assert(home && sameTarget(config.pageTarget, home) && config.pageRoutePath === home.path);
    const details = [...manifest.entries.flatMap((entry) => [entry, ...entry.variants]), ...manifest.views];
    assert.equal(new Set(details.map((detail) => detail.dataPath)).size, details.length);
    for (const detail of details) assert.match(detail.dataPath, /^(?:entries|views)\/[0-9a-f]{64}\.json$/u);
    return { config, dataPath, manifest, details };
}
