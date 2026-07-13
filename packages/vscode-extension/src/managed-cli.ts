import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const DEFAULT_REPOSITORY = "choral-io/choral-forma";
const DEFAULT_MAX_BINARY_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_CHECKSUM_BYTES = 8 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;

export type ManagedCliLibc = "glibc" | "musl";

export type ManagedCliTarget = {
    assetName: string;
    binaryName: "forma" | "forma.exe";
};

export type ManagedCliStorage = string | { fsPath: string };

export type ManagedCliDownloadRequest = {
    url: string;
    destination: string;
    signal: AbortSignal;
    maxBytes: number;
};

export type ManagedCliDownloader = (request: ManagedCliDownloadRequest) => Promise<number>;

export type ManagedCliFetch = (
    input: string,
    init: { signal: AbortSignal },
) => Promise<Pick<Response, "body" | "headers" | "ok" | "status" | "statusText">>;

export type InstallManagedCliOptions = {
    version: string;
    globalStorage: ManagedCliStorage;
    platform?: NodeJS.Platform;
    arch?: string;
    libc?: ManagedCliLibc;
    repository?: string;
    downloader?: ManagedCliDownloader;
    fetch?: ManagedCliFetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxBinaryBytes?: number;
    maxChecksumBytes?: number;
    replaceExisting?: boolean;
};

export type ManagedCliInstallation = {
    path: string;
    version: string;
    assetName: string;
    reused: boolean;
};

type InstallFlight = {
    controller: AbortController;
    promise: Promise<ManagedCliInstallation>;
    subscribers: number;
    settled: boolean;
};

const installFlights = new Map<string, InstallFlight>();

export class ManagedCliInstallError extends Error {
    constructor(
        message: string,
        readonly kind:
            | "unsupportedPlatform"
            | "invalidVersion"
            | "downloadFailed"
            | "downloadTooLarge"
            | "invalidChecksum"
            | "checksumMismatch"
            | "cancelled"
            | "timeout",
    ) {
        super(message);
        this.name = "ManagedCliInstallError";
    }
}

export function resolveManagedCliTarget(
    platform: NodeJS.Platform,
    arch: string,
    libc: ManagedCliLibc | undefined = platform === "linux" ? detectLinuxLibc() : undefined,
): ManagedCliTarget {
    if (platform === "linux" && libc === "musl") {
        throw new ManagedCliInstallError(
            "Managed Forma CLI downloads support Linux glibc only; Linux musl is not supported.",
            "unsupportedPlatform",
        );
    }

    const key = `${platform}-${arch}`;
    switch (key) {
        case "darwin-arm64":
            return { assetName: "forma-macos-arm64", binaryName: "forma" };
        case "darwin-x64":
            return { assetName: "forma-macos-x64", binaryName: "forma" };
        case "linux-arm64":
            return { assetName: "forma-linux-arm64", binaryName: "forma" };
        case "linux-x64":
            return { assetName: "forma-linux-x64", binaryName: "forma" };
        case "win32-x64":
            return { assetName: "forma-windows-x64.exe", binaryName: "forma.exe" };
        default:
            throw new ManagedCliInstallError(
                `Managed Forma CLI downloads do not support ${platform}/${arch}.`,
                "unsupportedPlatform",
            );
    }
}

export function managedCliPath(
    globalStorage: ManagedCliStorage,
    version: string,
    platform: NodeJS.Platform = process.platform,
): string {
    validateVersion(version);
    return join(storagePath(globalStorage), "cli", version, platform === "win32" ? "forma.exe" : "forma");
}

export function managedCliReleaseUrls(
    version: string,
    target: ManagedCliTarget,
    repository = DEFAULT_REPOSITORY,
): { binary: string; checksum: string } {
    validateVersion(version);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
        throw new ManagedCliInstallError(`Invalid GitHub repository: ${repository}`, "downloadFailed");
    }
    const base = `https://github.com/${repository}/releases/download/v${encodeURIComponent(version)}`;
    const binary = `${base}/${encodeURIComponent(target.assetName)}`;
    return { binary, checksum: `${binary}.sha256` };
}

export async function installManagedCli(options: InstallManagedCliOptions): Promise<ManagedCliInstallation> {
    if (options.signal?.aborted) {
        throw abortError(options.signal.reason);
    }
    const platform = options.platform ?? process.platform;
    const arch = options.arch ?? process.arch;
    const target = resolveManagedCliTarget(platform, arch, options.libc);
    const path = managedCliPath(options.globalStorage, options.version, platform);
    const key = path;
    let flight = installFlights.get(key);

    if (!flight) {
        const controller = new AbortController();
        const created: InstallFlight = {
            controller,
            promise: Promise.resolve({
                path,
                version: options.version,
                assetName: target.assetName,
                reused: false,
            }),
            subscribers: 0,
            settled: false,
        };
        created.promise = installManagedCliOnce(options, platform, target, path, controller.signal).finally(() => {
            created.settled = true;
            if (installFlights.get(key) === created) {
                installFlights.delete(key);
            }
        });
        installFlights.set(key, created);
        flight = created;
    }

    return await subscribeToFlight(flight, options.signal);
}

export function createFetchDownloader(fetchImplementation: ManagedCliFetch = globalThis.fetch): ManagedCliDownloader {
    return async ({ url, destination, signal, maxBytes }) => {
        let response: Awaited<ReturnType<ManagedCliFetch>>;
        try {
            response = await fetchImplementation(url, { signal });
        } catch (error) {
            if (signal.aborted) {
                throw abortError(signal.reason);
            }
            throw new ManagedCliInstallError(`Failed to download ${url}: ${errorMessage(error)}`, "downloadFailed");
        }
        if (!response.ok) {
            throw new ManagedCliInstallError(
                `Failed to download ${url}: HTTP ${String(response.status)} ${response.statusText}`.trim(),
                "downloadFailed",
            );
        }
        const contentLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
            throw new ManagedCliInstallError(
                `Download exceeded the ${String(maxBytes)}-byte limit: ${url}`,
                "downloadTooLarge",
            );
        }
        if (!response.body) {
            throw new ManagedCliInstallError(`Download returned an empty body: ${url}`, "downloadFailed");
        }

        const file = await open(destination, "wx", 0o600);
        const reader = response.body.getReader();
        let received = 0;
        try {
            let done = false;
            while (!done) {
                if (signal.aborted) {
                    throw abortError(signal.reason);
                }
                const chunk = await reader.read();
                if (chunk.done) {
                    done = true;
                } else {
                    received += chunk.value.byteLength;
                    if (received > maxBytes) {
                        await reader.cancel();
                        throw new ManagedCliInstallError(
                            `Download exceeded the ${String(maxBytes)}-byte limit: ${url}`,
                            "downloadTooLarge",
                        );
                    }
                    await writeAll(file, chunk.value);
                }
            }
        } finally {
            await file.close();
        }
        return received;
    };
}

export function detectLinuxLibc(): ManagedCliLibc {
    const report = process.report.getReport() as unknown as {
        header: { glibcVersionRuntime?: unknown };
    };
    const { header } = report;
    if (typeof header.glibcVersionRuntime === "string" && header.glibcVersionRuntime.length > 0) {
        return "glibc";
    }
    return "musl";
}

async function installManagedCliOnce(
    options: InstallManagedCliOptions,
    platform: NodeJS.Platform,
    target: ManagedCliTarget,
    destination: string,
    flightSignal: AbortSignal,
): Promise<ManagedCliInstallation> {
    if (!options.replaceExisting && (await isFile(destination))) {
        return { path: destination, version: options.version, assetName: target.assetName, reused: true };
    }

    const directory = dirname(destination);
    await mkdir(directory, { recursive: true });
    const suffix = `${String(process.pid)}-${randomUUID()}`;
    const binaryTemp = join(directory, `.${basename(destination)}.${suffix}.download`);
    const checksumTemp = `${binaryTemp}.sha256`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signalScope = deadlineSignal(flightSignal, timeoutMs);
    const downloader = options.downloader ?? createFetchDownloader(options.fetch ?? globalThis.fetch);
    const urls = managedCliReleaseUrls(options.version, target, options.repository);

    try {
        await downloader({
            url: urls.binary,
            destination: binaryTemp,
            signal: signalScope.signal,
            maxBytes: options.maxBinaryBytes ?? DEFAULT_MAX_BINARY_BYTES,
        });
        throwIfAborted(signalScope.signal);
        await downloader({
            url: urls.checksum,
            destination: checksumTemp,
            signal: signalScope.signal,
            maxBytes: options.maxChecksumBytes ?? DEFAULT_MAX_CHECKSUM_BYTES,
        });
        throwIfAborted(signalScope.signal);
        const expected = parseChecksum(await readFile(checksumTemp, "utf8"), target.assetName);
        const actual = await sha256(binaryTemp);
        throwIfAborted(signalScope.signal);
        if (actual !== expected) {
            throw new ManagedCliInstallError(
                `Checksum mismatch for ${target.assetName}: expected ${expected}, received ${actual}.`,
                "checksumMismatch",
            );
        }
        if (platform !== "win32") {
            await chmod(binaryTemp, 0o755);
        }
        throwIfAborted(signalScope.signal);
        let backup: string | undefined;
        if (options.replaceExisting && platform === "win32" && (await isFile(destination))) {
            backup = `${binaryTemp}.previous`;
            await rename(destination, backup);
        }
        try {
            await rename(binaryTemp, destination);
        } catch (error) {
            if (backup) {
                await rename(backup, destination);
            }
            throw error;
        }
        if (backup) await rm(backup, { force: true });
        return { path: destination, version: options.version, assetName: target.assetName, reused: false };
    } catch (error) {
        if (signalScope.didTimeout()) {
            throw new ManagedCliInstallError(
                `Forma CLI installation timed out after ${String(timeoutMs)} ms.`,
                "timeout",
            );
        }
        if (signalScope.signal.aborted) {
            throw new ManagedCliInstallError("Forma CLI installation was cancelled.", "cancelled");
        }
        throw error;
    } finally {
        signalScope.dispose();
        await Promise.all([rm(binaryTemp, { force: true }), rm(checksumTemp, { force: true })]);
    }
}

async function subscribeToFlight(flight: InstallFlight, signal?: AbortSignal): Promise<ManagedCliInstallation> {
    if (signal?.aborted) {
        throw abortError(signal.reason);
    }
    flight.subscribers += 1;
    let released = false;
    const release = (): void => {
        if (released) {
            return;
        }
        released = true;
        flight.subscribers -= 1;
        if (flight.subscribers === 0 && !flight.settled) {
            flight.controller.abort();
        }
    };

    if (!signal) {
        try {
            return await flight.promise;
        } finally {
            release();
        }
    }

    return await new Promise<ManagedCliInstallation>((resolve, reject) => {
        const cancelled = (): void => {
            release();
            reject(abortError(signal.reason));
        };
        signal.addEventListener("abort", cancelled, { once: true });
        void flight.promise.then(
            (result) => {
                signal.removeEventListener("abort", cancelled);
                release();
                resolve(result);
            },
            (error: unknown) => {
                signal.removeEventListener("abort", cancelled);
                release();
                reject(error instanceof Error ? error : new Error(String(error)));
            },
        );
    });
}

function deadlineSignal(
    parent: AbortSignal,
    timeoutMs: number,
): {
    signal: AbortSignal;
    didTimeout: () => boolean;
    dispose: () => void;
} {
    const controller = new AbortController();
    let timedOut = false;
    const cancel = (): void => {
        controller.abort(parent.reason);
    };
    parent.addEventListener("abort", cancel, { once: true });
    if (parent.aborted) {
        cancel();
    }
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    return {
        signal: controller.signal,
        didTimeout: () => timedOut,
        dispose: () => {
            clearTimeout(timeout);
            parent.removeEventListener("abort", cancel);
        },
    };
}

function parseChecksum(contents: string, expectedAssetName: string): string {
    const line = contents.trim();
    const match = /^([a-fA-F0-9]{64})(?:\s+\*?(.+))?$/u.exec(line);
    if (!match?.[1]) {
        throw new ManagedCliInstallError("The Forma CLI checksum file is invalid.", "invalidChecksum");
    }
    const namedAsset = match[2]?.trim();
    if (namedAsset && basename(namedAsset) !== expectedAssetName) {
        throw new ManagedCliInstallError(
            `The checksum is for ${basename(namedAsset)}, not ${expectedAssetName}.`,
            "invalidChecksum",
        );
    }
    return match[1].toLowerCase();
}

async function sha256(path: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) {
        hash.update(chunk as Buffer);
    }
    return hash.digest("hex");
}

async function writeAll(file: Awaited<ReturnType<typeof open>>, chunk: Uint8Array): Promise<void> {
    let offset = 0;
    while (offset < chunk.byteLength) {
        const result = await file.write(chunk, offset, chunk.byteLength - offset);
        offset += result.bytesWritten;
    }
}

async function isFile(path: string): Promise<boolean> {
    try {
        return (await stat(path)).isFile();
    } catch {
        return false;
    }
}

function storagePath(storage: ManagedCliStorage): string {
    return typeof storage === "string" ? storage : storage.fsPath;
}

function validateVersion(version: string): void {
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(version)) {
        throw new ManagedCliInstallError(`Invalid Forma version: ${version}`, "invalidVersion");
    }
}

function abortError(reason: unknown): DOMException {
    return new DOMException(typeof reason === "string" ? reason : "The operation was aborted.", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw abortError(signal.reason);
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
