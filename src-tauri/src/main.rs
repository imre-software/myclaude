// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notifications;

use std::process::Child;
#[cfg(not(debug_assertions))]
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

const SERVER_URL: &str = "http://localhost:3019";

struct NitroServer(Mutex<Option<Child>>);

/// In dev mode, the binary runs outside a .app bundle. UNUserNotificationCenter
/// requires a real .app bundle launched through LaunchServices. This function
/// creates a minimal .app wrapper, copies the binary into it, codesigns it, and
/// launches it via `open -W` (which goes through LaunchServices). The original
/// process blocks until the .app exits, keeping cargo tauri dev happy.
#[cfg(all(target_os = "macos", debug_assertions))]
fn reexec_inside_app_bundle() {
    // Already running from inside a .app bundle - nothing to do
    if let Ok(exe) = std::env::current_exe() {
        if exe.to_string_lossy().contains(".app/Contents/MacOS/") {
            return;
        }
    }

    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };

    let exe_dir = match exe.parent() {
        Some(d) => d,
        None => return,
    };

    let exe_name = match exe.file_name().and_then(|n| n.to_str()) {
        Some(n) => n.to_string(),
        None => return,
    };

    let app_dir = exe_dir.join("Claude Command.app");
    let macos_dir = app_dir.join("Contents").join("MacOS");

    // Kill any leftover instance from a previous dev session
    let _ = std::process::Command::new("pkill")
        .args(["-f", "Claude Command.app/Contents/MacOS"])
        .status();
    std::thread::sleep(std::time::Duration::from_millis(300));

    if std::fs::create_dir_all(&macos_dir).is_err() {
        return;
    }

    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.claudecommand.desktop</string>
    <key>CFBundleName</key>
    <string>Claude Command</string>
    <key>CFBundleExecutable</key>
    <string>{exe_name}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>"#
    );

    if std::fs::write(app_dir.join("Contents").join("Info.plist"), plist).is_err() {
        return;
    }

    // Copy binary into the .app bundle and ensure it's executable
    let bin_path = macos_dir.join(&exe_name);
    if std::fs::copy(&exe, &bin_path).is_err() {
        return;
    }
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&bin_path, std::fs::Permissions::from_mode(0o755));
    }

    // Remove quarantine attributes that would block launch
    let _ = std::process::Command::new("xattr")
        .args(["-cr", app_dir.to_str().unwrap_or("")])
        .output();

    // Ad-hoc codesign the .app so macOS treats it as a real app
    let sign_result = std::process::Command::new("codesign")
        .args(["--force", "--deep", "--sign", "-", app_dir.to_str().unwrap_or("")])
        .output();
    if let Ok(ref out) = sign_result {
        if !out.status.success() {
            eprintln!("[dev] codesign failed: {}", String::from_utf8_lossy(&out.stderr));
        }
    }

    // Register with Launch Services so macOS recognizes the bundle
    let _ = std::process::Command::new("/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister")
        .args(["-f", app_dir.to_str().unwrap_or("")])
        .output();

    // Launch via LaunchServices (open) so macOS grants notification permissions.
    // exec() alone is NOT sufficient - macOS requires apps to be launched through
    // LaunchServices for UNUserNotificationCenter to work.
    eprintln!("[dev] Launching app bundle via open -W ...");
    let status = std::process::Command::new("open")
        .args(["-W", app_dir.to_str().unwrap_or("")])
        .status();

    match status {
        Ok(s) => std::process::exit(s.code().unwrap_or(0)),
        Err(e) => eprintln!("[dev] Failed to launch app bundle: {e}, continuing without bundle"),
    }
}

#[cfg(not(debug_assertions))]
fn fix_path_env() {
    use std::process::Command;
    if let Ok(output) = Command::new("/bin/zsh")
        .args(["-ilc", "echo $PATH"])
        .output()
    {
        if let Ok(path) = String::from_utf8(output.stdout) {
            let trimmed = path.trim();
            if !trimmed.is_empty() {
                unsafe { std::env::set_var("PATH", trimmed); }
            }
        }
    }
}

fn wait_for_server() {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::{Duration, Instant};

    let timeout = Duration::from_secs(60);
    let start = Instant::now();

    while start.elapsed() < timeout {
        if let Ok(mut stream) = TcpStream::connect("127.0.0.1:3019") {
            stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
            if stream.write_all(b"GET / HTTP/1.0\r\nHost: localhost\r\n\r\n").is_ok() {
                let mut buf = vec![0u8; 512];
                if let Ok(n) = stream.read(&mut buf) {
                    if String::from_utf8_lossy(&buf[..n]).contains("200") {
                        return;
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }

    eprintln!("Warning: server on port 3019 not fully ready after 60s");
}

#[tauri::command]
fn request_notification_permission() -> Result<bool, String> {
    notifications::request_permission()
}

#[tauri::command]
fn check_notification_permission() -> Result<String, String> {
    notifications::check_permission()
}

#[tauri::command]
fn send_notification(title: String, body: String, sound: Option<String>) -> Result<(), String> {
    notifications::send(&title, &body, sound.as_deref())
}

fn main() {
    #[cfg(all(target_os = "macos", debug_assertions))]
    reexec_inside_app_bundle();

    notifications::setup_delegate();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            request_notification_permission,
            check_notification_permission,
            send_notification,
        ])
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                fix_path_env();

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
                wait_for_server();
            }

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
