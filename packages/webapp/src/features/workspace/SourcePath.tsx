import { Check, Copy } from "lucide-react";

import { copySourcePath } from "@/lib/copy-source-path";
import { cn } from "@/lib/utils";

/** A page's source path as metadata, followed by an icon that copies it. */
export function SourcePath({ className, path }: { className?: string; path: string }) {
    return (
        <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
            <code className="min-w-0 truncate text-xs" title={path}>
                {path}
            </code>
            <button
                aria-label={`Copy source path ${path}`}
                className="btn btn-square shrink-0 btn-ghost btn-xs"
                onClick={(event) => {
                    void copySourcePath(event.currentTarget, path);
                }}
                title="Copy source path"
                type="button"
            >
                <Copy aria-hidden="true" className="size-3.5" data-copy-icon />
                <Check aria-hidden="true" className="hidden size-3.5" data-copied-icon />
            </button>
        </span>
    );
}
