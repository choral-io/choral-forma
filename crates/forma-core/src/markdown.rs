use markdown::{ParseOptions, mdast, to_mdast};
use serde::{Deserialize, Serialize};

use crate::diagnostics::{Diagnostic, DiagnosticLocation};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormaMarkdownDocument {
    pub frontmatter: ParsedFrontmatter,
    pub body: String,
    pub references: Vec<FormaReference>,
    pub diagnostics: Vec<Diagnostic>,
}

impl FormaMarkdownDocument {
    pub fn parse(source: &str) -> Self {
        parse_markdown(source)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFrontmatter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<serde_yml::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormaReference {
    pub intent: FormaReferenceIntent,
    pub source: FormaReferenceSource,
    pub syntax: FormaReferenceSyntax,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<SourceSpan>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FormaReferenceIntent {
    Link,
    Embed,
    View,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FormaReferenceSource {
    Body,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FormaReferenceSyntax {
    MarkdownLink,
    Wikilink,
    ObsidianEmbed,
    FormaCommentDirective,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpan {
    pub start_byte: usize,
    pub end_byte: usize,
    pub start_line: usize,
    pub start_column: usize,
    pub end_line: usize,
    pub end_column: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrontmatterSplit {
    pub frontmatter: Option<String>,
    pub body: String,
}

pub fn parse_markdown(source: &str) -> FormaMarkdownDocument {
    let split = split_frontmatter(source);
    let mut diagnostics = Vec::new();

    let frontmatter_value = split
        .frontmatter
        .as_deref()
        .and_then(|raw| match serde_yml::from_str(raw) {
            Ok(value) => Some(value),
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "markdown.frontmatter.invalidYaml",
                        "Invalid YAML frontmatter.",
                    )
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: "$".to_string(),
                        index: None,
                    })
                    .with_actual(error.to_string()),
                );
                None
            }
        });

    let body = split.body.to_string();
    let mut references = scan_forma_references(&body);

    match to_mdast(&body, &ParseOptions::gfm()) {
        Ok(ast) => collect_markdown_links(&ast, &mut references),
        Err(error) => diagnostics.push(
            Diagnostic::error(
                "markdown.body.parseFailed",
                "Markdown body could not be parsed.",
            )
            .with_location(DiagnosticLocation::Body {
                line: None,
                column: None,
            })
            .with_actual(error.to_string()),
        ),
    }

    references.sort_by_key(|reference| {
        reference
            .span
            .map(|span| (span.start_byte, span.end_byte))
            .unwrap_or((usize::MAX, usize::MAX))
    });

    FormaMarkdownDocument {
        frontmatter: ParsedFrontmatter {
            raw: split.frontmatter,
            value: frontmatter_value,
        },
        body,
        references,
        diagnostics,
    }
}

pub fn split_frontmatter(source: &str) -> FrontmatterSplit {
    let Some(first_line_end) = frontmatter_opening_end(source) else {
        return FrontmatterSplit {
            frontmatter: None,
            body: source.to_string(),
        };
    };

    let mut offset = first_line_end;
    while offset <= source.len() {
        let line_end = source[offset..]
            .find('\n')
            .map(|index| offset + index)
            .unwrap_or(source.len());
        let line = source[offset..line_end].trim_end_matches('\r');
        if line.trim() == "---" {
            let body_start = if line_end < source.len() {
                line_end + 1
            } else {
                line_end
            };
            return FrontmatterSplit {
                frontmatter: Some(source[first_line_end..offset].to_string()),
                body: source[body_start..].to_string(),
            };
        }
        if line_end == source.len() {
            break;
        }
        offset = line_end + 1;
    }

    FrontmatterSplit {
        frontmatter: None,
        body: source.to_string(),
    }
}

fn frontmatter_opening_end(source: &str) -> Option<usize> {
    if source == "---" {
        return None;
    }
    if source.starts_with("---\n") {
        Some(4)
    } else if source.starts_with("---\r\n") {
        Some(5)
    } else {
        None
    }
}

fn collect_markdown_links(node: &mdast::Node, references: &mut Vec<FormaReference>) {
    if let mdast::Node::Link(link) = node {
        references.push(FormaReference {
            intent: FormaReferenceIntent::Link,
            source: FormaReferenceSource::Body,
            syntax: FormaReferenceSyntax::MarkdownLink,
            target: link.url.clone(),
            label: Some(plain_text(&link.children)),
            span: link
                .position
                .as_ref()
                .map(SourceSpan::from_markdown_position),
        });
    }

    if let Some(children) = node.children() {
        for child in children {
            collect_markdown_links(child, references);
        }
    }
}

fn plain_text(nodes: &[mdast::Node]) -> String {
    let mut output = String::new();
    for node in nodes {
        match node {
            mdast::Node::Text(text) => output.push_str(&text.value),
            mdast::Node::InlineCode(code) => output.push_str(&code.value),
            mdast::Node::Break(_) => output.push(' '),
            _ => {
                if let Some(children) = node.children() {
                    output.push_str(&plain_text(children));
                }
            }
        }
    }
    output
}

impl SourceSpan {
    fn from_markdown_position(position: &markdown::unist::Position) -> Self {
        Self {
            start_byte: position.start.offset,
            end_byte: position.end.offset,
            start_line: position.start.line,
            start_column: position.start.column,
            end_line: position.end.line,
            end_column: position.end.column,
        }
    }
}

fn scan_forma_references(body: &str) -> Vec<FormaReference> {
    let mut references = Vec::new();
    scan_wikilinks_and_embeds(body, &mut references);
    scan_forma_view_comments(body, &mut references);
    references
}

fn scan_wikilinks_and_embeds(body: &str, references: &mut Vec<FormaReference>) {
    let mut offset = 0;
    while let Some(relative_start) = body[offset..].find("[[") {
        let start = offset + relative_start;
        let embed = start > 0 && body.as_bytes()[start - 1] == b'!';
        let marker_start = if embed { start - 1 } else { start };
        let content_start = start + 2;
        let Some(relative_end) = body[content_start..].find("]]") else {
            break;
        };
        let content_end = content_start + relative_end;
        let end = content_end + 2;
        let content = &body[content_start..content_end];

        if !content.trim().is_empty() {
            let (target, label) = split_wikilink_content(content);
            references.push(FormaReference {
                intent: if embed {
                    FormaReferenceIntent::Embed
                } else {
                    FormaReferenceIntent::Link
                },
                source: FormaReferenceSource::Body,
                syntax: if embed {
                    FormaReferenceSyntax::ObsidianEmbed
                } else {
                    FormaReferenceSyntax::Wikilink
                },
                target,
                label,
                span: Some(source_span(body, marker_start, end)),
            });
        }

        offset = end;
    }
}

fn split_wikilink_content(content: &str) -> (String, Option<String>) {
    if let Some((target, label)) = content.split_once('|') {
        (target.trim().to_string(), Some(label.trim().to_string()))
    } else {
        (content.trim().to_string(), None)
    }
}

fn scan_forma_view_comments(body: &str, references: &mut Vec<FormaReference>) {
    const OPEN: &str = "<!--";
    const CLOSE: &str = "-->";
    const DIRECTIVE: &str = "forma-view";

    let mut offset = 0;
    while let Some(relative_start) = body[offset..].find(OPEN) {
        let start = offset + relative_start;
        let content_start = start + OPEN.len();
        let Some(relative_end) = body[content_start..].find(CLOSE) else {
            break;
        };
        let content_end = content_start + relative_end;
        let end = content_end + CLOSE.len();
        let content = body[content_start..content_end].trim();

        if let Some(rest) = content.strip_prefix(DIRECTIVE) {
            let target = rest.strip_prefix(':').unwrap_or(rest).trim().to_string();
            references.push(FormaReference {
                intent: FormaReferenceIntent::View,
                source: FormaReferenceSource::Body,
                syntax: FormaReferenceSyntax::FormaCommentDirective,
                target,
                label: None,
                span: Some(source_span(body, start, end)),
            });
        }

        offset = end;
    }
}

fn source_span(source: &str, start: usize, end: usize) -> SourceSpan {
    let (start_line, start_column) = line_column(source, start);
    let (end_line, end_column) = line_column(source, end);
    SourceSpan {
        start_byte: start,
        end_byte: end,
        start_line,
        start_column,
        end_line,
        end_column,
    }
}

fn line_column(source: &str, offset: usize) -> (usize, usize) {
    let mut line = 1;
    let mut line_start = 0;
    for (index, ch) in source.char_indices() {
        if index >= offset {
            break;
        }
        if ch == '\n' {
            line += 1;
            line_start = index + 1;
        }
    }

    let column = source[line_start..offset].chars().count() + 1;
    (line, column)
}

trait DiagnosticActual {
    fn with_actual(self, actual: impl Into<String>) -> Self;
}

impl DiagnosticActual for Diagnostic {
    fn with_actual(mut self, actual: impl Into<String>) -> Self {
        self.actual = Some(actual.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::{
        FormaMarkdownDocument, FormaReferenceIntent, FormaReferenceSyntax, split_frontmatter,
    };

    #[test]
    fn parses_valid_markdown_with_frontmatter_and_markdown_link() {
        let document = FormaMarkdownDocument::parse(
            "---\ntitle: Parser\ncount: 1\n---\n# Parser\nSee [docs](notes/docs.md).\n",
        );

        assert!(document.diagnostics.is_empty());
        assert_eq!(
            document.frontmatter.raw.as_deref(),
            Some("title: Parser\ncount: 1\n")
        );
        assert_eq!(
            document.frontmatter.value.as_ref().unwrap()["title"],
            "Parser"
        );
        assert_eq!(document.body, "# Parser\nSee [docs](notes/docs.md).\n");

        let link = document
            .references
            .iter()
            .find(|reference| reference.syntax == FormaReferenceSyntax::MarkdownLink)
            .unwrap();
        assert_eq!(link.intent, FormaReferenceIntent::Link);
        assert_eq!(link.target, "notes/docs.md");
        assert_eq!(link.label.as_deref(), Some("docs"));
        assert_eq!(link.span.unwrap().start_line, 2);
    }

    #[test]
    fn invalid_frontmatter_returns_diagnostic_and_keeps_body() {
        let document = FormaMarkdownDocument::parse("---\ntitle: [broken\n---\nBody\n");

        assert_eq!(document.body, "Body\n");
        assert!(document.frontmatter.value.is_none());
        assert_eq!(document.diagnostics.len(), 1);
        assert_eq!(
            document.diagnostics[0].code,
            "markdown.frontmatter.invalidYaml"
        );
    }

    #[test]
    fn detects_wikilink_with_alias() {
        let document = FormaMarkdownDocument::parse("See [[notes/parser|Parser note]].\n");
        let reference = document.references.first().unwrap();

        assert_eq!(reference.syntax, FormaReferenceSyntax::Wikilink);
        assert_eq!(reference.intent, FormaReferenceIntent::Link);
        assert_eq!(reference.target, "notes/parser");
        assert_eq!(reference.label.as_deref(), Some("Parser note"));
        assert_eq!(reference.span.unwrap().start_column, 5);
    }

    #[test]
    fn detects_ordinary_wikilink_without_alias() {
        let document = FormaMarkdownDocument::parse("See [[notes/parser]].\n");
        let reference = document.references.first().unwrap();

        assert_eq!(reference.syntax, FormaReferenceSyntax::Wikilink);
        assert_eq!(reference.intent, FormaReferenceIntent::Link);
        assert_eq!(reference.target, "notes/parser");
        assert_eq!(reference.label, None);
    }

    #[test]
    fn detects_obsidian_embed_as_embed_intent() {
        let document = FormaMarkdownDocument::parse("Before ![[notes/chart]] after\n");
        let reference = document.references.first().unwrap();

        assert_eq!(reference.syntax, FormaReferenceSyntax::ObsidianEmbed);
        assert_eq!(reference.intent, FormaReferenceIntent::Embed);
        assert_eq!(reference.target, "notes/chart");
        assert_eq!(reference.span.unwrap().start_column, 8);
    }

    #[test]
    fn detects_forma_view_comment_directive() {
        let document =
            FormaMarkdownDocument::parse("Intro\n<!-- forma-view: todos assignee=\"Tiscs\" -->\n");
        let reference = document.references.first().unwrap();

        assert_eq!(
            reference.syntax,
            FormaReferenceSyntax::FormaCommentDirective
        );
        assert_eq!(reference.intent, FormaReferenceIntent::View);
        assert_eq!(reference.target, "todos assignee=\"Tiscs\"");
        assert_eq!(reference.span.unwrap().start_line, 2);
        assert_eq!(reference.source, super::FormaReferenceSource::Body);
    }

    #[test]
    fn split_frontmatter_does_not_treat_body_thematic_break_as_metadata() {
        let split = split_frontmatter("---\nbody\n");

        assert!(split.frontmatter.is_none());
        assert_eq!(split.body, "---\nbody\n");
    }
}
