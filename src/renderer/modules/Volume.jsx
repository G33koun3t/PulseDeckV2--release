import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2, VolumeX, Volume1, Speaker, RefreshCw, ChevronDown, Monitor,
  SkipBack, Play, SkipForward, Settings, Activity, Gauge, Zap, AudioWaveform
} from 'lucide-react';
import useModuleConfig from '../hooks/useModuleConfig';
import ModuleSettingsPanel from '../components/ModuleSettingsPanel';
import { useTranslation } from '../i18n';
import appIcon from '../assets/app-icon.ico';
import './Volume.css';

const DEFAULT_WIDGETS = [
  { id: 'volumeDisplay' },
  { id: 'volumeBars' },
  { id: 'visualizer' },
  { id: 'volumePresets' },
  { id: 'deviceSelector' },
  { id: 'quickActions' },
  { id: 'mediaControls' },
];

const WIDGET_DEFS = {
  volumeDisplay: { labelKey: 'volume.mainVolume', icon: Volume2 },
  volumeBars: { labelKey: 'volume.volumeBars', icon: Activity },
  volumePresets: { labelKey: 'volume.presets', icon: Gauge },
  deviceSelector: { labelKey: 'volume.device', icon: Monitor },
  quickActions: { labelKey: 'volume.quickActions', icon: Zap },
  mediaControls: { labelKey: 'volume.mediaControl', icon: Play },
  visualizer: { labelKey: 'volume.visualizer', icon: AudioWaveform },
};

const LEFT_WIDGETS = ['volumeDisplay', 'volumeBars', 'visualizer', 'volumePresets'];
const RIGHT_WIDGETS = ['deviceSelector', 'quickActions', 'mediaControls'];

const DEFAULT_SIZES = { rightColumnWidth: 320 };

// Obtenir l'icône de volume selon le niveau
const getVolumeIcon = (volume, muted, size = 24) => {
  if (muted || volume === 0) return <VolumeX size={size} />;
  if (volume < 33) return <Volume1 size={size} />;
  if (volume < 66) return <Volume2 size={size} />;
  return <Volume2 size={size} />;
};

const AudioVisualizer = React.memo(function AudioVisualizer() {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [vizError, setVizError] = useState(null);

  const stopCapture = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsActive(false);
  }, []);

  const startCapture = useCallback(async () => {
    try {
      setVizError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });

      // Stop video track immediately — we only need audio
      stream.getVideoTracks().forEach(track => track.stop());

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setVizError(t('volume.visualizerNoAudio'));
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      // Do NOT connect to destination to avoid audio doubling
      analyserRef.current = analyser;

      setIsActive(true);
    } catch (err) {
      console.error('Audio capture error:', err);
      setVizError(t('volume.visualizerError'));
      stopCapture();
    }
  }, [t, stopCapture]);

  // Canvas rendering loop
  useEffect(() => {
    if (!isActive || !analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
      }

      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 64;
      const gap = 2;
      const barWidth = (canvas.width - gap * (barCount - 1)) / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const percent = value / 255;
        const barHeight = percent * canvas.height;

        // Color gradient: green → orange → red
        let r, g, b;
        if (percent < 0.5) {
          r = Math.round(percent * 2 * 255);
          g = 200;
          b = 50;
        } else {
          r = 255;
          g = Math.round((1 - (percent - 0.5) * 2) * 200);
          b = 50;
        }

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        const x = i * (barWidth + gap);
        const y = canvas.height - barHeight;
        const radius = Math.min(barWidth / 2, 3);

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, canvas.height);
        ctx.lineTo(x, canvas.height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCapture();
  }, [stopCapture]);

  return (
    <div key="visualizer" className="audio-visualizer">
      <div className="audio-visualizer-header">
        <span className="audio-visualizer-label">{t('volume.visualizer')}</span>
        <button
          className={`audio-visualizer-toggle ${isActive ? 'active' : ''}`}
          onClick={isActive ? stopCapture : startCapture}
        >
          {isActive ? t('volume.stopVisualizer') : t('volume.startVisualizer')}
        </button>
      </div>
      {vizError && <div className="audio-visualizer-error">{vizError}</div>}
      <div className="audio-visualizer-canvas-container" ref={containerRef}>
        <canvas ref={canvasRef} className="audio-visualizer-canvas" />
        {!isActive && !vizError && (
          <div className="audio-visualizer-placeholder">
            <AudioWaveform size={20} />
            <span>{t('volume.visualizerHint')}</span>
          </div>
        )}
      </div>
    </div>
  );
});

function VolumeModule() {
  const { t } = useTranslation();
  const [volume, setVolume] = useState(50);
  const [muted, setMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const updateTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Audio devices
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Widget config
  const { widgets, isVisible, toggleWidget, moveWidget, getSize, setSize, resetConfig } = useModuleConfig('volume', DEFAULT_WIDGETS, DEFAULT_SIZES);
  const rightColumnWidth = getSize('rightColumnWidth', 320);

  const resolvedWidgetDefs = Object.fromEntries(
    Object.entries(WIDGET_DEFS).map(([id, def]) => [id, { ...def, label: t(def.labelKey) }])
  );

  // Charger le volume actuel
  const loadVolume = useCallback(async () => {
    if (!window.electronAPI?.getVolume) {
      setError(t('volume.apiUnavailable'));
      setIsLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.getVolume();
      if (result.error) {
        setError(result.error);
      } else {
        setVolume(result.volume);
        setMuted(result.muted);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les périphériques audio
  const loadAudioDevices = useCallback(async () => {
    if (!window.electronAPI?.getAudioDevices) return;
    try {
      const result = await window.electronAPI.getAudioDevices();
      if (result.success) {
        setAudioDevices(result.devices);
        const defaultDevice = result.devices.find(d => d.isDefault);
        if (defaultDevice) setSelectedDevice(defaultDevice.id);
      }
    } catch (err) {
      console.error('Erreur loadAudioDevices:', err);
    }
  }, []);

  // Changer le périphérique audio
  const handleDeviceChange = useCallback(async (deviceId) => {
    if (!window.electronAPI?.setAudioDevice) return;
    setSelectedDevice(deviceId);
    setDropdownOpen(false);
    try {
      const result = await window.electronAPI.setAudioDevice(deviceId);
      console.log('setAudioDevice result:', result);
      if (result.success) {
        await new Promise(r => setTimeout(r, 500));
        await loadAudioDevices();
        await loadVolume();
      } else {
        setError(result.error || t('volume.deviceChangeFailed'));
        await loadAudioDevices();
      }
    } catch (err) {
      console.error('Erreur handleDeviceChange:', err);
      await loadAudioDevices();
    }
  }, [loadAudioDevices, loadVolume]);

  // Charger au démarrage
  useEffect(() => {
    loadVolume();
    loadAudioDevices();
    const interval = setInterval(loadVolume, 5000);
    return () => clearInterval(interval);
  }, [loadVolume, loadAudioDevices]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mettre à jour le volume avec debounce
  const updateVolume = useCallback(async (newVolume) => {
    if (!window.electronAPI?.setVolume) return;

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    setVolume(newVolume);

    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await window.electronAPI.setVolume(newVolume);
      } catch (err) {
        console.error('Erreur setVolume:', err);
      }
    }, 50);
  }, []);

  // Contrôle média global
  const handleMediaAction = async (action) => {
    try {
      await window.electronAPI.mediaControl(action);
    } catch (error) {
      console.error('Media control error:', error);
    }
  };

  // Toggle mute
  const handleToggleMute = useCallback(async () => {
    if (!window.electronAPI?.toggleMute) return;

    try {
      const result = await window.electronAPI.toggleMute();
      if (result.success) {
        setMuted(result.muted);
      }
    } catch (err) {
      console.error('Erreur toggleMute:', err);
    }
  }, []);

  // Presets de volume
  const volumePresets = [0, 25, 50, 75, 100];

  // Couleur selon le niveau
  const getVolumeColor = () => {
    if (muted) return 'var(--text-muted)';
    if (volume > 80) return 'var(--danger)';
    if (volume > 60) return 'var(--warning)';
    return 'var(--success)';
  };

  if (isLoading) {
    return (
      <div className="volume-module">
        <div className="volume-loading">
          <img src={appIcon} alt="" className="loading-app-icon" />
          <span>{t('volume.loading')}</span>
        </div>
      </div>
    );
  }

  // Renderers pour les widgets
  const leftRenderers = {
    volumeDisplay: () => (
      <div key="volumeDisplay" className="volume-display">
        <button
          className={`mute-btn ${muted ? 'muted' : ''}`}
          onClick={handleToggleMute}
          title={muted ? t('volume.activateSound') : t('volume.muteSound')}
        >
          {getVolumeIcon(volume, muted, 48)}
        </button>
        <div className="volume-value" style={{ color: getVolumeColor() }}>
          {muted ? 'MUTE' : `${volume}%`}
        </div>
      </div>
    ),
    volumeBars: () => (
      <div key="volumeBars" className="volume-bars">
        {Array.from({ length: 20 }).map((_, i) => {
          const barLevel = (i + 1) * 5;
          const isActive = !muted && volume >= barLevel;
          let barColor = 'var(--success)';
          if (barLevel > 80) barColor = 'var(--danger)';
          else if (barLevel > 60) barColor = 'var(--warning)';
          return (
            <div
              key={i}
              className={`volume-bar ${isActive ? 'active' : ''}`}
              style={{
                height: `${30 + i * 3}%`,
                backgroundColor: isActive ? barColor : 'var(--bg-tertiary)'
              }}
              onClick={() => !muted && updateVolume(barLevel)}
            />
          );
        })}
      </div>
    ),
    visualizer: () => <AudioVisualizer />,
    volumePresets: () => (
      <div key="volumePresets" className="volume-presets">
        {volumePresets.map((preset) => (
          <button
            key={preset}
            className={`preset-btn ${volume === preset && !muted ? 'active' : ''}`}
            onClick={() => updateVolume(preset)}
            disabled={muted}
          >
            {preset}%
          </button>
        ))}
      </div>
    ),
  };

  const rightRenderers = {
    deviceSelector: () => audioDevices.length > 0 ? (
      <div key="deviceSelector" className="device-selector" ref={dropdownRef}>
        <div className="device-selector-label">{t('volume.outputDevice')}</div>
        <button
          className={`device-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <Monitor size={16} />
          <span className="device-dropdown-text">
            {audioDevices.find(d => d.id === selectedDevice)?.name || t('volume.select')}
          </span>
          <ChevronDown size={16} className={`dropdown-chevron ${dropdownOpen ? 'rotated' : ''}`} />
        </button>
        {dropdownOpen && (
          <div className="device-dropdown-menu">
            {audioDevices.map((device) => (
              <button
                key={device.id}
                className={`device-dropdown-item ${device.id === selectedDevice ? 'active' : ''}`}
                onClick={() => handleDeviceChange(device.id)}
              >
                <span className="device-name">{device.name}</span>
                {device.id === selectedDevice && (
                  <span className="device-active-badge">{t('volume.active')}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    ) : null,
    quickActions: () => (
      <div key="quickActions" className="volume-actions">
        <button
          className={`action-btn ${muted ? 'active' : ''}`}
          onClick={handleToggleMute}
        >
          <VolumeX size={18} />
          <span>{t('volume.mute')}</span>
        </button>
        <button
          className="action-btn"
          onClick={() => updateVolume(Math.max(0, volume - 10))}
          disabled={muted}
        >
          <Volume1 size={18} />
          <span>-10%</span>
        </button>
        <button
          className="action-btn"
          onClick={() => updateVolume(Math.min(100, volume + 10))}
          disabled={muted}
        >
          <Volume2 size={18} />
          <span>+10%</span>
        </button>
      </div>
    ),
    mediaControls: () => (
      <div key="mediaControls" className="media-section">
        <div className="media-section-label">{t('volume.playbackControl')}</div>
        <div className="media-controls">
          <button
            className="media-btn"
            onClick={() => handleMediaAction('prev')}
            title={t('volume.prevTrack')}
          >
            <SkipBack size={18} />
          </button>
          <button
            className="media-btn play"
            onClick={() => handleMediaAction('play-pause')}
            title={t('volume.playPause')}
          >
            <Play size={20} />
          </button>
          <button
            className="media-btn"
            onClick={() => handleMediaAction('next')}
            title={t('volume.nextTrack')}
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>
    ),
  };

  if (showSettings) {
    return (
      <div className="volume-module">
        <ModuleSettingsPanel
          title={t('volume.widgetsTitle')}
          widgets={widgets}
          widgetDefs={resolvedWidgetDefs}
          onToggle={toggleWidget}
          onMove={moveWidget}
          onClose={() => setShowSettings(false)}
          onReset={resetConfig}
          sizes={[{ key: 'rightColumnWidth', label: t('volume.rightColumnWidth'), min: 250, max: 450, step: 10, value: rightColumnWidth }]}
          onSizeChange={setSize}
        />
      </div>
    );
  }

  return (
    <div className="volume-module">
      {/* Header */}
      <div className="volume-header">
        <div className="volume-title">
          <Speaker size={24} />
          <span>{t('volume.title')}</span>
        </div>
        <div className="volume-header-actions">
          <button className="refresh-btn" onClick={() => { loadVolume(); loadAudioDevices(); }} title={t('common.refresh')}>
            <RefreshCw size={18} />
          </button>
          <button className="refresh-btn" onClick={() => setShowSettings(true)} title={t('common.settings')}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="volume-error">
          {error}
        </div>
      )}

      {/* Layout horizontal principal */}
      <div className="volume-content">
        {/* Colonne gauche - Volume principal */}
        <div className="volume-left">
          {widgets
            .filter(w => LEFT_WIDGETS.includes(w.id) && w.visible && leftRenderers[w.id])
            .map(w => leftRenderers[w.id]())
          }
        </div>

        {/* Colonne droite - Périphérique + Actions + Média */}
        <div className="volume-right" style={{ width: `${rightColumnWidth}px` }}>
          {widgets
            .filter(w => RIGHT_WIDGETS.includes(w.id) && w.visible && rightRenderers[w.id])
            .map(w => rightRenderers[w.id]())
          }
        </div>
      </div>
    </div>
  );
}

export default VolumeModule;
