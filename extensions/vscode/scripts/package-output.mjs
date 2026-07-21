import { resolve } from "node:path";

export function resolveVsixOutput({ manifest, override, temporaryDirectory }) {
    return resolve(override ?? `${temporaryDirectory}/${manifest.name}-${manifest.version}.vsix`);
}
