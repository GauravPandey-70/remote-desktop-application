// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod device_id;
mod input;

use input::{KeyboardEvent, MouseEvent};

#[tauri::command]
fn get_device_id() -> String {
    device_id::get_or_create_device_id()
}

#[tauri::command]
fn inject_mouse(event: MouseEvent) {
    input::inject_mouse_event(event);
}

#[tauri::command]
fn inject_keyboard(event: KeyboardEvent) {
    input::inject_keyboard_event(event);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_device_id,
            inject_mouse,
            inject_keyboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
