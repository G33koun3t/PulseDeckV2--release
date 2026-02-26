use serde_json::Value;

/// Fetch Open Graph images for a batch of article URLs
pub async fn fetch_og_images(urls: Vec<String>) -> Vec<Value> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (compatible; PulseDeck/2.0)")
        .build()
        .unwrap_or_default();

    let futures: Vec<_> = urls.into_iter().map(|url| {
        let client = client.clone();
        async move {
            match fetch_og_image(&client, &url).await {
                Some(image_url) => serde_json::json!({
                    "link": url,
                    "og": image_url,
                }),
                None => serde_json::json!({
                    "link": url,
                    "og": null,
                }),
            }
        }
    }).collect();

    futures::future::join_all(futures).await
}

async fn fetch_og_image(client: &reqwest::Client, url: &str) -> Option<String> {
    let response = client.get(url).send().await.ok()?;
    let body = response.text().await.ok()?;
    let lower = body.to_lowercase();

    // Find all <meta ...> tags and look for og:image
    // Handles both property="og:image" and property='og:image',
    // and content before or after property (common on Japanese sites)
    let mut search_from = 0;
    while let Some(meta_pos) = lower[search_from..].find("<meta") {
        let abs_pos = search_from + meta_pos;
        let tag_end = match lower[abs_pos..].find('>') {
            Some(e) => abs_pos + e,
            None => break,
        };
        let tag = &lower[abs_pos..=tag_end];

        // Check if this meta tag has og:image property
        let is_og_image = tag.contains("property=\"og:image\"")
            || tag.contains("property='og:image'");

        if is_og_image {
            // Extract content value from original (non-lowered) tag
            let orig_tag = &body[abs_pos..=tag_end];
            if let Some(img) = extract_meta_content(orig_tag) {
                if img.starts_with("http") {
                    return Some(img);
                }
            }
        }
        search_from = tag_end + 1;
    }
    None
}

/// Extract content="..." or content='...' value from a meta tag string
fn extract_meta_content(tag: &str) -> Option<String> {
    let lower = tag.to_lowercase();
    let content_pos = lower.find("content=")?;
    let after = &tag[content_pos + 8..];
    let quote = after.chars().next()?;
    if quote != '"' && quote != '\'' { return None; }
    let start = 1;
    let end = after[start..].find(quote)?;
    let value = &after[start..start + end];
    if value.is_empty() { None } else { Some(value.to_string()) }
}
