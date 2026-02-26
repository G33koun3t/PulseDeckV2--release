use serde_json::Value;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub async fn clipboard_read(app: tauri::AppHandle) -> Result<Value, String> {
    let clipboard = app.clipboard();

    let text = clipboard.read_text().unwrap_or_default();

    // Try reading image
    let image_data = match clipboard.read_image() {
        Ok(img) => {
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(img.rgba());
            Some(format!("data:image/png;base64,{}", b64))
        }
        Err(_) => None,
    };

    Ok(serde_json::json!({
        "success": true,
        "text": text,
        "hasImage": image_data.is_some(),
        "imageDataUrl": image_data,
    }))
}

#[tauri::command]
pub async fn clipboard_write(app: tauri::AppHandle, text: String) -> Result<Value, String> {
    app.clipboard()
        .write_text(&text)
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
