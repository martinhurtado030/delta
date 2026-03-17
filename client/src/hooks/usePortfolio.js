import { useState, useEffect, useCallback } from 'react';
import { fetchQuotes } from '../utils/api';

const STORAGE_KEY = 'delta_portfolios_v1';
const LEGACY_KEY  = 'delta_portfolio_v2';

const emptyPortfolio = (id, name) => ({
  id,
  name,
  positions:    [],
  cashReserve:  0,
  transactions: [],
  dividends:    [],
});

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Migrate from legacy single-portfolio format
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const d = JSON.parse(legacy);
      const migrated = {
        activeId: 'p1',
        portfolios: { p1: { id: 'p1', name: 'Principal', ...d } },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (_) {}
  return { activeId: 'p1', portfolios: { p1: emptyPortfolio('p1', 'Principal') } };
}

function saveToStorage(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
}

export function usePortfolio() {
  const [state,       setState]       = useState(loadFromStorage);
  const [quotes,      setQuotes]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const portfolio = state.portfolios[state.activeId] ?? emptyPortfolio(state.activeId ?? 'p1', 'Portafolio');

  const persist = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(state) : next;
    setState(resolved);
    saveToStorage(resolved);
  }, [state]);

  // ── Portfolio management ──────────────────────────────────────────────────────

  const createPortfolio = useCallback((name) => {
    const id = `p${Date.now()}`;
    persist(s => ({
      ...s,
      activeId: id,
      portfolios: { ...s.portfolios, [id]: emptyPortfolio(id, name.trim() || 'Nuevo Portafolio') },
    }));
  }, [persist]);

  const switchPortfolio = useCallback((id) => {
    persist(s => s.portfolios[id] ? { ...s, activeId: id } : s);
  }, [persist]);

  const renamePortfolio = useCallback((id, name) => {
    persist(s => {
      if (!s.portfolios[id]) return s;
      return { ...s, portfolios: { ...s.portfolios, [id]: { ...s.portfolios[id], name: name.trim() } } };
    });
  }, [persist]);

  const deletePortfolio = useCallback((id) => {
    persist(s => {
      if (Object.keys(s.portfolios).length <= 1) return s;
      const { [id]: _, ...rest } = s.portfolios;
      const nextActive = s.activeId === id ? Object.keys(rest)[0] : s.activeId;
      return { ...s, activeId: nextActive, portfolios: rest };
    });
  }, [persist]);

  // ── Quotes ────────────────────────────────────────────────────────────────────

  const refreshQuotes = useCallback(async () => {
    if (portfolio.positions.length === 0) {
      setLastUpdated(new Date());
      return;
    }
    setLoading(true);
    try {
      const symbols = [...new Set(portfolio.positions.map(p => p.ticker))];
      const data = await fetchQuotes(symbols);
      const map = {};
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

  // ── Position operations ───────────────────────────────────────────────────────

  const addPosition = useCallback((position) => {
    const newPosition = {
      id:       Date.now().toString(),
      ticker:   position.ticker,
      name:     position.name,
      sector:   position.sector,
      quantity: parseFloat(position.quantity),
      buyPrice: parseFloat(position.buyPrice),
      buyDate:  position.buyDate || new Date().toISOString().split('T')[0],
      currency: 'CLP',
    };
    const transaction = {
      id: newPosition.id, type: 'BUY',
      ticker: position.ticker, quantity: newPosition.quantity,
      price: newPosition.buyPrice, total: newPosition.quantity * newPosition.buyPrice,
      date: newPosition.buyDate,
    };
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: {
          ...portfolio,
          positions:    [...portfolio.positions, newPosition],
          transactions: [...portfolio.transactions, transaction],
        },
      },
    }));
  }, [portfolio, persist]);

  const sellPosition = useCallback(({ ticker, quantity, price, date, total, realizedPnL }) => {
    const lots = portfolio.positions
      .filter(p => p.ticker === ticker)
      .sort((a, b) => new Date(a.buyDate) - new Date(b.buyDate));
    if (!lots.length) return;

    const transaction = {
      id: Date.now().toString(), type: 'SELL',
      ticker, quantity, price, total, realizedPnL, date,
    };

    let remaining = quantity;
    const newPositions = [...portfolio.positions];
    for (const lot of lots) {
      if (remaining <= 0) break;
      const idx = newPositions.findIndex(p => p.id === lot.id);
      if (remaining >= lot.quantity) {
        newPositions.splice(idx, 1);
        remaining -= lot.quantity;
      } else {
        newPositions[idx] = { ...newPositions[idx], quantity: lot.quantity - remaining };
        remaining = 0;
      }
    }
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: {
          ...portfolio,
          positions:    newPositions,
          transactions: [...portfolio.transactions, transaction],
        },
      },
    }));
  }, [portfolio, persist]);

  const removeByTicker = useCallback((ticker) => {
    const toRemove = portfolio.positions.filter(p => p.ticker === ticker);
    if (!toRemove.length) return;
    const newTxs = toRemove.map(pos => {
      const currentPrice = quotes[pos.ticker]?.regularMarketPrice ?? pos.buyPrice;
      return {
        id: Date.now().toString() + Math.random(), type: 'SELL', ticker: pos.ticker,
        quantity: pos.quantity, price: currentPrice,
        total: pos.quantity * currentPrice, realizedPnL: pos.quantity * (currentPrice - pos.buyPrice),
        date: new Date().toISOString().split('T')[0],
      };
    });
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: {
          ...portfolio,
          positions:    portfolio.positions.filter(p => p.ticker !== ticker),
          transactions: [...portfolio.transactions, ...newTxs],
        },
      },
    }));
  }, [portfolio, quotes, persist]);

  const editTransaction = useCallback((transactionId, updates) => {
    const tx = portfolio.transactions.find(t => t.id === transactionId);
    if (!tx) return;
    const qty   = updates.quantity != null ? parseFloat(updates.quantity) : tx.quantity;
    const price = updates.price    != null ? parseFloat(updates.price)    : tx.price;
    const date  = updates.date     != null ? updates.date                 : tx.date;
    let updatedRealizedPnL = tx.realizedPnL;
    if (tx.type === 'SELL' && tx.realizedPnL != null) {
      const costPerShare = (tx.total - tx.realizedPnL) / tx.quantity;
      updatedRealizedPnL = qty * price - qty * costPerShare;
    }
    const newTransactions = portfolio.transactions.map(t =>
      t.id === transactionId
        ? { ...t, quantity: qty, price, date, total: qty * price, realizedPnL: updatedRealizedPnL }
        : t
    );
    let newPositions = portfolio.positions;
    if (tx.type === 'BUY') {
      newPositions = portfolio.positions.map(p =>
        p.id === transactionId ? { ...p, quantity: qty, buyPrice: price, buyDate: date } : p
      );
    }
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: { ...portfolio, transactions: newTransactions, positions: newPositions },
      },
    }));
  }, [portfolio, persist]);

  const deleteTransaction = useCallback((transactionId) => {
    const tx = portfolio.transactions.find(t => t.id === transactionId);
    if (!tx) return;
    const newTransactions = portfolio.transactions.filter(t => t.id !== transactionId);
    const newPositions = tx.type === 'BUY'
      ? portfolio.positions.filter(p => p.id !== transactionId)
      : portfolio.positions;
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: { ...portfolio, transactions: newTransactions, positions: newPositions },
      },
    }));
  }, [portfolio, persist]);

  const updateCash = useCallback((amount) => {
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: { ...portfolio, cashReserve: parseFloat(amount) || 0 },
      },
    }));
  }, [portfolio, persist]);

  const addDividend = useCallback((dividend) => {
    persist(s => ({
      ...s,
      portfolios: {
        ...s.portfolios,
        [s.activeId]: {
          ...portfolio,
          dividends:   [...portfolio.dividends, { id: Date.now().toString(), ...dividend, date: dividend.date || new Date().toISOString().split('T')[0] }],
          cashReserve: portfolio.cashReserve + parseFloat(dividend.amount),
        },
      },
    }));
  }, [portfolio, persist]);

  // ── Computed metrics ──────────────────────────────────────────────────────────

  const metrics = (() => {
    let equityValue = 0;
    let totalCost   = 0;
    const positionsWithData = portfolio.positions.map(pos => {
      const quote        = quotes[pos.ticker];
      const currentPrice = quote?.regularMarketPrice ?? null;
      const currentValue = currentPrice != null ? pos.quantity * currentPrice : null;
      const costBasis    = pos.quantity * pos.buyPrice;
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
