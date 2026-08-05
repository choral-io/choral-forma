import { readFileSync } from "node:fs";

import { classifyAcknowledgement } from "../src/ack-window.mjs";

function parseArgs(argv) {
    const values = {};
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (!argument.startsWith("--")) {
            throw new Error(`unexpected argument ${argument}`);
        }
        const key = argument.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`missing value for --${key}`);
        }
        values[key] = value;
        index += 1;
    }
    return values;
}

function readJson(path, label) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
        throw new Error(`invalid ${label}: ${error.message}`);
    }
}

function validate(config, input) {
    if (typeof config.profile !== "string") throw new Error("config.profile is required");
    if (!Number.isFinite(config.ackWindowSeconds) || config.ackWindowSeconds < 0) {
        throw new Error("config.ackWindowSeconds must be a non-negative number");
    }
    if (typeof config.rejectReplay !== "boolean") throw new Error("config.rejectReplay must be boolean");
    if (!Array.isArray(input.cases) || input.cases.length === 0) throw new Error("input.cases must be non-empty");
}

try {
    const argumentsMap = parseArgs(process.argv.slice(2));
    if (!argumentsMap.config || !argumentsMap.input) {
        throw new Error("usage: run-regression.mjs --config <path> --input <path>");
    }

    const config = readJson(argumentsMap.config, "config");
    const input = readJson(argumentsMap.input, "input");
    validate(config, input);

    let passed = 0;
    let failed = 0;
    for (const event of input.cases) {
        const result = classifyAcknowledgement(event, config);
        if (result.decision === event.expected) {
            passed += 1;
        } else {
            failed += 1;
        }
    }

    console.log(
        `fixture=ack-window profile=${config.profile} cases=${input.cases.length} passed=${passed} failed=${failed}`,
    );
    process.exitCode = failed === 0 ? 0 : 1;
} catch (error) {
    console.error(`fixture=ack-window status=error message=${error.message}`);
    process.exitCode = 1;
}
