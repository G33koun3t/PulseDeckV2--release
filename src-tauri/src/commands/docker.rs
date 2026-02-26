use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

// SSH connection pool (global state)
use once_cell::sync::Lazy;
static CONNECTIONS: Lazy<Arc<Mutex<HashMap<String, Arc<russh::client::Handle<SshHandler>>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

// Minimal SSH handler
struct SshHandler;

#[async_trait::async_trait]
impl russh::client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true) // Accept all host keys (like ssh2 in Electron version)
    }
}

/// Execute command over SSH and return stdout
async fn exec_ssh(
    handle: &russh::client::Handle<SshHandler>,
    command: &str,
    timeout_secs: u64,
) -> Result<String, String> {
    let mut channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
    channel.exec(true, command).await.map_err(|e| e.to_string())?;

    let mut stdout = Vec::new();
    let timeout = tokio::time::Duration::from_secs(timeout_secs);

    loop {
        match tokio::time::timeout(timeout, channel.wait()).await {
            Ok(Some(msg)) => {
                match msg {
                    russh::ChannelMsg::Data { data } => {
                        stdout.extend_from_slice(&data);
                    }
                    russh::ChannelMsg::ExtendedData { data, .. } => {
                        // stderr - also capture for docker logs 2>&1
                        stdout.extend_from_slice(&data);
                    }
                    russh::ChannelMsg::Eof | russh::ChannelMsg::Close => break,
                    russh::ChannelMsg::ExitStatus { .. } => {}
                    _ => {}
                }
            }
            Ok(None) => break,
            Err(_) => return Err("SSH command timeout".into()),
        }
    }

    Ok(String::from_utf8_lossy(&stdout).to_string())
}

fn is_valid_container_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '.' || c == '-')
}

// ========== IPC Handlers ==========

#[tauri::command]
pub async fn docker_get_hosts(app: tauri::AppHandle) -> Result<Value, String> {
    let path = app.path().app_data_dir().unwrap().join("docker-hosts.json");
    if !path.exists() {
        return Ok(serde_json::json!([]));
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn docker_save_hosts(app: tauri::AppHandle, hosts: Value) -> Result<Value, String> {
    let path = app.path().app_data_dir().unwrap().join("docker-hosts.json");
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, serde_json::to_string_pretty(&hosts).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn docker_connect(app: tauri::AppHandle, host_id: String) -> Result<Value, String> {
    let path = app.path().app_data_dir().unwrap().join("docker-hosts.json");
    let hosts: Vec<Value> = if path.exists() {
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("No hosts configured".into());
    };

    let host = hosts.iter()
        .find(|h| h["id"].as_str() == Some(&host_id))
        .ok_or("Host not found")?;

    let hostname = host["hostname"].as_str().unwrap_or("localhost").to_string();
    let port = host["port"].as_u64().unwrap_or(22) as u16;
    let username = host["username"].as_str().unwrap_or("root").to_string();
    let auth_type = host["authType"].as_str().unwrap_or("password");
    let password = host["password"].as_str().unwrap_or("").to_string();
    let key_path = host["privateKeyPath"].as_str().unwrap_or("").to_string();
    let passphrase = host["passphrase"].as_str().map(|s| s.to_string());

    // Disconnect existing
    {
        let mut conns = CONNECTIONS.lock().await;
        conns.remove(&host_id);
    }

    let config = Arc::new(russh::client::Config::default());
    let handler = SshHandler;

    let mut session = russh::client::connect(config, (hostname.as_str(), port), handler)
        .await
        .map_err(|e| format!("SSH connection failed: {}", e))?;

    // Authenticate
    let auth_ok = if auth_type == "key" && !key_path.is_empty() {
        let key_data = std::fs::read_to_string(&key_path)
            .map_err(|e| format!("Cannot read SSH key: {}", e))?;
        let key = if let Some(ref pass) = passphrase {
            russh_keys::decode_secret_key(&key_data, Some(pass))
        } else {
            russh_keys::decode_secret_key(&key_data, None)
        }
        .map_err(|e| format!("Invalid SSH key: {}", e))?;

        session.authenticate_publickey(&username, Arc::new(key))
            .await
            .map_err(|e| format!("SSH auth failed: {}", e))?
    } else {
        session.authenticate_password(&username, &password)
            .await
            .map_err(|e| format!("SSH auth failed: {}", e))?
    };

    if !auth_ok {
        return Err("SSH authentication failed".into());
    }

    let handle = Arc::new(session);
    CONNECTIONS.lock().await.insert(host_id, handle);

    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn docker_disconnect(host_id: String) -> Result<Value, String> {
    CONNECTIONS.lock().await.remove(&host_id);
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn docker_test_connection(config: Value) -> Result<Value, String> {
    let hostname = config["hostname"].as_str().unwrap_or("localhost").to_string();
    let port = config["port"].as_u64().unwrap_or(22) as u16;
    let username = config["username"].as_str().unwrap_or("root").to_string();
    let auth_type = config["authType"].as_str().unwrap_or("password");
    let password = config["password"].as_str().unwrap_or("").to_string();
    let key_path = config["privateKeyPath"].as_str().unwrap_or("").to_string();
    let passphrase = config["passphrase"].as_str().map(|s| s.to_string());

    let ssh_config = Arc::new(russh::client::Config {
        ..Default::default()
    });

    let mut session = match tokio::time::timeout(
        tokio::time::Duration::from_secs(10),
        russh::client::connect(ssh_config, (hostname.as_str(), port), SshHandler),
    ).await {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
        Err(_) => return Ok(serde_json::json!({ "success": false, "error": "Connection timeout" })),
    };

    let auth_ok = if auth_type == "key" && !key_path.is_empty() {
        let key_data = match std::fs::read_to_string(&key_path) {
            Ok(d) => d,
            Err(e) => return Ok(serde_json::json!({ "success": false, "error": format!("Cannot read SSH key: {}", e) })),
        };
        let key = match if let Some(ref pass) = passphrase {
            russh_keys::decode_secret_key(&key_data, Some(pass))
        } else {
            russh_keys::decode_secret_key(&key_data, None)
        } {
            Ok(k) => k,
            Err(e) => return Ok(serde_json::json!({ "success": false, "error": format!("Invalid SSH key: {}", e) })),
        };
        session.authenticate_publickey(&username, Arc::new(key)).await.unwrap_or(false)
    } else {
        session.authenticate_password(&username, &password).await.unwrap_or(false)
    };

    if !auth_ok {
        return Ok(serde_json::json!({ "success": false, "error": "SSH authentication failed" }));
    }

    // Check docker is installed
    let handle = Arc::new(session);
    match exec_ssh(&handle, "docker --version", 10).await {
        Ok(version) => Ok(serde_json::json!({ "success": true, "dockerVersion": version.trim() })),
        Err(_) => Ok(serde_json::json!({ "success": false, "error": "Docker is not installed on this host" })),
    }
}

#[tauri::command]
pub async fn docker_list_containers(host_id: String) -> Result<Value, String> {
    let conns = CONNECTIONS.lock().await;
    let handle = conns.get(&host_id).ok_or("Not connected")?;

    let stdout = exec_ssh(handle, "docker ps -a --format '{{json .}}'", 15).await?;
    let containers: Vec<Value> = stdout.lines()
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .map(|c| serde_json::json!({
            "id": c["ID"],
            "name": c["Names"],
            "image": c["Image"],
            "status": c["Status"],
            "state": c["State"],
            "ports": c["Ports"],
            "createdAt": c["CreatedAt"],
            "runningFor": c["RunningFor"],
        }))
        .collect();

    Ok(serde_json::json!({ "success": true, "data": containers }))
}

#[tauri::command]
pub async fn docker_get_stats(host_id: String) -> Result<Value, String> {
    let conns = CONNECTIONS.lock().await;
    let handle = conns.get(&host_id).ok_or("Not connected")?;

    let stdout = exec_ssh(handle, "docker stats --no-stream --format '{{json .}}'", 30).await?;
    let stats: Vec<Value> = stdout.lines()
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .map(|s| serde_json::json!({
            "id": s["ID"],
            "name": s["Name"],
            "cpuPerc": s["CPUPerc"],
            "memUsage": s["MemUsage"],
            "memPerc": s["MemPerc"],
            "netIO": s["NetIO"],
            "blockIO": s["BlockIO"],
        }))
        .collect();

    Ok(serde_json::json!({ "success": true, "data": stats }))
}

#[tauri::command]
pub async fn docker_inspect(host_id: String, container_id: String) -> Result<Value, String> {
    if !is_valid_container_id(&container_id) {
        return Err("Invalid container ID".into());
    }

    let conns = CONNECTIONS.lock().await;
    let handle = conns.get(&host_id).ok_or("Not connected")?;

    let stdout = exec_ssh(handle, &format!("docker inspect {}", container_id), 15).await?;
    let data: Vec<Value> = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
    let c = data.first().ok_or("Container not found")?;

    let volumes: Vec<Value> = c["Mounts"].as_array()
        .map(|mounts| mounts.iter().map(|m| serde_json::json!({
            "source": m["Source"],
            "destination": m["Destination"],
            "mode": m["Mode"],
            "type": m["Type"],
        })).collect())
        .unwrap_or_default();

    Ok(serde_json::json!({
        "success": true,
        "data": {
            "id": c["Id"],
            "name": c["Name"].as_str().unwrap_or("").trim_start_matches('/'),
            "image": c["Config"]["Image"],
            "env": c["Config"]["Env"],
            "ports": c["NetworkSettings"]["Ports"],
            "volumes": volumes,
            "restartPolicy": c["HostConfig"]["RestartPolicy"]["Name"],
            "state": c["State"]["Status"],
            "startedAt": c["State"]["StartedAt"],
            "finishedAt": c["State"]["FinishedAt"],
            "created": c["Created"],
            "composeProject": c["Config"]["Labels"]["com.docker.compose.project"],
            "composeService": c["Config"]["Labels"]["com.docker.compose.service"],
            "composeWorkingDir": c["Config"]["Labels"]["com.docker.compose.project.working_dir"],
        }
    }))
}

#[tauri::command]
pub async fn docker_logs(host_id: String, container_id: String, tail: Option<i32>) -> Result<Value, String> {
    if !is_valid_container_id(&container_id) {
        return Err("Invalid container ID".into());
    }

    let conns = CONNECTIONS.lock().await;
    let handle = conns.get(&host_id).ok_or("Not connected")?;
    let tail_n = tail.unwrap_or(50);

    let stdout = exec_ssh(
        handle,
        &format!("docker logs --tail {} --timestamps {} 2>&1", tail_n, container_id),
        30,
    ).await?;

    Ok(serde_json::json!({ "success": true, "data": stdout }))
}

#[tauri::command]
pub async fn docker_action(host_id: String, container_id: String, action: String) -> Result<Value, String> {
    if !["start", "stop", "restart"].contains(&action.as_str()) {
        return Err("Invalid action".into());
    }
    if !is_valid_container_id(&container_id) {
        return Err("Invalid container ID".into());
    }

    let conns = CONNECTIONS.lock().await;
    let handle = conns.get(&host_id).ok_or("Not connected")?;

    exec_ssh(handle, &format!("docker {} {}", action, container_id), 30).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn docker_update_container(host_id: String, container_id: String) -> Result<Value, String> {
    if !is_valid_container_id(&container_id) {
        return Err("Invalid container ID".into());
    }

    let conns = CONNECTIONS.lock().await;
    let handle = conns.get(&host_id).ok_or("Not connected")?;

    // Get container info for image and compose labels
    let stdout = exec_ssh(handle, &format!("docker inspect {}", container_id), 15).await?;
    let data: Vec<Value> = serde_json::from_str(&stdout).map_err(|e| e.to_string())?;
    let c = data.first().ok_or("Container not found")?;

    let image = c["Config"]["Image"].as_str().unwrap_or("");
    let compose_service = c["Config"]["Labels"]["com.docker.compose.service"].as_str();
    let compose_dir = c["Config"]["Labels"]["com.docker.compose.project.working_dir"].as_str();

    if image.is_empty() {
        return Err("No image found for container".into());
    }

    if let (Some(service), Some(dir)) = (compose_service, compose_dir) {
        // Docker Compose: pull + recreate
        exec_ssh(
            handle,
            &format!("cd {} && docker compose pull {} && docker compose up -d {}", dir, service, service),
            120,
        ).await?;
        Ok(serde_json::json!({ "success": true, "data": { "compose": true, "pulled": true } }))
    } else {
        // Standalone: pull only
        exec_ssh(handle, &format!("docker pull {}", image), 120).await?;
        Ok(serde_json::json!({ "success": true, "data": { "compose": false, "pulled": true } }))
    }
}

#[tauri::command]
pub async fn docker_select_ssh_key(app: tauri::AppHandle) -> Result<Value, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let default_path = home.join(".ssh");

    let file = app.dialog()
        .file()
        .set_directory(&default_path)
        .set_title("Select SSH Private Key")
        .blocking_pick_file();

    match file {
        Some(path) => {
            let key_path = path.as_path().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
            Ok(serde_json::json!({
                "success": true,
                "path": key_path,
            }))
        }
        None => Ok(serde_json::json!({ "success": false })),
    }
}
