/** Additive readable anchors. Existing host heading IDs remain authoritative. */
export function createMarkdownHeadingAnchor() {
    const used = new Set<string>();
    return (text: string) => {
        const slug =
            text
                .trim()
                .toLowerCase()
                .replace(/[^\p{Alphabetic}\p{N}]+/gu, "-")
                .replace(/^-+|-+$/g, "") || "section";
        const base = `forma-heading-${slug}`;
        let id = base;
        let count = 2;
        while (used.has(id)) id = `${base}-${String(count++)}`;
        used.add(id);
        return id;
    };
}

/** Match Core's historical footnote ID normalization, rather than a parser's URL encoder. */
export function markdownFootnoteLabelId(label: string) {
    const value = Array.from(
        label
            .replace(/[\t\n\r ]+/gu, " ")
            .trim()
            .toUpperCase()
            .toLowerCase(),
    );
    let result = "";
    for (let index = 0; index < value.length; index++) {
        const character = value[index] ?? "";
        if (character === "%" && /^[a-z0-9]{2}$/iu.test(`${value[index + 1] ?? ""}${value[index + 2] ?? ""}`)) {
            result += value.slice(index, index + 3).join("");
            index += 2;
        } else if (/^[!#$&-;=?-Z_a-z~]$/u.test(character)) {
            result += character;
        } else {
            result += encodeURIComponent(character);
        }
    }
    return result;
}
