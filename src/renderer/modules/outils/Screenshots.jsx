import React, { useState, useEffect, useCallback } from 'react';
import { Camera, FolderOpen, Trash2, X, RefreshCw, Image } from 'lucide-react';
import { useTranslation } from '../../i18n';
import './Screenshots.css';

function Screenshots() {
  const { t } = useTranslation();
  const [folder, setFolder] = useState(() => localStorage.getItem('outils_screenshots_folder') || '');
  const [screenshots, setScreenshots] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadScreenshots = useCallback(async () => {
    if (!folder || !window.electronAPI?.listScreenshots) return;
    const files = await window.electronAPI.listScreenshots(folder);
    setScreenshots(files);

    // Charger thumbnails
    const thumbs = {};
    for (const file of files.slice(0, 50)) {
      const thumb = await window.electronAPI.getScreenshotThumbnail(file.path);
      if (thumb) thumbs[file.path] = thumb;
    }
    setThumbnails(thumbs);
  }, [folder]);

  useEffect(() => {
    if (folder) loadScreenshots();
  }, [folder, loadScreenshots]);

  const handleSelectFolder = async () => {
    const selected = await window.electronAPI?.selectScreenshotFolder();
    if (selected) {
      setFolder(selected);
      localStorage.setItem('outils_screenshots_folder', selected);
    }
  };

  const handleCapture = async () => {
    if (!folder) return;
    setLoading(true);
    const result = await window.electronAPI?.takeScreenshot(folder);
    setLoading(false);
    if (result?.success) {
      loadScreenshots();
    }
  };

  const handleDelete = async (filePath) => {
    await window.electronAPI?.deleteScreenshot(filePath);
    setConfirmDelete(null);
    setScreenshots(prev => prev.filter(s => s.path !== filePath));
    setThumbnails(prev => {
      const next = { ...prev };
      delete next[filePath];
      return next;
    });
    if (preview === filePath) setPreview(null);
  };

  const handleOpenFolder = () => {
    if (folder) window.electronAPI?.openScreenshotFolder(folder);
  };

  if (!folder) {
    return (
      <div className="screenshots-section">
        <div className="screenshots-setup">
          <Image size={48} />
          <p>{t('outils.noFolder')}</p>
          <small>{t('outils.noFolderHint')}</small>
          <button className="screenshots-setup-btn" onClick={handleSelectFolder}>
            <FolderOpen size={20} />
            <span>{t('outils.selectFolder')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screenshots-section">
      {/* Colonne gauche : actions */}
      <div className="screenshots-left">
        <button
          className="screenshot-capture-btn"
          onClick={handleCapture}
          disabled={loading}
        >
          <Camera size={28} />
          <span>{loading ? '...' : t('outils.takeScreenshot')}</span>
        </button>

        <div className="screenshot-folder-info">
          <span className="screenshot-folder-label">{t('outils.screenshotFolder')}</span>
          <span className="screenshot-folder-path">{folder}</span>
        </div>

        <div className="screenshot-actions">
          <button className="screenshot-action-btn" onClick={handleSelectFolder}>
            <FolderOpen size={18} />
            <span>{t('outils.selectFolder')}</span>
          </button>
          <button className="screenshot-action-btn" onClick={handleOpenFolder}>
            <FolderOpen size={18} />
            <span>{t('outils.openFolder')}</span>
          </button>
          <button className="screenshot-action-btn" onClick={loadScreenshots}>
            <RefreshCw size={18} />
            <span>{t('common.refresh')}</span>
          </button>
        </div>

        <span className="screenshot-count">
          {t('outils.screenshotCount', { count: screenshots.length })}
        </span>
      </div>

      {/* Colonne droite : galerie */}
      <div className="screenshots-right">
        {screenshots.length > 0 ? (
          <div className="screenshots-grid">
            {screenshots.map(file => (
              <div key={file.path} className="screenshot-card">
                <div
                  className="screenshot-thumb"
                  onClick={() => setPreview(file.path)}
                >
                  {thumbnails[file.path] ? (
                    <img src={thumbnails[file.path]} alt={file.name} />
                  ) : (
                    <div className="screenshot-thumb-placeholder">
                      <Image size={24} />
                    </div>
                  )}
                </div>
                <div className="screenshot-card-info">
                  <span className="screenshot-card-name">{file.name}</span>
                  <span className="screenshot-card-date">
                    {new Date(file.timestamp).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <button
                  className="screenshot-delete-btn"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(file.path); }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="screenshots-empty">
            <Camera size={40} />
            <p>{t('outils.noScreenshots')}</p>
          </div>
        )}
      </div>

      {/* Modal preview */}
      {preview && (
        <div className="screenshot-preview-overlay" onClick={() => setPreview(null)}>
          <button className="screenshot-preview-close" onClick={() => setPreview(null)}>
            <X size={24} />
          </button>
          <img
            className="screenshot-preview-img"
            src={`file://${preview}`}
            alt="Preview"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="screenshots-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="screenshots-confirm-dialog" onClick={e => e.stopPropagation()}>
            <p>{t('outils.deleteScreenshotConfirm')}</p>
            <div className="screenshots-confirm-actions">
              <button className="screenshots-confirm-cancel" onClick={() => setConfirmDelete(null)}>
                {t('common.cancel')}
              </button>
              <button className="screenshots-confirm-yes" onClick={() => handleDelete(confirmDelete)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Screenshots;
