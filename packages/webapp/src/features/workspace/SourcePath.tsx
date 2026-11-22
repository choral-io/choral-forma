import { Check, Copy, X } from "lucide-react";

import { WorkspaceLink as Link } from "@/app/workspace-navigation";
import { copySourcePath } from "@/lib/copy-source-path";
import { cn } from "@/lib/utils";

/** A copyable source path that can link to the document it identifies. */
export function SourcePath({ className, path, to }: { className?: string; path: string; to?: string }) {
    const label = (
        <code className="block min-w-0 truncate text-xs" title={path}>
            {path}
        </code>
    );
    return (
        <span className={cn("inline-flex max-w-full min-w-0 items-center gap-1", className)}>
            {to ? (
                <Link className="min-w-0 link link-hover" to={to}>
                    {label}
                </Link>
            ) : (
                label
            )}
            <button
                aria-label={`Copy source path ${path}`}
                className="btn btn-square shrink-0 btn-ghost btn-xs data-copy-failed:text-error"
                onClick={(event) => {
                    void copySourcePath(event.currentTarget, path);
                }}
                title="Copy source path"
                type="button"
            >
                <Copy aria-hidden="true" className="size-3.5" data-copy-icon />
                <Check aria-hidden="true" className="hidden size-3.5" data-copied-icon />
                <X aria-hidden="true" className="hidden size-3.5" data-copy-failed-icon />
            </button>
        </span>
    );
}
