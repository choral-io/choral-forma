import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const output = resolve(process.env.VSIX_OUT ?? `${tmpdir()}/forma-0.1.0-alpha.13.vsix`);
await mkdir(dirname(output), { recursive: true });

const command = process.platform === "win32" ? "vsce.cmd" : "vsce";
const child = spawn(command, ["package", "--no-dependencies", "--out", output], {
    stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
