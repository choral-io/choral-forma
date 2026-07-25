import { describe, expect, it } from "vitest";

import { describeMermaidDiagram, mermaidPolicy, validateMermaidSource } from "./policy";

describe("validateMermaidSource", () => {
    it.each([
        [
            "flowchart",
            "flowchart LR\n  Start[Repository Markdown] --> Adapter[Worker adapter]\n  Adapter --> Reader[Forma reader]",
            3,
            2,
        ],
        [
            "state",
            'stateDiagram-v2\n  state "Waiting" as Waiting\n  Waiting --> Ready : validate\n  Ready --> [*]',
            3,
            2,
        ],
        [
            "sequence",
            "sequenceDiagram\n  participant A as Author\n  participant R as Reader\n  A->>R: Publish\n  Note over R: Accessible source",
            2,
            1,
        ],
        [
            "class",
            "classDiagram\n  class Adapter {\n    +render() Promise\n  }\n  Adapter --> Worker : delegates",
            2,
            1,
        ],
        [
            "entity relationship",
            'erDiagram\n  ENTRY {\n    string path PK "workspace path"\n  }\n  ENTRY ||--o{ LINK : contains',
            2,
            1,
        ],
    ])("fully consumes a supported %s diagram", (_, source, structuralNodes, relations) => {
        const result = validateMermaidSource(source);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.diagram.metrics.structuralNodes).toBe(structuralNodes);
            expect(result.diagram.metrics.relations).toBe(relations);
            expect(describeMermaidDiagram(result.diagram)).toContain("Relationships:");
        }
    });

    it.each([
        ["click directive", "flowchart LR\n  A --> B\n  click A https://evil.test"],
        ["accessibility title", "flowchart LR\n  A --> B\n  accTitle: Hidden title"],
        ["accessibility description", "flowchart LR\n  A --> B\n  accDescr: Hidden description"],
        ["mixed trailing statement", "flowchart LR\n  A --> B\n  participant C"],
        ["flow note", "flowchart LR\n  A --> B\n  Note over A: ignored"],
        ["malformed trailing input", "flowchart LR\n  A --> B trailing"],
        ["unclosed subgraph", "flowchart LR\n  subgraph Group\n  A --> B"],
        ["extra terminator", "sequenceDiagram\n  A->>B: Hello\n  end"],
        ["standalone activation", "sequenceDiagram\n  activate A"],
    ])("rejects %s instead of partially rendering it", (_, source) => {
        expect(validateMermaidSource(source)).toMatchObject({ ok: false });
    });

    it("allows the supported sequence note syntax", () => {
        const result = validateMermaidSource("sequenceDiagram\n  A->>B: Hello\n  Note right of B: Readable detail");

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.diagram.model.details).toContain("Note right of B: Readable detail");
        }
    });

    it("counts Cartesian flow edges before admitting the renderer", () => {
        const count = 12;
        const left = Array.from({ length: count }, (_, index) => `A${String(index)}`).join(" & ");
        const right = Array.from({ length: count }, (_, index) => `B${String(index)}`).join(" & ");

        const result = validateMermaidSource(`flowchart LR\n${left} --> ${right}`);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.diagnostic.code).toBe("budget");
            expect(result.diagnostic.message).toContain("relationships");
        }
    });

    it("bounds nesting, details, labels, statements, and source bytes", () => {
        const deep = `flowchart LR\n${Array.from({ length: mermaidPolicy.diagram.maxDepth + 1 }, (_, index) => `subgraph G${String(index)}`).join("\n")}\nA --> B\n${Array.from({ length: mermaidPolicy.diagram.maxDepth + 1 }, () => "end").join("\n")}`;
        const manyNotes = `sequenceDiagram\nparticipant A\n${Array.from({ length: mermaidPolicy.diagram.maxDetails + 1 }, (_, index) => `Note over A: ${String(index)}`).join("\n")}`;
        const manyStatements = `flowchart LR\n${Array.from({ length: mermaidPolicy.diagram.maxStatements + 1 }, (_, index) => `A${String(index)}`).join("\n")}`;
        const largeSource = `flowchart LR\nA[${"x".repeat(mermaidPolicy.diagram.maxBytes)}]`;

        expect(validateMermaidSource(deep)).toMatchObject({ diagnostic: { code: "budget" }, ok: false });
        expect(validateMermaidSource(manyNotes)).toMatchObject({ diagnostic: { code: "budget" }, ok: false });
        expect(validateMermaidSource(manyStatements)).toMatchObject({ diagnostic: { code: "budget" }, ok: false });
        expect(validateMermaidSource(largeSource)).toMatchObject({ diagnostic: { code: "budget" }, ok: false });
    });
});
