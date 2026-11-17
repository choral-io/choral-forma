use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Component, Path};

use forma_core::routes::{ROUTE_PREFLIGHT_INCOMPLETE_CODE, ROUTE_STATIC_OUTPUT_CONFLICT_CODE};
use forma_core::{
    DiagnosticSeverity, StaticSiteDiagnostic, StaticSiteResourceCandidate, StaticSiteRoute,
};

use super::{SiteBuildError, safe_relative_path};

pub(super) struct ArtifactOutput<'a> {
    path: &'a str,
    owner: String,
    source: Option<&'a str>,
}

impl<'a> ArtifactOutput<'a> {
    pub(super) fn route(route: &'a StaticSiteRoute) -> Self {
        Self {
            path: &route.output_path,
            owner: format!("route `{}`", route.path),
            source: route.source_path.as_deref(),
        }
    }

    pub(super) fn resource(resource: &'a StaticSiteResourceCandidate) -> Self {
        Self {
            path: &resource.output_path,
            owner: "resource".into(),
            source: Some(&resource.path),
        }
    }

    pub(super) fn generated(path: &'a str, owner: &str) -> Self {
        Self {
            path,
            owner: owner.into(),
            source: None,
        }
    }

    fn describe(&self) -> String {
        let source = self
            .source
            .map_or_else(String::new, |path| format!(" from `{path}`"));
        format!("{}{} at `{}`", self.owner, source, self.path)
    }
}

pub(super) fn validate_artifact_outputs<'a>(
    staging: &Path,
    outputs: impl Iterator<Item = ArtifactOutput<'a>>,
    shared_diagnostics: &[StaticSiteDiagnostic],
) -> Result<(), SiteBuildError> {
    let mut diagnostics = preflight_errors(shared_diagnostics);
    let outputs = outputs.collect::<Vec<_>>();
    let valid = outputs
        .iter()
        .enumerate()
        .filter_map(|(index, output)| {
            if safe_relative_path(output.path).is_err()
                || !output.path.split('/').all(safe_probe_segment)
            {
                diagnostics.push(output_conflict(
                    "Static output path is unsafe.",
                    std::iter::once(output),
                ));
                None
            } else {
                Some((index, output.path))
            }
        })
        .collect::<Vec<_>>();

    // Preserve the portable ASCII case checks for all files, including generated assets.
    let mut portable = BTreeMap::<Vec<String>, Vec<usize>>::new();
    for &(index, path) in &valid {
        let key = path.split('/').map(str::to_ascii_lowercase).collect();
        portable.entry(key).or_default().push(index);
    }
    let mut conflicts = BTreeMap::new();
    collect_conflicts(
        &portable,
        &mut conflicts,
        "Static output path has competing owners.",
    );

    let probe = staging.join(".output-preflight");
    match fs::create_dir(&probe) {
        Ok(()) => {
            collect_filesystem_conflicts(
                &probe,
                &valid,
                &outputs,
                &mut conflicts,
                &mut diagnostics,
            );
            if let Err(error) = fs::remove_dir_all(&probe) {
                diagnostics.push(incomplete_diagnostic(format!(
                    "could not remove output name probes: {error}"
                )));
            }
        }
        Err(error) => diagnostics.push(incomplete_diagnostic(format!(
            "could not create output name probes: {error}"
        ))),
    }
    for (claims, message) in conflicts {
        diagnostics.push(output_conflict(
            message,
            claims.into_iter().map(|index| &outputs[index]),
        ));
    }
    if diagnostics.is_empty() {
        Ok(())
    } else {
        Err(SiteBuildError {
            message: "Static output preflight failed".into(),
            diagnostics,
        })
    }
}

fn safe_probe_segment(segment: &str) -> bool {
    if segment.contains(['\\', '\0']) || (cfg!(windows) && segment.contains(':')) {
        return false;
    }
    let mut components = Path::new(segment).components();
    matches!(components.next(), Some(Component::Normal(name)) if name == OsStr::new(segment))
        && components.next().is_none()
}

fn collect_filesystem_conflicts(
    probe: &Path,
    valid: &[(usize, &str)],
    outputs: &[ArtifactOutput<'_>],
    conflicts: &mut BTreeMap<Vec<usize>, &'static str>,
    diagnostics: &mut Vec<StaticSiteDiagnostic>,
) {
    let mut names = BTreeMap::new();
    let mut next_node = 1;
    let mut files = BTreeMap::<Vec<usize>, Vec<usize>>::new();
    for &(index, path) in valid {
        let mut parent = 0;
        let key: io::Result<Vec<_>> = path
            .split('/')
            .map(|segment| {
                let name = (parent, segment);
                let node = if let Some(&node) = names.get(&name) {
                    node
                } else {
                    let node = probe_component(probe, parent, segment, next_node)?;
                    if node == next_node {
                        next_node += 1;
                    }
                    names.insert(name, node);
                    node
                };
                parent = node;
                Ok(node)
            })
            .collect();
        match key {
            Ok(key) => files.entry(key).or_default().push(index),
            Err(error) => diagnostics.push(incomplete_diagnostic(format!(
                "{}: {error}",
                outputs[index].describe()
            ))),
        }
    }

    let message = "The output filesystem cannot keep these artifact paths distinct.";
    collect_conflicts(&files, conflicts, message);

    // Distinct spellings can lose a directory name even when their child files do not overlap.
    let mut name_counts = BTreeMap::<usize, usize>::new();
    for &node in names.values() {
        *name_counts.entry(node).or_default() += 1;
    }
    let mut directory_owners = BTreeMap::<usize, BTreeSet<usize>>::new();
    for (path, owners) in &files {
        for node in &path[..path.len() - 1] {
            if name_counts.get(node).copied().unwrap_or_default() > 1 {
                directory_owners.entry(*node).or_default().extend(owners);
            }
        }
    }
    for owners in directory_owners
        .into_values()
        .filter(|owners| owners.len() > 1)
    {
        conflicts.insert(owners.into_iter().collect(), message);
    }
}

// Each logical parent has a private bucket. A marker bearing the node number
// can be read back through every spelling the target filesystem treats as equal.
// This also lets the inventory descend through a node claimed as an output file.
fn probe_component(probe: &Path, parent: usize, segment: &str, next: usize) -> io::Result<usize> {
    let bucket = probe.join(parent.to_string());
    fs::create_dir_all(&bucket)?;
    let marker = bucket.join(segment);
    match fs::create_dir(&marker) {
        Ok(()) => {
            fs::write(marker.join("owner"), next.to_le_bytes())?;
            Ok(next)
        }
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            let bytes = fs::read(marker.join("owner"))?
                .try_into()
                .map_err(|_| io::Error::other("invalid output name probe record"))?;
            let node = usize::from_le_bytes(bytes);
            if node == 0 || node >= next {
                return Err(io::Error::other("invalid output name probe identity"));
            }
            Ok(node)
        }
        Err(error) => Err(error),
    }
}

fn collect_conflicts<T: Ord + Clone>(
    paths: &BTreeMap<Vec<T>, Vec<usize>>,
    conflicts: &mut BTreeMap<Vec<usize>, &'static str>,
    message: &'static str,
) {
    for (path, claims) in paths {
        let owners = paths
            .range(path.clone()..)
            .take_while(|(candidate, _)| candidate.starts_with(path))
            .flat_map(|(_, owners)| owners.iter().copied())
            .collect::<BTreeSet<_>>();
        if claims.len() > 1 || owners.len() > claims.len() {
            conflicts.insert(owners.into_iter().collect(), message);
        }
    }
}

fn output_conflict<'a>(
    message: &str,
    outputs: impl Iterator<Item = &'a ArtifactOutput<'a>>,
) -> StaticSiteDiagnostic {
    let mut source = None;
    let actual = outputs
        .map(|output| {
            source = source.or(output.source);
            output.describe()
        })
        .collect::<Vec<_>>()
        .join(", ");
    StaticSiteDiagnostic {
        severity: DiagnosticSeverity::Error,
        code: ROUTE_STATIC_OUTPUT_CONFLICT_CODE.into(),
        message: message.into(),
        path: source.map(str::to_owned),
        route_path: None,
        location: None,
        actual: Some(actual),
        expected: Some("Unique output paths without file and directory overlap".into()),
    }
}

pub(super) fn incomplete_output_preflight(
    actual: String,
    shared_diagnostics: &[StaticSiteDiagnostic],
) -> SiteBuildError {
    let mut diagnostics = preflight_errors(shared_diagnostics);
    diagnostics.push(incomplete_diagnostic(actual));
    SiteBuildError {
        message: "Static output preflight did not complete".into(),
        diagnostics,
    }
}

fn preflight_errors(shared_diagnostics: &[StaticSiteDiagnostic]) -> Vec<StaticSiteDiagnostic> {
    shared_diagnostics
        .iter()
        .filter(|diagnostic| diagnostic.severity == DiagnosticSeverity::Error)
        .cloned()
        .collect()
}

fn incomplete_diagnostic(actual: String) -> StaticSiteDiagnostic {
    StaticSiteDiagnostic {
        severity: DiagnosticSeverity::Error,
        code: ROUTE_PREFLIGHT_INCOMPLETE_CODE.into(),
        message: "Could not verify every path on the output filesystem.".into(),
        path: None,
        route_path: None,
        location: None,
        actual: Some(actual),
        expected: Some(
            "A writable output filesystem that supports the requested artifact paths".into(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::safe_probe_segment;

    #[test]
    fn a_probe_name_cannot_reinterpret_its_parent_directory() {
        for invalid in ["", ".", "..", "/absolute", "a/b", "a/", r"a\b", "x\0y"] {
            assert!(!safe_probe_segment(invalid), "{invalid:?}");
        }
        assert!(safe_probe_segment("Ångström"));
        for name in ["C:relative", "report:stream"] {
            assert_eq!(safe_probe_segment(name), !cfg!(windows), "{name:?}");
        }
    }
}
