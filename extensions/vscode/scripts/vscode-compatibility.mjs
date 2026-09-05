import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const match = /^\^(\d+\.\d+\.\d+)$/u.exec(manifest.engines.vscode);
if (!match) throw new Error("engines.vscode must declare a concrete caret minimum, such as ^1.123.2.");

export const minimumVSCodeVersion = match[1];
