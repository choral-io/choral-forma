/** @type {import("prettier").Config & import("prettier-plugin-organize-imports/prettier") & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
    plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
    endOfLine: "auto",
    proseWrap: "never",
    printWidth: 120,
    quoteProps: "consistent",
    organizeImportsSkipDestructiveCodeActions: true,
    overrides: [
        {
            // Sort WebApp classes against its real Tailwind v4 + daisyUI stylesheet, including cn() calls
            // outside class attributes. Other surfaces keep the plugin's default theme.
            files: "packages/webapp/**",
            options: {
                tailwindStylesheet: "./packages/webapp/src/styles/globals.css",
                tailwindFunctions: ["cn"],
            },
        },
    ],
};
