/** @type {import("prettier").Options & import("prettier-plugin-organize-imports/prettier") & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
    plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
    endOfLine: "auto",
    proseWrap: "never",
    printWidth: 120,
    quoteProps: "consistent",
    organizeImportsSkipDestructiveCodeActions: true,
};
