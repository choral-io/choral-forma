import { createContext, use } from "react";

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeContextValue {
    mode: ThemeMode;
    resolvedMode: Exclude<ThemeMode, "system">;
    setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
    const context = use(ThemeContext);

    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider.");
    }

    return context;
}
