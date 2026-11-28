import assert from "node:assert/strict";

import { mermaidGeometryChecks } from "./markdown-mermaid-geometry.mjs";

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
        `${host.name}: long sidebar titles truncate without shifting the tree`,
        `${host.name}: directory page opened directly`,
        ...(host.name === "static"
            ? [
                  "static: mounted document retains identity, selection and links",
                  "static: direct Health and reserved segment routes",
                  "static: encoded canonical term URL enhances on direct load",
                  "static: encoded canonical View URL enhances and navigates on direct load",
              ]
            : []),
        `${host.name}: encoded source links and public routes retain their targets`,
        `${host.name}: reference links, wiki fragments and View anchors`,
        `${host.name}: Markdown link origins and encoded heading fragments`,
        ...(host.name === "static" ? ["static: resource query and fragment preserve URI semantics"] : []),
        `${host.name}: P1 syntax ${readingCount} cases, combined reading and themes`,
        `${host.name}: formatted callout samples and ${calloutCount} exact source cases`,
        `${host.name}: callout disclosure, rich header, navigation, focus and responsive themes`,
        `${host.name}: Mermaid five kinds, empty class, themes, responsive viewer and focus`,
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
            "static noscript: directory page listing",
            "static noscript: directory landing document links to children",
            "static noscript: direct Health and reserved segment routes",
            "static noscript: encoded source links and public routes retain their targets",
            "static noscript: reference links, wiki fragments and View anchors",
            "static noscript: Markdown link origins and encoded heading fragments",
            "static noscript: resource query and fragment preserve URI semantics",
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
    const navigation = ["webapp", "static", "noscript"].map((name) => {
        const noScript = name === "noscript";
        const host = hosts.find((host) => host.name === (noScript ? "static" : name));
        return {
            name: `${name}-navigation`,
            mode: "navigation",
            expectedSourceCases: {},
            noScript,
            hosts: [host],
            expectedResults: [
                ...(noScript
                    ? []
                    : [`${host.name}: narrow classifications keep punctuation with the term and fit the reader`]),
                `${noScript ? "static noscript" : host.name}: published anchors and authored heading links reach their targets`,
                `${noScript ? "static noscript" : host.name}: View projection and footnotes retain their fragment targets`,
                `${noScript ? "static noscript" : host.name}: author links open raw resources with URI suffixes`,
            ],
        };
    });
    const geometryHosts = ["webapp", "static"].map((name) => hosts.find((host) => host.name === name));
    const geometry = {
        name: "mermaid-geometry",
        mode: "mermaid-geometry",
        hosts: geometryHosts,
        expectedResults: geometryHosts.flatMap((host) =>
            mermaidGeometryChecks.map((check) => `${host.name}: ${check}`),
        ),
        expectedSourceCases: {},
    };
    return [geometry, ...disclosures, ...navigation, ...phases];
}

export function validateMarkdownBrowserPhase(result, phase) {
    assert.ok(phase.expectedResults?.length, `Browser phase ${phase.name} needs expected coverage`);
    assert.deepEqual(
        result?.results,
        phase.expectedResults,
        `Browser phase ${phase.name} did not report its complete expected coverage`,
    );
    if (phase.expectedSourceCases) {
        assert.deepEqual(
            result.sourceCases,
            phase.expectedSourceCases,
            `Browser phase ${phase.name} did not report complete source-case coverage`,
        );
    }
    return result;
}
