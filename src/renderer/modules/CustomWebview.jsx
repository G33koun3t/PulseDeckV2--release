import React, { useEffect, useRef, useCallback } from 'react';
import './CustomWebview.css';

const IS_TAURI = !!window.__TAURI_INTERNALS__;

/**
 * CustomWebview — embeds external sites into the dashboard.
 *
 * In Electron: uses <iframe> (works for sites that allow framing).
 * In Tauri: creates a native WebviewWindow (bypasses X-Frame-Options / CSP frame-ancestors).
 *
 * Props:
 *   id       — unique webview identifier
 *   url      — the external URL to load
 *   isActive — whether this webview is currently visible (from App.jsx)
 */
function CustomWebview({ id, url, isActive }) {
  const containerRef = useRef(null);
  const createdRef = useRef(false);
  const currentUrlRef = useRef(url);
  const label = `cwv-${id}`;

  // Get the container's position for native webview placement
  const getContainerBounds = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
  }, []);

  // Main effect: create / show / hide native webview based on isActive
  useEffect(() => {
    if (!IS_TAURI || !url) return;

    if (isActive) {
      // Small delay to ensure the DOM has been laid out after display: flex
      const timer = setTimeout(() => {
        const bounds = getContainerBounds();
        if (!bounds) return;

        if (!createdRef.current || currentUrlRef.current !== url) {
          // Destroy old one if URL changed
          if (createdRef.current) {
            window.electronAPI.destroyCustomWebview(label).catch(() => {});
            createdRef.current = false;
          }
          // Create new native webview window
          window.electronAPI.createCustomWebview(
            label, url, bounds.x, bounds.y, bounds.w, bounds.h
          ).then(() => {
            createdRef.current = true;
            currentUrlRef.current = url;
          }).catch(err => console.error('[CustomWebview] Create failed:', err));
        } else {
          // Just show and reposition the existing webview
          window.electronAPI.setCustomWebviewVisibility(
            label, true, bounds.x, bounds.y, bounds.w, bounds.h
          ).catch(err => console.error('[CustomWebview] Show failed:', err));
        }
      }, 50);

      return () => clearTimeout(timer);
    } else if (createdRef.current) {
      // Hide native webview when inactive
      window.electronAPI.setCustomWebviewVisibility(
        label, false, 0, 0, 0, 0
      ).catch(() => {});
    }
  }, [isActive, url, label, getContainerBounds]);

  // Cleanup on unmount: destroy native webview
  useEffect(() => {
    return () => {
      if (IS_TAURI && createdRef.current) {
        window.electronAPI.destroyCustomWebview(label).catch(() => {});
        createdRef.current = false;
      }
    };
  }, [label]);

  // No URL configured
  if (!url) {
    return (
      <div className="custom-webview-empty">
        <p>URL non configurée</p>
      </div>
    );
  }

  // Electron mode: use iframe (subject to X-Frame-Options restrictions)
  if (!IS_TAURI) {
    return (
      <div className="custom-webview-module">
        <iframe
          src={url}
          className="custom-webview"
          title={id || 'webview'}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="autoplay; fullscreen; clipboard-write"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Tauri mode: container div for position reference (native webview overlays it)
  return <div className="custom-webview-module" ref={containerRef} />;
}

export default CustomWebview;
