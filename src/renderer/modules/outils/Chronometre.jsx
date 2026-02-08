import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { formatTimeMs } from './timerUtils';
import './Chronometre.css';

function Chronometre() {
  const { t } = useTranslation();

  const [stopwatchMs, setStopwatchMs] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState([]);

  const stopwatchIntervalRef = useRef(null);

  useEffect(() => {
    if (stopwatchRunning) {
      const startTime = Date.now() - stopwatchMs;
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchMs(Date.now() - startTime);
      }, 10);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [stopwatchRunning]);

  const addLap = () => {
    if (stopwatchRunning) {
      setLaps(prev => [...prev, stopwatchMs]);
    }
  };

  return (
    <div className="stopwatch-section">
      <div className="stopwatch-left">
        <div className={`stopwatch-display ${stopwatchRunning ? 'running' : ''}`}>
          <div className="stopwatch-time">{formatTimeMs(stopwatchMs)}</div>
        </div>

        <div className="stopwatch-controls">
          {!stopwatchRunning ? (
            <button className="control-btn play" onClick={() => setStopwatchRunning(true)}>
              <Play size={28} />
            </button>
          ) : (
            <button className="control-btn pause" onClick={() => setStopwatchRunning(false)}>
              <Pause size={28} />
            </button>
          )}
          <button className="control-btn lap" onClick={addLap} disabled={!stopwatchRunning}>
            <Flag size={24} />
          </button>
          <button className="control-btn reset" onClick={() => { setStopwatchRunning(false); setStopwatchMs(0); setLaps([]); }}>
            <RotateCcw size={24} />
          </button>
        </div>
      </div>

      <div className="stopwatch-right">
        {laps.length > 0 ? (
          <div className="laps-container">
            <div className="laps-header">
              <span>{t('outils.lap')}</span>
              <span>{t('outils.time')}</span>
              <span>{t('outils.interval')}</span>
            </div>
            <div className="laps-list">
              {laps.map((lapTime, index) => {
                const prevLap = index > 0 ? laps[index - 1] : 0;
                const interval = lapTime - prevLap;
                return (
                  <div key={index} className="lap-row">
                    <span className="lap-number">#{index + 1}</span>
                    <span className="lap-time">{formatTimeMs(lapTime)}</span>
                    <span className="lap-interval">+{formatTimeMs(interval)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="laps-placeholder">
            <Flag size={32} />
            <span>{t('outils.lapsPlaceholder')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chronometre;
