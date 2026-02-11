import React, { memo } from 'react';
import { MemoryStick, HardDrive, Network, Monitor, Thermometer, Gauge, Zap, Clock, ArrowDown, ArrowUp, Wifi, Activity, Play, Loader } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { formatSpeed, thresholdColor, MiniGauge, getWidgetColor } from './shared';

// Composant mini-graphique pour un cœur CPU
const CoreChart = memo(function CoreChart({ data, coreIndex, currentLoad, cpuColor }) {
  const color = thresholdColor(currentLoad, cpuColor);
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
            <Area type="monotone" dataKey={`core${coreIndex}`} stroke={color} strokeWidth={1.5} fill={`url(#coreGradient${coreIndex})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// Composant GPU avec courbe
const GpuChart = memo(function GpuChart({ data, gpuInfo, gpuLoad, gpuColor }) {
  const color = gpuColor;
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
            <Area type="monotone" dataKey="gpuLoad" stroke={color} strokeWidth={2} fill="url(#gpuGradient)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="gpu-stats">
        {gpuInfo?.temperatureGpu > 0 && (
          <div className="gpu-stat"><Thermometer size={14} /><span>{gpuInfo.temperatureGpu}°C</span></div>
        )}
        {gpuInfo?.memoryTotal > 0 && (
          <div className="gpu-stat"><span>VRAM: {gpuInfo.memoryUsed || 0} / {gpuInfo.memoryTotal} MB</span></div>
        )}
        {gpuInfo?.powerDraw > 0 && (
          <div className="gpu-stat"><span>{gpuInfo.powerDraw}W</span></div>
        )}
      </div>
    </div>
  );
});

export function CpuSection({ cpuCores, history, cpuGridColumns, colors }) {
  const cpuColor = getWidgetColor(colors, 'cpu');
  return (
    <div className="cores-grid-charts" style={{ gridTemplateColumns: `repeat(${cpuGridColumns}, 1fr)` }}>
      {cpuCores.map((core, index) => (
        <CoreChart key={index} data={history} coreIndex={index} currentLoad={core.load} cpuColor={cpuColor} />
      ))}
    </div>
  );
}

export function NetworkSection({ history, totalRxSec, totalTxSec, activeInterfaces, t, colors }) {
  const dlColor = getWidgetColor(colors, 'network', 'primary');
  const ulColor = getWidgetColor(colors, 'network', 'secondary');
  return (
    <div className="network-section">
      <div className="network-header">
        <Wifi size={16} />
        <span>{t('monitoring.network')}</span>
        <div className="network-speeds">
          <span className="network-speed down"><ArrowDown size={14} />{formatSpeed(totalRxSec)}</span>
          <span className="network-speed up"><ArrowUp size={14} />{formatSpeed(totalTxSec)}</span>
        </div>
      </div>
      <div className="network-body">
        <div className="network-chart">
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={history} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id="netDownGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={dlColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={dlColor} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="netUpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ulColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ulColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="netDown" stroke={dlColor} strokeWidth={1.5} fill="url(#netDownGrad)" isAnimationActive={false} />
              <Area type="monotone" dataKey="netUp" stroke={ulColor} strokeWidth={1.5} fill="url(#netUpGrad)" isAnimationActive={false} />
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
  );
}

export function sidebarRenderers(props) {
  const { history, discreteGpu, memUsed, memTotal, memPercent, localDisks, networkDisks, lightData, activeAlerts, cpuTemp, speedtestResult, speedtestRunning, speedtestError, runSpeedtest, t, colors } = props;
  const gpuColor = getWidgetColor(colors, 'gpu');
  const ramColor = getWidgetColor(colors, 'ram');
  const disksColor = getWidgetColor(colors, 'disks');
  const networkDisksColor = getWidgetColor(colors, 'networkDisks');
  const perfCpuColor = getWidgetColor(colors, 'perf', 'primary');
  const perfGpuColor = getWidgetColor(colors, 'perf', 'secondary');

  return {
    gpu: () => (
      <GpuChart key="gpu" data={history} gpuInfo={discreteGpu} gpuLoad={discreteGpu?.utilizationGpu || 0} gpuColor={gpuColor} />
    ),
    ram: () => (
      <div key="ram" className="card compact">
        <div className="card-header">
          <MemoryStick size={16} />
          <span className="card-title">RAM</span>
          <span className="card-value-inline">{memPercent}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${memPercent}%`, background: thresholdColor(memPercent, ramColor) }} />
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
              <div key={index} className="disk-item-compact clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
                <div className="disk-info-compact">
                  <span className="disk-mount">{disk.mount}</span>
                  <span className="disk-free">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
                </div>
                <div className="progress-bar small">
                  <div className="progress-fill" style={{ width: `${usedPercent}%`, background: disksColor }} />
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
              <div key={index} className="disk-item-compact clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
                <div className="disk-info-compact">
                  <span className="disk-mount network">{disk.mount}</span>
                  <span className="disk-free">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
                </div>
                <div className="progress-bar small">
                  <div className="progress-fill" style={{ width: `${usedPercent}%`, background: networkDisksColor }} />
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
      const cpuColor = thresholdColor(cpuTotalLoad, perfCpuColor);
      const gpuColorFinal = thresholdColor(gpuLoad, perfGpuColor);
      const hasAlert = activeAlerts.cpuTemp || activeAlerts.gpuTemp || activeAlerts.ramPercent;

      return (
        <div key="perf" className={`card compact perf-summary ${hasAlert ? 'has-alert' : ''}`}>
          <div className="card-header">
            <Gauge size={16} />
            <span className="card-title">{t('monitoring.perfSummary')}</span>
          </div>
          <div className="perf-gauges">
            <MiniGauge value={cpuTotalLoad} color={cpuColor} label="CPU" />
            <MiniGauge value={gpuLoad} color={gpuColorFinal} label="GPU" />
          </div>
          <div className="perf-temps">
            {cpuTemp > 0 && (
              <div className={`perf-temp-item ${activeAlerts.cpuTemp ? 'alert-active' : ''}`}>
                <Thermometer size={12} /><span>CPU {cpuTemp}°C</span>
              </div>
            )}
            {gpuTemp > 0 && (
              <div className={`perf-temp-item ${activeAlerts.gpuTemp ? 'alert-active' : ''}`}>
                <Thermometer size={12} /><span>GPU {gpuTemp}°C</span>
              </div>
            )}
          </div>
          <div className="perf-uptime">
            <Clock size={12} /><span>{t('monitoring.uptime')}: {uptimeStr}</span>
          </div>
        </div>
      );
    },
    speedtest: () => (
      <div key="speedtest" className="card compact speedtest-widget">
        <div className="card-header">
          <Zap size={16} />
          <span className="card-title">{t('monitoring.speedtest')}</span>
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
            <div className="speedtest-meta"><span>{speedtestResult.server}</span><span>{new Date(speedtestResult.timestamp).toLocaleString()}</span></div>
          </div>
        ) : (
          <div className="speedtest-empty">
            <span>{t('monitoring.noSpeedtest')}</span>
            {speedtestError && <span className="speedtest-error">{speedtestError}</span>}
          </div>
        )}
      </div>
    ),
  };
}
