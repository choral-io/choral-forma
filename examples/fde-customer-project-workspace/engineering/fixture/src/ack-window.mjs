export function classifyAcknowledgement(event, config) {
    if (!Number.isFinite(event.delaySeconds)) {
        throw new Error(`invalid delaySeconds for ${event.id}`);
    }

    if (event.replayed && config.rejectReplay) {
        return { decision: "rejected", reason: "replay" };
    }

    if (event.delaySeconds > config.ackWindowSeconds) {
        return { decision: "rejected", reason: "outside-window" };
    }

    return { decision: "accepted", reason: "within-window" };
}
