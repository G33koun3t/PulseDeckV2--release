use serde_json::Value;
use sysinfo::{System, Networks, Disks};
use std::sync::Mutex;
use tauri::State;

/// Check if a drive path is a network drive using Windows API
#[cfg(windows)]
fn is_network_drive(mount: &str) -> bool {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::GetDriveTypeW;
    let path = HSTRING::from(mount);
    let drive_type = unsafe { GetDriveTypeW(&path) };
    drive_type == 4 // DRIVE_REMOTE = 4
}

#[cfg(not(windows))]
fn is_network_drive(mount: &str) -> bool {
    mount.starts_with("//")
}

/// Enumerate network drives that sysinfo might miss (mapped network drives)
#[cfg(windows)]
fn enumerate_network_drives(existing_mounts: &[String]) -> Vec<Value> {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::{GetLogicalDrives, GetDriveTypeW, GetDiskFreeSpaceExW, GetVolumeInformationW};

    let mut drives = Vec::new();
    let bitmask = unsafe { GetLogicalDrives() };

    for i in 0u8..26 {
        if bitmask & (1 << i) == 0 { continue; }
        let letter = (b'A' + i) as char;
        let root = format!("{}:\\", letter);

        // Skip if already listed by sysinfo
        if existing_mounts.iter().any(|m| m.eq_ignore_ascii_case(&root)) { continue; }

        let path = HSTRING::from(&root);
        let drive_type = unsafe { GetDriveTypeW(&path) };
        if drive_type != 4 { continue; } // Only DRIVE_REMOTE

        // Get free space
        let (mut total_bytes, mut free_bytes) = (0u64, 0u64);
        unsafe {
            let _ = GetDiskFreeSpaceExW(
                &path,
                None,
                Some(&mut total_bytes as *mut u64),
                Some(&mut free_bytes as *mut u64),
            );
        }

        // Get volume name
        let mut name_buf = [0u16; 256];
        let mut fs_buf = [0u16; 256];
        unsafe {
            let _ = GetVolumeInformationW(
                &path,
                Some(&mut name_buf),
                None, None, None,
                Some(&mut fs_buf),
            );
        }
        let name = String::from_utf16_lossy(&name_buf).trim_end_matches('\0').to_string();
        let fs_name = String::from_utf16_lossy(&fs_buf).trim_end_matches('\0').to_string();

        let available = free_bytes;
        let used = total_bytes.saturating_sub(available);

        drives.push(serde_json::json!({
            "name": if name.is_empty() { format!("Réseau ({}:)", letter) } else { name },
            "mount": root,
            "size": total_bytes,
            "used": used,
            "available": available,
            "fileSystem": fs_name,
            "isRemovable": false,
            "isNetwork": true,
        }));
    }

    drives
}

#[cfg(not(windows))]
fn enumerate_network_drives(_existing_mounts: &[String]) -> Vec<Value> {
    Vec::new()
}

pub struct MonitoringState {
    pub system: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub disks: Mutex<Disks>,
}

impl Default for MonitoringState {
    fn default() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
            disks: Mutex::new(Disks::new_with_refreshed_list()),
        }
    }
}

#[tauri::command]
pub async fn get_static_info(state: State<'_, MonitoringState>) -> Result<Value, String> {
    let mut sys = state.system.lock().map_err(|e| e.to_string())?;
    sys.refresh_all();

    let cpus = sys.cpus();
    let cpu_name = cpus.first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_cores = cpus.len();

    // Disk info (sysinfo + manual network drive enumeration)
    let disks = state.disks.lock().map_err(|e| e.to_string())?;
    let mut disk_info: Vec<Value> = disks.iter().map(|d| {
        let mount = d.mount_point().to_string_lossy().to_string();
        let is_network = is_network_drive(&mount);
        let total = d.total_space();
        let available = d.available_space();
        let used = total.saturating_sub(available);
        serde_json::json!({
            "name": d.name().to_string_lossy(),
            "mount": mount,
            "size": total,
            "used": used,
            "available": available,
            "fileSystem": String::from_utf8_lossy(d.file_system().as_encoded_bytes()),
            "isRemovable": d.is_removable(),
            "isNetwork": is_network,
        })
    }).collect();

    // Add network drives that sysinfo might have missed
    let existing_mounts: Vec<String> = disk_info.iter()
        .filter_map(|d| d["mount"].as_str().map(|s| s.to_string()))
        .collect();
    disk_info.extend(enumerate_network_drives(&existing_mounts));

    Ok(serde_json::json!({
        "cpu": {
            "brand": cpu_name,
            "cores": cpu_cores,
        },
        "totalMemory": sys.total_memory(),
        "disk": disk_info,
        "os": {
            "name": System::name().unwrap_or_default(),
            "version": System::os_version().unwrap_or_default(),
            "hostname": System::host_name().unwrap_or_default(),
        },
    }))
}

#[tauri::command]
pub async fn get_dynamic_info(state: State<'_, MonitoringState>) -> Result<Value, String> {
    let mut sys = state.system.lock().map_err(|e| e.to_string())?;
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
    let avg = if per_core.is_empty() { 0.0 } else {
        per_core.iter().sum::<f32>() / per_core.len() as f32
    };

    Ok(serde_json::json!({
        "cpu": {
            "load": avg,
            "perCore": per_core,
        },
        "memory": {
            "total": sys.total_memory(),
            "used": sys.used_memory(),
            "free": sys.available_memory(),
        },
        "uptime": System::uptime(),
    }))
}

#[tauri::command]
pub async fn get_dynamic_info_heavy(state: State<'_, MonitoringState>) -> Result<Value, String> {
    // Collect disk info and drop guard before await
    let mut disk_info: Vec<Value> = {
        let mut disks = state.disks.lock().map_err(|e| e.to_string())?;
        disks.refresh();
        disks.iter().map(|d| {
            let total = d.total_space();
            let available = d.available_space();
            let used = total.saturating_sub(available);
            let mount = d.mount_point().to_string_lossy().to_string();
            let is_network = is_network_drive(&mount);
            serde_json::json!({
                "name": d.name().to_string_lossy(),
                "mount": mount,
                "size": total,
                "used": used,
                "available": available,
                "isNetwork": is_network,
            })
        }).collect()
    };

    // Add network drives that sysinfo might have missed
    let existing_mounts: Vec<String> = disk_info.iter()
        .filter_map(|d| d["mount"].as_str().map(|s| s.to_string()))
        .collect();
    disk_info.extend(enumerate_network_drives(&existing_mounts));

    // Collect network info and drop guard before await
    let net_info: Vec<Value> = {
        let mut networks = state.networks.lock().map_err(|e| e.to_string())?;
        networks.refresh();
        networks.iter().map(|(name, data)| {
            serde_json::json!({
                "name": name,
                "rxBytes": data.total_received(),
                "txBytes": data.total_transmitted(),
                "rxSpeed": data.received(),
                "txSpeed": data.transmitted(),
            })
        }).collect()
    };

    // GPU metrics via PowerShell PDH (same approach as gpu-metrics.ps1)
    let gpu = get_gpu_usage().await;

    Ok(serde_json::json!({
        "disks": disk_info,
        "network": net_info,
        "gpu": gpu,
    }))
}

#[tauri::command]
pub async fn get_network_stats(state: State<'_, MonitoringState>) -> Result<Value, String> {
    let mut networks = state.networks.lock().map_err(|e| e.to_string())?;
    networks.refresh();

    let interfaces: Vec<Value> = networks.iter().map(|(name, data)| {
        serde_json::json!({
            "name": name,
            "rxBytes": data.total_received(),
            "txBytes": data.total_transmitted(),
            "rxSpeed": data.received(),
            "txSpeed": data.transmitted(),
        })
    }).collect();

    Ok(serde_json::json!({ "interfaces": interfaces }))
}

#[tauri::command]
pub async fn run_speedtest() -> Result<Value, String> {
    // Try Ookla CLI first, then fallback to built-in HTTP speed test
    let mut ookla_cmd = tokio::process::Command::new("speedtest");
    ookla_cmd.args(["--format=json", "--accept-license", "--accept-gdpr"]);
    #[cfg(windows)]
    ookla_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let ookla = ookla_cmd.output().await;

    if let Ok(output) = ookla {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(raw) = serde_json::from_str::<Value>(&stdout) {
                let download = raw["download"]["bandwidth"].as_f64().unwrap_or(0.0);
                let upload = raw["upload"]["bandwidth"].as_f64().unwrap_or(0.0);
                let ping = raw["ping"]["latency"].as_f64().unwrap_or(0.0);
                let server_name = raw["server"]["name"].as_str().unwrap_or("");
                let server_location = raw["server"]["location"].as_str().unwrap_or("");
                let server = if server_location.is_empty() {
                    server_name.to_string()
                } else {
                    format!("{} - {}", server_name, server_location)
                };
                return Ok(serde_json::json!({
                    "success": true,
                    "data": {
                        "download": download,
                        "upload": upload,
                        "ping": ping,
                        "server": server,
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                    }
                }));
            }
        }
    }

    // Fallback: built-in HTTP speed test via Cloudflare
    run_builtin_speedtest().await
}

/// Built-in speed test using Cloudflare endpoints.
/// Time-based: downloads/uploads for a fixed duration with parallel connections.
/// IMPORTANT: http1_only() forces HTTP/1.1 — HTTP/2 multiplexes all streams on
/// one TCP connection (shared flow control), which defeats parallel speed testing.
/// HTTP/1.1 = one TCP connection per request = true parallel bandwidth saturation.
async fn run_builtin_speedtest() -> Result<Value, String> {
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::time::{Duration, Instant};

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) PulseDeck/2.0 SpeedTest")
        .http1_only()
        .pool_max_idle_per_host(0)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    // --- Ping test (median of 5 small requests) ---
    let ping = {
        let mut pings = Vec::new();
        for _ in 0..5 {
            let start = Instant::now();
            match client.get("https://speed.cloudflare.com/__down?bytes=1000")
                .send().await
            {
                Ok(resp) if resp.status().is_success() => {
                    let _ = resp.bytes().await;
                    pings.push(start.elapsed().as_millis() as f64);
                }
                Ok(resp) => {
                    log::warn!("Speedtest ping: HTTP {}", resp.status());
                }
                Err(e) => {
                    log::warn!("Speedtest ping error: {}", e);
                }
            }
        }
        if pings.is_empty() {
            return Err("Speed test: impossible de contacter le serveur Cloudflare".into());
        }
        pings.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        pings[pings.len() / 2]
    };

    // --- Download test: 6 parallel connections for ~12 seconds ---
    let download = {
        // Warmup: single 10MB download to estimate connection speed
        let start = Instant::now();
        let warmup_bytes = match client.get("https://speed.cloudflare.com/__down?bytes=10000000")
            .send().await
        {
            Ok(resp) if resp.status().is_success() => {
                match resp.bytes().await {
                    Ok(body) => body.len() as u64,
                    Err(e) => {
                        log::warn!("Speedtest download warmup body error: {}", e);
                        0u64
                    }
                }
            }
            Ok(resp) => {
                log::warn!("Speedtest download warmup: HTTP {}", resp.status());
                0u64
            }
            Err(e) => {
                log::warn!("Speedtest download warmup error: {}", e);
                0u64
            }
        };
        let warmup_elapsed = start.elapsed().as_secs_f64().max(0.01);
        let warmup_speed = warmup_bytes as f64 / warmup_elapsed;
        log::info!("Speedtest warmup: {} bytes in {:.2}s = {:.1} MB/s",
            warmup_bytes, warmup_elapsed, warmup_speed / 1_000_000.0);

        // Per-request chunk size: ~3s at estimated speed, clamped 10-25MB
        let chunk_size = (warmup_speed * 3.0) as usize;
        let chunk_size = chunk_size.clamp(10_000_000, 25_000_000);

        let test_duration = Duration::from_secs(12);
        let stop_flag = std::sync::Arc::new(AtomicBool::new(false));
        let total_bytes = std::sync::Arc::new(AtomicU64::new(0));
        let num_conn: usize = 6;

        let total_start = Instant::now();

        let mut handles = Vec::new();
        for _ in 0..num_conn {
            let c = client.clone();
            let stop = stop_flag.clone();
            let bytes_counter = total_bytes.clone();
            let url = format!("https://speed.cloudflare.com/__down?bytes={}", chunk_size);
            handles.push(tokio::spawn(async move {
                while !stop.load(Ordering::Relaxed) {
                    match c.get(&url).send().await {
                        Ok(resp) if resp.status().is_success() => {
                            // Use bytes() instead of chunk() for reliability on Windows rustls
                            match resp.bytes().await {
                                Ok(body) => {
                                    bytes_counter.fetch_add(body.len() as u64, Ordering::Relaxed);
                                }
                                Err(_) => {
                                    tokio::time::sleep(Duration::from_millis(200)).await;
                                }
                            }
                        }
                        _ => {
                            tokio::time::sleep(Duration::from_millis(500)).await;
                        }
                    }
                }
            }));
        }

        tokio::time::sleep(test_duration).await;
        stop_flag.store(true, Ordering::Relaxed);

        for handle in handles {
            let _ = tokio::time::timeout(Duration::from_secs(5), handle).await;
        }

        let total_time = total_start.elapsed().as_secs_f64().max(0.01);
        let bytes = total_bytes.load(Ordering::Relaxed);
        log::info!("Speedtest download: {} bytes in {:.2}s = {:.1} MB/s",
            bytes, total_time, (bytes as f64 / total_time) / 1_000_000.0);
        bytes as f64 / total_time
    };

    // --- Upload test: 4 parallel connections for ~10 seconds ---
    let upload = {
        // Warmup: single 2MB upload to estimate speed
        let warmup_data = vec![0u8; 2_000_000];
        let start = Instant::now();
        let warmup_ok = match client.post("https://speed.cloudflare.com/__up")
            .body(warmup_data)
            .send().await
        {
            Ok(resp) => resp.status().is_success(),
            Err(e) => {
                log::warn!("Speedtest upload warmup error: {}", e);
                false
            }
        };
        let warmup_elapsed = start.elapsed().as_secs_f64().max(0.01);
        let warmup_speed = if warmup_ok { 2_000_000.0 / warmup_elapsed } else { 500_000.0 };

        // Chunk size: ~2s at estimated speed, clamped 2-10MB (Cloudflare upload limits)
        let chunk_size = (warmup_speed * 2.0) as usize;
        let chunk_size = chunk_size.clamp(2_000_000, 10_000_000);
        let payload: Vec<u8> = vec![0u8; chunk_size];
        // Pre-allocate as Bytes for zero-copy cloning
        let payload_bytes = bytes::Bytes::from(payload);

        let test_duration = Duration::from_secs(10);
        let stop_flag = std::sync::Arc::new(AtomicBool::new(false));
        let total_bytes = std::sync::Arc::new(AtomicU64::new(0));
        let num_conn: usize = 4;

        let total_start = Instant::now();

        let mut handles = Vec::new();
        for _ in 0..num_conn {
            let c = client.clone();
            let stop = stop_flag.clone();
            let bytes_counter = total_bytes.clone();
            let data = payload_bytes.clone();
            let data_len = data.len() as u64;
            handles.push(tokio::spawn(async move {
                while !stop.load(Ordering::Relaxed) {
                    match c.post("https://speed.cloudflare.com/__up")
                        .body(data.clone())
                        .send().await
                    {
                        Ok(resp) if resp.status().is_success() => {
                            bytes_counter.fetch_add(data_len, Ordering::Relaxed);
                        }
                        _ => {
                            tokio::time::sleep(Duration::from_millis(500)).await;
                        }
                    }
                }
            }));
        }

        tokio::time::sleep(test_duration).await;
        stop_flag.store(true, Ordering::Relaxed);

        for handle in handles {
            let _ = tokio::time::timeout(Duration::from_secs(5), handle).await;
        }

        let total_time = total_start.elapsed().as_secs_f64().max(0.01);
        let bytes = total_bytes.load(Ordering::Relaxed);
        log::info!("Speedtest upload: {} bytes in {:.2}s = {:.1} MB/s",
            bytes, total_time, (bytes as f64 / total_time) / 1_000_000.0);
        bytes as f64 / total_time
    };

    Ok(serde_json::json!({
        "success": true,
        "data": {
            "download": download,
            "upload": upload,
            "ping": ping,
            "server": "Cloudflare",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }
    }))
}

#[tauri::command]
pub async fn set_gaming_auto(
    worker: State<'_, std::sync::Arc<crate::workers::monitoring_worker::WorkerState>>,
    enabled: bool,
) -> Result<Value, String> {
    *worker.gaming_auto.lock().await = enabled;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn set_gaming_manual(
    worker: State<'_, std::sync::Arc<crate::workers::monitoring_worker::WorkerState>>,
    active: bool,
) -> Result<Value, String> {
    *worker.gaming_manual.lock().await = active;
    if active {
        *worker.mode.lock().await = "gaming".to_string();
    } else {
        *worker.mode.lock().await = "normal".to_string();
    }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn set_monitoring_paused(
    worker: State<'_, std::sync::Arc<crate::workers::monitoring_worker::WorkerState>>,
    paused: bool,
) -> Result<Value, String> {
    *worker.paused.lock().await = paused;
    if paused {
        // Wake up all worker loops immediately — kills in-flight GPU PowerShell via select!/kill_on_drop
        worker.pause_notify.notify_waiters();
    }
    Ok(serde_json::json!({ "success": true }))
}

/// GPU utilization: nvidia-smi (full data) with PDH+WMI fallback
/// Uses spawn + timeout (15s) to prevent process accumulation → OOM
async fn get_gpu_usage() -> Value {
    let default = serde_json::json!({"load": 0, "memUsed": 0, "memTotal": 0, "model": "GPU", "temperatureGpu": 0, "powerDraw": 0});

    let mut cmd = tokio::process::Command::new("powershell.exe");
    cmd.args([
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
            r#"
$defaultJson = '{"load":0,"memUsed":0,"memTotal":0,"model":"GPU","temperatureGpu":0,"powerDraw":0}'
try {
    $nvsmi = & 'nvidia-smi' --query-gpu=name,temperature.gpu,memory.used,memory.total,utilization.gpu,power.draw --format=csv,noheader,nounits 2>$null
    if ($LASTEXITCODE -eq 0 -and $nvsmi) {
        $line = ($nvsmi -split "`n")[0]
        $p = $line.Split(',') | ForEach-Object { $_.Trim() }
        if ($p.Count -ge 6) {
            @{
                model = $p[0]
                temperatureGpu = [int]$p[1]
                memUsed = [int]$p[2]
                memTotal = [int]$p[3]
                load = [double]$p[4]
                powerDraw = [math]::Round([double]$p[5], 0)
            } | ConvertTo-Json -Compress
            return
        }
    }
} catch {}
try {
    $usage = (Get-Counter '\GPU Engine(*engtype_3D*)\Utilization Percentage' -ErrorAction Stop).CounterSamples |
        Measure-Object -Property CookedValue -Sum
    $mem = (Get-Counter '\GPU Process Memory(*)\Dedicated Usage' -ErrorAction Stop).CounterSamples |
        Measure-Object -Property CookedValue -Sum
    $gpus = Get-CimInstance -ClassName Win32_VideoController 2>$null
    $discrete = $gpus | Where-Object {
        $_.Name -notmatch 'Intel|Microsoft Basic|Microsoft Remote' -and
        $_.Name -notmatch '^AMD Radeon\(TM\) Graphics$' -and
        $_.Name -notmatch '^AMD Radeon Graphics$'
    } | Sort-Object AdapterRAM -Descending | Select-Object -First 1
    if (-not $discrete) { $discrete = $gpus | Sort-Object AdapterRAM -Descending | Select-Object -First 1 }
    $gpuName = if ($discrete) { $discrete.Name } else { 'GPU' }
    # Get VRAM from registry (64-bit qwMemorySize) — WMI AdapterRAM is UInt32, overflows for >4GB GPUs
    $gpuVram = 0
    $regPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
    Get-ChildItem $regPath -ErrorAction SilentlyContinue | ForEach-Object {
        $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if ($props.'DriverDesc' -eq $gpuName -and $props.'HardwareInformation.qwMemorySize') {
            $gpuVram = [math]::Round($props.'HardwareInformation.qwMemorySize' / 1MB, 0)
        }
    }
    if ($gpuVram -eq 0 -and $discrete -and $discrete.AdapterRAM -gt 0) {
        $gpuVram = [math]::Round($discrete.AdapterRAM / 1MB, 0)
    }
    @{
        model = $gpuName
        load = [math]::Round($usage.Sum, 1)
        memUsed = [math]::Round($mem.Sum / 1MB, 0)
        memTotal = $gpuVram
        temperatureGpu = 0
        powerDraw = 0
    } | ConvertTo-Json -Compress
} catch {
    $defaultJson
}
"#,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    let child = match cmd.spawn() {
        Ok(child) => child,
        Err(_) => return default,
    };

    // 15s timeout — on timeout, future drops → kill_on_drop kills the process (prevents OOM)
    match tokio::time::timeout(
        tokio::time::Duration::from_secs(15),
        child.wait_with_output(),
    ).await {
        Ok(Ok(output)) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            serde_json::from_str(stdout.trim()).unwrap_or(default)
        }
        Ok(_) => default,
        Err(_) => {
            log::warn!("GPU metrics PowerShell timed out after 15s — process killed");
            default
        }
    }
}
