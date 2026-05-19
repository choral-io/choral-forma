/// Minimal operation status values shared by future adapters.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationStatus {
    Passed,
    Warning,
    Failed,
}

/// Returns the core version visible to RPC adapters.
pub fn core_version() -> &'static str {
    forma_core::version()
}

#[cfg(test)]
mod tests {
    use super::{OperationStatus, core_version};

    #[test]
    fn exposes_core_version() {
        assert_eq!(core_version(), "0.1.0");
    }

    #[test]
    fn status_values_are_comparable() {
        assert_eq!(OperationStatus::Passed, OperationStatus::Passed);
        assert_ne!(OperationStatus::Warning, OperationStatus::Failed);
    }
}
