export type PreviewRestorationOptions<Document> = {
    isFormaDocument: (document: Document) => boolean;
    refreshDocument: (document: Document, refreshPreview: boolean) => Promise<boolean>;
    refreshMarkdownPreview: () => Promise<void>;
};

export type PreviewRestorationResult = {
    documents: number;
    projections: number;
};

export type PreviewRestorationCoordinatorOptions<Document> = PreviewRestorationOptions<Document> & {
    onError: (error: unknown) => void;
};

export class PreviewRestorationCoordinator<Document> {
    private tail: Promise<void> = Promise.resolve();
    private disposed = false;

    constructor(private readonly options: PreviewRestorationCoordinatorOptions<Document>) {}

    restoreOpenDocuments(documents: readonly Document[]): Promise<PreviewRestorationResult> {
        if (this.disposed) return Promise.resolve({ documents: 0, projections: 0 });
        return this.enqueue(documents);
    }

    dispose(): void {
        this.disposed = true;
    }

    private enqueue(documents: readonly Document[]): Promise<PreviewRestorationResult> {
        const task = this.tail.then(async () => await restoreOpenDocumentPreviews(documents, this.options));
        this.tail = task.then(
            () => undefined,
            (error: unknown) => {
                try {
                    this.options.onError(error);
                } catch {
                    // Error reporting must not stop later Preview restoration work.
                }
            },
        );
        return task;
    }
}

export function viewPathsForPreviewLabels(labels: readonly string[], views: ReadonlyArray<{ path: string }>): string[] {
    return views
        .filter((view) => {
            const fileName = view.path.split("/").at(-1);
            if (!fileName) return false;
            return labels.some((label) => {
                if (label === fileName) return true;
                if (!label.endsWith(fileName)) return false;
                return /[\s:：]$/u.test(label.slice(0, -fileName.length));
            });
        })
        .map((view) => view.path);
}

export function isClassicMarkdownPreviewViewType(viewType: string): boolean {
    return viewType === "markdown.preview" || viewType.endsWith("-markdown.preview");
}

export async function restoreOpenDocumentPreviews<Document>(
    documents: readonly Document[],
    options: PreviewRestorationOptions<Document>,
): Promise<PreviewRestorationResult> {
    const formaDocuments = documents.filter(options.isFormaDocument);
    let projections = 0;
    for (const document of formaDocuments) {
        if (await options.refreshDocument(document, false)) projections += 1;
    }
    if (formaDocuments.length > 0) await options.refreshMarkdownPreview();
    return { documents: formaDocuments.length, projections };
}
