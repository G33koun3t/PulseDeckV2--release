import React, { useState, useEffect, memo } from 'react';
import { Cpu, Monitor, Thermometer, MemoryStick, HardDrive, Zap, Activity, ArrowDown, ArrowUp, Play, Loader } from 'lucide-react';
import { thresholdColor, SemiGauge, Sparkline, HBar, getWidgetColor } from './shared';

// Horloge analogique SVG temps réel
const AnalogClock = memo(function AnalogClock({ size = 240 }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const a = (i * 6 - 90) * Math.PI / 180;
    const major = i % 5 === 0;
    const ir = major ? r - 15 : r - 8;
    ticks.push(
      <line key={i}
        x1={cx + ir * Math.cos(a)} y1={cy + ir * Math.sin(a)}
        x2={cx + (r - 2) * Math.cos(a)} y2={cy + (r - 2) * Math.sin(a)}
        stroke={major ? 'var(--text-secondary)' : 'var(--text-muted)'}
        strokeWidth={major ? 2 : 1} opacity={major ? 1 : 0.4}
      />
    );
  }

  const nums = [
    { n: '12', a: -90 }, { n: '3', a: 0 }, { n: '6', a: 90 }, { n: '9', a: 180 },
  ];

  const dateStr = time.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="analog-clock">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-color)" strokeWidth={2} />
        {ticks}
        {nums.map(({ n, a }) => {
          const rad = a * Math.PI / 180;
          const nr = r - 28;
          return (
            <text key={n} x={cx + nr * Math.cos(rad)} y={cy + nr * Math.sin(rad)}
              textAnchor="middle" dominantBaseline="central"
              fill="var(--text-secondary)" fontSize={18} fontWeight={700}
              fontFamily="'JetBrains Mono', monospace"
            >{n}</text>
          );
        })}
        <line x1={cx} y1={cy}
          x2={cx + r * 0.5 * Math.cos((hourAngle - 90) * Math.PI / 180)}
          y2={cy + r * 0.5 * Math.sin((hourAngle - 90) * Math.PI / 180)}
          stroke="var(--text-primary)" strokeWidth={4} strokeLinecap="round" />
        <line x1={cx} y1={cy}
          x2={cx + r * 0.7 * Math.cos((minuteAngle - 90) * Math.PI / 180)}
          y2={cy + r * 0.7 * Math.sin((minuteAngle - 90) * Math.PI / 180)}
          stroke="var(--text-primary)" strokeWidth={3} strokeLinecap="round" />
        <line x1={cx} y1={cy}
          x2={cx + r * 0.75 * Math.cos((secondAngle - 90) * Math.PI / 180)}
          y2={cy + r * 0.75 * Math.sin((secondAngle - 90) * Math.PI / 180)}
          stroke="var(--accent-primary)" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={4} fill="var(--accent-primary)" />
      </svg>
      <span className="analog-clock-date">{dateStr}</span>
    </div>
  );
});

export function CpuSection({ cpuCores, history, colors, lightData, cpuTemp, staticInfo, discreteGpu, totalRxSec, totalTxSec, memUsed, memTotal, memPercent, localDisks, networkDisks, activeInterfaces, activeAlerts, t }) {
  const cpuColor = getWidgetColor(colors, 'cpu');
  const gpuColor = getWidgetColor(colors, 'gpu');

  const totalLoad = lightData?.cpuLoad?.currentLoad || 0;
  const gpuLoad = discreteGpu?.utilizationGpu || 0;
  const gpuTemp = discreteGpu?.temperatureGpu || 0;

  const cpuLoadData = history.map(h => h.total || 0);
  const gpuLoadData = history.map(h => h.gpuLoad || 0);

  const cpuMin = cpuLoadData.length > 0 ? Math.min(...cpuLoadData) : 0;
  const cpuMax = cpuLoadData.length > 0 ? Math.max(...cpuLoadData) : 0;
  const gpuMin = gpuLoadData.length > 0 ? Math.min(...gpuLoadData) : 0;
  const gpuMax = gpuLoadData.length > 0 ? Math.max(...gpuLoadData) : 0;

  return (
    <div className="gauges-clock-layout">
      {/* Ligne haute : horloge + gauges */}
      <div className="gauges-top-row">
        <AnalogClock size={320} />

        <div className="gauges-center-grid">
          <SemiGauge value={Math.min(gpuTemp, 100)} size={200} strokeWidth={14}
            color={gpuTemp > 80 ? '#ef4444' : gpuTemp > 60 ? '#f59e0b' : gpuColor}
            label="GPU Temp" displayValue={`${gpuTemp}`} unit="°C" />
          <SemiGauge value={Math.min(cpuTemp, 100)} size={200} strokeWidth={14}
            color={cpuTemp > 80 ? '#ef4444' : cpuTemp > 60 ? '#f59e0b' : cpuColor}
            label="CPU Temp" displayValue={`${cpuTemp}`} unit="°C" />
          <SemiGauge value={gpuLoad} size={200} strokeWidth={14}
            color={thresholdColor(gpuLoad, gpuColor)}
            label="GPU Load" />
          <SemiGauge value={totalLoad} size={200} strokeWidth={14}
            color={thresholdColor(totalLoad, cpuColor)}
            label="CPU Load" />
        </div>
      </div>

      {/* Ligne basse : 2 panneaux stats côte à côte */}
      <div className="gauges-stat-panels">
        <div className="gauges-stat-panel">
          <div className="gauges-stat-header">
            <Cpu size={13} />
            <span>CPU LOAD / {staticInfo?.cpu?.brand || 'CPU'}</span>
          </div>
          <div className="gauges-stat-row">
            <div className="gauges-stat-value" style={{ color: thresholdColor(totalLoad, cpuColor) }}>
              {totalLoad.toFixed(0)}<span className="gauges-stat-unit">%</span>
            </div>
            <div className="gauges-stat-minmax">
              <span>↓ {cpuMin.toFixed(0)}</span>
              <span>↑ {cpuMax.toFixed(0)}</span>
            </div>
          </div>
          <div className="gauges-stat-chart">
            <Sparkline data={cpuLoadData} color={cpuColor} />
          </div>
        </div>
        <div className="gauges-stat-panel">
          <div className="gauges-stat-header">
            <Monitor size={13} />
            <span>GPU LOAD / {discreteGpu?.model || 'GPU'}</span>
          </div>
          <div className="gauges-stat-row">
            <div className="gauges-stat-value" style={{ color: thresholdColor(gpuLoad, gpuColor) }}>
              {gpuLoad.toFixed(0)}<span className="gauges-stat-unit">%</span>
            </div>
            <div className="gauges-stat-minmax">
              <span>↓ {gpuMin.toFixed(0)}</span>
              <span>↑ {gpuMax.toFixed(0)}</span>
            </div>
          </div>
          <div className="gauges-stat-chart">
            <Sparkline data={gpuLoadData} color={gpuColor} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NetworkSection() {
  return null;
}

export function sidebarRenderers(props) {
  const { discreteGpu, memUsed, memTotal, memPercent, localDisks, networkDisks, lightData, activeAlerts, cpuTemp, speedtestResult, speedtestRunning, speedtestError, runSpeedtest, t, colors } = props;
  const ramColor = getWidgetColor(colors, 'ram');
  const disksColor = getWidgetColor(colors, 'disks');

  return {
    gpu: () => {
      if (!discreteGpu?.memoryTotal && !discreteGpu?.powerDraw) return null;
      return (
        <div key="gpu" className="card compact">
          <div className="card-header">
            <Monitor size={16} /><span className="card-title">GPU — {discreteGpu?.model || 'N/A'}</span>
          </div>
          <div className="gpu-stats">
            {discreteGpu?.memoryTotal > 0 && <div className="gpu-stat"><span>VRAM: {discreteGpu.memoryUsed || 0} / {discreteGpu.memoryTotal} MB</span></div>}
            {discreteGpu?.powerDraw > 0 && <div className="gpu-stat"><Zap size={12} /><span>{discreteGpu.powerDraw}W</span></div>}
            {discreteGpu?.fanSpeed > 0 && <div className="gpu-stat"><span>Fan: {discreteGpu.fanSpeed}%</span></div>}
          </div>
        </div>
      );
    },
    ram: () => {
      const ramPct = parseFloat(memPercent) || 0;
      return (
        <div key="ram" className="card compact">
          <div className="card-header">
            <MemoryStick size={16} /><span className="card-title">RAM — {ramPct}%</span>
          </div>
          <HBar value={ramPct} color={thresholdColor(ramPct, ramColor)} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(memUsed / 1024 / 1024 / 1024).toFixed(1)} / {(memTotal / 1024 / 1024 / 1024).toFixed(0)} Go</span>
        </div>
      );
    },
    disks: () => (
      <div key="disks" className="card compact">
        <div className="card-header">
          <HardDrive size={16} /><span className="card-title">{t ? t('monitoring.disks') : 'Disques'}</span>
        </div>
        {localDisks.map((disk, i) => {
          const usedPct = (disk.used / disk.size) * 100;
          return (
            <div key={i} className="clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
              <HBar value={usedPct} color={thresholdColor(usedPct, disksColor)} label={disk.mount} detail={`${(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go`} />
            </div>
          );
        })}
      </div>
    ),
    networkDisks: () => networkDisks.length > 0 ? (
      <div key="networkDisks" className="card compact">
        <div className="card-header">
          <HardDrive size={16} /><span className="card-title">{t ? t('monitoring.networkDisks') : 'Disques réseau'}</span>
        </div>
        {networkDisks.map((disk, i) => {
          const usedPct = disk.size > 0 ? (disk.used / disk.size) * 100 : 0;
          return (
            <div key={i} className="clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
              <HBar value={usedPct} color={thresholdColor(usedPct, disksColor)} label={disk.mount} detail={`${(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go`} />
            </div>
          );
        })}
      </div>
    ) : null,
    perf: () => null,
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
