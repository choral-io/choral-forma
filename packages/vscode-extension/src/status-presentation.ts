import type { FormaRuntimeState } from "./runtime.ts";

export function statusText(state: FormaRuntimeState): string {
    switch (state.kind) {
        case "ready":
            return "$(pass-filled) Forma";
        case "checking":
            return "$(sync~spin) Forma";
        case "warning":
            return "$(warning) Forma";
        case "restricted":
            return "$(lock) Forma";
        case "binaryMissing":
        case "configuredWorkspaceMissing":
        case "failed":
        case "incompatible":
        case "invalidConfig":
            return "$(error) Forma";
        case "noWorkspace":
        case "unsupported":
            return "$(circle-slash) Forma";
    }
}
