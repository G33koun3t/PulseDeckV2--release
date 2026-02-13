/**
 * voice.js — Moteur de reconnaissance vocale locale (Vosk)
 * Gère : téléchargement modèle, transcription, exécution des commandes.
 * L'audio est capturé côté renderer (getUserMedia) et envoyé via IPC.
 */

const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { parseCommand, normalize } = require('./voice-commands');

let mainWindow = null;
let model = null;
let recognizer = null;
let isListening = false;
let currentLang = 'fr';

// Vosk chargé dynamiquement (module natif)
let vosk = null;

// Modèles Vosk par langue (~40-50 MB chacun)
const VOSK_MODELS = {
  fr: { id: 'vosk-model-small-fr-0.22', url: 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip' },
  en: { id: 'vosk-model-small-en-us-0.15', url: 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip' },
  de: { id: 'vosk-model-small-de-0.15', url: 'https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip' },
  es: { id: 'vosk-model-small-es-0.42', url: 'https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip' },
  pt: { id: 'vosk-model-small-pt-0.3', url: 'https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip' },
  it: { id: 'vosk-model-small-it-0.22', url: 'https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip' },
  nl: { id: 'vosk-model-small-nl-0.22', url: 'https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip' },
  pl: { id: 'vosk-model-small-pl-0.22', url: 'https://alphacephei.com/vosk/models/vosk-model-small-pl-0.22.zip' },
  ja: { id: 'vosk-model-small-ja-0.22', url: 'https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip' },
};

// ========== Utilitaires ==========

function send(channel, data) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  } catch {
    // Window may have been destroyed between check and send
  }
}

function getModelsDir() {
  return path.join(app.getPath('userData'), 'vosk-models');
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'voice-config.json');
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
  } catch {}
}

// ========== Téléchargement modèle ==========

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl) => {
      const protocol = requestUrl.startsWith('https') ? https : http;
      protocol.get(requestUrl, (response) => {
        // Suivre les redirections
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return makeRequest(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(destPath);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes > 0 && onProgress) {
            onProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        });

        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
      }).on('error', reject);
    };
    makeRequest(url);
  });
}

async function extractZip(zipPath, destDir) {
  // Utiliser le module 'extract-zip' s'il est disponible, sinon PowerShell
  try {
    const extractZipModule = require('extract-zip');
    await extractZipModule(zipPath, { dir: destDir });
  } catch {
    // Fallback : PowerShell Expand-Archive
    const { promisify } = require('util');
    const { execFile } = require('child_process');
    const execFileAsync = promisify(execFile);
    await execFileAsync('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
    ], { timeout: 120000 });
  }
}

async function ensureModel(lang) {
  const modelInfo = VOSK_MODELS[lang] || VOSK_MODELS.fr;
  const modelsDir = getModelsDir();
  const modelPath = path.join(modelsDir, modelInfo.id);

  if (fs.existsSync(modelPath)) {
    return modelPath;
  }

  // Créer le dossier modèles si nécessaire
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  send('voice-status', { status: 'downloading-model', percent: 0, lang });

  const zipPath = path.join(modelsDir, `${modelInfo.id}.zip`);
  try {
    // Télécharger
    await downloadFile(modelInfo.url, zipPath, (percent) => {
      send('voice-status', { status: 'downloading-model', percent, lang });
    });

    // Extraire
    send('voice-status', { status: 'extracting-model', lang });
    await extractZip(zipPath, modelsDir);

    // Nettoyer le zip
    try { fs.unlinkSync(zipPath); } catch {}

    send('voice-status', { status: 'model-ready', lang });
    return modelPath;
  } catch (error) {
    // Nettoyer en cas d'erreur
    try { fs.unlinkSync(zipPath); } catch {}
    throw error;
  }
}

// ========== Reconnaissance vocale ==========

async function startListening(lang) {
  if (isListening) return { success: true };

  try {
    send('voice-status', { status: 'initializing' });

    // Charger Vosk à la demande (via wrapper koffi compatible Electron)
    if (!vosk) {
      try {
        vosk = require('./vosk-koffi');
        vosk.setLogLevel(-1);
      } catch (error) {
        console.warn('Vosk (koffi) non disponible:', error.message);
        // Essayer le package vosk original en fallback
        try {
          vosk = require('vosk');
          vosk.setLogLevel(-1);
        } catch (error2) {
          console.warn('Vosk original non disponible, fallback Web Speech API:', error2.message);
          send('voice-status', { status: 'idle' });
          return { success: false, error: error2.message, useWebSpeech: true };
        }
      }
    }

    // Télécharger/vérifier le modèle
    const modelPath = await ensureModel(lang);

    // Charger ou recharger le modèle si la langue a changé
    if (!model || currentLang !== lang) {
      if (model) {
        try { model.free(); } catch {}
      }
      model = new vosk.Model(modelPath);
      currentLang = lang;
    }

    // Créer le recognizer
    recognizer = new vosk.Recognizer({ model, sampleRate: 16000 });
    recognizer.setWords(true);

    isListening = true;
    audioChunkCount = 0;
    console.log('[Voice] Recognizer ready, listening...');
    send('voice-status', { status: 'listening' });
    return { success: true };

  } catch (error) {
    console.error('Voice start error:', error.message);
    send('voice-status', { status: 'error', error: error.message });
    return { success: false, error: error.message };
  }
}

function stopListening() {
  if (!isListening) return { success: true };

  if (recognizer) {
    try {
      const finalResult = recognizer.finalResult();
      if (finalResult.text && finalResult.text.trim()) {
        send('voice-result', { type: 'final', text: finalResult.text.trim() });
      }
      recognizer.free();
    } catch {}
    recognizer = null;
  }

  isListening = false;
  send('voice-status', { status: 'idle' });
  return { success: true };
}

// ========== Réception audio depuis le renderer ==========

let audioChunkCount = 0;

function processAudioData(buffer) {
  if (!recognizer || !isListening) return;
  try {
    // Décoder le base64 envoyé par le renderer (seule sérialisation fiable via contextBridge)
    const buf = typeof buffer === 'string' ? Buffer.from(buffer, 'base64') : Buffer.from(buffer);
    audioChunkCount++;

    if (recognizer.acceptWaveform(buf)) {
      const result = recognizer.result();
      if (result.text && result.text.trim()) {
        send('voice-result', { type: 'final', text: result.text.trim() });
      }
    } else {
      const partial = recognizer.partialResult();
      if (partial.partial && partial.partial.trim()) {
        send('voice-result', { type: 'partial', text: partial.partial.trim() });
      }
    }
  } catch (err) {
    console.error('[Voice] processAudioData error:', err.message);
  }
}

// ========== Exécution des commandes ==========

async function executeIntent(intent) {
  try {
    switch (intent.category) {
      case 'system':
        return await executeSystemAction(intent.action);

      case 'media':
        return await executeMediaAction(intent.action);

      case 'volume':
        return await executeVolumeAction(intent.action, intent.value);

      case 'homeassistant':
        return await executeHAAction(intent);

      case 'obs':
        // OBS est contrôlé depuis le renderer (obs-websocket-js)
        send('voice-obs-command', intent);
        return { success: true, delegated: true };

      default:
        return { success: false, error: 'unknown_intent' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeSystemAction(action) {
  const { promisify } = require('util');
  const { execFile } = require('child_process');
  const execFileAsync = promisify(execFile);

  switch (action) {
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
    default:
      return { success: false, error: 'unknown_system_action' };
  }
  return { success: true };
}

async function executeMediaAction(action) {
  const { promisify } = require('util');
  const { execFile } = require('child_process');
  const execFileAsync = promisify(execFile);

  const mediaKeys = {
    'play-pause': '0xB3',
    'next': '0xB0',
    'prev': '0xB1',
    'stop': '0xB2',
  };

  const vk = mediaKeys[action];
  if (!vk) return { success: false, error: 'unknown_media_action' };

  const psCommand = `
    $sig = '[DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);';
    $t = Add-Type -MemberDefinition $sig -Name 'Win32KeybdEvent' -Namespace 'Win32Functions' -PassThru;
    $t::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero);
    $t::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero);
  `;
  await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand], { timeout: 5000 });
  return { success: true };
}

async function executeVolumeAction(action, value) {
  const loudness = require('loudness');

  switch (action) {
    case 'set':
      if (value !== null && value >= 0 && value <= 100) {
        await loudness.setVolume(value);
      }
      break;
    case 'up': {
      const current = await loudness.getVolume();
      await loudness.setVolume(Math.min(100, current + (value || 10)));
      break;
    }
    case 'down': {
      const current = await loudness.getVolume();
      await loudness.setVolume(Math.max(0, current - (value || 10)));
      break;
    }
    case 'mute':
      const muted = await loudness.getMuted();
      await loudness.setMuted(!muted);
      break;
    default:
      return { success: false, error: 'unknown_volume_action' };
  }
  return { success: true };
}

// Chercher un entity_id HA par friendly_name (fuzzy match)
function findHAEntityByName(states, name, domain) {
  if (!states || !name) return null;
  const norm = normalize(name);

  // 1. Match exact du friendly_name normalisé
  for (const s of states) {
    if (domain && !s.entity_id.startsWith(domain + '.')) continue;
    const fn = normalize(s.attributes?.friendly_name || '');
    if (fn === norm) return s.entity_id;
  }

  // 2. Le friendly_name contient le nom cherché
  for (const s of states) {
    if (domain && !s.entity_id.startsWith(domain + '.')) continue;
    const fn = normalize(s.attributes?.friendly_name || '');
    if (fn.includes(norm)) return s.entity_id;
  }

  // 3. Le nom cherché contient le friendly_name
  for (const s of states) {
    if (domain && !s.entity_id.startsWith(domain + '.')) continue;
    const fn = normalize(s.attributes?.friendly_name || '');
    if (fn && norm.includes(fn)) return s.entity_id;
  }

  // 4. entity_id contient le nom (underscored)
  const underscored = norm.replace(/\s+/g, '_');
  for (const s of states) {
    if (domain && !s.entity_id.startsWith(domain + '.')) continue;
    if (s.entity_id.includes(underscored)) return s.entity_id;
  }

  return null;
}

// Requête HTTP GET vers HA
function haGet(haUrl, haToken, endpoint) {
  return new Promise((resolve) => {
    const url = `${haUrl}${endpoint}`;
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, {
      headers: { 'Authorization': `Bearer ${haToken}` },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function executeHAAction(intent) {
  const config = loadConfig();
  const haUrl = config.haUrl;
  const haToken = config.haToken;

  if (!haUrl || !haToken) {
    return { success: false, error: 'ha_not_configured' };
  }

  // Résoudre l'entité : alias manuel > recherche auto par friendly_name
  const aliases = config.entityAliases || {};
  let entityId = aliases[intent.entity] || null;

  if (!entityId && intent.entity) {
    // Chercher par friendly_name dans les entités HA
    const states = await haGet(haUrl, haToken, '/api/states');
    if (Array.isArray(states)) {
      entityId = findHAEntityByName(states, intent.entity, intent.domain);
    }
  }

  // Dernier recours : utiliser tel quel si ça ressemble à un entity_id
  if (!entityId && intent.entity && intent.entity.includes('.')) {
    entityId = intent.entity;
  }

  if (!entityId) {
    return { success: false, error: `entity_not_found: "${intent.entity}"` };
  }

  const domain = intent.domain || entityId.split('.')[0] || 'light';
  let service = intent.action;
  const serviceData = { entity_id: entityId };

  if (intent.action === 'brightness' && intent.value !== null) {
    service = 'turn_on';
    serviceData.brightness = Math.round((intent.value / 100) * 255);
  }

  const url = `${haUrl}/api/services/${domain}/${service}`;
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${haToken}`,
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300 });
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
    req.write(JSON.stringify(serviceData));
    req.end();
  });
}

// ========== Init & IPC ==========

function initVoice(win) {
  mainWindow = win;
}

function registerVoiceIpc() {
  ipcMain.handle('start-voice', async (_event, lang) => {
    return await startListening(lang || 'fr');
  });

  ipcMain.handle('stop-voice', () => {
    return stopListening();
  });

  ipcMain.handle('get-voice-status', () => {
    return { isListening, currentLang, modelReady: !!model };
  });

  // Réception des données audio depuis le renderer (getUserMedia)
  ipcMain.on('voice-audio-data', (_event, data) => {
    processAudioData(data);
  });

  ipcMain.handle('execute-voice-command', async (_event, intent) => {
    return await executeIntent(intent);
  });

  ipcMain.handle('parse-voice-command', (_event, text, lang) => {
    return parseCommand(text, lang);
  });

  ipcMain.handle('get-voice-config', () => {
    return loadConfig();
  });

  ipcMain.handle('set-voice-config', (_event, config) => {
    saveConfig(config);
    return { success: true };
  });
}

module.exports = { initVoice, registerVoiceIpc, stopListening };
