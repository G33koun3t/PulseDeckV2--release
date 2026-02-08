import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Settings, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatTime, playAlarm } from './timerUtils';
import './Pomodoro.css';

const DEFAULT_CONFIG = {
  workDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  sessionsBeforeLong: 4,
  autoTransition: true,
};

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('outils_pomodoro'));
    return { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config) {
  localStorage.setItem('outils_pomodoro', JSON.stringify(config));
}

// Persistance endTime pour survivre aux changements de module
function loadRunningState() {
  try {
    const saved = JSON.parse(localStorage.getItem('outils_pomodoro_running'));
    if (!saved) return null;
    const remaining = Math.round((saved.endTime - Date.now()) / 1000);
    if (remaining <= 0) return null;
    return { ...saved, remaining };
  } catch {
    return null;
  }
}

function saveRunningState(phase, endTime, sessionsCompleted) {
  localStorage.setItem('outils_pomodoro_running', JSON.stringify({ phase, endTime, sessionsCompleted }));
}

function clearRunningState() {
  localStorage.removeItem('outils_pomodoro_running');
}

const PHASE_COLORS = {
  work: 'var(--success)',
  shortBreak: 'var(--accent-primary)',
  longBreak: 'var(--warning)',
};

function Pomodoro() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(loadConfig);
  const [phase, setPhase] = useState('work');
  const [secondsLeft, setSecondsLeft] = useState(config.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const intervalRef = useRef(null);
  const endTimeRef = useRef(null);

  const getTotalSeconds = useCallback((p, cfg) => {
    switch (p) {
      case 'work': return cfg.workDuration * 60;
      case 'shortBreak': return cfg.shortBreak * 60;
      case 'longBreak': return cfg.longBreak * 60;
      default: return cfg.workDuration * 60;
    }
  }, []);

  // Restaurer l'état si le timer tournait
  useEffect(() => {
    const saved = loadRunningState();
    if (saved) {
      setPhase(saved.phase);
      setSecondsLeft(saved.remaining);
      setSessionsCompleted(saved.sessionsCompleted || 0);
      setIsRunning(true);
      endTimeRef.current = saved.endTime;
    }
  }, []);

  // Tick
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      if (endTimeRef.current) {
        const remaining = Math.round((endTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          setSecondsLeft(0);
          setIsRunning(false);
          clearInterval(intervalRef.current);
          endTimeRef.current = null;
          clearRunningState();
          playAlarm();

          // Auto-transition
          if (config.autoTransition) {
            setTimeout(() => {
              if (phase === 'work') {
                const newSessions = sessionsCompleted + 1;
                setSessionsCompleted(newSessions);
                if (newSessions % config.sessionsBeforeLong === 0) {
                  setPhase('longBreak');
                  setSecondsLeft(config.longBreak * 60);
                } else {
                  setPhase('shortBreak');
                  setSecondsLeft(config.shortBreak * 60);
                }
              } else {
                setPhase('work');
                setSecondsLeft(config.workDuration * 60);
              }
            }, 1500);
          }
        } else {
          setSecondsLeft(remaining);
        }
      }
    }, 250);

    return () => clearInterval(intervalRef.current);
  }, [isRunning, phase, sessionsCompleted, config]);

  const handleStart = () => {
    const end = Date.now() + secondsLeft * 1000;
    endTimeRef.current = end;
    saveRunningState(phase, end, sessionsCompleted);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    clearRunningState();
  };

  const handleReset = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    clearRunningState();
    setPhase('work');
    setSecondsLeft(config.workDuration * 60);
    setSessionsCompleted(0);
  };

  const handleSkip = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    clearRunningState();
    if (phase === 'work') {
      const newSessions = sessionsCompleted + 1;
      setSessionsCompleted(newSessions);
      if (newSessions % config.sessionsBeforeLong === 0) {
        setPhase('longBreak');
        setSecondsLeft(config.longBreak * 60);
      } else {
        setPhase('shortBreak');
        setSecondsLeft(config.shortBreak * 60);
      }
    } else {
      setPhase('work');
      setSecondsLeft(config.workDuration * 60);
    }
  };

  const handleConfigChange = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    saveConfig(newConfig);
    // Si pas en cours, mettre à jour le timer
    if (!isRunning && secondsLeft === getTotalSeconds(phase, config)) {
      setSecondsLeft(getTotalSeconds(phase, newConfig));
    }
  };

  const totalSeconds = getTotalSeconds(phase, config);
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const circumference = 2 * Math.PI * 140;
  const dashOffset = circumference * (1 - progress);
  const phaseColor = PHASE_COLORS[phase];

  const phaseLabel = {
    work: t('outils.work'),
    shortBreak: t('outils.shortBreak'),
    longBreak: t('outils.longBreak'),
  }[phase];

  return (
    <div className="pomodoro-section">
      <div className="pomodoro-left">
        {/* Cercle SVG */}
        <div className={`pomodoro-display ${isRunning ? 'running' : ''} phase-${phase}`}>
          <div className="pomodoro-circle">
            <svg className="pomodoro-progress" viewBox="0 0 300 300">
              <circle className="pomodoro-progress-bg" cx="150" cy="150" r="140" />
              <circle
                className="pomodoro-progress-fill"
                cx="150" cy="150" r="140"
                style={{
                  stroke: phaseColor,
                  strokeDasharray: circumference,
                  strokeDashoffset: dashOffset,
                }}
              />
            </svg>
            <div className="pomodoro-time-container">
              <span className="pomodoro-time">{formatTime(secondsLeft)}</span>
              <span className="pomodoro-phase-label" style={{ color: phaseColor }}>{phaseLabel}</span>
            </div>
          </div>
        </div>

        {/* Contrôles */}
        <div className="pomodoro-controls">
          <button className="control-btn reset" onClick={handleReset} title={t('outils.reset')}>
            <RotateCcw size={22} />
          </button>
          {isRunning ? (
            <button className="control-btn pause" onClick={handlePause}>
              <Pause size={28} />
            </button>
          ) : (
            <button className="control-btn play" onClick={handleStart}>
              <Play size={28} />
            </button>
          )}
          <button className="control-btn skip" onClick={handleSkip} title={t('outils.skip')}>
            <SkipForward size={22} />
          </button>
        </div>
      </div>

      <div className="pomodoro-right">
        {/* Sessions */}
        <div className="pomodoro-sessions">
          <span className="pomodoro-sessions-label">{t('outils.sessionCount')}</span>
          <div className="pomodoro-session-dots">
            {Array.from({ length: config.sessionsBeforeLong }, (_, i) => (
              <div
                key={i}
                className={`session-dot ${i < (sessionsCompleted % config.sessionsBeforeLong) ? 'completed' : ''}`}
              />
            ))}
          </div>
          <span className="pomodoro-session-count">
            {sessionsCompleted} {t('outils.session')}{sessionsCompleted > 1 ? 's' : ''}
          </span>
        </div>

        {/* Toggle config */}
        <button
          className={`pomodoro-config-toggle ${showConfig ? 'active' : ''}`}
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? <X size={18} /> : <Settings size={18} />}
          <span>{t('outils.pomodoroConfig')}</span>
        </button>

        {/* Panneau config */}
        {showConfig && (
          <div className="pomodoro-config-panel">
            <div className="pomodoro-config-row">
              <label>{t('outils.workDuration')}</label>
              <div className="config-stepper">
                <button onClick={() => config.workDuration > 1 && handleConfigChange('workDuration', config.workDuration - 1)}>−</button>
                <span>{config.workDuration} min</span>
                <button onClick={() => config.workDuration < 90 && handleConfigChange('workDuration', config.workDuration + 1)}>+</button>
              </div>
            </div>
            <div className="pomodoro-config-row">
              <label>{t('outils.shortBreakDuration')}</label>
              <div className="config-stepper">
                <button onClick={() => config.shortBreak > 1 && handleConfigChange('shortBreak', config.shortBreak - 1)}>−</button>
                <span>{config.shortBreak} min</span>
                <button onClick={() => config.shortBreak < 30 && handleConfigChange('shortBreak', config.shortBreak + 1)}>+</button>
              </div>
            </div>
            <div className="pomodoro-config-row">
              <label>{t('outils.longBreakDuration')}</label>
              <div className="config-stepper">
                <button onClick={() => config.longBreak > 1 && handleConfigChange('longBreak', config.longBreak - 1)}>−</button>
                <span>{config.longBreak} min</span>
                <button onClick={() => config.longBreak < 60 && handleConfigChange('longBreak', config.longBreak + 1)}>+</button>
              </div>
            </div>
            <div className="pomodoro-config-row">
              <label>{t('outils.sessionsBeforeLong')}</label>
              <div className="config-stepper">
                <button onClick={() => config.sessionsBeforeLong > 2 && handleConfigChange('sessionsBeforeLong', config.sessionsBeforeLong - 1)}>−</button>
                <span>{config.sessionsBeforeLong}</span>
                <button onClick={() => config.sessionsBeforeLong < 8 && handleConfigChange('sessionsBeforeLong', config.sessionsBeforeLong + 1)}>+</button>
              </div>
            </div>
            <div className="pomodoro-config-row">
              <label>{t('outils.autoTransition')}</label>
              <button
                className={`pomodoro-auto-toggle ${config.autoTransition ? 'active' : ''}`}
                onClick={() => handleConfigChange('autoTransition', !config.autoTransition)}
              >
                <div className="pomodoro-auto-toggle-knob" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pomodoro;
