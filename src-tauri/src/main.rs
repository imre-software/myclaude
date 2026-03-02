// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Child;
#[cfg(not(debug_assertions))]
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

const SERVER_URL: &str = "http://localhost:3019";

struct NitroServer(Mutex<Option<Child>>);

#[cfg(not(debug_assertions))]
fn wait_for_server() {
    use std::net::TcpStream;
    use std::time::{Duration, Instant};

    let timeout = Duration::from_secs(30);
    let start = Instant::now();

    while start.elapsed() < timeout {
        if TcpStream::connect("127.0.0.1:3019").is_ok() {
            return;
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    panic!("Nitro server failed to start within 30 seconds");
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // In production, spawn the Nitro server and wait for it
            #[cfg(not(debug_assertions))]
            {
                // Tauri bundles resources into Contents/Resources/ on macOS
                let resource_dir = app.path().resource_dir()
                    .expect("failed to get resource dir");
                let server_dir = resource_dir.join("server");
                let server_entry = server_dir.join("index.mjs");

                let child = Command::new("node")
                    .arg(&server_entry)
                    .current_dir(&server_dir)
                    .env("NITRO_PORT", "3019")
                    .env("NITRO_HOST", "127.0.0.1")
                    .spawn()
                    .expect("failed to start Nitro server");

                app.manage(NitroServer(Mutex::new(Some(child))));
                wait_for_server();
            }

            #[cfg(debug_assertions)]
            {
                let _ = app;
            }

            // Create the main window pointing at the Nitro server
            let url = WebviewUrl::External(SERVER_URL.parse().unwrap());
            WebviewWindowBuilder::new(app, "main", url)
                .title("Claude Command")
                .inner_size(1280.0, 800.0)
                .min_inner_size(900.0, 600.0)
                .build()
                .expect("failed to create window");

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<NitroServer>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
