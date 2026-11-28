import { runReleaseVersionCommand } from "./release-version.mjs";

process.exitCode = await runReleaseVersionCommand("set", process.argv.slice(2));
