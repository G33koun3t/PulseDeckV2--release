mod commands;
mod workers;

use commands::monitoring::MonitoringState;
use workers::monitoring_worker::WorkerState;
use tauri::Manager;
use std::sync::Arc;

pub fn run() {
    let worker_state = Arc::new(WorkerState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(MonitoringState::default())
        .manage(worker_state.clone())
        .setup(move |app| {
            // Migrate data from Electron version (one-time)
            migrate_from_electron(app);

            // Position window on ultra-wide display (Xeneon Edge)
            position_on_target_display(app)?;

            // Start background monitoring worker
            workers::monitoring_worker::start_monitoring_worker(
                app.handle().clone(),
                worker_state.clone(),
            );

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Monitoring
            commands::monitoring::get_static_info,
            commands::monitoring::get_dynamic_info,
            commands::monitoring::get_dynamic_info_heavy,
            commands::monitoring::get_network_stats,
            commands::monitoring::run_speedtest,
            commands::monitoring::set_gaming_auto,
            commands::monitoring::set_gaming_manual,
            commands::monitoring::set_monitoring_paused,
            // Volume & Audio
            commands::volume::get_volume,
            commands::volume::set_volume,
            commands::volume::toggle_mute,
            commands::volume::set_mute,
            commands::volume::get_audio_devices,
            commands::volume::set_audio_device,
            // Media control
            commands::media::media_control,
            // Clipboard
            commands::clipboard_cmd::clipboard_read,
            commands::clipboard_cmd::clipboard_write,
            // File operations
            commands::files::select_image,
            commands::files::select_screenshot_folder,
            commands::files::take_screenshot,
            commands::files::list_screenshots,
            commands::files::get_screenshot_thumbnail,
            commands::files::delete_screenshot,
            commands::files::open_screenshot_folder,
            commands::files::open_path,
            // Calendar
            commands::calendar::fetch_google_calendar,
            // Home Assistant
            commands::homeassistant::fetch_home_assistant,
            commands::homeassistant::call_home_assistant_service,
            // News & Crypto
            commands::news::fetch_rss,
            commands::news::fetch_crypto_prices,
            commands::news::fetch_og_images,
            // License
            commands::license::check_license,
            commands::license::activate_license,
            commands::license::deactivate_license,
            commands::license::get_license_info,
            // Settings
            commands::settings::save_app_settings_backup,
            commands::settings::load_app_settings_backup,
            commands::settings::save_local_storage_backup,
            commands::settings::load_local_storage_backup,
            commands::settings::get_app_version,
            // Launcher
            commands::launcher::open_external,
            commands::launcher::save_launcher_buttons,
            commands::launcher::load_launcher_buttons,
            commands::launcher::export_launcher_config,
            commands::launcher::import_launcher_config,
            commands::launcher::system_action,
            // Docker
            commands::docker::docker_get_hosts,
            commands::docker::docker_save_hosts,
            commands::docker::docker_connect,
            commands::docker::docker_disconnect,
            commands::docker::docker_test_connection,
            commands::docker::docker_list_containers,
            commands::docker::docker_get_stats,
            commands::docker::docker_inspect,
            commands::docker::docker_logs,
            commands::docker::docker_action,
            commands::docker::docker_update_container,
            commands::docker::docker_select_ssh_key,
            // Voice
            commands::voice::start_voice,
            commands::voice::stop_voice,
            commands::voice::get_voice_status,
            commands::voice::get_voice_config,
            commands::voice::set_voice_config,
            commands::voice::parse_voice_command,
            commands::voice::execute_voice_command,
            commands::voice::send_voice_audio,
            // Notifications
            commands::notifications::show_notification,
            // System & Display
            commands::system_actions::get_displays,
            commands::system_actions::set_target_display,
            commands::system_actions::get_screens,
            commands::system_actions::minimize_window,
            commands::system_actions::close_window,
            // Guide
            commands::guide::open_guide,
            // Custom Webviews (native windows bypassing X-Frame-Options)
            commands::webview::create_custom_webview,
            commands::webview::destroy_custom_webview,
            commands::webview::set_custom_webview_visibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PulseDeck");
}

/// Find the Xeneon Edge display (ultra-wide ratio > 2.5) and position the window there
fn position_on_target_display(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let monitors: Vec<_> = app.available_monitors()?.into_iter().collect();
    if monitors.is_empty() {
        return Ok(());
    }

    // Try to load saved display preference (by signature: "WxH@X,Y")
    let saved_sig = load_saved_display_signature(app);

    // Find target: saved signature > ultra-wide (non-primary) > any ultra-wide > secondary > primary
    let target_idx = if let Some(sig) = &saved_sig {
        monitors.iter().position(|m| monitor_signature(m) == *sig)
    } else {
        None
    }.or_else(|| {
        // Auto-detect: ultra-wide (ratio > 2.5), prefer non-primary
        let primary_pos = monitors.first().map(|m| *m.position());
        monitors.iter().position(|m| {
            let size = m.size();
            let ratio = size.width as f64 / size.height as f64;
            let is_primary = primary_pos.map(|pp| *m.position() == pp).unwrap_or(false);
            ratio > 2.5 && !is_primary
        }).or_else(|| {
            // Any ultra-wide including primary
            monitors.iter().position(|m| {
                let size = m.size();
                size.width as f64 / size.height as f64 > 2.5
            })
        })
    }).or_else(|| {
        // Fallback: secondary display
        if monitors.len() > 1 { Some(1) } else { None }
    });

    let idx = target_idx.unwrap_or(0);
    if let Some(monitor) = monitors.get(idx) {
        let window = app.get_webview_window("main")
            .ok_or("Main window not found")?;

        let pos = monitor.position();
        let size = monitor.size();

        window.set_position(tauri::Position::Physical(*pos))?;
        window.set_size(tauri::Size::Physical(*size))?;
        window.show()?;
    }

    Ok(())
}

/// Generate a stable signature for a monitor: "WxH@X,Y"
fn monitor_signature(m: &tauri::Monitor) -> String {
    let s = m.size();
    let p = m.position();
    format!("{}x{}@{},{}", s.width, s.height, p.x, p.y)
}

fn load_saved_display_signature(app: &tauri::App) -> Option<String> {
    let path = app.path().app_data_dir().ok()?.join("display-settings.json");
    let content = std::fs::read_to_string(&path).ok()?;
    let data: serde_json::Value = serde_json::from_str(&content).ok()?;
    // New format uses "signature", old Electron format uses "displayId" (ignored)
    data["signature"].as_str().map(|s| s.to_string())
}

/// One-time migration of user data from the Electron version.
/// Copies JSON config files from %APPDATA%/monitoring-dashboard/ to the Tauri data dir.
/// Only runs once: creates a ".migrated" marker file after completion.
fn migrate_from_electron(app: &tauri::App) {
    use std::fs;

    let tauri_dir = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(_) => return,
    };

    // Don't migrate twice
    let marker = tauri_dir.join(".migrated-from-electron");
    if marker.exists() {
        return;
    }

    // Locate the Electron data directory: %APPDATA%/monitoring-dashboard/
    let electron_dir = match dirs::data_dir() {
        Some(appdata) => appdata.join("monitoring-dashboard"),
        None => return,
    };

    if !electron_dir.exists() || !electron_dir.is_dir() {
        // No Electron data to migrate — still mark as done so we don't check every launch
        let _ = fs::create_dir_all(&tauri_dir);
        let _ = fs::write(&marker, "no-data");
        return;
    }

    log::info!("Migrating data from Electron: {:?} -> {:?}", electron_dir, tauri_dir);
    let _ = fs::create_dir_all(&tauri_dir);

    // Files to migrate (only copy if destination doesn't already exist)
    let files = [
        "license.json",
        "app-settings-backup.json",
        "launcher-buttons.json",
        "local-storage-backup.json",
        "docker-hosts.json",
        "voice-config.json",
        "display-settings.json",
    ];

    let mut migrated_count = 0;
    for filename in &files {
        let src = electron_dir.join(filename);
        let dst = tauri_dir.join(filename);

        if src.exists() && !dst.exists() {
            match fs::copy(&src, &dst) {
                Ok(_) => {
                    log::info!("Migrated: {}", filename);
                    migrated_count += 1;
                }
                Err(e) => {
                    log::warn!("Failed to migrate {}: {}", filename, e);
                }
            }
        }
    }

    log::info!("Migration complete: {} files copied", migrated_count);
    let _ = fs::write(&marker, format!("migrated {} files", migrated_count));
}
