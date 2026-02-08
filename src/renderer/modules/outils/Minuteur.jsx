import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Bell, BellOff } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatTime, playAlarm } from './timerUtils';
import './Minuteur.css';

function Minuteur() {
  const { t } = useTranslation();

  const [timerSeconds, setTimerSeconds] = useState(5 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerInitial, setTimerInitial] = useState(5 * 60);
  const [timerFinished, setTimerFinished] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customSeconds, setCustomSeconds] = useState(0);

  const timerIntervalRef = useRef(null);

  const timerPresets = [
    { label: '1 min', seconds: 60 },
    { label: '5 min', seconds: 5 * 60 },
    { label: '10 min', seconds: 10 * 60 },
    { label: '15 min', seconds: 15 * 60 },
    { label: '30 min', seconds: 30 * 60 },
    { label: '1 h', seconds: 60 * 60 },
  ];

  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            setTimerFinished(true);
            if (soundEnabled) playAlarm();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [timerRunning, soundEnabled]);

  const startTimer = () => {
    if (timerSeconds > 0) {
      setTimerRunning(true);
      setTimerFinished(false);
    }
  };

  const pauseTimer = () => setTimerRunning(false);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(timerInitial);
    setTimerFinished(false);
  };

  const setPreset = (seconds) => {
    setTimerRunning(false);
    setTimerSeconds(seconds);
    setTimerInitial(seconds);
    setTimerFinished(false);
  };

  const setCustomTimer = () => {
    const total = customMinutes * 60 + customSeconds;
    if (total > 0) setPreset(total);
  };

  const timerProgress = timerInitial > 0 ? (timerSeconds / timerInitial) * 100 : 0;

  return (
    <div className="timer-section">
      <div className="timer-left">
        <div className={`timer-display ${timerFinished ? 'finished' : ''} ${timerRunning ? 'running' : ''}`}>
          <div className="timer-circle">
            <svg className="timer-progress" viewBox="0 0 100 100">
              <circle className="timer-progress-bg" cx="50" cy="50" r="45" />
              <circle
                className="timer-progress-fill"
                cx="50" cy="50" r="45"
                style={{
                  strokeDasharray: `${2 * Math.PI * 45}`,
                  strokeDashoffset: `${2 * Math.PI * 45 * (1 - timerProgress / 100)}`
                }}
              />
            </svg>
            <div className="timer-time">{formatTime(timerSeconds, true)}</div>
            {timerFinished && <div className="timer-finished-text">{t('outils.finished')}</div>}
          </div>
        </div>

        <div className="timer-controls">
          {!timerRunning ? (
            <button className="control-btn play" onClick={startTimer} disabled={timerSeconds === 0}>
              <Play size={28} />
            </button>
          ) : (
            <button className="control-btn pause" onClick={pauseTimer}>
              <Pause size={28} />
            </button>
          )}
          <button className="control-btn reset" onClick={resetTimer}>
            <RotateCcw size={24} />
          </button>
          <button
            className={`control-btn sound ${soundEnabled ? '' : 'muted'}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? t('outils.soundEnabled') : t('outils.soundDisabled')}
          >
            {soundEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </button>
        </div>
      </div>

      <div className="timer-right">
        <div className="timer-presets">
          <div className="presets-label">{t('outils.presets')}</div>
          {timerPresets.map(preset => (
            <button
              key={preset.seconds}
              className={`preset-btn ${timerInitial === preset.seconds ? 'active' : ''}`}
              onClick={() => setPreset(preset.seconds)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="timer-custom">
          <span className="custom-label">{t('outils.custom')}</span>
          <div className="custom-row">
            <div className="custom-input-group">
              <button className="adjust-btn" onClick={() => setCustomMinutes(prev => Math.max(0, prev - 1))}>
                <Minus size={16} />
              </button>
              <div className="custom-value">
                <span className="custom-number">{customMinutes.toString().padStart(2, '0')}</span>
                <span className="custom-unit">min</span>
              </div>
              <button className="adjust-btn" onClick={() => setCustomMinutes(prev => Math.min(99, prev + 1))}>
                <Plus size={16} />
              </button>
            </div>
            <span className="custom-separator">:</span>
            <div className="custom-input-group">
              <button className="adjust-btn" onClick={() => setCustomSeconds(prev => Math.max(0, prev - 5))}>
                <Minus size={16} />
              </button>
              <div className="custom-value">
                <span className="custom-number">{customSeconds.toString().padStart(2, '0')}</span>
                <span className="custom-unit">sec</span>
              </div>
              <button className="adjust-btn" onClick={() => setCustomSeconds(prev => Math.min(59, prev + 5))}>
                <Plus size={16} />
              </button>
            </div>
            <button className="set-btn" onClick={setCustomTimer}>
              {t('outils.set')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Minuteur;
