//! Portable native disclosures without enabling arbitrary raw HTML compilation.
use markdown::mdast::Node;

pub(super) fn prepare(markdown: &str) -> (String, Vec<(String, String)>) {
    let source = markdown.replace("\r\n", "\n").replace('\r', "\n");
    if !source.to_ascii_lowercase().contains("<details") {
        return (source, vec![]);
    }
    let Ok(ast) = markdown::to_mdast(&source, &markdown::ParseOptions::gfm()) else {
        return (source, vec![]);
    };
    let ranges = ast
        .children()
        .into_iter()
        .flatten()
        .filter_map(|node| {
            if let Node::Html(html) = node
                && let Some(span) = &html.position
            {
                Some(HtmlRange {
                    start: span.start.offset,
                    end: span.end.offset,
                    portable: is_disclosure_html(&html.value),
                })
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    struct Line<'a> {
        start: usize,
        raw: &'a str,
        text: &'a str,
    }
    let mut offset = 0;
    let lines = source
        .split_inclusive('\n')
        .map(|raw| {
            let line = Line {
                start: offset,
                raw,
                text: raw.strip_suffix('\n').unwrap_or(raw),
            };
            offset += raw.len();
            line
        })
        .collect::<Vec<_>>();
    let events = scan_disclosure_tags(&source, &ranges);
    let summaries = events
        .iter()
        .filter(|event| event.summary && event.portable)
        .map(|event| event.start)
        .collect::<std::collections::BTreeSet<_>>();
    struct Frame {
        start: usize,
        header: usize,
        end: usize,
        title: String,
        open: bool,
        valid: bool,
        closed: bool,
        parent: Option<usize>,
    }
    let mut frames = Vec::<Frame>::new();
    let mut stack = Vec::<usize>::new();
    for event in events.iter().filter(|event| !event.summary) {
        let i = lines.partition_point(|line| line.start <= event.start) - 1;
        let line = &lines[i];
        let text = unindent(line.text);
        let own_line = text.is_some_and(|text| {
            event.start == line.start + line.text.len() - line.text.trim_start_matches(' ').len()
                && !text.starts_with('\t')
        });
        let lower = text.unwrap_or("").to_ascii_lowercase();
        if !event.closing {
            let mut summary = i + 1;
            while lines
                .get(summary)
                .is_some_and(|line| line.text.trim_matches([' ', '\t']).is_empty())
            {
                summary += 1;
            }
            let label = lines
                .get(summary)
                .and_then(|line| unindent(line.text))
                .and_then(|text| {
                    let lower = text.to_ascii_lowercase();
                    (lower.starts_with("<summary>") && lower.ends_with("</summary>"))
                        .then(|| text[9..text.len() - 10].trim())
                });
            let attributes = lower
                .strip_prefix("<details")
                .and_then(|rest| rest.strip_suffix('>'))
                .map(|s| s.trim_matches([' ', '\t']));
            let title = decode_title(label.unwrap_or(""))
                .trim_matches(|c: char| c.is_whitespace() || c == '\u{feff}')
                .to_owned();
            let valid = event.portable
                && own_line
                && matches!(attributes, Some("" | "open"))
                && !title.is_empty()
                && lines.get(summary).is_some_and(|line| {
                    summaries.contains(
                        &(line.start + line.text.len() - line.text.trim_start_matches(' ').len()),
                    )
                })
                && lines
                    .get(summary + 1)
                    .is_some_and(|line| line.text.trim_matches([' ', '\t']).is_empty())
                && stack.len() < 16;
            frames.push(Frame {
                start: i,
                header: summary,
                end: i,
                title,
                open: attributes == Some("open"),
                valid,
                closed: false,
                parent: stack.last().copied(),
            });
            stack.push(frames.len() - 1);
        } else if let Some(index) = stack.pop() {
            frames[index].valid &= event.portable && own_line && lower == "</details>";
            frames[index].closed = true;
            frames[index].end = i;
            if !frames[index].valid {
                if let Some(&parent) = stack.last() {
                    frames[parent].valid = false;
                }
            }
        }
    }
    let mut prefix = "FORMAREADERDISCLOSURE".to_string();
    let decoded = ast.to_string();
    while source.contains(&prefix) || decoded.contains(&prefix) {
        prefix.push('X');
    }
    let mut edits = Vec::new();
    let mut replacements = Vec::new();
    for (index, frame) in frames.iter().enumerate() {
        let mut valid = frame.valid && frame.closed;
        let mut ancestor = frame.parent;
        while let Some(parent) = ancestor {
            if !frames[parent].valid || !frames[parent].closed {
                valid = false;
                break;
            }
            ancestor = frames[parent].parent;
        }
        if !valid {
            continue;
        }
        let (Some(start), Some(header), Some(end)) = (
            lines.get(frame.start),
            lines.get(frame.header),
            lines.get(frame.end),
        ) else {
            continue;
        };
        let open = format!(":{prefix}{index}OPEN:");
        let close = format!(":{prefix}{index}CLOSE:");
        replacements.push((format!("<p>{open}</p>"), format!("<details class=\"collapse collapse-arrow my-4 border border-base-300 bg-base-100\" data-markdown-disclosure=\"\"{}><summary class=\"collapse-title min-h-0 py-3 ps-4 pe-12 leading-relaxed break-words\">{}</summary><div class=\"collapse-content min-w-0\">", if frame.open {" open"} else {""}, escape_html(&frame.title))));
        replacements.push((format!("<p>{close}</p>"), "</div></details>".into()));
        edits.push((
            start.start,
            header.start + header.raw.len(),
            format!("\n\n{open}\n\n"),
        ));
        edits.push((
            end.start,
            end.start + end.raw.len(),
            format!("\n\n{close}\n\n"),
        ));
    }
    edits.sort_by_key(|(start, _, _)| *start);
    let mut prepared = source;
    for (start, end, replacement) in edits.into_iter().rev() {
        prepared.replace_range(start..end, &replacement);
    }
    (prepared, replacements)
}

struct HtmlRange {
    start: usize,
    end: usize,
    portable: bool,
}
struct DisclosureTag {
    start: usize,
    summary: bool,
    closing: bool,
    portable: bool,
}
fn html_boundary(value: &str) -> bool {
    value.is_empty() || value.starts_with([' ', '\t', '\r', '\n', '\u{c}', '/', '>'])
}
#[derive(Clone, Copy)]
enum AttributeState {
    BeforeName,
    Name,
    AfterName,
    BeforeValue,
    Quoted,
    Unquoted,
    AfterQuoted,
    SelfClosing,
}
struct TagTail {
    end: usize,
    self_closing: bool,
}
fn parse_tag_tail(source: &str, start: usize) -> TagTail {
    use AttributeState::*;
    let mut state = BeforeName;
    let mut quote = 0;
    for (offset, &ch) in source.as_bytes()[start..].iter().enumerate() {
        let end = start + offset + 1;
        let space = matches!(ch, b' ' | b'\t' | b'\r' | b'\n' | 0x0c);
        match state {
            BeforeName | AfterName => {
                if space {
                    continue;
                }
                if ch == b'>' {
                    return TagTail {
                        end,
                        self_closing: false,
                    };
                }
                state = if ch == b'/' {
                    SelfClosing
                } else if ch == b'=' && matches!(state, AfterName) {
                    BeforeValue
                } else {
                    Name
                };
            }
            Name => {
                if space {
                    state = AfterName;
                } else if ch == b'>' {
                    return TagTail {
                        end,
                        self_closing: false,
                    };
                } else if ch == b'/' {
                    state = SelfClosing;
                } else if ch == b'=' {
                    state = BeforeValue;
                }
            }
            BeforeValue => {
                if space {
                    continue;
                }
                if matches!(ch, b'\'' | b'"') {
                    quote = ch;
                    state = Quoted;
                } else if ch == b'>' {
                    return TagTail {
                        end,
                        self_closing: false,
                    };
                } else {
                    state = Unquoted;
                }
            }
            Quoted => {
                if ch == quote {
                    state = AfterQuoted;
                }
            }
            Unquoted => {
                if space {
                    state = BeforeName;
                } else if ch == b'>' {
                    return TagTail {
                        end,
                        self_closing: false,
                    };
                }
            }
            AfterQuoted | SelfClosing => {
                if ch == b'>' {
                    return TagTail {
                        end,
                        self_closing: matches!(state, SelfClosing),
                    };
                }
                state = if space {
                    BeforeName
                } else if ch == b'/' {
                    SelfClosing
                } else {
                    Name
                };
            }
        }
    }
    TagTail {
        end: source.len(),
        self_closing: false,
    }
}
fn tag_end(source: &str, start: usize) -> usize {
    parse_tag_tail(source, start).end
}

// The script tokenizer can be escaped or double-escaped. An end tag in
// double-escaped data changes state rather than ending the script element.
fn script_end(source: &str, lower: &str, start: usize) -> usize {
    let bytes = source.as_bytes();
    let lower_bytes = lower.as_bytes();
    let (mut escaped, mut double_escaped, mut i) = (false, false, start);
    while i < bytes.len() {
        if escaped && bytes[i..].starts_with(b"-->") {
            escaped = false;
            double_escaped = false;
            i += 3;
            continue;
        }
        if !escaped && bytes[i..].starts_with(b"<!--") {
            escaped = true;
            i += 2;
            continue;
        }
        if escaped
            && !double_escaped
            && lower_bytes[i..].starts_with(b"<script")
            && html_boundary(&source[i + 7..])
        {
            double_escaped = true;
            i += 7;
            continue;
        }
        if lower_bytes[i..].starts_with(b"</script") && html_boundary(&source[i + 8..]) {
            if double_escaped {
                double_escaped = false;
                i += 8;
                continue;
            }
            return tag_end(source, i + 8);
        }
        i += 1;
    }
    source.len()
}

// Recognition guard only: this scanner does not render or enable authored HTML.
// Full tag spans cross lines/tokens; quoted, commented and raw-text delimiters
// never become native disclosure events.
fn scan_disclosure_tags(source: &str, ranges: &[HtmlRange]) -> Vec<DisclosureTag> {
    let lower = source.to_ascii_lowercase();
    let bytes = lower.as_bytes();
    let mut tags = Vec::new();
    let mut containers = Vec::<&str>::new();
    let mut template_scopes = Vec::<usize>::new();
    let mut cursor = 0;
    for range in ranges {
        cursor = cursor.max(range.start);
        while cursor < range.end {
            let Some(relative) = source[cursor..].find('<') else {
                break;
            };
            let start = cursor + relative;
            if start >= range.end {
                cursor = range.end;
                break;
            }
            let rest = &source[start..];
            let delimiter = if rest.starts_with("<!--") {
                Some("-->")
            } else if rest.starts_with("<![CDATA[") {
                Some("]]>")
            } else if rest.starts_with("<?") {
                Some("?>")
            } else {
                None
            };
            if let Some(delimiter) = delimiter {
                cursor = source[start + 2..]
                    .find(delimiter)
                    .map_or(source.len(), |offset| start + 2 + offset + delimiter.len());
                continue;
            }
            if rest.starts_with("<!") {
                cursor = source[start + 2..]
                    .find('>')
                    .map_or(source.len(), |offset| start + 2 + offset + 1);
                continue;
            }
            let closing = bytes.get(start + 1) == Some(&b'/');
            let name_start = start + if closing { 2 } else { 1 };
            let mut name_end = name_start;
            while bytes
                .get(name_end)
                .is_some_and(|c| !matches!(c, b' ' | b'\t' | b'\r' | b'\n' | 0x0c | b'/' | b'>'))
            {
                name_end += 1;
            }
            if name_end == name_start || !bytes[name_start].is_ascii_alphabetic() {
                cursor = if closing {
                    source[name_start..]
                        .find('>')
                        .map_or(source.len(), |offset| name_start + offset + 1)
                } else {
                    name_start
                };
                continue;
            }
            let name = &lower[name_start..name_end];
            let tail = parse_tag_tail(source, name_end);
            let end = tail.end;
            let self_closing_foreign = tail.self_closing
                && (matches!(name, "svg" | "math")
                    || containers
                        .iter()
                        .any(|name| matches!(*name, "svg" | "math")));
            let portable = range.portable && containers.is_empty();
            if !closing && !self_closing_foreign && name == "plaintext" {
                cursor = source.len();
                continue;
            }
            // Noscript is opaque in both scripting modes; plaintext never closes.
            if !closing
                && !self_closing_foreign
                && matches!(
                    name,
                    "script"
                        | "style"
                        | "pre"
                        | "textarea"
                        | "title"
                        | "xmp"
                        | "iframe"
                        | "noembed"
                        | "noframes"
                        | "noscript"
                )
            {
                if name == "script" {
                    cursor = script_end(source, &lower, end);
                    continue;
                }
                let needle = format!("</{name}");
                let mut search = end;
                cursor = source.len();
                while let Some(relative) = lower[search..].find(&needle) {
                    let close = search + relative;
                    if html_boundary(&source[close + needle.len()..]) {
                        cursor = tag_end(source, close + needle.len());
                        break;
                    }
                    search = close + 2;
                }
                continue;
            }
            let template_scope = template_scopes.last().copied();
            if name == "details" && template_scope.is_none() {
                tags.push(DisclosureTag {
                    start,
                    summary: false,
                    closing,
                    portable,
                });
            } else if name == "summary" && !closing {
                let line_start = source[..start].rfind('\n').map_or(0, |index| index + 1);
                let line_end = source[start..]
                    .find('\n')
                    .map_or(source.len(), |index| start + index);
                let text = &lower[line_start..line_end];
                if portable
                    && unindent(text).is_some_and(|text| {
                        text.starts_with("<summary>") && text.ends_with("</summary>")
                    })
                {
                    tags.push(DisclosureTag {
                        start,
                        summary: true,
                        closing,
                        portable,
                    });
                    cursor = line_end;
                    continue;
                }
            }
            if name != "details"
                && !matches!(
                    name,
                    "area"
                        | "base"
                        | "br"
                        | "col"
                        | "embed"
                        | "hr"
                        | "img"
                        | "input"
                        | "link"
                        | "meta"
                        | "param"
                        | "source"
                        | "track"
                        | "wbr"
                )
            {
                if closing {
                    if let Some(index) = containers.iter().rposition(|entry| *entry == name)
                        && template_scope.is_none_or(|scope| index >= scope)
                    {
                        containers.truncate(index);
                        while template_scopes.last().is_some_and(|scope| *scope >= index) {
                            template_scopes.pop();
                        }
                    }
                } else {
                    if !self_closing_foreign {
                        if name == "template" {
                            template_scopes.push(containers.len());
                        }
                        containers.push(name);
                    }
                }
            }
            cursor = end;
        }
    }
    tags
}

fn unindent(line: &str) -> Option<&str> {
    let spaces = line.bytes().take_while(|&c| c == b' ').count();
    (spaces <= 3).then(|| line[spaces..].trim_end_matches([' ', '\t']))
}
fn tag_boundary(rest: &str) -> bool {
    rest.is_empty() || rest.starts_with([' ', '\t', '\n', '\r', '/', '>'])
}
fn is_disclosure_html(value: &str) -> bool {
    let value = value.trim_start().to_ascii_lowercase();
    ["<details", "</details", "<summary", "</summary"]
        .iter()
        .any(|prefix| value.strip_prefix(prefix).is_some_and(tag_boundary))
}
fn decode_title(title: &str) -> String {
    if !title.contains('&') {
        return title.to_owned();
    }
    let mut decoded = String::new();
    let mut rest = title;
    while !rest.is_empty() {
        if rest.starts_with('&')
            && let Some(end) = rest.find(';')
            && end <= 40
        {
            let candidate = &rest[..=end];
            let body = &candidate[1..end];
            let valid =
                if let Some(hex) = body.strip_prefix("#x").or_else(|| body.strip_prefix("#X")) {
                    !hex.is_empty() && hex.bytes().all(|c| c.is_ascii_hexdigit())
                } else if let Some(number) = body.strip_prefix('#') {
                    !number.is_empty() && number.bytes().all(|c| c.is_ascii_digit())
                } else {
                    body.as_bytes().first().is_some_and(u8::is_ascii_alphabetic)
                        && body.bytes().all(|c| c.is_ascii_alphanumeric())
                };
            if valid && let Ok(ast) = markdown::to_mdast(candidate, &markdown::ParseOptions::gfm())
            {
                let numeric = body
                    .strip_prefix("#x")
                    .or_else(|| body.strip_prefix("#X"))
                    .map(|s| (s, 16))
                    .or_else(|| body.strip_prefix('#').map(|s| (s, 10)));
                if let Some((digits, radix)) = numeric {
                    decoded.push(html_numeric_character(
                        u32::from_str_radix(digits, radix).unwrap_or(u32::MAX),
                    ));
                } else {
                    decoded.push_str(&ast.to_string());
                }
                rest = &rest[end + 1..];
                continue;
            }
        }
        let ch = rest.chars().next().expect("nonempty");
        decoded.push(ch);
        rest = &rest[ch.len_utf8()..];
    }
    decoded
}

// HTML numeric references map C1 values through Windows-1252, unlike Markdown mdast text.
fn html_numeric_character(value: u32) -> char {
    let value = match value {
        0 => 0xfffd,
        0x80 => 0x20ac,
        0x82 => 0x201a,
        0x83 => 0x0192,
        0x84 => 0x201e,
        0x85 => 0x2026,
        0x86 => 0x2020,
        0x87 => 0x2021,
        0x88 => 0x02c6,
        0x89 => 0x2030,
        0x8a => 0x0160,
        0x8b => 0x2039,
        0x8c => 0x0152,
        0x8e => 0x017d,
        0x91 => 0x2018,
        0x92 => 0x2019,
        0x93 => 0x201c,
        0x94 => 0x201d,
        0x95 => 0x2022,
        0x96 => 0x2013,
        0x97 => 0x2014,
        0x98 => 0x02dc,
        0x99 => 0x2122,
        0x9a => 0x0161,
        0x9b => 0x203a,
        0x9c => 0x0153,
        0x9e => 0x017e,
        0x9f => 0x0178,
        value => value,
    };
    char::from_u32(value).unwrap_or(char::REPLACEMENT_CHARACTER)
}

fn escape_html(title: &str) -> String {
    title
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

pub(super) fn restore(html: String, replacements: &[(String, String)]) -> String {
    replacements
        .iter()
        .fold(html, |html, (marker, value)| html.replace(marker, value))
}

#[cfg(test)]
mod tests {
    #[test]
    fn deep_html_wrappers_recover_after_their_real_close() {
        let fold = "<details>\n<summary>Inner</summary>\n\nbody\n\n</details>\n";
        for name in ["div", "template"] {
            let source = format!("<{name}>\n").repeat(2048)
                + "\n"
                + fold
                + "\n"
                + &format!("</{name}>\n").repeat(2048)
                + "\n"
                + &fold.replace("Inner", "Outside");
            let (_, replacements) = super::prepare(&source);
            assert_eq!(replacements.len(), 2);
            assert!(replacements[0].1.contains(">Outside</summary>"));
        }
    }
    #[test]
    fn very_deep_native_trees_stay_inert() {
        let source = "<details>\n<summary>Layer</summary>\n\n".repeat(2048)
            + "body\n\n"
            + &"</details>\n\n".repeat(2048);
        assert!(super::prepare(&source).1.is_empty());
    }
}
