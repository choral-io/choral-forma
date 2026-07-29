#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct FrontmatterSlices<'a> {
    pub frontmatter: Option<&'a str>,
    pub body: &'a str,
}

pub(crate) fn split_frontmatter_slices(source: &str) -> FrontmatterSlices<'_> {
    let Some(first_line_end) = frontmatter_opening_end(source) else {
        return FrontmatterSlices {
            frontmatter: None,
            body: source,
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
            return FrontmatterSlices {
                frontmatter: Some(&source[first_line_end..offset]),
                body: &source[body_start..],
            };
        }
        if line_end == source.len() {
            break;
        }
        offset = line_end + 1;
    }

    FrontmatterSlices {
        frontmatter: None,
        body: source,
    }
}

pub(crate) fn frontmatter_opening_end(source: &str) -> Option<usize> {
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

#[cfg(test)]
mod tests {
    use super::split_frontmatter_slices;

    #[test]
    fn splits_lf_frontmatter() {
        let split = split_frontmatter_slices("---\ntitle: Example\n---\nBody\n");

        assert_eq!(split.frontmatter, Some("title: Example\n"));
        assert_eq!(split.body, "Body\n");
    }

    #[test]
    fn splits_crlf_frontmatter() {
        let split = split_frontmatter_slices("---\r\ntitle: Example\r\n---\r\nBody\r\n");

        assert_eq!(split.frontmatter, Some("title: Example\r\n"));
        assert_eq!(split.body, "Body\r\n");
    }

    #[test]
    fn does_not_treat_body_thematic_break_as_frontmatter() {
        let source = "---\r\nBody\r\n";
        let split = split_frontmatter_slices(source);

        assert_eq!(split.frontmatter, None);
        assert_eq!(split.body, source);
    }
}
