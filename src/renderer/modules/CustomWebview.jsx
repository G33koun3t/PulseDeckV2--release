import React, { useRef, useEffect } from 'react';
import './CustomWebview.css';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function CustomWebview({ id, url }) {
  const webviewRef = useRef(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || !url) return;

    const injectCSS = () => {
      webview.insertCSS(`
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #121212; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `).catch(() => {});
    };

    webview.addEventListener('dom-ready', injectCSS);
    return () => webview.removeEventListener('dom-ready', injectCSS);
  }, [url]);

  if (!url) {
    return (
      <div className="custom-webview-empty">
        <p>URL non configurée</p>
      </div>
    );
  }

  return (
    <div className="custom-webview-module">
      <webview
        ref={webviewRef}
        src={url}
        className="custom-webview"
        partition={`persist:${id}`}
        useragent={CHROME_UA}
        allowpopups="true"
      />
    </div>
  );
}

export default CustomWebview;
