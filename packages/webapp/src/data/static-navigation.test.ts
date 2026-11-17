import { describe, expect, it, vi } from "vitest";

import { createStaticNavigation, type StaticNavigationIntent } from "./static-navigation";

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((accept, fail) => {
        resolve = accept;
        reject = fail;
    });
    return { promise, reject, resolve };
}

describe("static navigation attempts", () => {
    it.each(["offline", "detail missing", "forged identity", "next artifact"])(
        "preserves the source and retries once when a click receives %s",
        async (reason) => {
            const prepare = vi.fn().mockRejectedValueOnce(new Error(reason)).mockResolvedValueOnce(undefined);
            const navigation = createStaticNavigation(prepare);
            const commit = vi.fn();
            const intent: StaticNavigationIntent = {
                kind: "push",
                target: { href: "/b.md?x=1&x=2#second", pathname: "/b.md" },
                commit,
            };
            await expect(navigation.start(intent)).resolves.toBe(false);
            expect(navigation.getSnapshot()).toEqual({ status: "failed", intent });
            expect(commit).not.toHaveBeenCalled();

            await expect(navigation.retry()).resolves.toBe(true);
            expect(prepare.mock.calls).toEqual([["/b.md"], ["/b.md"]]);
            expect(commit).toHaveBeenCalledOnce();
            expect(navigation.getSnapshot()).toBeUndefined();
        },
    );

    it("keeps failure and retry at the browser-selected history target", async () => {
        const prepare = vi.fn().mockRejectedValueOnce(new Error("missing")).mockResolvedValueOnce(undefined);
        const navigation = createStaticNavigation(prepare);
        const intent: StaticNavigationIntent = {
            kind: "pop",
            target: { href: "/b.md#footnote", pathname: "/b.md" },
        };
        const statuses: (string | undefined)[] = [];
        const unsubscribe = navigation.subscribe(() => statuses.push(navigation.getSnapshot()?.status));
        await expect(navigation.start(intent)).resolves.toBe(false);
        expect(navigation.getSnapshot()?.intent.target.href).toBe("/b.md#footnote");
        await expect(navigation.retry()).resolves.toBe(true);
        unsubscribe();
        expect(statuses).toEqual(["pending", "failed", "pending", undefined]);
    });

    it.each(["success", "failure"])("ignores a late %s from a superseded click", async (outcome) => {
        const b = deferred();
        const c = deferred();
        const prepare = vi.fn().mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise);
        const navigation = createStaticNavigation(prepare);
        const commitB = vi.fn();
        const commitC = vi.fn();
        const toB = navigation.start({ kind: "push", target: { href: "/b.md", pathname: "/b.md" }, commit: commitB });
        const toC = navigation.start({ kind: "push", target: { href: "/c.md", pathname: "/c.md" }, commit: commitC });
        c.resolve();
        await expect(toC).resolves.toBe(true);
        if (outcome === "success") b.resolve();
        else b.reject(new Error("late"));
        await expect(toB).resolves.toBe(false);
        expect(commitB).not.toHaveBeenCalled();
        expect(commitC).toHaveBeenCalledOnce();
        expect(navigation.getSnapshot()).toBeUndefined();
    });

    it("coalesces repeated clicks and invalidates a cancelled request before it can commit", async () => {
        const response = deferred();
        const prepare = vi.fn(() => response.promise);
        const navigation = createStaticNavigation(prepare);
        const commit = vi.fn();
        const intent: StaticNavigationIntent = {
            kind: "push",
            target: { href: "/b.md", pathname: "/b.md" },
            commit,
        };
        const first = navigation.start(intent);
        await expect(navigation.start(intent)).resolves.toBe(false);
        expect(prepare).toHaveBeenCalledOnce();
        navigation.cancel();
        response.resolve();
        await expect(first).resolves.toBe(false);
        expect(commit).not.toHaveBeenCalled();
    });
});
