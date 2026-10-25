import assert from "node:assert/strict";
import { mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { describeBrowserEvidenceError, writeBrowserEvidence } from "./markdown-browser-evidence.mjs";

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

test("readers see the last complete journal while its replacement is being written", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        let resume;
        let notify;
        const paused = new Promise((resolve) => (notify = resolve));
        const release = new Promise((resolve) => (resume = resolve));
        const io = {
            writeFile: async (path, contents) => {
                await writeFile(path, "partial");
                notify();
                await release;
                await writeFile(path, contents);
            },
            rename,
            rm,
        };
        const writing = writeBrowserEvidence(file, ["webapp", "static"], { io });
        try {
            await Promise.race([
                paused,
                writing.then(() => {
                    throw new Error("writer completed before pause");
                }),
            ]);
            assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
        } finally {
            resume();
            await writing;
        }
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp", "static"]);
        await assert.rejects(stat(file + ".pending"), { code: "ENOENT" });
    }));

test("serialization failures cannot replace the existing journal", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        const circular = {};
        circular.self = circular;
        await assert.rejects(writeBrowserEvidence(file, circular), /circular/i);
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
        await assert.rejects(stat(file + ".pending"), { code: "ENOENT" });
    }));

test("write and pending-cleanup failures both remain visible", () =>
    fixture(async (file) => {
        await writeFile(file, JSON.stringify(["webapp"]));
        const writeError = new Error("write failed");
        const cleanupError = new Error("cleanup failed");
        const io = {
            writeFile: async (path) => {
                await writeFile(path, "partial");
                throw writeError;
            },
            rename,
            rm: async () => {
                throw cleanupError;
            },
        };
        await assert.rejects(writeBrowserEvidence(file, ["webapp", "static"], { io }), (error) => {
            assert(error instanceof AggregateError);
            assert.deepEqual(error.errors, [writeError, cleanupError]);
            return true;
        });
        assert.deepEqual(JSON.parse(await readFile(file, "utf8")), ["webapp"]);
        // The injected filesystem refuses cleanup; it must be reported as failure.
        await rm(file + ".pending");
    }));

test("pending-cleanup failure cannot leave a success record published", () =>
    fixture(async (file) => {
        const cleanupError = new Error("pending cleanup failed");
        const io = {
            writeFile,
            rename,
            rm: async (path, options) => {
                if (path.endsWith(".pending")) throw cleanupError;
                await rm(path, options);
            },
        };
        await assert.rejects(
            writeBrowserEvidence(file, { status: "passed" }, { discardOnAbort: true, io }),
            (error) => error === cleanupError,
        );
        await assert.rejects(stat(file), { code: "ENOENT" });
    }));

test("failure evidence retains every aggregated cause", () => {
    const error = new AggregateError(
        [new Error("primary write failure"), new Error("pending cleanup failure")],
        "evidence failed",
    );
    const description = describeBrowserEvidenceError(error);
    assert.match(description, /primary write failure/);
    assert.match(description, /pending cleanup failure/);
});

test("nested and cyclic error causes cannot hide failures or recurse forever", () => {
    const error = new Error("outer");
    error.cause = new AggregateError([new Error("inner"), error], "nested");
    const description = describeBrowserEvidenceError(error);
    assert.match(description, /outer/);
    assert.match(description, /inner/);
    assert.match(description, /already reported/);
    assert.equal(describeBrowserEvidenceError("plain failure"), "plain failure");
});
