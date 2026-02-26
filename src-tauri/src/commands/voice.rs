use serde_json::Value;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::path::PathBuf;
use std::sync::Arc;
use once_cell::sync::Lazy;
use tokio::sync::Mutex;

// Vosk FFI function types
type VoskSetLogLevel = unsafe extern "C" fn(log_level: i32);
type VoskModelNew = unsafe extern "C" fn(model_path: *const c_char) -> *mut std::ffi::c_void;
type VoskModelFree = unsafe extern "C" fn(model: *mut std::ffi::c_void);
type VoskRecognizerNew = unsafe extern "C" fn(model: *mut std::ffi::c_void, sample_rate: f32) -> *mut std::ffi::c_void;
type VoskRecognizerFree = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void);
type VoskRecognizerSetWords = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void, words: i32);
type VoskRecognizerAcceptWaveform = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void, data: *const u8, length: i32) -> i32;
type VoskRecognizerResult = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void) -> *const c_char;
type VoskRecognizerPartialResult = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void) -> *const c_char;
type VoskRecognizerFinalResult = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void) -> *const c_char;
type VoskRecognizerReset = unsafe extern "C" fn(recognizer: *mut std::ffi::c_void);

#[allow(dead_code)]
struct VoskLib {
    _lib: libloading::Library,
    set_log_level: VoskSetLogLevel,
    model_new: VoskModelNew,
    model_free: VoskModelFree,
    recognizer_new: VoskRecognizerNew,
    recognizer_free: VoskRecognizerFree,
    recognizer_set_words: VoskRecognizerSetWords,
    recognizer_accept_waveform: VoskRecognizerAcceptWaveform,
    recognizer_result: VoskRecognizerResult,
    recognizer_partial_result: VoskRecognizerPartialResult,
    recognizer_final_result: VoskRecognizerFinalResult,
    recognizer_reset: VoskRecognizerReset,
}

// Safety: Vosk library is thread-safe for different model/recognizer instances
unsafe impl Send for VoskLib {}
unsafe impl Sync for VoskLib {}

struct VoskState {
    lib: Option<VoskLib>,
    model: *mut std::ffi::c_void,
    recognizer: *mut std::ffi::c_void,
    running: bool,
    lang: String,
    engine: String,
}

// Safety: Vosk pointers are used behind a Mutex
unsafe impl Send for VoskState {}

impl Default for VoskState {
    fn default() -> Self {
        Self {
            lib: None,
            model: std::ptr::null_mut(),
            recognizer: std::ptr::null_mut(),
            running: false,
            lang: String::new(),
            engine: "none".into(),
        }
    }
}

impl Drop for VoskState {
    fn drop(&mut self) {
        self.cleanup();
    }
}

impl VoskState {
    fn cleanup(&mut self) {
        if let Some(ref lib) = self.lib {
            if !self.recognizer.is_null() {
                unsafe { (lib.recognizer_free)(self.recognizer); }
                self.recognizer = std::ptr::null_mut();
            }
            if !self.model.is_null() {
                unsafe { (lib.model_free)(self.model); }
                self.model = std::ptr::null_mut();
            }
        }
        self.running = false;
        self.engine = "none".into();
        self.lang.clear();
    }
}

static VOSK_STATE: Lazy<Arc<Mutex<VoskState>>> = Lazy::new(|| Arc::new(Mutex::new(VoskState::default())));

/// Model URLs from alphacephei.com (small models for real-time recognition)
fn get_model_url(lang: &str) -> Option<&'static str> {
    match lang {
        "fr" => Some("https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip"),
        "en" => Some("https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"),
        "de" => Some("https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip"),
        "es" => Some("https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip"),
        "pt" => Some("https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"),
        "it" => Some("https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip"),
        "nl" => Some("https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip"),
        "ja" => Some("https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip"),
        "pl" => Some("https://alphacephei.com/vosk/models/vosk-model-small-pl-0.22.zip"),
        _ => None,
    }
}

fn get_model_dir_name(lang: &str) -> &'static str {
    match lang {
        "fr" => "vosk-model-small-fr-0.22",
        "en" => "vosk-model-small-en-us-0.15",
        "de" => "vosk-model-small-de-0.15",
        "es" => "vosk-model-small-es-0.42",
        "pt" => "vosk-model-small-pt-0.3",
        "it" => "vosk-model-small-it-0.22",
        "nl" => "vosk-model-small-nl-0.22",
        "ja" => "vosk-model-small-ja-0.22",
        "pl" => "vosk-model-small-pl-0.22",
        _ => "vosk-model",
    }
}

fn find_vosk_dll() -> Option<PathBuf> {
    // Look in common locations
    let candidates = vec![
        // Next to the executable
        std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("libvosk.dll"))),
        // In resources
        std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.join("resources").join("libvosk.dll"))),
        // In PATH
        Some(PathBuf::from("libvosk.dll")),
    ];
    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    // Try loading from system PATH as last resort
    Some(PathBuf::from("libvosk.dll"))
}

fn load_vosk_library() -> Result<VoskLib, String> {
    let dll_path = find_vosk_dll().ok_or("libvosk.dll not found")?;
    unsafe {
        let lib = libloading::Library::new(&dll_path)
            .map_err(|e| format!("Failed to load libvosk.dll: {}", e))?;

        let set_log_level: VoskSetLogLevel = *lib.get(b"vosk_set_log_level\0").map_err(|e| e.to_string())?;
        let model_new: VoskModelNew = *lib.get(b"vosk_model_new\0").map_err(|e| e.to_string())?;
        let model_free: VoskModelFree = *lib.get(b"vosk_model_free\0").map_err(|e| e.to_string())?;
        let recognizer_new: VoskRecognizerNew = *lib.get(b"vosk_recognizer_new\0").map_err(|e| e.to_string())?;
        let recognizer_free: VoskRecognizerFree = *lib.get(b"vosk_recognizer_free\0").map_err(|e| e.to_string())?;
        let recognizer_set_words: VoskRecognizerSetWords = *lib.get(b"vosk_recognizer_set_words\0").map_err(|e| e.to_string())?;
        let recognizer_accept_waveform: VoskRecognizerAcceptWaveform = *lib.get(b"vosk_recognizer_accept_waveform\0").map_err(|e| e.to_string())?;
        let recognizer_result: VoskRecognizerResult = *lib.get(b"vosk_recognizer_result\0").map_err(|e| e.to_string())?;
        let recognizer_partial_result: VoskRecognizerPartialResult = *lib.get(b"vosk_recognizer_partial_result\0").map_err(|e| e.to_string())?;
        let recognizer_final_result: VoskRecognizerFinalResult = *lib.get(b"vosk_recognizer_final_result\0").map_err(|e| e.to_string())?;
        let recognizer_reset: VoskRecognizerReset = *lib.get(b"vosk_recognizer_reset\0").map_err(|e| e.to_string())?;

        Ok(VoskLib {
            _lib: lib,
            set_log_level,
            model_new,
            model_free,
            recognizer_new,
            recognizer_free,
            recognizer_set_words,
            recognizer_accept_waveform,
            recognizer_result,
            recognizer_partial_result,
            recognizer_final_result,
            recognizer_reset,
        })
    }
}

#[tauri::command]
pub async fn start_voice(app: tauri::AppHandle, lang: String) -> Result<Value, String> {
    use tauri::Manager;
    let mut state = VOSK_STATE.lock().await;

    // Stop existing if running
    state.cleanup();

    // Load library if not loaded
    if state.lib.is_none() {
        match load_vosk_library() {
            Ok(lib) => {
                unsafe { (lib.set_log_level)(-1); }
                state.lib = Some(lib);
            }
            Err(e) => {
                return Ok(serde_json::json!({
                    "success": false,
                    "error": e,
                    "useWebSpeech": true
                }));
            }
        }
    }

    // Find or download model
    let models_dir = app.path().app_data_dir().unwrap().join("vosk-models");
    let _ = std::fs::create_dir_all(&models_dir);
    let model_dir = models_dir.join(get_model_dir_name(&lang));

    if !model_dir.exists() {
        let url = get_model_url(&lang)
            .ok_or_else(|| format!("Unsupported language: {}", lang))?;

        // Download model
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?;

        let response = client.get(url).send().await.map_err(|e| e.to_string())?;
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;

        // Extract zip
        let models_dir_clone = models_dir.clone();
        let bytes_vec = bytes.to_vec();
        tokio::task::spawn_blocking(move || {
            let cursor = std::io::Cursor::new(bytes_vec);
            let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;
            archive.extract(&models_dir_clone).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())??;

        if !model_dir.exists() {
            return Err("Model extraction failed - directory not found".into());
        }
    }

    // Create model and recognizer
    let lib = state.lib.as_ref().unwrap();
    let model_path_c = CString::new(model_dir.to_string_lossy().as_bytes())
        .map_err(|e| e.to_string())?;

    let model = unsafe { (lib.model_new)(model_path_c.as_ptr()) };
    if model.is_null() {
        return Err("Failed to create Vosk model".into());
    }

    let recognizer = unsafe { (lib.recognizer_new)(model, 16000.0) };
    if recognizer.is_null() {
        unsafe { (lib.model_free)(model); }
        return Err("Failed to create Vosk recognizer".into());
    }

    unsafe { (lib.recognizer_set_words)(recognizer, 1); }

    state.model = model;
    state.recognizer = recognizer;
    state.running = true;
    state.lang = lang.clone();
    state.engine = "vosk".into();

    Ok(serde_json::json!({
        "success": true,
        "engine": "vosk",
        "lang": lang
    }))
}

#[tauri::command]
pub async fn stop_voice() -> Result<Value, String> {
    let mut state = VOSK_STATE.lock().await;
    state.cleanup();
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_voice_status() -> Result<Value, String> {
    let state = VOSK_STATE.lock().await;
    Ok(serde_json::json!({
        "running": state.running,
        "engine": state.engine,
        "lang": if state.lang.is_empty() { Value::Null } else { Value::String(state.lang.clone()) }
    }))
}

#[tauri::command]
pub async fn get_voice_config(app: tauri::AppHandle) -> Result<Value, String> {
    use tauri::Manager;
    let path = app.path().app_data_dir().unwrap().join("voice-config.json");
    if !path.exists() {
        return Ok(serde_json::json!({
            "aliases": {},
            "haUrl": null,
            "haToken": null
        }));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn set_voice_config(app: tauri::AppHandle, config: Value) -> Result<Value, String> {
    use tauri::Manager;
    let path = app.path().app_data_dir().unwrap().join("voice-config.json");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn parse_voice_command(_text: String, _lang: String) -> Result<Value, String> {
    // Command parsing remains in the frontend (voice-commands.js)
    // This is a passthrough — the frontend handles parsing via JavaScript
    Ok(serde_json::json!({
        "command": null,
        "confidence": 0.0
    }))
}

#[tauri::command]
pub async fn execute_voice_command(_intent: Value) -> Result<Value, String> {
    // Command execution is dispatched from the frontend to individual Rust commands
    // (volume, media, HA, system_actions) — no need for a central dispatcher here
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn send_voice_audio(app: tauri::AppHandle, base64_data: String) -> Result<Value, String> {
    use tauri::Emitter;

    let state = VOSK_STATE.lock().await;
    if !state.running || state.lib.is_none() {
        return Err("Voice recognition not running".into());
    }

    // Decode base64 PCM data
    use base64::Engine;
    let pcm_data = base64::engine::general_purpose::STANDARD.decode(&base64_data)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    let lib = state.lib.as_ref().unwrap();
    let recognizer = state.recognizer;

    // Feed audio to recognizer
    let is_final = unsafe {
        (lib.recognizer_accept_waveform)(recognizer, pcm_data.as_ptr(), pcm_data.len() as i32)
    };

    if is_final != 0 {
        // Final result
        let result_ptr = unsafe { (lib.recognizer_result)(recognizer) };
        if !result_ptr.is_null() {
            let result_str = unsafe { CStr::from_ptr(result_ptr) }.to_string_lossy().to_string();
            if let Ok(result_json) = serde_json::from_str::<Value>(&result_str) {
                let text = result_json["text"].as_str().unwrap_or("").to_string();
                if !text.is_empty() {
                    let _ = app.emit("voice-result", serde_json::json!({
                        "type": "final",
                        "text": text,
                    }));
                }
                return Ok(serde_json::json!({
                    "type": "final",
                    "text": text,
                }));
            }
        }
    } else {
        // Partial result
        let partial_ptr = unsafe { (lib.recognizer_partial_result)(recognizer) };
        if !partial_ptr.is_null() {
            let partial_str = unsafe { CStr::from_ptr(partial_ptr) }.to_string_lossy().to_string();
            if let Ok(partial_json) = serde_json::from_str::<Value>(&partial_str) {
                let text = partial_json["partial"].as_str().unwrap_or("").to_string();
                if !text.is_empty() {
                    let _ = app.emit("voice-result", serde_json::json!({
                        "type": "partial",
                        "text": text,
                    }));
                }
                return Ok(serde_json::json!({
                    "type": "partial",
                    "text": text,
                }));
            }
        }
    }

    Ok(serde_json::json!({ "type": "none" }))
}
