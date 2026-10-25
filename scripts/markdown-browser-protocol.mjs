export function markdownBrowserPhases(hosts, readingCount, calloutCount) {
    if (
        hosts.length !== 2 ||
        new Set(hosts.map((host) => host.name)).size !== 2 ||
        !hosts.some((host) => host.name === "webapp") ||
        !hosts.some((host) => host.name === "static")
    )
        throw new Error("Browser plan requires one WebApp and one static host");
    if (![readingCount, calloutCount].every((count) => Number.isInteger(count) && count > 0))
        throw new Error("Browser plan requires nonempty syntax and callout cases");
    const enhanced = (host) => [
        `${host.name}: ordinary images and authored fragment link`,
        `${host.name}: authored page and external image links`,
        ...(host.name === "static" ? ["static: raw source navigation beside sidecar"] : []),
        `${host.name}: P1 syntax ${readingCount} cases, combined reading and themes`,
        `${host.name}: formatted callout samples and ${calloutCount} exact source cases`,
        `${host.name}: callout disclosure, rich header, navigation, focus and responsive themes`,
        `${host.name}: Mermaid focus restoration`,
        `${host.name}: Graph selection and focus retained`,
    ];
    const phases = ["webapp", "static"].map((name) => {
        const host = hosts.find((host) => host.name === name);
        return { name, mode: "enhanced", hosts: [host], expectedResults: enhanced(host) };
    });
    phases.push({
        name: "noscript",
        mode: "noscript",
        hosts: [hosts.find((host) => host.name === "static")],
        expectedResults: [
            "static noscript: images, authored link, Mermaid source and Graph navigation",
            "static noscript: raw source navigation beside sidecar",
            `static noscript: P1 syntax ${readingCount} cases and readable formula fallback`,
            `static noscript: formatted callout samples and ${calloutCount} exact source cases`,
            "static noscript: callout defaults, pointer/keyboard and header links",
        ],
    });
    return phases;
}

export function validateMarkdownBrowserPhase(result, phase) {
    if (
        result?.status !== "FORMA_MARKDOWN_BROWSER_PASSED" ||
        !Array.isArray(result.results) ||
        !phase.expectedResults?.length ||
        JSON.stringify(result.results) !== JSON.stringify(phase.expectedResults)
    )
        throw new Error(`Browser phase ${phase.name} did not report its complete expected coverage`);
    return result;
}

export function parseMarkdownBrowserPhase(output, phase) {
    if (/^### Error(?:\r?\n|$)/mu.test(output)) throw new Error(`Browser phase ${phase.name}: ${output}`);
    const reports = [...output.matchAll(/^### Result\s*\n([^\n]+)/gmu)];
    if (reports.length !== 1) throw new Error(`Browser phase ${phase.name} must report exactly one result`);
    return validateMarkdownBrowserPhase(JSON.parse(reports[0][1]), phase);
}
