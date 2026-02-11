import React from 'react';
import { MemoryStick, HardDrive, Network, Monitor, Thermometer, Gauge, Zap, Clock, ArrowDown, ArrowUp, Wifi, Activity, Play, Loader } from 'lucide-react';
import { formatSpeed, thresholdColor, getWidgetColor } from './shared';

// Barre segmentée HUD (gradient CSS, pas de DOM par segment)
function HudBar({ value, max = 100, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="hud-bar">
      <div
        className="hud-bar-fill"
        style={{ width: `${pct}%`, '--hud-color': color }}
      />
    </div>
  );
}

export function CpuSection({ cpuCores, colors, lightData, cpuTemp, staticInfo }) {
  const cpuColor = getWidgetColor(colors, 'cpu');
  const totalLoad = lightData?.cpuLoad?.currentLoad || 0;

  return (
    <div className="hud-cpu-section">
      <div className="hud-panel">
        <div className="hud-panel-header">CPU CORES</div>
        <div className="hud-cores-grid">
          {cpuCores.map((core, i) => {
            const color = thresholdColor(core.load, cpuColor);
            return (
              <div key={i} className="hud-core-row">
                <HudBar value={core.load} color={color} />
                <span className="hud-core-label">C{i}</span>
                <span className="hud-core-value" style={{ color }}>{core.load?.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function NetworkSection({ totalRxSec, totalTxSec, activeInterfaces, t, colors }) {
  const dlColor = getWidgetColor(colors, 'network', 'primary');
  const ulColor = getWidgetColor(colors, 'network', 'secondary');

  return (
    <div className="network-section hud-network">
      <div className="hud-panel">
        <div className="hud-panel-header">NETWORK</div>
        <div className="hud-data-row">
          <span className="hud-prefix">DL ▸</span>
          <span className="hud-val" style={{ color: dlColor }}>{formatSpeed(totalRxSec)}</span>
        </div>
        <div className="hud-data-row">
          <span className="hud-prefix">UL ▸</span>
          <span className="hud-val" style={{ color: ulColor }}>{formatSpeed(totalTxSec)}</span>
        </div>
        {activeInterfaces.map((ni, i) => (
          <div key={i} className="hud-data-row">
            <span className="hud-prefix">IF ▸</span>
            <span className="hud-detail">{ni.ifaceName || ni.iface}</span>
            <span className="hud-val">{ni.ip4}</span>
          </div>
        ))}
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
      const gpuTemp = discreteGpu?.temperatureGpu || 0;
      return (
        <div key="gpu" className="hud-panel">
          <div className="hud-panel-header">GPU</div>
          <div className="hud-data-row">
            <span className="hud-prefix">MODEL ▸</span>
            <span className="hud-val">{discreteGpu?.model || 'N/A'}</span>
          </div>
          <div className="hud-data-row">
            <span className="hud-prefix">LOAD ▸</span>
            <HudBar value={gpuLoad} color={thresholdColor(gpuLoad, gpuColor)} />
            <span className="hud-val" style={{ color: thresholdColor(gpuLoad, gpuColor) }}>{gpuLoad.toFixed(0)}%</span>
          </div>
          {gpuTemp > 0 && (
            <div className="hud-data-row">
              <span className="hud-prefix">TEMP ▸</span>
              <span className="hud-val">{gpuTemp}°C</span>
            </div>
          )}
          {discreteGpu?.memoryTotal > 0 && (
            <div className="hud-data-row">
              <span className="hud-prefix">VRAM ▸</span>
              <span className="hud-val">{discreteGpu.memoryUsed || 0}/{discreteGpu.memoryTotal}MB</span>
            </div>
          )}
          {discreteGpu?.powerDraw > 0 && (
            <div className="hud-data-row">
              <span className="hud-prefix">PWR ▸</span>
              <span className="hud-val">{discreteGpu.powerDraw}W</span>
            </div>
          )}
        </div>
      );
    },
    ram: () => {
      const color = thresholdColor(memPercent, ramColor);
      return (
        <div key="ram" className="hud-panel">
          <div className="hud-panel-header">MEMORY</div>
          <div className="hud-data-row">
            <span className="hud-prefix">USED ▸</span>
            <HudBar value={parseFloat(memPercent)} color={color} />
            <span className="hud-val" style={{ color }}>{memPercent}%</span>
          </div>
          <div className="hud-data-row">
            <span className="hud-prefix">SIZE ▸</span>
            <span className="hud-val">{(memUsed / 1024 / 1024 / 1024).toFixed(1)} / {(memTotal / 1024 / 1024 / 1024).toFixed(0)} Go</span>
          </div>
        </div>
      );
    },
    disks: () => (
      <div key="disks" className="hud-panel">
        <div className="hud-panel-header">STORAGE</div>
        {localDisks.map((disk, i) => {
          const usedPct = (disk.used / disk.size) * 100;
          const color = thresholdColor(usedPct, disksColor);
          return (
            <div key={i} className="hud-data-row clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
              <span className="hud-prefix">{disk.mount} ▸</span>
              <HudBar value={usedPct} color={color} />
              <span className="hud-val" style={{ color }}>{usedPct.toFixed(0)}%</span>
              <span className="hud-detail">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
            </div>
          );
        })}
      </div>
    ),
    networkDisks: () => networkDisks.length > 0 ? (
      <div key="networkDisks" className="hud-panel">
        <div className="hud-panel-header">NETWORK STORAGE</div>
        {networkDisks.map((disk, i) => {
          const usedPct = disk.size > 0 ? (disk.used / disk.size) * 100 : 0;
          const color = thresholdColor(usedPct, disksColor);
          return (
            <div key={i} className="hud-data-row clickable" onClick={() => window.electronAPI?.openPath(disk.mount + '\\')}>
              <span className="hud-prefix">{disk.mount} ▸</span>
              <HudBar value={usedPct} color={color} />
              <span className="hud-val" style={{ color }}>{usedPct.toFixed(0)}%</span>
              <span className="hud-detail">{(disk.available / 1024 / 1024 / 1024).toFixed(0)}Go</span>
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
        <div key="perf" className={`hud-panel ${hasAlert ? 'hud-alert' : ''}`}>
          <div className="hud-panel-header">SYSTEM</div>
          <div className="hud-data-row">
            <span className="hud-prefix">CPU ▸</span>
            <HudBar value={cpuTotalLoad} color={thresholdColor(cpuTotalLoad, perfCpuColor)} />
            <span className="hud-val">{cpuTotalLoad.toFixed(0)}%</span>
          </div>
          <div className="hud-data-row">
            <span className="hud-prefix">GPU ▸</span>
            <HudBar value={gpuLoad} color={thresholdColor(gpuLoad, perfGpuColor)} />
            <span className="hud-val">{gpuLoad.toFixed(0)}%</span>
          </div>
          {cpuTemp > 0 && (
            <div className={`hud-data-row ${activeAlerts.cpuTemp ? 'hud-row-alert' : ''}`}>
              <span className="hud-prefix">CPU.T ▸</span>
              <span className="hud-val">{cpuTemp}°C</span>
            </div>
          )}
          {gpuTemp > 0 && (
            <div className={`hud-data-row ${activeAlerts.gpuTemp ? 'hud-row-alert' : ''}`}>
              <span className="hud-prefix">GPU.T ▸</span>
              <span className="hud-val">{gpuTemp}°C</span>
            </div>
          )}
          <div className="hud-data-row">
            <span className="hud-prefix">UP ▸</span>
            <span className="hud-val">{uptimeStr}</span>
          </div>
        </div>
      );
    },
    speedtest: () => (
      <div key="speedtest" className="hud-panel">
        <div className="hud-panel-header">
          <span>SPEEDTEST</span>
          <button className="hud-btn" onClick={runSpeedtest} disabled={speedtestRunning}>
            {speedtestRunning ? <Loader size={12} className="spinning" /> : <Play size={12} />}
          </button>
        </div>
        {speedtestResult ? (
          <>
            <div className="hud-data-row"><span className="hud-prefix">DL ▸</span><span className="hud-val">{(speedtestResult.download / 125000).toFixed(1)} Mbps</span></div>
            <div className="hud-data-row"><span className="hud-prefix">UL ▸</span><span className="hud-val">{(speedtestResult.upload / 125000).toFixed(1)} Mbps</span></div>
            <div className="hud-data-row"><span className="hud-prefix">PING ▸</span><span className="hud-val">{speedtestResult.ping?.toFixed(0)} ms</span></div>
          </>
        ) : (
          <div className="hud-data-row"><span className="hud-detail">{t('monitoring.noSpeedtest')}</span></div>
        )}
      </div>
    ),
  };
}
