// Operating mode: local-first.
// Portfolio data lives in the client's localStorage.
// Auth and database modules are paused — see _paused/ for those files.
import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cache = new NodeCache({ stdTTL: 120, checkperiod: 120 });
const lastKnownPrices = new Map();

// ── Disk cache for fundamentals (24h TTL — data changes quarterly) ───────────
const FUND_CACHE_DIR = path.join(__dirname, 'cache', 'fundamentals');
const FUND_CACHE_TTL = 24 * 60 * 60 * 1000;

try { fs.mkdirSync(FUND_CACHE_DIR, { recursive: true }); } catch (_) {}

function fundCacheFile(symbol) {
  return path.join(FUND_CACHE_DIR, `${symbol.replace(/[^a-zA-Z0-9\-]/g, '_')}.json`);
}

function readFundCache(symbol) {
  try {
    const raw = fs.readFileSync(fundCacheFile(symbol), 'utf8');
    const { data, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt < FUND_CACHE_TTL) return data;
    return null;
  } catch (_) { return null; }
}

function writeFundCache(symbol, data) {
  try {
    fs.writeFileSync(fundCacheFile(symbol), JSON.stringify({ data, cachedAt: Date.now() }));
  } catch (_) {}
}

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (curl, mobile apps, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// ── Python bridge ──────────────────────────────────────────────────────────────

const FETCHER = path.join(__dirname, 'fetcher.py');

const runPython = (args) => new Promise((resolve, reject) => {
  const py = spawn('python3', [FETCHER, ...args]);
  let stdout = '';
  let stderr = '';
  py.stdout.on('data', d => { stdout += d.toString(); });
  py.stderr.on('data', d => { stderr += d.toString(); });
  py.on('close', _code => {
    if (!stdout.trim()) {
      // Log stderr warnings but don't fail (urllib3 warnings are common)
      if (stderr && !stderr.includes('NotOpenSSLWarning')) {
        console.warn('[PY stderr]', stderr.trim());
      }
      return resolve(null);
    }
    try {
      resolve(JSON.parse(stdout));
    } catch (e) {
      console.warn('[PY parse error]', stdout.slice(0, 200));
      resolve(null);
    }
  });
  py.on('error', reject);
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const fetchQuote = async (symbol) => {
  try {
    const result = await runPython(['quote_single', symbol]);
    if (result?.regularMarketPrice != null) {
      lastKnownPrices.set(symbol, result);
      return result;
    }
    return lastKnownPrices.get(symbol) ?? null;
  } catch (err) {
    console.warn(`[ERR] fetchQuote(${symbol}): ${err.message}`);
    return lastKnownPrices.get(symbol) ?? null;
  }
};

// Batch: call Python once with all symbols (much faster than one-by-one)
const batchQuotes = async (symbols) => {
  try {
    const result = await runPython(['quotes', symbols.join(',')]);
    if (!result) return symbols.map(() => null);
    return symbols.map(sym => {
      const q = result[sym];
      if (q?.regularMarketPrice != null) lastKnownPrices.set(sym, q);
      return q ?? lastKnownPrices.get(sym) ?? null;
    });
  } catch (err) {
    console.warn('[ERR] batchQuotes:', err.message);
    return symbols.map(sym => lastKnownPrices.get(sym) ?? null);
  }
};

const fetchChart = async (symbol, period, interval = '1d') => {
  try {
    const result = await runPython(['history', symbol, period, interval]);
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.warn(`[ERR] fetchChart(${symbol}): ${err.message}`);
    return [];
  }
};

const normalizeQuote = (sym, q) => {
  if (q?.regularMarketPrice != null) return q;
  return { symbol: sym, regularMarketPrice: null, error: 'unavailable' };
};

// ── Data ───────────────────────────────────────────────────────────────────────

const IPSA_SYMBOLS = [
  'AGUAS-A.SN','BSANTANDER.SN','BCI.SN','CAP.SN','CCU.SN',
  'CENCOSUD.SN','CENCOMALLS.SN','CHILE.SN','CMPC.SN','COLBUN.SN',
  'CONCHATORO.SN','COPEC.SN','ECL.SN','ENELAM.SN','ENELCHILE.SN',
  'FALABELLA.SN','FORUS.SN','IAM.SN','ITAUCL.SN','LTM.SN',
  'MALLPLAZA.SN','PARAUCO.SN','RIPLEY.SN','SALFACORP.SN','SK.SN',
  'SMU.SN','SQM-B.SN','VAPORES.SN','WATTS.SN','SONDA.SN',
  'ANDINA-B.SN','BESALCO.SN','ILC.SN','QUINENCO.SN'
];

const FX_SYMBOLS = ['USDCLP=X', 'EURCLP=X', 'GBPCLP=X', 'USDEUR=X', 'JPYCLP=X', 'CNYCLP=X'];

const COMMODITY_SYMBOLS = ['CL=F', 'BZ=F', 'HG=F', 'GC=F', 'SI=F', 'LIT', 'WOOD'];

const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', '^FTSE', '^GDAXI', '^FCHI', '^STOXX50E', '^IBEX', '^N225', '^HSI', '^MERV', '^BVSP'];

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get('/api/test', async (_req, res) => {
  try {
    const q = await fetchQuote('COPEC.SN');
    res.json({
      status: q?.regularMarketPrice != null ? 'ok' : 'no_data',
      sample: q ?? null,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/debug', async (_req, res) => {
  try {
    const raw = await runPython(['quote_single', 'COPEC.SN']);
    res.json({ raw });
  } catch (err) {
    res.status(500).json({ errorMessage: err.message });
  }
});

app.get('/api/quotes', async (req, res) => {
  try {
    const symbols = req.query.symbols ? req.query.symbols.split(',') : IPSA_SYMBOLS;
    const cacheKey = `quotes_${symbols.length === IPSA_SYMBOLS.length ? 'all' : symbols.join('_')}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rawResults = await batchQuotes(symbols);
    const quotes = symbols.map((sym, i) => normalizeQuote(sym, rawResults[i]));
    cache.set(cacheKey, quotes);
    res.json(quotes);
  } catch (err) {
    console.error('Quotes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const cacheKey = `quote_${symbol}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const q = await fetchQuote(symbol);
    if (!q) return res.status(404).json({ error: 'unavailable' });
    cache.set(cacheKey, q);
    res.json(q);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const period = req.query.period || '1y';
    const interval = req.query.interval || '1d';
    const cacheKey = `hist_${symbol}_${period}_${interval}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const data = await fetchChart(symbol, period, interval);
    cache.set(cacheKey, data, 3600);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ipsa', async (_req, res) => {
  try {
    const cacheKey = 'ipsa_index';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [quoteArr, history] = await Promise.all([
      batchQuotes(['^IPSA']),
      fetchChart('^IPSA', '1y'),
    ]);
    const result = { quote: quoteArr[0] ?? null, history };
    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fx', async (_req, res) => {
  try {
    const cacheKey = 'fx_rates';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rawResults = await batchQuotes(FX_SYMBOLS);
    const fx = FX_SYMBOLS.map((sym, i) => ({
      symbol: sym,
      price: rawResults[i]?.regularMarketPrice ?? null,
      change: rawResults[i]?.regularMarketChange ?? null,
      changePercent: rawResults[i]?.regularMarketChangePercent ?? null,
      name: rawResults[i]?.shortName ?? sym,
      time: rawResults[i]?.regularMarketTime ?? null,
    }));
    cache.set(cacheKey, fx, 60);
    res.json(fx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/commodities', async (_req, res) => {
  try {
    const cacheKey = 'commodities';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rawResults = await batchQuotes(COMMODITY_SYMBOLS);
    const data = COMMODITY_SYMBOLS.map((sym, i) => ({
      symbol: sym,
      price: rawResults[i]?.regularMarketPrice ?? null,
      change: rawResults[i]?.regularMarketChange ?? null,
      changePercent: rawResults[i]?.regularMarketChangePercent ?? null,
    }));
    cache.set(cacheKey, data, 60);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/macro', async (_req, res) => {
  try {
    const cacheKey = 'macro_data';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [ufRes, ipcRes, tpmRes] = await Promise.allSettled([
      axios.get('https://mindicador.cl/api/uf',  { timeout: 8000 }),
      axios.get('https://mindicador.cl/api/ipc', { timeout: 8000 }),
      axios.get('https://mindicador.cl/api/tpm', { timeout: 8000 }),
    ]);
    const get = (r) =>
      r.status === 'fulfilled' && r.value?.data?.serie?.[0]
        ? { value: r.value.data.serie[0].valor, date: r.value.data.serie[0].fecha, available: true }
        : { value: null, date: null, available: false };

    const result = { uf: get(ufRes), ipc: get(ipcRes), tpm: get(tpmRes), timestamp: new Date().toISOString() };
    cache.set(cacheKey, result, 3600);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sectors', async (_req, res) => {
  try {
    const cacheKey = 'sector_perf';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rawResults = await batchQuotes(IPSA_SYMBOLS);
    const data = IPSA_SYMBOLS.map((sym, i) => ({
      symbol: sym,
      changePercent: rawResults[i]?.regularMarketChangePercent ?? null,
      price: rawResults[i]?.regularMarketPrice ?? null,
    }));
    cache.set(cacheKey, data, 120);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indices', async (_req, res) => {
  try {
    const cacheKey = 'global_indices';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const rawResults = await batchQuotes(INDEX_SYMBOLS);
    const data = INDEX_SYMBOLS.map((sym, i) => ({
      symbol: sym,
      price: rawResults[i]?.regularMarketPrice ?? null,
      change: rawResults[i]?.regularMarketChange ?? null,
      changePercent: rawResults[i]?.regularMarketChangePercent ?? null,
      open: rawResults[i]?.regularMarketOpen ?? null,
      high: rawResults[i]?.regularMarketDayHigh ?? null,
      low: rawResults[i]?.regularMarketDayLow ?? null,
    }));
    cache.set(cacheKey, data, 60);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/fundamentals/:symbol', async (req, res) => {
  try {
    const symbol = decodeURIComponent(req.params.symbol);

    // 1. Disk cache (24h) — fundamentals change quarterly
    const diskCached = readFundCache(symbol);
    if (diskCached) return res.json(diskCached);

    // 2. In-memory cache (1h)
    const cacheKey = `fund_${symbol}`;
    const memCached = cache.get(cacheKey);
    if (memCached) return res.json(memCached);

    // 3. Fetch from yfinance
    const data = await runPython(['fundamentals', symbol]);

    if (!data) return res.status(404).json({ error: 'unavailable' });

    cache.set(cacheKey, data, 3600);  // 1h in-memory
    writeFundCache(symbol, data);      // 24h on disk
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const IPSA_META = {
  'AGUAS-A.SN':  { name: 'Aguas Andinas',         sector: 'Utilities'              },
  'BSANTANDER.SN':{ name: 'Bco. Santander',        sector: 'Financials'             },
  'BCI.SN':      { name: 'BCI',                    sector: 'Financials'             },
  'CAP.SN':      { name: 'CAP',                    sector: 'Materials'              },
  'CCU.SN':      { name: 'CCU',                    sector: 'Consumer Staples'       },
  'CENCOSUD.SN': { name: 'Cencosud',               sector: 'Consumer Discretionary' },
  'CENCOMALLS.SN':{ name: 'CencoMalls',            sector: 'Real Estate'            },
  'CHILE.SN':    { name: 'Bco. de Chile',           sector: 'Financials'             },
  'CMPC.SN':     { name: 'CMPC',                   sector: 'Materials'              },
  'COLBUN.SN':   { name: 'Colbún',                 sector: 'Utilities'              },
  'CONCHATORO.SN':{ name: 'Concha y Toro',         sector: 'Consumer Staples'       },
  'COPEC.SN':    { name: 'Copec',                  sector: 'Energy'                 },
  'ECL.SN':      { name: 'Enel Transmisión',       sector: 'Utilities'              },
  'ENELAM.SN':   { name: 'Enel Américas',          sector: 'Utilities'              },
  'ENELCHILE.SN':{ name: 'Enel Chile',             sector: 'Utilities'              },
  'FALABELLA.SN':{ name: 'Falabella',              sector: 'Consumer Discretionary' },
  'FORUS.SN':    { name: 'Forus',                  sector: 'Consumer Discretionary' },
  'IAM.SN':      { name: 'IAM',                    sector: 'Utilities'              },
  'ITAUCL.SN':   { name: 'Itaú CorpBanca',         sector: 'Financials'             },
  'LTM.SN':      { name: 'LATAM Airlines',         sector: 'Industrials'            },
  'MALLPLAZA.SN':{ name: 'Mall Plaza',             sector: 'Real Estate'            },
  'PARAUCO.SN':  { name: 'Parque Arauco',          sector: 'Real Estate'            },
  'RIPLEY.SN':   { name: 'Ripley',                 sector: 'Consumer Discretionary' },
  'SALFACORP.SN':{ name: 'Salfacorp',              sector: 'Industrials'            },
  'SK.SN':       { name: 'SK',                     sector: 'Industrials'            },
  'SMU.SN':      { name: 'SMU',                    sector: 'Consumer Staples'       },
  'SQM-B.SN':    { name: 'SQM',                    sector: 'Materials'              },
  'VAPORES.SN':  { name: 'Vapores',                sector: 'Industrials'            },
  'WATTS.SN':    { name: 'Watts',                  sector: 'Consumer Staples'       },
  'SONDA.SN':    { name: 'Sonda',                  sector: 'Technology'             },
  'ANDINA-B.SN': { name: 'Andina',                 sector: 'Consumer Staples'       },
  'BESALCO.SN':  { name: 'Besalco',                sector: 'Industrials'            },
  'ILC.SN':      { name: 'ILC',                    sector: 'Financials'             },
  'QUINENCO.SN': { name: 'Quiñenco',               sector: 'Industrials'            },
};

app.get('/api/heatmap', async (_req, res) => {
  try {
    const cacheKey = 'heatmap';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    let quotesData = cache.get('quotes_all');
    if (!quotesData) {
      const rawResults = await batchQuotes(IPSA_SYMBOLS);
      quotesData = IPSA_SYMBOLS.map((sym, i) => normalizeQuote(sym, rawResults[i]));
      cache.set('quotes_all', quotesData);
    }

    const data = IPSA_SYMBOLS.map(sym => {
      const q = quotesData.find(q => q.symbol === sym);
      const meta = IPSA_META[sym] || { name: sym.replace('.SN', ''), sector: 'Other' };
      return {
        symbol: sym,
        ticker: sym.replace('.SN', ''),
        name:   meta.name,
        sector: meta.sector,
        marketCap:    q?.marketCap    ?? null,
        changePercent: q?.regularMarketChangePercent ?? null,
        price:         q?.regularMarketPrice ?? null,
      };
    }).filter(d => d.marketCap != null && d.marketCap > 0);

    cache.set(cacheKey, data, 60);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/top-performers', async (_req, res) => {
  try {
    const cacheKey = 'top_performers';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Reuse cached IPSA quotes or fetch fresh
    let quotesData = cache.get('quotes_all');
    if (!quotesData) {
      const rawResults = await batchQuotes(IPSA_SYMBOLS);
      quotesData = IPSA_SYMBOLS.map((sym, i) => normalizeQuote(sym, rawResults[i]));
      cache.set('quotes_all', quotesData);
    }

    // Batch-fetch 1-month daily history for all IPSA symbols to compute week/month returns
    const perfData = await runPython(['perf_batch', IPSA_SYMBOLS.join(',')]);

    const buildTop5 = (getChange) =>
      IPSA_SYMBOLS
        .map(sym => {
          const q = quotesData.find(q => q.symbol === sym);
          return { symbol: sym, change: getChange(sym, q), price: q?.regularMarketPrice ?? null };
        })
        .filter(s => s.change != null)
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);

    const result = {
      day:   buildTop5((_sym, q) => q?.regularMarketChangePercent ?? null),
      week:  buildTop5((sym)      => perfData?.[sym]?.week  ?? null),
      month: buildTop5((sym)      => perfData?.[sym]?.month ?? null),
    };

    cache.set(cacheKey, result, 300); // 5 min cache
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/simulate', async (req, res) => {
  try {
    const { symbol, startDate } = req.query;
    if (!symbol || !startDate) return res.status(400).json({ error: 'symbol and startDate required' });

    const cacheKey = `simulate_${symbol}_${startDate}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [stock, ipsa] = await Promise.all([
      runPython(['history_range', symbol, startDate]),
      runPython(['history_range', '^IPSA', startDate]),
    ]);

    const result = { stock: stock || [], ipsa: ipsa || [] };
    cache.set(cacheKey, result, 3600);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── News ───────────────────────────────────────────────────────────────────────

const NEWS_FEEDS = [
  { name: 'IPSA · Bolsa',       url: 'https://news.google.com/rss/search?q=IPSA+bolsa+Santiago&hl=es-419&gl=CL&ceid=CL:es-419',          color: '#00c6ff' },
  { name: 'Economía Chile',     url: 'https://news.google.com/rss/search?q=economia+finanzas+Chile&hl=es-419&gl=CL&ceid=CL:es-419',      color: '#00e676' },
  { name: 'Minería · Cobre',    url: 'https://news.google.com/rss/search?q=cobre+litio+mineria+Chile&hl=es-419&gl=CL&ceid=CL:es-419',    color: '#ffd700' },
  { name: 'BBC Mundo Economía', url: 'https://feeds.bbci.co.uk/mundo/economia/rss.xml',                                                   color: '#8b5cf6' },
];

function parseRSS(xml, sourceName, color) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const link  = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
               || block.match(/<guid[^>]*isPermaLink="true"[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim();
    const pub   = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
    if (title) {
      const parsed = pub ? new Date(pub) : null;
      items.push({ title, url: link || '#', date: parsed && !isNaN(parsed) ? parsed.toLocaleDateString('es-CL') : '', rawDate: parsed && !isNaN(parsed) ? parsed.getTime() : 0, source: sourceName, color });
    }
  }
  return items.slice(0, 8);
}

app.get('/api/news/debug', async (_req, res) => {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(f =>
      axios.get(f.url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } })
        .then(r => ({ name: f.name, status: r.status, contentType: r.headers['content-type'], length: r.data?.length, preview: r.data?.slice(0, 300) }))
        .catch(e => ({ name: f.name, error: e.message }))
    )
  );
  res.json(results.map(r => r.value ?? r.reason));
});

app.get('/api/news', async (_req, res) => {
  try {
    const cacheKey = 'news_feed';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const results = await Promise.allSettled(
      NEWS_FEEDS.map(f =>
        axios.get(f.url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } })
          .then(r => parseRSS(r.data, f.name, f.color))
      )
    );

    const articles = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') articles.push(...r.value);
      else console.warn(`[news] ${NEWS_FEEDS[i].name} failed:`, r.reason?.message);
    });

    articles.sort((a, b) => b.rawDate - a.rawDate);

    cache.set(cacheKey, articles, 900); // 15 min
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Production static
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`DELTA API server running on http://localhost:${PORT}`);

  // Pre-warm caches in background
  setTimeout(() => {
    batchQuotes(IPSA_SYMBOLS).then(() => console.log('[cache] IPSA quotes ready'));
    batchQuotes(FX_SYMBOLS).then(() => console.log('[cache] FX ready'));
    batchQuotes(COMMODITY_SYMBOLS).then(() => console.log('[cache] Commodities ready'));
    batchQuotes(INDEX_SYMBOLS).then(() => console.log('[cache] Global indices ready'));
  }, 500);
});
