import { ArrowUp } from "lucide-react";
import { useEffect, useRef, type MouseEvent } from "react";

import { rootAwareHref } from "@/data/static-runtime";
import { cn } from "@/lib/utils";

import type { EntryOutlineItem, EntryOutlineNode } from "./entry-outline";

export const entryTopId = "entry-top";
export const relatedDocumentsId = "related-documents";

interface OutlineProps {
    activeHeadingId?: string;
    onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
    routePath: string;
}

interface OutlineFooterProps extends Omit<OutlineProps, "activeHeadingId"> {
    /** Present when the document has a related-documents section to jump to. */
    backlinkCount?: number;
    relatedId: string;
    showBackToTop: boolean;
    topId: string;
}

export function EntryOutlineSection({
    activeHeadingId,
    backlinkCount,
    onNavigate,
    relatedId,
    routePath,
    showBackToTop,
    topId,
    tree,
}: OutlineProps & OutlineFooterProps & { tree: EntryOutlineNode[] }) {
    return (
        <section className="sticky top-8 flex max-h-[calc(100dvh-8rem)] min-h-0 flex-col gap-3 overflow-hidden group-has-data-reader-loading/entry:hidden">
            <h2 className="shrink-0 text-sm font-semibold">Outline</h2>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <OutlineNav
                    activeHeadingId={activeHeadingId}
                    onNavigate={onNavigate}
                    routePath={routePath}
                    tree={tree}
                />
            </div>
            <OutlineFooterNav
                backlinkCount={backlinkCount}
                onNavigate={onNavigate}
                relatedId={relatedId}
                routePath={routePath}
                showBackToTop={showBackToTop}
                topId={topId}
            />
        </section>
    );
}

export function OutlineNav({
    activeHeadingId,
    onNavigate,
    routePath,
    tree,
}: OutlineProps & { tree: EntryOutlineNode[] }) {
    const navRef = useRef<HTMLElement>(null);

    // A long outline scrolls on its own, so keep the section being read within it.
    useEffect(() => {
        navRef.current?.querySelector('[aria-current="location"]')?.scrollIntoView({ block: "nearest" });
    }, [activeHeadingId]);

    return (
        <nav aria-label="Page outline" ref={navRef}>
            <ul className="menu w-full flex-nowrap p-0 [&_li]:flex-nowrap">
                {tree.map((node) => (
                    <li key={node.id}>
                        <EntryOutlineLink
                            activeHeadingId={activeHeadingId}
                            item={node}
                            onNavigate={onNavigate}
                            routePath={routePath}
                        />
                        {node.children.length > 0 && (
                            <ul className="before:inset-y-[0.375em]">
                                {node.children.map((child) => (
                                    <li key={child.id}>
                                        <EntryOutlineLink
                                            activeHeadingId={activeHeadingId}
                                            item={child}
                                            onNavigate={onNavigate}
                                            routePath={routePath}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </nav>
    );
}

export function OutlineFooterNav({
    backlinkCount,
    onNavigate,
    relatedId,
    routePath,
    showBackToTop,
    topId,
}: OutlineFooterProps) {
    if (backlinkCount === undefined && !showBackToTop) return null;

    return (
        <nav aria-label="Page outline footer" className="shrink-0 border-t border-base-300 pt-2">
            <ul className="menu w-full flex-nowrap p-0 [&_li]:flex-nowrap">
                {backlinkCount === undefined ? null : (
                    <li>
                        <a href={rootAwareHref(`${routePath}#${relatedId}`)} onClick={onNavigate}>
                            <span className="min-w-0 flex-1 truncate">Related documents</span>
                            {/* A document with only outgoing references still has a section here, but no count to show. */}
                            {backlinkCount > 0 ? (
                                <span className="badge badge-ghost badge-sm">
                                    {backlinkCount}
                                    <span className="sr-only"> backlinks</span>
                                </span>
                            ) : null}
                        </a>
                    </li>
                )}
                {showBackToTop ? (
                    <li>
                        <a href={rootAwareHref(`${routePath}#${topId}`)} onClick={onNavigate}>
                            <span>Back to top</span>
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                        </a>
                    </li>
                ) : null}
            </ul>
        </nav>
    );
}

function EntryOutlineLink({ activeHeadingId, item, onNavigate, routePath }: OutlineProps & { item: EntryOutlineItem }) {
    const isActive = item.id === activeHeadingId;

    return (
        <a
            aria-current={isActive ? "location" : undefined}
            className={cn("min-w-0", isActive && "menu-active font-medium")}
            data-outline-link
            href={rootAwareHref(`${routePath}#${item.id}`)}
            onClick={onNavigate}
            title={item.text}
        >
            <span className="min-w-0 truncate">{item.text}</span>
        </a>
    );
}
