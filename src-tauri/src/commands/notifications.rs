use serde_json::Value;

#[tauri::command]
pub async fn show_notification(app: tauri::AppHandle, title: String, body: String) -> Result<Value, String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
