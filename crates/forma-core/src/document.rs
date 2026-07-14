use globset::Glob;
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{FormaWorkspace, SemanticType, SpaceDefinition, WorkspaceConfig};
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::index::{ReferenceFragmentKind, ReferenceIntent, ReferenceSource};
use crate::markdown::{
    FormaMarkdownDocument, FormaReference, FormaReferenceIntent, FormaReferenceSyntax, SourceSpan,
    markdown_fenced_references, markdown_inline_code_references,
};
use crate::path::slugify_path_segment;
use crate::schema::{SchemaNode, parse_space_schema};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentAnalysis {
    pub references: Vec<DocumentReference>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentReference {
    pub source: ReferenceSource,
    pub syntax: DocumentReferenceSyntax,
    pub intent: ReferenceIntent,
    pub raw_target: String,
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_kind: Option<ReferenceFragmentKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_space: Option<String>,
    pub syntax_span: SourceSpan,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_span: Option<SourceSpan>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_span: Option<SourceSpan>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_span: Option<SourceSpan>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DocumentReferenceSyntax {
    Frontmatter,
    MarkdownLink,
    MarkdownImage,
    Wikilink,
    ObsidianEmbed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SemanticReferenceField {
    pub field: String,
    pub semantic_type: Option<String>,
    pub space: Option<String>,
    pub transform: Option<String>,
    pub many: bool,
}

pub fn analyze_document_references(
    workspace: &FormaWorkspace,
    source_path: &str,
    source: &str,
) -> DocumentAnalysis {
    let document = FormaMarkdownDocument::parse(source);
    let mut diagnostics = document
        .diagnostics
        .iter()
        .cloned()
        .map(|diagnostic| diagnostic.with_path(source_path))
        .collect::<Vec<_>>();
    let body_offset = source.len().saturating_sub(document.body.len());
    let mut references = body_references(source, body_offset, &document);

    if let Some(space) = matched_space(&workspace.config, source_path, &mut diagnostics)
        && let Ok(schema) = parse_space_schema(space)
        && let (Some(raw), Some(value)) = (
            document.frontmatter.raw.as_deref(),
            document.frontmatter.value.as_ref(),
        )
    {
        let frontmatter_offset = frontmatter_content_offset(source).unwrap_or(0);
        references.extend(frontmatter_references(
            source,
            raw,
            frontmatter_offset,
            value,
            &collect_semantic_reference_fields(&workspace.config, &schema),
        ));
    }

    references.sort_by_key(|reference| {
        (
            reference.syntax_span.start_byte,
            reference.syntax_span.end_byte,
        )
    });
    DocumentAnalysis {
        references,
        diagnostics,
    }
}

/// Returns link syntax projected from `md` and `markdown` fenced blocks.
///
/// This projection supports editor-native presentation and navigation only;
/// it is deliberately separate from [`analyze_document_references`].
pub fn project_markdown_fenced_references(source: &str) -> Vec<DocumentReference> {
    markdown_fenced_references(source)
        .iter()
        .filter_map(|reference| document_reference(source, 0, reference))
        .collect()
}

/// Returns link syntax projected from inline code.
///
/// This editor-only projection does not make code examples part of Forma's
/// semantic document model.
pub fn project_inline_code_references(source: &str) -> Vec<DocumentReference> {
    markdown_inline_code_references(source)
        .iter()
        .filter_map(|reference| document_reference(source, 0, reference))
        .collect()
}

fn body_references(
    source: &str,
    body_offset: usize,
    document: &FormaMarkdownDocument,
) -> Vec<DocumentReference> {
    document
        .references
        .iter()
        .filter_map(|reference| document_reference(source, body_offset, reference))
        .collect()
}

fn document_reference(
    source: &str,
    offset: usize,
    reference: &FormaReference,
) -> Option<DocumentReference> {
    let syntax = match reference.syntax {
        FormaReferenceSyntax::MarkdownLink => DocumentReferenceSyntax::MarkdownLink,
        FormaReferenceSyntax::MarkdownImage => DocumentReferenceSyntax::MarkdownImage,
        FormaReferenceSyntax::Wikilink => DocumentReferenceSyntax::Wikilink,
        FormaReferenceSyntax::ObsidianEmbed => DocumentReferenceSyntax::ObsidianEmbed,
        FormaReferenceSyntax::FormaCommentDirective => return None,
    };
    let intent = match reference.intent {
        FormaReferenceIntent::Link => ReferenceIntent::Link,
        FormaReferenceIntent::Embed => ReferenceIntent::Embed,
        FormaReferenceIntent::View => return None,
    };
    let syntax_span = offset_span(source, offset, reference.syntax_span)?;
    let target_span = offset_span(source, offset, reference.target_span);
    let label_span = offset_span(source, offset, reference.label_span);
    let fragment_span = offset_span(source, offset, reference.fragment_span);
    let (target, fragment, fragment_kind) = split_reference_target(&reference.target);
    Some(DocumentReference {
        source: ReferenceSource::Body,
        syntax,
        intent,
        raw_target: reference.target.clone(),
        target,
        label: reference.label.clone(),
        fragment,
        fragment_kind,
        field: None,
        index: None,
        target_space: None,
        syntax_span,
        target_span,
        label_span,
        fragment_span,
    })
}

fn frontmatter_references(
    source: &str,
    raw: &str,
    frontmatter_offset: usize,
    value: &Value,
    fields: &[SemanticReferenceField],
) -> Vec<DocumentReference> {
    let mut references = Vec::new();
    for field in fields {
        let Some(value) = value_at_path(value, &field.field) else {
            continue;
        };
        let values = if field.many {
            value
                .as_sequence()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
        } else {
            value.as_str().into_iter().collect::<Vec<_>>()
        };
        let Some(field_range) = yaml_field_range(raw, &field.field) else {
            continue;
        };
        let mut cursor = field_range.0;
        for (index, raw_target) in values.into_iter().enumerate() {
            let Some((start, end)) = find_yaml_scalar(raw, field_range, cursor, raw_target) else {
                continue;
            };
            cursor = end;
            let mut target = raw_target.trim().to_string();
            if !is_explicit_path_reference(&target)
                && let Some(transform) = field.transform.as_deref()
                && let Ok(transformed) = apply_reference_transform(transform, &target)
            {
                target = transformed;
            }
            let (target, fragment, fragment_kind) = split_reference_target(&target);
            if let Some(syntax_span) =
                source_span(source, frontmatter_offset + start, frontmatter_offset + end)
            {
                let (target_span, fragment_span) = split_source_target_span(source, syntax_span);
                references.push(DocumentReference {
                    source: ReferenceSource::Frontmatter,
                    syntax: DocumentReferenceSyntax::Frontmatter,
                    intent: ReferenceIntent::Reference,
                    raw_target: raw_target.to_string(),
                    target,
                    label: None,
                    fragment,
                    fragment_kind,
                    field: Some(field.field.clone()),
                    index: field.many.then_some(index),
                    target_space: field.space.clone(),
                    syntax_span,
                    target_span,
                    label_span: None,
                    fragment_span,
                });
            }
        }
    }
    references
}

fn matched_space<'a>(
    config: &'a WorkspaceConfig,
    source_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<&'a SpaceDefinition> {
    let mut matches = Vec::new();
    for (space_id, space) in &config.spaces {
        let patterns = if space.include_patterns.is_empty() {
            std::slice::from_ref(&space.include)
        } else {
            space.include_patterns.as_slice()
        };
        if patterns
            .iter()
            .filter_map(|pattern| Glob::new(pattern).ok())
            .any(|pattern| pattern.compile_matcher().is_match(source_path))
        {
            matches.push((space_id, space));
        }
    }
    if matches.len() > 1 {
        diagnostics.push(
            Diagnostic::error(
                "space.membership.ambiguous",
                "Entry matches multiple spaces.",
            )
            .with_path(source_path)
            .with_location(DiagnosticLocation::File),
        );
        return None;
    }
    matches.into_iter().next().map(|(_, space)| space)
}

pub(crate) fn collect_semantic_reference_fields(
    config: &WorkspaceConfig,
    schema: &SchemaNode,
) -> Vec<SemanticReferenceField> {
    let mut fields = Vec::new();
    collect_semantic_reference_fields_inner(config, schema, "", false, &mut fields);
    fields
}

fn collect_semantic_reference_fields_inner(
    config: &WorkspaceConfig,
    schema: &SchemaNode,
    field_path: &str,
    many: bool,
    fields: &mut Vec<SemanticReferenceField>,
) {
    match schema {
        SchemaNode::Object { fields: nodes, .. } => {
            for (name, node) in nodes {
                let next = if field_path.is_empty() {
                    name.clone()
                } else {
                    format!("{field_path}.{name}")
                };
                collect_semantic_reference_fields_inner(config, node, &next, many, fields);
            }
        }
        SchemaNode::List { items, .. } => {
            collect_semantic_reference_fields_inner(config, items, field_path, true, fields);
        }
        SchemaNode::Named { name, .. } => {
            if let Some(field) = semantic_reference_field(config, name, field_path, many, true) {
                fields.push(field);
            }
        }
        SchemaNode::EntryRef { target, .. } => {
            if let Some(target) = target {
                if let Some(field) =
                    semantic_reference_field(config, target, field_path, many, true)
                {
                    fields.push(field);
                }
            } else {
                fields.push(SemanticReferenceField {
                    field: field_path.to_string(),
                    semantic_type: None,
                    space: None,
                    transform: None,
                    many,
                });
            }
        }
        SchemaNode::String { .. }
        | SchemaNode::Number { .. }
        | SchemaNode::Integer { .. }
        | SchemaNode::Boolean { .. }
        | SchemaNode::Date { .. }
        | SchemaNode::DateTime { .. }
        | SchemaNode::Const { .. }
        | SchemaNode::Enum { .. } => {}
    }
}

fn semantic_reference_field(
    config: &WorkspaceConfig,
    type_name: &str,
    field_path: &str,
    many: bool,
    include_semantic_type: bool,
) -> Option<SemanticReferenceField> {
    let semantic_type = config.types.get(type_name)?;
    let transform = match semantic_type {
        SemanticType::EntryRef { input, .. } => input.transform.clone(),
        SemanticType::Enum { .. } => return None,
    };
    Some(SemanticReferenceField {
        field: field_path.to_string(),
        semantic_type: include_semantic_type.then(|| type_name.to_string()),
        space: semantic_type.space().map(ToOwned::to_owned),
        transform,
        many,
    })
}

pub(crate) fn is_explicit_path_reference(target: &str) -> bool {
    target.contains('/') || target.ends_with(".md")
}

pub(crate) fn apply_reference_transform(transform: &str, value: &str) -> Result<String, String> {
    match transform {
        "slugify" => slugify_path_segment(value).map_err(|error| error.to_string()),
        other => Err(format!("unknown transform `{other}`")),
    }
}

fn value_at_path<'a>(value: &'a Value, field: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in field.split('.') {
        current = current
            .as_mapping()?
            .get(Value::String(segment.to_string()))?;
    }
    Some(current)
}

#[derive(Debug)]
struct YamlField {
    path: String,
    indent: usize,
    value_start: usize,
    line_start: usize,
}

fn yaml_field_range(source: &str, target_path: &str) -> Option<(usize, usize)> {
    let fields = yaml_fields(source);
    let (index, field) = fields
        .iter()
        .enumerate()
        .find(|(_, field)| field.path == target_path)?;
    let end = fields[index + 1..]
        .iter()
        .find(|candidate| candidate.indent <= field.indent)
        .map(|candidate| candidate.line_start)
        .unwrap_or(source.len());
    Some((field.value_start, end))
}

fn yaml_fields(source: &str) -> Vec<YamlField> {
    let mut fields = Vec::new();
    let mut parents = Vec::<(usize, String)>::new();
    let mut offset = 0;
    for line_with_ending in source.split_inclusive('\n') {
        let line = line_with_ending.trim_end_matches(['\r', '\n']);
        let indent = line.len() - line.trim_start_matches(' ').len();
        let trimmed = &line[indent..];
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('-') {
            offset += line_with_ending.len();
            continue;
        }
        let Some(colon) = trimmed.find(':') else {
            offset += line_with_ending.len();
            continue;
        };
        let key = trimmed[..colon].trim();
        if key.is_empty()
            || !key.chars().all(|character| {
                character.is_alphanumeric() || matches!(character, '_' | '-' | '.')
            })
        {
            offset += line_with_ending.len();
            continue;
        }
        while parents
            .last()
            .is_some_and(|(parent_indent, _)| *parent_indent >= indent)
        {
            parents.pop();
        }
        let path = parents
            .iter()
            .map(|(_, key)| key.as_str())
            .chain(std::iter::once(key))
            .collect::<Vec<_>>()
            .join(".");
        let mut value_start = offset + indent + colon + 1;
        while source
            .as_bytes()
            .get(value_start)
            .is_some_and(u8::is_ascii_whitespace)
            && source.as_bytes().get(value_start) != Some(&b'\n')
            && source.as_bytes().get(value_start) != Some(&b'\r')
        {
            value_start += 1;
        }
        fields.push(YamlField {
            path,
            indent,
            value_start,
            line_start: offset,
        });
        parents.push((indent, key.to_string()));
        offset += line_with_ending.len();
    }
    fields
}

fn find_yaml_scalar(
    source: &str,
    field_range: (usize, usize),
    cursor: usize,
    value: &str,
) -> Option<(usize, usize)> {
    let mut start = cursor.max(field_range.0);
    while start <= field_range.1 {
        let relative = source.get(start..field_range.1)?.find(value)?;
        let candidate_start = start + relative;
        let candidate_end = candidate_start + value.len();
        if yaml_value_boundary(source, candidate_start, candidate_end)
            && !is_in_yaml_comment(source, candidate_start)
        {
            return Some((candidate_start, candidate_end));
        }
        start = candidate_end;
    }
    None
}

fn is_in_yaml_comment(source: &str, offset: usize) -> bool {
    let line_start = source[..offset].rfind('\n').map_or(0, |index| index + 1);
    let prefix = &source[line_start..offset];
    let mut single_quoted = false;
    let mut double_quoted = false;
    let mut escaped = false;
    for character in prefix.chars() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' && double_quoted {
            escaped = true;
            continue;
        }
        match character {
            '\'' if !double_quoted => single_quoted = !single_quoted,
            '"' if !single_quoted => double_quoted = !double_quoted,
            '#' if !single_quoted && !double_quoted => return true,
            _ => {}
        }
    }
    false
}

fn yaml_value_boundary(source: &str, start: usize, end: usize) -> bool {
    let before = source[..start].chars().next_back();
    let after = source[end..].chars().next();
    before.is_none_or(|character| character.is_whitespace() || "[,'\":-".contains(character))
        && after.is_none_or(|character| character.is_whitespace() || "]},'\"#".contains(character))
}

fn frontmatter_content_offset(source: &str) -> Option<usize> {
    source
        .strip_prefix("---\n")
        .map(|_| 4)
        .or_else(|| source.strip_prefix("---\r\n").map(|_| 5))
}

fn split_reference_target(
    raw_target: &str,
) -> (String, Option<String>, Option<ReferenceFragmentKind>) {
    let (path, fragment) = raw_target
        .trim()
        .split_once('#')
        .unwrap_or((raw_target.trim(), ""));
    let fragment = fragment.trim();
    if fragment.is_empty() {
        return (path.to_string(), None, None);
    }
    if let Some(block) = fragment.strip_prefix('^') {
        (
            path.to_string(),
            Some(block.trim().to_string()),
            Some(ReferenceFragmentKind::Block),
        )
    } else {
        (
            path.to_string(),
            Some(fragment.to_string()),
            Some(ReferenceFragmentKind::Heading),
        )
    }
}

fn offset_span(source: &str, offset: usize, span: Option<SourceSpan>) -> Option<SourceSpan> {
    let span = span?;
    source_span(source, offset + span.start_byte, offset + span.end_byte)
}

fn split_source_target_span(
    source: &str,
    syntax_span: SourceSpan,
) -> (Option<SourceSpan>, Option<SourceSpan>) {
    let Some(raw_target) = source.get(syntax_span.start_byte..syntax_span.end_byte) else {
        return (None, None);
    };
    let Some(separator) = raw_target.find('#') else {
        return (Some(syntax_span), None);
    };
    if raw_target[separator + 1..].trim().is_empty() {
        return (Some(syntax_span), None);
    }

    let fragment_start = syntax_span.start_byte + separator;
    let target_span = (syntax_span.start_byte < fragment_start)
        .then(|| source_span(source, syntax_span.start_byte, fragment_start))
        .flatten();
    let fragment_span = source_span(source, fragment_start, syntax_span.end_byte);
    (target_span, fragment_span)
}

fn source_span(source: &str, start: usize, end: usize) -> Option<SourceSpan> {
    source.get(start..end)?;
    let (start_line, start_column) = line_column(source, start);
    let (end_line, end_column) = line_column(source, end);
    Some(SourceSpan {
        start_byte: start,
        end_byte: end,
        start_line,
        start_column,
        end_line,
        end_column,
    })
}

fn line_column(source: &str, offset: usize) -> (usize, usize) {
    let before = &source[..offset];
    let start_line = before.bytes().filter(|byte| *byte == b'\n').count() + 1;
    let line_start = before.rfind('\n').map_or(0, |index| index + 1);
    (start_line, source[line_start..offset].chars().count() + 1)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::{LoadMode, ReferenceSource, load_workspace};

    use super::{DocumentReferenceSyntax, analyze_document_references};

    #[test]
    fn analyzes_body_and_schema_declared_frontmatter_references_with_exact_ranges() {
        let workspace = load_workspace(fixture_root(), LoadMode::SharedOnly).unwrap();
        let source = "---\ntitle: Navigation test\nsummary: members/sam-rivera\nowners:\n  - members/sam-rivera\n  - \"members/mira-chen\"\n---\nSee [[members/sam-rivera|Sam]], [Mira](../members/mira-chen.md#Profile), and ![[members/sam-rivera#Avatar]].\n";

        let analysis = analyze_document_references(&workspace, "tasks/navigation-test.md", source);
        let targets = analysis
            .references
            .iter()
            .map(|reference| {
                (
                    reference.source,
                    reference.syntax,
                    reference.raw_target.as_str(),
                    reference
                        .target_span
                        .map(|span| &source[span.start_byte..span.end_byte]),
                )
            })
            .collect::<Vec<_>>();

        assert!(analysis.diagnostics.is_empty());
        assert_eq!(analysis.references[0].index, Some(0));
        assert_eq!(analysis.references[1].index, Some(1));
        assert_eq!(analysis.references[2].label.as_deref(), Some("Sam"));
        assert_eq!(
            targets,
            vec![
                (
                    ReferenceSource::Frontmatter,
                    DocumentReferenceSyntax::Frontmatter,
                    "members/sam-rivera",
                    Some("members/sam-rivera"),
                ),
                (
                    ReferenceSource::Frontmatter,
                    DocumentReferenceSyntax::Frontmatter,
                    "members/mira-chen",
                    Some("members/mira-chen"),
                ),
                (
                    ReferenceSource::Body,
                    DocumentReferenceSyntax::Wikilink,
                    "members/sam-rivera",
                    Some("members/sam-rivera"),
                ),
                (
                    ReferenceSource::Body,
                    DocumentReferenceSyntax::MarkdownLink,
                    "../members/mira-chen.md#Profile",
                    Some("../members/mira-chen.md"),
                ),
                (
                    ReferenceSource::Body,
                    DocumentReferenceSyntax::ObsidianEmbed,
                    "members/sam-rivera#Avatar",
                    Some("members/sam-rivera"),
                ),
            ]
        );
        let wikilink = &analysis.references[2];
        assert_eq!(
            &source[wikilink.syntax_span.start_byte..wikilink.syntax_span.end_byte],
            "[[members/sam-rivera|Sam]]"
        );
        let label_span = wikilink.label_span.unwrap();
        assert_eq!(&source[label_span.start_byte..label_span.end_byte], "Sam");
        let markdown_fragment = analysis.references[3].fragment_span.unwrap();
        assert_eq!(
            &source[markdown_fragment.start_byte..markdown_fragment.end_byte],
            "#Profile"
        );
        let embed_fragment = analysis.references[4].fragment_span.unwrap();
        assert_eq!(
            &source[embed_fragment.start_byte..embed_fragment.end_byte],
            "#Avatar"
        );
    }

    #[test]
    fn propagates_frontmatter_and_body_role_spans_with_crlf_unicode_and_emoji() {
        let workspace = load_workspace(fixture_root(), LoadMode::SharedOnly).unwrap();
        let source = "---\r\ntitle: Navigation test\r\nowners:\r\n  - members/目标#Profile\r\n---\r\nSee ![[members/目标#章节|  😀 标题  ]].\r\n";

        let analysis = analyze_document_references(&workspace, "tasks/navigation-test.md", source);

        assert!(analysis.diagnostics.is_empty());
        assert_eq!(analysis.references.len(), 2);
        let frontmatter = &analysis.references[0];
        let body = &analysis.references[1];
        assert_eq!(frontmatter.syntax, DocumentReferenceSyntax::Frontmatter);
        assert_eq!(
            &source[frontmatter.syntax_span.start_byte..frontmatter.syntax_span.end_byte],
            "members/目标#Profile"
        );
        let frontmatter_target = frontmatter.target_span.unwrap();
        let frontmatter_fragment = frontmatter.fragment_span.unwrap();
        assert_eq!(
            &source[frontmatter_target.start_byte..frontmatter_target.end_byte],
            "members/目标"
        );
        assert_eq!(
            &source[frontmatter_fragment.start_byte..frontmatter_fragment.end_byte],
            "#Profile"
        );
        assert!(frontmatter.label_span.is_none());

        assert_eq!(body.syntax, DocumentReferenceSyntax::ObsidianEmbed);
        assert_eq!(
            &source[body.syntax_span.start_byte..body.syntax_span.end_byte],
            "![[members/目标#章节|  😀 标题  ]]"
        );
        let body_target = body.target_span.unwrap();
        let body_fragment = body.fragment_span.unwrap();
        let body_label = body.label_span.unwrap();
        assert_eq!(
            &source[body_target.start_byte..body_target.end_byte],
            "members/目标"
        );
        assert_eq!(
            &source[body_fragment.start_byte..body_fragment.end_byte],
            "#章节"
        );
        assert_eq!(
            &source[body_label.start_byte..body_label.end_byte],
            "😀 标题"
        );
        assert_eq!(body.syntax_span.start_line, 6);
    }

    #[test]
    fn does_not_treat_an_ordinary_string_field_as_a_reference() {
        let workspace = load_workspace(fixture_root(), LoadMode::SharedOnly).unwrap();
        let source = "---\ntitle: Navigation test\nsummary: members/sam-rivera\nowners:\n  - members/sam-rivera\n---\n";

        let analysis = analyze_document_references(&workspace, "tasks/navigation-test.md", source);

        assert_eq!(analysis.references.len(), 1);
        assert_eq!(analysis.references[0].field.as_deref(), Some("owners"));
    }

    #[test]
    fn skips_comments_that_repeat_a_frontmatter_reference_value() {
        let workspace = load_workspace(fixture_root(), LoadMode::SharedOnly).unwrap();
        let source = "---\ntitle: Navigation test\nowners: # members/sam-rivera is the primary owner\n  - members/sam-rivera\n---\n";

        let analysis = analyze_document_references(&workspace, "tasks/navigation-test.md", source);
        let reference = analysis.references.first().unwrap();

        assert_eq!(analysis.references.len(), 1);
        assert_eq!(
            &source[reference.syntax_span.start_byte..reference.syntax_span.end_byte],
            "members/sam-rivera"
        );
        assert_eq!(reference.syntax_span.start_line, 4);
    }

    #[test]
    fn maps_nested_repeated_frontmatter_values_in_crlf_documents() {
        let mut workspace = load_workspace(fixture_root(), LoadMode::SharedOnly).unwrap();
        workspace.config.spaces.get_mut("tasks").unwrap().schema = serde_yml::from_str(
            "type: object\nfields:\n  fields:\n    type: object\n    fields:\n      owners:\n        type: list\n        items:\n          type: member\n",
        )
        .unwrap();
        let source = "---\r\nfields:\r\n  owners: [members/sam-rivera, members/sam-rivera]\r\n---\r\nSee [Sam](../members/sam-rivera.md).\r\n";

        let analysis = analyze_document_references(&workspace, "tasks/navigation-test.md", source);

        assert_eq!(analysis.references.len(), 3);
        assert_eq!(
            analysis.references[0].field.as_deref(),
            Some("fields.owners")
        );
        assert_eq!(analysis.references[0].index, Some(0));
        assert_eq!(analysis.references[1].index, Some(1));
        assert!(
            analysis.references[0].syntax_span.end_byte
                <= analysis.references[1].syntax_span.start_byte
        );
        assert_eq!(analysis.references[0].syntax_span.start_line, 3);
        assert_eq!(analysis.references[2].syntax_span.start_line, 5);
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/getting-started-workspace")
    }
}
