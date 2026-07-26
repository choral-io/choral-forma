import { describe, expect, it } from "vitest";

import { tableColumnStyle, tableColumnWraps } from "./table-column-presentation";

describe("Table column presentation", () => {
    it("emits only normalized dimensions", () => {
        expect(
            tableColumnStyle({
                field: "fields.title",
                label: "Title",
                width: "240px",
                minWidth: "10rem",
                maxWidth: "32em",
            }),
        ).toEqual({ width: "240px", minWidth: "10rem", maxWidth: "32em" });
        expect(
            tableColumnStyle({
                field: "fields.title",
                label: "Title",
                width: "calc(100vw)",
                minWidth: "30em",
                maxWidth: "20em",
            }),
        ).toBeUndefined();
        expect(
            tableColumnStyle({
                field: "fields.title",
                label: "Title",
                width: "12.5em",
                minWidth: "8rem",
                maxWidth: "24rem",
            }),
        ).toEqual({ width: "12.5em", minWidth: "8rem", maxWidth: "24rem" });
        expect(
            tableColumnStyle({
                field: "fields.title",
                label: "Title",
                width: "20ch",
            }),
        ).toBeUndefined();
        expect(tableColumnStyle({ field: "fields.title", label: "Title" })).toBeUndefined();
    });

    it("changes wrapping only for the explicit wrap option", () => {
        expect(tableColumnWraps({ field: "fields.title", label: "Title", overflow: "wrap" })).toBe(true);
        expect(tableColumnWraps({ field: "fields.title", label: "Title", overflow: "truncate" })).toBe(false);
        expect(tableColumnWraps({ field: "fields.title", label: "Title" })).toBe(false);
    });
});
