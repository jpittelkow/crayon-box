// Crayon Box's Windows shell (ADR 0002): one window around the web app. Storage and finished pictures are files,
// written from the web side through the fs plugin (phase B); what it may touch is set in capabilities/default.json.
// Updates come through the updater plugin (phase E, ADR 0009), asked for from the parent area. The kiosk lock
// (phase D) comes later.

// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("Crayon Box failed to start");
}
