/** @type {import("prettier").Options & import("prettier-plugin-organize-imports/prettier") & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
    plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
    endOfLine: "auto",
    printWidth: 120,
    quoteProps: "consistent",
    organizeImportsSkipDestructiveCodeActions: true,
    overrides: [
        {
            files: "examples/forma-starter-kit/**/*.md",
            options: {
                proseWrap: "never",
            },
        },
    ],
};
