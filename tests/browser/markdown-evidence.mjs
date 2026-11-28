export function describeBrowserEvidenceError(error, seen = new Set()) {
    if (seen.has(error)) return "[Error already reported]";
    seen.add(error);
    const description = error?.stack ?? String(error);
    const causes = error instanceof AggregateError ? [...error.errors] : [];
    if (error?.cause !== undefined && !causes.includes(error.cause)) causes.push(error.cause);
    return [description, ...causes.map((cause) => `Caused by:\n${describeBrowserEvidenceError(cause, seen)}`)].join(
        "\n",
    );
}
