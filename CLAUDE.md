# DELTA — Project Guide for Claude

## Project Overview
DELTA is a Chilean IPSA portfolio manager — dark-themed financial dashboard with real-time market data, portfolio tracking, and market monitoring.

## Architecture
- **Backend**: Node.js + Express (ESM) — `server.js` on port 3001
- **Frontend**: React 18 + Vite — `client/` on port 5173
- **Data bridge**: Python `fetcher.py` (yfinance) spawned as child process by Node.js
- **Charts**: Recharts
- **Styling**: Tailwind CSS + custom CSS variables in `client/src/index.css`
- **State**: localStorage via `usePortfolio` hook (key: `delta_portfolio_v2`)
- **Cache**: NodeCache (TTL 120s) in server.js + `lastKnownPrices` Map fallback

## Run Commands
```bash
# Terminal 1 — Backend
cd /Users/martinhurtado/Desktop/Delta
npm run dev

# Terminal 2 — Frontend
cd /Users/martinhurtado/Desktop/Delta/client && npm run dev
```

## Key Files
| File | Purpose |
|------|---------|
| `server.js` | Express API, Python bridge, cache, routes |
| `fetcher.py` | Python yfinance data fetcher (4 modes: quotes, history, quote_single, fundamentals) |
| `client/src/App.jsx` | 3-tab SPA: Dashboard, Portfolio, Mercado |
| `client/src/data/ipsaConstituents.js` | 30 IPSA companies with sector metadata |
| `client/src/hooks/usePortfolio.js` | Portfolio state, P&L, metrics, auto-refresh quotes |
| `client/src/hooks/useMarketData.js` | IPSA index, FX, macro data |
| `client/src/utils/api.js` | Axios API calls to backend |
| `client/src/utils/formatters.js` | Number/currency formatters |

## API Routes (server.js)
- `GET /api/quotes?symbols=SYM1,SYM2` — batch quotes
- `GET /api/quote/:symbol` — single quote
- `GET /api/history/:symbol?period=1y&interval=1d` — price history
- `GET /api/ipsa` — IPSA index quote
- `GET /api/fx` — FX rates (currencies)
- `GET /api/commodities` — commodity prices
- `GET /api/indices` — global stock indices
- `GET /api/macro` — Chilean macro indicators (TPM, UF, IPC) from mindicador.cl
- `GET /api/sectors` — sector breakdown
- `GET /api/news` — noticias financieras (Google News IPSA, Economía Chile, Minería/Cobre, BBC Mundo; cache 15 min; ordenadas por fecha desc)
- `GET /api/news/debug` — diagnóstico de cada feed RSS (status, contentType, preview)

## Symbol Conventions
- Chilean stocks: `.SN` suffix (e.g., `FALABELLA.SN`, `ITAUCL.SN`, `CENCOMALLS.SN`)
- IPSA index: `^IPSA` (encode as `%5EIPSA` in URLs)
- FX: `USDCLP=X`, `EURCLP=X`, `GBPCLP=X`, `USDEUR=X`, `JPYCLP=X`, `CNYCLP=X`
- Commodities: `CL=F` (WTI), `BZ=F` (Brent), `HG=F` (Copper), `GC=F` (Gold), `SI=F` (Silver), `LIT` (Lithium ETF), `WOOD` (Celulosa ETF)
- Global indices: `^GSPC`, `^IXIC`, `^DJI`, `^MERV`, `^BVSP`, `^FTSE`, `^GDAXI`, `^FCHI`, `^STOXX50E`, `^IBEX`, `^N225`, `^HSI`

## IPSA Constituents (ipsaConstituents.js)
35 companies. Key corrected tickers:
- `ITAUCL.SN` (not ITAUCORP)
- `CENCOMALLS.SN` (not CENCOSHOPP)
- Added: `ANDINA-B.SN`, `BESALCO.SN`, `ILC.SN`, `QUINENCO.SN`

## Python Bridge (fetcher.py)
Node.js spawns `python3 fetcher.py <mode> <args>` and reads JSON from stdout.

**Why Python?** Yahoo Finance blocks Node.js requests (TLS fingerprinting / 429 errors). yfinance works.

### Modes
```bash
python3 fetcher.py quotes  "SYM1,SYM2,..."
python3 fetcher.py history "^IPSA" "1y" "1d"
python3 fetcher.py quote_single "FALABELLA.SN"
python3 fetcher.py fundamentals "ECL.SN"
```

### Stooq Fallback for ^IPSA
yfinance returns only 1 row for `^IPSA` daily history. When `len(df) < 5`, fetcher falls back to Stooq:
```
https://stooq.com/q/d/l/?s=%5Eipsa&d1=YYYYMMDD&d2=YYYYMMDD&i=d
```
**Only Stooq is allowed for `^IPSA` daily data.** No other external sources.

### Intraday vs Daily
- Intraday intervals: `1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h`
- Date format: intraday → `%m-%d %H:%M`, daily → `%Y-%m-%d`

## Components Built

### Dashboard Tab
- `PortfolioChart.jsx` — Portfolio return vs IPSA benchmark (parallel fetch, weighted returns)
- `PerformanceChart.jsx` — IPSA-only normalized return chart
- `SectorExposure.jsx` — Sector bar chart
- `AllocationChart.jsx` — Portfolio allocation donut

### Portfolio Tab
- Position table groups multiple BUY lots of same ticker → shows total qty + weighted avg price
- Grouping done via `useMemo` in `App.jsx` (not in the hook) — uses `metrics.positions` as input
- `SellPositionModal.jsx` — Enter qty/price/date to sell; shows P&L preview; partial sells supported (FIFO)
- Transaction history with edit/delete per row
- `EditTransactionModal.jsx` — Edit qty/price/date, two-click delete; SELL transactions recalculate realizedPnL
- `usePortfolio.js` methods: `addPosition`, `sellPosition` (FIFO), `removeByTicker`, `editTransaction`, `deleteTransaction`

### Position Grouping Pattern
```js
// In App.jsx — group metrics.positions by ticker
const groupedPositions = useMemo(() => {
  const map = {};
  metrics.positions.forEach(pos => { /* accumulate qty, totalCost, currentValue */ });
  return Object.values(map).map(g => ({
    ...g, buyPrice: totalCost/qty, costBasis: totalCost, unrealizedPnL, unrealizedPnLPct
  }));
}, [metrics.positions]);
```

### sellPosition (FIFO)
```js
// usePortfolio.js — reduces oldest BUY lots first
sellPosition({ ticker, quantity, price, date, total, realizedPnL })
```

### Mercado Tab
- `GlobalIndices.jsx` — 12 indices with group filter (Américas/Latam/Europa/Asia)
- `FXRates.jsx` — Two tabs: 💱 Divisas | 📦 Commodities
- Macro indicators: TPM, UF, IPC from mindicador.cl
- News feed
- `MarketOverview.jsx` — "Constituyentes IPSA" section is collapsible (state: `constituentesOpen`, default open); click header to toggle

### Portfolio Tab — Historial de Transacciones
- Transaction history table is collapsible (state: `historialOpen` in `App.jsx`, default open); click header to toggle

## Chart Periods
All charts support: `1D (5m)`, `1S (5d/1h)`, `1M (1mo/1d)`, `3M`, `6M`, `1A`, `2A`

## Known Issues & Fixes
| Problem | Fix |
|---------|-----|
| Yahoo Finance 429 | Python bridge with yfinance |
| `^IPSA` URL malformed | `encodeURIComponent(symbol)` in api.js |
| IPSA chart single point | `len(df) < 5` triggers Stooq fallback |
| Python SyntaxError | Helper functions must be defined BEFORE `if/elif` mode blocks |
| Slow initial load | Cache pre-warming on server startup |
| Var% incorrecta en varios stocks chilenos (CENCOMALLS, COLBUN, CONCHATORO, BESALCO, ILC, BCI, LTM) | `fast_info.previous_close` y `t.info` devuelven cierre ajustado por dividendos. Fix: helper `get_prev_close(t, fallback)` en `fetcher.py` usa `t.history(period='5d', interval='1d', auto_adjust=False)`. Aplica a los modos `quotes` y `quote_single`. |
| Var% incorrecta en stocks de bajo volumen (SONDA, CAP, etc.) que no tienen vela del día actual en el historial diario | `hist[-2]` tomaba el cierre de hace 2 días en vez de ayer. Fix en `get_prev_close`: compara `hist.index[-1].date()` con `datetime.now().date()`; si hoy NO está en el historial usa `hist[-1]` (cierre de ayer); si SÍ está usa `hist[-2]`. |
| Precios redondeados en tabla de mercado | `fmt.currency` usa 0 decimales. Fix: `fmt.price` en `formatters.js` con `minimumFractionDigits: 0, maximumFractionDigits: 4`. Usado en `MarketOverview.jsx`. |
| QUINENCO.SN ausente en Monitor de Mercado | Faltaba en `IPSA_SYMBOLS` de `server.js`. Ya estaba en `ipsaConstituents.js`. |
| P/B y EV/EBITDA absurdos en ECL, COPEC, etc. | yfinance mezcla market cap (CLP) con balance sheet (USD). Fix: detectar `price_ccy != fin_ccy`, fetch USDCLP, convertir statement values a CLP, recalcular. |
| RSI/Estocástico vacíos en 1D para algunos stocks | yfinance devuelve pocas velas intraday para `.SN`. Fix: períodos adaptativos según cantidad de velas disponibles. |
| PortfolioChart pesos incorrectos (costo vs valor mercado) | `weightedTickers` usaba `quantity * buyPrice` (costo base). Fix: usar `p.currentValue ?? (p.quantity * p.buyPrice)` para que los pesos reflejen el valor de mercado actual, igual que Daily P&L. |
| PortfolioChart 1D no captura gap de apertura | El primer candle intradía no tenía `prevPrice`, omitiendo el gap cierre→apertura. Fix: para `interval='5m'` o `'1h'`, inicializar `prevPrice[ticker] = regularMarketPreviousClose` antes del loop. Solo aplica a 1D/1S; períodos diarios (1M+) no necesitan esto. |
| News feed — fuentes RSS bloqueadas | Emol (ECONNRESET) y La Tercera/Banco Central (404) bloquean peticiones de servidor. Fix: reemplazar por 4 queries de Google News + BBC Mundo Economía, todas fetched server-side via `/api/news` (cache 15 min). |
| News feed — orden incorrecto | `parseRSS` formateaba la fecha a `toLocaleDateString('es-CL')` antes de guardar; el sort posterior no podía parsear ese formato. Fix: guardar `rawDate` (timestamp numérico) junto a `date` (formateada), ordenar por `rawDate`. |
| MarketHeatmap crash al navegar a Mercado | Recharts Treemap llama `content` también para el nodo raíz (depth=0) con props undefined. Fix: guardar con `if (depth === 0 || x == null || !width || !height || width < 30 || height < 20) return null` en CustomContent. También remover props inválidos `stroke`/`strokeWidth` del Treemap y agregar `isAnimationActive={false}`. |
| usePortfolio — dos intervalos de polling | Refactor multi-portafolio dejó dos `useEffect` con `setInterval(refreshQuotes, 60000)`. Fix: separar en un efecto que limpia quotes al cambiar `activeId` y otro que maneja el polling, dependiente solo de `refreshQuotes`. |

## Multi-Portafolio
- Storage key: `delta_portfolios_v1` (migra automáticamente desde `delta_portfolio_v2`)
- Formato: `{ activeId: string, portfolios: { [id]: { id, name, positions, cashReserve, transactions, dividends } } }`
- `usePortfolio.js` expone: `portfolioList`, `activePortfolioId`, `createPortfolio`, `switchPortfolio`, `renamePortfolio`, `deletePortfolio`
- UI: dropdown en Header con nombre del portafolio activo, crear/renombrar/eliminar inline
- Al cambiar de portafolio: se limpian quotes y se re-fetchean para el portafolio activo

## Heatmap del Mercado (`MarketHeatmap.jsx`)
- Endpoint: `GET /api/heatmap` — reusa cache de quotes IPSA + `IPSA_META` dict en server.js (nombre + sector por ticker)
- Frontend: Recharts `Treemap` con `content={<CustomContent />}` — tamaño = market cap, color = variación del día
- Filtro por sector en la UI
- Posición en Mercado tab: debajo de MarketOverview (nivel IPSA), encima de GlobalIndices
- **IMPORTANTE**: `CustomContent` DEBE verificar `depth === 0` y dimensiones nulas antes de renderizar (Recharts llama content para el nodo raíz con props undefined)

## Métricas de Riesgo (fetcher.py — modo fundamentals)
Calculadas desde 1 año de historial diario vs `^IPSA`. Campos adicionales en la respuesta:
- `riskBeta`: cov(stock, IPSA) / var(IPSA) — correlación con el mercado
- `riskVolatility`: std(daily_returns) × √252 × 100 — volatilidad anualizada en %
- `riskSharpe`: (retorno_anual - 5%) / volatilidad — usa TPM ~5% como tasa libre de riesgo
- Mostrados en `StockDetailView.jsx` en sección "Riesgo (1A vs IPSA)" con colores semáforo
- El cache de 24h en disco no incluye estos campos en entradas previas → borrar `cache/fundamentals/` para regenerar

## Fundamentals (fetcher.py — mode: fundamentals)
- All data from **yfinance only** (`t.income_stmt`, `t.balance_sheet`, `t.cashflow`, `t.fast_info`, `t.info`)
- Ratios computed from raw financial statements (not yfinance pre-computed values)
- **Currency mismatch handling**: stocks like ECL.SN and COPEC.SN trade in CLP but report financials in USD. When `price_ccy='CLP'` and `fin_ccy='USD'`, fetcher fetches live USDCLP rate via `yf.Ticker('USDCLP=X').fast_info.last_price` and converts all USD statement values to CLP before computing ratios (P/B, EV/EBITDA, P/E)
- Pure statement ratios (margins, ROE, ROA, D/E, current ratio, quick ratio) are currency-neutral — computed regardless
- Disk cache: `cache/fundamentals/<symbol>.json` with 24h TTL
- Server route: `GET /api/fundamentals/:symbol`

## RSI & Stochastic — Adaptive Periods
yfinance returns variable amounts of intraday data for `.SN` stocks (can be as few as 6-8 candles for 1D/5m). Indicators use adaptive parameters based on available candles:

| Candles available | RSI | Stochastic | Min needed |
|---|---|---|---|
| < 10 | RSI(5) | (5,2,2) | 6 / 7 |
| 10–19 | RSI(7) | (7,3,3) | 8 / 11 |
| ≥ 20 | RSI(14) | (14,3,3) | standard |

Labels in UI update dynamically to show the actual period used.

## What's Working
- [x] Real-time quotes for all 35 IPSA constituents (incl. Quinenco)
- [x] IPSA benchmark chart (1D via yfinance intraday, 1M+ via Stooq)
- [x] Portfolio performance chart vs IPSA (compounded daily returns, no mid-period jumps)
- [x] Global indices (Americas, Latam, Europe, Asia)
- [x] FX rates + Commodities (gold, silver, copper, oil, lithium, celulosa)
- [x] Chilean macro indicators (TPM, UF, IPC)
- [x] Transaction edit/delete (SELL realizedPnL recalculates on edit)
- [x] Portfolio P&L with realized/unrealized breakdown
- [x] Position grouping by ticker (weighted avg price, summed qty)
- [x] Sell modal with qty/price/date input, P&L preview, FIFO partial sells
- [x] Constituyentes IPSA table collapsible (MarketOverview.jsx)
- [x] Historial de Transacciones collapsible (App.jsx)
- [x] Fundamentals from yfinance only (no FMP) — self-computed ratios from raw statements
- [x] Currency mismatch fix: USD financials → CLP via live USDCLP rate (ECL, COPEC, etc.)
- [x] RSI + Stochastic adaptive periods for sparse intraday data
- [x] PortfolioChart weights: use current market value (not cost basis) to match Daily P&L weighting
- [x] PortfolioChart 1D/1S: seed prevPrice with previousClose to capture open gap
- [x] Tab Noticias dedicado (separado de Mercado) con feed real via `/api/news` (Google News + BBC Mundo, cache 15 min, filtro por fuente, orden cronológico)
- [x] Heatmap del Mercado (MarketHeatmap.jsx) — Recharts Treemap, tamaño=market cap, color=variación, filtro por sector
- [x] Métricas de Riesgo en fundamentales — Beta vs IPSA, Volatilidad anual, Sharpe Ratio calculados desde historial 1A
- [x] Multi-portafolio — crear/cambiar/renombrar/eliminar portafolios, migración automática desde formato anterior

## Potential Future Improvements
- [ ] Persistent backend cache (Redis or SQLite) to survive restarts
- [ ] Websocket for live price updates (replace 60s polling)
- [x] Portfolio performance chart: fix data alignment when positions have different start dates
- [ ] Export portfolio to CSV/PDF
- [ ] Price alerts / notifications
- [ ] More LATAM indices (Chile stock-specific: `^IPSA` chart overlay on individual stocks)
- [x] News feed improvement (real financial news API)
- [x] Heatmap del Mercado — Treemap IPSA por market cap y variación
- [x] Métricas de Riesgo — Beta, Volatilidad, Sharpe en fundamentales
- [x] Multi-portafolio — gestión de múltiples portafolios independientes
- [ ] Matriz de Correlación — cómo se mueven las posiciones entre sí; detectar sobre-concentración sectorial
- [ ] Comparador de Acciones — gráfico normalizado con 2-3 tickers en el mismo período
- [ ] Watchlist — seguimiento de acciones que no están en portafolio, con alertas opcionales
- [x] Simulador "¿Qué hubiera pasado si...?" — ingresar ticker + monto + fecha hipotética, ver resultado hoy
- [ ] Reporte de Impuestos — resumen anual de ventas realizadas, ganancia/pérdida neta, IGC estimado Chile
- [ ] Deploy público — ver sección "Deploy Guide" más abajo
- [ ] Calendario de Dividendos — fechas ex-div y pago de empresas IPSA, yield on cost por posición

## Deploy Guide (Render + Vercel)

### Contexto
El código corre actualmente **solo local con localStorage** (sin auth, sin DB).
Los archivos del sistema de deploy YA EXISTEN en el repo pero están desconectados:
- `server/auth.js` — registro/login con JWT + bcrypt
- `server/db.js` — conexión PostgreSQL (Supabase)
- `client/src/components/auth/LoginPage.jsx` — UI de login/registro
- `client/src/context/AuthContext.jsx` — contexto de autenticación
- `nixpacks.toml` — config para que Render instale Python + Node juntos
- `render.yaml` — config del servicio en Render

### Infraestructura ya configurada
- **Render** (backend): `https://delta-slet.onrender.com` — servicio "delta", plan Free
- **Vercel** (frontend): `https://delta-tau-two.vercel.app` — proyecto "delta"
- **Supabase** (DB): tablas `users` y `portfolios` ya creadas con datos del usuario

### Variables de entorno ya configuradas
**En Render** (Environment → Edit):
| Key | Estado |
|-----|--------|
| `DATABASE_URL` | ✅ configurado (apunta a Supabase) |
| `JWT_SECRET` | ✅ configurado |
| `NODE_ENV` | ✅ `production` |
| `ALLOWED_ORIGINS` | ✅ `https://delta-tau-two.vercel.app` |

**En Vercel** (Settings → Environment Variables):
| Key | Estado |
|-----|--------|
| `VITE_API_URL` | ✅ `https://delta-slet.onrender.com` |

---

### Pasos para re-deployar (orden exacto)

#### PASO 1 — Arreglar server/db.js (crítico: evita que el servidor cuelgue)
En `server/db.js`, el Pool DEBE tener `connectionTimeoutMillis` para que si la DB falla, el servidor igual arranque:
```js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,  // ← OBLIGATORIO, sin esto el server cuelga indefinidamente
});
```

#### PASO 2 — Arreglar server/auth.js (crítico: evita crashes por event loop bloqueado)
`bcryptjs` (pure JS) con 12 rounds bloquea el event loop de Node por ~10-20 segundos en el CPU lento de Render free tier → el health check de Render falla → el servidor crashea silenciosamente.

**Fix**: bajar de 12 a 10 rounds en `server/auth.js`:
```js
const hash = await bcrypt.hash(password, 10);  // era 12, bajar a 10
```
⚠️ Los usuarios registrados con 12 rounds seguirán funcionando (bcrypt.compare detecta los rounds del hash automáticamente). Solo los nuevos registros usarán 10 rounds.

#### PASO 3 — Reconectar server.js
Agregar imports al inicio:
```js
import { initDB, query } from './server/db.js';
import { register, login, requireAuth } from './server/auth.js';
```

Agregar rutas (antes del bloque de static files):
```js
// Auth
app.post('/auth/register', register);
app.post('/auth/login', login);

// Portfolio (JWT protegido)
app.get('/api/portfolio', requireAuth, async (req, res) => { ... });
app.post('/api/portfolio', requireAuth, async (req, res) => { ... });
app.put('/api/portfolio/:id', requireAuth, async (req, res) => { ... });
app.delete('/api/portfolio/:id', requireAuth, async (req, res) => { ... });
```
Ver commit `f0c01c0` en git para el código completo de estas rutas.

Cambiar el startup al final del archivo (cache pre-warming DEBE ser secuencial, no paralelo):
```js
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DELTA API server running on http://localhost:${PORT}`);
      // PRE-WARMING SECUENCIAL — crítico en Render free tier (512MB RAM)
      // NO usar Promise.all ni llamadas paralelas: causa OOM y crash silencioso
      (async () => {
        await batchQuotes(IPSA_SYMBOLS);    console.log('[cache] IPSA quotes ready');
        await batchQuotes(FX_SYMBOLS);      console.log('[cache] FX ready');
        await batchQuotes(COMMODITY_SYMBOLS); console.log('[cache] Commodities ready');
        await batchQuotes(INDEX_SYMBOLS);   console.log('[cache] Global indices ready');
      })();
    });
  })
  .catch(err => {
    console.error('[fatal] DB init failed:', err.message);
    app.listen(PORT, () => console.log(`DELTA API running (no DB) on port ${PORT}`));
  });
```

#### PASO 4 — Reconectar frontend

**`client/src/utils/api.js`** — agregar timeout 60s y funciones auth:
```js
const api = axios.create({ baseURL: BASE_URL + '/api', timeout: 60000 }); // 60s para cold start

// Interceptor JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('delta_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout en 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/')) {
      localStorage.removeItem('delta_token');
      localStorage.removeItem('delta_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

const authApi = axios.create({ baseURL: BASE_URL, timeout: 60000 });

export const authLogin    = (email, password) => authApi.post('/auth/login',    { email, password }).then(r => r.data);
export const authRegister = (email, password) => authApi.post('/auth/register', { email, password }).then(r => r.data);
export const portfolioGetAll  = () => api.get('/portfolio').then(r => r.data);
export const portfolioSave    = (id, name, data) => api.put(`/portfolio/${id}`, { name, data }).then(r => r.data);
export const portfolioCreate  = (id, name) => api.post('/portfolio', { id, name }).then(r => r.data);
export const portfolioDelete  = (id) => api.delete(`/portfolio/${id}`).then(r => r.data);
```

**`client/src/main.jsx`** — envolver con AuthProvider:
```jsx
import { AuthProvider } from './context/AuthContext.jsx';
// ...
<AuthProvider><App /></AuthProvider>
```

**`client/src/App.jsx`** — agregar gate de login:
```jsx
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';

export default function App() {
  const { isAuthenticated, logout } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return <AppContent logout={logout} />;
}
function AppContent({ logout }) { ... }
```

**`client/src/hooks/usePortfolio.js`** — reemplazar cuerpo por versión con API (ver commit `f0c01c0`). Cambios clave: usar `portfolioGetAll` en lugar de localStorage, `persist` llama a `portfolioSave`, `createPortfolio` llama a `portfolioCreate`, etc.

#### PASO 5 — Push y verificar
```bash
git add -A
git commit -m "feat: restore auth/DB deploy system"
git push
```
Render y Vercel redeploy automáticamente. Verificar en **Render → Logs**:
- ✅ `[db] Tables ready` — DB conectó
- ✅ `[cache] IPSA quotes ready` — Python funciona
- ✅ `Your service is live` — servidor arrancó

---

### Problemas críticos encontrados y sus causas raíz

#### ❌ Servidor crashea silenciosamente cada 2-4 minutos (OOM)
**Causa**: 4 llamadas a `batchQuotes()` en paralelo al arrancar → 4 procesos Python simultáneos → pandas+yfinance × 4 supera los 512MB RAM del free tier → Render mata el proceso sin mostrar error en logs.
**Fix**: Pre-warming **secuencial** con `await` (ver Paso 3).

#### ❌ "Error de conexión" en login (servidor no responde)
**Causa principal**: `bcryptjs` con 12 rounds bloquea el event loop de Node.js por 10-20 segundos en el CPU lento de Render. Durante ese tiempo, el health check de Render falla → restart del servidor → la respuesta al login nunca llega.
**Fix**: Bajar a 10 rounds (ver Paso 2). Alternativa: migrar a `bcrypt` (nativo, usa thread pool, no bloquea event loop).

#### ❌ 502 al inicio aunque DB esté bien configurada
**Causa**: `new Pool({ connectionString: undefined })` sin `connectionTimeoutMillis` → pg intenta conectar indefinidamente → `initDB()` nunca resuelve ni rechaza → `app.listen()` nunca se llama → Render ve el puerto sin responder → 502.
**Fix**: `connectionTimeoutMillis: 5000` en el Pool (ver Paso 1).

#### ❌ Cold start lento (50+ segundos de 502)
**Causa**: Render free tier apaga el servidor tras 15 min sin tráfico. El axios timeout de 15s era menor que el tiempo de arranque.
**Fix**: Timeout de 60s en Axios. No se puede eliminar en plan gratuito; upgrade a plan Starter ($7/mes) elimina el sleep.

#### ❌ Login falla solo desde Vercel, no desde Render directo
**Causa**: CORS — el frontend en Vercel tiene origen diferente al backend en Render. `ALLOWED_ORIGINS` debe incluir exactamente la URL de Vercel (sin trailing slash, con https).
**Fix**: `ALLOWED_ORIGINS=https://delta-tau-two.vercel.app` en Render.

### Migración de datos localStorage → Supabase
Al registrarse en producción, el portafolio empieza vacío. Para migrar posiciones:
1. Abrir localhost:5173 en el navegador local
2. DevTools → Console: `copy(localStorage.getItem('delta_portfolios_v1'))`
3. Pegar el JSON en Supabase → tabla `portfolios` → campo `data` del registro del usuario
