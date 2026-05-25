import { defineConfig } from "eslint/config";
import globals from "globals";

import js from "@eslint/js";
import react from "@eslint-react/eslint-plugin";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import ts from "typescript-eslint";

export default defineConfig(
    { ignores: ["dist", "node_modules", "*.config.mjs"] },
    {
        settings: {
            "react-x": { version: "detect" },
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
        },
    },
    { ...prettierRecommended },
);
