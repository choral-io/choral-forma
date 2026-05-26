import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ThemeContext, type ThemeMode } from "./theme-context";

const THEME_STORAGE_KEY = "choral-forma-theme";

function getSystemMode() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): ThemeMode {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);

    return storedMode === "light" || storedMode === "dark" || storedMode === "system" ? storedMode : "system";
}

function applyTheme(mode: ThemeMode) {
    const resolvedMode = mode === "system" ? getSystemMode() : mode;

    document.documentElement.classList.toggle("dark", resolvedMode === "dark");
    document.documentElement.dataset.theme = mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => readStoredMode());
    const [systemMode, setSystemMode] = useState<Exclude<ThemeMode, "system">>(() => getSystemMode());
    const resolvedMode = mode === "system" ? systemMode : mode;

    useEffect(() => {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode);
        applyTheme(mode);

        if (mode !== "system") {
            return;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            setSystemMode(getSystemMode());
            applyTheme("system");
        };

        mediaQuery.addEventListener("change", handleChange);

        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, [mode]);

    const value = useMemo(
        () => ({
            mode,
            resolvedMode,
            setMode,
        }),
        [mode, resolvedMode],
    );

    return <ThemeContext value={value}>{children}</ThemeContext>;
}
