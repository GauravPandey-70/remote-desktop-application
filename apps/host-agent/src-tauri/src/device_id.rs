use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
struct Config {
    device_id: String,
}

pub fn get_or_create_device_id() -> String {
    let config_dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_config_dir = config_dir.join("DeskLink");
    let config_path = app_config_dir.join("config.json");

    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<Config>(&content) {
                return config.device_id;
            }
        }
    }

    // Generate new Device ID: e.g. "DL-A7K-2MN"
    let uuid_str = Uuid::new_v4().to_string();
    let cleaned: String = uuid_str
        .chars()
        .filter(|c| c.is_alphanumeric())
        .collect::<String>()
        .to_uppercase();
    
    let part1 = &cleaned[0..3];
    let part2 = &cleaned[3..6];
    let new_device_id = format!("DL-{}-{}", part1, part2);

    let config = Config {
        device_id: new_device_id.clone(),
    };

    let _ = fs::create_dir_all(&app_config_dir);
    if let Ok(serialized) = serde_json::to_string(&config) {
        let _ = fs::write(config_path, serialized);
    }

    new_device_id
}

mod dirs {
    use std::path::PathBuf;
    
    pub fn config_dir() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            std::env::var("APPDATA").ok().map(PathBuf::from)
        }
        #[cfg(target_os = "macos")]
        {
            dirs_sys::home_dir().map(|h| h.join("Library/Application Support"))
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            None
        }
    }
}

#[cfg(target_os = "macos")]
mod dirs_sys {
    use std::path::PathBuf;
    pub fn home_dir() -> Option<PathBuf> {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}
