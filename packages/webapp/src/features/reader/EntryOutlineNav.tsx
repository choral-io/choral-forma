import { ArrowUp } from "lucide-react";
import type { MouseEvent } from "react";

import { rootAwareHref } from "@/data/static-runtime";

import type { EntryOutlineItem, EntryOutlineNode } from "./entry-outline";

export function EntryOutlineSection({
    onNavigate,
    routePath,
    tree,
}: {
    onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
    tree: EntryOutlineNode[];
}) {
    return (
        <section className="sticky top-8 flex max-h-[calc(100dvh-10rem)] min-h-0 flex-col gap-3 overflow-hidden group-has-data-reader-loading/entry:hidden">
            <div className="shrink-0">
                <h2 className="text-sm font-semibold">Outline</h2>
                <p className="mt-1 text-sm/6 text-base-content/60">Headings from the current entry.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <OutlineNav onNavigate={onNavigate} routePath={routePath} tree={tree} />
            </div>
            <OutlineFooterNav onNavigate={onNavigate} routePath={routePath} />
        </section>
    );
}

export function OutlineNav({
    onNavigate,
    routePath,
    tree,
}: {
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
    tree: EntryOutlineNode[];
}) {
    return (
        <nav aria-label="Page outline">
            <ul className="menu w-full p-0">
                {tree.map((node) => (
                    <EntryOutlineTreeNode key={node.id} node={node} onNavigate={onNavigate} routePath={routePath} />
                ))}
            </ul>
        </nav>
    );
}

export function OutlineFooterNav({
    onNavigate,
    routePath,
}: {
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <nav aria-label="Page outline footer" className="shrink-0 border-t border-base-300 pt-2">
            <ul className="menu w-full p-0">
                <OutlineFooterItems onNavigate={onNavigate} routePath={routePath} />
            </ul>
        </nav>
    );
}

function OutlineFooterItems({
    onNavigate,
    routePath,
}: {
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <>
            <li>
                <a href={rootAwareHref(`${routePath}#document-details`)} onClick={onNavigate}>
                    <span data-link-kind="anchor">Document details</span>
                </a>
            </li>
            <li>
                <a href={rootAwareHref(`${routePath}#entry-top`)} onClick={onNavigate}>
                    <span>Back to top</span>
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                </a>
            </li>
        </>
    );
}

function EntryOutlineTreeNode({
    node,
    onNavigate,
    routePath,
}: {
    node: EntryOutlineNode;
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <li>
            <EntryOutlineLink item={node} onNavigate={onNavigate} routePath={routePath} />
            {node.children.length > 0 && (
                <ul className="before:inset-y-[0.375em]">
                    {node.children.map((child) => (
                        <li key={child.id}>
                            <EntryOutlineLink item={child} onNavigate={onNavigate} routePath={routePath} />
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

function EntryOutlineLink({
    item,
    onNavigate,
    routePath,
}: {
    item: EntryOutlineItem;
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}) {
    return (
        <a
            className="min-w-0"
            data-outline-link
            href={rootAwareHref(`${routePath}#${item.id}`)}
            onClick={onNavigate}
            title={item.text}
        >
            <span className="min-w-0 truncate">{item.text}</span>
        </a>
    );
}
