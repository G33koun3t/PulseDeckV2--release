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
  systemAction: (actionId) => ipcRenderer.invoke('system-action', actionId),

  // Flux RSS
  fetchRss: (feedUrl) => ipcRenderer.invoke('fetch-rss', feedUrl),

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
  takeScreenshot: (folder) => ipcRenderer.invoke('take-screenshot', folder),
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

  // Listeners pour les updates temps réel (legacy)
  onSystemUpdate: (callback) => {
    ipcRenderer.on('system-update', (event, data) => callback(data));
  },
});
