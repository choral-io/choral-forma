export const VIEW_MOUNT_MARKER = "<!-- forma:content -->";

export function isFormaViewDocument(languageId: string | undefined, kind: string | undefined): boolean {
    return languageId === "markdown" && kind === "view";
}
