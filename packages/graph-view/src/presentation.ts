export type GraphSummaryPresentation = {
    fingerprint: string;
    title: string;
    path: string;
    links: string;
};

export type GraphExpandPresentation = {
    ariaLabel: string;
    title: string;
};

export function graphExpandPresentation(expanded: boolean): GraphExpandPresentation {
    const label = expanded ? "Exit expanded graph" : "Expand graph";
    return { ariaLabel: label, title: label };
}

export function graphSummaryPresentation(
    selected: { title?: string; path: string } | undefined,
    adjacentCount: number,
): GraphSummaryPresentation | undefined {
    if (!selected) return undefined;
    const title = selected.title ?? selected.path;
    const links = `${String(adjacentCount)} linked`;
    return {
        fingerprint: JSON.stringify([selected.path, title, links]),
        title,
        path: selected.path,
        links,
    };
}
