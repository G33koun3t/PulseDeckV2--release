const { app, BrowserWindow, ipcMain, screen, shell, net, dialog, clipboard, Notification, session, desktopCapturer, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const si = require('systeminformation');
const { exec, execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const loudness = require('loudness');
const RSSParser = require('rss-parser');
const { google } = require('googleapis');
const licenseModule = require('./license');
const guide = require('./guide');
const { initUpdater, registerUpdaterIpc } = require('./updater');
const { initVoice, registerVoiceIpc, stopListening: stopVoiceListening } = require('./voice');
const { initDocker, registerDockerIpc, stopDocker } = require('./docker');
const speedTest = require('speedtest-net');


const rssParser = new RSSParser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 10000,
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:group', 'mediaGroup'],
    ],
  },
});

function extractImageFromHtml(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractMediaUrl(obj) {
  if (!obj) return null;
  // Objet avec $ : { $: { url: '...' } }
  if (obj.$?.url) return obj.$.url;
  // Objet direct : { url: '...' }
  if (obj.url) return obj.url;
  // Tableau
  if (Array.isArray(obj)) {
    for (const el of obj) {
      if (el?.$?.url) return el.$.url;
      if (el?.url) return el.url;
    }
  }
  return null;
}

function extractItemImage(item) {
  // 1. Enclosure (standard RSS)
  if (item.enclosure?.url) return item.enclosure.url;
  // 2. media:content (objet, tableau, ou string)
  const mc = extractMediaUrl(item.mediaContent);
  if (mc) return mc;
  // 3. media:thumbnail
  const mt = extractMediaUrl(item.mediaThumbnail);
  if (mt) return mt;
  // 4. media:group > media:content
  const mg = item.mediaGroup;
  if (mg) {
    const mgUrl = extractMediaUrl(mg['media:content']) || extractMediaUrl(mg.mediaContent);
    if (mgUrl) return mgUrl;
  }
  // 5. Chercher <img> dans content, content:encoded, description, summary
  const htmlImage = extractImageFromHtml(item.content)
    || extractImageFromHtml(item['content:encoded'])
    || extractImageFromHtml(item.description)
    || extractImageFromHtml(item.summary);
  if (htmlImage) return htmlImage;
  // 6. Dernier recours : chercher une URL d'image dans tout le JSON de l'item
  const raw = JSON.stringify(item);
  const imgMatch = raw.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/i);
  return imgMatch ? imgMatch[0] : null;
}

// Résolution des chemins : dev vs production (asar)
function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath);
  }
  return path.join(__dirname, '../../', relativePath);
}

// CPU load natif via os.cpus() — calcul par delta (quasi zéro overhead vs WMI)
let previousCpuTimes = null;

function getCpuLoadNative() {
  const cpus = os.cpus();
  const result = { cpus: [], currentLoad: 0 };

  if (!previousCpuTimes) {
    // Premier appel : pas de delta, retourner 0
    previousCpuTimes = cpus.map(cpu => ({ ...cpu.times }));
    result.cpus = cpus.map(() => ({ load: 0 }));
    return result;
  }

  let totalLoadSum = 0;
  result.cpus = cpus.map((cpu, i) => {
    const prev = previousCpuTimes[i];
    const curr = cpu.times;

    const idleDelta = curr.idle - prev.idle;
    const totalDelta = (curr.user + curr.nice + curr.sys + curr.irq + curr.idle)
                     - (prev.user + prev.nice + prev.sys + prev.irq + prev.idle);

    const load = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
    totalLoadSum += load;
    return { load };
  });

  previousCpuTimes = cpus.map(cpu => ({ ...cpu.times }));
  result.currentLoad = totalLoadSum / cpus.length;
  return result;
}

// GPU metrics via Windows Performance Counters (pour AMD et autres GPU sans nvidia-smi)
let gpuMetricsCache = { utilization: 0, vramUsed: 0, timestamp: 0 };

async function getGpuMetrics() {
  // Cache de 10s pour éviter de spawner trop de processus PowerShell
  if (Date.now() - gpuMetricsCache.timestamp < 10000) {
    return gpuMetricsCache;
  }
  try {
    const scriptPath = getResourcePath('scripts/gpu-metrics.ps1');
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
    ], { timeout: 5000 });
    const data = JSON.parse(stdout.trim());
    gpuMetricsCache = { ...data, timestamp: Date.now() };
    return gpuMetricsCache;
  } catch {
    return gpuMetricsCache;
  }
}

// Google OAuth2 setup
const _GC = 'eyJpbnN0YWxsZWQiOnsiY2xpZW50X2lkIjoiODA3MDM4ODQ3NTkwLXFkbXV0cGNpbWQxZXVrZDJlZmE3cW8wN3NwMTdzdmhtLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwicHJvamVjdF9pZCI6Im1vbml0b3JpbmctNDg2NTA4IiwiYXV0aF91cmkiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20vby9vYXV0aDIvYXV0aCIsInRva2VuX3VyaSI6Imh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjoiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vb2F1dGgyL3YxL2NlcnRzIiwiY2xpZW50X3NlY3JldCI6IkdPQ1NQWC04N01YWTJvWU9NSk9YT0hlRUVGbHNGT3RfVDhNIiwicmVkaXJlY3RfdXJpcyI6WyJodHRwOi8vbG9jYWxob3N0Il19fQ==';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

let oAuth2Client = null;

function getTokenPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'google-tokens.json');
}

function initOAuth2Client() {
  try {
    const credentials = JSON.parse(Buffer.from(_GC, 'base64').toString('utf8'));
    const { client_id, client_secret } = credentials.installed;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3847/callback');

    // Charger les tokens existants
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      oAuth2Client.setCredentials(tokens);
      console.log('Google OAuth2: Tokens chargés');
    }
  } catch (error) {
    console.error('Erreur init OAuth2:', error.message);
  }
}

function saveTokens(tokens) {
  const tokenPath = getTokenPath();
  fs.writeFileSync(tokenPath, JSON.stringify(tokens));
  console.log('Google OAuth2: Tokens sauvegardés');
}

// Parser ICS simple pour Google Calendar
function parseICS(icsData) {
  const events = [];
  const lines = icsData.split(/\r?\n/);
  let currentEvent = null;
  let currentKey = null;
  let currentValue = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Continuation de ligne (commence par espace ou tab)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.substring(1);
      continue;
    }

    // Traiter la ligne précédente si on avait une clé
    if (currentKey && currentEvent) {
      processICSLine(currentEvent, currentKey, currentValue);
    }

    // Nouvelle ligne
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    currentKey = line.substring(0, colonIndex).split(';')[0];
    currentValue = line.substring(colonIndex + 1);

    if (currentKey === 'BEGIN' && currentValue === 'VEVENT') {
      currentEvent = {};
    } else if (currentKey === 'END' && currentValue === 'VEVENT') {
      if (currentEvent && currentEvent.summary) {
        events.push(currentEvent);
      }
      currentEvent = null;
    }
  }

  return events;
}

function processICSLine(event, key, value) {
  switch (key) {
    case 'SUMMARY':
      event.summary = value;
      break;
    case 'DTSTART':
      event.start = parseICSDate(value);
      break;
    case 'DTEND':
      event.end = parseICSDate(value);
      break;
    case 'DESCRIPTION':
      event.description = value.replace(/\\n/g, '\n').replace(/\\,/g, ',');
      break;
    case 'LOCATION':
      event.location = value;
      break;
    case 'UID':
      event.uid = value;
      break;
  }
}

function parseICSDate(dateStr) {
  // Format: 20240204T120000Z ou 20240204
  if (!dateStr) return null;

  // Supprimer le timezone ID si présent
  dateStr = dateStr.replace(/^TZID=[^:]+:/, '');

  if (dateStr.length === 8) {
    // Date seule: YYYYMMDD
    return new Date(
      parseInt(dateStr.substring(0, 4)),
      parseInt(dateStr.substring(4, 6)) - 1,
      parseInt(dateStr.substring(6, 8))
    ).toISOString();
  } else if (dateStr.includes('T')) {
    // Date et heure
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15)) || 0;

    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
    } else {
      return new Date(year, month, day, hour, minute, second).toISOString();
    }
  }
  return null;
}

// Fonction pour récupérer les lecteurs réseau via PowerShell
async function getNetworkDrives() {
  try {
    const scriptPath = getResourcePath('scripts/get-network-drives.ps1');
    const { stdout } = await execAsync(
      `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout: 10000 }
    );

    if (!stdout.trim()) return [];

    const drives = JSON.parse(stdout);
    const driveArray = Array.isArray(drives) ? drives : [drives];

    return driveArray.map(d => ({
      fs: d.DisplayRoot || '',
      mount: d.Name + ':',
      size: d.Size || 0,
      used: d.Used || 0,
      available: d.Free || 0,
      use: d.Size > 0 ? ((d.Used / d.Size) * 100) : 0,
      isNetwork: true,
      type: 'network'
    }));
  } catch (error) {
    console.error('Erreur récupération lecteurs réseau:', error.message);
    return [];
  }
}

let mainWindow;
let monitoringWorker = null;
let ogWorker = null;
let ogRequestId = 0;
const ogPendingRequests = new Map();

function startOgWorker() {
  const { Worker } = require('worker_threads');
  const workerPath = path.join(__dirname, 'og-worker.js');
  ogWorker = new Worker(workerPath);

  ogWorker.on('message', (msg) => {
    if (msg.type === 'og-results' && ogPendingRequests.has(msg.id)) {
      ogPendingRequests.get(msg.id)(msg.results);
      ogPendingRequests.delete(msg.id);
    }
  });

  ogWorker.on('error', (err) => {
    console.error('[OG Worker] Error:', err.message);
  });

  ogWorker.on('exit', (code) => {
    if (code !== 0 && !isQuitting) {
      console.log(`[OG Worker] Exited with code ${code}, restarting...`);
      setTimeout(startOgWorker, 1000);
    }
  });
}

function fetchOgImages(urls) {
  return new Promise((resolve) => {
    if (!ogWorker) {
      resolve([]);
      return;
    }
    const id = ++ogRequestId;
    // Timeout 15s au cas où le worker ne répond pas
    const timeout = setTimeout(() => {
      ogPendingRequests.delete(id);
      resolve([]);
    }, 15000);

    ogPendingRequests.set(id, (results) => {
      clearTimeout(timeout);
      resolve(results);
    });

    ogWorker.postMessage({ type: 'fetch-og-images', id, urls });
  });
}

function startMonitoringWorker() {
  const { fork } = require('child_process');
  const workerPath = path.join(__dirname, 'monitoring-worker.js');

  monitoringWorker = fork(workerPath, [], {
    env: {
      ...process.env,
      GPU_METRICS_SCRIPT: getResourcePath('scripts/gpu-metrics.ps1'),
    },
    silent: true,
  });

  monitoringWorker.on('message', (msg) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Relayer tous les messages du worker vers le renderer
    mainWindow.webContents.send('monitoring-data', msg);
  });

  monitoringWorker.on('exit', (code) => {
    console.log(`Monitoring worker exited with code ${code}`);
    // Redémarrer automatiquement si crash (pas un arrêt volontaire, pas en fermeture)
    if (code !== 0 && !isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      console.log('Restarting monitoring worker...');
      setTimeout(startMonitoringWorker, 2000);
    }
  });

  monitoringWorker.on('error', (err) => {
    console.error('Monitoring worker error:', err);
  });

  // IPC pour contrôler le worker depuis le renderer
  ipcMain.handle('set-gaming-auto', (_event, enabled) => {
    if (monitoringWorker) {
      monitoringWorker.send({ type: 'set-gaming-auto', enabled });
    }
    return enabled;
  });

  ipcMain.handle('set-gaming-manual', (_event, active) => {
    if (monitoringWorker) {
      monitoringWorker.send({ type: 'set-gaming-manual', active });
    }
    return active;
  });

  ipcMain.handle('set-monitoring-paused', (_event, paused) => {
    if (monitoringWorker) {
      monitoringWorker.send({ type: 'set-paused', paused });
    }
    return paused;
  });
}

let isQuitting = false;

function stopMonitoringWorker() {
  if (monitoringWorker) {
    const worker = monitoringWorker;
    monitoringWorker = null;
    try { worker.send({ type: 'stop' }); } catch {}
    // Forcer le kill après 2s si le processus ne s'arrête pas
    const killTimeout = setTimeout(() => {
      try { worker.kill('SIGKILL'); } catch {}
    }, 2000);
    worker.on('exit', () => clearTimeout(killTimeout));
  }
}

// Fichier de préférences écran
function getDisplaySettingsPath() {
  return path.join(app.getPath('userData'), 'display-settings.json');
}

function loadDisplaySettings() {
  try {
    const data = fs.readFileSync(getDisplaySettingsPath(), 'utf8');
    return JSON.parse(data);
  } catch { return {}; }
}

function saveDisplaySettings(settings) {
  fs.writeFileSync(getDisplaySettingsPath(), JSON.stringify(settings, null, 2));
}

// Backup des paramètres d'application (survit aux mises à jour NSIS)
function getAppSettingsBackupPath() {
  return path.join(app.getPath('userData'), 'app-settings-backup.json');
}

function saveAppSettingsBackup(data) {
  try {
    fs.writeFileSync(getAppSettingsBackupPath(), JSON.stringify(data, null, 2));
  } catch {}
}

function loadAppSettingsBackup() {
  try {
    const data = fs.readFileSync(getAppSettingsBackupPath(), 'utf8');
    return JSON.parse(data);
  } catch { return null; }
}

function findTargetDisplay() {
  const displays = screen.getAllDisplays();
  const prefs = loadDisplaySettings();

  // 1. Écran sauvegardé par l'utilisateur (par ID)
  if (prefs.displayId) {
    const saved = displays.find(d => d.id === prefs.displayId);
    if (saved) return saved;
  }

  // 2. Détection auto : chercher un écran secondaire tactile/bar (ultra-wide court)
  const secondary = displays.find(d => {
    const primary = screen.getPrimaryDisplay();
    if (d.id === primary.id) return false;
    // Écrans bar : ratio largeur/hauteur > 2.5 (ex: 2560x720=3.56, 1920x480=4.0)
    const ratio = d.size.width / d.size.height;
    return ratio > 2.5;
  });
  if (secondary) return secondary;

  // 3. Tout écran secondaire (non-primaire)
  const anySecondary = displays.find(d => d.id !== screen.getPrimaryDisplay().id);
  if (anySecondary) return anySecondary;

  // 4. Écran principal par défaut
  return screen.getPrimaryDisplay();
}

function createWindow() {
  const displays = screen.getAllDisplays();
  const targetDisplay = findTargetDisplay();
  const isBarScreen = (targetDisplay.size.width / targetDisplay.size.height) > 2.5;

  console.log('Écrans disponibles:', displays.map(d => `${d.size.width}x${d.size.height} @ (${d.bounds.x}, ${d.bounds.y})`));
  console.log('Écran cible:', `${targetDisplay.size.width}x${targetDisplay.size.height} @ (${targetDisplay.bounds.x}, ${targetDisplay.bounds.y})`);

  // Utiliser toute la surface de l'écran (ignorer la barre des tâches)
  const getAppBounds = (display) => {
    const b = display.bounds;
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  };

  const appBounds = getAppBounds(targetDisplay);

  mainWindow = new BrowserWindow({
    width: appBounds.width,
    height: appBounds.height,
    x: appBounds.x,
    y: appBounds.y,
    frame: false,
    transparent: false,
    resizable: !isBarScreen,
    alwaysOnTop: false,
    skipTaskbar: false,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'monitoring.ico')
      : path.join(__dirname, '../../monitoring.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Handler du protocole local-file:// pour charger les fichiers locaux
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    return net.fetch(`file://${filePath}`);
  });

  // Réajuster la fenêtre quand la barre des tâches est cachée/affichée
  screen.on('display-metrics-changed', (_event, display, changedMetrics) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!changedMetrics.includes('workArea')) return;
    if (display.id !== targetDisplay.id) return;
    const bounds = getAppBounds(display);
    mainWindow.setBounds(bounds);
  });

  // CSP appliquée depuis le main process (plus fiable qu'un meta tag en mode file://)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          " script-src 'self' 'unsafe-inline';" +
          " style-src 'self' 'unsafe-inline';" +
          " img-src 'self' data: https: file:;" +
          " media-src 'self' mediastream: blob:;" +
          " connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com ws://localhost:* ws://127.0.0.1:* https://*.google.com https://*.googleapis.com wss://*.google.com;"
        ],
      },
    });
  });

  // Auto-grant system audio loopback pour le visualiseur audio
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' });
    });
  });

  // En développement, charger depuis Vite
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Enregistrer les handlers IPC
function registerIpcHandlers() {
  ipcMain.handle('get-cpu-info', async () => {
    const cpu = await si.cpu();
    const currentLoad = await si.currentLoad();
    const cpuTemp = await si.cpuTemperature();
    return { cpu, currentLoad, cpuTemp };
  });

  ipcMain.handle('get-memory-info', async () => {
    return await si.mem();
  });

  ipcMain.handle('get-disk-info', async () => {
    return await si.fsSize();
  });

  ipcMain.handle('get-gpu-info', async () => {
    const graphics = await si.graphics();
    return graphics;
  });

  // Données statiques - chargées une seule fois au démarrage
  ipcMain.handle('get-static-info', async () => {
    const [cpu, disk, graphics, blockDevices, networkDrives] = await Promise.all([
      si.cpu(),
      si.fsSize(),
      si.graphics(),
      si.blockDevices(),
      getNetworkDrives()
    ]);

    // Marquer les disques locaux
    const localDisks = disk.map(d => ({
      ...d,
      isNetwork: false,
      type: 'local'
    }));

    // Fusionner disques locaux et réseau (éviter les doublons)
    const networkMounts = networkDrives.map(d => d.mount.toUpperCase());
    const filteredLocalDisks = localDisks.filter(d =>
      !networkMounts.includes(d.mount?.toUpperCase())
    );

    const allDisks = [...filteredLocalDisks, ...networkDrives];

    console.log('Disques détectés:', allDisks.map(d => `${d.mount} (${d.isNetwork ? 'réseau' : 'local'})`));

    return {
      cpu,
      disk: allDisks,
      graphics,
      blockDevices,
    };
  });

  // Données dynamiques LÉGÈRES - rafraîchies fréquemment (toutes les 3s)
  // CPU via os.cpus() natif, RAM via os module — quasi zéro overhead
  ipcMain.handle('get-dynamic-info', async () => {
    const cpuLoad = getCpuLoadNative();
    const mem = {
      total: os.totalmem(),
      used: os.totalmem() - os.freemem(),
      free: os.freemem()
    };
    return { cpuLoad, mem, uptime: os.uptime() };
  });

  // Données réseau — séparé du polling léger (WMI, plus lourd)
  ipcMain.handle('get-network-stats', async () => {
    return await si.networkStats();
  });

  // Données dynamiques LOURDES - rafraîchies rarement (toutes les 30s)
  // GPU, température, interfaces réseau — appels WMI coûteux
  ipcMain.handle('get-dynamic-info-heavy', async () => {
    const [cpuTemp, graphics, networkInterfaces] = await Promise.all([
      si.cpuTemperature(),
      si.graphics(),
      si.networkInterfaces()
    ]);

    // Enrichir les données GPU si systeminformation ne fournit pas utilizationGpu (AMD)
    const primaryGpu = graphics.controllers?.reduce((best, gpu) =>
      (gpu.vram || 0) > (best?.vram || 0) ? gpu : best
    , graphics.controllers?.[0]);

    if (primaryGpu && (primaryGpu.utilizationGpu === undefined || primaryGpu.utilizationGpu === null)) {
      const gpuMetrics = await getGpuMetrics();
      if (primaryGpu) {
        primaryGpu.utilizationGpu = gpuMetrics.utilization;
        primaryGpu.memoryUsed = gpuMetrics.vramUsed;
      }
    }

    return { cpuTemp, graphics, networkInterfaces };
  });


  // Contrôle de la fenêtre
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('close-window', () => {
    mainWindow?.close();
  });

  // Ouvrir un dossier dans l'explorateur Windows
  ipcMain.handle('open-path', async (event, pathToOpen) => {
    try {
      await shell.openPath(pathToOpen);
      return { success: true };
    } catch (error) {
      console.error('Erreur ouverture chemin:', error);
      return { success: false, error: error.message };
    }
  });

  // Récupérer les événements Google Calendar via ICS
  ipcMain.handle('fetch-google-calendar', async (event, icsUrl) => {
    return new Promise((resolve, reject) => {
      const https = require('https');

      https.get(icsUrl, (response) => {
        let data = '';

        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            const events = parseICS(data);
            console.log(`Google Calendar: ${events.length} événements récupérés`);
            resolve({ success: true, events });
          } catch (error) {
            console.error('Erreur parsing ICS:', error);
            resolve({ success: false, error: error.message });
          }
        });
      }).on('error', (error) => {
        console.error('Erreur fetch ICS:', error);
        resolve({ success: false, error: error.message });
      });
    });
  });

  // Home Assistant - Récupérer des données (states, services, etc.)
  ipcMain.handle('fetch-home-assistant', async (event, haUrl, token, endpoint) => {
    return new Promise((resolve) => {
      const url = new URL(`/api/${endpoint}`, haUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 8123),
        path: url.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      const req = httpModule.request(options, (response) => {
        let data = '';

        response.on('data', chunk => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const parsed = JSON.parse(data);
              console.log(`Home Assistant ${endpoint}: ${Array.isArray(parsed) ? parsed.length + ' éléments' : 'OK'}`);
              resolve({ success: true, data: parsed });
            } else {
              console.error(`Home Assistant erreur ${response.statusCode}:`, data);
              resolve({ success: false, error: `Erreur ${response.statusCode}: ${data}` });
            }
          } catch (error) {
            console.error('Erreur parsing Home Assistant:', error);
            resolve({ success: false, error: error.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('Erreur Home Assistant:', error);
        resolve({ success: false, error: error.message });
      });

      req.end();
    });
  });

  // Home Assistant - Appeler un service (toggle light, etc.)
  ipcMain.handle('call-home-assistant-service', async (event, haUrl, token, domain, service, data) => {
    return new Promise((resolve) => {
      const url = new URL(`/api/services/${domain}/${service}`, haUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');
      const postData = JSON.stringify(data);

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 8123),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = httpModule.request(options, (response) => {
        let responseData = '';

        response.on('data', chunk => {
          responseData += chunk;
        });

        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              console.log(`Home Assistant service ${domain}.${service}: OK`);
              resolve({ success: true });
            } else {
              console.error(`Home Assistant service erreur ${response.statusCode}:`, responseData);
              resolve({ success: false, error: `Erreur ${response.statusCode}` });
            }
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      });

      req.on('error', (error) => {
        console.error('Erreur Home Assistant service:', error);
        resolve({ success: false, error: error.message });
      });

      req.write(postData);
      req.end();
    });
  });

  // Volume Control - Récupérer le volume système
  ipcMain.handle('get-volume', async () => {
    try {
      const volume = await loudness.getVolume();
      const muted = await loudness.getMuted();
      return { volume, muted };
    } catch (error) {
      console.error('Erreur get-volume:', error.message);
      return { volume: 0, muted: false, error: error.message };
    }
  });

  // Volume Control - Définir le volume système
  ipcMain.handle('set-volume', async (event, volume) => {
    try {
      await loudness.setVolume(Math.round(volume));
      return { success: true, volume: Math.round(volume) };
    } catch (error) {
      console.error('Erreur set-volume:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Volume Control - Mute/Unmute
  ipcMain.handle('toggle-mute', async () => {
    try {
      const currentMuted = await loudness.getMuted();
      await loudness.setMuted(!currentMuted);
      return { success: true, muted: !currentMuted };
    } catch (error) {
      console.error('Erreur toggle-mute:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Volume Control - Set mute state
  ipcMain.handle('set-mute', async (event, muted) => {
    try {
      await loudness.setMuted(muted);
      return { success: true, muted };
    } catch (error) {
      console.error('Erreur set-mute:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Audio Device Selection - Lister les périphériques de sortie
  ipcMain.handle('get-audio-devices', async () => {
    try {
      const scriptPath = getResourcePath('scripts/audio-devices.ps1');
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-Action', 'list'
      ], { timeout: 10000 });

      if (!stdout.trim()) return { success: false, error: 'No output', devices: [] };

      const devices = JSON.parse(stdout.trim());
      return { success: true, devices };
    } catch (error) {
      console.error('Erreur get-audio-devices:', error.message);
      return { success: false, error: error.message, devices: [] };
    }
  });

  // Audio Device Selection - Changer le périphérique par défaut
  ipcMain.handle('set-audio-device', async (event, deviceId) => {
    try {
      const scriptPath = getResourcePath('scripts/audio-devices.ps1');
      console.log('set-audio-device: deviceId =', deviceId);

      const { stdout, stderr } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-Action', 'set',
        '-DeviceId', deviceId
      ], { timeout: 10000 });

      console.log('set-audio-device: stdout =', stdout.trim());
      if (stderr) console.log('set-audio-device: stderr =', stderr.trim());

      const result = JSON.parse(stdout.trim());
      return result;
    } catch (error) {
      console.error('Erreur set-audio-device:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Stream Deck - Ouvrir un URL/protocole/exe externe
  ipcMain.handle('open-external', async (event, url) => {
    try {
      // Chemin fichier local (C:\...\app.exe, D:\...)
      if (/^[a-zA-Z]:\\/.test(url)) {
        await shell.openPath(url);
      } else {
        await shell.openExternal(url);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Stream Deck - Actions système (shutdown, restart, sleep, lock, vider corbeille)
  ipcMain.handle('system-action', async (event, actionId) => {
    try {
      switch (actionId) {
        case 'shutdown':
          await execFileAsync('shutdown', ['/s', '/t', '0'], { timeout: 5000 });
          break;
        case 'restart':
          await execFileAsync('shutdown', ['/r', '/t', '0'], { timeout: 5000 });
          break;
        case 'sleep':
          await execFileAsync('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], { timeout: 5000 });
          break;
        case 'lock':
          await execFileAsync('rundll32.exe', ['user32.dll,LockWorkStation'], { timeout: 5000 });
          break;
        case 'empty-recycle-bin':
          await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Clear-RecycleBin -Force -ErrorAction SilentlyContinue'], { timeout: 10000 });
          break;
        default:
          return { success: false, error: 'unknown_action' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Stream Deck - Sélectionner une image (icône de bouton)
  ipcMain.handle('select-image', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Choisir une icône',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico', 'webp'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { success: false };
      const filePath = result.filePaths[0];
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', ico: 'image/x-icon', webp: 'image/webp' };
      const base64 = `data:${mimeTypes[ext] || 'image/png'};base64,${buffer.toString('base64')}`;
      return { success: true, image: base64 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Lanceur - Exporter la configuration
  ipcMain.handle('export-launcher-config', async (event, config) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Exporter la configuration du Lanceur',
        defaultPath: 'lanceur-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (result.canceled) return { success: false };
      fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Lanceur - Importer la configuration
  ipcMain.handle('import-launcher-config', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Importer la configuration du Lanceur',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      });
      if (result.canceled) return { success: false };
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      const config = JSON.parse(data);
      // Validation basique
      if (!Array.isArray(config)) {
        return { success: false, error: 'Format invalide' };
      }
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Lanceur - Sauvegarder les boutons sur disque (fiable, pas de limite de taille)
  const launcherConfigPath = path.join(app.getPath('userData'), 'launcher-buttons.json');
  ipcMain.handle('save-launcher-buttons', (_event, buttons) => {
    try {
      fs.writeFileSync(launcherConfigPath, JSON.stringify(buttons), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Erreur sauvegarde lanceur:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-launcher-buttons', () => {
    try {
      if (fs.existsSync(launcherConfigPath)) {
        const data = fs.readFileSync(launcherConfigPath, 'utf8');
        const buttons = JSON.parse(data);
        if (Array.isArray(buttons)) return { success: true, buttons };
      }
      return { success: false };
    } catch (error) {
      console.error('Erreur chargement lanceur:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Flux RSS - Récupérer et parser un flux
  ipcMain.handle('fetch-rss', async (event, feedUrl) => {
    try {
      const feed = await rssParser.parseURL(feedUrl);
      const items = feed.items.slice(0, 20).map(item => ({
        title: item.title,
        link: item.link,
        date: item.pubDate || item.isoDate,
        summary: item.contentSnippet || item.content?.substring(0, 200),
        image: extractItemImage(item),
      }));

      // Fallback og:image via worker thread (non-bloquant pour le thread principal)
      const noImage = items.filter(i => !i.image && i.link);
      if (noImage.length > 0) {
        const urls = noImage.slice(0, 10).map(i => i.link);
        const ogResults = await fetchOgImages(urls);
        const ogMap = new Map(ogResults.filter(r => r.og).map(r => [r.link, r.og]));
        for (const item of items) {
          if (!item.image && ogMap.has(item.link)) {
            item.image = ogMap.get(item.link);
          }
        }
      }

      return { success: true, feed: { title: feed.title, items } };
    } catch (error) {
      console.error(`[RSS] Erreur pour ${feedUrl}:`, error.message);
      return { success: false, error: error.message };
    }
  });

  // Crypto - Prix via CoinGecko API (gratuit, sans clé)
  ipcMain.handle('fetch-crypto-prices', async () => {
    const ids = 'bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,avalanche-2,polkadot,polygon-ecosystem-token';
    const currencies = 'eur,usd,pln,jpy';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currencies}&include_24hr_change=true`;
    try {
      const resp = await net.fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      if (!resp.ok) {
        console.error('[Crypto] HTTP', resp.status, resp.statusText);
        return { success: false, error: `HTTP ${resp.status}` };
      }
      const data = await resp.json();
      // Vérifier que la réponse contient bien des prix (pas une erreur CoinGecko)
      if (data.bitcoin || data.ethereum) {
        return { success: true, data };
      }
      console.error('[Crypto] Réponse inattendue:', JSON.stringify(data).substring(0, 200));
      return { success: false, error: 'Unexpected response' };
    } catch (err) {
      console.error('[Crypto] Erreur:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Presse-papiers - Lire le contenu actuel
  ipcMain.handle('clipboard-read', async () => {
    try {
      const text = clipboard.readText();
      const image = clipboard.readImage();
      const hasImage = !image.isEmpty();
      return {
        success: true,
        text: text || null,
        hasImage,
        imageDataUrl: hasImage ? image.toDataURL() : null,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Presse-papiers - Écrire du texte
  ipcMain.handle('clipboard-write', async (event, text) => {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Contrôle média global - Simulation de touches multimédia Windows
  ipcMain.handle('media-control', async (event, action) => {
    try {
      const keyMap = {
        'play-pause': '0xB3', // VK_MEDIA_PLAY_PAUSE
        'next': '0xB0',       // VK_MEDIA_NEXT_TRACK
        'prev': '0xB1',       // VK_MEDIA_PREV_TRACK
        'stop': '0xB2',       // VK_MEDIA_STOP
      };
      const keyCode = keyMap[action];
      if (!keyCode) return { success: false, error: 'Action inconnue' };

      const script = `
        Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class MediaKey {
            [DllImport("user32.dll")]
            public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
            public const byte KEYEVENTF_EXTENDEDKEY = 0x01;
            public const byte KEYEVENTF_KEYUP = 0x02;
            public static void Press(byte key) {
                keybd_event(key, 0, KEYEVENTF_EXTENDEDKEY, UIntPtr.Zero);
                keybd_event(key, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, UIntPtr.Zero);
            }
        }
"@
        [MediaKey]::Press(${keyCode})
      `;
      await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 5000 });
      return { success: true };
    } catch (error) {
      console.error('Media control error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Google Calendar API - Vérifier le statut de connexion
  ipcMain.handle('google-auth-status', async () => {
    if (!oAuth2Client) {
      return { connected: false, error: 'OAuth2 non initialisé' };
    }

    const tokens = oAuth2Client.credentials;
    if (!tokens || !tokens.access_token) {
      return { connected: false };
    }

    // Vérifier si le token est encore valide
    try {
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
      await calendar.calendarList.list({ maxResults: 1 });
      return { connected: true };
    } catch (error) {
      // Token expiré, essayer de rafraîchir
      if (tokens.refresh_token) {
        try {
          const { credentials } = await oAuth2Client.refreshAccessToken();
          oAuth2Client.setCredentials(credentials);
          saveTokens(credentials);
          return { connected: true };
        } catch (refreshError) {
          return { connected: false, error: 'Token expiré' };
        }
      }
      return { connected: false, error: error.message };
    }
  });

  // Google Calendar API - Lancer l'authentification OAuth2
  ipcMain.handle('google-auth-start', async () => {
    if (!oAuth2Client) {
      return { success: false, error: 'OAuth2 non initialisé. Vérifiez credentials.json' };
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    return new Promise((resolve) => {
      // Créer un serveur HTTP local pour capturer le callback
      const http = require('http');
      const server = http.createServer(async (req, res) => {
        if (req.url.startsWith('/callback')) {
          const url = new URL(req.url, 'http://localhost:3847');
          const code = url.searchParams.get('code');

          if (code) {
            try {
              const { tokens } = await oAuth2Client.getToken(code);
              oAuth2Client.setCredentials(tokens);
              saveTokens(tokens);

              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end('<html><body style="background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h1>Connexion Google reussie ! Vous pouvez fermer cette fenetre.</h1></body></html>');

              server.close();
              resolve({ success: true });
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`<html><body style="background:#1a1a2e;color:#ff6b6b;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h1>Erreur: ${error.message}</h1></body></html>`);

              server.close();
              resolve({ success: false, error: error.message });
            }
          }
        }
      });

      server.listen(3847, () => {
        console.log('OAuth2 callback server on port 3847');
        // Ouvrir le navigateur pour l'authentification
        shell.openExternal(authUrl);
      });

      // Timeout après 2 minutes
      setTimeout(() => {
        server.close();
        resolve({ success: false, error: 'Timeout - authentification annulée' });
      }, 120000);
    });
  });

  // Google Calendar API - Déconnexion
  ipcMain.handle('google-auth-logout', async () => {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    if (oAuth2Client) {
      oAuth2Client.setCredentials({});
    }
    return { success: true };
  });

  // Google Calendar API - Créer un événement
  ipcMain.handle('google-create-event', async (event, eventData) => {
    if (!oAuth2Client || !oAuth2Client.credentials.access_token) {
      return { success: false, error: 'Non connecté à Google' };
    }

    try {
      const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

      const calendarEvent = {
        summary: eventData.title,
        start: {
          dateTime: eventData.startDateTime,
          timeZone: 'Europe/Paris',
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: 'Europe/Paris',
        },
      };

      if (eventData.description) {
        calendarEvent.description = eventData.description;
      }
      if (eventData.location) {
        calendarEvent.location = eventData.location;
      }

      const result = await calendar.events.insert({
        calendarId: 'primary',
        resource: calendarEvent,
      });

      console.log('Google Calendar: Événement créé -', result.data.summary);
      return { success: true, event: result.data };
    } catch (error) {
      console.error('Erreur création événement:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ========== Licence ==========
  ipcMain.handle('check-license', async () => {
    return await licenseModule.checkLicense();
  });

  ipcMain.handle('activate-license', async (event, key) => {
    return await licenseModule.activate(key);
  });

  ipcMain.handle('deactivate-license', async () => {
    return await licenseModule.deactivate();
  });

  ipcMain.handle('get-license-info', () => {
    return licenseModule.getLicenseInfo();
  });

  // Notification système (alertes température)
  ipcMain.handle('show-notification', async (event, { title, body }) => {
    try {
      if (Notification.isSupported()) {
        new Notification({ title, body, silent: false }).show();
        return { success: true };
      }
      return { success: false, error: 'not_supported' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Speedtest
  ipcMain.handle('run-speedtest', async () => {
    try {
      const cancel = speedTest.makeCancel();
      const timeout = setTimeout(() => cancel(), 60000);
      const result = await speedTest({ acceptLicense: true, acceptGdpr: true, cancel });
      clearTimeout(timeout);
      return {
        success: true,
        data: {
          download: result.download.bandwidth,
          upload: result.upload.bandwidth,
          ping: result.ping.latency,
          server: result.server.name,
          timestamp: Date.now(),
        }
      };
    } catch (error) {
      console.error('Speedtest error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Auto-start Windows
  ipcMain.handle('get-autostart', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('set-autostart', (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return enabled;
  });

  // ===== Screenshots (Outils) =====
  ipcMain.handle('select-screenshot-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner le dossier de captures',
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  // Lister les écrans disponibles (avec preview thumbnail)
  ipcMain.handle('get-screens', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 320, height: 180 },
      });
      const displays = screen.getAllDisplays();
      return {
        success: true,
        screens: sources.map((src, i) => {
          const display = displays[i];
          return {
            id: src.id,
            name: src.name,
            thumbnail: src.thumbnail.toDataURL(),
            width: display?.size?.width || 0,
            height: display?.size?.height || 0,
          };
        }),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('take-screenshot', async (_event, folderPath, sourceId) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 3840, height: 2160 },
      });
      if (!sources.length) return { success: false, error: 'No screen source' };

      const source = sourceId
        ? sources.find(s => s.id === sourceId) || sources[0]
        : sources[0];
      const image = source.thumbnail;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `screenshot_${timestamp}.png`;
      const filePath = path.join(folderPath, fileName);

      fs.writeFileSync(filePath, image.toPNG());

      return { success: true, filePath, fileName };
    } catch (error) {
      console.error('Screenshot error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('list-screenshots', async (_event, folderPath) => {
    try {
      if (!fs.existsSync(folderPath)) return [];
      const files = fs.readdirSync(folderPath)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map(name => {
          const filePath = path.join(folderPath, name);
          const stat = fs.statSync(filePath);
          return { name, path: filePath, timestamp: stat.mtimeMs };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
      return files;
    } catch (error) {
      console.error('List screenshots error:', error);
      return [];
    }
  });

  ipcMain.handle('get-screenshot-thumbnail', async (_event, filePath) => {
    try {
      const { nativeImage } = require('electron');
      const img = nativeImage.createFromPath(filePath);
      const resized = img.resize({ width: 320 });
      return resized.toDataURL();
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('delete-screenshot', async (_event, filePath) => {
    try {
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-screenshot-folder', async (_event, folderPath) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Guide utilisateur PDF
  ipcMain.handle('open-guide', async (_event, lang) => {
    try {
      return await guide.generateAndOpenPDF(lang || 'fr');
    } catch (error) {
      console.error('Erreur génération guide:', error);
      return { success: false, error: error.message };
    }
  });

  // Gestion des écrans / displays
  ipcMain.handle('get-displays', () => {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const prefs = loadDisplaySettings();
    const currentId = mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds()).id
      : primary.id;

    return displays.map(d => ({
      id: d.id,
      label: `${d.size.width}x${d.size.height}`,
      width: d.size.width,
      height: d.size.height,
      isPrimary: d.id === primary.id,
      isCurrent: d.id === currentId,
      isSaved: d.id === prefs.displayId,
      scaleFactor: d.scaleFactor,
      bounds: d.bounds,
    }));
  });

  ipcMain.handle('set-target-display', (_event, displayId) => {
    const displays = screen.getAllDisplays();
    const target = displays.find(d => d.id === displayId);
    if (!target) return { success: false, error: 'Display not found' };

    // Sauvegarder la préférence
    saveDisplaySettings({ displayId });

    // Déplacer la fenêtre vers le nouvel écran (toute la surface)
    if (mainWindow && !mainWindow.isDestroyed()) {
      const b = target.bounds;
      const isBarScreen = (target.size.width / target.size.height) > 2.5;
      mainWindow.setResizable(true);
      mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height });
      mainWindow.setResizable(!isBarScreen);
    }

    return { success: true };
  });

  // Backup/restauration des paramètres (survit aux mises à jour NSIS)
  ipcMain.handle('save-app-settings-backup', (_event, data) => {
    saveAppSettingsBackup(data);
    return { success: true };
  });

  ipcMain.handle('load-app-settings-backup', () => {
    return loadAppSettingsBackup();
  });

  // Backup/restauration générique du localStorage (toutes les clés modules)
  const localStorageBackupPath = path.join(app.getPath('userData'), 'local-storage-backup.json');
  ipcMain.handle('save-local-storage-backup', (_event, data) => {
    try {
      fs.writeFileSync(localStorageBackupPath, JSON.stringify(data, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Erreur sauvegarde localStorage:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-local-storage-backup', () => {
    try {
      if (fs.existsSync(localStorageBackupPath)) {
        const data = fs.readFileSync(localStorageBackupPath, 'utf8');
        return { success: true, data: JSON.parse(data) };
      }
      return { success: false };
    } catch (error) {
      console.error('Erreur chargement localStorage backup:', error.message);
      return { success: false, error: error.message };
    }
  });

}

// Protocole personnalisé pour charger les fichiers locaux (previews screenshots, etc.)
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
]);

app.whenReady().then(() => {

  initOAuth2Client();
  registerUpdaterIpc();
  registerVoiceIpc();
  registerDockerIpc();
  registerIpcHandlers();
  createWindow();
  initUpdater(mainWindow);
  initVoice(mainWindow);
  initDocker(mainWindow);
  startMonitoringWorker();
  startOgWorker();
});

app.on('window-all-closed', () => {
  isQuitting = true;
  stopVoiceListening();
  stopDocker();
  stopMonitoringWorker();
  if (ogWorker) {
    try { ogWorker.terminate(); } catch {}
    ogWorker = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
