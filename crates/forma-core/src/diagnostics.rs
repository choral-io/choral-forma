use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OperationStatus {
    Passed,
    Warning,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiagnosticLocation {
    File,
    Frontmatter {
        field: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        index: Option<usize>,
    },
    Body {
        #[serde(skip_serializing_if = "Option::is_none")]
        line: Option<usize>,
        #[serde(skip_serializing_if = "Option::is_none")]
        column: Option<usize>,
    },
    Config {
        field: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub severity: DiagnosticSeverity,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<DiagnosticLocation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected: Option<String>,
}

impl Diagnostic {
    pub fn error(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            severity: DiagnosticSeverity::Error,
            code: code.into(),
            message: message.into(),
            path: None,
            location: None,
            actual: None,
            expected: None,
        }
    }

    pub fn warning(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            severity: DiagnosticSeverity::Warning,
            code: code.into(),
            message: message.into(),
            path: None,
            location: None,
            actual: None,
            expected: None,
        }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    pub fn with_location(mut self, location: DiagnosticLocation) -> Self {
        self.location = Some(location);
        self
    }

    pub fn with_actual(mut self, actual: impl Into<String>) -> Self {
        self.actual = Some(actual.into());
        self
    }

    pub fn with_expected(mut self, expected: impl Into<String>) -> Self {
        self.expected = Some(expected.into());
        self
    }
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticSummary {
    pub errors: usize,
    pub warnings: usize,
    pub infos: usize,
}

impl DiagnosticSummary {
    pub fn from_diagnostics(diagnostics: &[Diagnostic]) -> Self {
        let mut summary = Self::default();

        for diagnostic in diagnostics {
            match diagnostic.severity {
                DiagnosticSeverity::Error => summary.errors += 1,
                DiagnosticSeverity::Warning => summary.warnings += 1,
                DiagnosticSeverity::Info => summary.infos += 1,
            }
        }

        summary
    }

    pub fn status(self) -> OperationStatus {
        if self.errors > 0 {
            OperationStatus::Failed
        } else if self.warnings > 0 {
            OperationStatus::Warning
        } else {
            OperationStatus::Passed
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Diagnostic, DiagnosticSummary, OperationStatus};

    #[test]
    fn summary_derives_status_from_highest_severity() {
        assert_eq!(
            DiagnosticSummary::default().status(),
            OperationStatus::Passed
        );

        let warnings = [Diagnostic::warning("config.unknownField", "Unknown field.")];
        assert_eq!(
            DiagnosticSummary::from_diagnostics(&warnings).status(),
            OperationStatus::Warning
        );

        let errors = [Diagnostic::error("path.invalid", "Invalid path.")];
        assert_eq!(
            DiagnosticSummary::from_diagnostics(&errors).status(),
            OperationStatus::Failed
        );
    }
}
