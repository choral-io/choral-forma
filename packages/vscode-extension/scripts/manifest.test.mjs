import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("enhances the native Markdown preview without adding a second editor title action", () => {
    assert.equal(manifest.contributes["markdown.markdownItPlugins"], true);
    assert.deepEqual(manifest.contributes["markdown.previewStyles"], ["./media/preview.css"]);
    assert.equal(manifest.contributes.menus?.["editor/title"], undefined);
});

test("contributes one Forma tree inside the built-in Explorer", () => {
    assert.equal(manifest.contributes.viewsContainers, undefined);
    assert.deepEqual(manifest.contributes.views.explorer, [{ id: "forma.workspace", name: "Forma" }]);
    assert.equal(manifest.contributes.menus["view/title"][0].when, "view == forma.workspace");
});

test("vendors only the Lucide icons used by the Forma tree", async () => {
    const iconFiles = [
        "ellipsis.svg",
        "eye.svg",
        "file-text.svg",
        "folder.svg",
        "kanban.svg",
        "list.svg",
        "network.svg",
        "panels-top-left.svg",
        "table-properties.svg",
        "tags.svg",
        "triangle-alert.svg",
    ];
    for (const theme of ["light", "dark"]) {
        const files = await readdir(new URL(`../media/icons/lucide/${theme}/`, import.meta.url));
        assert.deepEqual(files.sort(), iconFiles);
    }
    assert.equal(manifest.dependencies?.["lucide-react"], undefined);
});

test("keeps the executable path in machine-level settings", () => {
    assert.equal(manifest.contributes.configuration.properties["forma.path"].scope, "machine");
});

test("contributes explicit managed CLI recovery commands", () => {
    const commands = manifest.contributes.commands.map(({ command }) => command);
    assert.ok(commands.includes("forma.installCli"));
    assert.ok(commands.includes("forma.selectCli"));
    assert.ok(commands.includes("forma.openCliInstructions"));
    assert.match(manifest.capabilities.untrustedWorkspaces.description, /does not download or execute/u);
});

test("keeps the main workspace configuration resource-scoped", () => {
    const setting = manifest.contributes.configuration.properties["forma.workspaceConfig"];
    assert.equal(setting.scope, "resource");
    assert.equal(setting.default, ".forma.md");
});

test("contributes a resource-scoped Frontmatter default state", () => {
    const setting = manifest.contributes.configuration.properties["forma.preview.frontmatterDefaultState"];
    assert.equal(setting.scope, "resource");
    assert.equal(setting.default, "collapsed");
    assert.deepEqual(setting.enum, ["collapsed", "expanded"]);
});
