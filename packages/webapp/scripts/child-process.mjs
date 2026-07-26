import { once } from "node:events";

export async function terminateChildProcess(child) {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    const closed = once(child, "close");
    child.kill("SIGTERM");
    await closed;
}
