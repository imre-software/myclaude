use std::fs;
use std::path::Path;

fn main() {
    // Ensure the server directory exists for Tauri resource bundling.
    // In dev mode, this is a placeholder. In production, beforeBuildCommand populates it.
    let server_dir = Path::new("server");
    if !server_dir.exists() {
        fs::create_dir_all(server_dir).expect("failed to create server placeholder dir");
        fs::write(server_dir.join(".gitkeep"), "").expect("failed to write placeholder");
    }

    tauri_build::build()
}
