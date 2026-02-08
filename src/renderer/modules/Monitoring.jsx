import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Cpu, MemoryStick, HardDrive, Thermometer, Activity, Network, Monitor, Settings, ArrowDown, ArrowUp, Wifi, Gauge, Zap, Clock, Bell, BellOff, Play, Loader, Gamepad2 } from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import useModuleConfig from '../hooks/useModuleConfig';
import ModuleSettingsPanel from '../components/ModuleSettingsPanel';
import { useTranslation } from '../i18n';
import './Monitoring.css';

const DEFAULT_WIDGETS = [
  { id: 'cpu' },
  { id: 'network' },
  { id: 'gpu' },
  { id: 'ram' },
  { id: 'disks' },
  { id: 'networkDisks' },
  { id: 'perf' },
  { id: 'speedtest' },
];

const WIDGET_DEFS = {
  cpu: { labelKey: 'monitoring.cpuCores', icon: Cpu },
  network: { labelKey: 'monitoring.network', icon: Wifi },
  gpu: { labelKey: 'monitoring.gpu', icon: Monitor },
  ram: { labelKey: 'monitoring.ram', icon: MemoryStick },
  disks: { labelKey: 'monitoring.localDisks', icon: HardDrive },
  networkDisks: { labelKey: 'monitoring.networkDisks', icon: Network },
  perf: { labelKey: 'monitoring.perfSummary', icon: Gauge },
  speedtest: { labelKey: 'monitoring.speedtest', icon: Zap },
};

// Formater les vitesses réseau
function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024 / 1024 / 1024).toFixed(2)} GB/s`;
}

const DEFAULT_SIZES = { sidebarWidth: 360 };

// Composant mini-graphique pour un cœur CPU — mémoïsé pour éviter les re-renders inutiles
const CoreChart = memo(function CoreChart({ data, coreIndex, currentLoad }) {
  const color = currentLoad > 80 ? '#ef4444' : currentLoad > 50 ? '#f59e0b' : '#6366f1';

  return (
    <div className="core-chart-container">
      <div className="core-chart-header">
        <span className="core-chart-label">CPU {coreIndex}</span>
        <span className="core-chart-value" style={{ color }}>{currentLoad?.toFixed(0)}%</span>
      </div>
      <div className="core-chart">
        <ResponsiveContainer width="100%" height={50}>
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`coreGradient${coreIndex}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={`core${coreIndex}`}
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#coreGradient${coreIndex})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// Composant pour le GPU — mémoïsé
const GpuChart = memo(function GpuChart({ data, gpuInfo, gpuLoad }) {
  const color = '#22c55e';

  return (
    <div className="gpu-section">
      <div className="section-header">
        <Monitor size={18} />
        <span>GPU - {gpuInfo?.model || 'N/A'}</span>
        <span className="gpu-load">{gpuLoad?.toFixed(0) || 0}%</span>
      </div>
      <div className="gpu-chart">
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="gpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="gpuLoad"
              stroke={color}
              strokeWidth={2}
              fill="url(#gpuGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="gpu-stats">
        {gpuInfo?.temperatureGpu > 0 && (
          <div className="gpu-stat">
            <Thermometer size={14} />
            <span>{gpuInfo.temperatureGpu}°C</span>
          </div>
        )}
        {gpuInfo?.memoryTotal > 0 && (
          <div className="gpu-stat">
            <span>VRAM: {(gpuInfo.memoryUsed || 0)} / {gpuInfo.memoryTotal} MB</span>
          </div>
        )}
        {gpuInfo?.powerDraw > 0 && (
          <div className="gpu-stat">
            <span>{gpuInfo.powerDraw}W</span>
          </div>
        )}
      </div>
    </div>
  );
});

// Mini jauge circulaire pour le widget Résumé Performances
const MiniGauge = memo(function MiniGauge({ value, size = 56, strokeWidth = 5, color, label }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / 100, 1);
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="mini-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--bg-tertiary)" strokeWidth={strokeWidth}
        />
        <circle
          className="mini-gauge-fill"
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="mini-gauge-text">
        <span className="mini-gauge-value" style={{ color }}>{Math.round(value)}%</span>
      </div>
      {label && <span className="mini-gauge-label">{label}</span>}
    </div>
  );
});

const DEFAULT_ALERT_CONFIG = {
  cpuTemp: { threshold: 85, enabled: true, notify: false },
  gpuTemp: { threshold: 85, enabled: true, notify: false },
  ramPercent: { threshold: 90, enabled: true, notify: false },
};

function MonitoringModule() {
  const { t } = useTranslation();
  const [staticInfo, setStaticInfo] = useState(null);
  const [lightData, setLightData] = useState(null);   // CPU, RAM
  const [networkData, setNetworkData] = useState(null); // networkStats (séparé)
  const [heavyData, setHeavyData] = useState(null);    // GPU, temp, interfaces
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [gamingMode, setGamingMode] = useState(false);
  const [gamingManual, setGamingManual] = useState(false);
  const historyRef = useRef([]);
  const networkDataRef = useRef(null);
  const { widgets, isVisible, toggleWidget, moveWidget, getSize, setSize, resetConfig } = useModuleConfig('monitoring', DEFAULT_WIDGETS, DEFAULT_SIZES);
  const sidebarWidth = getSize('sidebarWidth', 360);

  // Alertes température
  const [alertConfig, setAlertConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('monitoring_alerts');
      return stored ? JSON.parse(stored) : DEFAULT_ALERT_CONFIG;
    } catch { return DEFAULT_ALERT_CONFIG; }
  });
  const [activeAlerts, setActiveAlerts] = useState({});
  const lastNotifiedRef = useRef({});

  // Speedtest
  const [speedtestResult, setSpeedtestResult] = useState(() => {
    try {
      const stored = localStorage.getItem('monitoring_speedtest');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [speedtestRunning, setSpeedtestRunning] = useState(false);

  // Résoudre les labels i18n des widgets
  const resolvedWidgetDefs = Object.fromEntries(
    Object.entries(WIDGET_DEFS).map(([id, def]) => [id, { ...def, label: t(def.labelKey) }])
  );

  // Charger les données statiques une seule fois au démarrage
  useEffect(() => {
    const loadStaticData = async () => {
      try {
        if (window.electronAPI) {
          const data = await window.electronAPI.getStaticInfo();
          setStaticInfo(data);
        }
      } catch (error) {
        console.error('Erreur chargement données statiques:', error);
      }
    };
    loadStaticData();
  }, []);

  // Pause/Resume le worker selon la visibilité du module
  useEffect(() => {
    // Reprendre le polling quand le module est monté (visible)
    window.electronAPI?.setMonitoringPaused?.(false);
    return () => {
      // Pauser le polling quand on quitte le module
      window.electronAPI?.setMonitoringPaused?.(true);
    };
  }, []);

  // Architecture push — écouter les données du worker (process séparé)
  useEffect(() => {
    if (!window.electronAPI?.onMonitoringData) return;

    window.electronAPI.onMonitoringData((msg) => {
      if (msg.type === 'light') {
        const data = msg.data;
        setLightData(data);
        setLoading(false);

        // Débit réseau depuis les dernières données réseau
        const netStats = networkDataRef.current?.networkStats || [];
        const totalDown = netStats.reduce((sum, n) => sum + Math.max(0, n.rx_sec || 0), 0);
        const totalUp = netStats.reduce((sum, n) => sum + Math.max(0, n.tx_sec || 0), 0);

        // Construire l'entrée historique
        const coreLoads = {};
        data.cpuLoad?.cpus?.forEach((cpu, i) => {
          coreLoads[`core${i}`] = cpu.load;
        });

        const newEntry = {
          time: Date.now(),
          total: data.cpuLoad?.currentLoad || 0,
          netDown: totalDown,
          netUp: totalUp,
          ...coreLoads,
        };

        const lastEntry = historyRef.current[historyRef.current.length - 1];
        newEntry.gpuLoad = lastEntry?.gpuLoad || 0;

        historyRef.current = [...historyRef.current, newEntry].slice(-30);
        setHistory([...historyRef.current]);
      }

      if (msg.type === 'network') {
        networkDataRef.current = msg.data;
        setNetworkData(msg.data);
      }

      if (msg.type === 'heavy') {
        const data = msg.data;
        setHeavyData(data);

        const gpuControllers = data.graphics?.controllers || [];
        const primaryGpu = gpuControllers.reduce((best, gpu) =>
          (gpu.vram || 0) > (best?.vram || 0) ? gpu : best
        , gpuControllers[0]);
        const gpuLoad = primaryGpu?.utilizationGpu || 0;

        if (historyRef.current.length > 0) {
          historyRef.current[historyRef.current.length - 1].gpuLoad = gpuLoad;
          setHistory([...historyRef.current]);
        }
      }

      if (msg.type === 'gaming-mode') {
        setGamingMode(msg.data.active);
        // Si le worker désactive le gaming, vérifier si c'est un retour auto (pas manuel)
        if (!msg.data.active && !msg.data.manual) {
          setGamingManual(false);
        }
      }
    });
  }, []);

  // Vérification des alertes température
  useEffect(() => {
    if (!lightData || !heavyData) return;
    const cpuT = heavyData?.cpuTemp?.main || 0;
    const gpuControllers = heavyData?.graphics?.controllers || [];
    const primaryGpu = gpuControllers.reduce((best, gpu) =>
      (gpu.vram || 0) > (best?.vram || 0) ? gpu : best
    , gpuControllers[0]);
    const gpuT = primaryGpu?.temperatureGpu || 0;
    const ramPct = lightData?.mem ? ((lightData.mem.used / lightData.mem.total) * 100) : 0;
    const now = Date.now();
    const COOLDOWN = 60000;

    const newAlerts = {};
    const checks = [
      { key: 'cpuTemp', value: cpuT, unit: '°C', labelKey: 'monitoring.alertCpuTemp' },
      { key: 'gpuTemp', value: gpuT, unit: '°C', labelKey: 'monitoring.alertGpuTemp' },
      { key: 'ramPercent', value: ramPct, unit: '%', labelKey: 'monitoring.alertRam' },
    ];

    checks.forEach(({ key, value, unit, labelKey }) => {
      const cfg = alertConfig[key];
      if (!cfg?.enabled) return;
      if (value > cfg.threshold) {
        newAlerts[key] = true;
        if (cfg.notify && (!lastNotifiedRef.current[key] || now - lastNotifiedRef.current[key] > COOLDOWN)) {
          lastNotifiedRef.current[key] = now;
          window.electronAPI?.showNotification({
            title: t('monitoring.alertTitle'),
            body: `${t(labelKey)}: ${Math.round(value)}${unit} (${t('monitoring.alertThreshold')}: ${cfg.threshold}${unit})`,
          });
        }
      }
    });
    setActiveAlerts(newAlerts);
  }, [lightData, heavyData, alertConfig, t]);

  const updateAlertConfig = useCallback((key, updates) => {
    setAlertConfig(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...updates } };
      localStorage.setItem('monitoring_alerts', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleGamingManual = useCallback(() => {
    const next = !gamingManual;
    setGamingManual(next);
    if (next) {
      setGamingMode(true);
    }
    window.electronAPI?.setGamingManual?.(next);
  }, [gamingManual]);

  const runSpeedtest = useCallback(async () => {
    if (speedtestRunning) return;
    setSpeedtestRunning(true);
    try {
      const result = await window.electronAPI.runSpeedtest();
      if (result.success) {
        setSpeedtestResult(result.data);
        localStorage.setItem('monitoring_speedtest', JSON.stringify(result.data));
      }
    } catch (error) {
      console.error('Speedtest error:', error);
    } finally {
      setSpeedtestRunning(false);
    }
  }, [speedtestRunning]);

  if (loading || !staticInfo) {
    return (
      <div className="module-placeholder">
        <Activity size={48} className="spinning" />
        <p>{t('monitoring.loadingSystem')}</p>
      </div>
    );
  }

  const cpuCores = lightData?.cpuLoad?.cpus || [];
  const memUsed = lightData?.mem?.used || 0;
  const memTotal = lightData?.mem?.total || 1;
  const memPercent = ((memUsed / memTotal) * 100).toFixed(1);
  const cpuTemp = heavyData?.cpuTemp?.main || 0;

  // GPU depuis les données lourdes
  const gpuControllers = heavyData?.graphics?.controllers || [];
  const discreteGpu = gpuControllers.reduce((best, gpu) =>
    (gpu.vram || 0) > (best?.vram || 0) ? gpu : best
  , gpuControllers[0]);

  // Auto-calculer le nombre de colonnes selon le nombre de cœurs
  const coreCount = cpuCores.length;
  const cpuGridColumns = coreCount <= 4 ? coreCount
    : coreCount <= 8 ? 4
    : coreCount <= 12 ? 4
    : coreCount <= 16 ? 4
    : coreCount <= 24 ? 6
    : 8;

  // Données réseau — networkInterfaces depuis heavy, networkStats depuis polling réseau séparé
  const netStats = networkData?.networkStats || [];
  const netInterfaces = heavyData?.networkInterfaces || [];
  const activeInterfaces = netInterfaces.filter(ni =>
    ni.ip4 && ni.ip4 !== '127.0.0.1' && ni.ip4 !== '' && !ni.internal
  );
  const totalRxSec = netStats.reduce((sum, n) => sum + Math.max(0, n.rx_sec || 0), 0);
  const totalTxSec = netStats.reduce((sum, n) => sum + Math.max(0, n.tx_sec || 0), 0);

  // Séparer disques locaux et réseau
  const allDisks = staticInfo?.disk || [];
  const localDisks = allDisks.filter(d => !d.isNetwork);
  const networkDisks = allDisks.filter(d => d.isNetwork);

  // Renderers pour la sidebar (ordre dynamique)
  const sidebarRenderers = {
    gpu: () => (
      <GpuChart
        key="gpu"
        data={history}
        gpuInfo={discreteGpu}
        gpuLoad={discreteGpu?.utilizationGpu || 0}
      />
    ),
    ram: () => (
      <div key="ram" className="card compact">
        <div className="card-header">
          <MemoryStick size={16} />
          <span className="card-title">RAM</span>
          <span className="card-value-inline">{memPercent}%</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${memPercent > 80 ? 'danger' : memPercent > 60 ? 'warning' : 'accent'}`}
            style={{ width: `${memPercent}%` }}
          />
        </div>
        <div className="card-subtitle">
          {(memUsed / 1024 / 1024 / 1024).toFixed(1)} / {(memTotal / 1024 / 1024 / 1024).toFixed(0)} Go
        </div>
      </div>
    ),
    disks: () => (
      <div key="disks" className="card compact">
        <div className="card-header">
          <HardDrive size={16} />
          <span className="card-title">{t('monitoring.disks')}</span>
        </div>
        <div className="disks-list">
          {localDisks.map((disk, index) => {
            const usedPercent = ((disk.used / disk.size) * 100).toFixed(0);
            return (
              <div
                key={index}
                className="disk-item-compact clickable"
                onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}
              >
                <div className="disk-info-compact">
                  <span className="disk-mount">{disk.mount}</span>
                  <span className="disk-free">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
                </div>
                <div className="progress-bar small">
                  <div
                    className={`progress-fill ${usedPercent > 90 ? 'danger' : usedPercent > 75 ? 'warning' : 'success'}`}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    networkDisks: () => networkDisks.length > 0 ? (
      <div key="networkDisks" className="card compact">
        <div className="card-header">
          <Network size={16} />
          <span className="card-title">{t('monitoring.networkDisks')}</span>
        </div>
        <div className="disks-list">
          {networkDisks.map((disk, index) => {
            const usedPercent = disk.size > 0 ? ((disk.used / disk.size) * 100).toFixed(0) : 0;
            return (
              <div
                key={index}
                className="disk-item-compact clickable"
                onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}
              >
                <div className="disk-info-compact">
                  <span className="disk-mount network">{disk.mount}</span>
                  <span className="disk-free">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
                </div>
                <div className="progress-bar small">
                  <div
                    className={`progress-fill ${usedPercent > 90 ? 'danger' : usedPercent > 75 ? 'warning' : 'success'}`}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null,
    perf: () => {
      const cpuTotalLoad = lightData?.cpuLoad?.currentLoad || 0;
      const gpuLoad = discreteGpu?.utilizationGpu || 0;
      const gpuTemp = discreteGpu?.temperatureGpu || 0;
      const uptimeSec = lightData?.uptime || 0;
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const uptimeStr = `${hours}h ${minutes}m`;
      const cpuColor = cpuTotalLoad > 80 ? '#ef4444' : cpuTotalLoad > 50 ? '#f59e0b' : '#6366f1';
      const gpuColor = gpuLoad > 80 ? '#ef4444' : gpuLoad > 50 ? '#f59e0b' : '#22c55e';
      const hasAlert = activeAlerts.cpuTemp || activeAlerts.gpuTemp || activeAlerts.ramPercent;

      return (
        <div key="perf" className={`card compact perf-summary ${hasAlert ? 'has-alert' : ''}`}>
          <div className="card-header">
            <Gauge size={16} />
            <span className="card-title">{t('monitoring.perfSummary')}</span>
          </div>
          <div className="perf-gauges">
            <MiniGauge value={cpuTotalLoad} color={cpuColor} label="CPU" />
            <MiniGauge value={gpuLoad} color={gpuColor} label="GPU" />
          </div>
          <div className="perf-temps">
            {cpuTemp > 0 && (
              <div className={`perf-temp-item ${activeAlerts.cpuTemp ? 'alert-active' : ''}`}>
                <Thermometer size={12} />
                <span>CPU {cpuTemp}°C</span>
              </div>
            )}
            {gpuTemp > 0 && (
              <div className={`perf-temp-item ${activeAlerts.gpuTemp ? 'alert-active' : ''}`}>
                <Thermometer size={12} />
                <span>GPU {gpuTemp}°C</span>
              </div>
            )}
          </div>
          <div className="perf-uptime">
            <Clock size={12} />
            <span>{t('monitoring.uptime')}: {uptimeStr}</span>
          </div>
        </div>
      );
    },
    speedtest: () => (
      <div key="speedtest" className="card compact speedtest-widget">
        <div className="card-header">
          <Zap size={16} />
          <span className="card-title">{t('monitoring.speedtest')}</span>
          <button
            className="speedtest-run-btn"
            onClick={runSpeedtest}
            disabled={speedtestRunning}
          >
            {speedtestRunning ? <Loader size={14} className="spinning" /> : <Play size={14} />}
            <span>{speedtestRunning ? '...' : t('monitoring.runSpeedtest')}</span>
          </button>
        </div>
        {speedtestResult ? (
          <div className="speedtest-results">
            <div className="speedtest-row">
              <ArrowDown size={14} className="speedtest-icon-down" />
              <span className="speedtest-label">{t('monitoring.download')}</span>
              <span className="speedtest-value">{(speedtestResult.download / 125000).toFixed(1)} Mbps</span>
            </div>
            <div className="speedtest-row">
              <ArrowUp size={14} className="speedtest-icon-up" />
              <span className="speedtest-label">{t('monitoring.upload')}</span>
              <span className="speedtest-value">{(speedtestResult.upload / 125000).toFixed(1)} Mbps</span>
            </div>
            <div className="speedtest-row">
              <Activity size={14} />
              <span className="speedtest-label">Ping</span>
              <span className="speedtest-value">{speedtestResult.ping?.toFixed(0)} ms</span>
            </div>
            <div className="speedtest-meta">
              <span>{speedtestResult.server}</span>
              <span>{new Date(speedtestResult.timestamp).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="speedtest-empty">
            <span>{t('monitoring.noSpeedtest')}</span>
          </div>
        )}
      </div>
    ),
  };

  if (showSettings) {
    return (
      <ModuleSettingsPanel
        title={t('monitoring.widgetsTitle')}
        widgets={widgets}
        widgetDefs={resolvedWidgetDefs}
        onToggle={toggleWidget}
        onMove={moveWidget}
        onClose={() => setShowSettings(false)}
        onReset={resetConfig}
        sizes={[{ key: 'sidebarWidth', label: t('monitoring.rightColumnWidth'), min: 280, max: 500, step: 10, value: sidebarWidth }]}
        onSizeChange={setSize}
      >
        <div className="alert-config-section">
          <h4 className="msp-section-title">{t('monitoring.alertSettings')}</h4>
          {[
            { key: 'cpuTemp', label: t('monitoring.alertCpuTemp'), unit: '°C', min: 50, max: 100 },
            { key: 'gpuTemp', label: t('monitoring.alertGpuTemp'), unit: '°C', min: 50, max: 100 },
            { key: 'ramPercent', label: t('monitoring.alertRam'), unit: '%', min: 50, max: 99 },
          ].map(({ key, label, unit, min, max }) => (
            <div key={key} className="alert-config-row">
              <label className="alert-config-label">
                <input
                  type="checkbox"
                  checked={alertConfig[key].enabled}
                  onChange={() => updateAlertConfig(key, { enabled: !alertConfig[key].enabled })}
                />
                <span>{label}</span>
              </label>
              <div className="alert-config-controls">
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={alertConfig[key].threshold}
                  onChange={(e) => updateAlertConfig(key, { threshold: Number(e.target.value) })}
                  disabled={!alertConfig[key].enabled}
                />
                <span className="alert-config-value">{alertConfig[key].threshold}{unit}</span>
                <button
                  className={`alert-notify-btn ${alertConfig[key].notify ? 'active' : ''}`}
                  onClick={() => updateAlertConfig(key, { notify: !alertConfig[key].notify })}
                  disabled={!alertConfig[key].enabled}
                  title={alertConfig[key].notify ? t('monitoring.notifyOn') : t('monitoring.notifyOff')}
                >
                  {alertConfig[key].notify ? <Bell size={14} /> : <BellOff size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </ModuleSettingsPanel>
    );
  }

  const hasNetwork = isVisible('network');
  const hasCpu = isVisible('cpu');

  return (
    <div
      className={`monitoring-new ${gamingMode ? 'gaming-active' : ''}`}
      style={{
        gridTemplateColumns: `1fr ${sidebarWidth}px`,
        gridTemplateRows: hasNetwork ? '1fr auto' : '1fr',
      }}
    >
      {/* Section CPU avec grille de graphiques */}
      {hasCpu && (
        <div className="cpu-grid-section">
          <div className="section-header-main">
            <Cpu size={20} />
            <span>{staticInfo?.cpu?.brand}</span>
            <span className="total-load">{lightData?.cpuLoad?.currentLoad?.toFixed(1)}%</span>
            {cpuTemp > 0 && (
              <span className={`cpu-temp ${cpuTemp > 80 ? 'danger' : cpuTemp > 60 ? 'warning' : ''}`}>
                <Thermometer size={16} /> {cpuTemp}°C
              </span>
            )}
            <button
              className={`gaming-toggle-btn ${gamingMode ? 'active' : ''}`}
              onClick={toggleGamingManual}
              title={gamingMode ? t('monitoring.gamingModeActive') : t('monitoring.gamingMode')}
            >
              <Gamepad2 size={16} />
            </button>
            <button className="monitoring-settings-btn" onClick={() => setShowSettings(true)} title={t('common.settings')}>
              <Settings size={16} />
            </button>
          </div>

          <div className="cores-grid-charts" style={{ gridTemplateColumns: `repeat(${cpuGridColumns}, 1fr)` }}>
            {cpuCores.map((core, index) => (
              <CoreChart
                key={index}
                data={history}
                coreIndex={index}
                currentLoad={core.load}
              />
            ))}
          </div>
        </div>
      )}

      {/* Si CPU masqué, afficher le bouton settings ailleurs */}
      {!hasCpu && (
        <div className="monitoring-no-cpu">
          <button className="monitoring-settings-btn standalone" onClick={() => setShowSettings(true)} title={t('common.settings')}>
            <Settings size={20} />
          </button>
        </div>
      )}

      {/* Section Réseau — sous le CPU */}
      {hasNetwork && (
        <div className="network-section">
          <div className="network-header">
            <Wifi size={16} />
            <span>{t('monitoring.network')}</span>
            <div className="network-speeds">
              <span className="network-speed down">
                <ArrowDown size={14} />
                {formatSpeed(totalRxSec)}
              </span>
              <span className="network-speed up">
                <ArrowUp size={14} />
                {formatSpeed(totalTxSec)}
              </span>
            </div>
          </div>
          <div className="network-body">
            <div className="network-chart">
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                  <defs>
                    <linearGradient id="netDownGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="netUpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="netDown" stroke="#3b82f6" strokeWidth={1.5} fill="url(#netDownGrad)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="netUp" stroke="#f59e0b" strokeWidth={1.5} fill="url(#netUpGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="network-interfaces">
              {activeInterfaces.map((ni, i) => (
                <div key={i} className="network-interface">
                  <span className="ni-name">{ni.ifaceName || ni.iface}</span>
                  <span className="ni-ip">{ni.ip4}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Colonne droite */}
      <div className="monitoring-sidebar">
        {widgets
          .filter(w => w.id !== 'cpu' && w.id !== 'network' && w.visible && sidebarRenderers[w.id])
          .map(w => sidebarRenderers[w.id]())
        }
      </div>
    </div>
  );
}

export default MonitoringModule;
