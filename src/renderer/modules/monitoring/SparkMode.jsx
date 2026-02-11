import React from 'react';
import { MemoryStick, HardDrive, Network, Monitor, Thermometer, Cpu, Gauge, Zap, Clock, ArrowDown, ArrowUp, Wifi, Activity, Play, Loader } from 'lucide-react';
import { formatSpeed, thresholdColor, Sparkline, HBar, getWidgetColor } from './shared';

export function CpuSection({ cpuCores, history, colors, lightData, cpuTemp, staticInfo, discreteGpu, totalRxSec, totalTxSec, memUsed, memTotal, memPercent }) {
  const cpuColor = getWidgetColor(colors, 'cpu');
  const gpuColor = getWidgetColor(colors, 'gpu');
  const ramColor = getWidgetColor(colors, 'ram');
  const disksColor = getWidgetColor(colors, 'disks');

  const totalLoad = lightData?.cpuLoad?.currentLoad || 0;
  const gpuLoad = discreteGpu?.utilizationGpu || 0;
  const gpuTemp = discreteGpu?.temperatureGpu || 0;
  const ramPct = parseFloat(memPercent) || 0;
  const vramUsed = discreteGpu?.memoryUsed || 0;
  const vramTotal = discreteGpu?.memoryTotal || 0;
  const vramPct = vramTotal > 0 ? (vramUsed / vramTotal) * 100 : 0;

  // Sparkline data from history
  const cpuLoadData = history.map(h => h.total || 0);
  const gpuLoadData = history.map(h => h.gpuLoad || 0);
  const ramData = history.map(h => h.ramPercent || 0);

  // Min/max
  const cpuMin = cpuLoadData.length > 0 ? Math.min(...cpuLoadData) : 0;
  const cpuMax = cpuLoadData.length > 0 ? Math.max(...cpuLoadData) : 0;
  const gpuMin = gpuLoadData.length > 0 ? Math.min(...gpuLoadData) : 0;
  const gpuMax = gpuLoadData.length > 0 ? Math.max(...gpuLoadData) : 0;
  const ramMin = ramData.length > 0 ? Math.min(...ramData) : 0;
  const ramMax = ramData.length > 0 ? Math.max(...ramData) : 0;

  return (
    <div className="spark-cpu-section">
      <div className="spark-grid">
        {/* CPU LOAD */}
        <div className="spark-panel">
          <div className="spark-panel-header">
            <Cpu size={14} />
            <span className="spark-panel-label" style={{ color: cpuColor }}>CPU</span>
          </div>
          <span className="spark-panel-value" style={{ color: thresholdColor(totalLoad, cpuColor) }}>
            {totalLoad.toFixed(1)}<span className="spark-panel-unit">%</span>
          </span>
          <div className="spark-chart-area">
            <Sparkline data={cpuLoadData} color={cpuColor} />
          </div>
          <div className="spark-panel-footer">
            <div className="spark-minmax">
              <span><ArrowDown size={10} /> {cpuMin.toFixed(0)}</span>
              <span><ArrowUp size={10} /> {cpuMax.toFixed(0)}</span>
            </div>
            {cpuTemp > 0 && <span className="spark-panel-temp"><Thermometer size={10} /> {cpuTemp}°C</span>}
          </div>
          <span className="spark-panel-sub">{staticInfo?.cpu?.brand}</span>
        </div>

        {/* GPU LOAD */}
        <div className="spark-panel">
          <div className="spark-panel-header">
            <Monitor size={14} />
            <span className="spark-panel-label" style={{ color: gpuColor }}>GPU</span>
          </div>
          <span className="spark-panel-value" style={{ color: thresholdColor(gpuLoad, gpuColor) }}>
            {gpuLoad.toFixed(0)}<span className="spark-panel-unit">%</span>
          </span>
          <div className="spark-chart-area">
            <Sparkline data={gpuLoadData} color={gpuColor} />
          </div>
          <div className="spark-panel-footer">
            <div className="spark-minmax">
              <span><ArrowDown size={10} /> {gpuMin.toFixed(0)}</span>
              <span><ArrowUp size={10} /> {gpuMax.toFixed(0)}</span>
            </div>
            {gpuTemp > 0 && <span className="spark-panel-temp"><Thermometer size={10} /> {gpuTemp}°C</span>}
          </div>
          <span className="spark-panel-sub">{discreteGpu?.model || 'N/A'}</span>
        </div>

        {/* RAM */}
        <div className="spark-panel">
          <div className="spark-panel-header">
            <MemoryStick size={14} />
            <span className="spark-panel-label" style={{ color: ramColor }}>RAM</span>
          </div>
          <span className="spark-panel-value" style={{ color: thresholdColor(ramPct, ramColor) }}>
            {ramPct.toFixed(1)}<span className="spark-panel-unit">%</span>
          </span>
          <div className="spark-chart-area">
            <Sparkline data={ramData} color={ramColor} />
          </div>
          <div className="spark-panel-footer">
            <div className="spark-minmax">
              <span><ArrowDown size={10} /> {ramMin.toFixed(0)}</span>
              <span><ArrowUp size={10} /> {ramMax.toFixed(0)}</span>
            </div>
          </div>
          <span className="spark-panel-sub">{(memUsed / 1024 / 1024 / 1024).toFixed(1)} / {(memTotal / 1024 / 1024 / 1024).toFixed(0)} Go</span>
        </div>

        {/* VRAM */}
        <div className="spark-panel">
          <div className="spark-panel-header">
            <Monitor size={14} />
            <span className="spark-panel-label" style={{ color: disksColor }}>VRAM</span>
          </div>
          <span className="spark-panel-value" style={{ color: thresholdColor(vramPct, disksColor) }}>
            {vramPct.toFixed(0)}<span className="spark-panel-unit">%</span>
          </span>
          <div className="spark-chart-area spark-chart-placeholder">
            <HBar value={vramPct} color={thresholdColor(vramPct, disksColor)} />
          </div>
          <span className="spark-panel-sub">{vramUsed} / {vramTotal} MB</span>
        </div>
      </div>
    </div>
  );
}

export function NetworkSection({ history, totalRxSec, totalTxSec, activeInterfaces, t, colors }) {
  const dlColor = getWidgetColor(colors, 'network', 'primary');
  const ulColor = getWidgetColor(colors, 'network', 'secondary');

  const dlData = history.map(h => h.netDown || 0);
  const ulData = history.map(h => h.netUp || 0);

  return (
    <div className="network-section spark-network">
      <div className="spark-network-panels">
        <div className="spark-net-panel">
          <div className="spark-panel-header">
            <ArrowDown size={14} />
            <span className="spark-panel-label" style={{ color: dlColor }}>{t('monitoring.download')}</span>
          </div>
          <span className="spark-net-value" style={{ color: dlColor }}>{formatSpeed(totalRxSec)}</span>
          <div className="spark-chart-area spark-chart-sm">
            <Sparkline data={dlData} color={dlColor} />
          </div>
        </div>
        <div className="spark-net-panel">
          <div className="spark-panel-header">
            <ArrowUp size={14} />
            <span className="spark-panel-label" style={{ color: ulColor }}>{t('monitoring.upload')}</span>
          </div>
          <span className="spark-net-value" style={{ color: ulColor }}>{formatSpeed(totalTxSec)}</span>
          <div className="spark-chart-area spark-chart-sm">
            <Sparkline data={ulData} color={ulColor} />
          </div>
        </div>
        <div className="spark-net-interfaces">
          {activeInterfaces.map((ni, i) => (
            <div key={i} className="network-interface">
              <span className="ni-name">{ni.ifaceName || ni.iface}</span>
              <span className="ni-ip">{ni.ip4}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function sidebarRenderers(props) {
  const { discreteGpu, memUsed, memTotal, memPercent, localDisks, networkDisks, lightData, activeAlerts, cpuTemp, speedtestResult, speedtestRunning, speedtestError, runSpeedtest, t, colors } = props;
  const gpuColor = getWidgetColor(colors, 'gpu');
  const ramColor = getWidgetColor(colors, 'ram');
  const disksColor = getWidgetColor(colors, 'disks');
  const perfCpuColor = getWidgetColor(colors, 'perf', 'primary');
  const perfGpuColor = getWidgetColor(colors, 'perf', 'secondary');

  return {
    gpu: () => {
      const gpuLoad = discreteGpu?.utilizationGpu || 0;
      return (
        <div key="gpu" className="card compact">
          <div className="card-header"><Monitor size={16} /><span className="card-title">GPU - {discreteGpu?.model || 'N/A'}</span></div>
          <HBar value={gpuLoad} color={thresholdColor(gpuLoad, gpuColor)} label="Load" detail={`${gpuLoad.toFixed(0)}%`} />
          <div className="gpu-stats">
            {discreteGpu?.temperatureGpu > 0 && <div className="gpu-stat"><Thermometer size={14} /><span>{discreteGpu.temperatureGpu}°C</span></div>}
            {discreteGpu?.memoryTotal > 0 && <div className="gpu-stat"><span>VRAM: {discreteGpu.memoryUsed || 0} / {discreteGpu.memoryTotal} MB</span></div>}
            {discreteGpu?.powerDraw > 0 && <div className="gpu-stat"><span>{discreteGpu.powerDraw}W</span></div>}
          </div>
        </div>
      );
    },
    ram: () => (
      <div key="ram" className="card compact">
        <div className="card-header"><MemoryStick size={16} /><span className="card-title">RAM</span></div>
        <HBar value={parseFloat(memPercent)} color={thresholdColor(memPercent, ramColor)} label={`${(memUsed / 1024 / 1024 / 1024).toFixed(1)} / ${(memTotal / 1024 / 1024 / 1024).toFixed(0)} Go`} detail={`${memPercent}%`} />
      </div>
    ),
    disks: () => (
      <div key="disks" className="card compact">
        <div className="card-header"><HardDrive size={16} /><span className="card-title">{t('monitoring.disks')}</span></div>
        {localDisks.map((disk, i) => {
          const usedPct = (disk.used / disk.size) * 100;
          return (
            <div key={i} className="clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
              <HBar value={usedPct} color={thresholdColor(usedPct, disksColor)} label={disk.mount} detail={`${(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go libre`} />
            </div>
          );
        })}
      </div>
    ),
    networkDisks: () => networkDisks.length > 0 ? (
      <div key="networkDisks" className="card compact">
        <div className="card-header"><Network size={16} /><span className="card-title">{t('monitoring.networkDisks')}</span></div>
        {networkDisks.map((disk, i) => {
          const usedPct = disk.size > 0 ? (disk.used / disk.size) * 100 : 0;
          return (
            <div key={i} className="clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
              <HBar value={usedPct} color={thresholdColor(usedPct, disksColor)} label={disk.mount} detail={`${(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go libre`} />
            </div>
          );
        })}
      </div>
    ) : null,
    perf: () => {
      const cpuTotalLoad = lightData?.cpuLoad?.currentLoad || 0;
      const gpuLoad = discreteGpu?.utilizationGpu || 0;
      const gpuTemp = discreteGpu?.temperatureGpu || 0;
      const uptimeSec = lightData?.uptime || 0;
      const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;
      const hasAlert = activeAlerts.cpuTemp || activeAlerts.gpuTemp || activeAlerts.ramPercent;

      return (
        <div key="perf" className={`card compact ${hasAlert ? 'has-alert' : ''}`}>
          <div className="card-header"><Gauge size={16} /><span className="card-title">{t('monitoring.perfSummary')}</span></div>
          <HBar value={cpuTotalLoad} color={thresholdColor(cpuTotalLoad, perfCpuColor)} label="CPU" detail={`${cpuTotalLoad.toFixed(0)}%`} />
          <HBar value={gpuLoad} color={thresholdColor(gpuLoad, perfGpuColor)} label="GPU" detail={`${gpuLoad.toFixed(0)}%`} />
          <div className="perf-temps">
            {cpuTemp > 0 && <div className={`perf-temp-item ${activeAlerts.cpuTemp ? 'alert-active' : ''}`}><Thermometer size={12} /><span>CPU {cpuTemp}°C</span></div>}
            {gpuTemp > 0 && <div className={`perf-temp-item ${activeAlerts.gpuTemp ? 'alert-active' : ''}`}><Thermometer size={12} /><span>GPU {gpuTemp}°C</span></div>}
          </div>
          <div className="perf-uptime"><Clock size={12} /><span>{t('monitoring.uptime')}: {uptimeStr}</span></div>
        </div>
      );
    },
    speedtest: () => (
      <div key="speedtest" className="card compact speedtest-widget">
        <div className="card-header">
          <Zap size={16} /><span className="card-title">{t('monitoring.speedtest')}</span>
          <button className="speedtest-run-btn" onClick={runSpeedtest} disabled={speedtestRunning}>
            {speedtestRunning ? <Loader size={14} className="spinning" /> : <Play size={14} />}
            <span>{speedtestRunning ? '...' : t('monitoring.runSpeedtest')}</span>
          </button>
        </div>
        {speedtestResult ? (
          <div className="speedtest-results">
            <div className="speedtest-row"><ArrowDown size={14} className="speedtest-icon-down" /><span className="speedtest-label">{t('monitoring.download')}</span><span className="speedtest-value">{(speedtestResult.download / 125000).toFixed(1)} Mbps</span></div>
            <div className="speedtest-row"><ArrowUp size={14} className="speedtest-icon-up" /><span className="speedtest-label">{t('monitoring.upload')}</span><span className="speedtest-value">{(speedtestResult.upload / 125000).toFixed(1)} Mbps</span></div>
            <div className="speedtest-row"><Activity size={14} /><span className="speedtest-label">Ping</span><span className="speedtest-value">{speedtestResult.ping?.toFixed(0)} ms</span></div>
          </div>
        ) : (
          <div className="speedtest-empty"><span>{t('monitoring.noSpeedtest')}</span>{speedtestError && <span className="speedtest-error">{speedtestError}</span>}</div>
        )}
      </div>
    ),
  };
}
