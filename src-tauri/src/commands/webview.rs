use tauri::Manager;

/// Create a native webview window overlaying the main window's content area.
/// This bypasses X-Frame-Options / CSP frame-ancestors restrictions that block iframes.
///
/// Parameters:
/// - label: unique identifier for this webview (e.g. "cwv-soundcloud")
/// - url: the external URL to load
/// - offset_x, offset_y: position relative to the main window content area (CSS logical pixels)
/// - width, height: size in CSS logical pixels
#[tauri::command]
pub async fn create_custom_webview(
    app: tauri::AppHandle,
    label: String,
    url: String,
    offset_x: f64,
    offset_y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // Destroy existing webview window with same label
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.close();
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
    }

    let main_window = app.get_webview_window("main")
        .ok_or("Main window not found")?;

    // Get main window inner position (physical pixels) and scale factor
    let win_pos = main_window.inner_position().map_err(|e| e.to_string())?;
    let scale = main_window.scale_factor().map_err(|e| e.to_string())?;

    // Convert physical → logical, then add CSS offset
    let screen_x = (win_pos.x as f64 / scale) + offset_x;
    let screen_y = (win_pos.y as f64 / scale) + offset_y;

    let parsed_url = url::Url::parse(&url).map_err(|e| e.to_string())?;

    let _webview_window = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        tauri::WebviewUrl::External(parsed_url),
    )
    .title("PulseDeck")
    .decorations(false)
    .position(screen_x, screen_y)
    .inner_size(width, height)
    .resizable(false)
    .visible(true)
    .focused(false)
    .build()
    .map_err(|e| e.to_string())?;

    // On Windows: set as owned window of main (stays on top, minimizes together, no taskbar entry)
    #[cfg(windows)]
    set_owner_window(&app, &label);

    Ok(())
}

/// Set the custom webview as an owned window of the main window via Win32 API.
/// Owner relationship: child stays above parent, minimizes with parent, no taskbar entry.
#[cfg(windows)]
fn set_owner_window(app: &tauri::AppHandle, child_label: &str) {
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowLongPtrW, WINDOW_LONG_PTR_INDEX};
    use windows::Win32::Foundation::HWND;

    let child_wv = match app.get_webview_window(child_label) {
        Some(w) => w,
        None => return,
    };
    let main_wv = match app.get_webview_window("main") {
        Some(w) => w,
        None => return,
    };

    // Tauri v2: hwnd() returns the raw window handle on Windows
    let child_hwnd = match child_wv.hwnd() {
        Ok(h) => h,
        Err(_) => return,
    };
    let parent_hwnd = match main_wv.hwnd() {
        Ok(h) => h,
        Err(_) => return,
    };

    unsafe {
        // GWLP_HWNDPARENT (-8) sets the owner window
        // Tauri's Hwnd.0 is the raw HWND value (isize-sized)
        let child_h = HWND(child_hwnd.0 as *mut std::ffi::c_void);
        let parent_val = parent_hwnd.0 as isize;
        SetWindowLongPtrW(child_h, WINDOW_LONG_PTR_INDEX(-8), parent_val);
    }
}

/// Destroy a custom webview window by label.
#[tauri::command]
pub async fn destroy_custom_webview(
    app: tauri::AppHandle,
    label: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview_window(&label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Show or hide a custom webview window. When showing, repositions to current content area.
#[tauri::command]
pub async fn set_custom_webview_visibility(
    app: tauri::AppHandle,
    label: String,
    visible: bool,
    offset_x: f64,
    offset_y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview_window(&label) {
        if visible {
            let main_window = app.get_webview_window("main")
                .ok_or("Main window not found")?;
            let win_pos = main_window.inner_position().map_err(|e| e.to_string())?;
            let scale = main_window.scale_factor().map_err(|e| e.to_string())?;

            let screen_x = (win_pos.x as f64 / scale) + offset_x;
            let screen_y = (win_pos.y as f64 / scale) + offset_y;

            webview.set_position(tauri::Position::Logical(
                tauri::LogicalPosition::new(screen_x, screen_y),
            )).map_err(|e| e.to_string())?;

            webview.set_size(tauri::Size::Logical(
                tauri::LogicalSize::new(width, height),
            )).map_err(|e| e.to_string())?;

            webview.show().map_err(|e| e.to_string())?;
        } else {
            webview.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
