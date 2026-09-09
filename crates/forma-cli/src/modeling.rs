use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::{self, BufRead, IsTerminal, Write};
use std::path::{Path, PathBuf};

use clap::Subcommand;
use forma_core::guided_modeling::{
    ApplyStatus, FieldChoice, FieldKind, FilePlan, SliceChoice, SliceLayout, apply_plan,
    prepare_plan,
};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

#[derive(Debug, Subcommand)]
pub(super) enum ModelCommand {
    /// Ask for choices, show complete files, and require the exact plan id to apply.
    Guide,
    /// Validate choices and emit a complete JSON file plan without changing the workspace.
    Prepare {
        #[arg(long)]
        choices: PathBuf,
        /// Create a plan file; an existing file is never overwritten. Defaults to stdout.
        #[arg(long)]
        output: Option<PathBuf>,
    },
    /// Apply a reviewed plan using its exact id as confirmation.
    Apply {
        #[arg(long)]
        plan: PathBuf,
        #[arg(long)]
        confirm: String,
    },
}

pub(super) fn execute(root: &Path, command: ModelCommand) -> Result<()> {
    match command {
        ModelCommand::Prepare { choices, output } => {
            let choice: SliceChoice = serde_json::from_slice(&fs::read(choices)?)?;
            let plan = prepare_plan(root, &choice)?;
            let json = serde_json::to_string_pretty(&plan)?;
            if let Some(output) = output {
                let mut file = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(output)?;
                writeln!(file, "{json}")?;
            } else {
                writeln!(io::stdout().lock(), "{json}")?;
            }
            Ok(())
        }
        ModelCommand::Apply { plan, confirm } => {
            let plan: FilePlan = serde_json::from_slice(&fs::read(plan)?)?;
            let report = apply_plan(root, &plan, &confirm)?;
            writeln!(
                io::stdout().lock(),
                "{}",
                serde_json::to_string_pretty(&report)?
            )?;
            if report.status != ApplyStatus::Applied {
                return Err("Model application did not complete. Review the reported files; no automatic cleanup was performed.".into());
            }
            Ok(())
        }
        ModelCommand::Guide => {
            if !io::stdin().is_terminal() || !io::stdout().is_terminal() {
                return Err("model guide requires a terminal; use model prepare/apply for structured input.".into());
            }
            guide(root, &mut io::stdin().lock(), &mut io::stdout().lock())
        }
    }
}

fn ask(
    input: &mut impl BufRead,
    output: &mut impl Write,
    prompt: &str,
    default: Option<&str>,
) -> Result<String> {
    loop {
        write!(output, "{prompt}")?;
        if let Some(default) = default {
            write!(output, " [{default}]")?;
        }
        write!(output, ": ")?;
        output.flush()?;
        let mut answer = String::new();
        if input.read_line(&mut answer)? == 0 {
            return Err("Input ended; no further writes were authorized.".into());
        }
        let answer = answer.trim().to_string();
        if !answer.is_empty() {
            return Ok(answer);
        }
        if let Some(default) = default {
            return Ok(default.into());
        }
        writeln!(output, "Please provide a value.")?;
    }
}

fn yes_no(
    input: &mut impl BufRead,
    output: &mut impl Write,
    prompt: &str,
    default: bool,
) -> Result<bool> {
    loop {
        match ask(input, output, prompt, Some(if default { "y" } else { "n" }))?.as_str() {
            "y" | "yes" => return Ok(true),
            "n" | "no" => return Ok(false),
            _ => writeln!(output, "Use y or n.")?,
        }
    }
}

fn choices(input: &mut impl BufRead, output: &mut impl Write) -> Result<SliceChoice> {
    let outcome = ask(
        input,
        output,
        "What should this content help you decide or do?",
        None,
    )?;
    let title = ask(
        input,
        output,
        "What recurring content will you record?",
        None,
    )?;
    let group_id = ask(
        input,
        output,
        "Short identifier for this content group",
        None,
    )?;
    let taxonomy_id = ask(
        input,
        output,
        "Identifier for its content-group classification",
        Some("collections"),
    )?;
    let mut fields = BTreeMap::new();
    writeln!(
        output,
        "Title is required. Add only the extra fields needed now; a blank field name finishes the list."
    )?;
    loop {
        let name = ask(input, output, "Field name", Some(""))?;
        if name.is_empty() {
            break;
        }
        if name == "title" || name == "slug" || fields.contains_key(&name) {
            writeln!(output, "That name is reserved or already selected.")?;
            continue;
        }
        let kind = loop {
            match ask(input, output, "Field type (text/date)", Some("text"))?.as_str() {
                "text" => break FieldKind::Text,
                "date" => break FieldKind::Date,
                _ => writeln!(output, "This first slice supports text or date.")?,
            }
        };
        let label = ask(input, output, "Display label", Some(&name))?;
        let required = yes_no(input, output, "Must every entry provide this field?", false)?;
        let reason = ask(input, output, "Why is this field useful?", None)?;
        fields.insert(
            name,
            FieldChoice {
                kind,
                label,
                required,
                reason,
            },
        );
    }
    let default_columns = fields.keys().cloned().collect::<Vec<_>>().join(",");
    let columns = ask(
        input,
        output,
        "Table columns after title (comma-separated field names)",
        Some(&default_columns),
    )?;
    let view_columns = columns
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();
    writeln!(
        output,
        "Choose where the files belong. Control files must match your existing imports; the template is reached by its explicit reference."
    )?;
    let layout = SliceLayout {
        taxonomy_file: ask(
            input,
            output,
            "Taxonomy file",
            Some(&format!(".forma/{taxonomy_id}.md")),
        )?,
        group_file: ask(
            input,
            output,
            "Content group file",
            Some(&format!(".forma/spaces/{group_id}.md")),
        )?,
        template_file: ask(
            input,
            output,
            "Template file",
            Some(&format!(".forma/templates/{group_id}.md")),
        )?,
        view_file: ask(
            input,
            output,
            "Table view file",
            Some(&format!(".forma/views/{group_id}.md")),
        )?,
        content_directory: ask(
            input,
            output,
            "Directory for future entries",
            Some(&group_id),
        )?,
    };
    Ok(SliceChoice {
        outcome,
        taxonomy_id,
        group_id,
        title,
        fields,
        view_columns,
        layout,
    })
}

fn guide(root: &Path, input: &mut impl BufRead, output: &mut impl Write) -> Result<()> {
    writeln!(
        output,
        "Create one content group in an initialized, empty corpus. Existing content import is a separate operation."
    )?;
    let plan = loop {
        let choice = choices(input, output)?;
        let plan = match prepare_plan(root, &choice) {
            Ok(plan) => plan,
            Err(error) => {
                writeln!(output, "Plan cannot be applied: {error}")?;
                if yes_no(input, output, "Revise the choices?", true)? {
                    continue;
                }
                return Ok(());
            }
        };
        writeln!(
            output,
            "\nOutcome: {}\nWorkspace binding: {}",
            plan.choice.outcome, plan.workspace_id
        )?;
        for (name, field) in &plan.choice.fields {
            writeln!(output, "Field {name}: {}", field.reason)?;
        }
        for advisory in &plan.advisories {
            writeln!(
                output,
                "Notice [{}] {}: {}",
                advisory.code, advisory.path, advisory.message
            )?;
        }
        for file in &plan.files {
            writeln!(output, "\nFile: {}\n{}", file.path, file.content)?;
        }
        writeln!(
            output,
            "Validation: {}\nPlan id: {}",
            plan.verification.join("; "),
            plan.id
        )?;
        let confirm = ask(
            input,
            output,
            "Paste the exact plan id to create these files, 'edit' to revise, or Enter to cancel",
            Some(""),
        )?;
        if confirm == "edit" {
            continue;
        }
        if confirm != plan.id {
            writeln!(output, "Cancelled; no workspace files created.")?;
            return Ok(());
        }
        let report = apply_plan(root, &plan, &confirm)?;
        writeln!(output, "{}", serde_json::to_string_pretty(&report)?)?;
        if report.status != ApplyStatus::Applied {
            return Err(
                "Apply incomplete; preserve and review the reported files before recovery.".into(),
            );
        }
        break plan;
    };
    writeln!(
        output,
        "The content group is ready. Its table is {}.",
        plan.choice.layout.view_file
    )?;
    if !yes_no(input, output, "Create your first entry now?", true)? {
        writeln!(
            output,
            "Next: forma create {} --input title=... ; forma list --space {}",
            plan.choice.group_id, plan.choice.group_id
        )?;
        return Ok(());
    }
    let mut values = BTreeMap::new();
    values.insert(
        "title".into(),
        serde_yml::Value::String(ask(input, output, "Entry title", None)?),
    );
    for (name, field) in &plan.choice.fields {
        let value = ask(
            input,
            output,
            &field.label,
            if field.required { None } else { Some("") },
        )?;
        if !value.is_empty() {
            values.insert(name.clone(), serde_yml::Value::String(value));
        }
    }
    let preview = forma_core::create_preview(root, &plan.choice.group_id, values.clone())?;
    if preview.status != forma_core::OperationStatus::Passed || !preview.target.writable {
        return Err(format!("Entry preview needs attention: {:?}", preview.diagnostics).into());
    }
    writeln!(
        output,
        "\nFile: {}\n{}",
        preview.target.path, preview.content.source
    )?;
    let expected = format!("create {}", preview.target.path);
    if ask(
        input,
        output,
        &format!("Type '{expected}' to create this entry; Enter cancels"),
        Some(""),
    )? != expected
    {
        writeln!(
            output,
            "Entry creation cancelled; the content group remains ready."
        )?;
        return Ok(());
    }
    // Recheck the displayed entry before invoking the existing create operation.
    let current = forma_core::create_preview(root, &plan.choice.group_id, values.clone())?;
    if current != preview {
        return Err("Entry preview changed; run forma create --preview again.".into());
    }
    let created = forma_core::create_entry(root, &plan.choice.group_id, values)?;
    let count = verify_created_entry(root, &plan.choice, &created).map_err(|error| {
        format!("Entry was created at {}, but verification failed: {error}. The file is retained; inspect it before retrying.", created.created.path)
    })?;
    writeln!(
        output,
        "Created and retrieved {} ({} entries in {}).",
        created.created.path, count, plan.choice.group_id
    )?;
    Ok(())
}

fn verify_created_entry(
    root: &Path,
    choice: &SliceChoice,
    created: &forma_core::CreateResult,
) -> Result<usize> {
    let inspected = forma_core::inspect_entry_by_path(root, &created.created.path)?;
    let listed = forma_core::list_space(root, &choice.group_id)?;
    let view = forma_core::render_view(
        root,
        choice
            .layout
            .view_file
            .strip_suffix(".md")
            .unwrap_or(&choice.layout.view_file),
        BTreeMap::new(),
    )?;
    if created.status != forma_core::OperationStatus::Passed
        || inspected.status != forma_core::OperationStatus::Passed
        || listed.status != forma_core::OperationStatus::Passed
        || view.status != forma_core::OperationStatus::Passed
        || inspected.entry.space.as_deref() != Some(&choice.group_id)
        || !listed
            .entries
            .iter()
            .any(|entry| entry.path == created.created.path)
        || !matches!(&view.render, Some(forma_core::ViewRenderOutput::Table { items, .. }) if items.iter().any(|item| item.path == created.created.path))
    {
        return Err(format!(
            "created entry is not consistently classified and retrievable: {:?} {:?} {:?} {:?}",
            created.diagnostics, inspected.diagnostics, listed.diagnostics, view.diagnostics
        )
        .into());
    }
    Ok(listed.entries.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_entry_conflict_after_representative_validation_is_not_reported_as_success() {
        let root = std::env::temp_dir().join(format!(
            "forma-guide-entry-review-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        struct Fixture(PathBuf);
        impl Drop for Fixture {
            fn drop(&mut self) {
                let _ = fs::remove_dir_all(&self.0);
            }
        }
        let _fixture = Fixture(root.clone());
        forma_core::init_workspace(&root, "Review", "en", "UTC").unwrap();
        fs::create_dir(root.join(".forma")).unwrap();
        fs::write(
            root.join(".forma/other.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: other\nmode: primary\n---\n",
        )
        .unwrap();
        for id in ["one", "two"] {
            fs::write(root.join(format!(".forma/{id}.md")), format!("---\nschemaVersion: 1\nkind: term\nid: {id}\ntaxonomy: other\ninclude: ['records/first-entry.md']\n---\n")).unwrap();
        }
        let choice = SliceChoice {
            outcome: "Retrieve records".into(),
            taxonomy_id: "collections".into(),
            group_id: "records".into(),
            title: "Records".into(),
            fields: BTreeMap::new(),
            view_columns: vec![],
            layout: SliceLayout {
                taxonomy_file: ".forma/collections.md".into(),
                group_file: ".forma/spaces/records.md".into(),
                template_file: "templates/record.md".into(),
                view_file: ".forma/views/records.md".into(),
                content_directory: "records".into(),
            },
        };
        let plan = prepare_plan(&root, &choice).unwrap();
        assert_eq!(
            apply_plan(&root, &plan, &plan.id).unwrap().status,
            ApplyStatus::Applied
        );
        let created = forma_core::create_entry(
            &root,
            "records",
            [(
                "title".into(),
                serde_yml::Value::String("First entry".into()),
            )]
            .into(),
        )
        .unwrap();
        assert_eq!(created.status, forma_core::OperationStatus::Passed);
        let error = verify_created_entry(&root, &choice, &created).unwrap_err();
        assert!(error.to_string().contains("taxonomy.membership.ambiguous"));
        assert!(root.join(&created.created.path).exists());
    }
}
