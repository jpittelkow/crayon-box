// Crayon Box's Windows shell (ADR 0002): one window around the web app. Storage and finished pictures are files,
// written from the web side through the fs plugin (phase B); what it may touch is set in capabilities/default.json.
// The kiosk lock (phase D) and updates (phase E) come later.

// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("Crayon Box failed to start");
}
