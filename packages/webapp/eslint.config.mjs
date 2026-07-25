import { defineConfig } from "eslint/config";
import globals from "globals";

import react from "@eslint-react/eslint-plugin";
import js from "@eslint/js";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import ts from "typescript-eslint";

export default defineConfig(
    { ignores: ["dist", "node_modules", "*.config.mjs"] },
    {
        settings: {
            "better-tailwindcss": {
                cwd: import.meta.dirname,
                entryPoint: "src/styles/globals.css",
            },
            "react-x": { version: "detect" },
        },
        plugins: {
            "better-tailwindcss": betterTailwindcss,
        },
        extends: [
            js.configs.recommended,
            ts.configs.strictTypeChecked,
            ts.configs.stylisticTypeChecked,
            react.configs["recommended-type-checked"],
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
        ],
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "prettier/prettier": ["error", { endOfLine: "auto" }],
            "better-tailwindcss/enforce-canonical-classes": "error",
            "better-tailwindcss/no-conflicting-classes": "error",
            "better-tailwindcss/no-deprecated-classes": "error",
            "better-tailwindcss/no-duplicate-classes": "error",
            // daisyUI defines fab-close, drawer-overlay, and drawer-button only as
            // nested selectors. Diagram viewer primitives are Forma-owned CSS
            // composition classes shared by the graph and Mermaid adapters.
            "better-tailwindcss/no-unknown-classes": [
                "error",
                {
                    ignore: [
                        "^(fab-close|drawer-overlay|drawer-button)$",
                        "^(diagram-viewer-control-rail|diagram-viewer-slider-lane|diagram-viewer-zoom-slider|diagram-viewer-no-fill-range|diagram-viewer-control-actions|diagram-viewer-control-button|graph-viewer-control-rail|graph-viewer-canvas|graph-viewer-canvas--zoomed)$",
                    ],
                },
            ],
            "better-tailwindcss/no-unnecessary-whitespace": "error",
        },
    },
    { ...prettierRecommended },
);
