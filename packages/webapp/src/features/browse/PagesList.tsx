import { Link } from "react-router";

import type { DashboardEntry } from "@/data/workspace-client";
import { formatAbsoluteDateTime } from "@/lib/date-time";

export function PagesList({ entries }: { entries: DashboardEntry[] }) {
    return (
        <nav aria-label="Matching content" className="divide-y divide-base-300 border-y border-base-300">
            {entries.map((entry) => (
                <EntryRow entry={entry} key={entry.path} />
            ))}
        </nav>
    );
}

function EntryRow({ entry }: { entry: DashboardEntry }) {
    return (
        <Link
            className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 outline-none hover:bg-base-200/50 focus-visible:bg-base-200/50"
            to={entry.routePath}
        >
            <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium" title={entry.title}>
                    {entry.title}
                </h3>
                <p className="truncate text-sm text-base-content/60" title={entry.summary}>
                    {entry.summary}
                </p>
                <code className="mt-2 block truncate text-xs text-base-content/60" title={entry.path}>
                    {entry.path}
                </code>
            </div>
            <span className="shrink-0 text-xs text-base-content/60" title={formatAbsoluteDateTime(entry.updatedAt)}>
                {entry.updatedLabel}
            </span>
        </Link>
    );
}
