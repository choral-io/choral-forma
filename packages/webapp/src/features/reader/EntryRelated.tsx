import { WorkspaceLink as Link } from "@/app/workspace-navigation";
import { useId } from "react";

import type { DashboardEntry, DashboardEntryLink } from "@/data/workspace-client";

/** Whether an entry has any relation to list; the section is omitted otherwise. */
// eslint-disable-next-line react-refresh/only-export-components
export function hasRelatedDocuments(entry: DashboardEntry) {
    return entry.relations.backlinks.length > 0 || entry.relations.outgoing.length > 0;
}

export function EntryRelatedSection({ entry, sectionId }: { entry: DashboardEntry; sectionId: string }) {
    const headingId = useId();
    if (!hasRelatedDocuments(entry)) return null;

    return (
        <section
            aria-labelledby={headingId}
            className="flex scroll-m-8 flex-col gap-6 border-t border-base-300 pt-8"
            id={sectionId}
            tabIndex={-1}
        >
            <h2 className="text-xl font-semibold" id={headingId}>
                Related documents
            </h2>
            <RelationGroup label="Backlinks" links={entry.relations.backlinks} />
            <RelationGroup label="Outgoing references" links={entry.relations.outgoing} />
        </section>
    );
}

function RelationGroup({ label, links }: { label: string; links: DashboardEntryLink[] }) {
    const headingId = useId();
    if (links.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-medium text-base-content/70" id={headingId}>
                {label}
                <span className="badge badge-ghost badge-sm">{links.length}</span>
            </h3>
            <ul aria-labelledby={headingId} className="divide-y divide-base-300 border-y border-base-300">
                {links.map((link, index) => (
                    <li key={`${String(index)}-${link.targetPath}`}>
                        <RelationRow link={link} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

function RelationRow({ link }: { link: DashboardEntryLink }) {
    const rowClassName = "flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-1 py-2.5";
    const interactiveClassName =
        "outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50 focus-visible:ring-2 focus-visible:ring-primary/40";
    const content = (
        <>
            <span
                className="min-w-0 truncate font-medium"
                data-link-kind={link.kind === "external" ? "external" : undefined}
            >
                {link.label}
            </span>
            {link.kind === "unresolved" ? (
                <span className="badge shrink-0 badge-sm badge-warning">unresolved</span>
            ) : null}
            <span className="ms-auto min-w-0 truncate text-xs text-base-content/60" title={link.targetPath}>
                {link.targetPath}
            </span>
        </>
    );

    if (link.kind === "external") {
        return (
            <a
                aria-label={`${link.label} (opens in a new tab)`}
                className={`${rowClassName} ${interactiveClassName}`}
                href={link.targetPath}
                rel="noreferrer"
                target="_blank"
            >
                {content}
            </a>
        );
    }

    if (!link.targetRoutePath) {
        return <div className={rowClassName}>{content}</div>;
    }

    return (
        <Link className={`${rowClassName} ${interactiveClassName}`} to={link.targetRoutePath}>
            {content}
        </Link>
    );
}
