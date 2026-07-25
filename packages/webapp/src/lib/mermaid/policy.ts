export const mermaidPolicy = {
    diagram: {
        maxBytes: 16 * 1024,
        maxStatements: 128,
        maxStructuralNodes: 64,
        maxRelations: 128,
        maxGroups: 16,
        maxDepth: 4,
        maxDetails: 128,
        maxLabelBytes: 8 * 1024,
    },
    output: {
        maxBytes: 512 * 1024,
        maxElements: 5_000,
    },
    scope: {
        maxDiagrams: 8,
        maxSourceBytes: 64 * 1024,
        maxStatements: 512,
        maxStructuralNodes: 256,
        maxRelations: 512,
        maxOutputBytes: 2 * 1024 * 1024,
        timeoutMs: 4_000,
    },
    worker: {
        timeoutMs: 2_000,
    },
} as const;

export const mermaidDiagramKinds = ["flowchart", "state", "sequence", "class", "entity relationship"] as const;

export type MermaidDiagramKind = (typeof mermaidDiagramKinds)[number];

export interface MermaidRelation {
    from: string;
    label?: string;
    to: string;
}

export interface MermaidSemanticModel {
    details: string[];
    kind: MermaidDiagramKind;
    labels: string[];
    relations: MermaidRelation[];
}

export interface MermaidMetrics {
    bytes: number;
    depth: number;
    details: number;
    groups: number;
    labelBytes: number;
    relations: number;
    statements: number;
    structuralNodes: number;
}

export interface ValidatedMermaidDiagram {
    metrics: MermaidMetrics;
    model: MermaidSemanticModel;
    source: string;
}

export interface MermaidPolicyDiagnostic {
    code: "budget" | "syntax" | "unsupported";
    line?: number;
    message: string;
}

export type MermaidValidationResult =
    { diagram: ValidatedMermaidDiagram; ok: true } | { diagnostic: MermaidPolicyDiagnostic; ok: false };

interface SourceLine {
    number: number;
    text: string;
}

interface ModelBuilder {
    details: string[];
    groups: number;
    kind: MermaidDiagramKind;
    labels: Map<string, string>;
    maxDepth: number;
    relations: MermaidRelation[];
}

const textEncoder = new TextEncoder();
const forbiddenDirective =
    /^(?:%%\{|accTitle\b|accDescr\b|click\b|callback\b|call\b|href\b|link\b|activate\b|deactivate\b)/i;
const identifierPattern = String.raw`[\w\p{L}-]+`;

export function validateMermaidSource(source: string): MermaidValidationResult {
    const sourceBytes = byteLength(source);
    if (sourceBytes > mermaidPolicy.diagram.maxBytes) {
        return invalid("budget", `Diagram source exceeds ${String(mermaidPolicy.diagram.maxBytes)} bytes.`);
    }

    const lines = source
        .split(/\r?\n/)
        .map((text, index) => ({ number: index + 1, text: text.trim() }))
        .filter((line) => line.text.length > 0 && !line.text.startsWith("%%"));
    if (lines.length === 0) {
        return invalid("syntax", "The diagram is empty.");
    }

    const forbidden = source
        .split(/\r?\n/)
        .map((text, index) => ({ number: index + 1, text: text.trim() }))
        .find((line) => forbiddenDirective.test(line.text));
    if (forbidden) {
        return invalid("unsupported", `Unsupported Mermaid directive: ${forbidden.text}`, forbidden.number);
    }

    const [header, ...statements] = lines;
    if (!header) {
        return invalid("syntax", "The diagram is empty.");
    }
    if (statements.length > mermaidPolicy.diagram.maxStatements) {
        return invalid("budget", `Diagram exceeds ${String(mermaidPolicy.diagram.maxStatements)} statements.`);
    }

    const builder = createBuilder(header.text);
    if (!builder) {
        return invalid("unsupported", `Unsupported Mermaid header: ${header.text}`, header.number);
    }

    const diagnostic = parseStatements(builder, statements);
    if (diagnostic) {
        return { diagnostic, ok: false };
    }

    const metrics: MermaidMetrics = {
        bytes: sourceBytes,
        depth: builder.maxDepth,
        details: builder.details.length,
        groups: builder.groups,
        labelBytes: byteLength([...builder.labels.values(), ...builder.details].join("\n")),
        relations: builder.relations.length,
        statements: statements.length,
        structuralNodes: builder.labels.size,
    };
    const budgetDiagnostic = validateMetrics(metrics);
    if (budgetDiagnostic) {
        return { diagnostic: budgetDiagnostic, ok: false };
    }

    return {
        diagram: {
            metrics,
            model: {
                details: builder.details,
                kind: builder.kind,
                labels: [...builder.labels.values()],
                relations: builder.relations,
            },
            source,
        },
        ok: true,
    };
}

export function describeMermaidDiagram(diagram: ValidatedMermaidDiagram) {
    const { metrics, model } = diagram;
    const parts = [
        `${displayKind(model.kind)} with ${String(metrics.structuralNodes)} ${plural(metrics.structuralNodes, "item")} and ${String(metrics.relations)} ${plural(metrics.relations, "relationship")}.`,
    ];
    if (model.labels.length > 0) {
        parts.push(`Items: ${boundedList(model.labels)}.`);
    }
    if (model.relations.length > 0) {
        parts.push(
            `Relationships: ${boundedList(
                model.relations.map(({ from, label, to }) => `${from} to ${to}${label ? ` (${label})` : ""}`),
            )}.`,
        );
    }
    if (model.details.length > 0) {
        parts.push(`Details: ${boundedList(model.details)}.`);
    }
    return parts.join(" ");
}

function createBuilder(header: string): ModelBuilder | undefined {
    let kind: MermaidDiagramKind | undefined;
    if (/^(?:flowchart|graph)\s+(?:TB|TD|BT|LR|RL)$/i.test(header)) {
        kind = "flowchart";
    } else if (/^stateDiagram-v2$/i.test(header)) {
        kind = "state";
    } else if (/^sequenceDiagram$/i.test(header)) {
        kind = "sequence";
    } else if (/^classDiagram$/i.test(header)) {
        kind = "class";
    } else if (/^erDiagram$/i.test(header)) {
        kind = "entity relationship";
    }
    return kind
        ? {
              details: [],
              groups: 0,
              kind,
              labels: new Map(),
              maxDepth: 0,
              relations: [],
          }
        : undefined;
}

function parseStatements(builder: ModelBuilder, lines: SourceLine[]) {
    switch (builder.kind) {
        case "flowchart":
            return parseFlowchart(builder, lines);
        case "state":
            return parseState(builder, lines);
        case "sequence":
            return parseSequence(builder, lines);
        case "class":
            return parseClass(builder, lines);
        case "entity relationship":
            return parseEntityRelationship(builder, lines);
    }
}

function parseFlowchart(builder: ModelBuilder, lines: SourceLine[]): MermaidPolicyDiagnostic | undefined {
    const stack: string[] = [];
    for (const line of lines) {
        const subgraph = /^subgraph\s+(?:(?<id>[\w-]+)\s*\[(?<namedLabel>.+)\]|(?<label>.+))$/.exec(line.text);
        if (subgraph?.groups) {
            const label = subgraph.groups.namedLabel ?? subgraph.groups.label ?? subgraph.groups.id ?? "Subgraph";
            stack.push(label);
            builder.groups += 1;
            builder.maxDepth = Math.max(builder.maxDepth, stack.length);
            continue;
        }
        if (line.text === "end") {
            if (!stack.pop()) {
                return syntax(line, "Unexpected end statement.");
            }
            continue;
        }
        if (/^direction\s+(?:TB|TD|BT|LR|RL)$/i.test(line.text)) {
            if (stack.length === 0) {
                return syntax(line, "A flowchart direction override is only supported inside a subgraph.");
            }
            continue;
        }
        if (/^(?:classDef|class|style|linkStyle)\b/.test(line.text)) {
            return unsupported(line, "Flowchart styling directives are outside Forma's supported subset.");
        }

        const parsed = parseFlowNodeLine(line.text);
        if (!parsed) {
            return syntax(line, "Unsupported or malformed flowchart statement.");
        }
        for (const node of parsed.nodes) {
            addLabel(builder, node.id, node.label);
        }
        builder.relations.push(...parsed.relations);
    }
    if (stack.length > 0) {
        return syntax(lines.at(-1), `Unclosed subgraph: ${stack.at(-1) ?? "unknown"}.`);
    }
}

interface ParsedFlowNodeLine {
    nodes: { id: string; label: string }[];
    relations: MermaidRelation[];
}

const flowNodePatterns = [
    /^([\w-]+)\(\(\((.+?)\)\)\)/,
    /^([\w-]+)\(\[(.+?)\]\)/,
    /^([\w-]+)\(\((.+?)\)\)/,
    /^([\w-]+)\[\[(.+?)\]\]/,
    /^([\w-]+)\[\((.+?)\)\]/,
    /^([\w-]+)\[\/(.+?)\\\]/,
    /^([\w-]+)\[\\(.+?)\/\]/,
    /^([\w-]+)>(.+?)\]/,
    /^([\w-]+)\{\{(.+?)\}\}/,
    /^([\w-]+)\[(.+?)\]/,
    /^([\w-]+)\((.+?)\)/,
    /^([\w-]+)\{(.+?)\}/,
] as const;
const flowArrowPattern = /^(?:<)?(?:-->|-\.->|==>|---|-\.-|===)(?:\|([^|]*)\|)?/;
const flowTextArrowPattern = /^(?:<)?(?:--|-\.|==)\s+(.+?)\s+(?:-->|---|\.->|-\.-|==>|===)/;

function parseFlowNodeLine(text: string): ParsedFlowNodeLine | undefined {
    let remaining = text.trim();
    const nodes: ParsedFlowNodeLine["nodes"] = [];
    const relations: MermaidRelation[] = [];
    const first = consumeFlowNodeGroup(remaining, nodes);
    if (!first) {
        return undefined;
    }
    remaining = first.remaining.trim();
    let previous = first.ids;
    while (remaining.length > 0) {
        const arrow = flowArrowPattern.exec(remaining) ?? flowTextArrowPattern.exec(remaining);
        if (!arrow) {
            return undefined;
        }
        const label = arrow[1]?.trim();
        remaining = remaining.slice(arrow[0].length).trim();
        const next = consumeFlowNodeGroup(remaining, nodes);
        if (!next) {
            return undefined;
        }
        remaining = next.remaining.trim();
        for (const from of previous) {
            for (const to of next.ids) {
                relations.push({ from, label, to });
                if (relations.length > mermaidPolicy.diagram.maxRelations) {
                    return { nodes, relations };
                }
            }
        }
        previous = next.ids;
    }
    return { nodes, relations };
}

function consumeFlowNodeGroup(text: string, nodes: ParsedFlowNodeLine["nodes"]) {
    const first = consumeFlowNode(text);
    if (!first) {
        return undefined;
    }
    nodes.push(first.node);
    const ids = [first.node.id];
    let remaining = first.remaining.trim();
    while (remaining.startsWith("&")) {
        const next = consumeFlowNode(remaining.slice(1).trim());
        if (!next) {
            return undefined;
        }
        nodes.push(next.node);
        ids.push(next.node.id);
        remaining = next.remaining.trim();
    }
    return { ids, remaining };
}

function consumeFlowNode(text: string) {
    for (const pattern of flowNodePatterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                node: { id: match[1] ?? "", label: normalizeLabel(match[2] ?? match[1] ?? "") },
                remaining: text.slice(match[0].length),
            };
        }
    }
    const bare = /^([\w-]+)/.exec(text);
    return bare
        ? {
              node: { id: bare[1] ?? "", label: bare[1] ?? "" },
              remaining: text.slice(bare[0].length),
          }
        : undefined;
}

function parseState(builder: ModelBuilder, lines: SourceLine[]): MermaidPolicyDiagnostic | undefined {
    const stack: string[] = [];
    let pseudoState = 0;
    for (const line of lines) {
        if (/^direction\s+(?:TB|TD|BT|LR|RL)$/i.test(line.text)) {
            continue;
        }
        const composite = new RegExp(`^state\\s+(?:"([^"]+)"\\s+as\\s+)?(${identifierPattern})\\s*\\{$`, "u").exec(
            line.text,
        );
        if (composite) {
            const id = composite[2] ?? "";
            addLabel(builder, id, normalizeLabel(composite[1] ?? id));
            stack.push(id);
            builder.groups += 1;
            builder.maxDepth = Math.max(builder.maxDepth, stack.length);
            continue;
        }
        if (line.text === "}") {
            if (!stack.pop()) {
                return syntax(line, "Unexpected state block terminator.");
            }
            continue;
        }
        const alias = new RegExp(`^state\\s+"([^"]+)"\\s+as\\s+(${identifierPattern})$`, "u").exec(line.text);
        if (alias) {
            addLabel(builder, alias[2] ?? "", normalizeLabel(alias[1] ?? ""));
            continue;
        }
        const transition = new RegExp(
            `^(\\[\\*\\]|${identifierPattern})\\s*-->\\s*(\\[\\*\\]|${identifierPattern})(?:\\s*:\\s*(.+))?$`,
            "u",
        ).exec(line.text);
        if (transition) {
            const from = stateId(transition[1] ?? "", () => `Start ${String(++pseudoState)}`);
            const to = stateId(transition[2] ?? "", () => `End ${String(++pseudoState)}`);
            addLabel(builder, from, from);
            addLabel(builder, to, to);
            builder.relations.push({ from, label: normalizeOptionalLabel(transition[3]), to });
            continue;
        }
        const description = new RegExp(`^(${identifierPattern})\\s*:\\s*(.+)$`, "u").exec(line.text);
        if (description) {
            addLabel(builder, description[1] ?? "", normalizeLabel(description[2] ?? ""));
            continue;
        }
        return syntax(line, "Unsupported or malformed state diagram statement.");
    }
    if (stack.length > 0) {
        return syntax(lines.at(-1), `Unclosed composite state: ${stack.at(-1) ?? "unknown"}.`);
    }
}

function parseSequence(builder: ModelBuilder, lines: SourceLine[]): MermaidPolicyDiagnostic | undefined {
    const stack: string[] = [];
    for (const line of lines) {
        const actor = /^(participant|actor)\s+(\S+?)(?:\s+as\s+(.+))?$/.exec(line.text);
        if (actor) {
            addLabel(builder, actor[2] ?? "", normalizeLabel(actor[3] ?? actor[2] ?? ""));
            continue;
        }
        const note = /^Note\s+(left of|right of|over)\s+([^:]+):\s*(.+)$/i.exec(line.text);
        if (note) {
            const actorIds = (note[2] ?? "")
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean);
            const validCount =
                note[1]?.toLowerCase() === "over"
                    ? actorIds.length >= 1 && actorIds.length <= 2
                    : actorIds.length === 1;
            if (!validCount) {
                return syntax(
                    line,
                    "A sequence note must reference one actor, or at most two actors when placed over them.",
                );
            }
            actorIds.forEach((id) => {
                addLabel(builder, id, id);
            });
            builder.details.push(
                `Note ${note[1] ?? "over"} ${actorIds.join(" and ")}: ${normalizeLabel(note[3] ?? "")}`,
            );
            continue;
        }
        const block = /^(loop|alt|opt|par|critical|break|rect)(?:\s+(.*))?$/.exec(line.text);
        if (block) {
            stack.push(block[1] ?? "");
            builder.groups += 1;
            builder.maxDepth = Math.max(builder.maxDepth, stack.length);
            if (block[2]) {
                builder.details.push(`${block[1] ?? "block"}: ${normalizeLabel(block[2])}`);
            }
            continue;
        }
        const divider = /^(else|and)(?:\s+(.*))?$/.exec(line.text);
        if (divider) {
            const expected = divider[1] === "else" ? "alt" : "par";
            if (stack.at(-1) !== expected) {
                return syntax(line, `${divider[1] ?? "Divider"} is only supported inside ${expected}.`);
            }
            if (divider[2]) {
                builder.details.push(`${divider[1] ?? "divider"}: ${normalizeLabel(divider[2])}`);
            }
            continue;
        }
        if (line.text === "end") {
            if (!stack.pop()) {
                return syntax(line, "Unexpected sequence block terminator.");
            }
            continue;
        }
        const message = /^(\S+?)\s*(->>|-->>|-\)|--\)|-x|--x|->|-->)\s*([+-]?)(\S+?)\s*:\s*(.+)$/.exec(line.text);
        if (message) {
            const from = message[1] ?? "";
            const to = message[4] ?? "";
            addLabel(builder, from, from);
            addLabel(builder, to, to);
            builder.relations.push({ from, label: normalizeLabel(message[5] ?? ""), to });
            continue;
        }
        return syntax(line, "Unsupported or malformed sequence diagram statement.");
    }
    if (stack.length > 0) {
        return syntax(lines.at(-1), `Unclosed sequence block: ${stack.at(-1) ?? "unknown"}.`);
    }
}

function parseClass(builder: ModelBuilder, lines: SourceLine[]): MermaidPolicyDiagnostic | undefined {
    let currentClass: string | undefined;
    let namespace: string | undefined;
    for (const line of lines) {
        if (currentClass) {
            if (line.text === "}") {
                currentClass = undefined;
                continue;
            }
            if (/^<<\w+>>$/.test(line.text) || isClassMember(line.text)) {
                builder.details.push(`${currentClass}: ${normalizeLabel(line.text.replace(/;$/, ""))}`);
                continue;
            }
            return syntax(line, "Unsupported or malformed class member.");
        }
        const namespaceStart = /^namespace\s+(\S+)\s*\{$/.exec(line.text);
        if (namespaceStart) {
            if (namespace) {
                return unsupported(line, "Nested class namespaces are not supported.");
            }
            namespace = namespaceStart[1] ?? "";
            builder.groups += 1;
            builder.maxDepth = Math.max(builder.maxDepth, 1);
            continue;
        }
        if (line.text === "}") {
            if (!namespace) {
                return syntax(line, "Unexpected class diagram block terminator.");
            }
            namespace = undefined;
            continue;
        }
        const classStart = /^class\s+(\S+?)(?:\s*~(\w+)~)?\s*\{$/.exec(line.text);
        if (classStart) {
            currentClass = classStart[1] ?? "";
            addLabel(builder, currentClass, classStart[2] ? `${currentClass}<${classStart[2]}>` : currentClass);
            builder.groups += 1;
            builder.maxDepth = Math.max(builder.maxDepth, namespace ? 2 : 1);
            continue;
        }
        const inlineAnnotation = /^class\s+(\S+?)\s*\{\s*<<(\w+)>>\s*\}$/.exec(line.text);
        if (inlineAnnotation) {
            addLabel(builder, inlineAnnotation[1] ?? "", inlineAnnotation[1] ?? "");
            builder.details.push(`${inlineAnnotation[1] ?? "class"}: ${inlineAnnotation[2] ?? "annotation"}`);
            continue;
        }
        const classOnly = /^class\s+(\S+?)(?:\s*~(\w+)~)?$/.exec(line.text);
        if (classOnly) {
            const id = classOnly[1] ?? "";
            addLabel(builder, id, classOnly[2] ? `${id}<${classOnly[2]}>` : id);
            continue;
        }
        const inlineMember = /^(\S+?)\s*:\s*(.+)$/.exec(line.text);
        if (inlineMember && isClassMember(inlineMember[2] ?? "")) {
            const id = inlineMember[1] ?? "";
            addLabel(builder, id, id);
            builder.details.push(`${id}: ${normalizeLabel(inlineMember[2] ?? "")}`);
            continue;
        }
        const relationship =
            /^(\S+?)\s+(?:"([^"]*?)"\s+)?(<\|--|<\|\.\.|\*--|o--|-->|--\*|--o|--\|>|\.\.>|\.\.\|>|<--|<\.\.?|--)\s+(?:"([^"]*?)"\s+)?(\S+?)(?:\s*:\s*(.+))?$/.exec(
                line.text,
            );
        if (relationship) {
            const from = relationship[1] ?? "";
            const to = relationship[5] ?? "";
            addLabel(builder, from, from);
            addLabel(builder, to, to);
            builder.relations.push({ from, label: normalizeOptionalLabel(relationship[6]), to });
            continue;
        }
        return syntax(line, "Unsupported or malformed class diagram statement.");
    }
    if (currentClass) {
        return syntax(lines.at(-1), `Unclosed class body: ${currentClass}.`);
    }
    if (namespace) {
        return syntax(lines.at(-1), `Unclosed namespace: ${namespace}.`);
    }
}

function parseEntityRelationship(builder: ModelBuilder, lines: SourceLine[]): MermaidPolicyDiagnostic | undefined {
    let currentEntity: string | undefined;
    for (const line of lines) {
        if (currentEntity) {
            if (line.text === "}") {
                currentEntity = undefined;
                continue;
            }
            const attribute = /^(\S+)\s+(\S+)(?:\s+(?:(?:PK|FK|UK)(?:\s+(?:PK|FK|UK))*))?(?:\s+"[^"]*")?$/i.exec(
                line.text,
            );
            if (!attribute) {
                return syntax(line, "Unsupported or malformed entity attribute.");
            }
            builder.details.push(`${currentEntity}: ${attribute[1] ?? ""} ${attribute[2] ?? ""}`.trim());
            continue;
        }
        const entity = /^(\S+)\s*\{$/.exec(line.text);
        if (entity) {
            currentEntity = entity[1] ?? "";
            addLabel(builder, currentEntity, currentEntity);
            builder.groups += 1;
            builder.maxDepth = Math.max(builder.maxDepth, 1);
            continue;
        }
        const relationship = /^(\S+)\s+([|o}{]+(?:--|\.\.)[|o}{]+)\s+(\S+)\s*:\s*(.+)$/.exec(line.text);
        if (relationship && validErCardinality(relationship[2] ?? "")) {
            const from = relationship[1] ?? "";
            const to = relationship[3] ?? "";
            addLabel(builder, from, from);
            addLabel(builder, to, to);
            builder.relations.push({ from, label: normalizeLabel(relationship[4] ?? ""), to });
            continue;
        }
        return syntax(line, "Unsupported or malformed entity relationship statement.");
    }
    if (currentEntity) {
        return syntax(lines.at(-1), `Unclosed entity body: ${currentEntity}.`);
    }
}

function validateMetrics(metrics: MermaidMetrics): MermaidPolicyDiagnostic | undefined {
    const limits: [number, number, string][] = [
        [metrics.statements, mermaidPolicy.diagram.maxStatements, "statements"],
        [metrics.structuralNodes, mermaidPolicy.diagram.maxStructuralNodes, "structural items"],
        [metrics.relations, mermaidPolicy.diagram.maxRelations, "relationships"],
        [metrics.groups, mermaidPolicy.diagram.maxGroups, "groups"],
        [metrics.depth, mermaidPolicy.diagram.maxDepth, "nesting depth"],
        [metrics.details, mermaidPolicy.diagram.maxDetails, "details"],
        [metrics.labelBytes, mermaidPolicy.diagram.maxLabelBytes, "label bytes"],
    ];
    const exceeded = limits.find(([value, limit]) => value > limit);
    return exceeded
        ? {
              code: "budget",
              message: `Diagram exceeds the ${String(exceeded[1])} ${exceeded[2]} limit.`,
          }
        : undefined;
}

function addLabel(builder: ModelBuilder, id: string, label: string) {
    if (!builder.labels.has(id)) {
        builder.labels.set(id, normalizeLabel(label || id));
    }
}

function isClassMember(value: string) {
    const member = value.trim().replace(/;$/, "");
    return /^[+\-#~]?(?:[\w$*]+\([^)]*\)(?:\s+[\w.<>,[\]?]+)?|[\w.<>,[\]?]+(?:\s+[\w$*]+)+)$/u.test(member);
}

function validErCardinality(value: string) {
    const match = /^([|o}{]+)(--|\.\.)([|o}{]+)$/.exec(value);
    return Boolean(match && validCardinality(match[1] ?? "") && validCardinality(match[3] ?? ""));
}

function validCardinality(value: string) {
    return new Set(["||", "o|", "|o", "}|", "|{", "o{", "{o"]).has(value);
}

function stateId(value: string, pseudo: () => string) {
    return value === "[*]" ? pseudo() : value;
}

function normalizeOptionalLabel(value: string | undefined) {
    return value ? normalizeLabel(value) : undefined;
}

function normalizeLabel(value: string) {
    return value
        .replace(/<br\s*\/?>/gi, " / ")
        .replace(/\s+/g, " ")
        .trim();
}

function byteLength(value: string) {
    return textEncoder.encode(value).byteLength;
}

function invalid(code: MermaidPolicyDiagnostic["code"], message: string, line?: number): MermaidValidationResult {
    return { diagnostic: { code, line, message }, ok: false };
}

function syntax(line: SourceLine | undefined, message: string): MermaidPolicyDiagnostic {
    return { code: "syntax", line: line?.number, message };
}

function unsupported(line: SourceLine, message: string): MermaidPolicyDiagnostic {
    return { code: "unsupported", line: line.number, message };
}

function boundedList(values: string[]) {
    const unique = [...new Set(values.map(normalizeLabel).filter(Boolean))];
    const selected: string[] = [];
    let length = 0;
    for (const value of unique) {
        if (selected.length >= 12 || length + value.length > 600) {
            break;
        }
        selected.push(value);
        length += value.length;
    }
    return (
        selected.join(", ") +
        (selected.length < unique.length ? `, and ${String(unique.length - selected.length)} more` : "")
    );
}

function displayKind(kind: MermaidDiagramKind) {
    switch (kind) {
        case "flowchart":
            return "Flowchart";
        case "state":
            return "State diagram";
        case "sequence":
            return "Sequence diagram";
        case "class":
            return "Class diagram";
        case "entity relationship":
            return "Entity relationship diagram";
    }
}

function plural(count: number, singular: string) {
    return count === 1 ? singular : `${singular}s`;
}
