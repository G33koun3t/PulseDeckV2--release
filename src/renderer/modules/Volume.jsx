import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Volume2, VolumeX, Volume1, Speaker, RefreshCw, ChevronDown, Monitor,
  SkipBack, Play, Pause, SkipForward, Settings, Activity, Gauge, Zap, AudioWaveform
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

const DEFAULT_SIZES = {};

// Obtenir l'icône de volume selon le niveau
const getVolumeIcon = (volume, muted, size = 24) => {
  if (muted || volume === 0) return <VolumeX size={size} />;
  if (volume < 33) return <Volume1 size={size} />;
  if (volume < 66) return <Volume2 size={size} />;
  return <Volume2 size={size} />;
};

// Audio visualizer removed — desktopCapturer/getDisplayMedia not available in Tauri WebView2

function VolumeModule({ isActive }) {
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
  const [isMediaPlaying, setIsMediaPlaying] = useState(false);

  // Widget config
  const { widgets, isVisible, toggleWidget, moveWidget, getSize, setSize, resetConfig } = useModuleConfig('volume', DEFAULT_WIDGETS, DEFAULT_SIZES);

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

  // Charger au démarrage + poll quand visible
  useEffect(() => {
    if (!isActive) return;
    loadVolume();
    loadAudioDevices();
    const interval = setInterval(loadVolume, 5000);
    return () => clearInterval(interval);
  }, [isActive, loadVolume, loadAudioDevices]);

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

  // Circumference for SVG ring: 2 * PI * 52 ≈ 326.73
  const KNOB_CIRCUMFERENCE = 326.73;

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

      {error && <div className="volume-error">{error}</div>}

      {/* Output Device */}
      {isVisible('deviceSelector') && audioDevices.length > 0 && (
        <div className="deck-output" ref={dropdownRef}>
          <div className="deck-label">{t('volume.outputDevice')}</div>
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
      )}

      <div className="deck-surface">
        {/* Main: Knob + Channel Strip */}
        <div className="deck-main">
          {isVisible('volumeDisplay') && (
            <div className="deck-knob-section">
              <div className="deck-knob">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-tertiary)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={getVolumeColor()}
                    strokeWidth="8"
                    strokeDasharray={`${(volume / 100) * KNOB_CIRCUMFERENCE} ${KNOB_CIRCUMFERENCE}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ filter: `drop-shadow(0 0 6px ${getVolumeColor()})`, transition: 'stroke-dasharray 0.3s ease' }}
                  />
                </svg>
                <div className="deck-knob-center">
                  <div className="deck-knob-value" style={{ color: getVolumeColor() }}>
                    {muted ? 'MUTE' : `${volume}%`}
                  </div>
                  <div className="deck-knob-icon">
                    {getVolumeIcon(volume, muted, 20)}
                  </div>
                </div>
              </div>
              <button
                className={`deck-mute-btn ${muted ? 'muted' : ''}`}
                onClick={handleToggleMute}
                title={muted ? t('volume.activateSound') : t('volume.muteSound')}
              >
                {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
            </div>
          )}

          <div className="deck-channel">
            {isVisible('volumeBars') && (
              <div className="deck-vu">
                <div className="deck-label">VU METER</div>
                <div className="deck-vu-bars">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const barLevel = (i + 1) * 5;
                    const isBarActive = !muted && volume >= barLevel;
                    let barColor = 'var(--success)';
                    if (barLevel > 80) barColor = 'var(--danger)';
                    else if (barLevel > 60) barColor = 'var(--warning)';
                    return (
                      <div
                        key={i}
                        className={`deck-vu-segment ${isBarActive ? 'active' : ''}`}
                        style={{
                          height: `${30 + i * 3.5}%`,
                          backgroundColor: isBarActive ? barColor : 'var(--bg-tertiary)'
                        }}
                        onClick={() => !muted && updateVolume(barLevel)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {isVisible('volumePresets') && (
              <div className="deck-presets">
                <div className="deck-label">{t('volume.presets')}</div>
                <div className="deck-presets-row">
                  {volumePresets.map((preset) => (
                    <button
                      key={preset}
                      className={`deck-preset ${volume === preset && !muted ? 'active' : ''}`}
                      onClick={() => updateVolume(preset)}
                      disabled={muted}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Audio visualizer removed — not available in Tauri WebView2 */}
          </div>
        </div>

        {/* Transport Row */}
        {(isVisible('mediaControls') || isVisible('quickActions')) && (
          <div className="deck-transport">
            {isVisible('mediaControls') && (
              <div className="deck-transport-group">
                <div className="deck-label">{t('volume.playbackControl')}</div>
                <div className="deck-transport-btns">
                  <button className="deck-btn" onClick={() => handleMediaAction('prev')} title={t('volume.prevTrack')}>
                    <SkipBack size={18} />
                  </button>
                  <button className="deck-btn play-btn" onClick={() => { handleMediaAction('play-pause'); setIsMediaPlaying(prev => !prev); }}
                    title={isMediaPlaying ? t('volume.pause') : t('volume.playPause')}>
                    {isMediaPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <button className="deck-btn" onClick={() => handleMediaAction('next')} title={t('volume.nextTrack')}>
                    <SkipForward size={18} />
                  </button>
                </div>
              </div>
            )}

            {isVisible('quickActions') && (
              <div className="deck-transport-group">
                <div className="deck-label">{t('volume.quickActions')}</div>
                <div className="deck-transport-btns">
                  <button className="deck-action" onClick={() => updateVolume(Math.max(0, volume - 10))} disabled={muted}>
                    <Volume1 size={18} />
                    <span>-10%</span>
                  </button>
                  <button className={`deck-action ${muted ? 'active' : ''}`} onClick={handleToggleMute}>
                    <VolumeX size={18} />
                    <span>{t('volume.mute')}</span>
                  </button>
                  <button className="deck-action" onClick={() => updateVolume(Math.min(100, volume + 10))} disabled={muted}>
                    <Volume2 size={18} />
                    <span>+10%</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default VolumeModule;
