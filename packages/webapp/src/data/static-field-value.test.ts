import { describe, expect, it } from "vitest";
import displayFixtures from "../../../../fixtures/forma-validation/samples/projections/static-field-display.json";

import { stringifyStaticFieldValue } from "./static-field-value";

describe("stringifyStaticFieldValue", () => {
    it("matches the static field display fixture", () => {
        for (const fixture of displayFixtures) {
            expect(stringifyStaticFieldValue(fixture.value)).toBe(fixture.display);
        }
    });
});
