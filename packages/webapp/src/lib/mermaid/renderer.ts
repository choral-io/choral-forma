import { parse, register, render } from "pele/core";
import classDiagram from "pele/diagrams/class";
import entityRelationship from "pele/diagrams/er";
import flowchart from "pele/diagrams/flowchart";
import sequence from "pele/diagrams/sequence";
import state from "pele/diagrams/state";

import { mermaidPolicy } from "./policy";
import type { MermaidSynchronousRenderer } from "./worker-runtime";

register(flowchart, state, sequence, classDiagram, entityRelationship);

const namespace = crypto.getRandomValues(new Uint32Array(2)).join("-");
let nextDiagramId = 0;

export const renderMermaidSvg: MermaidSynchronousRenderer = (source, theme) => {
    const statements = source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("%%"));
    const header = statements[0] ?? "";
    // Keep empty diagrams consistent across the five admitted kinds. Pele's
    // class parser rejects an empty body while the previous renderer drew nothing.
    if (
        statements.length === 1 &&
        /^(?:(?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL)|stateDiagram-v2|sequenceDiagram|classDiagram|erDiagram)$/i.test(
            header,
        )
    ) {
        return '<svg xmlns="http://www.w3.org/2000/svg" class="pele pele-empty" viewBox="0 0 0 0" width="0" height="0"></svg>';
    }

    const limits = { limit: mermaidPolicy.diagram.maxBytes, maxEdges: mermaidPolicy.diagram.maxRelations };
    const diagram = /^(?:flowchart|graph)\b/i.test(header) ? parse(source, limits) : source;
    if (typeof diagram !== "string" && diagram.type === "flowchart") {
        const subgraphs = new Set(diagram.subgraphs.map(({ id }) => id));
        // Pele 1.13.0 still misplaces subgraph self-loops. Keep the original source readable.
        if (diagram.edges.some(({ start, end }) => start === end && subgraphs.has(start))) {
            throw new Error("Mermaid flowchart subgraph self-loops cannot be rendered reliably.");
        }
    }

    return render(diagram, {
        ...limits,
        autoDirection: false,
        fontFamily: theme.font,
        fontSize: 14,
        idPrefix: `forma-pele-${namespace}-${String(++nextDiagramId)}`,
        images: false,
        links: false,
        outputLimit: mermaidPolicy.output.maxBytes,
    }).svg;
};
