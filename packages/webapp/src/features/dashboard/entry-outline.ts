import type { DashboardEntryBlock } from "@/data/workspace-client";

export interface EntryOutlineItem {
    blockIndex: number;
    id: string;
    level: 2 | 3;
    text: string;
}

export interface EntryOutlineNode extends EntryOutlineItem {
    children: EntryOutlineItem[];
}

export function getEntryOutline(blocks: DashboardEntryBlock[]): EntryOutlineItem[] {
    const seen = new Map<string, number>();

    return blocks.flatMap((block, blockIndex) => {
        if (block.type === "html" || block.type === "markdown") {
            return block.outline.map((item) => ({
                ...item,
                blockIndex,
            }));
        }

        if (block.type !== "heading") {
            return [];
        }

        const baseId = slugifyHeading(block.text);
        const count = seen.get(baseId) ?? 0;
        seen.set(baseId, count + 1);

        return [
            {
                blockIndex,
                id: count === 0 ? baseId : `${baseId}-${String(count + 1)}`,
                level: block.level,
                text: block.text,
            },
        ];
    });
}

export function getEntryOutlineTree(outline: EntryOutlineItem[]): EntryOutlineNode[] {
    const tree: EntryOutlineNode[] = [];

    for (const item of outline) {
        if (item.level === 2 || tree.length === 0) {
            tree.push({ ...item, children: [] });
            continue;
        }

        tree[tree.length - 1]?.children.push(item);
    }

    return tree;
}

function slugifyHeading(text: string) {
    const slug = text
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "section";
}
