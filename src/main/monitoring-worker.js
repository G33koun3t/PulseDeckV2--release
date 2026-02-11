/**
 * Monitoring Worker — Process séparé pour la collecte de données capteurs.
 *
 * Architecture push : collecte à fréquence définie, push via IPC vers le main process.
 * Le main process relaye vers le renderer.
 *
 * Avantages :
 * - Crash isolé (ne tue pas l'UI)
 * - Priorité basse gérée par l'OS
 * - Décorrèle collecte et affichage
 */
const os = require('os');
const si = require('systeminformation');

// Intervalles par mode
const INTERVALS = {
  normal: { light: 3000, network: 10000, heavy: 30000 },
  gaming: { light: 10000, network: 30000, heavy: 120000 },
};

const GPU_GAMING_THRESHOLD = 70;
const GAMING_CONSECUTIVE = 2;

let currentMode = 'normal';
let gamingAutoEnabled = true;
let gamingManualActive = false;
let gpuAboveCount = 0;
let gpuBelowCount = 0;
let paused = false; // true quand l'onglet monitoring n'est pas actif

// CPU load natif via os.cpus() — calcul par delta
let previousCpuTimes = null;

function getCpuLoadNative() {
  const cpus = os.cpus();
  const result = { cpus: [], currentLoad: 0 };

  if (!previousCpuTimes) {
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

// GPU metrics cache
let gpuMetricsCache = { utilization: 0, vramUsed: 0, timestamp: 0 };

async function getGpuMetrics() {
  if (Date.now() - gpuMetricsCache.timestamp < 10000) {
    return gpuMetricsCache;
  }
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);
    const path = require('path');
    const scriptPath = process.env.GPU_METRICS_SCRIPT;
    if (!scriptPath) return gpuMetricsCache;
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

// ===== Boucles de collecte =====

function getInterval(type) {
  return INTERVALS[currentMode][type];
}

// Light: CPU + RAM (natif, quasi zéro overhead)
let lightTimeout = null;
async function collectLight() {
  if (!paused) {
    try {
      const cpuLoad = getCpuLoadNative();
      const mem = {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
      };
      process.send({ type: 'light', data: { cpuLoad, mem, uptime: os.uptime() } });
    } catch (err) {
      // Silencieux
    }
  }
  lightTimeout = setTimeout(collectLight, getInterval('light'));
}

// Network: si.networkStats (WMI)
let networkTimeout = null;
async function collectNetwork() {
  if (!paused) {
    try {
      const networkStats = await si.networkStats();
      process.send({ type: 'network', data: { networkStats } });
    } catch (err) {
      // Silencieux
    }
  }
  networkTimeout = setTimeout(collectNetwork, getInterval('network'));
}

// Heavy: GPU, température, interfaces (WMI lourd)
let heavyTimeout = null;
async function collectHeavy() {
  try {
    const [cpuTemp, graphics, networkInterfaces] = await Promise.all([
      si.cpuTemperature(),
      si.graphics(),
      si.networkInterfaces(),
    ]);

    // GPU metrics fallback pour AMD
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

    process.send({ type: 'heavy', data: { cpuTemp, graphics, networkInterfaces } });

    // Détection gaming mode auto (ignorée si mode manuel actif)
    if (gamingAutoEnabled && !gamingManualActive) {
      const gpuLoad = primaryGpu?.utilizationGpu || 0;
      if (gpuLoad > GPU_GAMING_THRESHOLD) {
        gpuAboveCount++;
        gpuBelowCount = 0;
        if (gpuAboveCount >= GAMING_CONSECUTIVE && currentMode !== 'gaming') {
          currentMode = 'gaming';
          process.send({ type: 'gaming-mode', data: { active: true, gpuLoad } });
        }
      } else {
        gpuBelowCount++;
        gpuAboveCount = 0;
        if (gpuBelowCount >= GAMING_CONSECUTIVE && currentMode !== 'normal') {
          currentMode = 'normal';
          process.send({ type: 'gaming-mode', data: { active: false, gpuLoad } });
        }
      }
    }
  } catch (err) {
    // Silencieux
  }
  heavyTimeout = setTimeout(collectHeavy, getInterval('heavy'));
}

// ===== Commandes depuis le main process =====
process.on('message', (msg) => {
  if (msg.type === 'set-gaming-auto') {
    gamingAutoEnabled = msg.enabled;
    if (!msg.enabled && currentMode === 'gaming') {
      // Ne pas désactiver si mode manuel actif
      currentMode = 'normal';
      gpuAboveCount = 0;
      gpuBelowCount = 0;
      process.send({ type: 'gaming-mode', data: { active: false, gpuLoad: 0 } });
    }
  }
  if (msg.type === 'set-gaming-manual') {
    // Mode gaming forcé par l'utilisateur
    gamingManualActive = msg.active;
    if (msg.active) {
      currentMode = 'gaming';
      gpuAboveCount = 0;
      gpuBelowCount = 0;
      process.send({ type: 'gaming-mode', data: { active: true, gpuLoad: 0, manual: true } });
    } else {
      currentMode = 'normal';
      gpuAboveCount = 0;
      gpuBelowCount = 0;
      process.send({ type: 'gaming-mode', data: { active: false, gpuLoad: 0, manual: false } });
    }
  }
  if (msg.type === 'set-paused') {
    paused = msg.paused;
  }
  if (msg.type === 'stop') {
    clearTimeout(lightTimeout);
    clearTimeout(networkTimeout);
    clearTimeout(heavyTimeout);
    process.exit(0);
  }
});

// ===== Démarrage =====
collectLight();
collectNetwork();
collectHeavy();

process.send({ type: 'ready' });
