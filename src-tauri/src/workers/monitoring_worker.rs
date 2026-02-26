use sysinfo::{System, Networks, Disks};
use tauri::Emitter;
use std::sync::Arc;
use tokio::sync::{Mutex, Notify};
use std::net::IpAddr;

/// Shared state between monitoring worker loops and IPC commands
pub struct WorkerState {
    pub paused: Arc<Mutex<bool>>,
    pub gaming_auto: Arc<Mutex<bool>>,
    pub gaming_manual: Arc<Mutex<bool>>,
    pub mode: Arc<Mutex<String>>, // "normal" or "gaming"
    /// Notifies worker loops to wake up immediately on pause (kills in-flight GPU process)
    pub pause_notify: Arc<Notify>,
}

impl Default for WorkerState {
    fn default() -> Self {
        Self {
            paused: Arc::new(Mutex::new(false)),
            gaming_auto: Arc::new(Mutex::new(true)),
            gaming_manual: Arc::new(Mutex::new(false)),
            mode: Arc::new(Mutex::new("normal".to_string())),
            pause_notify: Arc::new(Notify::new()),
        }
    }
}

pub fn start_monitoring_worker(app_handle: tauri::AppHandle, state: Arc<WorkerState>) {
    // Light data loop (CPU + RAM) — 3s normal / 10s gaming
    let app = app_handle.clone();
    let st = state.clone();
    tauri::async_runtime::spawn(async move {
        let mut sys = System::new();
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        loop {
            let paused = *st.paused.lock().await;
            let is_gaming = *st.mode.lock().await == "gaming";
            let interval = if is_gaming { 10 } else { 3 };

            if !paused {
                sys.refresh_cpu_usage();
                sys.refresh_memory();

                let cpus: Vec<serde_json::Value> = sys.cpus().iter().map(|c| {
                    serde_json::json!({ "load": c.cpu_usage() })
                }).collect();
                let current_load = if cpus.is_empty() { 0.0 } else {
                    cpus.iter().map(|c| c["load"].as_f64().unwrap_or(0.0)).sum::<f64>() / cpus.len() as f64
                };

                let data = serde_json::json!({
                    "type": "light",
                    "data": {
                        "cpuLoad": {
                            "cpus": cpus,
                            "currentLoad": current_load,
                        },
                        "mem": {
                            "total": sys.total_memory(),
                            "used": sys.used_memory(),
                            "free": sys.available_memory(),
                        },
                        "uptime": System::uptime(),
                    }
                });

                let _ = app.emit("monitoring-data", &data);
            }

            // Sleep interruptible — wake up immediately on pause signal
            tokio::select! {
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(interval)) => {}
                _ = st.pause_notify.notified() => {}
            }
        }
    });

    // Network data loop — 10s normal / 30s gaming
    let app = app_handle.clone();
    let st = state.clone();
    tauri::async_runtime::spawn(async move {
        let mut networks = Networks::new_with_refreshed_list();
        tokio::time::sleep(tokio::time::Duration::from_secs(4)).await;

        loop {
            let paused = *st.paused.lock().await;
            let is_gaming = *st.mode.lock().await == "gaming";
            let interval = if is_gaming { 30 } else { 10 };

            if !paused {
                networks.refresh();
                let net_stats: Vec<serde_json::Value> = networks.iter().map(|(name, data)| {
                    serde_json::json!({
                        "iface": name,
                        "rx_sec": data.received(),
                        "tx_sec": data.transmitted(),
                        "rx_bytes": data.total_received(),
                        "tx_bytes": data.total_transmitted(),
                    })
                }).collect();

                let data = serde_json::json!({
                    "type": "network",
                    "data": {
                        "networkStats": net_stats,
                    }
                });
                let _ = app.emit("monitoring-data", &data);
            }

            tokio::select! {
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(interval)) => {}
                _ = st.pause_notify.notified() => {}
            }
        }
    });

    // Heavy data loop (GPU, disks, temps) + gaming auto-detection — 30s normal / 120s gaming
    let app = app_handle.clone();
    let st = state.clone();
    tauri::async_runtime::spawn(async move {
        let mut disks = Disks::new_with_refreshed_list();
        let mut gpu_high_count: u32 = 0;
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

        loop {
            let paused = *st.paused.lock().await;
            let is_gaming = *st.mode.lock().await == "gaming";
            let interval = if is_gaming { 120 } else { 30 };

            if !paused {
                disks.refresh();

                // GPU via nvidia-smi or PDH + WMI fallback
                // select! with pause_notify: if pause fires mid-GPU, future drops → kill_on_drop kills PowerShell
                let gpu = tokio::select! {
                    result = get_gpu_usage() => result,
                    _ = st.pause_notify.notified() => {
                        // Paused while GPU was running — PowerShell killed by drop
                        continue;
                    }
                };

                // Re-check pause after GPU (could have been set during select race)
                if *st.paused.lock().await {
                    continue;
                }

                let gpu_load = gpu["load"].as_f64().unwrap_or(0.0);
                let gpu_mem_used = gpu["memUsed"].as_f64().unwrap_or(0.0);
                let gpu_mem_total = gpu["memTotal"].as_i64().unwrap_or(0);
                let gpu_model = gpu["model"].as_str().unwrap_or("GPU").to_string();
                let gpu_temp = gpu["temperatureGpu"].as_i64().unwrap_or(0);
                let gpu_power = gpu["powerDraw"].as_i64().unwrap_or(0);

                let data = serde_json::json!({
                    "type": "heavy",
                    "data": {
                        "cpuTemp": {
                            "main": 0
                        },
                        "graphics": {
                            "controllers": [{
                                "model": gpu_model,
                                "vram": gpu_mem_total,
                                "memoryUsed": gpu_mem_used,
                                "memoryTotal": gpu_mem_total,
                                "utilizationGpu": gpu_load,
                                "temperatureGpu": gpu_temp,
                                "powerDraw": gpu_power,
                            }]
                        },
                        "networkInterfaces": get_network_interfaces(),
                    }
                });
                let _ = app.emit("monitoring-data", &data);

                // Gaming mode auto-detection (GPU > 70% for 2 consecutive checks)
                let gaming_auto = *st.gaming_auto.lock().await;
                let gaming_manual = *st.gaming_manual.lock().await;

                if gaming_auto && !gaming_manual {
                    let current_mode = st.mode.lock().await.clone();

                    if gpu_load > 70.0 {
                        gpu_high_count += 1;
                        if gpu_high_count >= 2 && current_mode != "gaming" {
                            *st.mode.lock().await = "gaming".to_string();
                            let _ = app.emit("monitoring-data", serde_json::json!({
                                "type": "gaming-mode",
                                "data": { "active": true, "gpuLoad": gpu_load, "manual": false }
                            }));
                        }
                    } else {
                        if gpu_high_count > 0 || current_mode == "gaming" {
                            gpu_high_count = 0;
                            if current_mode == "gaming" {
                                *st.mode.lock().await = "normal".to_string();
                                let _ = app.emit("monitoring-data", serde_json::json!({
                                    "type": "gaming-mode",
                                    "data": { "active": false, "gpuLoad": gpu_load, "manual": false }
                                }));
                            }
                        }
                    }
                }
            }

            tokio::select! {
                _ = tokio::time::sleep(tokio::time::Duration::from_secs(interval)) => {}
                _ = st.pause_notify.notified() => {}
            }
        }
    });
}

/// Enumerate network interfaces with IPv4 addresses (via OS API, no process spawning)
fn get_network_interfaces() -> Vec<serde_json::Value> {
    match local_ip_address::list_afinet_netifas() {
        Ok(ifas) => {
            // Group by interface name, keep only IPv4
            let mut seen = std::collections::HashMap::<String, serde_json::Value>::new();
            for (name, addr) in ifas {
                if let IpAddr::V4(ipv4) = addr {
                    let ip_str = ipv4.to_string();
                    let is_internal = ipv4.is_loopback();
                    // Only keep first IPv4 per interface
                    seen.entry(name.clone()).or_insert_with(|| {
                        serde_json::json!({
                            "iface": name,
                            "ifaceName": name,
                            "ip4": ip_str,
                            "internal": is_internal,
                        })
                    });
                }
            }
            seen.into_values().collect()
        }
        Err(_) => Vec::new(),
    }
}

/// GPU utilization: nvidia-smi (full data) with PDH+WMI fallback
/// Uses spawn + timeout (15s) to prevent process accumulation → OOM
async fn get_gpu_usage() -> serde_json::Value {
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
