import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchQuotes } from '../utils/api';

const STORAGE_KEY = 'delta_portfolios_v1';
const LEGACY_KEY  = 'delta_portfolio_v2';

// ── Core logic ─────────────────────────────────────────────────────────────────

// Derive remaining BUY lots from transaction history using FIFO.
// This is the single source of truth for "what shares do I hold and how much".
function derivePositions(transactions) {
  const buys = transactions
    .filter(t => t.type === 'BUY')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(t => ({ ...t, remaining: t.quantity }));

  const sells = transactions
    .filter(t => t.type === 'SELL')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const sell of sells) {
    let toSell = sell.quantity;
    for (const lot of buys.filter(b => b.ticker === sell.ticker)) {
      if (toSell <= 0) break;
      const consumed = Math.min(lot.remaining, toSell);
      lot.remaining -= consumed;
      toSell -= consumed;
    }
  }

  return buys
    .filter(b => b.remaining > 0)
    .map(b => ({
      id:       b.id,
      ticker:   b.ticker,
      name:     b.name   || b.ticker,
      sector:   b.sector || 'Unknown',
      quantity: b.remaining,
      buyPrice: b.price,
      buyDate:  b.date,
      currency: b.currency || 'CLP',
    }));
}

// Compute realized P&L for a SELL using FIFO cost basis.
// Used when editing a SELL transaction so the stored value stays accurate.
function computeRealizedPnL(transactions, sellTxId, qty, price, date, ticker) {
  const buys = transactions
    .filter(t => t.type === 'BUY' && t.ticker === ticker)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(t => ({ ...t, remaining: t.quantity }));

  // Consume shares from prior SELL transactions (excluding the one being edited)
  transactions
    .filter(t => t.type === 'SELL' && t.ticker === ticker && t.id !== sellTxId && new Date(t.date) <= new Date(date))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(s => {
      let toSell = s.quantity;
      for (const lot of buys) {
        if (toSell <= 0) break;
        const consumed = Math.min(lot.remaining, toSell);
        lot.remaining -= consumed;
        toSell -= consumed;
      }
    });

  let remaining = qty;
  let cost = 0;
  for (const lot of buys) {
    if (remaining <= 0) break;
    if (lot.remaining <= 0) continue;
    const consumed = Math.min(lot.remaining, remaining);
    cost += consumed * lot.price;
    remaining -= consumed;
  }

  return qty * price - cost;
}

// ── Storage ────────────────────────────────────────────────────────────────────

const emptyPortfolio = (id, name) => ({
  id,
  name,
  transactions: [],
  cashReserve:  0,
  dividends:    [],
});

// Old format stored a separate `positions` array alongside `transactions`.
// BUY transactions lacked name/sector/currency — copy them in from positions, then drop positions.
function migratePortfolio(p) {
  if (!p.positions) return p;
  const posMap = {};
  p.positions.forEach(pos => { posMap[pos.id] = pos; });
  const transactions = (p.transactions || []).map(t => {
    if (t.type === 'BUY' && posMap[t.id]) {
      const pos = posMap[t.id];
      return { ...t, name: pos.name, sector: pos.sector, currency: pos.currency || 'CLP' };
    }
    return t;
  });
  const { positions: _dropped, ...rest } = p;
  return { ...rest, transactions };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const needsMigration = Object.values(parsed.portfolios).some(p => p.positions);
      if (needsMigration) {
        const migrated = {
          ...parsed,
          portfolios: Object.fromEntries(
            Object.entries(parsed.portfolios).map(([id, p]) => [id, migratePortfolio(p)])
          ),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    }
    // Migrate from legacy single-portfolio format
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const d = JSON.parse(legacy);
      const p1 = migratePortfolio({ id: 'p1', name: 'Principal', ...d });
      const migrated = { activeId: 'p1', portfolios: { p1 } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (_) {}
  return { activeId: 'p1', portfolios: { p1: emptyPortfolio('p1', 'Principal') } };
}

function saveToStorage(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function usePortfolio() {
  const [state,       setState]       = useState(loadFromStorage);
  const [quotes,      setQuotes]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // `portfolio` is the stored data + positions derived from transactions.
  // Only the stored fields (transactions, cashReserve, dividends) are persisted.
  const rawPortfolio    = state.portfolios[state.activeId] ?? emptyPortfolio(state.activeId ?? 'p1', 'Portafolio');
  // Memoize so positions array reference is stable between renders — prevents
  // downstream useMemo/useEffect hooks from firing on every quote refresh.
  const derivedPositions = useMemo(() => derivePositions(rawPortfolio.transactions), [rawPortfolio.transactions]);
  const portfolio        = { ...rawPortfolio, positions: derivedPositions };

  // Central updater — always reads fresh state via the functional setState form,
  // so no mutation can ever close over a stale portfolio snapshot.
  const updateActivePortfolio = useCallback((updater) => {
    setState(s => {
      const current = s.portfolios[s.activeId] ?? emptyPortfolio(s.activeId, 'Portafolio');
      const updated = typeof updater === 'function' ? updater(current) : updater;
      const next    = { ...s, portfolios: { ...s.portfolios, [s.activeId]: updated } };
      saveToStorage(next);
      return next;
    });
  }, []);

  // ── Portfolio management ───────────────────────────────────────────────────

  const createPortfolio = useCallback((name) => {
    const id = `p${Date.now()}`;
    setState(s => {
      const next = {
        ...s,
        activeId:   id,
        portfolios: { ...s.portfolios, [id]: emptyPortfolio(id, name.trim() || 'Nuevo Portafolio') },
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  const switchPortfolio = useCallback((id) => {
    setState(s => {
      if (!s.portfolios[id]) return s;
      const next = { ...s, activeId: id };
      saveToStorage(next);
      return next;
    });
  }, []);

  const renamePortfolio = useCallback((id, name) => {
    setState(s => {
      if (!s.portfolios[id]) return s;
      const next = { ...s, portfolios: { ...s.portfolios, [id]: { ...s.portfolios[id], name: name.trim() } } };
      saveToStorage(next);
      return next;
    });
  }, []);

  const deletePortfolio = useCallback((id) => {
    setState(s => {
      if (Object.keys(s.portfolios).length <= 1) return s;
      const { [id]: _, ...rest } = s.portfolios;
      const nextActive = s.activeId === id ? Object.keys(rest)[0] : s.activeId;
      const next = { ...s, activeId: nextActive, portfolios: rest };
      saveToStorage(next);
      return next;
    });
  }, []);

  // ── Quotes ─────────────────────────────────────────────────────────────────

  const refreshQuotes = useCallback(async () => {
    if (portfolio.positions.length === 0) {
      setLastUpdated(new Date());
      return;
    }
    setLoading(true);
    try {
      const symbols = [...new Set(portfolio.positions.map(p => p.ticker))];
      const data    = await fetchQuotes(symbols);
      const map     = {};
      data.forEach(q => { map[q.symbol] = q; });
      setQuotes(map);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to refresh quotes:', err);
    } finally {
      setLoading(false);
    }
  }, [portfolio.positions]);

  useEffect(() => {
    setQuotes({});
  }, [state.activeId]);

  useEffect(() => {
    refreshQuotes();
    const interval = setInterval(refreshQuotes, 60000);
    return () => clearInterval(interval);
  }, [refreshQuotes]);

  // ── Position operations ────────────────────────────────────────────────────

  const addPosition = useCallback((position) => {
    const id    = Date.now().toString();
    const qty   = parseFloat(position.quantity);
    const price = parseFloat(position.buyPrice);
    const date  = position.buyDate || new Date().toISOString().split('T')[0];
    const buyTx = {
      id, type: 'BUY',
      ticker: position.ticker, name: position.name, sector: position.sector,
      quantity: qty, price, total: qty * price, date, currency: 'CLP',
    };
    updateActivePortfolio(p => ({ ...p, transactions: [...p.transactions, buyTx] }));
  }, [updateActivePortfolio]);

  const sellPosition = useCallback(({ ticker, quantity, price, date, total, realizedPnL }) => {
    const sellTx = {
      id: Date.now().toString(), type: 'SELL',
      ticker, quantity, price, total, realizedPnL, date,
    };
    updateActivePortfolio(p => ({ ...p, transactions: [...p.transactions, sellTx] }));
  }, [updateActivePortfolio]);

  const removeByTicker = useCallback((ticker) => {
    updateActivePortfolio(p => {
      const lotsToRemove = derivePositions(p.transactions).filter(pos => pos.ticker === ticker);
      if (!lotsToRemove.length) return p;
      const sellTxs = lotsToRemove.map(pos => {
        const currentPrice = quotes[pos.ticker]?.regularMarketPrice ?? pos.buyPrice;
        return {
          id: Date.now().toString() + Math.random(), type: 'SELL', ticker: pos.ticker,
          quantity: pos.quantity, price: currentPrice,
          total: pos.quantity * currentPrice,
          realizedPnL: pos.quantity * (currentPrice - pos.buyPrice),
          date: new Date().toISOString().split('T')[0],
        };
      });
      return { ...p, transactions: [...p.transactions, ...sellTxs] };
    });
  }, [updateActivePortfolio, quotes]);

  // Edit a transaction. For SELL transactions, realizedPnL is recomputed from
  // the actual FIFO cost basis so it stays accurate after qty/price/date changes.
  const editTransaction = useCallback((transactionId, updates) => {
    updateActivePortfolio(p => {
      const tx = p.transactions.find(t => t.id === transactionId);
      if (!tx) return p;
      const qty   = updates.quantity != null ? parseFloat(updates.quantity) : tx.quantity;
      const price = updates.price    != null ? parseFloat(updates.price)    : tx.price;
      const date  = updates.date     != null ? updates.date                 : tx.date;
      let updatedTx = { ...tx, quantity: qty, price, date, total: qty * price };
      if (tx.type === 'SELL') {
        updatedTx.realizedPnL = computeRealizedPnL(p.transactions, transactionId, qty, price, date, tx.ticker);
      }
      return { ...p, transactions: p.transactions.map(t => t.id === transactionId ? updatedTx : t) };
    });
  }, [updateActivePortfolio]);

  // Deleting any transaction is safe: positions are always re-derived from the
  // remaining transactions, so deleting a SELL automatically restores the lots.
  const deleteTransaction = useCallback((transactionId) => {
    updateActivePortfolio(p => ({
      ...p, transactions: p.transactions.filter(t => t.id !== transactionId),
    }));
  }, [updateActivePortfolio]);

  const updateCash = useCallback((amount) => {
    updateActivePortfolio(p => ({ ...p, cashReserve: parseFloat(amount) || 0 }));
  }, [updateActivePortfolio]);

  const addDividend = useCallback((dividend) => {
    updateActivePortfolio(p => ({
      ...p,
      dividends:    [...p.dividends, { id: Date.now().toString(), ...dividend, date: dividend.date || new Date().toISOString().split('T')[0] }],
      cashReserve:  p.cashReserve + parseFloat(dividend.amount),
    }));
  }, [updateActivePortfolio]);

  // ── Computed metrics ───────────────────────────────────────────────────────

  const metrics = (() => {
    let equityValue = 0;
    let totalCost   = 0;
    const positionsWithData = portfolio.positions.map(pos => {
      const quote            = quotes[pos.ticker];
      const currentPrice     = quote?.regularMarketPrice ?? null;
      const currentValue     = currentPrice != null ? pos.quantity * currentPrice : null;
      const costBasis        = pos.quantity * pos.buyPrice;
      const unrealizedPnL    = currentValue != null ? currentValue - costBasis : null;
      const unrealizedPnLPct = costBasis > 0 && unrealizedPnL != null ? (unrealizedPnL / costBasis) * 100 : null;
      if (currentValue != null) equityValue += currentValue;
      totalCost += costBasis;
      return { ...pos, quote, currentPrice, currentValue, costBasis, unrealizedPnL, unrealizedPnLPct };
    });

    const totalNav              = equityValue + portfolio.cashReserve;
    const totalUnrealizedPnL    = equityValue - totalCost;
    const totalUnrealizedPnLPct = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;
    const equityPct = totalNav > 0 ? (equityValue / totalNav) * 100 : 0;
    const cashPct   = totalNav > 0 ? (portfolio.cashReserve / totalNav) * 100 : 0;

    const realizedPnL = portfolio.transactions
      .filter(t => t.type === 'SELL')
      .reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

    let dailyPnL = null;
    positionsWithData.forEach(p => {
      const changePct = p.quote?.regularMarketChangePercent;
      if (changePct != null && p.currentValue != null) {
        if (dailyPnL === null) dailyPnL = 0;
        dailyPnL += p.currentValue * (changePct / 100);
      }
    });
    const dailyPnLPct = equityValue > 0 && dailyPnL != null ? (dailyPnL / equityValue) * 100 : null;

    const totalDividends = portfolio.dividends.reduce((sum, d) => sum + parseFloat(d.amount), 0);

    const sectorMap = {};
    positionsWithData.forEach(p => {
      if (p.currentValue == null) return;
      const s = p.sector || 'Unknown';
      sectorMap[s] = (sectorMap[s] || 0) + p.currentValue;
    });
    const sectorAllocation = Object.entries(sectorMap).map(([sector, value]) => ({
      sector, value, pct: totalNav > 0 ? (value / totalNav) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    const groupMap = {};
    positionsWithData.forEach(pos => {
      if (!groupMap[pos.ticker]) {
        groupMap[pos.ticker] = { ticker: pos.ticker, name: pos.name, sector: pos.sector,
          quote: pos.quote, currentPrice: pos.currentPrice, quantity: 0, totalCost: 0, currentValue: null };
      }
      const g = groupMap[pos.ticker];
      g.quantity += pos.quantity;
      g.totalCost += pos.costBasis;
      if (pos.currentValue != null) g.currentValue = (g.currentValue ?? 0) + pos.currentValue;
    });
    const groupedPositions = Object.values(groupMap).map(g => {
      const buyPrice         = g.quantity > 0 ? g.totalCost / g.quantity : 0;
      const unrealizedPnL    = g.currentValue != null ? g.currentValue - g.totalCost : null;
      const unrealizedPnLPct = g.totalCost > 0 && unrealizedPnL != null ? (unrealizedPnL / g.totalCost) * 100 : null;
      return { id: g.ticker, ...g, buyPrice, costBasis: g.totalCost, unrealizedPnL, unrealizedPnLPct };
    });

    const sorted    = [...positionsWithData].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));
    const top5Value = sorted.slice(0, 5).reduce((s, p) => s + (p.currentValue || 0), 0);
    const top5Pct   = totalNav > 0 ? (top5Value / totalNav) * 100 : 0;

    return {
      positions: positionsWithData, groupedPositions,
      equityValue, totalCost, totalNav, totalUnrealizedPnL, totalUnrealizedPnLPct,
      equityPct, cashPct, realizedPnL, totalDividends, sectorAllocation, top5Pct,
      dailyPnL, dailyPnLPct, positionCount: portfolio.positions.length,
    };
  })();

  const portfolioList = Object.values(state.portfolios).map(p => ({ id: p.id, name: p.name }));

  return {
    portfolio, metrics, quotes, loading, lastUpdated,
    portfolioList,
    activePortfolioId: state.activeId,
    createPortfolio, switchPortfolio, renamePortfolio, deletePortfolio,
    addPosition, sellPosition, removeByTicker, editTransaction, deleteTransaction,
    updateCash, addDividend, refreshQuotes,
  };
}
