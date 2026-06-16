import { describe, expect, it } from "vitest";

import { getQuickOpenKeyboardAction } from "./quick-open-keyboard";

describe("getQuickOpenKeyboardAction", () => {
    it("activates the first result when Enter is pressed with no prior movement", () => {
        expect(
            getQuickOpenKeyboardAction({
                activeIndex: 0,
                itemCount: 1,
                isComposing: false,
                key: "Enter",
            }),
        ).toEqual({
            activeIndex: 0,
            kind: "activate",
        });
    });

    it("moves the active result with arrow keys", () => {
        expect(
            getQuickOpenKeyboardAction({
                activeIndex: 0,
                itemCount: 3,
                isComposing: false,
                key: "ArrowDown",
            }),
        ).toEqual({
            activeIndex: 1,
            kind: "move",
        });
        expect(
            getQuickOpenKeyboardAction({
                activeIndex: 1,
                itemCount: 3,
                isComposing: false,
                key: "ArrowUp",
            }),
        ).toEqual({
            activeIndex: 0,
            kind: "move",
        });
    });

    it("does not activate results while text composition is in progress", () => {
        expect(
            getQuickOpenKeyboardAction({
                activeIndex: 0,
                itemCount: 1,
                isComposing: true,
                key: "Enter",
            }),
        ).toEqual({
            activeIndex: 0,
            kind: "none",
        });
    });

    it("blocks Tab focus movement without changing the active result", () => {
        expect(
            getQuickOpenKeyboardAction({
                activeIndex: 0,
                itemCount: 2,
                isComposing: false,
                key: "Tab",
            }),
        ).toEqual({
            activeIndex: 0,
            kind: "block",
        });
    });
});
