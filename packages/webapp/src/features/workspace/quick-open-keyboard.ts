export type QuickOpenKeyboardAction =
    | {
          activeIndex: number;
          kind: "activate" | "move";
      }
    | {
          activeIndex: number;
          kind: "none";
      };

export interface QuickOpenKeyboardInput {
    activeIndex: number;
    itemCount: number;
    isComposing: boolean;
    key: string;
}

export function getQuickOpenKeyboardAction({
    activeIndex,
    itemCount,
    isComposing,
    key,
}: QuickOpenKeyboardInput): QuickOpenKeyboardAction {
    const normalizedActiveIndex = normalizeActiveIndex(activeIndex, itemCount);

    if (isComposing || itemCount === 0) {
        return {
            activeIndex: normalizedActiveIndex,
            kind: "none",
        };
    }

    if (key === "Enter") {
        return {
            activeIndex: normalizedActiveIndex,
            kind: "activate",
        };
    }

    if (key === "ArrowDown") {
        return {
            activeIndex: (normalizedActiveIndex + 1) % itemCount,
            kind: "move",
        };
    }

    if (key === "ArrowUp") {
        return {
            activeIndex: (normalizedActiveIndex - 1 + itemCount) % itemCount,
            kind: "move",
        };
    }

    return {
        activeIndex: normalizedActiveIndex,
        kind: "none",
    };
}

function normalizeActiveIndex(activeIndex: number, itemCount: number) {
    if (itemCount === 0) {
        return 0;
    }

    return Math.min(Math.max(activeIndex, 0), itemCount - 1);
}
