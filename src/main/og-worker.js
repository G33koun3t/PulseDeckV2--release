// Worker thread pour récupérer les og:image des articles RSS
// Exécuté hors du thread principal pour éviter les lags UI
const { parentPort } = require('worker_threads');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function fetchOgImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

parentPort.on('message', async (msg) => {
  if (msg.type === 'fetch-og-images') {
    const results = await Promise.all(
      msg.urls.map(async (url) => {
        const og = await fetchOgImage(url);
        return { link: url, og };
      })
    );
    parentPort.postMessage({ type: 'og-results', id: msg.id, results });
  }
});
