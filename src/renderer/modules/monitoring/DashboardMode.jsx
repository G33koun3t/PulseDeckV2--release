import React from 'react';
import { MemoryStick, HardDrive, Network, Monitor, Thermometer, Cpu, Zap, ArrowDown, ArrowUp, Wifi, Activity, Play, Loader } from 'lucide-react';
import { formatSpeed, thresholdColor, HBar, MiniGauge, Sparkline, getWidgetColor } from './shared';

export function CpuSection({ cpuCores, history, colors, lightData, cpuTemp, staticInfo, discreteGpu, totalRxSec, totalTxSec, memUsed, memTotal, memPercent, localDisks, networkDisks, activeInterfaces, activeAlerts, t, speedtestResult, speedtestRunning, speedtestError, runSpeedtest }) {
  const cpuColor = getWidgetColor(colors, 'cpu');
  const gpuColor = getWidgetColor(colors, 'gpu');
  const ramColor = getWidgetColor(colors, 'ram');
  const dlColor = getWidgetColor(colors, 'network', 'primary');
  const ulColor = getWidgetColor(colors, 'network', 'secondary');
  const disksColor = getWidgetColor(colors, 'disks');

  const totalLoad = lightData?.cpuLoad?.currentLoad || 0;
  const gpuLoad = discreteGpu?.utilizationGpu || 0;
  const gpuTemp = discreteGpu?.temperatureGpu || 0;
  const ramPct = parseFloat(memPercent) || 0;
  const uptimeSec = lightData?.uptime || 0;
  const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

  const dlData = history.map(h => h.netDown || 0);
  const ulData = history.map(h => h.netUp || 0);

  return (
    <div className="dash-tiles-section">
      <div className="dash-tiles-grid">
        {/* CPU Tile */}
        <div className="dash-tile">
          <div className="dash-tile-header">
            <Cpu size={14} />
            <span className="dash-tile-title">CPU</span>
            <span className="dash-tile-value" style={{ color: thresholdColor(totalLoad, cpuColor) }}>{totalLoad.toFixed(0)}%</span>
          </div>
          <HBar value={totalLoad} color={thresholdColor(totalLoad, cpuColor)} />
          <span className="dash-tile-sub">{staticInfo?.cpu?.brand}</span>
          {cpuTemp > 0 && <span className="dash-tile-detail"><Thermometer size={11} /> {cpuTemp}°C</span>}
          <div className="dash-tile-cores">
            {cpuCores.map((core, i) => (
              <div key={i} className="dash-tile-core">
                <span className="dash-tile-core-label">C{i}</span>
                <div className="dash-tile-core-bar">
                  <div className="dash-tile-core-fill" style={{ width: `${Math.min(core.load, 100)}%`, background: thresholdColor(core.load, cpuColor) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GPU Tile */}
        <div className="dash-tile">
          <div className="dash-tile-header">
            <Monitor size={14} />
            <span className="dash-tile-title">GPU</span>
            <span className="dash-tile-value" style={{ color: thresholdColor(gpuLoad, gpuColor) }}>{gpuLoad.toFixed(0)}%</span>
          </div>
          <HBar value={gpuLoad} color={thresholdColor(gpuLoad, gpuColor)} />
          <span className="dash-tile-sub">{discreteGpu?.model || 'N/A'}</span>
          {gpuTemp > 0 && <span className="dash-tile-detail"><Thermometer size={11} /> {gpuTemp}°C</span>}
          {discreteGpu?.memoryTotal > 0 && <span className="dash-tile-detail">VRAM {discreteGpu.memoryUsed || 0}/{discreteGpu.memoryTotal}MB</span>}
          {discreteGpu?.powerDraw > 0 && <span className="dash-tile-detail"><Zap size={11} /> {discreteGpu.powerDraw}W</span>}
        </div>

        {/* RAM Tile */}
        <div className="dash-tile">
          <div className="dash-tile-header">
            <MemoryStick size={14} />
            <span className="dash-tile-title">RAM</span>
            <span className="dash-tile-value" style={{ color: thresholdColor(ramPct, ramColor) }}>{ramPct}%</span>
          </div>
          <HBar value={ramPct} color={thresholdColor(ramPct, ramColor)} />
          <span className="dash-tile-sub">{(memUsed / 1024 / 1024 / 1024).toFixed(1)} / {(memTotal / 1024 / 1024 / 1024).toFixed(0)} Go</span>
        </div>

        {/* Network Tile */}
        <div className="dash-tile">
          <div className="dash-tile-header">
            <Wifi size={14} />
            <span className="dash-tile-title">Network</span>
          </div>
          <div className="dash-tile-net-row">
            <ArrowDown size={14} style={{ color: dlColor }} />
            <span className="dash-tile-net-value" style={{ color: dlColor }}>{formatSpeed(totalRxSec)}</span>
          </div>
          <div className="dash-net-chart"><Sparkline data={dlData} color={dlColor} /></div>
          <div className="dash-tile-net-row">
            <ArrowUp size={14} style={{ color: ulColor }} />
            <span className="dash-tile-net-value" style={{ color: ulColor }}>{formatSpeed(totalTxSec)}</span>
          </div>
          <div className="dash-net-chart"><Sparkline data={ulData} color={ulColor} /></div>
          {activeInterfaces.map((ni, i) => (
            <span key={i} className="dash-tile-detail">{ni.ifaceName || ni.iface}: {ni.ip4}</span>
          ))}
        </div>

        {/* Disks Tile */}
        <div className="dash-tile">
          <div className="dash-tile-header">
            <HardDrive size={14} />
            <span className="dash-tile-title">{t ? t('monitoring.disks') : 'Disques'}</span>
          </div>
          {localDisks.map((disk, i) => {
            const usedPct = (disk.used / disk.size) * 100;
            return (
              <div key={i} className="dash-tile-disk clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
                <span className="dash-tile-disk-label">{disk.mount}</span>
                <div className="dash-tile-disk-bar">
                  <div className="dash-tile-disk-fill" style={{ width: `${Math.min(usedPct, 100)}%`, background: thresholdColor(usedPct, disksColor) }} />
                </div>
                <span className="dash-tile-disk-pct" style={{ color: thresholdColor(usedPct, disksColor) }}>{usedPct.toFixed(0)}%</span>
                <span className="dash-tile-disk-free">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
              </div>
            );
          })}
          {networkDisks.map((disk, i) => {
            const usedPct = disk.size > 0 ? (disk.used / disk.size) * 100 : 0;
            return (
              <div key={`n${i}`} className="dash-tile-disk clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
                <span className="dash-tile-disk-label">{disk.mount}</span>
                <div className="dash-tile-disk-bar">
                  <div className="dash-tile-disk-fill" style={{ width: `${Math.min(usedPct, 100)}%`, background: thresholdColor(usedPct, disksColor) }} />
                </div>
                <span className="dash-tile-disk-pct" style={{ color: thresholdColor(usedPct, disksColor) }}>{usedPct.toFixed(0)}%</span>
                <span className="dash-tile-disk-free">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
              </div>
            );
          })}
        </div>

        {/* Speedtest Tile — full width */}
        <div className="dash-tile dash-tile-full">
          <div className="dash-speedtest-content">
            <div className="dash-tile-header" style={{ flex: 'none' }}>
              <Zap size={14} />
              <span className="dash-tile-title">{t ? t('monitoring.speedtest') : 'Speedtest'}</span>
            </div>
            {speedtestResult ? (
              <div className="speedtest-results">
                <div className="speedtest-row"><ArrowDown size={13} className="speedtest-icon-down" /><span className="speedtest-label">{t('monitoring.download')}</span><span className="speedtest-value">{(speedtestResult.download / 125000).toFixed(1)} Mbps</span></div>
                <div className="speedtest-row"><ArrowUp size={13} className="speedtest-icon-up" /><span className="speedtest-label">{t('monitoring.upload')}</span><span className="speedtest-value">{(speedtestResult.upload / 125000).toFixed(1)} Mbps</span></div>
                <div className="speedtest-row"><Activity size={13} /><span className="speedtest-label">Ping</span><span className="speedtest-value">{speedtestResult.ping?.toFixed(0)} ms</span></div>
              </div>
            ) : (
              <div className="dash-speedtest-content speedtest-empty"><span>{t ? t('monitoring.noSpeedtest') : 'Aucun test'}</span>{speedtestError && <span className="speedtest-error">{speedtestError}</span>}</div>
            )}
            <button className="speedtest-run-btn" onClick={runSpeedtest} disabled={speedtestRunning}>
              {speedtestRunning ? <Loader size={13} className="spinning" /> : <Play size={13} />}
              <span>{speedtestRunning ? '...' : (t ? t('monitoring.runSpeedtest') : 'Lancer')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NetworkSection() {
  // Network is merged into the tiles grid
  return null;
}

export function sidebarRenderers(props) {
  const { discreteGpu, memUsed, memTotal, memPercent, localDisks, networkDisks, lightData, activeAlerts, cpuTemp, speedtestResult, speedtestRunning, speedtestError, runSpeedtest, t, colors } = props;

  return {
    // Everything is in the tiles — no sidebar needed
    gpu: () => null,
    ram: () => null,
    disks: () => null,
    networkDisks: () => null,
    perf: () => null,
    speedtest: () => null,
  };
}
