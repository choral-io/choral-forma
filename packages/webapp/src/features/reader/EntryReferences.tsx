import { Link } from "react-router";

import type { DashboardEntry, DashboardEntryLink } from "@/data/workspace-client";

export function EntryReferencesSection({ entry }: { entry: DashboardEntry }) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h2 className="text-sm font-semibold">References</h2>
                <p className="mt-1 text-sm/6 text-base-content/60">
                    Explicit links from Markdown and wikilink indexing.
                </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <OutgoingReferenceGroup links={entry.relations.outgoing} />
                <ReferenceGroup
                    emptyLabel="No backlinks indexed."
                    label="Backlinks"
                    links={entry.relations.backlinks}
                />
            </div>
        </section>
    );
}

function OutgoingReferenceGroup({ links }: { links: DashboardEntryLink[] }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Outgoing</span>
                <span className="badge badge-outline">{links.length}</span>
            </div>
            {links.length > 0 ? (
                <ReferenceList links={links} />
            ) : (
                <p className="text-sm text-base-content/60">No outgoing links indexed.</p>
            )}
        </div>
    );
}

function ReferenceGroup({
    emptyLabel,
    label,
    links,
}: {
    emptyLabel: string;
    label: string;
    links: DashboardEntryLink[];
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{label}</span>
                <span className="badge badge-outline">{links.length}</span>
            </div>
            {links.length > 0 ? (
                <ReferenceList links={links} />
            ) : (
                <p className="text-sm text-base-content/60">{emptyLabel}</p>
            )}
        </div>
    );
}

function ReferenceList({ links }: { links: DashboardEntryLink[] }) {
    if (links.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-1">
            {links.map((link) => (
                <RelationLink
                    key={`reference-${link.targetPath}`}
                    kind={link.kind}
                    label={link.label}
                    targetEntryId={link.targetEntryId}
                    targetRoutePath={link.targetRoutePath}
                    targetPath={link.targetPath}
                />
            ))}
        </div>
    );
}

function RelationLink({
    kind,
    label,
    targetEntryId,
    targetRoutePath,
    targetPath,
}: {
    kind: DashboardEntryLink["kind"];
    label: string;
    targetEntryId?: string;
    targetRoutePath?: string;
    targetPath: string;
}) {
    const content = (
        <>
            <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate" data-link-kind={kind === "external" ? "external" : undefined}>
                    {label}
                </span>
                <ReferenceKindIndicator kind={kind} />
            </span>
            <span className="truncate text-xs text-base-content/60" title={targetPath}>
                {targetPath}
            </span>
        </>
    );

    if (kind === "external") {
        return (
            <a
                className="flex min-w-0 flex-col rounded-lg border border-base-300/80 bg-base-100/60 px-3 py-2 text-sm transition-colors outline-none hover:bg-base-200/50 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/50"
                href={targetPath}
                aria-label={`${label} (opens in a new tab)`}
                rel="noreferrer"
                target="_blank"
            >
                {content}
            </a>
        );
    }

    if (!targetEntryId || !targetRoutePath) {
        return (
            <div className="flex min-w-0 flex-col rounded-lg border border-base-300/80 bg-base-100/60 px-3 py-2 text-sm">
                {content}
            </div>
        );
    }

    return (
        <Link
            className="flex min-w-0 flex-col rounded-lg border border-base-300/80 bg-base-100/60 px-3 py-2 text-sm outline-none hover:bg-base-200 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/50"
            to={targetRoutePath}
        >
            {content}
        </Link>
    );
}

function ReferenceKindIndicator({ kind }: { kind: DashboardEntryLink["kind"] }) {
    if (kind !== "unresolved") {
        return null;
    }

    return <span className="badge shrink-0 badge-warning">{kind}</span>;
}
