import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, CrosshairMode, LineStyle, ColorType } from 'lightweight-charts';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { X } from 'lucide-react';
import { fetchHistory, fetchFundamentals } from '../../utils/api';
import { fmt } from '../../utils/formatters';

// ─── Math helpers ─────────────────────────────────────────────────────────────

function _sma(arr, n) {
  const out = [];
  for (let i = n - 1; i < arr.length; i++) {
    out.push(arr.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n);
  }
  return out;
}

/** Wilder's RSI */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return [];
  const out = [];
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= period; al /= period;
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}

/** Slow Stochastic (period, smoothK, smoothD) */
function calcStoch(highs, lows, closes, period = 14, sk = 3, sd = 3) {
  if (closes.length < period) return [];
  const fastK = [];
  for (let i = period - 1; i < closes.length; i++) {
    const h = Math.max(...highs.slice(i - period + 1, i + 1));
    const l = Math.min(...lows.slice(i - period + 1, i + 1));
    fastK.push(h === l ? 50 : ((closes[i] - l) / (h - l)) * 100);
  }
  const slowK = _sma(fastK, sk);
  const d = _sma(slowK, sd);
  const off = slowK.length - d.length;
  return d.map((dv, i) => ({ k: +slowK[i + off].toFixed(2), d: +dv.toFixed(2) }));
}

/** Pivot-point Support/Resistance clusters */
function calcSR(candles, lookback = 5) {
  const res = [], sup = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isH = true, isL = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isH = false;
      if (candles[i - j].low  <= c.low  || candles[i + j].low  <= c.low)  isL = false;
    }
    if (isH) res.push(c.high);
    if (isL) sup.push(c.low);
  }
  const cluster = (lvls) => {
    if (!lvls.length) return [];
    lvls.sort((a, b) => a - b);
    const cls = [[lvls[0]]];
    for (let i = 1; i < lvls.length; i++) {
      const last = cls[cls.length - 1];
      const avg = last.reduce((s, v) => s + v, 0) / last.length;
      if (Math.abs(lvls[i] - avg) / avg < 0.015) last.push(lvls[i]);
      else cls.push([lvls[i]]);
    }
    return cls.map(c => +(c.reduce((s, v) => s + v, 0) / c.length).toFixed(4));
  };
  return { resistances: cluster(res).slice(-3), supports: cluster(sup).slice(0, 3) };
}

/** Fibonacci retracement levels from visible range */
function calcFib(candles) {
  const high = Math.max(...candles.map(c => c.high));
  const low  = Math.min(...candles.map(c => c.low));
  const rng  = high - low;
  return [0.236, 0.382, 0.5, 0.618, 0.786].map(r => ({
    ratio: r,
    price: +(low + rng * r).toFixed(4),
  }));
}

/** Convert fetcher.py date strings → lightweight-charts time */
function toChartTime(dateStr, isIntraday) {
  if (!isIntraday) return dateStr; // 'YYYY-MM-DD' accepted directly
  // 'MM-DD HH:MM' → unix seconds (assume current year)
  const now = new Date();
  const [dp, tp = '00:00'] = dateStr.split(' ');
  const [m, d]   = dp.split('-').map(Number);
  const [h, min] = tp.split(':').map(Number);
  return Math.floor(new Date(now.getFullYear(), m - 1, d, h, min).getTime() / 1000);
}

// ─── Period config ────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '1D', period: '1d',  interval: '5m',  intraday: true  },
  { label: '1S', period: '5d',  interval: '1h',  intraday: true  },
  { label: '1M', period: '1mo', interval: '1d',  intraday: false },
  { label: '3M', period: '3mo', interval: '1d',  intraday: false },
  { label: '6M', period: '6mo', interval: '1d',  intraday: false },
  { label: '1A', period: '1y',  interval: '1d',  intraday: false },
];

const FIB_COLORS = {
  0.236: '#ffd700aa',
  0.382: '#ffd700cc',
  0.5:   '#00c6ffcc',
  0.618: '#ffd700cc',
  0.786: '#ffd700aa',
};

// ─── Candlestick Chart (lightweight-charts) ───────────────────────────────────

function CandlestickChart({ candles, isIntraday, loading }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef(null);
  const volRef       = useRef(null);
  const linesRef     = useRef([]);
  const fibLevelsRef = useRef([]);
  const [hoveredFib, setHoveredFib] = useState(null);

  // Initialize once
  useEffect(() => {
    if (!containerRef.current) return;
    let chart, ro;
    try {
      chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height: 360,
        layout: {
          background: { type: ColorType.Solid, color: '#080c14' },
          textColor: '#c9d6e3',
        },
        grid: {
          vertLines: { color: '#1e2d4530' },
          horzLines: { color: '#1e2d4530' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: '#1e2d45',
          scaleMargins: { top: 0.08, bottom: 0.26 },
        },
        timeScale: {
          borderColor: '#1e2d45',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
        },
      });

      const candleSeries = chart.addCandlestickSeries({
        upColor:       '#00e676',
        downColor:     '#ff4757',
        borderVisible: false,
        wickUpColor:   '#00e676',
        wickDownColor: '#ff4757',
      });

      const volSeries = chart.addHistogramSeries({
        priceFormat:      { type: 'volume' },
        priceScaleId:     'vol',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
        visible: false,
      });

      chartRef.current  = chart;
      seriesRef.current = candleSeries;
      volRef.current    = volSeries;

      ro = new ResizeObserver(() => {
        try {
          if (containerRef.current && chartRef.current)
            chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
        } catch (_) {}
      });
      ro.observe(containerRef.current);

      chart.subscribeCrosshairMove(param => {
        try {
          if (!param.point || !seriesRef.current) { setHoveredFib(null); return; }
          const price = seriesRef.current.coordinateToPrice(param.point.y);
          if (price == null) { setHoveredFib(null); return; }
          const nearby = fibLevelsRef.current.find(
            f => Math.abs(f.price - price) / f.price < 0.008
          );
          setHoveredFib(nearby ? { ...nearby, y: param.point.y } : null);
        } catch (_) {}
      });
    } catch (e) {
      console.warn('[chart] init error:', e.message);
    }

    return () => {
      try { ro?.disconnect(); } catch (_) {}
      try { chart?.remove(); } catch (_) {}
      chartRef.current  = null;
      seriesRef.current = null;
      volRef.current    = null;
      linesRef.current  = [];
      fibLevelsRef.current = [];
    };
  }, []);

  // Update data + overlays when candles / intraday flag change
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !candles?.length) return;

    try {
      const valid = candles.filter(c =>
        c.open != null && c.close != null && c.high != null && c.low != null
        && !isNaN(c.open) && !isNaN(c.close) && !isNaN(c.high) && !isNaN(c.low)
      );
      if (valid.length < 2) return;

      const sorted = [...valid]
        .map(c => ({ ...c, _t: toChartTime(c.date, isIntraday) }))
        .filter(c => c._t != null && (typeof c._t === 'string' ? c._t.length > 0 : !isNaN(c._t)))
        .sort((a, b) => (a._t > b._t ? 1 : a._t < b._t ? -1 : 0))
        .filter((c, i, arr) => i === 0 || String(c._t) !== String(arr[i - 1]._t));

      if (sorted.length < 2) return;

      seriesRef.current.setData(
        sorted.map(c => ({ time: c._t, open: c.open, high: c.high, low: c.low, close: c.close }))
      );
      volRef.current.setData(
        sorted.map(c => ({
          time: c._t,
          value: c.volume || 0,
          color: c.close >= c.open ? '#00e67620' : '#ff475720',
        }))
      );

      chartRef.current.applyOptions({
        timeScale: { timeVisible: isIntraday, secondsVisible: false },
      });

      linesRef.current.forEach(pl => {
        try { seriesRef.current?.removePriceLine(pl); } catch (_) {}
      });
      linesRef.current = [];

      if (valid.length > 12) {
        try {
          const { supports, resistances } = calcSR(valid);
          supports.forEach((price, i) => {
            linesRef.current.push(seriesRef.current.createPriceLine({
              price, color: '#00e67655', lineWidth: 1,
              lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `S${i + 1}`,
            }));
          });
          resistances.forEach((price, i) => {
            linesRef.current.push(seriesRef.current.createPriceLine({
              price, color: '#ff475755', lineWidth: 1,
              lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `R${i + 1}`,
            }));
          });
          const fibLevels = [];
          calcFib(valid).forEach(({ ratio, price }) => {
            linesRef.current.push(seriesRef.current.createPriceLine({
              price, color: FIB_COLORS[ratio] || '#ffd700aa', lineWidth: 1,
              lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '',
            }));
            fibLevels.push({ ratio, price });
          });
          fibLevelsRef.current = fibLevels;
        } catch (_) {}
      }

      chartRef.current.timeScale().fitContent();
    } catch (e) {
      console.warn('[chart] update error:', e.message);
    }
  }, [candles, isIntraday]);

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#080c1490', borderRadius: 6,
        }}>
          <span style={{ color: '#6b7fa0', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
            Cargando datos...
          </span>
        </div>
      )}
      {hoveredFib && (
        <div style={{
          position: 'absolute', right: 70, top: hoveredFib.y - 11,
          background: '#0d1421ee', border: `1px solid ${FIB_COLORS[hoveredFib.ratio] || '#ffd700aa'}`,
          borderRadius: 4, padding: '1px 7px',
          fontSize: 11, color: '#ffd700', fontFamily: 'JetBrains Mono, monospace',
          zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Fib {hoveredFib.ratio}
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
}

// ─── Fundamentals cards ───────────────────────────────────────────────────────

function FundCard({ label, value, unit = '', color, decimals = 2 }) {
  const display = value != null
    ? `${typeof value === 'number' ? value.toFixed(decimals) : value}${unit}`
    : '—';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid #1e2d4520',
    }}>
      <span style={{ fontSize: 11, color: '#6b7fa0' }}>{label}</span>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600,
        color: color || (value != null ? '#e2e8f0' : '#374151'),
      }}>
        {display}
      </span>
    </div>
  );
}

function FundSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, color: 'var(--accent)', letterSpacing: 1.5,
        textTransform: 'uppercase', fontWeight: 700,
        borderBottom: '1px solid #1e2d45', paddingBottom: 4, marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockDetailView({ symbol, name, quote, onClose }) {
  const [period,       setPeriod]       = useState(PERIODS[2]); // 1M
  const [candles,      setCandles]      = useState([]);
  const [fundamentals, setFundamentals] = useState(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingFund,  setLoadingFund]  = useState(true);

  // Fetch history on period change — cancel stale requests
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoadingChart(true);
    setCandles([]);
    fetchHistory(symbol, period.period, period.interval)
      .then(data => { if (!cancelled) setCandles(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setCandles([]); })
      .finally(() => { if (!cancelled) setLoadingChart(false); });
    return () => { cancelled = true; };
  }, [symbol, period]);

  // Fetch fundamentals once per symbol
  useEffect(() => {
    if (!symbol) return;
    setLoadingFund(true);
    fetchFundamentals(symbol)
      .then(data => setFundamentals(data))
      .catch(() => setFundamentals(null))
      .finally(() => setLoadingFund(false));
  }, [symbol]);

  // Compute RSI + Stochastic from candles
  // Use shorter periods for intraday (1D/5m) since yfinance returns fewer bars for .SN stocks
  const { rsiData, stochData, rsiPeriod, stochPeriod, stochSk, stochSd } = useMemo(() => {
    try {
      const valid = candles.filter(c =>
        c.close != null && c.high != null && c.low != null
        && !isNaN(c.close) && !isNaN(c.high) && !isNaN(c.low)
      );

      const closes = valid.map(c => c.close);
      const highs  = valid.map(c => c.high);
      const lows   = valid.map(c => c.low);
      const times  = valid.map(c => c.date);

      // Adaptive periods based on available candles
      // Stoch(p,sk,sd) needs p + sk + sd - 2 candles minimum
      let rp, sp, sk, sd;
      if (valid.length < 10) {
        rp = 5; sp = 5; sk = 2; sd = 2;  // needs 6 (RSI) / 7 (Stoch)
      } else if (valid.length < 20) {
        rp = 7; sp = 7; sk = 3; sd = 3;  // needs 8 (RSI) / 11 (Stoch)
      } else {
        rp = 14; sp = 14; sk = 3; sd = 3; // standard
      }

      if (valid.length < rp + 1) return { rsiData: [], stochData: [], rsiPeriod: rp, stochPeriod: sp };

      const rsiVals   = calcRSI(closes, rp);
      const stochVals = calcStoch(highs, lows, closes, sp, sk, sd);

      const rOff = closes.length - rsiVals.length;
      const sOff = closes.length - stochVals.length;

      return {
        rsiPeriod:   rp,
        stochPeriod: sp,
        stochSk:     sk,
        stochSd:     sd,
        rsiData:   rsiVals.map((v, i)  => ({ time: times[i + rOff], rsi: +v.toFixed(2) })),
        stochData: stochVals.map((v, i) => ({ time: times[i + sOff], ...v })),
      };
    } catch (e) {
      console.warn('[indicators] calc error:', e.message);
      return { rsiData: [], stochData: [], rsiPeriod: 14, stochPeriod: 14, stochSk: 3, stochSd: 3 };
    }
  }, [candles]);

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const ticker    = symbol?.replace('.SN', '');
  const price     = quote?.regularMarketPrice;
  const change    = quote?.regularMarketChange;
  const changePct = quote?.regularMarketChangePercent;
  const isPos     = (changePct ?? 0) >= 0;

  // Sanity-filter ratios: some Chilean stocks have yfinance currency mismatches
  // (e.g. book value in USD while price/mktcap is in CLP) producing absurd multiples
  const f = fundamentals ? {
    ...fundamentals,
    priceToBook:         (fundamentals.priceToBook        != null && fundamentals.priceToBook        < 100)  ? fundamentals.priceToBook        : null,
    enterpriseToEbitda:  (fundamentals.enterpriseToEbitda != null && fundamentals.enterpriseToEbitda < 200)  ? fundamentals.enterpriseToEbitda  : null,
    trailingPE:          (fundamentals.trailingPE         != null && fundamentals.trailingPE         < 1000) ? fundamentals.trailingPE         : null,
  } : null;

  const lastRsi   = rsiData[rsiData.length - 1]?.rsi;
  const lastStoch = stochData[stochData.length - 1];

  const pct52w = (price != null && f?.fiftyTwoWeekLow != null && f?.fiftyTwoWeekHigh != null
    && f.fiftyTwoWeekHigh !== f.fiftyTwoWeekLow)
    ? Math.min(100, Math.max(0,
        ((price - f.fiftyTwoWeekLow) / (f.fiftyTwoWeekHigh - f.fiftyTwoWeekLow)) * 100
      ))
    : null;

  const ttip = {
    contentStyle: { background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 4, fontSize: 11 },
    labelStyle:   { color: '#6b7fa0' },
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
          ← Volver
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 20, fontWeight: 800, color: '#e2e8f0',
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1,
          }}>
            {ticker}
          </span>
          {(name || f?.shortName) && (
            <span style={{
              fontSize: 12, color: '#6b7fa0',
              maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {name || f.shortName}
            </span>
          )}
        </div>

        {price != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 22, fontWeight: 700, color: '#e2e8f0',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {fmt.price(price)}
            </span>
            <span style={{ fontSize: 13, color: isPos ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {change != null ? `${change >= 0 ? '+' : ''}${fmt.number(change, 2)} ` : ''}
              {changePct != null ? `(${fmt.percent(changePct)})` : ''}
            </span>
          </div>
        )}

        {/* Period selector */}
        <div style={{
          marginLeft: 'auto', display: 'flex', gap: 3,
          background: '#0a0f1a', padding: 3, borderRadius: 6,
          border: '1px solid #1e2d45',
        }}>
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 11px', borderRadius: 4, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all .15s',
                background: period.label === p.label ? 'var(--accent)' : 'transparent',
                color:      period.label === p.label ? '#080c14' : '#6b7fa0',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#6b7fa0', padding: 4, display: 'flex',
        }}>
          <X size={20} />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1fr 276px',
      }}>
        {/* Left: chart + indicators */}
        <div style={{
          padding: '14px 14px 14px 20px',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 7,
          overflow: 'auto',
        }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7fa0' }}>
            <span style={{ color: '#00e67660' }}>── Soporte</span>
            <span style={{ color: '#ff475760' }}>── Resistencia</span>
            <span style={{ color: '#ffd70070' }}>·· Fibonacci (0.382 · 0.5 · 0.618)</span>
          </div>

          {/* Candlestick */}
          <div style={{
            background: '#080c14', borderRadius: 8,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <CandlestickChart
              key={period.label}
              candles={candles}
              isIntraday={period.intraday}
              loading={loadingChart}
            />
          </div>

          {/* RSI */}
          <div style={{
            background: '#080c14', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px 6px',
          }}>
            <div style={{
              fontSize: 10, color: '#6b7fa0', fontWeight: 700,
              letterSpacing: 0.8, marginBottom: 4,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              RSI ({rsiPeriod})
              {lastRsi != null && (() => {
                const rsiColor = lastRsi > 70 ? 'var(--red)' : lastRsi < 30 ? 'var(--green)' : lastRsi > 60 ? '#ffd700' : lastRsi < 40 ? '#7ec8e3' : '#c9d6e3';
                const rsiLabel = lastRsi > 70 ? 'Sobrecompra' : lastRsi > 60 ? 'Zona alcista' : lastRsi < 30 ? 'Sobreventa' : lastRsi < 40 ? 'Zona bajista' : 'Neutral';
                return (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: rsiColor }}>
                    {lastRsi.toFixed(1)}  ·  {rsiLabel}
                  </span>
                );
              })()}
            </div>
            <ResponsiveContainer width="100%" height={78}>
              <ComposedChart data={rsiData} margin={{ top: 2, right: 6, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#1e2d4530" />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fill: '#6b7fa0', fontSize: 9 }} />
                <Tooltip
                  {...ttip}
                  formatter={v => [v?.toFixed(1), 'RSI']}
                  itemStyle={{ color: 'var(--accent)' }}
                />
                <ReferenceArea y1={70} y2={100} fill="#ff475710" ifOverflow="hidden" />
                <ReferenceArea y1={0}  y2={30}  fill="#00e67610" ifOverflow="hidden" />
                <ReferenceLine y={70} stroke="#ff475760" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#00e67660" strokeDasharray="3 3" />
                <Line
                  type="monotone" dataKey="rsi" stroke="var(--accent)"
                  dot={false} strokeWidth={1.5} isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Stochastic */}
          <div style={{
            background: '#080c14', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px 6px',
          }}>
            <div style={{
              fontSize: 10, color: '#6b7fa0', fontWeight: 700,
              letterSpacing: 0.8, marginBottom: 4,
              display: 'flex', gap: 14, alignItems: 'center',
            }}>
              <span>ESTOCÁSTICO LENTO ({stochPeriod}, {stochSk}, {stochSd})</span>
              {lastStoch && (() => {
                const stLabel = lastStoch.k > 80 ? 'Sobrecompra' : lastStoch.k > 60 ? 'Zona alcista' : lastStoch.k < 20 ? 'Sobreventa' : lastStoch.k < 40 ? 'Zona bajista' : 'Neutral';
                const stColor = lastStoch.k > 80 ? 'var(--red)' : lastStoch.k > 60 ? '#ffd700' : lastStoch.k < 20 ? 'var(--green)' : lastStoch.k < 40 ? '#7ec8e3' : '#c9d6e3';
                return (
                  <>
                    <span style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      %K {lastStoch.k?.toFixed(1)}
                    </span>
                    <span style={{ color: 'var(--gold)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      %D {lastStoch.d?.toFixed(1)}
                    </span>
                    <span style={{ color: stColor, fontSize: 10 }}>· {stLabel}</span>
                  </>
                );
              })()}
            </div>
            <ResponsiveContainer width="100%" height={78}>
              <ComposedChart data={stochData} margin={{ top: 2, right: 6, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#1e2d4530" />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} ticks={[20, 50, 80]} tick={{ fill: '#6b7fa0', fontSize: 9 }} />
                <Tooltip
                  {...ttip}
                  formatter={(v, n) => [v?.toFixed(1), n]}
                />
                <ReferenceArea y1={80} y2={100} fill="#ff475710" ifOverflow="hidden" />
                <ReferenceArea y1={0}  y2={20}  fill="#00e67610" ifOverflow="hidden" />
                <ReferenceLine y={80} stroke="#ff475760" strokeDasharray="3 3" />
                <ReferenceLine y={20} stroke="#00e67660" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="k" stroke="var(--accent)" dot={false} strokeWidth={1.5} name="%K" isAnimationActive={false} />
                <Line type="monotone" dataKey="d" stroke="var(--gold)"   dot={false} strokeWidth={1.5} name="%D" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Fundamentals sidebar */}
        <div style={{
          padding: '14px 16px',
          overflowY: 'auto',
          background: 'var(--card)',
        }}>
          {loadingFund ? (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#6b7fa0', fontSize: 12 }}>
              Cargando fundamentales...
            </div>
          ) : (
            <>
              <FundSection title="Valoración">
                <FundCard label="P/E Trailing"   value={f?.trailingPE} />
                <FundCard label="P/E Forward"    value={f?.forwardPE} />
                <FundCard label="P/B Ratio"      value={f?.priceToBook} />
                <FundCard label="EV/EBITDA"      value={f?.enterpriseToEbitda} />
              </FundSection>

              <FundSection title="Rentabilidad">
                <FundCard
                  label="Div. Yield"
                  value={f?.dividendYield}
                  unit="%"
                  color={f?.dividendYield > 0 ? 'var(--green)' : null}
                />
                <FundCard label="Mg. Operativo"  value={f?.operatingMargins != null ? f.operatingMargins * 100 : null} unit="%" />
                <FundCard label="Mg. Neto"        value={f?.profitMargins    != null ? f.profitMargins    * 100 : null} unit="%" />
                <FundCard label="ROE"             value={f?.returnOnEquity   != null ? f.returnOnEquity   * 100 : null} unit="%" />
                <FundCard label="ROA"             value={f?.returnOnAssets   != null ? f.returnOnAssets   * 100 : null} unit="%" />
              </FundSection>

              <FundSection title="Solvencia">
                <FundCard label="Deuda / Equity"  value={f?.debtToEquity  != null ? f.debtToEquity / 100 : null} />
                <FundCard label="Ratio Corriente"  value={f?.currentRatio} />
                <FundCard label="Ratio Rápido"     value={f?.quickRatio} />
              </FundSection>

              <FundSection title="Mercado">
                <FundCard label="Cap. Bursátil"    value={f?.marketCap       != null ? f.marketCap       / 1e9 : null} unit="B" />
                <FundCard label="Enterprise Value" value={f?.enterpriseValue != null ? f.enterpriseValue / 1e9 : null} unit="B" />
                <FundCard label="Beta (yfinance)"  value={f?.beta} decimals={3} />
                <FundCard label="Vol. Prom. (30d)" value={f?.averageVolume   != null ? Math.round(f.averageVolume / 1e3) : null} unit="K" decimals={0} />
              </FundSection>

              <FundSection title="Riesgo (1A vs IPSA)">
                <FundCard
                  label="Beta vs IPSA"
                  value={f?.riskBeta}
                  decimals={3}
                  color={f?.riskBeta != null ? (f.riskBeta > 1.2 ? 'var(--red)' : f.riskBeta < 0.8 ? 'var(--green)' : '#e2e8f0') : null}
                />
                <FundCard
                  label="Volatilidad Anual"
                  value={f?.riskVolatility}
                  unit="%"
                  decimals={1}
                  color={f?.riskVolatility != null ? (f.riskVolatility > 30 ? 'var(--red)' : f.riskVolatility < 15 ? 'var(--green)' : '#ffd700') : null}
                />
                <FundCard
                  label="Sharpe Ratio"
                  value={f?.riskSharpe}
                  decimals={2}
                  color={f?.riskSharpe != null ? (f.riskSharpe > 1 ? 'var(--green)' : f.riskSharpe > 0 ? '#ffd700' : 'var(--red)') : null}
                />
              </FundSection>

              {/* 52-week range bar */}
              <FundSection title="Rango 52 Semanas">
                {f?.fiftyTwoWeekLow != null && f?.fiftyTwoWeekHigh != null ? (
                  <>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 11, fontFamily: 'JetBrains Mono, monospace', marginBottom: 6,
                    }}>
                      <span style={{ color: 'var(--red)' }}>{fmt.price(f.fiftyTwoWeekLow)}</span>
                      {pct52w != null && (
                        <span style={{ color: '#6b7fa0', fontSize: 10 }}>▲ {pct52w.toFixed(1)}%</span>
                      )}
                      <span style={{ color: 'var(--green)' }}>{fmt.price(f.fiftyTwoWeekHigh)}</span>
                    </div>
                    {pct52w != null && (
                      <div style={{ background: '#1e2d45', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{
                          height: '100%', borderRadius: 4, width: `${pct52w}%`,
                          background: pct52w > 65 ? 'var(--green)' : pct52w < 30 ? 'var(--red)' : 'var(--gold)',
                          transition: 'width .4s',
                        }} />
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: '#374151' }}>N/D</span>
                )}
              </FundSection>

              {/* Sector / industry */}
              {f?.sector && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: '#6b7fa0', marginBottom: 2 }}>Sector</div>
                  <div style={{ fontSize: 12, color: '#c9d6e3', fontWeight: 600 }}>{f.sector}</div>
                  {f.industry && (
                    <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 2 }}>{f.industry}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
