use serde_json::Value;

#[tauri::command]
pub async fn fetch_home_assistant(
    ha_url: String,
    token: String,
    endpoint: String,
    method: Option<String>,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{}/api/{}", ha_url.trim_end_matches('/'), endpoint);
    let client = reqwest::Client::new();
    let is_post = method.as_deref() == Some("POST");

    let mut req = if is_post {
        client.post(&url)
    } else {
        client.get(&url)
    };
    req = req
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json");

    if let Some(b) = body {
        req = req.json(&b);
    }

    let response = req.send().await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                // Try JSON first, fallback to plain text (for template API)
                let text = resp.text().await.map_err(|e| e.to_string())?;
                let data: Value = serde_json::from_str(&text)
                    .unwrap_or(Value::String(text));
                Ok(serde_json::json!({ "success": true, "data": data }))
            } else {
                Ok(serde_json::json!({
                    "success": false,
                    "error": format!("HTTP {}", resp.status())
                }))
            }
        }
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}

#[tauri::command]
pub async fn call_home_assistant_service(
    ha_url: String,
    token: String,
    domain: String,
    service: String,
    data: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{}/api/services/{}/{}", ha_url.trim_end_matches('/'), domain, service);
    let client = reqwest::Client::new();

    let mut req = client.post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json");

    if let Some(body) = data {
        req = req.json(&body);
    }

    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                Ok(serde_json::json!({ "success": true }))
            } else {
                Ok(serde_json::json!({
                    "success": false,
                    "error": format!("HTTP {}", resp.status())
                }))
            }
        }
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}
