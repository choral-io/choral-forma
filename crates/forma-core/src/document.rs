use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{FormaWorkspace, SemanticType, SpaceDefinition, WorkspaceConfig};
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::frontmatter::frontmatter_opening_end;
use crate::index::{ReferenceFragmentKind, ReferenceIntent, ReferenceSource};
use crate::markdown::{
    FormaMarkdownDocument, FormaReference, FormaReferenceIntent, FormaReferenceSyntax, SourceSpan,
    markdown_fenced_references, markdown_inline_code_references,
};
use crate::model::ResolvedWorkspaceModel;
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
pub struct DocumentDiagnostic {
    pub diagnostic: Diagnostic,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<SourceSpan>,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceOccurrence {
    pub source_path: String,
    pub target_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment: Option<String>,
    pub syntax: DocumentReferenceSyntax,
    pub intent: ReferenceIntent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub span: SourceSpan,
    pub resolution: ReferenceOccurrenceResolution,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReferenceOccurrenceResolution {
    Resolved,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SemanticReferenceField {
    pub field: String,
    pub semantic_type: Option<String>,
    pub space: Option<String>,
    pub transform: Option<String>,
    pub many: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct EntryRefCompletionContext {
    pub query: String,
    pub replace_span: SourceSpan,
    pub target_space: Option<String>,
}

pub fn analyze_document_references(
    workspace: &FormaWorkspace,
    source_path: &str,
    source: &str,
) -> DocumentAnalysis {
    let document = FormaMarkdownDocument::parse(source);
    analyze_document_references_from_document(workspace, source_path, source, &document)
}

pub(crate) fn analyze_document_references_from_document(
    workspace: &FormaWorkspace,
    source_path: &str,
    source: &str,
    document: &FormaMarkdownDocument,
) -> DocumentAnalysis {
    let mut diagnostics = document
        .diagnostics
        .iter()
        .cloned()
        .map(|diagnostic| diagnostic.with_path(source_path))
        .collect::<Vec<_>>();
    let body_offset = source.len().saturating_sub(document.body.len());
    let mut references = body_references(source, body_offset, &document);

    if let Some(space) = matched_space(workspace, source_path, &mut diagnostics)
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
            &collect_semantic_reference_fields(&workspace.config, &workspace.model, &schema),
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

pub(crate) fn frontmatter_reference_completion_context(
    workspace: &FormaWorkspace,
    source_path: &str,
    source: &str,
    cursor_byte: usize,
) -> Option<EntryRefCompletionContext> {
    if cursor_byte > source.len() || !source.is_char_boundary(cursor_byte) {
        return None;
    }
    let frontmatter_offset = frontmatter_content_offset(source)?;
    let split = crate::frontmatter::split_frontmatter_slices(source);
    let raw = split.frontmatter?;
    let relative_cursor = cursor_byte.checked_sub(frontmatter_offset)?;
    if relative_cursor > raw.len() || !raw.is_char_boundary(relative_cursor) {
        return None;
    }
    let mut diagnostics = Vec::new();
    let space = matched_space(workspace, source_path, &mut diagnostics)?;
    let schema = parse_space_schema(space).ok()?;
    let semantic_fields =
        collect_semantic_reference_fields(&workspace.config, &workspace.model, &schema);
    let parsed_fields = yaml_fields(raw);

    for semantic_field in semantic_fields {
        let Some((field_index, parsed_field)) = parsed_fields
            .iter()
            .enumerate()
            .find(|(_, field)| field.path == semantic_field.field)
        else {
            continue;
        };
        let field_end = parsed_fields[field_index + 1..]
            .iter()
            .find(|candidate| candidate.indent <= parsed_field.indent)
            .map(|candidate| candidate.line_start)
            .unwrap_or(raw.len());
        if !(parsed_field.value_start..=field_end).contains(&relative_cursor) {
            continue;
        }
        let (start, end, query) = if semantic_field.many {
            partial_yaml_list_value(raw, parsed_field, field_end, relative_cursor)?
        } else {
            partial_yaml_scalar_value(raw, parsed_field, field_end, relative_cursor)?
        };
        return Some(EntryRefCompletionContext {
            query,
            replace_span: source_span(
                source,
                frontmatter_offset + start,
                frontmatter_offset + end,
            )?,
            target_space: semantic_field.space,
        });
    }
    None
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

pub(crate) fn parsed_frontmatter_references(
    source: &str,
    document: &FormaMarkdownDocument,
    fields: &[SemanticReferenceField],
) -> Vec<DocumentReference> {
    let (Some(raw), Some(value), Some(frontmatter_offset)) = (
        document.frontmatter.raw.as_deref(),
        document.frontmatter.value.as_ref(),
        frontmatter_content_offset(source),
    ) else {
        return Vec::new();
    };
    frontmatter_references(source, raw, frontmatter_offset, value, fields)
}

fn matched_space<'a>(
    workspace: &'a FormaWorkspace,
    source_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<&'a SpaceDefinition> {
    let mut matches = Vec::new();
    for (space_id, patterns) in workspace.model.scan_plan().space_patterns() {
        if patterns.is_match(source_path)
            && let Some(space) = workspace.model.content_group(space_id)
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
    model: &ResolvedWorkspaceModel,
    schema: &SchemaNode,
) -> Vec<SemanticReferenceField> {
    let mut fields = Vec::new();
    collect_semantic_reference_fields_inner(config, model, schema, "", false, &mut fields);
    fields
}

fn collect_semantic_reference_fields_inner(
    config: &WorkspaceConfig,
    model: &ResolvedWorkspaceModel,
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
                collect_semantic_reference_fields_inner(config, model, node, &next, many, fields);
            }
        }
        SchemaNode::List { items, .. } => {
            collect_semantic_reference_fields_inner(config, model, items, field_path, true, fields);
        }
        SchemaNode::Named { name, .. } => {
            if let Some(field) =
                semantic_reference_field(config, model, name, field_path, many, true)
            {
                fields.push(field);
            }
        }
        SchemaNode::EntryRef { target, .. } => {
            if let Some(target) = target {
                if let Some(field) =
                    semantic_reference_field(config, model, target, field_path, many, true)
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
    model: &ResolvedWorkspaceModel,
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
        space: model
            .semantic_type_target(type_name)
            .map(|content_group_id| content_group_id.as_str().to_string()),
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

fn partial_yaml_scalar_value(
    source: &str,
    field: &YamlField,
    field_end: usize,
    cursor: usize,
) -> Option<(usize, usize, String)> {
    if cursor > field_end || is_in_yaml_comment(source, cursor) {
        return None;
    }
    let line_end = source[field.value_start..field_end]
        .find(['\r', '\n'])
        .map(|offset| field.value_start + offset)
        .unwrap_or(field_end);
    if cursor > line_end {
        return None;
    }
    partial_yaml_token(source, field.value_start, cursor, line_end, &[])
}

fn partial_yaml_list_value(
    source: &str,
    field: &YamlField,
    field_end: usize,
    cursor: usize,
) -> Option<(usize, usize, String)> {
    if cursor > field_end || is_in_yaml_comment(source, cursor) {
        return None;
    }
    let field_prefix = &source[field.value_start..cursor];
    if field_prefix.trim_start().starts_with('[') {
        let segment_start = field_prefix
            .rfind([',', '['])
            .map(|offset| field.value_start + offset + 1)
            .unwrap_or(field.value_start);
        if source[segment_start..cursor].contains(']') {
            return None;
        }
        let line_end = source[cursor..field_end]
            .find(['\r', '\n'])
            .map(|offset| cursor + offset)
            .unwrap_or(field_end);
        return partial_yaml_token(source, segment_start, cursor, line_end, &[',', ']']);
    }

    let line_start = source[..cursor].rfind('\n').map_or(0, |offset| offset + 1);
    if line_start < field.line_start {
        return None;
    }
    let line_prefix = &source[line_start..cursor];
    let indent = line_prefix.len() - line_prefix.trim_start_matches(' ').len();
    if indent <= field.indent
        || direct_yaml_list_indent(source, field, field_end, line_start) != Some(indent)
    {
        return None;
    }
    let trimmed = &line_prefix[indent..];
    let after_dash = trimmed.strip_prefix('-')?;
    if !after_dash.is_empty()
        && !after_dash
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_whitespace)
    {
        return None;
    }
    let value_offset = after_dash.len() - after_dash.trim_start_matches(' ').len();
    let value_start = line_start + indent + 1 + value_offset;
    let line_end = source[cursor..field_end]
        .find(['\r', '\n'])
        .map(|offset| cursor + offset)
        .unwrap_or(field_end);
    partial_yaml_token(source, value_start, cursor, line_end, &[])
}

fn direct_yaml_list_indent(
    source: &str,
    field: &YamlField,
    field_end: usize,
    current_line_start: usize,
) -> Option<usize> {
    let first_child_line = source[field.line_start..field_end]
        .find('\n')
        .map(|offset| field.line_start + offset + 1)?;
    let mut line_start = first_child_line;
    let mut direct_indent = None;
    for line_with_ending in source[first_child_line..field_end].split_inclusive('\n') {
        if line_start > current_line_start {
            break;
        }
        let line = line_with_ending.trim_end_matches(['\r', '\n']);
        let indent = line.len() - line.trim_start_matches(' ').len();
        let trimmed = &line[indent..];
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            if direct_indent.is_none() {
                if !is_yaml_list_item(trimmed) {
                    return None;
                }
                direct_indent = Some(indent);
            }
            if line_start == current_line_start {
                return (direct_indent == Some(indent) && is_yaml_list_item(trimmed))
                    .then_some(indent);
            }
        }
        line_start += line_with_ending.len();
    }
    None
}

fn is_yaml_list_item(trimmed: &str) -> bool {
    trimmed.strip_prefix('-').is_some_and(|after_dash| {
        after_dash.is_empty()
            || after_dash
                .as_bytes()
                .first()
                .is_some_and(u8::is_ascii_whitespace)
    })
}

fn partial_yaml_token(
    source: &str,
    mut start: usize,
    cursor: usize,
    limit: usize,
    terminators: &[char],
) -> Option<(usize, usize, String)> {
    while source
        .as_bytes()
        .get(start)
        .is_some_and(u8::is_ascii_whitespace)
        && start < cursor
    {
        start += 1;
    }
    let quote = source
        .as_bytes()
        .get(start)
        .copied()
        .filter(|byte| matches!(*byte, b'\'' | b'"'));
    if quote.is_some() {
        start += 1;
    }
    if start > cursor || cursor > limit {
        return None;
    }

    let mut end = limit;
    if let Some(quote) = quote {
        let mut escaped = false;
        for (offset, byte) in source[start..limit].bytes().enumerate() {
            if byte == b'\\' && quote == b'"' && !escaped {
                escaped = true;
                continue;
            }
            if byte == quote && !escaped {
                end = start + offset;
                break;
            }
            escaped = false;
        }
    } else {
        end = source[start..limit]
            .char_indices()
            .find(|(offset, character)| {
                terminators.contains(character)
                    || (*character == '#'
                        && (*offset == 0
                            || source[start..start + *offset]
                                .chars()
                                .next_back()
                                .is_some_and(char::is_whitespace)))
            })
            .map(|(offset, _)| start + offset)
            .unwrap_or(limit);
        while let Some(character) = source[start..end].chars().next_back() {
            if !character.is_whitespace() {
                break;
            }
            end -= character.len_utf8();
        }
    }
    if cursor > end {
        return None;
    }
    let query = source.get(start..cursor)?;
    if query.chars().any(|character| {
        character == '\n'
            || character == '\r'
            || matches!(character, '\'' | '"' | '[' | ']' | '{' | '}')
    }) {
        return None;
    }
    Some((start, end, query.trim_end().to_string()))
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
    frontmatter_opening_end(source)
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

pub(crate) fn source_span(source: &str, start: usize, end: usize) -> Option<SourceSpan> {
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

    use crate::{ReferenceSource, load_workspace};

    use super::{
        DocumentReferenceSyntax, analyze_document_references,
        frontmatter_reference_completion_context,
    };

    #[test]
    fn analyzes_body_and_schema_declared_frontmatter_references_with_exact_ranges() {
        let workspace = load_workspace(fixture_root()).unwrap();
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
        let workspace = load_workspace(fixture_root()).unwrap();
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
        let workspace = load_workspace(fixture_root()).unwrap();
        let source = "---\ntitle: Navigation test\nsummary: members/sam-rivera\nowners:\n  - members/sam-rivera\n---\n";

        let analysis = analyze_document_references(&workspace, "tasks/navigation-test.md", source);

        assert_eq!(analysis.references.len(), 1);
        assert_eq!(analysis.references[0].field.as_deref(), Some("owners"));
    }

    #[test]
    fn skips_comments_that_repeat_a_frontmatter_reference_value() {
        let workspace = load_workspace(fixture_root()).unwrap();
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
        let mut workspace = load_workspace(fixture_root()).unwrap();
        std::sync::Arc::make_mut(&mut workspace.model)
            .content_group_mut("tasks")
            .unwrap()
            .schema = serde_yml::from_str(
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

    #[test]
    fn replaces_complete_active_entry_ref_tokens_in_yaml_shapes() {
        let mut workspace = load_workspace(fixture_root()).unwrap();
        std::sync::Arc::make_mut(&mut workspace.model)
            .content_group_mut("tasks")
            .unwrap()
            .schema = serde_yml::from_str(
            "type: object\nfields:\n  owner:\n    type: member\n  owners:\n    type: list\n    items:\n      type: member\n",
        )
        .unwrap();

        for (source, cursor_marker, query, replaced) in [
            (
                "---\nowner: \"Sam Rivera\"\n---\n",
                "Sam",
                "Sam",
                "Sam Rivera",
            ),
            (
                "---\nowners:\n  - Mira Chen\n---\n",
                "Mira",
                "Mira",
                "Mira Chen",
            ),
            (
                "---\nowners: [Sam Rivera, Mira Chen]\n---\n",
                "Mira",
                "Mira",
                "Mira Chen",
            ),
        ] {
            let cursor = source.find(cursor_marker).unwrap() + cursor_marker.len();
            let context = frontmatter_reference_completion_context(
                &workspace,
                "tasks/completion.md",
                source,
                cursor,
            )
            .unwrap();
            assert_eq!(context.query, query);
            assert_eq!(
                &source[context.replace_span.start_byte..context.replace_span.end_byte],
                replaced
            );
        }
    }

    #[test]
    fn excludes_nested_block_lists_from_entry_ref_completion() {
        let workspace = load_workspace(fixture_root()).unwrap();
        let source = "---\nowners:\n  metadata:\n    - Sam\n---\n";
        let cursor = source.find("Sam").unwrap() + "Sam".len();

        assert!(
            frontmatter_reference_completion_context(
                &workspace,
                "tasks/completion.md",
                source,
                cursor,
            )
            .is_none()
        );
    }

    fn fixture_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../examples/getting-started-workspace")
    }
}
