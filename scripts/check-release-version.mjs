import { runReleaseVersionCommand } from "./release-version.mjs";

process.exitCode = await runReleaseVersionCommand("check", process.argv.slice(2));
