import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [tailwindcss()],
    css: {
        postcss: {
            plugins: [
                {
                    postcssPlugin: "forma-shadow-property-defaults",
                    Once(root, { postcss }) {
                        // @property registrations do not apply inside Chromium shadow roots.
                        // Mirror their non-inherited defaults locally, without global registrations.
                        const defaults = postcss.rule({
                            selector: "*, ::before, ::after, ::backdrop",
                            source: root.source,
                        });
                        root.walkAtRules("property", (rule) => {
                            const inherited = rule.nodes.find((node) => node.prop === "inherits");
                            if (inherited?.value !== "false") return;
                            const initial = rule.nodes.find((node) => node.prop === "initial-value");
                            defaults.append(
                                postcss.decl({
                                    prop: rule.params,
                                    value: initial?.value ?? "initial",
                                    source: rule.source,
                                }),
                            );
                        });
                        if (defaults.nodes.length) {
                            const layer = postcss.atRule({ name: "layer", params: "properties", source: root.source });
                            layer.append(defaults);
                            root.prepend(layer);
                        }
                    },
                },
            ],
        },
    },
    build: {
        emptyOutDir: false,
        cssCodeSplit: true,
        rolldownOptions: {
            input: "src/preview.css",
            output: { assetFileNames: "preview.css" },
        },
    },
});
