import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname } from "node:path";

import { resolveVsixOutput } from "./package-output.mjs";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const output = resolveVsixOutput({
    manifest,
    override: process.env.VSIX_OUT,
    temporaryDirectory: tmpdir(),
});
await mkdir(dirname(output), { recursive: true });

const command = process.platform === "win32" ? "vsce.cmd" : "vsce";
const child = spawn(command, ["package", "--no-dependencies", "--out", output], {
    stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
