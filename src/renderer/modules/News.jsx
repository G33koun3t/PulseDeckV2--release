import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Settings, RefreshCw, Plus, Trash2, X, TrendingUp, TrendingDown, Bitcoin } from 'lucide-react';
import { useTranslation } from '../i18n';
import './News.css';

// Flux RSS par défaut selon la langue — mêmes catégories, sources locales
const DEFAULT_FEEDS_BY_LANG = {
  fr: [
    { id: 'jvcom', name: 'JeuxVideo.com', url: 'https://www.jeuxvideo.com/rss/rss.xml', category: 'gaming', enabled: true },
    { id: 'gamekult', name: 'Gamekult', url: 'https://www.gamekult.com/feed.xml', category: 'gaming', enabled: true },
    { id: 'frandroid', name: 'Frandroid', url: 'https://www.frandroid.com/feed', category: 'tech', enabled: true },
    { id: 'lesnums', name: 'Les Numériques', url: 'https://www.lesnumeriques.com/rss.xml', category: 'tech', enabled: true },
    { id: 'dealabs', name: 'Dealabs', url: 'https://www.dealabs.com/rss/groupe/informatique', category: 'deals', enabled: true },
  ],
  en: [
    { id: 'ign', name: 'IGN', url: 'https://feeds.feedburner.com/ign/all', category: 'gaming', enabled: true },
    { id: 'pcgamer', name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/', category: 'gaming', enabled: true },
    { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', enabled: true },
    { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', enabled: true },
    { id: 'slickdeals', name: 'Slickdeals', url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1', category: 'deals', enabled: true },
  ],
  de: [
    { id: 'gamestar', name: 'GameStar', url: 'https://www.gamestar.de/news/rss/news.rss', category: 'gaming', enabled: true },
    { id: 'computerbase', name: 'ComputerBase', url: 'https://www.computerbase.de/rss/news.xml', category: 'gaming', enabled: true },
    { id: 'heise', name: 'Heise', url: 'https://www.heise.de/rss/heise-atom.xml', category: 'tech', enabled: true },
    { id: 'golem', name: 'Golem', url: 'https://rss.golem.de/rss.php?feed=RSS2.0', category: 'tech', enabled: true },
    { id: 'mydealz', name: 'MyDealz', url: 'https://www.mydealz.de/rss', category: 'deals', enabled: true },
  ],
  nl: [
    { id: 'tweakers', name: 'Tweakers', url: 'https://feeds.feedburner.com/tweakers/mixed', category: 'tech', enabled: true },
    { id: 'gamereactornl', name: 'Gamereactor NL', url: 'https://www.gamereactor.nl/rss/rss.php?texttype=4', category: 'gaming', enabled: true },
    { id: 'gamereactornl2', name: 'Gamereactor NL News', url: 'https://www.gamereactor.nl/rss/rss.php?texttype=1', category: 'gaming', enabled: true },
    { id: 'pepernl', name: 'Pepper.nl', url: 'https://nl.pepper.com/rss', category: 'deals', enabled: true },
    { id: 'techzine', name: 'Techzine', url: 'https://www.techzine.nl/feed/', category: 'tech', enabled: true },
  ],
  es: [
    { id: '3djuegos', name: '3DJuegos', url: 'https://www.3djuegos.com/index.xml', category: 'gaming', enabled: true },
    { id: 'vandal', name: 'Vandal', url: 'https://vandal.elespanol.com/xml.cgi', category: 'gaming', enabled: true },
    { id: 'xataka', name: 'Xataka', url: 'https://www.xataka.com/feedburner.xml', category: 'tech', enabled: true },
    { id: 'genbeta', name: 'Genbeta', url: 'https://feeds.weblogssl.com/genbeta', category: 'tech', enabled: true },
    { id: 'chollometro', name: 'Chollometro', url: 'https://www.chollometro.com/rss', category: 'deals', enabled: true },
  ],
  pt: [
    { id: 'eurogamerpt', name: 'Eurogamer PT', url: 'https://www.eurogamer.pt/feed', category: 'gaming', enabled: true },
    { id: 'ignpt', name: 'IGN Portugal', url: 'https://pt.ign.com/feed.xml', category: 'gaming', enabled: true },
    { id: 'pplware', name: 'Pplware', url: 'https://pplware.sapo.pt/feed/', category: 'tech', enabled: true },
    { id: 'tecnoblog', name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/', category: 'tech', enabled: true },
    { id: 'pelando', name: 'Pelando', url: 'https://www.promobit.com.br/blog/feed', category: 'deals', enabled: true },
  ],
  it: [
    { id: 'multiplayer', name: 'Multiplayer.it', url: 'https://multiplayer.it/feed/rss/articoli/', category: 'gaming', enabled: true },
    { id: 'everyeye', name: 'Everyeye.it', url: 'https://www.everyeye.it/feed', category: 'gaming', enabled: true },
    { id: 'tomshwit', name: "Tom's Hardware IT", url: 'https://www.tomshw.it/feed', category: 'tech', enabled: true },
    { id: 'hdblog', name: 'HDblog', url: 'https://www.hdblog.it/feed/', category: 'tech', enabled: true },
    { id: 'scontify', name: 'Scontify', url: 'https://www.scontify.net/feed/', category: 'deals', enabled: true },
  ],
  pl: [
    { id: 'gryonline', name: 'GRY-Online', url: 'https://www.gry-online.pl/rss/news.xml', category: 'gaming', enabled: true },
    { id: 'grampl', name: 'Gram.pl', url: 'https://www.gram.pl/rss/content.xml', category: 'gaming', enabled: true },
    { id: 'benchmark', name: 'Benchmark.pl', url: 'https://www.benchmark.pl/rss/aktualnosci.xml', category: 'tech', enabled: true },
    { id: 'antyweb', name: 'Antyweb', url: 'https://antyweb.pl/feed', category: 'tech', enabled: true },
    { id: 'pepperpl', name: 'Pepper.pl', url: 'https://www.pepper.pl/rss', category: 'deals', enabled: true },
  ],
  ja: [
    { id: '4gamer', name: '4Gamer.net', url: 'https://www.4gamer.net/rss/index.xml', category: 'gaming', enabled: true },
    { id: 'gamewatch', name: 'Game Watch', url: 'https://game.watch.impress.co.jp/data/rss/1.0/gmw/feed.rdf', category: 'gaming', enabled: true },
    { id: 'gigazine', name: 'GIGAZINE', url: 'https://gigazine.net/news/rss_2.0/', category: 'tech', enabled: true },
    { id: 'itmedia', name: 'ITmedia', url: 'https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml', category: 'tech', enabled: true },
    { id: 'kakaku', name: 'Kakaku.com', url: 'https://news.kakaku.com/prdnews/rss/', category: 'deals', enabled: true },
  ],
};

function getDefaultFeeds(lang) {
  return DEFAULT_FEEDS_BY_LANG[lang] || DEFAULT_FEEDS_BY_LANG.en;
}

// Crypto ticker — CoinGecko IDs + symboles
const CRYPTO_LIST = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'cardano', symbol: 'ADA' },
  { id: 'dogecoin', symbol: 'DOGE' },
  { id: 'avalanche-2', symbol: 'AVAX' },
  { id: 'polkadot', symbol: 'DOT' },
  { id: 'polygon-ecosystem-token', symbol: 'POL' },
];

const LANG_CURRENCY = {
  fr: 'eur', en: 'usd', de: 'eur', nl: 'eur',
  es: 'eur', pt: 'eur', it: 'eur', pl: 'pln', ja: 'jpy',
};

const CURRENCY_SYMBOLS = { eur: '€', usd: '$', pln: 'zł', jpy: '¥' };

function formatCryptoPrice(value, currency) {
  if (value == null) return '—';
  const sym = CURRENCY_SYMBOLS[currency] || currency.toUpperCase();
  if (currency === 'jpy') return `${sym}${Math.round(value).toLocaleString()}`;
  if (value >= 1000) return `${sym}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

// Catégories par défaut avec traductions
const DEFAULT_CATEGORIES = ['gaming', 'tech', 'deals'];

const CATEGORY_LABEL_KEYS = {
  all: 'news.all',
  gaming: 'news.gaming',
  tech: 'news.tech',
  deals: 'news.deals',
};

const CATEGORY_COLORS = {
  gaming: '#9b59b6',
  tech: '#3498db',
  deals: '#2ecc71',
};

const EXTRA_COLORS = ['#e67e22', '#e74c3c', '#1abc9c', '#f39c12', '#8e44ad', '#16a085'];

function getCategoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const hash = [...cat].reduce((s, c) => s + c.charCodeAt(0), 0);
  return EXTRA_COLORS[hash % EXTRA_COLORS.length];
}

function getCategoryLabel(cat, t) {
  if (CATEGORY_LABEL_KEYS[cat]) return t(CATEGORY_LABEL_KEYS[cat]);
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getRelativeTime(dateStr, t, dateLocale) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('news.justNow');
  if (diffMin < 60) return t('news.minutesAgo', { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('news.hoursAgo', { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t('news.daysAgo', { count: diffD });
  return date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
}

function NewsModule() {
  const { t, lang, dateLocale } = useTranslation();
  const [feeds, setFeeds] = useState(() => {
    const savedLang = localStorage.getItem('news_feeds_lang');
    // Si la langue a changé → toujours recharger les defaults (même si custom)
    if (savedLang && savedLang !== lang) {
      localStorage.removeItem('news_feeds_custom');
      localStorage.setItem('news_feeds_lang', lang);
      return getDefaultFeeds(lang);
    }
    // Même langue → charger la sauvegarde si elle existe
    const saved = localStorage.getItem('news_feeds');
    if (saved) return JSON.parse(saved);
    // Premier lancement
    localStorage.setItem('news_feeds_lang', lang);
    return getDefaultFeeds(lang);
  });
  const [isCustomFeeds, setIsCustomFeeds] = useState(() => {
    const savedLang = localStorage.getItem('news_feeds_lang');
    if (savedLang && savedLang !== lang) return false;
    return localStorage.getItem('news_feeds_custom') === 'true';
  });
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSettings, setShowSettings] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: '', url: '', category: 'tech' });
  const [cryptoPrices, setCryptoPrices] = useState(null);
  const [showCrypto, setShowCrypto] = useState(() => {
    const saved = localStorage.getItem('news_show_crypto');
    return saved !== null ? saved === 'true' : true;
  });
  const refreshTimer = useRef(null);
  const cryptoTimer = useRef(null);

  // Catégories dynamiques depuis les feeds
  const categories = useMemo(() => {
    const cats = new Set(feeds.map(f => f.category).filter(c => c && c.trim()));
    return ['all', ...DEFAULT_CATEGORIES, ...Array.from(cats)]
      .filter((v, i, a) => a.indexOf(v) === i);
  }, [feeds]);

  // Supprimer une catégorie (les flux restent mais sans catégorie)
  const removeCategory = (cat) => {
    setFeeds(prev => prev.map(f => f.category === cat ? { ...f, category: '' } : f));
    setIsCustomFeeds(true);
    localStorage.setItem('news_feeds_custom', 'true');
    if (activeCategory === cat) setActiveCategory('all');
  };

  useEffect(() => {
    localStorage.setItem('news_feeds', JSON.stringify(feeds));
    localStorage.setItem('news_feeds_lang', lang);
  }, [feeds]);

  // Crypto ticker — fetch toutes les 2 min
  const fetchCrypto = useCallback(async () => {
    try {
      const result = await window.electronAPI.fetchCryptoPrices();
      if (result.success) setCryptoPrices(result.data);
    } catch (e) {
      // Silencieux
    }
  }, []);

  useEffect(() => {
    if (!showCrypto) return;
    fetchCrypto();
    cryptoTimer.current = setInterval(fetchCrypto, 2 * 60 * 1000);
    return () => clearInterval(cryptoTimer.current);
  }, [showCrypto, fetchCrypto]);

  useEffect(() => {
    localStorage.setItem('news_show_crypto', showCrypto.toString());
  }, [showCrypto]);

  const fetchAllFeeds = useCallback(async () => {
    setLoading(true);
    const enabledFeeds = feeds.filter(f => f.enabled);
    const results = await Promise.all(
      enabledFeeds.map(async (feed) => {
        try {
          const result = await window.electronAPI.fetchRss(feed.url);
          if (result.success) {
            return result.feed.items.map(item => ({
              ...item,
              source: feed.name,
              category: feed.category,
            }));
          } else {
            console.warn(`[RSS] Échec ${feed.name}:`, result.error);
          }
        } catch (e) {
          console.warn(`[RSS] Erreur ${feed.name}:`, e.message);
        }
        return [];
      })
    );
    const allArticles = results.flat().sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA;
    });
    setArticles(allArticles);
    setLoading(false);
  }, [feeds]);

  useEffect(() => {
    fetchAllFeeds();
    refreshTimer.current = setInterval(fetchAllFeeds, 5 * 60 * 1000);
    return () => clearInterval(refreshTimer.current);
  }, [fetchAllFeeds]);

  const handleArticleClick = (link) => {
    if (link) window.electronAPI.openExternal(link);
  };

  const toggleFeed = (id) => {
    setFeeds(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const removeFeed = (id) => {
    setFeeds(prev => prev.filter(f => f.id !== id));
    setIsCustomFeeds(true);
    localStorage.setItem('news_feeds_custom', 'true');
  };

  const addFeed = () => {
    if (!newFeed.name.trim() || !newFeed.url.trim()) return;
    setFeeds(prev => [...prev, { id: generateId(), ...newFeed, enabled: true }]);
    setNewFeed({ name: '', url: '', category: 'tech' });
    setIsCustomFeeds(true);
    localStorage.setItem('news_feeds_custom', 'true');
  };

  const resetFeeds = () => {
    setFeeds(getDefaultFeeds(lang));
    setIsCustomFeeds(false);
    localStorage.removeItem('news_feeds_custom');
  };

  const filteredArticles = activeCategory === 'all'
    ? articles
    : articles.filter(a => a.category === activeCategory);

  return (
    <div className="news-module">
      {showCrypto && (
        <div className="crypto-section">
          <div className="crypto-header">
            <h2 className="crypto-title"><Bitcoin size={20} /> {t('news.cryptoTitle')}</h2>
            <button
              className="news-btn"
              onClick={() => setShowCrypto(false)}
              title={t('sidebar.close')}
            >
              <X size={16} />
            </button>
          </div>
          {cryptoPrices ? (
            <div className="crypto-ticker">
              <div className="crypto-ticker-track">
                {[...CRYPTO_LIST, ...CRYPTO_LIST].map((coin, i) => {
                  const currency = LANG_CURRENCY[lang] || 'eur';
                  const price = cryptoPrices[coin.id]?.[currency];
                  const change = cryptoPrices[coin.id]?.[`${currency}_24h_change`];
                  const isUp = change >= 0;
                  return (
                    <div key={`${coin.id}-${i}`} className="crypto-item">
                      <span className="crypto-symbol">{coin.symbol}</span>
                      <span className="crypto-price">{formatCryptoPrice(price, currency)}</span>
                      {change != null && (
                        <span className={`crypto-change ${isUp ? 'up' : 'down'}`}>
                          {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="crypto-loading">{t('news.loadingFeeds')}</div>
          )}
        </div>
      )}

      <div className="news-header">
        <h2 className="news-title">{t('news.title')}</h2>
        <div className="news-actions">
          {!showCrypto && (
            <button
              className="news-btn"
              onClick={() => setShowCrypto(true)}
              title={t('news.cryptoTicker')}
            >
              <Bitcoin size={18} />
            </button>
          )}
          <button
            className={`news-btn ${loading ? 'spinning' : ''}`}
            onClick={fetchAllFeeds}
            title={t('common.refresh')}
            disabled={loading}
          >
            <RefreshCw size={18} />
          </button>
          <button
            className={`news-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title={t('common.settings')}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="news-tabs">
        {categories.map(cat => (
          <div key={cat} className="news-tab-wrapper">
            <button
              className={`news-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              style={activeCategory === cat && cat !== 'all' ? { borderColor: getCategoryColor(cat) } : {}}
            >
              {getCategoryLabel(cat, t)}
            </button>
            {cat !== 'all' && (
              <button
                className="news-tab-delete"
                onClick={(e) => { e.stopPropagation(); removeCategory(cat); }}
                title={t('news.deleteCategory')}
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      {showSettings && (
        <div className="news-settings">
          <div className="news-settings-header">
            <h3>{t('news.rssFeeds')}</h3>
            <button className="news-btn" onClick={resetFeeds} title={t('common.reset')}>
              <RefreshCw size={16} />
            </button>
            <button className="news-btn" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="news-feeds-list">
            {feeds.map(feed => (
              <div key={feed.id} className="news-feed-item">
                <label className="news-feed-toggle">
                  <input
                    type="checkbox"
                    checked={feed.enabled}
                    onChange={() => toggleFeed(feed.id)}
                  />
                  <span className="news-feed-name">{feed.name}</span>
                  <span
                    className="news-category-badge"
                    style={{ background: getCategoryColor(feed.category) }}
                  >
                    {getCategoryLabel(feed.category, t)}
                  </span>
                </label>
                <button className="news-feed-delete" onClick={() => removeFeed(feed.id)} title={t('common.delete')}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="news-add-feed">
            <input
              type="text"
              placeholder={t('news.feedName')}
              value={newFeed.name}
              onChange={e => setNewFeed(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="text"
              placeholder={t('news.feedUrl')}
              value={newFeed.url}
              onChange={e => setNewFeed(prev => ({ ...prev, url: e.target.value }))}
            />
            <input
              type="text"
              list="news-category-list"
              placeholder={t('news.categoryName')}
              value={newFeed.category}
              onChange={e => setNewFeed(prev => ({ ...prev, category: e.target.value.toLowerCase() }))}
            />
            <datalist id="news-category-list">
              {categories.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{getCategoryLabel(c, t)}</option>
              ))}
            </datalist>
            <button className="news-btn news-btn-add" onClick={addFeed}>
              <Plus size={16} />
              {t('common.add')}
            </button>
          </div>
        </div>
      )}

      <div className="news-grid">
        {loading && articles.length === 0 && (
          <div className="news-loading">{t('news.loadingFeeds')}</div>
        )}
        {!loading && filteredArticles.length === 0 && (
          <div className="news-empty">{t('news.noArticles')}</div>
        )}
        {filteredArticles.map((article, index) => (
          <div
            key={`${article.source}-${index}`}
            className="news-card"
            onClick={() => handleArticleClick(article.link)}
          >
            <div className="news-card-image">
              {article.image ? (
                <img src={article.image} alt="" loading="lazy" />
              ) : (
                <div className="news-card-placeholder">
                  <span>{article.source?.charAt(0) || '?'}</span>
                </div>
              )}
              <span
                className="news-card-badge"
                style={{ background: getCategoryColor(article.category) }}
              >
                {getCategoryLabel(article.category, t)}
              </span>
            </div>
            <div className="news-card-body">
              <h3 className="news-card-title">{article.title}</h3>
              {article.summary && (
                <p className="news-card-summary">{stripHtml(article.summary)}</p>
              )}
              <div className="news-card-footer">
                <span className="news-card-source">{article.source}</span>
                <span className="news-card-date">{getRelativeTime(article.date, t, dateLocale)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NewsModule;
