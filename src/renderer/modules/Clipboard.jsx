import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clipboard, Copy, Trash2, Image, FileText } from 'lucide-react';
import './Clipboard.css';
import { useTranslation } from '../i18n';

const MAX_HISTORY = 20;

function getRelativeTime(timestamp, t) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('clipboard.justNow');
  if (diffMin < 60) return t('clipboard.minutesAgo', { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('clipboard.hoursAgo', { count: diffH });
  return t('clipboard.daysAgo', { count: Math.floor(diffH / 24) });
}

function ClipboardModule() {
  const { t } = useTranslation();
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('clipboard_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [lastClipboard, setLastClipboard] = useState(() => {
    return localStorage.getItem('clipboard_last') || '';
  });
  const pollInterval = useRef(null);

  useEffect(() => {
    localStorage.setItem('clipboard_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('clipboard_last', lastClipboard);
  }, [lastClipboard]);

  const checkClipboard = useCallback(async () => {
    try {
      const result = await window.electronAPI.clipboardRead();
      if (!result.success) return;

      const content = result.text || '';
      const hasImage = result.hasImage;

      // Ne pas ajouter si identique au dernier ou vide
      if (!content && !hasImage) return;
      if (content === lastClipboard) return;

      setLastClipboard(content);

      // Créer l'entrée
      const entry = {
        id: Date.now(),
        type: hasImage && !content ? 'image' : 'text',
        content: content,
        imageDataUrl: hasImage ? result.imageDataUrl : null,
        timestamp: Date.now(),
      };

      // Éviter les doublons
      setHistory(prev => {
        const exists = prev.some(h => h.content === content && h.type === entry.type);
        if (exists) return prev;
        return [entry, ...prev].slice(0, MAX_HISTORY);
      });
    } catch (error) {
      console.error('Clipboard poll error:', error);
    }
  }, [lastClipboard]);

  useEffect(() => {
    // Vérifier immédiatement
    checkClipboard();
    // Puis toutes les secondes
    pollInterval.current = setInterval(checkClipboard, 1000);
    return () => clearInterval(pollInterval.current);
  }, [checkClipboard]);

  const copyToClipboard = async (entry) => {
    try {
      await window.electronAPI.clipboardWrite(entry.content);
      setLastClipboard(entry.content);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  const removeEntry = (id) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const clearHistory = async () => {
    setHistory([]);
    localStorage.removeItem('clipboard_history');
    // Mémoriser le contenu actuel pour éviter de le ré-ajouter
    try {
      const result = await window.electronAPI.clipboardRead();
      if (result.success && result.text) {
        setLastClipboard(result.text);
      }
    } catch (e) {}
  };

  return (
    <div className="clipboard-module">
      <div className="clipboard-header">
        <div className="clipboard-title">
          <Clipboard size={20} />
          <h2>{t('clipboard.title')}</h2>
        </div>
        {history.length > 0 && (
          <button className="clipboard-clear" onClick={clearHistory} title={t('clipboard.clearHistory')}>
            <Trash2 size={16} />
            {t('clipboard.clear')}
          </button>
        )}
      </div>

      <div className="clipboard-list">
        {history.length === 0 && (
          <div className="clipboard-empty">
            <Clipboard size={32} />
            <p>{t('clipboard.emptyHistory')}</p>
            <span>{t('clipboard.emptyHint')}</span>
          </div>
        )}
        {history.map((entry) => (
          <div key={entry.id} className="clipboard-item">
            <div className="clipboard-item-icon">
              {entry.type === 'image' ? <Image size={16} /> : <FileText size={16} />}
            </div>
            <div className="clipboard-item-content">
              {entry.type === 'image' && entry.imageDataUrl ? (
                <img src={entry.imageDataUrl} alt={t('common.copiedImage')} className="clipboard-image-preview" />
              ) : (
                <p className="clipboard-text">{entry.content}</p>
              )}
              <span className="clipboard-time">{getRelativeTime(entry.timestamp, t)}</span>
            </div>
            <div className="clipboard-item-actions">
              <button
                className="clipboard-action copy"
                onClick={() => copyToClipboard(entry)}
                title={t('common.copy')}
              >
                <Copy size={14} />
              </button>
              <button
                className="clipboard-action delete"
                onClick={() => removeEntry(entry.id)}
                title={t('common.delete')}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ClipboardModule;
