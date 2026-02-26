use serde_json::Value;
use sha2::{Sha256, Digest};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const PRODUCT_ID: &str = "jyhdsJJ2ecjsN1uboNatRw==";
const GRACE_DAYS: u64 = 7;
const DEV_FINGERPRINT: &str = "8f773435aa4134de9ef18b79133a1ff30ce2bdb952458dd9b1fa75070a1db46d";

fn get_license_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("license.json")
}

fn generate_fingerprint() -> Result<String, String> {
    // Read MachineGuid from Windows Registry (same as node-machine-id)
    #[cfg(windows)]
    {
        use windows::Win32::System::Registry::*;
        use windows::core::*;

        unsafe {
            let subkey = w!("SOFTWARE\\Microsoft\\Cryptography");
            let mut hkey = HKEY::default();
            let status = RegOpenKeyExW(HKEY_LOCAL_MACHINE, subkey, 0, KEY_READ, &mut hkey);
            if status.is_err() {
                return Err("Failed to open registry key".into());
            }

            let value_name = w!("MachineGuid");
            let mut data_type = REG_VALUE_TYPE::default();
            let mut data_size: u32 = 0;

            // First call to get size
            let _ = RegQueryValueExW(hkey, value_name, None, Some(&mut data_type), None, Some(&mut data_size));

            let mut buffer = vec![0u8; data_size as usize];
            let status = RegQueryValueExW(hkey, value_name, None, Some(&mut data_type), Some(buffer.as_mut_ptr()), Some(&mut data_size));
            let _ = RegCloseKey(hkey);

            if status.is_err() {
                return Err("Failed to read MachineGuid".into());
            }

            // Convert UTF-16 buffer to String (remove null terminator)
            let guid = String::from_utf16_lossy(
                &buffer.chunks_exact(2)
                    .map(|c| u16::from_le_bytes([c[0], c[1]]))
                    .collect::<Vec<u16>>()
            ).trim_end_matches('\0').to_string();

            // Double SHA256 to match node-machine-id + generateFingerprint()
            // node-machine-id returns SHA256(guid), then generateFingerprint does SHA256(that)
            let first_hash = {
                let mut h = Sha256::new();
                h.update(guid.as_bytes());
                format!("{:x}", h.finalize())
            };
            let mut hasher = Sha256::new();
            hasher.update(first_hash.as_bytes());
            Ok(format!("{:x}", hasher.finalize()))
        }
    }

    #[cfg(not(windows))]
    {
        Err("License system only supported on Windows".into())
    }
}

#[tauri::command]
pub async fn check_license(app: tauri::AppHandle) -> Result<Value, String> {
    let license_path = get_license_path(&app);
    let fingerprint = generate_fingerprint()?;

    if !license_path.exists() {
        return Ok(serde_json::json!({
            "valid": false,
            "reason": "no_license"
        }));
    }

    let data: Value = serde_json::from_str(
        &fs::read_to_string(&license_path).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;

    let key = data["key"].as_str().unwrap_or("");
    let stored_fingerprint = data["fingerprint"].as_str().unwrap_or("");

    // Developer machine bypass
    if fingerprint == DEV_FINGERPRINT {
        return Ok(serde_json::json!({ "valid": true, "reason": "valid" }));
    }

    if stored_fingerprint != fingerprint {
        return Ok(serde_json::json!({
            "valid": false,
            "reason": "fingerprint_mismatch"
        }));
    }

    // Try online validation
    let client = reqwest::Client::new();
    let result = client.post("https://api.gumroad.com/v2/licenses/verify")
        .form(&[
            ("product_id", PRODUCT_ID),
            ("license_key", key),
            ("increment_uses_count", "false"),
        ])
        .send()
        .await;

    match result {
        Ok(response) => {
            let body: Value = response.json().await.map_err(|e| e.to_string())?;
            let success = body["success"].as_bool().unwrap_or(false);
            let refunded = body["purchase"]["refunded"].as_bool().unwrap_or(false);
            let chargebacked = body["purchase"]["chargebacked"].as_bool().unwrap_or(false);

            if refunded || chargebacked {
                let _ = fs::remove_file(&license_path);
                return Ok(serde_json::json!({
                    "valid": false,
                    "reason": if refunded { "refunded" } else { "chargebacked" }
                }));
            }

            // Update last validated timestamp
            let mut license_data = data.clone();
            license_data["lastValidated"] = serde_json::json!(chrono::Utc::now().timestamp_millis());
            let _ = fs::write(&license_path, serde_json::to_string_pretty(&license_data).unwrap());

            Ok(serde_json::json!({
                "valid": success,
                "reason": if success { "valid" } else { "invalid_key" }
            }))
        }
        Err(_) => {
            // Offline: check grace period
            let last_validated = data["lastValidated"].as_i64().unwrap_or(0);
            let now = chrono::Utc::now().timestamp_millis();
            let grace_ms = GRACE_DAYS * 24 * 60 * 60 * 1000;

            if (now - last_validated) < grace_ms as i64 {
                Ok(serde_json::json!({
                    "valid": true,
                    "reason": "offline_grace"
                }))
            } else {
                Ok(serde_json::json!({
                    "valid": false,
                    "reason": "grace_expired"
                }))
            }
        }
    }
}

#[tauri::command]
pub async fn activate_license(app: tauri::AppHandle, key: String) -> Result<Value, String> {
    let fingerprint = generate_fingerprint()?;

    // Developer machine bypass
    if fingerprint == DEV_FINGERPRINT {
        let license_data = serde_json::json!({
            "key": key,
            "fingerprint": fingerprint,
            "activatedAt": chrono::Utc::now().timestamp_millis(),
            "lastValidated": chrono::Utc::now().timestamp_millis(),
        });
        let license_path = get_license_path(&app);
        if let Some(parent) = license_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&license_path, serde_json::to_string_pretty(&license_data).unwrap())
            .map_err(|e| e.to_string())?;
        return Ok(serde_json::json!({ "success": true }));
    }

    let client = reqwest::Client::new();
    let response = client.post("https://api.gumroad.com/v2/licenses/verify")
        .form(&[
            ("product_id", PRODUCT_ID),
            ("license_key", key.as_str()),
            ("increment_uses_count", "true"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    let success = body["success"].as_bool().unwrap_or(false);

    if !success {
        return Ok(serde_json::json!({
            "success": false,
            "reason": "invalid_key"
        }));
    }

    let license_data = serde_json::json!({
        "key": key,
        "fingerprint": fingerprint,
        "activatedAt": chrono::Utc::now().timestamp_millis(),
        "lastValidated": chrono::Utc::now().timestamp_millis(),
    });

    let license_path = get_license_path(&app);
    if let Some(parent) = license_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&license_path, serde_json::to_string_pretty(&license_data).unwrap())
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn deactivate_license(app: tauri::AppHandle) -> Result<Value, String> {
    let license_path = get_license_path(&app);
    if license_path.exists() {
        fs::remove_file(&license_path).map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn get_license_info(app: tauri::AppHandle) -> Result<Value, String> {
    let license_path = get_license_path(&app);
    if !license_path.exists() {
        return Ok(serde_json::json!({ "hasLicense": false }));
    }

    let data: Value = serde_json::from_str(
        &fs::read_to_string(&license_path).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;

    let key = data["key"].as_str().unwrap_or("");
    let masked = if key.len() > 8 {
        format!("{}...{}", &key[..4], &key[key.len()-4..])
    } else {
        "****".to_string()
    };

    Ok(serde_json::json!({
        "hasLicense": true,
        "maskedKey": masked,
    }))
}
