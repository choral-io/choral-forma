import { register, render } from "pele/core";
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
    // Keep empty diagrams consistent across the five admitted kinds. Pele's
    // class parser rejects an empty body while the previous renderer drew nothing.
    if (
        statements.length === 1 &&
        /^(?:(?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL)|stateDiagram-v2|sequenceDiagram|classDiagram|erDiagram)$/i.test(
            statements[0] ?? "",
        )
    ) {
        return '<svg xmlns="http://www.w3.org/2000/svg" class="pele pele-empty" viewBox="0 0 0 0" width="0" height="0"></svg>';
    }

    return render(source, {
        autoDirection: false,
        fontFamily: theme.font,
        fontSize: 14,
        idPrefix: `forma-pele-${namespace}-${String(++nextDiagramId)}`,
        images: false,
        limit: mermaidPolicy.diagram.maxBytes,
        links: false,
        maxEdges: mermaidPolicy.diagram.maxRelations,
        outputLimit: mermaidPolicy.output.maxBytes,
    }).svg;
};
