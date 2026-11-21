// Crayon Box's Windows shell (ADR 0002): one window around the web app. Storage and finished pictures are files,
// written from the web side through the fs plugin (phase B); what it may touch is set in capabilities/default.json.
// Updates come through the updater plugin (phase E, ADR 0009), asked for from the parent area. The kiosk lock
// (phase D, ADR 0014) is `kiosk.rs`: the keyboard hook, the ignored close request, and quitting.

// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Off Windows there is no keyboard hook, so the key rules in `kiosk.rs` have no caller there (their tests still run).
// Without this, a Linux build prints unused-code warnings for them, and Ubuntu's rustc 1.93.1 crashed doing so
// (ADR 0046, found 2026-11-21).
#[cfg_attr(not(windows), allow(dead_code))]
mod kiosk;

use tauri::WindowEvent;
use tauri_plugin_autostart::MacosLauncher;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // "Start when Windows starts" in the parent area: a per-user Run entry, no admin rights needed.
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            kiosk::init(app.handle());
            Ok(())
        })
        .on_window_event(|_window, event| {
            // Alt+F4, the taskbar's "Close window": ignored while a parent keeps the app full screen (ADR 0014).
            if let WindowEvent::CloseRequested { api, .. } = event {
                if !kiosk::close_allowed() {
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![kiosk::set_keyboard_mode, kiosk::set_close_allowed, kiosk::quit_app])
        .run(tauri::generate_context!())
        .expect("Crayon Box failed to start");
}
