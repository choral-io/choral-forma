//! Bounded reader-only inline syntax. The compiler still escapes all other raw HTML.
use markdown::mdast::Node;

pub(super) fn prepare(source: &str) -> (String, Vec<(String, String)>) {
    if !source.contains("==") && !source.contains('<') {
        return (source.into(), vec![]);
    }
    let Ok(ast) = markdown::to_mdast(source, &markdown::ParseOptions::gfm()) else {
        return (source.into(), vec![]);
    };
    let protected = math_ranges(source, &ast);
    let mut edits = Vec::new();
    collect(&ast, source, false, &protected, &mut edits);
    let mut prefix = "FORMA_INLINE_TAG_".to_string();
    let decoded = ast.to_string();
    while source.contains(&prefix) || decoded.contains(&prefix) {
        prefix.push('X');
    }
    edits.sort_by_key(|edit| edit.0);
    let mut output = source.to_string();
    let mut replacements = Vec::new();
    for (index, (start, end, tag)) in edits.into_iter().enumerate().rev() {
        let marker = format!(":{prefix}{index}Z:");
        output.replace_range(start..end, &marker);
        replacements.push((marker, tag));
    }
    (output, replacements)
}

fn collect(
    node: &Node,
    source: &str,
    inline: bool,
    protected: &[(usize, usize)],
    edits: &mut Vec<(usize, usize, String)>,
) {
    let container = matches!(
        node,
        Node::Paragraph(_) | Node::Heading(_) | Node::TableCell(_)
    );
    if container {
        highlights(node, source, protected, edits);
    }
    if inline
        && let Node::Html(html) = node
        && let Some(span) = &html.position
        && !protected
            .iter()
            .any(|&(a, b)| span.start.offset >= a && span.start.offset < b)
    {
        let raw = html.value.trim();
        if let Some(body) = raw.strip_prefix('<').and_then(|s| s.strip_suffix('>')) {
            let normalized = body.trim().to_ascii_lowercase();
            if ["mark", "/mark", "sub", "/sub", "sup", "/sup"].contains(&normalized.as_str()) {
                edits.push((
                    span.start.offset,
                    span.end.offset,
                    format!("<{normalized}>"),
                ));
            }
        }
    }
    if matches!(node, Node::Code(_) | Node::InlineCode(_) | Node::Html(_)) {
        return;
    }
    if let Some(children) = node.children() {
        for child in children {
            collect(child, source, inline || container, protected, edits);
        }
    }
}

fn text_ranges(node: &Node, ranges: &mut Vec<(usize, usize)>) {
    if let Node::Text(text) = node
        && let Some(span) = &text.position
    {
        ranges.push((span.start.offset, span.end.offset));
    }
    if let Some(children) = node.children() {
        for child in children {
            text_ranges(child, ranges);
        }
    }
}
fn crosses(node: &Node, start: usize, end: usize) -> bool {
    if !matches!(node, Node::Text(_))
        && let Some(span) = node.position()
    {
        let (a, b) = (span.start.offset, span.end.offset);
        let opening_inside = a <= start - 2 && start - 2 < b;
        let closing_inside = a <= end && end < b;
        if opening_inside != closing_inside {
            return true;
        }
    }
    node.children()
        .is_some_and(|children| children.iter().any(|child| crosses(child, start, end)))
}
fn highlights(
    node: &Node,
    source: &str,
    protected: &[(usize, usize)],
    edits: &mut Vec<(usize, usize, String)>,
) {
    let Some(span) = node.position() else {
        return;
    };
    let mut text = Vec::new();
    text_ranges(node, &mut text);
    let bytes = source.as_bytes();
    let eligible = |i: usize| {
        bytes.get(i..i + 2) == Some(b"==")
            && text.iter().any(|&(a, b)| i >= a && i + 1 < b)
            && !protected.iter().any(|&(a, b)| i >= a && i < b)
            && (i == 0 || bytes[i - 1] != b'=')
            && bytes.get(i + 2) != Some(&b'=')
            && bytes[..i].iter().rev().take_while(|&&c| c == b'\\').count() % 2 == 0
    };
    let mut opening = None;
    let mut i = span.start.offset;
    while i + 1 < span.end.offset {
        if bytes[i] == b'\n' {
            opening = None;
        }
        if eligible(i) {
            if let Some(start) = opening
                && !source[..i]
                    .chars()
                    .next_back()
                    .is_some_and(char::is_whitespace)
                && !crosses(node, start + 2, i)
            {
                edits.push((start, start + 2, "<mark>".into()));
                edits.push((i, i + 2, "</mark>".into()));
                opening = None;
                i += 2;
                continue;
            }
            if opening.is_none()
                && source
                    .get(i + 2..)
                    .and_then(|s| s.chars().next())
                    .is_some_and(|c| !c.is_whitespace())
            {
                opening = Some(i);
            }
        }
        i += 1;
    }
}

fn math_ranges(source: &str, base: &Node) -> Vec<(usize, usize)> {
    if !source.contains('$') {
        return vec![];
    }
    fn inline(node: &Node, source: &str, out: &mut Vec<(usize, usize)>) {
        if let Node::InlineMath(_) = node
            && let Some(span) = node.position()
        {
            let (a, b) = (span.start.offset, span.end.offset);
            let raw = &source[a..b];
            if raw.starts_with("$$") {
                out.push((a, b));
            } else if let Some(math) = raw.strip_prefix('$').and_then(|s| s.strip_suffix('$')) {
                let first = math.chars().next();
                let last = math.chars().next_back();
                if !math.is_empty()
                    && !first.is_some_and(char::is_whitespace)
                    && !last.is_some_and(char::is_whitespace)
                    && !math.contains(['\n', '`'])
                    && !math.contains("\\$")
                    && !(first.is_some_and(|c| c.is_ascii_digit())
                        && source[b..]
                            .chars()
                            .next()
                            .is_some_and(|c| c.is_ascii_digit()))
                {
                    out.push((a, b));
                }
            }
        }
        if let Some(children) = node.children() {
            for child in children {
                inline(child, source, out);
            }
        }
    }
    let mut result = Vec::new();
    let mut options = markdown::ParseOptions::gfm();
    options.constructs.math_text = true;
    if let Ok(ast) = markdown::to_mdast(source, &options) {
        inline(&ast, source, &mut result);
    }

    // math-rs accepts arbitrary flow metadata after $$. Mask those openers only
    // for this protection pass, so a one-line expression cannot swallow later blocks.
    let mut ranges = Vec::new();
    text_ranges(base, &mut ranges);
    let mut flow = source.as_bytes().to_vec();
    for (start, end) in ranges {
        for i in start..end.saturating_sub(1) {
            if source.as_bytes().get(i..i + 2) == Some(b"$$") {
                let tail = source[i + 2..].split('\n').next().unwrap_or("");
                if !tail.trim().is_empty() {
                    flow[i] = b':';
                }
            }
        }
    }
    fn blocks(node: &Node, source: &str, out: &mut Vec<(usize, usize)>) {
        if let Node::Math(math) = node
            && let Some(span) = node.position()
        {
            let raw = &source[span.start.offset..span.end.offset];
            if raw
                .lines()
                .last()
                .is_some_and(|s| s.trim_end().ends_with("$$"))
                && !math.value.trim_end().ends_with("$$")
            {
                out.push((span.start.offset, span.end.offset));
            }
        }
        if let Some(children) = node.children() {
            for child in children {
                blocks(child, source, out);
            }
        }
    }
    let flow = String::from_utf8(flow).expect("only ASCII dollars were replaced");
    let mut options = markdown::ParseOptions::gfm();
    options.constructs.math_flow = true;
    if let Ok(ast) = markdown::to_mdast(&flow, &options) {
        blocks(&ast, source, &mut result);
    }
    result
}

/// Display labels omit recognized inline delimiters without changing source spans.
pub(crate) fn label_source(source: &str) -> String {
    let (mut prepared, tags) = prepare(source);
    for (marker, _) in tags {
        prepared = prepared.replace(&marker, "");
    }
    prepared
}

/// Restore only compiler text, never attributes such as an authored link destination.
pub(super) fn restore(html: &str, tags: &[(String, String)]) -> String {
    let mut output = String::new();
    let mut rest = html;
    while !rest.is_empty() {
        let end = rest.find('<').unwrap_or(rest.len());
        let mut text = rest[..end].to_string();
        for (marker, tag) in tags {
            text = text.replace(marker, tag);
        }
        output.push_str(&text);
        rest = &rest[end..];
        if rest.is_empty() {
            break;
        }
        let end = rest.find('>').map_or(rest.len(), |i| i + 1);
        output.push_str(&rest[..end]);
        rest = &rest[end..];
    }
    output
}
