use serde_json::Value;
use std::fs;
use tauri::Manager;

#[tauri::command]
pub async fn open_external(url: String) -> Result<Value, String> {
    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("steam://") {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    } else {
        std::process::Command::new(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn save_launcher_buttons(app: tauri::AppHandle, buttons: Value) -> Result<Value, String> {
    let path = app.path().app_data_dir().unwrap().join("launcher-buttons.json");
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, serde_json::to_string_pretty(&buttons).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn load_launcher_buttons(app: tauri::AppHandle) -> Result<Value, String> {
    let path = app.path().app_data_dir().unwrap().join("launcher-buttons.json");
    if !path.exists() {
        return Ok(serde_json::json!({ "success": false }));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true, "buttons": data }))
}

#[tauri::command]
pub async fn export_launcher_config(app: tauri::AppHandle, config: Value) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;

    let config_str = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    let app_clone = app.clone();

    // Run blocking dialog on a separate thread to avoid blocking the async runtime
    let result = tokio::task::spawn_blocking(move || {
        let dialog = app_clone.dialog();
        dialog
            .file()
            .set_file_name("lanceur-config.json")
            .add_filter("JSON", &["json"])
            .blocking_save_file()
    }).await.map_err(|e| e.to_string())?;

    match result {
        Some(path) => {
            let path_str = path.as_path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if path_str.is_empty() {
                return Ok(serde_json::json!({ "success": false }));
            }
            fs::write(&path_str, &config_str).map_err(|e| e.to_string())?;
            Ok(serde_json::json!({ "success": true, "path": path_str }))
        }
        None => Ok(serde_json::json!({ "success": false })),
    }
}

#[tauri::command]
pub async fn import_launcher_config(app: tauri::AppHandle) -> Result<Value, String> {
    use tauri_plugin_dialog::DialogExt;

    let app_clone = app.clone();

    // Run blocking dialog on a separate thread to avoid blocking the async runtime
    let result = tokio::task::spawn_blocking(move || {
        let dialog = app_clone.dialog();
        dialog
            .file()
            .add_filter("JSON", &["json"])
            .blocking_pick_file()
    }).await.map_err(|e| e.to_string())?;

    match result {
        Some(path) => {
            let path_str = path.as_path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            if path_str.is_empty() {
                return Ok(serde_json::json!({ "success": false }));
            }
            let content = fs::read_to_string(&path_str).map_err(|e| e.to_string())?;
            let config: Value = serde_json::from_str(&content)
                .map_err(|e| format!("Invalid JSON: {}", e))?;

            // Validate: config must be an array
            if !config.is_array() {
                return Ok(serde_json::json!({ "success": false, "error": "Config must be an array" }));
            }

            Ok(serde_json::json!({ "success": true, "config": config }))
        }
        None => Ok(serde_json::json!({ "success": false })),
    }
}

#[tauri::command]
pub async fn system_action(action_id: String) -> Result<Value, String> {
    match action_id.as_str() {
        "shutdown" => {
            std::process::Command::new("shutdown").args(["/s", "/t", "0"]).spawn().map_err(|e| e.to_string())?;
        }
        "restart" => {
            std::process::Command::new("shutdown").args(["/r", "/t", "0"]).spawn().map_err(|e| e.to_string())?;
        }
        "sleep" => {
            std::process::Command::new("rundll32.exe")
                .args(["powrprof.dll,SetSuspendState", "0,1,0"])
                .spawn().map_err(|e| e.to_string())?;
        }
        "lock" => {
            std::process::Command::new("rundll32.exe")
                .args(["user32.dll,LockWorkStation"])
                .spawn().map_err(|e| e.to_string())?;
        }
        "empty-recycle-bin" => {
            #[cfg(windows)]
            unsafe {
                let _ = windows::Win32::UI::Shell::SHEmptyRecycleBinW(
                    None, None,
                    windows::Win32::UI::Shell::SHERB_NOCONFIRMATION
                    | windows::Win32::UI::Shell::SHERB_NOPROGRESSUI
                    | windows::Win32::UI::Shell::SHERB_NOSOUND,
                );
            }
        }
        _ => return Err(format!("Unknown system action: {}", action_id)),
    }
    Ok(serde_json::json!({ "success": true }))
}
