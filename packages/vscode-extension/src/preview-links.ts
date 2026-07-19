export function relativePreviewHref(sourcePath: string, targetPath: string): string {
    const sourceSegments = pathSegments(sourcePath);
    const targetSegments = pathSegments(targetPath);
    const sourceDirectory = sourceSegments.slice(0, -1);
    let sharedSegments = 0;
    while (
        sharedSegments < sourceDirectory.length &&
        sharedSegments < targetSegments.length &&
        sourceDirectory[sharedSegments] === targetSegments[sharedSegments]
    ) {
        sharedSegments += 1;
    }

    const parentSegments = Array.from({ length: sourceDirectory.length - sharedSegments }, () => "..");
    const relativeSegments = [...parentSegments, ...targetSegments.slice(sharedSegments)];
    const relativePath = relativeSegments.map(encodeURIComponent).join("/");
    if (relativePath.startsWith("../")) return relativePath;
    return `./${relativePath}`;
}

function pathSegments(path: string): string[] {
    return path
        .replace(/^\/+|\/+$/gu, "")
        .split("/")
        .filter((segment) => segment.length > 0 && segment !== ".");
}
