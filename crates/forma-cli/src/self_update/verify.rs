use std::error::Error;
use std::fmt::Write as _;
use std::fs;
use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};

use super::error;

pub fn parse_checksum(source: &str, expected_name: &str) -> Result<String, Box<dyn Error>> {
    let lines = source
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    if lines.len() != 1 {
        return Err(error(format!(
            "checksum for {expected_name} must contain exactly one entry"
        )));
    }
    let mut fields = lines[0].split_whitespace();
    let digest = fields.next().unwrap_or_default();
    let raw_name = fields.next().unwrap_or_default();
    if fields.next().is_some()
        || digest.len() != 64
        || !digest.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(error(format!("checksum for {expected_name} is invalid")));
    }
    let parsed_name = raw_name.strip_prefix('*').unwrap_or(raw_name);
    if parsed_name != expected_name {
        return Err(error(format!(
            "checksum names {parsed_name} instead of {expected_name}"
        )));
    }
    Ok(digest.to_ascii_lowercase())
}

pub fn verify_file(path: &Path, expected: &str) -> Result<(), Box<dyn Error>> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let mut actual = String::with_capacity(64);
    for byte in hasher.finalize() {
        write!(&mut actual, "{byte:02x}")?;
    }
    if actual != expected {
        return Err(error(format!(
            "checksum mismatch for {}: expected {expected}, received {actual}",
            path.display()
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const DIGEST: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn parses_strict_checksum_entry() {
        assert_eq!(
            parse_checksum(&format!("{DIGEST}  forma-linux-x64\n"), "forma-linux-x64").unwrap(),
            DIGEST
        );
        assert_eq!(
            parse_checksum(&format!("{DIGEST} *forma-linux-x64\n"), "forma-linux-x64").unwrap(),
            DIGEST
        );
    }

    #[test]
    fn rejects_mismatched_or_multiple_entries() {
        assert!(parse_checksum(&format!("{DIGEST}  other\n"), "forma-linux-x64").is_err());
        assert!(
            parse_checksum(
                &format!("{DIGEST}  forma-linux-x64\n{DIGEST}  other\n"),
                "forma-linux-x64"
            )
            .is_err()
        );
        assert!(parse_checksum("invalid", "forma-linux-x64").is_err());
    }
}
