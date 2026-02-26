use serde_json::Value;
use tauri::Manager;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const VALID_LANGS: &[&str] = &["fr", "en", "de", "nl", "es", "pt", "it", "pl", "ja"];

#[tauri::command]
pub async fn open_guide(app: tauri::AppHandle, lang: String) -> Result<Value, String> {
    let lang = if VALID_LANGS.contains(&lang.as_str()) {
        lang
    } else {
        "fr".to_string()
    };

    let pdf_path = app.path().resource_dir()
        .map_err(|e| e.to_string())?
        .join("resources")
        .join("guides")
        .join(format!("guide_{}.pdf", lang));

    if !pdf_path.exists() {
        return Err(format!("Guide PDF not found for language: {}", lang));
    }

    // Open PDF with system default viewer
    let mut cmd = std::process::Command::new("cmd");
    cmd.args(["/C", "start", "", &pdf_path.to_string_lossy()]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd.spawn().map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}
