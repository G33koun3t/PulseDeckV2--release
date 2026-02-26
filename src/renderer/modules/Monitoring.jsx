import { useState, useEffect, useRef, useCallback } from 'react';
import { Cpu, MemoryStick, HardDrive, Thermometer, Network, Monitor, Settings, Wifi, Gauge, Zap, Bell, BellOff, Gamepad2, RotateCcw } from 'lucide-react';
import useModuleConfig from '../hooks/useModuleConfig';
import ModuleSettingsPanel from '../components/ModuleSettingsPanel';
import { useTranslation } from '../i18n';
import { useLicense } from '../contexts/LicenseContext';
import appIcon from '../assets/app-icon.ico';
import { DEFAULT_WIDGET_COLORS } from './monitoring/shared';
import * as CurvesMode from './monitoring/CurvesMode';
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

// Widgets qui ont une couleur secondaire
const DUAL_COLOR_WIDGETS = ['network', 'perf'];

const DEFAULT_SIZES = { sidebarWidth: 360 };

const DEFAULT_ALERT_CONFIG = {
  cpuTemp: { threshold: 85, enabled: true, notify: false },
  gpuTemp: { threshold: 85, enabled: true, notify: false },
  ramPercent: { threshold: 90, enabled: true, notify: false },
};

function MonitoringModule({ isActive }) {
  const { t } = useTranslation();
  const { isFreeMode } = useLicense();
  const [staticInfo, setStaticInfo] = useState(null);
  const [lightData, setLightData] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [heavyData, setHeavyData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [gamingMode, setGamingMode] = useState(false);
  const [gamingManual, setGamingManual] = useState(false);
  const historyRef = useRef([]);
  const networkDataRef = useRef(null);

  const { widgets, isVisible, toggleWidget, moveWidget, getSize, setSize, getExtra, setExtra, resetConfig } = useModuleConfig('monitoring', DEFAULT_WIDGETS, DEFAULT_SIZES);
  const sidebarWidth = getSize('sidebarWidth', 360);

  // Couleurs par widget
  const widgetColors = getExtra('widgetColors', DEFAULT_WIDGET_COLORS);

  const setWidgetColor = useCallback((widgetId, slot, color) => {
    const updated = { ...widgetColors, [widgetId]: { ...widgetColors[widgetId], [slot]: color } };
    setExtra('widgetColors', updated);
  }, [widgetColors, setExtra]);

  const resetColors = useCallback(() => {
    setExtra('widgetColors', DEFAULT_WIDGET_COLORS);
  }, [setExtra]);

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
  const [speedtestError, setSpeedtestError] = useState(null);

  const resolvedWidgetDefs = Object.fromEntries(
    Object.entries(WIDGET_DEFS).map(([id, def]) => [id, { ...def, label: t(def.labelKey) }])
  );

  // Charger les données statiques
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

  // Pause/Resume worker based on module visibility
  useEffect(() => {
    window.electronAPI?.setMonitoringPaused?.(!isActive);
  }, [isActive]);

  // Écouter les données du worker
  useEffect(() => {
    if (!window.electronAPI?.onMonitoringData) return;

    const unlistenPromise = window.electronAPI.onMonitoringData((msg) => {
      if (msg.type === 'light') {
        const data = msg.data;
        setLightData(data);
        setLoading(false);

        const netStats = networkDataRef.current?.networkStats || [];
        const totalDown = netStats.reduce((sum, n) => sum + Math.max(0, n.rx_sec || 0), 0);
        const totalUp = netStats.reduce((sum, n) => sum + Math.max(0, n.tx_sec || 0), 0);

        const coreLoads = {};
        data.cpuLoad?.cpus?.forEach((cpu, i) => { coreLoads[`core${i}`] = cpu.load; });

        const memUsedBytes = data.mem?.used || 0;
        const memTotalBytes = data.mem?.total || 1;
        const ramPct = (memUsedBytes / memTotalBytes) * 100;

        const newEntry = { time: Date.now(), total: data.cpuLoad?.currentLoad || 0, netDown: totalDown, netUp: totalUp, ramPercent: ramPct, ...coreLoads };
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
        const primaryGpu = gpuControllers.reduce((best, gpu) => (gpu.vram || 0) > (best?.vram || 0) ? gpu : best, gpuControllers[0]);
        const gpuLoad = primaryGpu?.utilizationGpu || 0;

        if (historyRef.current.length > 0) {
          const lastIdx = historyRef.current.length - 1;
          historyRef.current[lastIdx] = { ...historyRef.current[lastIdx], gpuLoad };
          setHistory([...historyRef.current]);
        }
      }

      if (msg.type === 'gaming-mode') {
        setGamingMode(msg.data.active);
        if (!msg.data.active && !msg.data.manual) setGamingManual(false);
      }
    });

    return () => {
      unlistenPromise?.then(fn => fn());
    };
  }, []);

  // Alertes température
  useEffect(() => {
    if (!lightData || !heavyData) return;
    const cpuT = heavyData?.cpuTemp?.main || 0;
    const gpuControllers = heavyData?.graphics?.controllers || [];
    const primaryGpu = gpuControllers.reduce((best, gpu) => (gpu.vram || 0) > (best?.vram || 0) ? gpu : best, gpuControllers[0]);
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
    setGamingMode(next);
    window.electronAPI?.setGamingManual?.(next);
  }, [gamingManual]);

  const runSpeedtest = useCallback(async () => {
    if (speedtestRunning) return;
    setSpeedtestRunning(true);
    setSpeedtestError(null);
    try {
      const result = await window.electronAPI.runSpeedtest();
      if (result.success) {
        setSpeedtestResult(result.data);
        localStorage.setItem('monitoring_speedtest', JSON.stringify(result.data));
      } else {
        setSpeedtestError(result.error || 'Speedtest failed');
      }
    } catch (error) {
      setSpeedtestError(error.message || 'Speedtest error');
    } finally {
      setSpeedtestRunning(false);
    }
  }, [speedtestRunning]);

  if (loading || !staticInfo) {
    return (
      <div className="module-placeholder">
        <img src={appIcon} alt="" className="loading-app-icon" />
        <p>{t('monitoring.loadingSystem')}</p>
      </div>
    );
  }

  const cpuCores = lightData?.cpuLoad?.cpus || [];
  const memUsed = lightData?.mem?.used || 0;
  const memTotal = lightData?.mem?.total || 1;
  const memPercent = ((memUsed / memTotal) * 100).toFixed(1);
  const cpuTemp = heavyData?.cpuTemp?.main || 0;

  const gpuControllers = heavyData?.graphics?.controllers || [];
  const discreteGpu = gpuControllers.reduce((best, gpu) => (gpu.vram || 0) > (best?.vram || 0) ? gpu : best, gpuControllers[0]);

  const coreCount = cpuCores.length;
  const cpuGridColumns = coreCount <= 4 ? coreCount : coreCount <= 8 ? 4 : coreCount <= 16 ? 4 : coreCount <= 24 ? 6 : 8;

  const netStats = networkData?.networkStats || [];
  const netInterfaces = heavyData?.networkInterfaces || [];
  const activeInterfaces = netInterfaces.filter(ni => ni.ip4 && ni.ip4 !== '127.0.0.1' && ni.ip4 !== '' && !ni.internal);
  const totalRxSec = netStats.reduce((sum, n) => sum + Math.max(0, n.rx_sec || 0), 0);
  const totalTxSec = netStats.reduce((sum, n) => sum + Math.max(0, n.tx_sec || 0), 0);

  const allDisks = staticInfo?.disk || [];
  const localDisks = allDisks.filter(d => !d.isNetwork);
  const networkDisks = allDisks.filter(d => d.isNetwork);

  const modeProps = { history, discreteGpu, memUsed, memTotal, memPercent, localDisks, networkDisks, lightData, activeAlerts, cpuTemp, speedtestResult, speedtestRunning, speedtestError, runSpeedtest, t, colors: widgetColors, staticInfo };
  const sidebar = CurvesMode.sidebarRenderers(modeProps);

  // Settings
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
        {/* Couleurs par widget */}
        <div className="colors-section">
          <h4 className="msp-section-title">
            {t('monitoring.widgetColors')}
            <button className="colors-reset-btn" onClick={resetColors} title={t('monitoring.resetColors')}>
              <RotateCcw size={14} />
            </button>
          </h4>
          <div className="colors-list">
            {widgets.filter(w => w.visible).map(w => {
              const def = resolvedWidgetDefs[w.id];
              if (!def) return null;
              const hasDual = DUAL_COLOR_WIDGETS.includes(w.id);
              const currentPrimary = widgetColors?.[w.id]?.primary || DEFAULT_WIDGET_COLORS[w.id]?.primary || '#6366f1';
              const currentSecondary = widgetColors?.[w.id]?.secondary || DEFAULT_WIDGET_COLORS[w.id]?.secondary || '#f59e0b';
              return (
                <div key={w.id} className="color-picker-row">
                  <span className="color-picker-label">{def.label}</span>
                  <div className="color-picker-inputs">
                    <label className="color-input-wrap">
                      <input type="color" value={currentPrimary} onChange={(e) => setWidgetColor(w.id, 'primary', e.target.value)} />
                    </label>
                    {hasDual && (
                      <label className="color-input-wrap secondary">
                        <input type="color" value={currentSecondary} onChange={(e) => setWidgetColor(w.id, 'secondary', e.target.value)} />
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alertes */}
        <div className="alert-config-section">
          <h4 className="msp-section-title">{t('monitoring.alertSettings')}</h4>
          {[
            { key: 'cpuTemp', label: t('monitoring.alertCpuTemp'), unit: '°C', min: 50, max: 100 },
            { key: 'gpuTemp', label: t('monitoring.alertGpuTemp'), unit: '°C', min: 50, max: 100 },
            { key: 'ramPercent', label: t('monitoring.alertRam'), unit: '%', min: 50, max: 99 },
          ].map(({ key, label, unit, min, max }) => (
            <div key={key} className="alert-config-row">
              <label className="alert-config-label">
                <input type="checkbox" checked={alertConfig[key].enabled} onChange={() => updateAlertConfig(key, { enabled: !alertConfig[key].enabled })} />
                <span>{label}</span>
              </label>
              <div className="alert-config-controls">
                <input type="range" min={min} max={max} value={alertConfig[key].threshold} onChange={(e) => updateAlertConfig(key, { threshold: Number(e.target.value) })} disabled={!alertConfig[key].enabled} />
                <span className="alert-config-value">{alertConfig[key].threshold}{unit}</span>
                <button className={`alert-notify-btn ${alertConfig[key].notify ? 'active' : ''}`} onClick={() => updateAlertConfig(key, { notify: !alertConfig[key].notify })} disabled={!alertConfig[key].enabled} title={alertConfig[key].notify ? t('monitoring.notifyOn') : t('monitoring.notifyOff')}>
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
      {/* Section CPU */}
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
            {!isFreeMode && (
              <button className={`gaming-toggle-btn ${gamingMode ? 'active' : ''}`} onClick={toggleGamingManual}>
                <Gamepad2 size={14} />
                <span className="gaming-toggle-label">{t('monitoring.gamingMode')}</span>
                <span className={`gaming-toggle-badge ${gamingMode ? 'on' : 'off'}`}>
                  {gamingMode ? t('settings.enabled') : t('settings.disabled')}
                </span>
              </button>
            )}
            <button className="monitoring-settings-btn" onClick={() => setShowSettings(true)} title={t('common.settings')}>
              <Settings size={16} />
            </button>
          </div>
          <CurvesMode.CpuSection cpuCores={cpuCores} history={history} cpuGridColumns={cpuGridColumns} colors={widgetColors} />
        </div>
      )}

      {!hasCpu && (
        <div className="monitoring-no-cpu">
          <button className="monitoring-settings-btn standalone" onClick={() => setShowSettings(true)} title={t('common.settings')}>
            <Settings size={20} />
          </button>
        </div>
      )}

      {/* Section Réseau */}
      {hasNetwork && (
        <CurvesMode.NetworkSection history={history} totalRxSec={totalRxSec} totalTxSec={totalTxSec} activeInterfaces={activeInterfaces} t={t} colors={widgetColors} />
      )}

      {/* Colonne droite */}
      <div className="monitoring-sidebar">
        {widgets
          .filter(w => w.id !== 'cpu' && w.id !== 'network' && w.visible && sidebar[w.id])
          .map(w => sidebar[w.id]())
        }
      </div>
    </div>
  );
}

export default MonitoringModule;
