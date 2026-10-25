import { rename, rm, writeFile } from "node:fs/promises";

/** Preserve the last complete journal; never retain interrupted overall success. */
export async function writeBrowserEvidence(
    file,
    value,
    { signal, discardOnAbort = false, io = { writeFile, rename, rm } } = {},
) {
    const pending = `${file}.pending`;
    const errors = [];
    let published = false;
    try {
        signal?.throwIfAborted();
        await io.writeFile(pending, JSON.stringify(value, null, 2));
        signal?.throwIfAborted();
        await io.rename(pending, file);
        published = true;
    } catch (error) {
        errors.push(error);
    }
    try {
        await io.rm(pending, { force: true });
    } catch (error) {
        errors.push(error);
    }
    if (signal?.aborted && !errors.includes(signal.reason)) errors.push(signal.reason);
    if (errors.length && published && discardOnAbort) {
        try {
            await io.rm(file, { force: true });
        } catch (error) {
            errors.push(error);
        }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, "Browser evidence could not be committed");
}
