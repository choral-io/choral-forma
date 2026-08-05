use serde::{Deserialize, Serialize};

use crate::document::source_span;
use crate::index::ReferenceIntent;
use crate::markdown::{SourceSpan, is_markdown_body_text_position};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentCompletion {
    pub replace_span: SourceSpan,
    pub candidates: Vec<DocumentCompletionCandidate>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentCompletionCandidate {
    pub label: String,
    pub insert_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub kind: DocumentCompletionKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DocumentCompletionKind {
    Entry,
    Heading,
    Block,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum CompletionContext {
    Target {
        query: String,
        intent: ReferenceIntent,
        replace_span: SourceSpan,
    },
    Fragment {
        target: String,
        query: String,
        replace_span: SourceSpan,
    },
}

pub(crate) fn wikilink_completion_context(
    source: &str,
    cursor_byte: usize,
) -> Option<CompletionContext> {
    if cursor_byte > source.len() || !source.is_char_boundary(cursor_byte) {
        return None;
    }
    let line_start = source[..cursor_byte]
        .rfind(['\r', '\n'])
        .map_or(0, |offset| offset + 1);
    let line_end = source[cursor_byte..]
        .find(['\r', '\n'])
        .map_or(source.len(), |offset| cursor_byte + offset);
    let opening = line_start + source[line_start..cursor_byte].rfind("[[")?;
    let content_start = opening + 2;
    let content_prefix = &source[content_start..cursor_byte];
    if content_prefix.contains("]]") || content_prefix.contains('|') {
        return None;
    }
    if !is_markdown_body_text_position(source, opening) {
        return None;
    }

    if let Some(hash) = content_prefix.find('#') {
        let fragment_start = content_start + hash + 1;
        let fragment_end = first_delimiter(source, fragment_start, line_end, &["|", "]]"]);
        if cursor_byte > fragment_end {
            return None;
        }
        return Some(CompletionContext::Fragment {
            target: content_prefix[..hash].trim().to_string(),
            query: source[fragment_start..cursor_byte].to_string(),
            replace_span: source_span(source, fragment_start, fragment_end)?,
        });
    }

    let target_end = first_delimiter(source, content_start, line_end, &["#", "|", "]]"]);
    if cursor_byte > target_end {
        return None;
    }
    let intent = if opening > 0 && source.as_bytes()[opening - 1] == b'!' {
        ReferenceIntent::Embed
    } else {
        ReferenceIntent::Link
    };
    Some(CompletionContext::Target {
        query: content_prefix.to_string(),
        intent,
        replace_span: source_span(source, content_start, target_end)?,
    })
}

fn first_delimiter(source: &str, start: usize, end: usize, delimiters: &[&str]) -> usize {
    delimiters
        .iter()
        .filter_map(|delimiter| {
            source[start..end]
                .find(delimiter)
                .map(|offset| start + offset)
        })
        .min()
        .unwrap_or(end)
}

#[cfg(test)]
mod tests {
    use super::{CompletionContext, wikilink_completion_context};
    use crate::index::ReferenceIntent;

    #[test]
    fn finds_incomplete_wikilink_embed_and_fragment_contexts() {
        let source = "See [[成员/项";
        let context = wikilink_completion_context(source, source.len()).unwrap();
        assert!(matches!(
            context,
            CompletionContext::Target {
                query,
                intent: ReferenceIntent::Link,
                ..
            } if query == "成员/项"
        ));

        let source = "![[notes/target";
        assert!(matches!(
            wikilink_completion_context(source, source.len()).unwrap(),
            CompletionContext::Target {
                intent: ReferenceIntent::Embed,
                ..
            }
        ));

        let source = "[[notes/target#目标";
        assert!(matches!(
            wikilink_completion_context(source, source.len()).unwrap(),
            CompletionContext::Fragment { target, query, .. }
                if target == "notes/target" && query == "目标"
        ));
    }

    #[test]
    fn ignores_closed_links_labels_and_code_examples() {
        for source in [
            "[[notes/target]]",
            "[[notes/target|Lab",
            "`[[notes/tar`",
            "```md\n[[notes/tar\n```",
        ] {
            assert!(wikilink_completion_context(source, source.len()).is_none());
        }
    }

    #[test]
    fn replaces_complete_active_tokens_inside_links_embeds_and_fragments() {
        let source = "See [[Sam Rivera|Sam]]";
        let cursor = source.find("Sam Rivera").unwrap() + "Sam".len();
        let context = wikilink_completion_context(source, cursor).unwrap();
        assert!(matches!(
            &context,
            CompletionContext::Target { query, .. } if query == "Sam"
        ));
        let CompletionContext::Target { replace_span, .. } = context else {
            unreachable!();
        };
        assert_eq!(
            &source[replace_span.start_byte..replace_span.end_byte],
            "Sam Rivera"
        );

        let source = "![[notes/target draft|Preview]]";
        let cursor = source.find("target draft").unwrap() + "target".len();
        let context = wikilink_completion_context(source, cursor).unwrap();
        let CompletionContext::Target {
            query,
            intent,
            replace_span,
        } = context
        else {
            unreachable!();
        };
        assert_eq!(query, "notes/target");
        assert_eq!(intent, ReferenceIntent::Embed);
        assert_eq!(
            &source[replace_span.start_byte..replace_span.end_byte],
            "notes/target draft"
        );

        let source = "[[notes/target#Heading Draft|Label]]";
        let cursor = source.find("Heading Draft").unwrap() + "Heading".len();
        let context = wikilink_completion_context(source, cursor).unwrap();
        let CompletionContext::Fragment {
            target,
            query,
            replace_span,
        } = context
        else {
            unreachable!();
        };
        assert_eq!(target, "notes/target");
        assert_eq!(query, "Heading");
        assert_eq!(
            &source[replace_span.start_byte..replace_span.end_byte],
            "Heading Draft"
        );
    }

    #[test]
    fn does_not_reuse_an_unclosed_opener_from_a_prior_line() {
        for source in [
            "Prior [[unfinished\nplain text",
            "Prior [[unfinished\r\nplain text",
            "Prior [[unfinished\rplain text",
        ] {
            assert!(wikilink_completion_context(source, source.len()).is_none());
        }
    }
}
