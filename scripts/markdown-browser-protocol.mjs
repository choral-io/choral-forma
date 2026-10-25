export function markdownBrowserPhases(hosts, sourceIds) {
    if (
        hosts.length !== 2 ||
        new Set(hosts.map((host) => host.name)).size !== 2 ||
        !hosts.some((host) => host.name === "webapp") ||
        !hosts.some((host) => host.name === "static")
    )
        throw new Error("Browser plan requires one WebApp and one static host");
    const families = ["callouts", "disclosures", "reading"];
    if (
        !sourceIds ||
        typeof sourceIds !== "object" ||
        Array.isArray(sourceIds) ||
        JSON.stringify(Object.keys(sourceIds).sort()) !== JSON.stringify(families) ||
        !families.every(
            (family) =>
                Array.isArray(sourceIds[family]) &&
                sourceIds[family].length > 0 &&
                Array.from(sourceIds[family]).every((id) => typeof id === "string" && id.length > 0) &&
                new Set(sourceIds[family]).size === sourceIds[family].length,
        )
    )
        throw new Error("Browser plan requires complete unique source-case IDs for every family");
    const readingCount = sourceIds.reading.length,
        calloutCount = sourceIds.callouts.length;
    const expected = (families) => Object.fromEntries(families.map((family) => [family, [...sourceIds[family]]]));
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
        return {
            name,
            mode: "enhanced",
            hosts: [host],
            expectedResults: enhanced(host),
            expectedSourceCases: expected(["reading", "callouts"]),
        };
    });
    phases.push({
        name: "noscript",
        mode: "noscript",
        expectedSourceCases: expected(["reading", "callouts"]),
        hosts: [hosts.find((host) => host.name === "static")],
        expectedResults: [
            "static noscript: images, authored link, Mermaid source and Graph navigation",
            "static noscript: raw source navigation beside sidecar",
            `static noscript: P1 syntax ${readingCount} cases and readable formula fallback`,
            `static noscript: formatted callout samples and ${calloutCount} exact source cases`,
            "static noscript: callout defaults, pointer/keyboard and header links",
        ],
    });
    const disclosures = ["webapp", "static", "noscript"].map((name) => ({
        name: `${name}-disclosures`,
        mode: "disclosures",
        expectedSourceCases: expected(["disclosures"]),
        noScript: name === "noscript",
        hosts: [hosts.find((host) => host.name === (name === "noscript" ? "static" : name))],
        expectedResults: [
            name === "noscript"
                ? "static noscript: native disclosures and keyboard toggling"
                : `${name}: native disclosures, folding and navigation`,
        ],
    }));
    return [...disclosures, ...phases];
}

export function validateMarkdownBrowserPhase(result, phase) {
    if (
        result?.status !== "FORMA_MARKDOWN_BROWSER_PASSED" ||
        !Array.isArray(result.results) ||
        !phase.expectedResults?.length ||
        JSON.stringify(result.results) !== JSON.stringify(phase.expectedResults)
    )
        throw new Error(`Browser phase ${phase.name} did not report its complete expected coverage`);
    if (phase.expectedSourceCases) {
        const actual = result.sourceCases;
        if (
            !actual ||
            typeof actual !== "object" ||
            Array.isArray(actual) ||
            JSON.stringify(Object.keys(actual).sort()) !==
                JSON.stringify(Object.keys(phase.expectedSourceCases).sort()) ||
            !Object.entries(phase.expectedSourceCases).every(
                ([family, ids]) => JSON.stringify(actual[family]) === JSON.stringify(ids),
            )
        )
            throw new Error(`Browser phase ${phase.name} did not report complete source-case coverage`);
    }
    return result;
}

export function parseMarkdownBrowserPhase(output, phase) {
    if (/^### Error(?:\r?\n|$)/mu.test(output)) throw new Error(`Browser phase ${phase.name}: ${output}`);
    const reports = [...output.matchAll(/^### Result\s*\n([^\n]+)/gmu)];
    if (reports.length !== 1) throw new Error(`Browser phase ${phase.name} must report exactly one result`);
    return validateMarkdownBrowserPhase(JSON.parse(reports[0][1]), phase);
}
