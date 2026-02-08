import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, Wifi, Radio, Circle, Square, Eye, EyeOff,
  MonitorPlay, Layers, BarChart3, X, Loader,
} from 'lucide-react';
import OBSWebSocket from 'obs-websocket-js';
import { useTranslation } from '../i18n';
import './OBS.css';

const obs = new OBSWebSocket();

function OBSModule() {
  const { t } = useTranslation();

  // Connection
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [inputUrl, setInputUrl] = useState(() => localStorage.getItem('obs_ws_url') || 'ws://localhost:4455');
  const [inputPassword, setInputPassword] = useState(() => localStorage.getItem('obs_ws_password') || '');

  // OBS state
  const [scenes, setScenes] = useState([]);
  const [currentScene, setCurrentScene] = useState('');
  const [sources, setSources] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [streamTimecode, setStreamTimecode] = useState(null);
  const [recordTimecode, setRecordTimecode] = useState(null);
  const [stats, setStats] = useState(null);

  // Refs
  const statsIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnectedRef = useRef(false);

  // Fetch sources for a scene
  const fetchSources = useCallback(async (sceneName) => {
    try {
      const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
      setSources(sceneItems.map(item => ({
        id: item.sceneItemId,
        name: item.sourceName,
        enabled: item.sceneItemEnabled,
        type: item.inputKind || item.sourceType,
      })).reverse());
    } catch {
      setSources([]);
    }
  }, []);

  // Fetch all OBS state
  const fetchState = useCallback(async () => {
    try {
      // Scenes
      const sceneList = await obs.call('GetSceneList');
      setScenes(sceneList.scenes.reverse());
      setCurrentScene(sceneList.currentProgramSceneName);

      // Sources for current scene
      await fetchSources(sceneList.currentProgramSceneName);

      // Stream status
      try {
        const streamStatus = await obs.call('GetStreamStatus');
        setStreaming(streamStatus.outputActive);
        setStreamTimecode(streamStatus.outputActive ? streamStatus.outputTimecode : null);
      } catch { setStreaming(false); }

      // Record status
      try {
        const recordStatus = await obs.call('GetRecordStatus');
        setRecording(recordStatus.outputActive);
        setRecordTimecode(recordStatus.outputActive ? recordStatus.outputTimecode : null);
      } catch { setRecording(false); }
    } catch (err) {
      console.error('[OBS] fetchState error:', err.message);
    }
  }, [fetchSources]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const s = await obs.call('GetStats');
      setStats({
        fps: s.activeFps,
        renderSkipped: s.renderSkippedFrames,
        renderTotal: s.renderTotalFrames,
        outputSkipped: s.outputSkippedFrames,
        outputTotal: s.outputTotalFrames,
        cpuUsage: s.cpuUsage,
        memoryUsage: s.memoryUsage,
      });

      // Update timecodes
      if (streaming) {
        try {
          const ss = await obs.call('GetStreamStatus');
          setStreamTimecode(ss.outputActive ? ss.outputTimecode : null);
          setStreaming(ss.outputActive);
        } catch {}
      }
      if (recording) {
        try {
          const rs = await obs.call('GetRecordStatus');
          setRecordTimecode(rs.outputActive ? rs.outputTimecode : null);
          setRecording(rs.outputActive);
        } catch {}
      }
    } catch {}
  }, [streaming, recording]);

  // Connect
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const url = inputUrl.trim();
      const password = inputPassword.trim() || undefined;
      await Promise.race([
        obs.connect(url, password),
        new Promise((_, reject) => setTimeout(() => reject(new Error(t('obs.connectionFailed'))), 5000)),
      ]);

      localStorage.setItem('obs_ws_url', url);
      if (password) localStorage.setItem('obs_ws_password', password);
      else localStorage.removeItem('obs_ws_password');

      setConnected(true);
      isConnectedRef.current = true;
      await fetchState();

      // Start stats polling
      statsIntervalRef.current = setInterval(fetchStats, 2000);
    } catch (err) {
      console.error('[OBS] Connect error:', err);
      setError(err.message || t('obs.connectionFailed'));
      setConnected(false);
      isConnectedRef.current = false;
    } finally {
      setConnecting(false);
    }
  }, [inputUrl, inputPassword, fetchState, fetchStats, t]);

  // Disconnect
  const handleDisconnect = useCallback(() => {
    clearInterval(statsIntervalRef.current);
    clearTimeout(reconnectTimeoutRef.current);
    isConnectedRef.current = false;
    try { obs.disconnect(); } catch {}
    setConnected(false);
    setScenes([]);
    setSources([]);
    setStats(null);
    setStreaming(false);
    setRecording(false);
  }, []);

  // Event listeners
  useEffect(() => {
    const onSceneChanged = (data) => {
      setCurrentScene(data.sceneName);
      fetchSources(data.sceneName);
    };

    const onSceneListChanged = async () => {
      try {
        const sceneList = await obs.call('GetSceneList');
        setScenes(sceneList.scenes.reverse());
      } catch {}
    };

    const onStreamStateChanged = (data) => {
      const active = data.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED' || data.outputState === 'OBS_WEBSOCKET_OUTPUT_RESUMED';
      setStreaming(active);
      if (!active) setStreamTimecode(null);
    };

    const onRecordStateChanged = (data) => {
      const active = data.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED' || data.outputState === 'OBS_WEBSOCKET_OUTPUT_RESUMED';
      setRecording(active);
      if (!active) setRecordTimecode(null);
    };

    const onSourceEnabled = (data) => {
      setSources(prev => prev.map(s =>
        s.id === data.sceneItemId ? { ...s, enabled: data.sceneItemEnabled } : s
      ));
    };

    const onConnectionClosed = () => {
      setConnected(false);
      clearInterval(statsIntervalRef.current);
      // Auto-reconnect if was connected
      if (isConnectedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isConnectedRef.current) handleConnect();
        }, 5000);
      }
    };

    obs.on('CurrentProgramSceneChanged', onSceneChanged);
    obs.on('SceneListChanged', onSceneListChanged);
    obs.on('StreamStateChanged', onStreamStateChanged);
    obs.on('RecordStateChanged', onRecordStateChanged);
    obs.on('SceneItemEnableStateChanged', onSourceEnabled);
    obs.on('ConnectionClosed', onConnectionClosed);

    return () => {
      obs.off('CurrentProgramSceneChanged', onSceneChanged);
      obs.off('SceneListChanged', onSceneListChanged);
      obs.off('StreamStateChanged', onStreamStateChanged);
      obs.off('RecordStateChanged', onRecordStateChanged);
      obs.off('SceneItemEnableStateChanged', onSourceEnabled);
      obs.off('ConnectionClosed', onConnectionClosed);
    };
  }, [fetchSources, handleConnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(statsIntervalRef.current);
      clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Auto-connect on mount if URL saved
  useEffect(() => {
    const savedUrl = localStorage.getItem('obs_ws_url');
    if (savedUrl && !connected && !connecting) {
      handleConnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Actions
  const switchScene = async (sceneName) => {
    try {
      await obs.call('SetCurrentProgramScene', { sceneName });
    } catch (err) {
      console.error('[OBS] switchScene error:', err.message);
    }
  };

  const toggleSource = async (sceneItemId, currentEnabled) => {
    try {
      await obs.call('SetSceneItemEnabled', {
        sceneName: currentScene,
        sceneItemId,
        sceneItemEnabled: !currentEnabled,
      });
    } catch (err) {
      console.error('[OBS] toggleSource error:', err.message);
    }
  };

  const toggleStream = async () => {
    try { await obs.call('ToggleStream'); } catch (err) {
      console.error('[OBS] toggleStream error:', err.message);
    }
  };

  const toggleRecord = async () => {
    try { await obs.call('ToggleRecord'); } catch (err) {
      console.error('[OBS] toggleRecord error:', err.message);
    }
  };

  // Parse OBS timecode "HH:MM:SS.mmm" to display
  const parseTimecode = (tc) => {
    if (!tc) return null;
    return tc.split('.')[0]; // Remove milliseconds
  };

  // === SETUP SCREEN ===
  if (!connected) {
    return (
      <div className="obs-module">
        <div className="obs-setup">
          <Video size={48} strokeWidth={1.5} />
          <h3>{t('obs.title')}</h3>
          <p>{t('obs.setupHint')}</p>
          <div className="obs-setup-form">
            <input
              type="text"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              placeholder={t('obs.urlPlaceholder')}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
            />
            <input
              type="password"
              value={inputPassword}
              onChange={e => setInputPassword(e.target.value)}
              placeholder={t('obs.passwordPlaceholder')}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
            />
            <button
              className="obs-setup-btn"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? <Loader size={18} className="spinning" /> : <Wifi size={18} />}
              {connecting ? t('obs.connecting') : t('obs.connect')}
            </button>
          </div>
          {error && <p className="obs-error">{error}</p>}
        </div>
      </div>
    );
  }

  // === CONNECTED MODULE ===
  return (
    <div className="obs-module">
      {/* Header */}
      <div className="obs-header">
        <div className="obs-header-left">
          <Video size={20} />
          <h2>{t('obs.title')}</h2>
          <span className="obs-badge connected">
            <Wifi size={12} /> {t('obs.connected')}
          </span>
        </div>
        <button className="obs-disconnect-btn" onClick={handleDisconnect}>
          <X size={16} />
          {t('obs.disconnect')}
        </button>
      </div>

      {/* Main content - 3 columns */}
      <div className="obs-content">
        {/* LEFT: Scenes */}
        <div className="obs-panel">
          <div className="obs-panel-header">
            <Layers size={16} />
            <span>{t('obs.scenes')}</span>
          </div>
          <div className="obs-scenes-grid">
            {scenes.map(scene => (
              <button
                key={scene.sceneName}
                className={`obs-scene-btn ${scene.sceneName === currentScene ? 'active' : ''}`}
                onClick={() => switchScene(scene.sceneName)}
              >
                <MonitorPlay size={16} />
                <span>{scene.sceneName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CENTER: Sources */}
        <div className="obs-panel">
          <div className="obs-panel-header">
            <Layers size={16} />
            <span>{t('obs.sources')}</span>
          </div>
          <div className="obs-sources-list">
            {sources.length === 0 ? (
              <div className="obs-empty">{t('obs.noSources')}</div>
            ) : (
              sources.map(source => (
                <div key={source.id} className={`obs-source-item ${!source.enabled ? 'disabled' : ''}`}>
                  <span className="obs-source-name">{source.name}</span>
                  <button
                    className="obs-source-toggle"
                    onClick={() => toggleSource(source.id, source.enabled)}
                    title={source.enabled ? 'Hide' : 'Show'}
                  >
                    {source.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Controls + Stats */}
        <div className="obs-right">
          {/* Stream/Record controls */}
          <div className="obs-controls">
            <button
              className={`obs-control-btn stream ${streaming ? 'active' : ''}`}
              onClick={toggleStream}
            >
              {streaming ? <Square size={18} /> : <Radio size={18} />}
              <span>{streaming ? t('obs.stopStream') : t('obs.startStream')}</span>
              {streaming && streamTimecode && (
                <span className="obs-timecode">{parseTimecode(streamTimecode)}</span>
              )}
            </button>

            <button
              className={`obs-control-btn record ${recording ? 'active' : ''}`}
              onClick={toggleRecord}
            >
              {recording ? <Square size={18} /> : <Circle size={18} />}
              <span>{recording ? t('obs.stopRecord') : t('obs.startRecord')}</span>
              {recording && recordTimecode && (
                <span className="obs-timecode">{parseTimecode(recordTimecode)}</span>
              )}
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="obs-stats">
              <div className="obs-panel-header">
                <BarChart3 size={16} />
                <span>{t('obs.stats')}</span>
              </div>
              <div className="obs-stats-grid">
                <div className="obs-stat">
                  <span className="obs-stat-label">{t('obs.fps')}</span>
                  <span className="obs-stat-value">{stats.fps?.toFixed(1)}</span>
                </div>
                <div className="obs-stat">
                  <span className="obs-stat-label">{t('obs.cpuUsage')}</span>
                  <span className="obs-stat-value">{stats.cpuUsage?.toFixed(1)}%</span>
                </div>
                <div className="obs-stat">
                  <span className="obs-stat-label">{t('obs.droppedFrames')}</span>
                  <span className="obs-stat-value">
                    {stats.outputSkipped || 0}
                    <span className="obs-stat-sub">/ {stats.outputTotal || 0}</span>
                  </span>
                </div>
                <div className="obs-stat">
                  <span className="obs-stat-label">RAM</span>
                  <span className="obs-stat-value">{stats.memoryUsage?.toFixed(0)} MB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OBSModule;
