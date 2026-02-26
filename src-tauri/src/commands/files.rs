use serde_json::Value;
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn select_image(app: tauri::AppHandle) -> Result<Value, String> {
    let file = app.dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp", "gif", "bmp", "ico", "svg"])
        .blocking_pick_file();

    match file {
        Some(path) => {
            let file_path = path.as_path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            let bytes = fs::read(&file_path).map_err(|e| e.to_string())?;
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            let ext = Path::new(&file_path)
                .extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_else(|| "png".into());
            let mime = match ext.as_str() {
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                "bmp" => "image/bmp",
                "ico" => "image/x-icon",
                "svg" => "image/svg+xml",
                _ => "image/png",
            };
            Ok(serde_json::json!({
                "cancelled": false,
                "dataUrl": format!("data:{};base64,{}", mime, b64),
                "path": file_path,
            }))
        }
        None => Ok(serde_json::json!({ "cancelled": true })),
    }
}

#[tauri::command]
pub async fn select_screenshot_folder(app: tauri::AppHandle) -> Result<Value, String> {
    let folder = app.dialog()
        .file()
        .blocking_pick_folder();

    match folder {
        Some(path) => {
            let folder_str = path.as_path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            Ok(serde_json::json!(folder_str))
        }
        None => Ok(Value::Null),
    }
}

#[tauri::command]
pub async fn take_screenshot(folder_path: String, _source_id: Option<String>) -> Result<Value, String> {
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors.first().ok_or("No monitor found")?;
    let img = monitor.capture_image().map_err(|e| e.to_string())?;

    let filename = format!("screenshot-{}.png", chrono::Utc::now().timestamp_millis());
    let filepath = Path::new(&folder_path).join(&filename);
    img.save(&filepath).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "filename": filename,
        "filepath": filepath.to_string_lossy(),
    }))
}

#[tauri::command]
pub async fn list_screenshots(folder_path: String) -> Result<Value, String> {
    let path = Path::new(&folder_path);
    if !path.exists() {
        return Ok(serde_json::json!([]));
    }

    let extensions = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
    let mut files: Vec<Value> = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if let Some(ext) = entry_path.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if extensions.contains(&ext_lower.as_str()) {
                    let name = entry_path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let metadata = entry.metadata().ok();
                    let modified = metadata.as_ref()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

                    files.push(serde_json::json!({
                        "name": name,
                        "path": entry_path.to_string_lossy(),
                        "size": size,
                        "modified": modified,
                        "timestamp": modified,
                    }));
                }
            }
        }
    }

    files.sort_by(|a, b| {
        let ta = a["timestamp"].as_u64().unwrap_or(0);
        let tb = b["timestamp"].as_u64().unwrap_or(0);
        tb.cmp(&ta)
    });

    Ok(Value::Array(files))
}

#[tauri::command]
pub async fn get_screenshot_thumbnail(file_path: String) -> Result<Value, String> {
    // Run in blocking thread to avoid blocking async runtime
    let result = tokio::task::spawn_blocking(move || {
        let img = image::open(&file_path).map_err(|e| e.to_string())?;
        let thumbnail = img.thumbnail(320, 320);

        let mut buf = std::io::Cursor::new(Vec::new());
        thumbnail.write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| e.to_string())?;

        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());
        Ok::<String, String>(format!("data:image/png;base64,{}", b64))
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(Value::String(result))
}

#[tauri::command]
pub async fn delete_screenshot(file_path: String) -> Result<Value, String> {
    fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn open_screenshot_folder(folder_path: String) -> Result<Value, String> {
    std::process::Command::new("explorer")
        .arg(&folder_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<Value, String> {
    // Use /e, flag to force Explorer to open the exact path
    // (without it, some paths like drive roots may open the default view)
    std::process::Command::new("explorer")
        .arg(format!("/e,{}", path.trim_end_matches('\\')))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}
