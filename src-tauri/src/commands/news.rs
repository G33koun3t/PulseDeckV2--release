use serde_json::Value;

#[tauri::command]
pub async fn fetch_rss(feed_url: String) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) PulseDeck/2.0")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&feed_url)
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => {
            log::warn!("[RSS] Fetch error for {}: {}", feed_url, e);
            return Ok(serde_json::json!({ "success": false, "error": e.to_string() }));
        }
    };

    let status = response.status();
    let body = match response.bytes().await {
        Ok(b) => b,
        Err(e) => {
            log::warn!("[RSS] Body read error for {}: {}", feed_url, e);
            return Ok(serde_json::json!({ "success": false, "error": e.to_string() }));
        }
    };

    log::info!("[RSS] {} → HTTP {} ({} bytes)", feed_url, status, body.len());

    let feed = match feed_rs::parser::parse(&body[..]) {
        Ok(f) => f,
        Err(e) => {
            log::warn!("[RSS] Parse error for {}: {}", feed_url, e);
            return Ok(serde_json::json!({ "success": false, "error": e.to_string() }));
        }
    };

    log::info!("[RSS] {} → {} entries parsed", feed_url, feed.entries.len());

    let items: Vec<Value> = feed.entries.iter().take(20).map(|entry| {
        let title = entry.title.as_ref().map(|t| t.content.clone()).unwrap_or_default();
        let link = entry.links.first().map(|l| l.href.clone()).unwrap_or_default();
        let published = entry.published.or(entry.updated).map(|d| d.to_rfc3339()).unwrap_or_default();
        let summary = entry.summary.as_ref().map(|s| {
            // Strip HTML tags for contentSnippet
            let content = &s.content;
            let stripped = strip_html(content);
            // Use char boundary safe truncation (avoid panic on multi-byte UTF-8)
            if stripped.chars().count() > 200 {
                let truncated: String = stripped.chars().take(200).collect();
                format!("{}...", truncated)
            } else {
                stripped
            }
        }).unwrap_or_default();

        // Try to extract image from media content
        let image = entry.media.first()
            .and_then(|m| m.thumbnails.first())
            .map(|t| t.image.uri.clone())
            .or_else(|| {
                entry.media.first()
                    .and_then(|m| m.content.first())
                    .and_then(|c| c.url.as_ref())
                    .map(|u| u.to_string())
            })
            .or_else(|| {
                // Try to extract <img> from content/description
                let html_str = entry.content.as_ref()
                    .and_then(|c| c.body.as_deref())
                    .or(entry.summary.as_ref().map(|s| s.content.as_str()));
                html_str.and_then(extract_img_src)
            });

        serde_json::json!({
            "title": title,
            "link": link,
            "date": published,
            "pubDate": published,
            "contentSnippet": summary,
            "image": image,
        })
    }).collect();

    // Format matching Electron: { success, feed: { title, items } }
    Ok(serde_json::json!({
        "success": true,
        "feed": {
            "title": feed.title.map(|t| t.content).unwrap_or_default(),
            "items": items,
        }
    }))
}

fn strip_html(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        if c == '<' { in_tag = true; continue; }
        if c == '>' { in_tag = false; continue; }
        if !in_tag { result.push(c); }
    }
    result.trim().to_string()
}

fn extract_img_src(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    if let Some(img_pos) = lower.find("<img") {
        let rest = &html[img_pos..];
        if let Some(src_pos) = rest.to_lowercase().find("src=") {
            let after_src = &rest[src_pos + 4..];
            let quote = if after_src.starts_with('"') { '"' } else if after_src.starts_with('\'') { '\'' } else { return None };
            let start = 1;
            if let Some(end) = after_src[start..].find(quote) {
                let url = &after_src[start..start + end];
                if url.starts_with("http") {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn fetch_og_images(urls: Vec<String>) -> Result<Value, String> {
    let results = crate::workers::og_worker::fetch_og_images(urls).await;
    Ok(Value::Array(results))
}

#[tauri::command]
pub async fn fetch_crypto_prices() -> Result<Value, String> {
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,avalanche-2,polkadot,polygon-ecosystem-token&vs_currencies=eur,usd,pln,jpy&include_24hr_change=true";

    let client = reqwest::Client::new();
    let response = client.get(url)
        .header("User-Agent", "PulseDeck/2.0")
        .send()
        .await;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                let data: Value = resp.json().await.map_err(|e| e.to_string())?;
                Ok(serde_json::json!({ "success": true, "data": data }))
            } else {
                Ok(serde_json::json!({ "success": false, "error": format!("HTTP {}", resp.status()) }))
            }
        }
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}
