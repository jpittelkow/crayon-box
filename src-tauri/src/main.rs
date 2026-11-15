// Crayon Box's Windows shell (ADR 0002): one window around the web app. The kiosk lock (phase D), updates
// (phase E) and file storage (phase B) come later.

// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Crayon Box failed to start");
}
