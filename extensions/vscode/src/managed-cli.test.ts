import { createHash } from "node:crypto";
import { rename as fsRename, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
    ManagedCliInstallError,
    createFetchDownloader,
    installManagedCli,
    managedCliPath,
    managedCliReleaseUrls,
    resolveManagedCliTarget,
    type ManagedCliCleanupFileOperations,
    type ManagedCliDownloader,
    type ManagedCliFetch,
    type ManagedCliReplacementFileOperations,
} from "./managed-cli.ts";

const VERSION = "0.1.0-alpha.17";
const BINARY = Buffer.from("test forma binary");
const HASH = createHash("sha256").update(BINARY).digest("hex");
const tempDirectories: string[] = [];

afterEach(async () => {
    const directories = tempDirectories.splice(0);
    await Promise.all(
        directories.map(async (directory) => {
            await rm(directory, { force: true, recursive: true });
        }),
    );
});

describe("managed CLI target resolution", () => {
    it.each([
        ["darwin", "arm64", "forma-macos-arm64", "forma"],
        ["darwin", "x64", "forma-macos-x64", "forma"],
        ["linux", "arm64", "forma-linux-arm64", "forma"],
        ["linux", "x64", "forma-linux-x64", "forma"],
        ["win32", "x64", "forma-windows-x64.exe", "forma.exe"],
    ] as const)("maps %s/%s", (platform, arch, assetName, binaryName) => {
        expect(
            resolveManagedCliTarget(
                platform,
                arch,
                platform === "linux" ? "glibc" : undefined,
                platform === "linux" ? "2.36" : undefined,
            ),
        ).toEqual({
            assetName,
            binaryName,
        });
    });

    it("rejects Linux musl with a clear error", () => {
        expect(() => resolveManagedCliTarget("linux", "x64", "musl")).toThrow(
            expect.objectContaining<Partial<ManagedCliInstallError>>({ kind: "unsupportedPlatform" }),
        );
        expect(() => resolveManagedCliTarget("linux", "x64", "musl")).toThrow(/musl/u);
    });

    it("rejects Linux GNU runtimes below the published glibc floor", () => {
        expect(() => resolveManagedCliTarget("linux", "x64", "glibc", "2.30")).toThrow(
            expect.objectContaining<Partial<ManagedCliInstallError>>({ kind: "incompatibleRuntime" }),
        );
        expect(() => resolveManagedCliTarget("linux", "x64", "glibc", "2.30")).toThrow(/glibc >= 2\.31.*2\.30/u);
    });

    it.each(["2.31", "2.36", "2.39"])("accepts Linux GNU glibc %s", (version) => {
        expect(resolveManagedCliTarget("linux", "x64", "glibc", version)).toEqual({
            assetName: "forma-linux-x64",
            binaryName: "forma",
        });
    });

    it.each([
        ["darwin", "ia32"],
        ["win32", "arm64"],
        ["freebsd", "x64"],
    ] as const)("rejects unsupported %s/%s", (platform, arch) => {
        expect(() => resolveManagedCliTarget(platform, arch)).toThrow(
            expect.objectContaining<Partial<ManagedCliInstallError>>({ kind: "unsupportedPlatform" }),
        );
    });
});

describe("managed CLI locations", () => {
    it("uses an exact release tag and sibling checksum", () => {
        const target = resolveManagedCliTarget("darwin", "arm64");
        expect(managedCliReleaseUrls(VERSION, target)).toEqual({
            binary: "https://github.com/choral-io/choral-forma/releases/download/v0.1.0-alpha.17/forma-macos-arm64",
            checksum:
                "https://github.com/choral-io/choral-forma/releases/download/v0.1.0-alpha.17/forma-macos-arm64.sha256",
        });
    });

    it("uses a deterministic versioned storage path", () => {
        expect(managedCliPath({ fsPath: "/storage" }, VERSION, "darwin")).toBe(
            join("/storage", "cli", VERSION, "forma"),
        );
        expect(managedCliPath("C:\\storage", VERSION, "win32")).toBe(join("C:\\storage", "cli", VERSION, "forma.exe"));
    });

    it("rejects versions that could escape the storage directory", () => {
        expect(() => managedCliPath("/storage", "../outside", "darwin")).toThrow(
            expect.objectContaining<Partial<ManagedCliInstallError>>({ kind: "invalidVersion" }),
        );
    });
});

describe("managed CLI installation", () => {
    it("does not start a download when the caller is already cancelled", async () => {
        const controller = new AbortController();
        controller.abort();
        const downloader = vi.fn<ManagedCliDownloader>();

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: "/unused",
                platform: "darwin",
                arch: "arm64",
                downloader,
                signal: controller.signal,
            }),
        ).rejects.toMatchObject({ name: "AbortError" });
        expect(downloader).not.toHaveBeenCalled();
    });

    it("downloads, verifies, chmods, and installs atomically", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const urls: string[] = [];
        const downloader = fixtureDownloader(urls);

        const result = await installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader,
        });

        expect(result).toEqual({
            path: join(storage, "cli", VERSION, "forma"),
            version: VERSION,
            assetName: "forma-macos-arm64",
            reused: false,
        });
        expect(await readFile(result.path)).toEqual(BINARY);
        expect((await stat(result.path)).mode & 0o111).toBe(0o111);
        expect(urls).toEqual([
            "https://github.com/choral-io/choral-forma/releases/download/v0.1.0-alpha.17/forma-macos-arm64",
            "https://github.com/choral-io/choral-forma/releases/download/v0.1.0-alpha.17/forma-macos-arm64.sha256",
        ]);
        expect(await readdir(join(storage, "cli", VERSION))).toEqual(["forma"]);
    });

    it("reuses an existing version without downloading", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const path = managedCliPath(storage, VERSION, "darwin");
        await import("node:fs/promises").then(async ({ mkdir }) => {
            await mkdir(join(path, ".."), { recursive: true });
        });
        await writeFile(path, BINARY);
        const downloader = vi.fn<ManagedCliDownloader>();

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
            }),
        ).resolves.toMatchObject({ path, reused: true });
        expect(downloader).not.toHaveBeenCalled();
    });

    it("replaces an existing managed binary when recovery requests a fresh download", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const path = managedCliPath(storage, VERSION, "darwin");
        await import("node:fs/promises").then(async ({ mkdir }) => {
            await mkdir(join(path, ".."), { recursive: true });
        });
        await writeFile(path, "stale binary");

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader: fixtureDownloader([]),
                replaceExisting: true,
            }),
        ).resolves.toMatchObject({ path, reused: false });
        expect(await readFile(path)).toEqual(BINARY);
    });

    it("succeeds on Windows when removal of the replaced backup keeps failing", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const path = managedCliPath(storage, VERSION, "win32");
        await import("node:fs/promises").then(async ({ mkdir }) => {
            await mkdir(join(path, ".."), { recursive: true });
        });
        await writeFile(path, "stale binary");
        const remove = vi
            .fn<ManagedCliReplacementFileOperations["remove"]>()
            .mockRejectedValue(Object.assign(new Error("busy"), { code: "EBUSY" }));

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "win32",
                arch: "x64",
                downloader: fixtureDownloader([], "forma-windows-x64.exe"),
                replaceExisting: true,
                replacementFileOperations: { rename: fsRename, remove },
            }),
        ).resolves.toMatchObject({ path, reused: false });
        expect(await readFile(path)).toEqual(BINARY);
        expect(remove).toHaveBeenCalledTimes(3);
    });

    it("restores the previous Windows binary when replacement fails", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const path = managedCliPath(storage, VERSION, "win32");
        await import("node:fs/promises").then(async ({ mkdir }) => {
            await mkdir(join(path, ".."), { recursive: true });
        });
        await writeFile(path, "stale binary");
        const rename = vi.fn<ManagedCliReplacementFileOperations["rename"]>(async (source, destination) => {
            if (destination === path && source.endsWith(".download")) {
                throw new Error("replacement failed");
            }
            await fsRename(source, destination);
        });
        const remove = vi.fn<ManagedCliReplacementFileOperations["remove"]>(async (target) => {
            await rm(target, { force: true });
        });

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "win32",
                arch: "x64",
                downloader: fixtureDownloader([], "forma-windows-x64.exe"),
                replaceExisting: true,
                replacementFileOperations: { rename, remove },
            }),
        ).rejects.toThrow("replacement failed");
        expect(await readFile(path, "utf8")).toBe("stale binary");
        expect(rename).toHaveBeenCalledTimes(3);
        expect(remove).not.toHaveBeenCalled();
    });

    it("preserves a successful installation when temporary-file cleanup fails", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const remove = vi
            .fn<ManagedCliCleanupFileOperations["remove"]>()
            .mockRejectedValue(Object.assign(new Error("busy"), { code: "EBUSY" }));

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader: fixtureDownloader([]),
                cleanupFileOperations: { remove },
            }),
        ).resolves.toMatchObject({ reused: false });
        expect(remove).toHaveBeenCalledTimes(6);
    });

    it("preserves the installation error when temporary-file cleanup also fails", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const remove = vi
            .fn<ManagedCliCleanupFileOperations["remove"]>()
            .mockRejectedValue(Object.assign(new Error("busy"), { code: "EBUSY" }));
        const downloader: ManagedCliDownloader = async ({ url, destination }) => {
            await writeFile(destination, url.endsWith(".sha256") ? `${"0".repeat(64)}  forma-macos-arm64` : BINARY);
            return BINARY.byteLength;
        };

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
                cleanupFileOperations: { remove },
            }),
        ).rejects.toMatchObject({ kind: "checksumMismatch" });
        expect(remove).toHaveBeenCalledTimes(6);
    });

    it("rejects a checksum mismatch and cleans temporary files", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const downloader: ManagedCliDownloader = async ({ url, destination }) => {
            await writeFile(destination, url.endsWith(".sha256") ? `${"0".repeat(64)}  forma-macos-arm64` : BINARY);
            return BINARY.byteLength;
        };

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
            }),
        ).rejects.toMatchObject({ kind: "checksumMismatch" });
        expect(await readdir(join(storage, "cli", VERSION))).toEqual([]);
    });

    it("rejects a checksum naming another asset", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const downloader: ManagedCliDownloader = async ({ url, destination }) => {
            await writeFile(destination, url.endsWith(".sha256") ? `${HASH}  another-binary` : BINARY);
            return BINARY.byteLength;
        };

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
            }),
        ).rejects.toMatchObject({ kind: "invalidChecksum" });
        expect(await readdir(join(storage, "cli", VERSION))).toEqual([]);
    });

    it("times out and cleans partial downloads", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const downloader: ManagedCliDownloader = async ({ destination, signal }) => {
            await writeFile(destination, "partial download");
            if (signal.aborted) throw new DOMException("timeout", "AbortError");
            return await new Promise<number>((_resolve, reject) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        reject(new DOMException("timeout", "AbortError"));
                    },
                    { once: true },
                );
            });
        };

        await expect(
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
                timeoutMs: 5,
            }),
        ).rejects.toMatchObject({ kind: "timeout" });
        expect(await readdir(join(storage, "cli", VERSION))).toEqual([]);
    });

    it("deduplicates concurrent installation requests", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const downloader = vi.fn(fixtureDownloader([]));

        const [first, second] = await Promise.all([
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
            }),
            installManagedCli({
                version: VERSION,
                globalStorage: storage,
                platform: "darwin",
                arch: "arm64",
                downloader,
            }),
        ]);

        expect(first).toEqual(second);
        expect(downloader).toHaveBeenCalledTimes(2);
    });

    it("allows one subscriber to cancel without cancelling shared work", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const controller = new AbortController();
        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const downloader: ManagedCliDownloader = async (request) => {
            await gate;
            return await fixtureDownloader([])(request);
        };
        const cancelled = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader,
            signal: controller.signal,
        });
        const active = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader,
        });
        controller.abort();
        release?.();

        await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
        await expect(active).resolves.toMatchObject({ reused: false });
    });

    it("aborts shared work and cleans partial files when the only subscriber cancels", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const controller = new AbortController();
        let started: (() => void) | undefined;
        const didStart = new Promise<void>((resolve) => (started = resolve));
        const downloader: ManagedCliDownloader = async ({ destination, signal }) => {
            await writeFile(destination, "partial download");
            started?.();
            return await new Promise<number>((_resolve, reject) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        reject(new DOMException("cancelled", "AbortError"));
                    },
                    { once: true },
                );
            });
        };
        const installation = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader,
            signal: controller.signal,
        });
        await didStart;
        controller.abort();

        await expect(installation).rejects.toMatchObject({ name: "AbortError" });
        await vi.waitFor(async () => {
            expect(await readdir(join(storage, "cli", VERSION))).toEqual([]);
        });
    });

    it("starts fresh work when retrying before an aborted flight settles", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const controller = new AbortController();
        let started: (() => void) | undefined;
        const didStart = new Promise<void>((resolve) => (started = resolve));
        let releaseAbortedFlight: (() => void) | undefined;
        const abortedFlightCanSettle = new Promise<void>((resolve) => (releaseAbortedFlight = resolve));
        const firstDownloader: ManagedCliDownloader = async ({ destination, signal }) => {
            await writeFile(destination, "partial download");
            started?.();
            await new Promise<void>((resolve) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        resolve();
                    },
                    { once: true },
                );
            });
            await abortedFlightCanSettle;
            throw new DOMException("cancelled", "AbortError");
        };
        const first = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader: firstDownloader,
            signal: controller.signal,
        });
        await didStart;
        controller.abort();
        await expect(first).rejects.toMatchObject({ name: "AbortError" });

        const retryDownloader = vi.fn(fixtureDownloader([]));
        const retry = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader: retryDownloader,
        });
        await Promise.resolve();
        expect(retryDownloader).not.toHaveBeenCalled();
        releaseAbortedFlight?.();

        await expect(retry).resolves.toMatchObject({ reused: false });
        expect(retryDownloader).toHaveBeenCalledTimes(2);
        expect(await readFile(managedCliPath(storage, VERSION, "darwin"))).toEqual(BINARY);
    });

    it("does not start a cancelled successor after its predecessor settles", async () => {
        const storage = await makeTempDirectory("forma-managed-cli-");
        const predecessorController = new AbortController();
        let started: (() => void) | undefined;
        const didStart = new Promise<void>((resolve) => (started = resolve));
        let releasePredecessor: (() => void) | undefined;
        const predecessorCanSettle = new Promise<void>((resolve) => (releasePredecessor = resolve));
        const predecessorDownloader: ManagedCliDownloader = async ({ destination, signal }) => {
            await writeFile(destination, "partial download");
            started?.();
            await new Promise<void>((resolve) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        resolve();
                    },
                    { once: true },
                );
            });
            await predecessorCanSettle;
            throw new DOMException("cancelled", "AbortError");
        };
        const predecessor = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader: predecessorDownloader,
            signal: predecessorController.signal,
        });
        await didStart;
        predecessorController.abort();
        await expect(predecessor).rejects.toMatchObject({ name: "AbortError" });

        const successorController = new AbortController();
        const successorDownloader = vi.fn(fixtureDownloader([]));
        const successor = installManagedCli({
            version: VERSION,
            globalStorage: storage,
            platform: "darwin",
            arch: "arm64",
            downloader: successorDownloader,
            signal: successorController.signal,
        });
        successorController.abort();
        await expect(successor).rejects.toMatchObject({ name: "AbortError" });
        releasePredecessor?.();
        await vi.waitFor(async () => {
            expect(await readdir(join(storage, "cli", VERSION))).toEqual([]);
        });
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(successorDownloader).not.toHaveBeenCalled();
    });
});

describe("fetch downloader", () => {
    it("rejects unsuccessful HTTP responses", async () => {
        const cancel = vi.fn().mockResolvedValue(undefined);
        const fetch = vi.fn<ManagedCliFetch>(async () => ({
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers: new Headers(),
            body: { cancel } as unknown as Response["body"],
        }));

        await expect(
            createFetchDownloader(fetch)({
                url: "https://example.test/missing",
                destination: "/unused",
                signal: new AbortController().signal,
                maxBytes: 8,
            }),
        ).rejects.toMatchObject({ kind: "downloadFailed" });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("rejects a response whose declared size exceeds the bound", async () => {
        const directory = await makeTempDirectory("forma-download-");
        const cancel = vi.fn().mockResolvedValue(undefined);
        const fetch = vi.fn<ManagedCliFetch>(async () => ({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers({ "content-length": "9" }),
            body: { cancel } as unknown as Response["body"],
        }));

        await expect(
            createFetchDownloader(fetch)({
                url: "https://example.test/forma",
                destination: join(directory, "download"),
                signal: new AbortController().signal,
                maxBytes: 8,
            }),
        ).rejects.toMatchObject({ kind: "downloadTooLarge" });
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("enforces the streaming size bound without Content-Length", async () => {
        const directory = await makeTempDirectory("forma-download-");
        const fetch = vi.fn<ManagedCliFetch>(async () => ({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            body: new Response("123456789").body,
        }));

        await expect(
            createFetchDownloader(fetch)({
                url: "https://example.test/forma",
                destination: join(directory, "download"),
                signal: new AbortController().signal,
                maxBytes: 8,
            }),
        ).rejects.toMatchObject({ kind: "downloadTooLarge" });
    });

    it("cancels and releases the response reader when writing fails", async () => {
        const directory = await makeTempDirectory("forma-download-");
        const read = vi.fn().mockResolvedValueOnce({ done: false, value: new Uint8Array([1]) });
        const cancel = vi.fn().mockResolvedValue(undefined);
        const releaseLock = vi.fn();
        const writeChunk = vi.fn().mockRejectedValue(new Error("write failed"));
        const fetch = vi.fn<ManagedCliFetch>(async () => ({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            body: {
                getReader: () => ({ read, cancel, releaseLock }),
            } as unknown as Response["body"],
        }));

        await expect(
            createFetchDownloader(
                fetch,
                writeChunk,
            )({
                url: "https://example.test/forma",
                destination: join(directory, "download"),
                signal: new AbortController().signal,
                maxBytes: 8,
            }),
        ).rejects.toThrow("write failed");
        expect(writeChunk).toHaveBeenCalledOnce();
        expect(cancel).toHaveBeenCalledOnce();
        expect(releaseLock).toHaveBeenCalledOnce();
    });
});

async function makeTempDirectory(prefix: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), prefix));
    tempDirectories.push(directory);
    return directory;
}

function fixtureDownloader(urls: string[], assetName = "forma-macos-arm64"): ManagedCliDownloader {
    return async ({ url, destination, signal, maxBytes }) => {
        if (signal.aborted) {
            throw new DOMException("cancelled", "AbortError");
        }
        const contents = url.endsWith(".sha256") ? Buffer.from(`${HASH}  ${assetName}`) : BINARY;
        if (contents.byteLength > maxBytes) {
            throw new ManagedCliInstallError("too large", "downloadTooLarge");
        }
        urls.push(url);
        await writeFile(destination, contents, { flag: "wx" });
        return contents.byteLength;
    };
}
