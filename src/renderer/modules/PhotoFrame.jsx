import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image, Settings, ChevronLeft, ChevronRight, Play, Pause,
  FolderPlus, Folder, Trash2, X, Shuffle,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import './PhotoFrame.css';

const DEFAULT_CONFIG = {
  slideDuration: 10,
  transitionType: 'fade',
  transitionDuration: 1,
  shuffle: false,
};

function PhotoFrameModule() {
  const { t } = useTranslation();

  // Config
  const [config, setConfig] = useState(() => {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem('photoframe_config')) };
    } catch { return { ...DEFAULT_CONFIG }; }
  });

  // Folders
  const [folders, setFolders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('photoframe_folders')) || [];
    } catch { return []; }
  });

  // Images
  const [images, setImages] = useState([]);
  const [displayOrder, setDisplayOrder] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(false);

  // Crossfade layers
  const [activeLayer, setActiveLayer] = useState(0);
  const [layerSrcs, setLayerSrcs] = useState(['', '']);

  // UI
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings temp state
  const [tempConfig, setTempConfig] = useState(config);
  const [tempFolders, setTempFolders] = useState(folders);

  // Refs
  const intervalRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const currentIndexRef = useRef(0);

  // Persist
  useEffect(() => {
    localStorage.setItem('photoframe_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('photoframe_folders', JSON.stringify(folders));
  }, [folders]);

  // Scan all folders for images
  const scanAllFolders = useCallback(async () => {
    if (!folders.length || !window.electronAPI?.listScreenshots) {
      setImages([]);
      return;
    }
    setLoading(true);
    try {
      const allImages = [];
      for (const folder of folders) {
        try {
          const files = await window.electronAPI.listScreenshots(folder);
          allImages.push(...files);
        } catch (err) {
          console.warn('Failed to scan folder:', folder, err);
        }
      }
      setImages(allImages);
    } finally {
      setLoading(false);
    }
  }, [folders]);

  useEffect(() => {
    scanAllFolders();
  }, [scanAllFolders]);

  // Build display order when images or shuffle config changes
  useEffect(() => {
    if (images.length === 0) {
      setDisplayOrder([]);
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      return;
    }
    const indices = images.map((_, i) => i);
    if (config.shuffle) {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
    }
    setDisplayOrder(indices);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  }, [images, config.shuffle]);

  // Helper: get image src from index in displayOrder
  const getImageSrc = useCallback((idx) => {
    if (!images.length || !displayOrder.length) return '';
    const wrapped = ((idx % displayOrder.length) + displayOrder.length) % displayOrder.length;
    const imageIdx = displayOrder[wrapped];
    const filePath = images[imageIdx]?.path;
    if (!filePath) return '';
    return `local-file:///${filePath.replace(/\\/g, '/')}`;
  }, [images, displayOrder]);

  // Navigate to image
  const goToImage = useCallback((newIndex) => {
    if (!images.length || !displayOrder.length) return;
    const wrapped = ((newIndex % displayOrder.length) + displayOrder.length) % displayOrder.length;
    const src = getImageSrc(wrapped);
    if (!src) return;

    // Preload next image, then swap layers
    const img = new window.Image();
    img.onload = () => {
      setActiveLayer(prev => {
        const nextLayer = prev === 0 ? 1 : 0;
        setLayerSrcs(prevSrcs => {
          const updated = [...prevSrcs];
          updated[nextLayer] = src;
          return updated;
        });
        return nextLayer;
      });
      setCurrentIndex(wrapped);
      currentIndexRef.current = wrapped;
    };
    img.src = src;
  }, [images, displayOrder, getImageSrc]);

  // Load first image on mount
  useEffect(() => {
    if (displayOrder.length > 0 && !layerSrcs[0] && !layerSrcs[1]) {
      const src = getImageSrc(0);
      if (src) {
        setLayerSrcs([src, '']);
        setActiveLayer(0);
      }
    }
  }, [displayOrder, getImageSrc, layerSrcs]);

  // Auto-advance
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && images.length > 1) {
      intervalRef.current = setInterval(() => {
        const next = currentIndexRef.current + 1;
        goToImage(next);
      }, config.slideDuration * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, config.slideDuration, images.length, goToImage]);

  // Navigation
  const goNext = useCallback(() => {
    goToImage(currentIndexRef.current + 1);
    // Reset interval
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && images.length > 1) {
      intervalRef.current = setInterval(() => {
        goToImage(currentIndexRef.current + 1);
      }, config.slideDuration * 1000);
    }
  }, [goToImage, isPlaying, images.length, config.slideDuration]);

  const goPrev = useCallback(() => {
    goToImage(currentIndexRef.current - 1);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isPlaying && images.length > 1) {
      intervalRef.current = setInterval(() => {
        goToImage(currentIndexRef.current + 1);
      }, config.slideDuration * 1000);
    }
  }, [goToImage, isPlaying, images.length, config.slideDuration]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Controls auto-hide
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  // Settings
  const openSettings = () => {
    setTempConfig({ ...config });
    setTempFolders([...folders]);
    setShowSettings(true);
  };

  const addFolder = async () => {
    if (!window.electronAPI?.selectScreenshotFolder) return;
    const result = await window.electronAPI.selectScreenshotFolder();
    if (result) {
      setTempFolders(prev => {
        if (prev.includes(result)) return prev;
        return [...prev, result];
      });
    }
  };

  const removeFolder = (idx) => {
    setTempFolders(prev => prev.filter((_, i) => i !== idx));
  };

  const saveSettings = () => {
    setConfig(tempConfig);
    setFolders(tempFolders);
    setShowSettings(false);
  };

  // Transition types for selector
  const transitionTypes = [
    { value: 'fade', label: t('photoframe.transitionFade') },
    { value: 'slide', label: t('photoframe.transitionSlide') },
    { value: 'zoom', label: t('photoframe.transitionZoom') },
    { value: 'none', label: t('photoframe.transitionNone') },
  ];

  // Settings render
  if (showSettings) {
    return (
      <div className="photoframe-module">
        <div className="photoframe-settings">
          <div className="photoframe-settings-inner">
            <div className="settings-header">
              <Settings size={20} />
              <span>{t('photoframe.configTitle')}</span>
              <button className="close-btn" onClick={() => setShowSettings(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="settings-form">
              {/* Dossiers source */}
              <div className="form-group">
                <label>{t('photoframe.folders')}</label>
                <div className="photoframe-folder-list">
                  {tempFolders.map((folder, idx) => (
                    <div key={idx} className="photoframe-folder-item">
                      <Folder size={16} />
                      <span className="photoframe-folder-path">{folder}</span>
                      <button className="photoframe-folder-remove" onClick={() => removeFolder(idx)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="photoframe-add-folder" onClick={addFolder}>
                  <FolderPlus size={16} /> {t('photoframe.addFolder')}
                </button>
              </div>

              {/* Durée par photo */}
              <div className="form-group">
                <label>{t('photoframe.slideDuration')}</label>
                <div className="photoframe-slider-row">
                  <input
                    type="range"
                    min={3}
                    max={60}
                    value={tempConfig.slideDuration}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, slideDuration: parseInt(e.target.value) }))}
                  />
                  <span className="photoframe-slider-value">{tempConfig.slideDuration}s</span>
                </div>
              </div>

              {/* Type de transition */}
              <div className="form-group">
                <label>{t('photoframe.transitionType')}</label>
                <div className="photoframe-transition-options">
                  {transitionTypes.map(tt => (
                    <button
                      key={tt.value}
                      className={`photoframe-transition-option ${tempConfig.transitionType === tt.value ? 'active' : ''}`}
                      onClick={() => setTempConfig(prev => ({ ...prev, transitionType: tt.value }))}
                    >
                      {tt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durée de transition */}
              <div className="form-group">
                <label>{t('photoframe.transitionDuration')}</label>
                <div className="photoframe-slider-row">
                  <input
                    type="range"
                    min={0.3}
                    max={3}
                    step={0.1}
                    value={tempConfig.transitionDuration}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, transitionDuration: parseFloat(e.target.value) }))}
                  />
                  <span className="photoframe-slider-value">{tempConfig.transitionDuration}s</span>
                </div>
              </div>

              {/* Shuffle */}
              <div className="form-group">
                <div className="photoframe-toggle-row">
                  <label><Shuffle size={16} style={{ marginRight: 6, verticalAlign: -3 }} />{t('photoframe.shuffle')}</label>
                  <button
                    className={`photoframe-toggle ${tempConfig.shuffle ? 'active' : ''}`}
                    onClick={() => setTempConfig(prev => ({ ...prev, shuffle: !prev.shuffle }))}
                  />
                </div>
              </div>

              {/* Compteur images */}
              <div className="photoframe-image-count">
                {images.length > 0
                  ? t('photoframe.totalImages').replace('{{count}}', images.length)
                  : t('photoframe.noImages')
                }
              </div>

              <button className="save-btn" onClick={saveSettings}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!folders.length || (!loading && images.length === 0)) {
    return (
      <div className="photoframe-module">
        <div className="photoframe-empty">
          <Image size={48} />
          <p>{folders.length === 0 ? t('photoframe.noFolders') : t('photoframe.noImages')}</p>
          <small>{folders.length === 0 ? t('photoframe.noFoldersHint') : t('photoframe.noImagesHint')}</small>
          <button onClick={openSettings}>
            <Settings size={16} /> {t('common.settings')}
          </button>
        </div>
      </div>
    );
  }

  // Main slideshow
  return (
    <div
      className="photoframe-module"
      data-transition={config.transitionType}
      style={{ '--pf-transition': `${config.transitionDuration}s` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Two crossfade layers */}
      <img
        className={`photoframe-layer ${activeLayer === 0 ? 'active' : ''}`}
        src={layerSrcs[0]}
        alt=""
        draggable={false}
      />
      <img
        className={`photoframe-layer ${activeLayer === 1 ? 'active' : ''}`}
        src={layerSrcs[1]}
        alt=""
        draggable={false}
      />

      {/* Controls overlay */}
      <div className={`photoframe-controls ${showControls ? 'visible' : ''}`}>
        <button onClick={goPrev} title={t('photoframe.previous')}>
          <ChevronLeft size={24} />
        </button>
        <button onClick={togglePlayPause} title={isPlaying ? t('photoframe.pause') : t('photoframe.play')}>
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        <button onClick={goNext} title={t('photoframe.next')}>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Image counter */}
      <div className={`photoframe-info ${showControls ? 'visible' : ''}`}>
        {currentIndex + 1} / {images.length}
      </div>

      {/* Settings button */}
      <button
        className={`photoframe-settings-btn ${showControls ? 'visible' : ''}`}
        onClick={openSettings}
        title={t('common.settings')}
      >
        <Settings size={18} />
      </button>
    </div>
  );
}

export default PhotoFrameModule;
