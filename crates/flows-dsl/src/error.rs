use std::fmt;

/// The phase that rejected a Definition, binding, or value.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[non_exhaustive]
pub enum ErrorStage {
    Definition,
    Input,
    Binding,
    Expression,
    Output,
    Execution,
}

impl ErrorStage {
    /// The portable name used in diagnostics across native, Node, and browser hosts.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Definition => "definition",
            Self::Input => "input",
            Self::Binding => "binding",
            Self::Expression => "expression",
            Self::Output => "output",
            Self::Execution => "execution",
        }
    }
}

/// A safe rejection that contains no supplied source text, data, or host paths.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DefinitionError {
    stage: ErrorStage,
    code: &'static str,
}

impl DefinitionError {
    pub(crate) const fn new(stage: ErrorStage, code: &'static str) -> Self {
        Self { stage, code }
    }

    /// Stage that rejected the operation.
    pub const fn stage(self) -> ErrorStage {
        self.stage
    }

    /// Stable reason identifier within the stage.
    pub const fn code(self) -> &'static str {
        self.code
    }
}

impl fmt::Display for DefinitionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.stage.as_str(), self.code)
    }
}

impl std::error::Error for DefinitionError {}

pub(crate) type Result<T> = std::result::Result<T, DefinitionError>;

pub(crate) const fn definition(code: &'static str) -> DefinitionError {
    DefinitionError::new(ErrorStage::Definition, code)
}
