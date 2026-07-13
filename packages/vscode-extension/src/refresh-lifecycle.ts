export function isCurrentRefresh(candidate: AbortController, current: AbortController | undefined): boolean {
    return candidate === current && !candidate.signal.aborted;
}

export function currentRefreshValue<T>(
    candidate: AbortController,
    current: AbortController | undefined,
    value: T,
): T | undefined {
    return isCurrentRefresh(candidate, current) ? value : undefined;
}
