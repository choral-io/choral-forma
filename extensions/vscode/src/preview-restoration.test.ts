import { describe, expect, it } from "vitest";

import {
    isClassicMarkdownPreviewViewType,
    PreviewRestorationCoordinator,
    restoreOpenDocumentPreviews,
    viewPathsForPreviewLabels,
} from "./preview-restoration.ts";

type Document = { id: string; managed: boolean };

describe("restored native Markdown previews", () => {
    it("recognizes the classic Preview view type exposed by VS Code tab restoration", () => {
        expect(isClassicMarkdownPreviewViewType("markdown.preview")).toBe(true);
        expect(isClassicMarkdownPreviewViewType("mainThreadWebview-markdown.preview")).toBe(true);
        expect(isClassicMarkdownPreviewViewType("example.markdown.preview")).toBe(false);
    });

    it("restores a Preview document resolved after extension activation", async () => {
        const events: string[] = [];
        const coordinator = new PreviewRestorationCoordinator<Document>({
            isFormaDocument: (document) => document.managed,
            refreshDocument: async (document, refreshPreview) => {
                events.push(`document:${document.id}:${String(refreshPreview)}`);
                return document.id === "board";
            },
            refreshMarkdownPreview: async () => {
                events.push("markdown");
            },
            onError: (error) => {
                throw error;
            },
        });

        expect(await coordinator.restoreOpenDocuments([])).toEqual({ documents: 0, projections: 0 });
        expect(await coordinator.restoreOpenDocuments([{ id: "board", managed: true }])).toEqual({
            documents: 1,
            projections: 1,
        });

        expect(events).toEqual(["document:board:false", "markdown"]);
    });

    it("maps restored classic Markdown Preview labels to configured View paths", () => {
        expect(
            viewPathsForPreviewLabels(
                ["Preview task-board.md", "Unrelated.md"],
                [{ path: ".forma/views/task-board.md" }, { path: ".forma/views/release-scope.md" }],
            ),
        ).toEqual([".forma/views/task-board.md"]);
        expect(viewPathsForPreviewLabels(["not-task-board.md"], [{ path: ".forma/views/task-board.md" }])).toEqual([]);
    });

    it("rebuilds managed document caches before refreshing Markdown once", async () => {
        const events: string[] = [];
        const documents: Document[] = [
            { id: "ordinary", managed: false },
            { id: "board", managed: true },
            { id: "note", managed: true },
        ];

        const result = await restoreOpenDocumentPreviews(documents, {
            isFormaDocument: (document) => document.managed,
            refreshDocument: async (document, refreshPreview) => {
                events.push(`document:${document.id}:${String(refreshPreview)}`);
                return document.id === "board";
            },
            refreshMarkdownPreview: async () => {
                events.push("markdown");
            },
        });

        expect(result).toEqual({ documents: 2, projections: 1 });
        expect(events).toEqual(["document:board:false", "document:note:false", "markdown"]);
    });

    it("does not refresh Markdown when no open document is managed by Forma", async () => {
        let markdownRefreshes = 0;
        const result = await restoreOpenDocumentPreviews([{ id: "ordinary", managed: false }], {
            isFormaDocument: (document) => document.managed,
            refreshDocument: async () => false,
            refreshMarkdownPreview: async () => {
                markdownRefreshes += 1;
            },
        });

        expect(result).toEqual({ documents: 0, projections: 0 });
        expect(markdownRefreshes).toBe(0);
    });
});
