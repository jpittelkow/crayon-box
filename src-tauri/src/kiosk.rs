//! The kiosk lock (ADR 0014, milestone 2 phase D): the keyboard hook, the ignored close request, and quitting.
//!
//! The web side says which keyboard mode applies (`set_keyboard_mode`): `off` in the parent area or when a parent
//! turned the keyboard lock off, `kid` on the kids' screens, `driving` while the driving game is open. The hook is
//! only installed the first time a mode other than `off` is asked for, so a parent who turns the lock off never
//! has a keyboard hook running (antivirus, ADR 0014).
//!
//! Ctrl+Shift+Q asks the page to quit (it saves the picture first) and quits anyway a few seconds later.

use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

/// What the keyboard may do.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    /// Every key works (parent area, or the lock is off).
    Off = 0,
    /// Every key is swallowed except Ctrl+Shift+Q.
    Kid = 1,
    /// As `Kid`, but the driving keys (arrows, WASD, space) reach the game (ADR 0021).
    Driving = 2,
}

impl Mode {
    fn from_u8(v: u8) -> Mode {
        match v {
            1 => Mode::Kid,
            2 => Mode::Driving,
            _ => Mode::Off,
        }
    }
}

/// What to do with one key event.
#[derive(Debug, PartialEq, Eq)]
pub enum Action {
    Pass,
    Block,
    Quit,
}

/// One key event, as the hook sees it.
pub struct Key {
    pub vk: u16,
    pub down: bool,
    pub alt: bool,
    pub ctrl: bool,
    pub shift: bool,
}

/// Shift, Ctrl and Alt, left and right (VK_SHIFT, VK_CONTROL, VK_MENU, VK_LSHIFT..VK_RMENU).
fn is_modifier(vk: u16) -> bool {
    // On their own they do nothing harmful, and letting them through keeps Windows' idea of which are held right,
    // which Ctrl+Shift+Q needs. The Windows keys are not in here: they are blocked.
    matches!(vk, 0x10..=0x12 | 0xA0..=0xA5)
}

/// The driving game's keys (ADR 0021): the arrows, W A S D, and space for the horn.
fn is_driving_key(vk: u16) -> bool {
    const W: u16 = b'W' as u16;
    const A: u16 = b'A' as u16;
    const S: u16 = b'S' as u16;
    const D: u16 = b'D' as u16;
    matches!(vk, 0x25..=0x28 | 0x20 | W | A | S | D)
}

/// The whole rule, kept apart from Windows so it has tests.
pub fn decide(mode: Mode, key: &Key) -> Action {
    if mode == Mode::Off {
        return Action::Pass;
    }
    if key.vk == u16::from(b'Q') && key.ctrl && key.shift && !key.alt {
        return if key.down { Action::Quit } else { Action::Block };
    }
    if is_modifier(key.vk) {
        return Action::Pass;
    }
    if mode == Mode::Driving && is_driving_key(key.vk) && !key.alt && !key.ctrl {
        return Action::Pass;
    }
    Action::Block
}

static MODE: AtomicU8 = AtomicU8::new(Mode::Off as u8);
/// False while a parent keeps the app full screen: the close request is then ignored.
static CLOSE_ALLOWED: AtomicBool = AtomicBool::new(true);
static QUITTING: AtomicBool = AtomicBool::new(false);
static HOOK_STARTED: AtomicBool = AtomicBool::new(false);
static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

/// Whether a close request (Alt+F4, the taskbar's "Close window") may close the window.
pub fn close_allowed() -> bool {
    QUITTING.load(Ordering::SeqCst) || CLOSE_ALLOWED.load(Ordering::SeqCst)
}

fn request_quit() {
    let Some(app) = APP.get() else { return };
    if QUITTING.load(Ordering::SeqCst) {
        return;
    }
    // The page saves the open picture, then calls `quit_app`. If it doesn't answer, quit anyway.
    let _ = app.emit("kiosk://quit-requested", ());
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(4));
        QUITTING.store(true, Ordering::SeqCst);
        app.exit(0);
    });
}

#[tauri::command]
pub fn set_keyboard_mode(mode: String) -> Result<(), String> {
    let m = match mode.as_str() {
        "off" => Mode::Off,
        "kid" => Mode::Kid,
        "driving" => Mode::Driving,
        other => return Err(format!("unknown keyboard mode {other}")),
    };
    MODE.store(m as u8, Ordering::SeqCst);
    if m != Mode::Off && !HOOK_STARTED.swap(true, Ordering::SeqCst) {
        start_hook();
    }
    Ok(())
}

#[tauri::command]
pub fn set_close_allowed(allowed: bool) {
    CLOSE_ALLOWED.store(allowed, Ordering::SeqCst);
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    QUITTING.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg(windows)]
fn start_hook() {
    std::thread::spawn(|| unsafe { win::run_hook() });
}

#[cfg(not(windows))]
fn start_hook() {}

#[cfg(windows)]
mod win {
    use super::{decide, request_quit, Action, Key, Mode, MODE};
    use std::sync::atomic::Ordering;
    use windows_sys::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::System::Threading::GetCurrentProcessId;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_CONTROL, VK_SHIFT};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, GetForegroundWindow, GetMessageW, GetWindowThreadProcessId, SetWindowsHookExW, HC_ACTION,
        KBDLLHOOKSTRUCT, LLKHF_ALTDOWN, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
    };

    /// Only while one of this app's windows is in front: other apps (a parent's, after Ctrl+Alt+Del) are never
    /// touched.
    unsafe fn app_in_front() -> bool {
        let window = GetForegroundWindow();
        if window.is_null() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(window, &mut pid);
        pid == GetCurrentProcessId()
    }

    unsafe fn held(vk: u16) -> bool {
        GetAsyncKeyState(i32::from(vk)) < 0
    }

    unsafe extern "system" fn hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 && app_in_front() {
            let info = &*(lparam as *const KBDLLHOOKSTRUCT);
            let message = wparam as u32;
            let key = Key {
                vk: info.vkCode as u16,
                down: message == WM_KEYDOWN || message == WM_SYSKEYDOWN,
                alt: info.flags & LLKHF_ALTDOWN != 0,
                ctrl: held(VK_CONTROL),
                shift: held(VK_SHIFT),
            };
            match decide(Mode::from_u8(MODE.load(Ordering::SeqCst)), &key) {
                Action::Pass => {}
                Action::Block => return 1,
                Action::Quit => {
                    request_quit();
                    return 1;
                }
            }
        }
        CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
    }

    /// Installs the hook on this thread and runs the message loop a low-level hook needs. Never returns.
    pub unsafe fn run_hook() {
        let module = GetModuleHandleW(std::ptr::null());
        let handle = SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook), module, 0);
        if handle.is_null() {
            eprintln!("Crayon Box: the keyboard lock could not start");
            return;
        }
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(vk: u16) -> Key {
        Key { vk, down: true, alt: false, ctrl: false, shift: false }
    }

    #[test]
    fn off_lets_everything_through() {
        assert_eq!(decide(Mode::Off, &key(0x5B)), Action::Pass);
        assert_eq!(decide(Mode::Off, &Key { alt: true, ..key(0x09) }), Action::Pass);
    }

    #[test]
    fn kid_mode_blocks_the_escape_hatches_and_ordinary_keys() {
        for vk in [0x5B, 0x5C, 0x7A, 0x1B, u16::from(b'A'), 0x25, 0x20, 0x0D] {
            assert_eq!(decide(Mode::Kid, &key(vk)), Action::Block, "vk {vk:#x}");
        }
        // Alt+Tab, Alt+F4, Alt+Esc, Ctrl+Esc
        assert_eq!(decide(Mode::Kid, &Key { alt: true, ..key(0x09) }), Action::Block);
        assert_eq!(decide(Mode::Kid, &Key { alt: true, ..key(0x73) }), Action::Block);
        assert_eq!(decide(Mode::Kid, &Key { alt: true, ..key(0x1B) }), Action::Block);
        assert_eq!(decide(Mode::Kid, &Key { ctrl: true, ..key(0x1B) }), Action::Block);
    }

    #[test]
    fn modifiers_alone_pass_so_ctrl_shift_q_can_be_seen() {
        for vk in [0x10, 0x11, 0x12, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5] {
            assert_eq!(decide(Mode::Kid, &key(vk)), Action::Pass, "vk {vk:#x}");
        }
    }

    #[test]
    fn ctrl_shift_q_quits_on_key_down_only() {
        let q = Key { ctrl: true, shift: true, ..key(u16::from(b'Q')) };
        assert_eq!(decide(Mode::Kid, &q), Action::Quit);
        assert_eq!(decide(Mode::Driving, &q), Action::Quit);
        assert_eq!(decide(Mode::Kid, &Key { down: false, ..q }), Action::Block);
        assert_eq!(decide(Mode::Kid, &Key { ctrl: true, ..key(u16::from(b'Q')) }), Action::Block);
    }

    #[test]
    fn driving_lets_the_driving_keys_through_and_nothing_else() {
        for vk in [0x25, 0x26, 0x27, 0x28, 0x20, u16::from(b'W'), u16::from(b'A'), u16::from(b'S'), u16::from(b'D')] {
            assert_eq!(decide(Mode::Driving, &key(vk)), Action::Pass, "vk {vk:#x}");
        }
        for vk in [0x5B, 0x09, u16::from(b'Q'), u16::from(b'E'), 0x7A] {
            assert_eq!(decide(Mode::Driving, &key(vk)), Action::Block, "vk {vk:#x}");
        }
        assert_eq!(decide(Mode::Driving, &Key { alt: true, ..key(0x25) }), Action::Block);
    }
}
