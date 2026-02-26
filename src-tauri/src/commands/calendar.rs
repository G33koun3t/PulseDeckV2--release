use serde_json::Value;

#[tauri::command]
pub async fn fetch_google_calendar(ics_url: String) -> Result<Value, String> {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("PulseDeck/2.0")
        .build() {
            Ok(c) => c,
            Err(e) => return Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
        };

    let response = match client.get(&ics_url).send().await {
        Ok(r) => r,
        Err(e) => return Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    };

    let body = match response.text().await {
        Ok(b) => b,
        Err(e) => return Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    };

    // Parse ICS using ical crate
    let reader = ical::IcalParser::new(body.as_bytes());
    let mut events: Vec<Value> = Vec::new();

    for calendar in reader {
        let cal = match calendar {
            Ok(c) => c,
            Err(_) => continue,
        };
        for event in cal.events {
            let mut summary = String::new();
            let mut description = String::new();
            let mut location = String::new();
            let mut dtstart = String::new();
            let mut dtend = String::new();
            let mut uid = String::new();
            let mut all_day = false;

            for prop in &event.properties {
                let val = prop.value.as_deref().unwrap_or("");
                match prop.name.as_str() {
                    "SUMMARY" => summary = val.to_string(),
                    "DESCRIPTION" => description = val.to_string(),
                    "LOCATION" => location = val.to_string(),
                    "UID" => uid = val.to_string(),
                    "DTSTART" => {
                        dtstart = parse_ics_date(val);
                        if val.len() == 8 && !val.contains('T') {
                            all_day = true;
                        }
                    }
                    "DTEND" => {
                        dtend = parse_ics_date(val);
                    }
                    _ => {}
                }
            }

            if !summary.is_empty() {
                events.push(serde_json::json!({
                    "uid": uid,
                    "summary": summary,
                    "description": description,
                    "location": location,
                    "start": dtstart,
                    "end": dtend,
                    "allDay": all_day,
                }));
            }
        }
    }

    events.sort_by(|a, b| {
        let sa = a["start"].as_str().unwrap_or("");
        let sb = b["start"].as_str().unwrap_or("");
        sa.cmp(sb)
    });

    Ok(serde_json::json!({
        "success": true,
        "events": events,
    }))
}

/// Convert ICS date format to ISO 8601
fn parse_ics_date(date_str: &str) -> String {
    let clean = date_str.replace('Z', "");
    if clean.len() >= 15 && clean.contains('T') {
        let (date, time) = clean.split_at(8);
        let time = &time[1..];
        format!(
            "{}-{}-{}T{}:{}:{}",
            &date[0..4], &date[4..6], &date[6..8],
            &time[0..2], &time[2..4], &time[4..6]
        )
    } else if clean.len() >= 8 {
        format!("{}-{}-{}", &clean[0..4], &clean[4..6], &clean[6..8])
    } else {
        date_str.to_string()
    }
}
