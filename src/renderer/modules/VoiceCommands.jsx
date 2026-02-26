import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, Settings, Trash2, Check, X, AlertCircle,
  Volume2, Power, Home, Video, HelpCircle, ChevronRight,
  Download, Plus, Loader, Wifi, WifiOff, Info, Zap,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import './VoiceCommands.css';

const MAX_HISTORY = 50;

const CATEGORY_ICONS = {
  system: Power,
  media: Mic,
  volume: Volume2,
  homeassistant: Home,
  obs: Video,
  unknown: HelpCircle,
  log: Info,
  action: Zap,
};

// Langues supportées par Web Speech API (BCP 47)
const LANG_MAP = {
  fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES',
  pt: 'pt-PT', it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL', ja: 'ja-JP',
};

function VoiceCommandsModule({ isActive }) {
  const { t, lang } = useTranslation();

  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [voiceError, setVoiceError] = useState('');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [partialText, setPartialText] = useState('');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('voice_history') || '[]'); }
    catch { return []; }
  });
  const [showConfig, setShowConfig] = useState(false);
  const [entityAliases, setEntityAliases] = useState({});
  const [newAliasName, setNewAliasName] = useState('');
  const [newAliasEntity, setNewAliasEntity] = useState('');
  const [haEntities, setHaEntities] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  // HA config lue depuis le module HomeAssistant (localStorage)
  const haUrl = localStorage.getItem('ha_url') || '';
  const haToken = localStorage.getItem('ha_token') || '';
  const haConfigured = !!(haUrl && haToken);

  const historyRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  // Backend: 'vosk' ou 'webspeech'
  const backendRef = useRef('vosk');
  const webSpeechRef = useRef(null);
  const webSpeechActiveRef = useRef(false);

  // ========== Charger les périphériques audio ==========
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const inputs = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(inputs);
      // Restaurer le dernier device sélectionné
      const saved = localStorage.getItem('voice_input_device');
      if (saved && inputs.find(d => d.deviceId === saved)) {
        setSelectedDeviceId(saved);
      }
    }).catch(() => {});
  }, []);

  const addHistory = useCallback((text, category, status) => {
    setHistory(prev => {
      const item = { text, category, status, timestamp: Date.now() };
      return [item, ...prev].slice(0, MAX_HISTORY);
    });
  }, []);

  // ========== Capture audio pour Vosk (getUserMedia → PCM Int16 → IPC) ==========
  const startAudioCapture = useCallback(async () => {
    try {
      const constraints = { audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Encoder en base64 (seule sérialisation fiable via contextBridge + IPC)
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        window.electronAPI?.sendVoiceAudio(btoa(binary));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error('Audio capture error:', err);
      addHistory(`Erreur capture audio : ${err.message}`, 'log', 'fail');
    }
  }, [selectedDeviceId]);

  const stopAudioCapture = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(tr => tr.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // ========== Web Speech API fallback ==========
  const startWebSpeech = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addHistory('✗ Web Speech API non disponible dans ce navigateur', 'log', 'fail');
      setVoiceStatus('error');
      setVoiceError(t('voicecommands.webSpeechUnavailable'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = LANG_MAP[lang] || 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setPartialText('');
          handleFinalResult(transcript.trim());
        } else {
          interim += transcript;
        }
      }
      if (interim) {
        setPartialText(interim);
      }
    };

    recognition.onerror = (event) => {
      console.error('Web Speech error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      addHistory(`✗ Web Speech erreur : ${event.error}`, 'log', 'fail');
      setVoiceError(event.error);
      setVoiceStatus('error');
      setIsListening(false);
      webSpeechActiveRef.current = false;
    };

    recognition.onend = () => {
      if (webSpeechActiveRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    try {
      recognition.start();
      webSpeechRef.current = recognition;
      webSpeechActiveRef.current = true;
      setIsListening(true);
      setVoiceStatus('listening');
      setVoiceError('');
      backendRef.current = 'webspeech';
      addHistory('🟢 Web Speech API active (online)', 'log', 'success');
    } catch (err) {
      addHistory(`✗ Web Speech démarrage échoué : ${err.message}`, 'log', 'fail');
      setVoiceStatus('error');
      setVoiceError(err.message);
    }
  }, [lang]);

  const stopWebSpeech = useCallback(() => {
    webSpeechActiveRef.current = false;
    if (webSpeechRef.current) {
      try { webSpeechRef.current.stop(); } catch {}
      webSpeechRef.current = null;
    }
    setIsListening(false);
    setVoiceStatus('idle');
    setPartialText('');
  }, []);

  // ========== Charger la config vocale au montage ==========
  useEffect(() => {
    if (!window.electronAPI?.getVoiceConfig) return;
    window.electronAPI.getVoiceConfig().then((config) => {
      if (config) {
        setEntityAliases(config.entityAliases || {});
      }
    });
    // Synchroniser URL/token HA vers la config voice (pour le main process)
    if (haUrl && haToken && window.electronAPI?.setVoiceConfig) {
      window.electronAPI.getVoiceConfig().then((config) => {
        if (!config || config.haUrl !== haUrl || config.haToken !== haToken) {
          window.electronAPI.setVoiceConfig({ entityAliases: config?.entityAliases || {}, haUrl, haToken });
        }
      });
    }
  }, []);

  // Écouter les résultats vocaux (Vosk via IPC)
  useEffect(() => {
    if (!window.electronAPI?.onVoiceResult) return;
    const handler = (data) => {
      if (backendRef.current !== 'vosk') return;
      if (data.type === 'partial') {
        setPartialText(data.text);
      } else if (data.type === 'final') {
        setPartialText('');
        handleFinalResult(data.text);
      }
    };
    const unlistenPromise = window.electronAPI.onVoiceResult(handler);
    return () => {
      unlistenPromise?.then(fn => fn());
    };
  }, [lang]);

  // Écouter les changements de statut (Vosk via main process)
  useEffect(() => {
    if (!window.electronAPI?.onVoiceStatus) return;
    const unlistenPromise = window.electronAPI.onVoiceStatus((data) => {
      // Toujours traiter downloading/extracting/model-ready (quel que soit le backend)
      if (data.status === 'downloading-model' || data.status === 'extracting-model' || data.status === 'model-ready') {
        setVoiceStatus(data.status);
        if (data.percent !== undefined) setDownloadPercent(data.percent);
        return;
      }
      // Ignorer les autres status si on est en mode webspeech
      if (backendRef.current === 'webspeech') return;
      setVoiceStatus(data.status);
      if (data.status === 'error' && data.error) {
        setVoiceError(data.error);
      }
      if (data.status === 'listening') {
        setIsListening(true);
        setVoiceError('');
      } else if (data.status === 'idle' || data.status === 'error') {
        setIsListening(false);
        stopAudioCapture();
      }
    });
    return () => {
      unlistenPromise?.then(fn => fn());
    };
  }, []);

  // Relancer la reconnaissance si la langue change en cours d'écoute
  const prevLangRef = useRef(lang);
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;

    if (!isListening) return;

    // Redémarrer avec la nouvelle langue
    const restartWithNewLang = async () => {
      if (backendRef.current === 'webspeech') {
        // Web Speech : arrêter et relancer (la langue est lue depuis `lang` via LANG_MAP)
        stopWebSpeech();
        setTimeout(() => startWebSpeech(), 300);
      } else if (window.electronAPI) {
        // Vosk : arrêter capture + recognizer, relancer avec nouveau modèle
        stopAudioCapture();
        await window.electronAPI.stopVoice();
        setVoiceStatus('initializing');
        const result = await window.electronAPI.startVoice(lang);
        if (result.success) {
          backendRef.current = 'vosk';
          setIsListening(true);
          setVoiceStatus('listening');
          await startAudioCapture();
          addHistory(`🔄 ${lang.toUpperCase()}`, 'log', 'info');
        } else if (result.useWebSpeech) {
          startWebSpeech();
        } else {
          setVoiceError(result.error || 'Unknown error');
          setVoiceStatus('error');
          setIsListening(false);
        }
      }
    };

    restartWithNewLang();
  }, [lang, isListening, stopAudioCapture, startAudioCapture, stopWebSpeech, startWebSpeech, addHistory]);

  // Sauvegarder l'historique
  useEffect(() => {
    localStorage.setItem('voice_history', JSON.stringify(history));
  }, [history]);

  const handleFinalResult = useCallback(async (text) => {
    if (!text || !window.electronAPI?.parseVoiceCommand) return;

    // Log ce que l'utilisateur a dit
    addHistory(`🎤 "${text}"`, 'log', 'info');

    const intent = await window.electronAPI.parseVoiceCommand(text, lang);

    if (intent.category === 'unknown') {
      addHistory(`❓ Commande non reconnue`, 'unknown', 'unknown');
      return;
    }

    // Log l'intention parsée
    const intentDesc = `→ ${intent.category}.${intent.action}${intent.entity ? ` (${intent.entity})` : ''}${intent.value !== null ? ` = ${intent.value}` : ''}`;
    addHistory(intentDesc, 'action', 'info');

    // Exécuter la commande
    try {
      const result = await window.electronAPI.executeVoiceCommand(intent);
      if (result.success) {
        addHistory(`✓ Exécuté avec succès`, intent.category, 'success');
      } else {
        addHistory(`✗ Échec : ${result.error || 'erreur inconnue'}`, intent.category, 'fail');
      }
    } catch (err) {
      addHistory(`✗ Erreur : ${err.message || 'erreur inconnue'}`, intent.category, 'fail');
    }
  }, [lang]);

  // ========== Toggle écoute ==========
  const toggleListening = useCallback(async () => {
    if (!window.electronAPI) return;

    try {
      if (isListening) {
        // Arrêter
        addHistory('⏹ Écoute arrêtée', 'log', 'info');
        if (backendRef.current === 'webspeech') {
          stopWebSpeech();
        } else {
          stopAudioCapture();
          await window.electronAPI.stopVoice();
        }
      } else {
        backendRef.current = 'vosk';
        setVoiceStatus('initializing');
        setVoiceError('');

        let result;
        try {
          result = await window.electronAPI.startVoice(lang);
        } catch (err) {
          console.error('startVoice IPC error:', err);
          addHistory(`Erreur démarrage : ${err.message}`, 'log', 'fail');
          setVoiceError(err.message || 'IPC error');
          setVoiceStatus('error');
          return;
        }

        if (result.success) {
          backendRef.current = 'vosk';
          setIsListening(true);
          setVoiceStatus('listening');
          await startAudioCapture();
        } else if (result.useWebSpeech) {
          startWebSpeech();
        } else {
          addHistory(`Erreur : ${result.error || 'Unknown'}`, 'log', 'fail');
          setVoiceError(result.error || 'Unknown error');
          setVoiceStatus('error');
        }
      }
    } catch (err) {
      console.error('toggleListening error:', err);
      setVoiceError(err.message || 'Unknown error');
      setVoiceStatus('error');
      setIsListening(false);
    }
  }, [isListening, lang, startAudioCapture, stopAudioCapture, startWebSpeech, stopWebSpeech]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Charger les entités HA quand on ouvre la config
  useEffect(() => {
    if (!showConfig || !haConfigured) return;
    const url = haUrl;
    const token = haToken;
    if (!url || !token || !window.electronAPI?.fetchHomeAssistant) return;
    window.electronAPI.fetchHomeAssistant(url, token, 'states').then((result) => {
      if (result.success && Array.isArray(result.data)) {
        setHaEntities(result.data.map(e => ({
          id: e.entity_id,
          name: e.attributes?.friendly_name || e.entity_id,
        })).sort((a, b) => a.id.localeCompare(b.id)));
      }
    }).catch(() => {});
  }, [showConfig, haUrl, haToken]);

  const saveConfig = useCallback(() => {
    if (!window.electronAPI?.setVoiceConfig) return;
    window.electronAPI.setVoiceConfig({ entityAliases, haUrl, haToken });
  }, [entityAliases]);

  const addAlias = useCallback(() => {
    if (!newAliasName.trim() || !newAliasEntity.trim()) return;
    const updated = { ...entityAliases, [newAliasName.trim().toLowerCase()]: newAliasEntity.trim() };
    setEntityAliases(updated);
    setNewAliasName('');
    setNewAliasEntity('');
    if (window.electronAPI?.setVoiceConfig) {
      window.electronAPI.setVoiceConfig({ entityAliases: updated, haUrl, haToken });
    }
  }, [newAliasName, newAliasEntity, entityAliases]);

  const removeAlias = useCallback((name) => {
    const updated = { ...entityAliases };
    delete updated[name];
    setEntityAliases(updated);
    if (window.electronAPI?.setVoiceConfig) {
      window.electronAPI.setVoiceConfig({ entityAliases: updated, haUrl, haToken });
    }
  }, [entityAliases]);

  const handleDeviceChange = useCallback((deviceId) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('voice_input_device', deviceId);
  }, []);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const isDownloading = voiceStatus === 'downloading-model' || voiceStatus === 'extracting-model';
  const isInitializing = voiceStatus === 'initializing';
  const isWebSpeech = backendRef.current === 'webspeech' && isListening;

  return (
    <div className="voice-container" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="voice-header">
        <h2>
          <Mic size={20} />
          {t('voicecommands.title')}
        </h2>
        <div className="voice-header-right">
          {isWebSpeech && (
            <span className="voice-backend-badge webspeech" title="Web Speech API (online)">
              <Wifi size={12} />
              Web Speech
            </span>
          )}
          {isListening && backendRef.current === 'vosk' && (
            <span className="voice-backend-badge vosk" title="Vosk (offline)">
              <WifiOff size={12} />
              Vosk
            </span>
          )}
          <button className="voice-config-btn" onClick={() => setShowConfig(true)}>
            <Settings size={14} />
            {t('voicecommands.config')}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="voice-body">
        {/* Colonne gauche — micro + transcript */}
        <div className="voice-main">
          <button
            className={`voice-mic-button ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            disabled={isDownloading || isInitializing}
          >
            {isDownloading ? (
              <Download size={48} />
            ) : isInitializing ? (
              <Loader size={48} className="spin" />
            ) : isListening ? (
              <MicOff size={48} />
            ) : (
              <Mic size={48} />
            )}
          </button>

          <div className={`voice-status-text ${isListening ? 'active' : ''}`}>
            {isListening
              ? t('voicecommands.listening')
              : isInitializing
              ? t('voicecommands.initializing')
              : isDownloading
              ? ''
              : voiceStatus === 'error'
              ? t('voicecommands.error', { error: voiceError })
              : t('voicecommands.startListening')
            }
          </div>

          {/* Barre de progression téléchargement */}
          {isDownloading && (
            <div className="voice-download">
              <div className="voice-download-text">
                {voiceStatus === 'extracting-model'
                  ? t('voicecommands.extractingModel')
                  : t('voicecommands.downloadingModel', { percent: downloadPercent })
                }
              </div>
              <div className="voice-download-bar">
                <div
                  className="voice-download-fill"
                  style={{ width: `${voiceStatus === 'extracting-model' ? 100 : downloadPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Texte partiel en temps réel */}
          {partialText && (
            <div className="voice-partial">"{partialText}"</div>
          )}
        </div>

        {/* Colonne droite — historique */}
        <div className="voice-history">
          <div className="voice-history-header">
            <h3>{t('voicecommands.history')}</h3>
            {history.length > 0 && (
              <button className="voice-clear-btn" onClick={clearHistory} title={t('voicecommands.clearHistory')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="voice-history-list" ref={historyRef}>
            {history.length === 0 ? (
              <div className="voice-history-empty">
                <Mic size={24} />
                <span>{t('voicecommands.noHistory')}</span>
                <span style={{ fontSize: 11 }}>{t('voicecommands.noHistoryHint')}</span>
              </div>
            ) : (
              history.map((item, i) => {
                const IconComp = CATEGORY_ICONS[item.category] || HelpCircle;
                return (
                  <div key={`${item.timestamp}-${i}`} className="voice-history-item">
                    <div className={`voice-history-icon ${item.category}`}>
                      <IconComp size={14} />
                    </div>
                    <div className="voice-history-content">
                      <div className="voice-history-text" title={item.text}>{item.category === 'log' || item.category === 'action' ? item.text : `"${item.text}"`}</div>
                      <div className="voice-history-meta">
                        <span>{t(`voicecommands.categories.${item.category}`)}</span>
                        <span>{formatTime(item.timestamp)}</span>
                      </div>
                    </div>
                    <div className={`voice-history-badge ${item.status === 'success' ? 'success' : item.status === 'unknown' ? 'unknown-cmd' : item.status === 'info' ? 'info' : 'fail'}`}>
                      {item.status === 'success' ? <Check size={10} /> : item.status === 'unknown' ? <HelpCircle size={10} /> : item.status === 'info' ? <Info size={10} /> : <X size={10} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Panneau configuration */}
      {showConfig && (
        <div className="voice-config-overlay">
          <div className="voice-config-header">
            <h3>{t('voicecommands.config')}</h3>
            <button className="voice-config-close" onClick={() => { setShowConfig(false); saveConfig(); }}>
              <X size={16} />
            </button>
          </div>

          {/* Périphérique d'entrée audio */}
          <div className="voice-config-section">
            <h4>{t('voicecommands.inputDevice')}</h4>
            <div className="voice-config-field">
              <select
                className="voice-device-select"
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
              >
                <option value="">{t('voicecommands.defaultDevice')}</option>
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${t('voicecommands.microphone')} (${d.deviceId.slice(0, 8)}...)`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Alias d'entités HA (affiché uniquement si HA est configuré) */}
          {haConfigured && (
          <div className="voice-config-section">
            <h4>{t('voicecommands.entityAliases')}</h4>

            <div className="voice-alias-list">
              {Object.entries(entityAliases).map(([name, entity]) => (
                <div key={name} className="voice-alias-item">
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  <ChevronRight size={14} className="voice-alias-arrow" />
                  <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{entity}</span>
                  <button className="voice-alias-remove-btn" onClick={() => removeAlias(name)} title={t('voicecommands.removeAlias')}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="voice-config-field" style={{ marginTop: 10 }}>
              <input
                type="text"
                value={newAliasName}
                onChange={(e) => setNewAliasName(e.target.value)}
                placeholder={t('voicecommands.aliasName')}
                onKeyDown={(e) => e.key === 'Enter' && addAlias()}
              />
              <input
                type="text"
                list="ha-entities-list"
                value={newAliasEntity}
                onChange={(e) => setNewAliasEntity(e.target.value)}
                placeholder={t('voicecommands.aliasEntity')}
                onKeyDown={(e) => e.key === 'Enter' && addAlias()}
              />
              <datalist id="ha-entities-list">
                {haEntities.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </datalist>
              <button className="voice-alias-add-btn" onClick={addAlias}>
                <Plus size={14} />
                {t('voicecommands.addAlias')}
              </button>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VoiceCommandsModule;
