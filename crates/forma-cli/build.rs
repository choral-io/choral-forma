use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let source_dir = manifest_dir.join("../../packages/webapp/dist");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("webapp-dist");

    println!("cargo:rerun-if-changed={}", source_dir.display());

    if out_dir.exists() {
        fs::remove_dir_all(&out_dir).expect("remove generated webapp dist");
    }
    fs::create_dir_all(&out_dir).expect("create generated webapp dist");

    if source_dir.join("index.html").exists() {
        copy_dir(&source_dir, &out_dir).expect("copy built webapp dist");
    } else {
        fs::write(
            out_dir.join("index.html"),
            r#"<!doctype html><html><head><meta charset="UTF-8"><title>Choral Forma</title></head><body><main><h1>Choral Forma</h1><p>WebApp assets have not been built. Run the WebApp build before packaging forma serve.</p></main></body></html>"#,
        )
        .expect("write fallback webapp index");
    }
}

fn copy_dir(source: &Path, target: &Path) -> io::Result<()> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());

        if entry.file_type()?.is_dir() {
            fs::create_dir_all(&target_path)?;
            copy_dir(&source_path, &target_path)?;
        } else {
            fs::copy(&source_path, &target_path)?;
        }
    }
    Ok(())
}
