import { defineConfig } from "eslint/config";

import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import ts from "typescript-eslint";

export default defineConfig(
    { ignores: ["dist", "node_modules", "*.config.mjs"] },
    {
        extends: [js.configs.recommended, ts.configs.strictTypeChecked, ts.configs.stylisticTypeChecked],
        files: ["**/*.ts"],
        languageOptions: {
            ecmaVersion: 2022,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "@typescript-eslint/array-type": "off",
            "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
            "@typescript-eslint/consistent-type-definitions": "off",
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
