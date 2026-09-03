import type { DashboardEntry, DashboardEntryBlock } from "@/data/workspace-client";
import type { MermaidRenderScope } from "@/lib/mermaid";

import type { EntryOutlineItem } from "./entry-outline";
import { MarkdownReader } from "./MarkdownReader";
import { useMermaidScope } from "./use-mermaid-scope";

export function EntryReader({
    blocks,
    currentPath,
    currentRoutePath,
    entries,
    omitLeadingTitle,
    outline,
}: {
    blocks: DashboardEntryBlock[];
    currentPath: string;
    currentRoutePath: string;
    entries: DashboardEntry[];
    omitLeadingTitle: boolean;
    outline: EntryOutlineItem[];
}) {
    const mermaidScope = useMermaidScope(currentPath);

    return (
        <div className="w-full py-2 md:py-4">
            <article className="flex w-full flex-col gap-5">
                {blocks.map((block, index) => {
                    const headingId = outline.find((item) => item.blockIndex === index)?.id;

                    return (
                        <EntryBlockView
                            block={block}
                            currentPath={currentPath}
                            currentRoutePath={currentRoutePath}
                            entries={entries}
                            headingId={headingId}
                            mermaidScope={mermaidScope}
                            omitLeadingTitle={omitLeadingTitle && index === 0}
                            key={`${block.type}-${String(index)}`}
                        />
                    );
                })}
            </article>
        </div>
    );
}

function EntryBlockView({
    block,
    currentPath,
    currentRoutePath,
    entries,
    headingId,
    mermaidScope,
    omitLeadingTitle = false,
}: {
    block: DashboardEntryBlock;
    currentPath: string;
    currentRoutePath: string;
    entries: DashboardEntry[];
    headingId?: string;
    mermaidScope: MermaidRenderScope;
    omitLeadingTitle?: boolean;
}) {
    if (block.type === "markdown") {
        return (
            <MarkdownReader
                currentPath={currentPath}
                currentRoutePath={currentRoutePath}
                entries={entries}
                headings={block.outline}
                markdown={block.markdown}
                mermaidScope={mermaidScope}
                omitLeadingTitle={omitLeadingTitle}
            />
        );
    }

    if (block.type === "html") {
        return (
            <div
                data-reader="markdown"
                // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
                dangerouslySetInnerHTML={{ __html: block.html }}
            />
        );
    }

    if (block.type === "heading") {
        const Heading = block.level === 2 ? "h2" : "h3";
        const className =
            block.level === 2
                ? "text-base-content mt-2 scroll-m-20 text-xl font-semibold tracking-normal first:mt-0"
                : "text-base-content mt-2 scroll-m-20 text-base font-semibold tracking-normal first:mt-0";

        return (
            <Heading className={className} id={headingId}>
                {block.text}
            </Heading>
        );
    }

    if (block.type === "paragraph") {
        return <p className="text-base-content/90 text-sm/7">{block.text}</p>;
    }

    if (block.type === "list") {
        return (
            <ul className="text-base-content/90 flex list-disc flex-col gap-2 ps-5 text-sm/7">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        );
    }

    if (block.type === "quote") {
        return (
            <blockquote className="border-base-300 text-base-content/60 bg-base-200/30 rounded-r-lg border-s-4 px-4 py-3 text-sm/7">
                {block.text}
            </blockquote>
        );
    }

    if (block.type === "code") {
        return (
            <figure className="border-base-300 bg-base-200/50 overflow-hidden rounded-lg border">
                <figcaption className="border-base-300 text-base-content/60 border-b px-4 py-2 text-xs">
                    {block.language}
                </figcaption>
                <pre className="overflow-x-auto p-4 text-sm/6">
                    <code>{block.code}</code>
                </pre>
            </figure>
        );
    }

    return (
        <div className="border-base-300 overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
                <table className="table-sm table min-w-xl">
                    <thead className="bg-base-200 text-base-content/60">
                        <tr>
                            {block.columns.map((column) => (
                                <th className="font-medium" key={column}>
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row) => (
                            <tr key={row.join("|")}>
                                {row.map((cell, cellIndex) => (
                                    <td className="align-top" key={`${block.columns[cellIndex] ?? "cell"}-${cell}`}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
