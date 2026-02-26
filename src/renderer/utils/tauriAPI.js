/**
 * Tauri API Bridge — drop-in replacement for window.electronAPI
 *
 * Maps all Electron IPC calls to Tauri invoke() commands.
 * Import and assign to window.electronAPI in main.jsx for zero-change migration.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { isEnabled, enable, disable } from '@tauri-apps/plugin-autostart';

const tauriAPI = {
  // ===== Monitoring =====
  getStaticInfo: () => invoke('get_static_info'),
  getDynamicInfo: () => invoke('get_dynamic_info'),
  getDynamicInfoHeavy: () => invoke('get_dynamic_info_heavy'),
  getNetworkStats: () => invoke('get_network_stats'),
  runSpeedtest: () => invoke('run_speedtest'),

  // Legacy single-resource calls (mapped to same commands)
  getCpuInfo: () => invoke('get_static_info'),
  getMemoryInfo: () => invoke('get_dynamic_info'),
  getDiskInfo: () => invoke('get_dynamic_info_heavy'),
  getGpuInfo: () => invoke('get_dynamic_info_heavy'),

  // Monitoring worker push events (returns Promise<UnlistenFn> for cleanup)
  onMonitoringData: (callback) => {
    return listen('monitoring-data', (event) => callback(event.payload));
  },
  setGamingAuto: (enabled) => invoke('set_gaming_auto', { enabled }),
  setGamingManual: (active) => invoke('set_gaming_manual', { active }),
  setMonitoringPaused: (paused) => invoke('set_monitoring_paused', { paused }),

  // ===== Volume & Audio =====
  getVolume: () => invoke('get_volume'),
  setVolume: (volume) => invoke('set_volume', { volume }),
  toggleMute: () => invoke('toggle_mute'),
  setMute: (muted) => invoke('set_mute', { muted }),
  getAudioDevices: () => invoke('get_audio_devices'),
  setAudioDevice: (deviceId) => invoke('set_audio_device', { deviceId }),

  // ===== Media Control =====
  mediaControl: (action) => invoke('media_control', { action }),

  // ===== Clipboard =====
  clipboardRead: () => invoke('clipboard_read'),
  clipboardWrite: (text) => invoke('clipboard_write', { text }),

  // ===== File Operations =====
  selectImage: () => invoke('select_image'),
  selectScreenshotFolder: () => invoke('select_screenshot_folder'),
  takeScreenshot: (folderPath, sourceId) => invoke('take_screenshot', { folderPath, sourceId }),
  listScreenshots: (folderPath) => invoke('list_screenshots', { folderPath }),
  getScreenshotThumbnail: (filePath) => invoke('get_screenshot_thumbnail', { filePath }),
  deleteScreenshot: (filePath) => invoke('delete_screenshot', { filePath }),
  openScreenshotFolder: (folderPath) => invoke('open_screenshot_folder', { folderPath }),
  openPath: (path) => invoke('open_path', { path }),

  // ===== Calendar =====
  fetchGoogleCalendar: (icsUrl) => invoke('fetch_google_calendar', { icsUrl }),

  // ===== Home Assistant =====
  fetchHomeAssistant: (haUrl, token, endpoint, options) =>
    invoke('fetch_home_assistant', {
      haUrl, token, endpoint,
      method: options?.method || null,
      body: options?.body || null,
    }),
  callHomeAssistantService: (haUrl, token, domain, service, data) =>
    invoke('call_home_assistant_service', { haUrl, token, domain, service, data }),

  // ===== News & Crypto =====
  fetchRss: (feedUrl) => invoke('fetch_rss', { feedUrl }),
  fetchCryptoPrices: () => invoke('fetch_crypto_prices'),
  fetchOgImages: (urls) => invoke('fetch_og_images', { urls }),

  // ===== License =====
  checkLicense: () => invoke('check_license'),
  activateLicense: (key) => invoke('activate_license', { key }),
  deactivateLicense: () => invoke('deactivate_license'),
  getLicenseInfo: () => invoke('get_license_info'),

  // ===== Settings & Backup =====
  saveAppSettingsBackup: (data) => invoke('save_app_settings_backup', { data }),
  loadAppSettingsBackup: () => invoke('load_app_settings_backup'),
  saveLocalStorageBackup: (data) => invoke('save_local_storage_backup', { data }),
  loadLocalStorageBackup: () => invoke('load_local_storage_backup'),
  getAppVersion: () => invoke('get_app_version'),

  // ===== Launcher =====
  openExternal: (url) => invoke('open_external', { url }),
  selectImage: () => invoke('select_image'),
  exportLauncherConfig: (config) => invoke('export_launcher_config', { config }),
  importLauncherConfig: () => invoke('import_launcher_config'),
  saveLauncherButtons: (buttons) => invoke('save_launcher_buttons', { buttons }),
  loadLauncherButtons: () => invoke('load_launcher_buttons'),
  systemAction: (actionId) => invoke('system_action', { actionId }),

  // ===== Docker =====
  dockerGetHosts: () => invoke('docker_get_hosts'),
  dockerSaveHosts: (hosts) => invoke('docker_save_hosts', { hosts }),
  dockerConnect: (hostId) => invoke('docker_connect', { hostId }),
  dockerDisconnect: (hostId) => invoke('docker_disconnect', { hostId }),
  dockerTestConnection: (config) => invoke('docker_test_connection', { config }),
  dockerListContainers: (hostId) => invoke('docker_list_containers', { hostId }),
  dockerGetStats: (hostId) => invoke('docker_get_stats', { hostId }),
  dockerInspect: (hostId, containerId) => invoke('docker_inspect', { hostId, containerId }),
  dockerLogs: (hostId, containerId, tail) => invoke('docker_logs', { hostId, containerId, tail }),
  dockerAction: (hostId, containerId, action) => invoke('docker_action', { hostId, containerId, action }),
  dockerUpdateContainer: (hostId, containerId) => invoke('docker_update_container', { hostId, containerId }),
  dockerSelectSshKey: () => invoke('docker_select_ssh_key'),

  // ===== Voice Commands =====
  startVoice: (lang) => invoke('start_voice', { lang }),
  stopVoice: () => invoke('stop_voice'),
  getVoiceStatus: () => invoke('get_voice_status'),
  executeVoiceCommand: (intent) => invoke('execute_voice_command', { intent }),
  parseVoiceCommand: (text, lang) => invoke('parse_voice_command', { text, lang }),
  getVoiceConfig: () => invoke('get_voice_config'),
  setVoiceConfig: (config) => invoke('set_voice_config', { config }),
  sendVoiceAudio: (base64Data) => invoke('send_voice_audio', { base64Data }),
  onVoiceResult: (callback) => {
    return listen('voice-result', (event) => callback(event.payload));
  },
  onVoiceStatus: (callback) => {
    return listen('voice-status', (event) => callback(event.payload));
  },
  onVoiceObsCommand: (callback) => {
    return listen('voice-obs-command', (event) => callback(event.payload));
  },

  // ===== Notifications =====
  showNotification: (options) => invoke('show_notification', { options }),

  // ===== System & Display =====
  getDisplays: () => invoke('get_displays'),
  setTargetDisplay: (displayId) => invoke('set_target_display', { displayId }),
  getScreens: () => invoke('get_screens'),
  minimizeWindow: () => invoke('minimize_window'),
  closeWindow: () => invoke('close_window'),

  // ===== Auto-start (via Tauri plugin) =====
  getAutoStart: async () => {
    try {
      const enabled = await isEnabled();
      return { enabled };
    } catch (e) {
      return { enabled: false };
    }
  },
  setAutoStart: async (enabled) => {
    try {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.toString() };
    }
  },

  // ===== Updates (via Tauri plugin) =====
  checkForUpdates: async () => {
    try {
      const update = await check();
      if (update) {
        return {
          available: true,
          version: update.version,
          notes: update.body,
        };
      }
      return { available: false };
    } catch (e) {
      return { available: false, error: e.toString() };
    }
  },
  quitAndInstall: async () => {
    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
      }
    } catch (e) {
      console.error('Update install failed:', e);
    }
  },
  onUpdateStatus: (callback) => {
    return listen('update-status', (event) => callback(event.payload));
  },

  // ===== Guide =====
  openGuide: (lang) => invoke('open_guide', { lang }),

  // ===== Custom Webviews (native windows bypassing X-Frame-Options) =====
  createCustomWebview: (label, url, offsetX, offsetY, width, height) =>
    invoke('create_custom_webview', { label, url, offsetX, offsetY, width, height }),
  destroyCustomWebview: (label) =>
    invoke('destroy_custom_webview', { label }),
  setCustomWebviewVisibility: (label, visible, offsetX, offsetY, width, height) =>
    invoke('set_custom_webview_visibility', { label, visible, offsetX, offsetY, width, height }),

  // ===== Legacy listeners =====
  onSystemUpdate: (callback) => {
    return listen('system-update', (event) => callback(event.payload));
  },
};

// Utility: convert local file path to asset URL (replaces local-file:///)
tauriAPI.convertFileSrc = convertFileSrc;

export default tauriAPI;
