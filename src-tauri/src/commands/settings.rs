use serde_json::Value;
use std::fs;
use tauri::Manager;

fn get_data_dir(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap()
}

#[tauri::command]
pub async fn save_app_settings_backup(app: tauri::AppHandle, data: Value) -> Result<Value, String> {
    let path = get_data_dir(&app).join("app-settings-backup.json");
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn load_app_settings_backup(app: tauri::AppHandle) -> Result<Value, String> {
    let path = get_data_dir(&app).join("app-settings-backup.json");
    if !path.exists() {
        return Ok(Value::Null);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn save_local_storage_backup(app: tauri::AppHandle, data: Value) -> Result<Value, String> {
    let path = get_data_dir(&app).join("local-storage-backup.json");
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn load_local_storage_backup(app: tauri::AppHandle) -> Result<Value, String> {
    let path = get_data_dir(&app).join("local-storage-backup.json");
    if !path.exists() {
        return Ok(Value::Null);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_app_version(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}
