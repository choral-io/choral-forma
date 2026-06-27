import { AlertTriangle, Info } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import type { DashboardDiagnostic, DashboardHealth, DashboardHealthCategory } from "@/data/workspace-client";

export function DiagnosticsPanel({
    description = "Read-only signals from workspace checks and planned V2 surfaces.",
    diagnostics,
    emptyLabel = "No diagnostics found.",
    title = "Workspace Health",
}: {
    description?: string;
    diagnostics: DashboardDiagnostic[];
    emptyLabel?: string;
    title?: string;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-muted-foreground mt-1 text-sm/6">{description}</p>
            </div>
            <div className="flex flex-col gap-2">
                {diagnostics.length > 0 ? (
                    diagnostics.map((diagnostic) => (
                        <article
                            className="border-border/80 bg-background/60 flex gap-3 rounded-lg border p-3"
                            key={`${diagnostic.code}-${diagnostic.path ?? diagnostic.message}`}
                        >
                            <div className="text-muted-foreground mt-0.5">
                                {diagnostic.severity === "info" ? (
                                    <Info data-icon="inline-start" />
                                ) : (
                                    <AlertTriangle data-icon="inline-start" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant={
                                            diagnostic.severity === "warning"
                                                ? "secondary"
                                                : diagnostic.severity === "error"
                                                  ? "destructive"
                                                  : "secondary"
                                        }
                                    >
                                        {diagnostic.code}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs">{diagnostic.severity}</span>
                                </div>
                                <p className="mt-2 text-sm/6">{diagnostic.message}</p>
                                {diagnostic.path && (
                                    <code
                                        className="text-muted-foreground mt-2 block truncate text-xs"
                                        title={diagnostic.path}
                                    >
                                        {diagnostic.path}
                                    </code>
                                )}
                                <DiagnosticDetailList diagnostic={diagnostic} />
                            </div>
                        </article>
                    ))
                ) : (
                    <p className="text-muted-foreground text-sm">{emptyLabel}</p>
                )}
            </div>
        </section>
    );
}

export function WorkspaceHealthPanel({ health }: { health: DashboardHealth }) {
    const groups = healthCategoryOrder
        .map((category) => ({
            category,
            findings: health.findings.filter((finding) => finding.category === category),
        }))
        .filter((group) => group.findings.length > 0);

    return (
        <section className="flex flex-col gap-4">
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">Workspace Health</h2>
                    <Badge variant={health.status === "failed" ? "destructive" : "secondary"}>{health.status}</Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm/6">
                    Read-only findings from workspace diagnostics, references, and link structure.
                </p>
            </div>

            {groups.length > 0 ? (
                <div className="flex flex-col gap-4">
                    {groups.map((group) => (
                        <section className="flex flex-col gap-2" key={group.category}>
                            <div>
                                <h3 className="text-sm font-medium">{healthCategoryLabels[group.category]}</h3>
                                <p className="text-muted-foreground mt-0.5 text-xs/5">
                                    {healthCategoryDescriptions[group.category]}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {group.findings.map((finding) => (
                                    <article
                                        className="border-border/80 bg-background/60 flex gap-3 rounded-lg border p-3"
                                        key={`${finding.category}-${finding.path}-${finding.target ?? finding.message}`}
                                    >
                                        <div className="text-muted-foreground mt-0.5">
                                            {finding.severity === "info" ? (
                                                <Info data-icon="inline-start" />
                                            ) : (
                                                <AlertTriangle data-icon="inline-start" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={finding.severity === "error" ? "destructive" : "secondary"}
                                                >
                                                    {finding.severity}
                                                </Badge>
                                                <span className="text-muted-foreground text-xs">
                                                    {healthCategoryLabels[finding.category]}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm/6">{finding.message}</p>
                                            {finding.routePath ? (
                                                <Link
                                                    className="text-primary mt-2 block truncate text-xs underline-offset-4 hover:underline"
                                                    title={finding.path}
                                                    to={finding.routePath}
                                                >
                                                    {finding.title ?? finding.path}
                                                </Link>
                                            ) : (
                                                <code
                                                    className="text-muted-foreground mt-2 block truncate text-xs"
                                                    title={finding.path}
                                                >
                                                    {finding.path}
                                                </code>
                                            )}
                                            {finding.target ? (
                                                <code
                                                    className="text-muted-foreground mt-1 block truncate text-xs"
                                                    title={finding.target}
                                                >
                                                    Target: {finding.target}
                                                </code>
                                            ) : null}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">No health findings found.</p>
            )}
        </section>
    );
}

const healthCategoryOrder: DashboardHealthCategory[] = [
    "configDiagnostic",
    "brokenReference",
    "ambiguousReference",
    "noOutgoingReferences",
    "noBacklinks",
];

const healthCategoryLabels: Record<DashboardHealthCategory, string> = {
    ambiguousReference: "Ambiguous references",
    brokenReference: "Broken references",
    configDiagnostic: "Discovery and config",
    noBacklinks: "No backlinks",
    noOutgoingReferences: "No outgoing references",
};

const healthCategoryDescriptions: Record<DashboardHealthCategory, string> = {
    ambiguousReference: "References that resolve to more than one workspace entry.",
    brokenReference: "References that cannot be resolved by the current read model.",
    configDiagnostic: "Workspace, schema, space, taxonomy, view, or discovery diagnostics.",
    noBacklinks: "Entries that are not referenced by another internal page.",
    noOutgoingReferences: "Entries that do not link to another internal page.",
};

function DiagnosticDetailList({ diagnostic }: { diagnostic: DashboardDiagnostic }) {
    const location = formatDiagnosticLocation(diagnostic);
    const actual = formatDiagnosticValue(diagnostic.actual);
    const expected = formatDiagnosticValue(diagnostic.expected);

    if (!location && !actual && !expected) {
        return null;
    }

    return (
        <dl className="text-muted-foreground mt-3 grid gap-1 text-xs">
            {location ? (
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                    <dt>Location</dt>
                    <dd className="truncate" title={location}>
                        {location}
                    </dd>
                </div>
            ) : null}
            {actual ? (
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                    <dt>Actual</dt>
                    <dd className="truncate" title={actual}>
                        {actual}
                    </dd>
                </div>
            ) : null}
            {expected ? (
                <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                    <dt>Expected</dt>
                    <dd className="truncate" title={expected}>
                        {expected}
                    </dd>
                </div>
            ) : null}
        </dl>
    );
}

function formatDiagnosticLocation(diagnostic: DashboardDiagnostic) {
    const { location } = diagnostic;
    if (!location) {
        return "";
    }

    if (location.kind === "body") {
        const parts = [
            location.line === undefined ? "" : `line ${String(location.line)}`,
            location.column === undefined ? "" : `column ${String(location.column)}`,
        ].filter(Boolean);

        return parts.length > 0 ? parts.join(", ") : "body";
    }

    if (location.kind === "frontmatter") {
        const field = location.field ?? "$";
        const index = location.index === undefined ? "" : `[${String(location.index)}]`;

        return `frontmatter.${field}${index}`;
    }

    if (location.kind === "config") {
        return `config.${location.field ?? "$"}`;
    }

    return "file";
}

function formatDiagnosticValue(value: unknown) {
    if (value === undefined || value === null) {
        return "";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    return JSON.stringify(value);
}
