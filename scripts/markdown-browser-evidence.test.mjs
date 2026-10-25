import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeBrowserEvidence } from "./markdown-browser-evidence.mjs";

const fixture = async (run) => {
    const root = await mkdtemp(join(tmpdir(), "forma-browser-evidence-"));
    try {
        await run(join(root, "record.json"));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
};
test("interrupted writes cannot publish a successful result", () =>
    fixture(async (file) => {
        const controller = new AbortController();
        const io = {
            writeFile: async (...args) => {
                await writeFile(...args);
                controller.abort(new Error("interrupted during write"));
            },
            rename,
            rm,
        };
        await assert.rejects(
            writeBrowserEvidence(file, { status: "passed" }, { signal: controller.signal, discardOnAbort: true, io }),
        );
        await assert.rejects(stat(file), { code: "ENOENT" });
    }));
test("failed writes keep the last complete stage record", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        const io = {
            writeFile: async (path) => {
                await writeFile(path, "partial");
                throw new Error("write failed");
            },
            rename,
            rm,
        };
        await assert.rejects(writeBrowserEvidence(file, ["webapp", "static"], { io }), /write failed/);
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
        await assert.rejects(stat(file + ".pending"), { code: "ENOENT" });
    }));
test("successful writes atomically replace the stage journal", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        await writeBrowserEvidence(file, ["webapp", "static"]);
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp", "static"]);
        await assert.rejects(stat(file + ".pending"), { code: "ENOENT" });
    }));
for (const discardOnAbort of [false, true])
    test(`abort after rename preserves only valid journals (${discardOnAbort})`, () =>
        fixture(async (file) => {
            const controller = new AbortController();
            const io = {
                writeFile,
                rename: async (...args) => {
                    await rename(...args);
                    controller.abort(new Error("after rename"));
                },
                rm,
            };
            await assert.rejects(
                writeBrowserEvidence(file, ["webapp"], { signal: controller.signal, discardOnAbort, io }),
                /after rename/,
            );
            if (discardOnAbort) await assert.rejects(stat(file), { code: "ENOENT" });
            else assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
        }));
test("abort during pending cleanup cannot retain overall success", () =>
    fixture(async (file) => {
        const controller = new AbortController();
        const io = {
            writeFile,
            rename,
            rm: async (...args) => {
                await rm(...args);
                if (args[0].endsWith(".pending")) controller.abort(new Error("late abort"));
            },
        };
        await assert.rejects(
            writeBrowserEvidence(file, { status: "passed" }, { signal: controller.signal, discardOnAbort: true, io }),
            /late abort/,
        );
        await assert.rejects(stat(file), { code: "ENOENT" });
    }));
test("rename failure preserves prior journal and removes pending file", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        const io = {
            writeFile,
            rename: async () => {
                throw new Error("rename failed");
            },
            rm,
        };
        await assert.rejects(writeBrowserEvidence(file, ["webapp", "static"], { io }), /rename failed/);
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
        await assert.rejects(stat(file + ".pending"), { code: "ENOENT" });
    }));
test("pre-aborted writes do not touch the previous record", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        const controller = new AbortController();
        controller.abort(new Error("already aborted"));
        await assert.rejects(
            writeBrowserEvidence(file, ["webapp", "static"], { signal: controller.signal }),
            /already aborted/,
        );
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
    }));
