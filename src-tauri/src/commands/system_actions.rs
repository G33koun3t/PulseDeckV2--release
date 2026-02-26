use serde_json::Value;
use tauri::Manager;

#[tauri::command]
pub async fn get_displays(app: tauri::AppHandle) -> Result<Value, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let window = app.get_webview_window("main");
    let win_pos = window.as_ref().and_then(|w| w.outer_position().ok());

    let displays: Vec<Value> = monitors.iter().enumerate().map(|(i, m)| {
        let pos = m.position();
        let size = m.size();
        let name = m.name().unwrap_or(&format!("Display {}", i + 1)).to_string();
        let label = format!("{}x{}", size.width, size.height);

        // isCurrent: window position is within this monitor's bounds
        let is_current = win_pos.as_ref().map_or(false, |wp| {
            wp.x >= pos.x && wp.x < pos.x + size.width as i32
                && wp.y >= pos.y && wp.y < pos.y + size.height as i32
        });

        serde_json::json!({
            "id": i,
            "name": name,
            "label": label,
            "bounds": { "x": pos.x, "y": pos.y },
            "width": size.width,
            "height": size.height,
            "isPrimary": i == 0,
            "isCurrent": is_current,
        })
    }).collect();

    Ok(Value::Array(displays))
}

#[tauri::command]
pub async fn set_target_display(app: tauri::AppHandle, display_id: usize) -> Result<Value, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let monitor = monitors.get(display_id).ok_or("Display not found")?;

    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let pos = monitor.position();
    let size = monitor.size();

    window.set_position(tauri::Position::Physical(*pos)).map_err(|e| e.to_string())?;
    window.set_size(tauri::Size::Physical(*size)).map_err(|e| e.to_string())?;

    // Save display preference by signature (stable across reboots)
    let signature = format!("{}x{}@{},{}", size.width, size.height, pos.x, pos.y);
    let data_dir = app.path().app_data_dir().unwrap();
    let _ = std::fs::create_dir_all(&data_dir);
    let _ = std::fs::write(
        data_dir.join("display-settings.json"),
        serde_json::to_string(&serde_json::json!({ "signature": signature, "displayId": display_id })).unwrap(),
    );

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_screens() -> Result<Value, String> {
    // TODO: Implement screen listing with thumbnails via xcap
    Ok(serde_json::json!({ "screens": [] }))
}

#[tauri::command]
pub async fn minimize_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.close().map_err(|e| e.to_string())
}
