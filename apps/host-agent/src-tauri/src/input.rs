use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct MouseEvent {
    pub action: String, // "move", "down", "up", "scroll"
    pub x: f64,
    pub y: f64,
    pub button: Option<String>, // "left", "right", "middle"
    #[serde(rename = "deltaX")]
    pub delta_x: Option<f64>,
    #[serde(rename = "deltaY")]
    pub delta_y: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct KeyboardEvent {
    pub action: String, // "down", "up"
    pub key: String,
    pub code: String, // "KeyA", "ArrowLeft", etc.
}

#[cfg(target_os = "windows")]
pub fn inject_mouse_event(event: MouseEvent) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_MOUSE, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_LEFTDOWN,
        MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_MOVE,
        MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, MOUSEINPUT,
    };

    let mut flags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE;

    // Scale coordinates (0 to 65535 for absolute SendInput coordinates)
    let scaled_x = (event.x * 65535.0) as i32;
    let scaled_y = (event.y * 65535.0) as i32;

    let mut mouse_data = 0;

    match event.action.as_str() {
        "down" => {
            if let Some(btn) = event.button {
                match btn.as_str() {
                    "left" => flags = MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_ABSOLUTE,
                    "right" => flags = MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_ABSOLUTE,
                    "middle" => flags = MOUSEEVENTF_MIDDLEDOWN | MOUSEEVENTF_ABSOLUTE,
                    _ => {}
                }
            }
        }
        "up" => {
            if let Some(btn) = event.button {
                match btn.as_str() {
                    "left" => flags = MOUSEEVENTF_LEFTUP | MOUSEEVENTF_ABSOLUTE,
                    "right" => flags = MOUSEEVENTF_RIGHTUP | MOUSEEVENTF_ABSOLUTE,
                    "middle" => flags = MOUSEEVENTF_MIDDLEUP | MOUSEEVENTF_ABSOLUTE,
                    _ => {}
                }
            }
        }
        "scroll" => {
            flags = MOUSEEVENTF_WHEEL;
            if let Some(dy) = event.delta_y {
                mouse_data = (dy * 120.0) as i32; // Standard wheel delta is 120
            }
        }
        _ => {}
    }

    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            mi: MOUSEINPUT {
                dx: scaled_x,
                dy: scaled_y,
                mouseData: mouse_data,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    unsafe {
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }
}

#[cfg(target_os = "windows")]
pub fn inject_keyboard_event(event: KeyboardEvent) {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE,
    };

    // Simple mapping of standard WebRTC JS code to Windows virtual scan keys
    // For MVP/production-grade, we map standard layouts.
    let scan_code = match event.code.as_str() {
        "KeyW" => 0x11,
        "KeyA" => 0x1E,
        "KeyS" => 0x1F,
        "KeyD" => 0x20,
        "ArrowUp" => 0x48,
        "ArrowDown" => 0x50,
        "ArrowLeft" => 0x4B,
        "ArrowRight" => 0x4D,
        "Space" => 0x39,
        "Enter" => 0x1C,
        "Escape" => 0x01,
        "Backspace" => 0x0E,
        _ => 0,
    };

    if scan_code == 0 {
        return;
    }

    let mut flags = KEYEVENTF_SCANCODE;
    if event.action == "up" {
        flags |= KEYEVENTF_KEYUP;
    }

    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
            ki: KEYBDINPUT {
                wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(0),
                wScan: scan_code,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    unsafe {
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }
}

#[cfg(target_os = "macos")]
pub fn inject_mouse_event(event: MouseEvent) {
    use core_graphics::event::{CGEvent, CGEventTapLocation, CGMouseButton, CGEventType};
    use core_graphics::geometry::CGPoint;

    // Convert normalized coordinates to target screen width
    // For macOS, we scale coordinates based on screen bounds
    let screen_w = 1920.0;
    let screen_h = 1080.0;
    let point = CGPoint::new(event.x * screen_w, event.y * screen_h);

    let event_type = match event.action.as_str() {
        "down" => {
            if let Some(btn) = &event.button {
                match btn.as_str() {
                    "right" => CGEventType::RightMouseDown,
                    "middle" => CGEventType::OtherMouseDown,
                    _ => CGEventType::LeftMouseDown,
                }
            } else {
                CGEventType::LeftMouseDown
            }
        }
        "up" => {
            if let Some(btn) = &event.button {
                match btn.as_str() {
                    "right" => CGEventType::RightMouseUp,
                    "middle" => CGEventType::OtherMouseUp,
                    _ => CGEventType::LeftMouseUp,
                }
            } else {
                CGEventType::LeftMouseUp
            }
        }
        _ => CGEventType::MouseMoved,
    };

    let button = if let Some(btn) = &event.button {
        match btn.as_str() {
            "right" => CGMouseButton::Right,
            "middle" => CGMouseButton::Center,
            _ => CGMouseButton::Left,
        }
    } else {
        CGMouseButton::Left
    };

    if let Ok(cg_event) = CGEvent::new_mouse_event(
        None,
        event_type,
        point,
        button,
    ) {
        cg_event.post(CGEventTapLocation::HID);
    }
}

#[cfg(target_os = "macos")]
pub fn inject_keyboard_event(event: KeyboardEvent) {
    use core_graphics::event::{CGEvent, CGEventTapLocation};

    // Translate JS key codes to macOS Virtual Keycodes
    let key_code = match event.code.as_str() {
        "KeyA" => 0,
        "KeyS" => 1,
        "KeyD" => 2,
        "KeyF" => 3,
        "KeyH" => 4,
        "KeyG" => 5,
        "KeyZ" => 6,
        "KeyX" => 7,
        "KeyC" => 8,
        "KeyV" => 9,
        "KeyB" => 11,
        "KeyQ" => 12,
        "KeyW" => 13,
        "KeyE" => 14,
        "KeyR" => 15,
        "KeyY" => 16,
        "KeyT" => 17,
        "Space" => 49,
        "Enter" => 36,
        "Escape" => 53,
        _ => 999,
    };

    if key_code == 999 {
        return;
    }

    let is_down = event.action == "down";
    if let Ok(cg_event) = CGEvent::new_keyboard_event(None, key_code, is_down) {
        cg_event.post(CGEventTapLocation::HID);
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn inject_mouse_event(_event: MouseEvent) {}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub fn inject_keyboard_event(_event: KeyboardEvent) {}
