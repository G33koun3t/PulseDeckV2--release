const { contextBridge, ipcRenderer } = require('electron');

// Exposer les APIs sécurisées au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Monitoring système
  runSpeedtest: () => ipcRenderer.invoke('run-speedtest'),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  getCpuInfo: () => ipcRenderer.invoke('get-cpu-info'),
  getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
  getDiskInfo: () => ipcRenderer.invoke('get-disk-info'),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getStaticInfo: () => ipcRenderer.invoke('get-static-info'),
  getDynamicInfo: () => ipcRenderer.invoke('get-dynamic-info'),
  getDynamicInfoHeavy: () => ipcRenderer.invoke('get-dynamic-info-heavy'),
  getNetworkStats: () => ipcRenderer.invoke('get-network-stats'),

  // Contrôle de la fenêtre
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // Ouvrir un chemin dans l'explorateur
  openPath: (path) => ipcRenderer.invoke('open-path', path),

  // Google Calendar (ICS)
  fetchGoogleCalendar: (icsUrl) => ipcRenderer.invoke('fetch-google-calendar', icsUrl),

  // Google Calendar API (OAuth2)
  googleAuthStatus: () => ipcRenderer.invoke('google-auth-status'),
  googleAuthStart: () => ipcRenderer.invoke('google-auth-start'),
  googleAuthLogout: () => ipcRenderer.invoke('google-auth-logout'),
  googleCreateEvent: (eventData) => ipcRenderer.invoke('google-create-event', eventData),

  // Home Assistant
  fetchHomeAssistant: (haUrl, token, endpoint) => ipcRenderer.invoke('fetch-home-assistant', haUrl, token, endpoint),
  callHomeAssistantService: (haUrl, token, domain, service, data) => ipcRenderer.invoke('call-home-assistant-service', haUrl, token, domain, service, data),

  // Volume Control
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (volume) => ipcRenderer.invoke('set-volume', volume),
  toggleMute: () => ipcRenderer.invoke('toggle-mute'),
  setMute: (muted) => ipcRenderer.invoke('set-mute', muted),

  // Audio Device Selection
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  setAudioDevice: (deviceId) => ipcRenderer.invoke('set-audio-device', deviceId),

  // Stream Deck / Lanceur
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectImage: () => ipcRenderer.invoke('select-image'),
  exportLauncherConfig: (config) => ipcRenderer.invoke('export-launcher-config', config),
  importLauncherConfig: () => ipcRenderer.invoke('import-launcher-config'),
  saveLauncherButtons: (buttons) => ipcRenderer.invoke('save-launcher-buttons', buttons),
  loadLauncherButtons: () => ipcRenderer.invoke('load-launcher-buttons'),
  systemAction: (actionId) => ipcRenderer.invoke('system-action', actionId),

  // Flux RSS
  fetchRss: (feedUrl) => ipcRenderer.invoke('fetch-rss', feedUrl),

  // Crypto prix
  fetchCryptoPrices: () => ipcRenderer.invoke('fetch-crypto-prices'),

  // Presse-papiers
  clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
  clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),

  // Contrôle média global
  mediaControl: (action) => ipcRenderer.invoke('media-control', action),

  // Licence
  checkLicense: () => ipcRenderer.invoke('check-license'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),

  // Auto-start Windows
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),

  // Screenshots (Outils)
  selectScreenshotFolder: () => ipcRenderer.invoke('select-screenshot-folder'),
  getScreens: () => ipcRenderer.invoke('get-screens'),
  takeScreenshot: (folder, sourceId) => ipcRenderer.invoke('take-screenshot', folder, sourceId),
  listScreenshots: (folder) => ipcRenderer.invoke('list-screenshots', folder),
  getScreenshotThumbnail: (filePath) => ipcRenderer.invoke('get-screenshot-thumbnail', filePath),
  deleteScreenshot: (filePath) => ipcRenderer.invoke('delete-screenshot', filePath),
  openScreenshotFolder: (folder) => ipcRenderer.invoke('open-screenshot-folder', folder),

  // Monitoring worker — push architecture
  onMonitoringData: (callback) => {
    ipcRenderer.on('monitoring-data', (event, msg) => callback(msg));
  },
  setGamingAuto: (enabled) => ipcRenderer.invoke('set-gaming-auto', enabled),
  setGamingManual: (active) => ipcRenderer.invoke('set-gaming-manual', active),
  setMonitoringPaused: (paused) => ipcRenderer.invoke('set-monitoring-paused', paused),

  // Guide utilisateur PDF
  openGuide: (lang) => ipcRenderer.invoke('open-guide', lang),

  // Gestion des écrans
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  setTargetDisplay: (displayId) => ipcRenderer.invoke('set-target-display', displayId),

  // Backup des paramètres (survit aux mises à jour)
  saveAppSettingsBackup: (data) => ipcRenderer.invoke('save-app-settings-backup', data),
  loadAppSettingsBackup: () => ipcRenderer.invoke('load-app-settings-backup'),

  // Backup générique du localStorage (toutes les configs modules)
  saveLocalStorageBackup: (data) => ipcRenderer.invoke('save-local-storage-backup', data),
  loadLocalStorageBackup: () => ipcRenderer.invoke('load-local-storage-backup'),

  // Commandes vocales
  startVoice: (lang) => ipcRenderer.invoke('start-voice', lang),
  stopVoice: () => ipcRenderer.invoke('stop-voice'),
  getVoiceStatus: () => ipcRenderer.invoke('get-voice-status'),
  executeVoiceCommand: (intent) => ipcRenderer.invoke('execute-voice-command', intent),
  parseVoiceCommand: (text, lang) => ipcRenderer.invoke('parse-voice-command', text, lang),
  getVoiceConfig: () => ipcRenderer.invoke('get-voice-config'),
  setVoiceConfig: (config) => ipcRenderer.invoke('set-voice-config', config),
  onVoiceResult: (callback) => {
    ipcRenderer.on('voice-result', (event, data) => callback(data));
  },
  onVoiceStatus: (callback) => {
    ipcRenderer.on('voice-status', (event, data) => callback(data));
  },
  onVoiceObsCommand: (callback) => {
    ipcRenderer.on('voice-obs-command', (event, data) => callback(data));
  },
  sendVoiceAudio: (base64) => ipcRenderer.send('voice-audio-data', base64),

  // Docker
  dockerGetHosts: () => ipcRenderer.invoke('docker-get-hosts'),
  dockerSaveHosts: (hosts) => ipcRenderer.invoke('docker-save-hosts', hosts),
  dockerConnect: (hostId) => ipcRenderer.invoke('docker-connect', hostId),
  dockerDisconnect: (hostId) => ipcRenderer.invoke('docker-disconnect', hostId),
  dockerTestConnection: (config) => ipcRenderer.invoke('docker-test-connection', config),
  dockerListContainers: (hostId) => ipcRenderer.invoke('docker-list-containers', hostId),
  dockerGetStats: (hostId) => ipcRenderer.invoke('docker-get-stats', hostId),
  dockerInspect: (hostId, containerId) => ipcRenderer.invoke('docker-inspect', hostId, containerId),
  dockerLogs: (hostId, containerId, tail) => ipcRenderer.invoke('docker-logs', hostId, containerId, tail),
  dockerAction: (hostId, containerId, action) => ipcRenderer.invoke('docker-action', hostId, containerId, action),
  dockerSelectSshKey: () => ipcRenderer.invoke('docker-select-ssh-key'),

  // Mises à jour automatiques
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },

  // Listeners pour les updates temps réel (legacy)
  onSystemUpdate: (callback) => {
    ipcRenderer.on('system-update', (event, data) => callback(data));
  },
});
