import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { IPSA_CONSTITUENTS } from '../../data/ipsaConstituents';
import { fmt } from '../../utils/formatters';
import { fetchSimulate } from '../../utils/api';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const MIN_DATE = '2010-01-01';

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
        color: color || '#e2e8f0',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7fa0' }}>{sub}</div>}
    </div>
  );
}

function SmallStat({ label, value, color }) {
  return (
    <div style={{
      background: '#080c14', border: '1px solid #1a2535', borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: color || '#c9d6e3' }}>{value}</div>
    </div>
  );
}

function formatAxisDate(dateStr, totalDays) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (totalDays > 365) return d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
  if (totalDays > 60)  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
}

const CustomTooltip = ({ active, payload, label, amount }) => {
  if (!active || !payload?.length) return null;
  const stock = payload.find(p => p.dataKey === 'stock');
  const ipsa  = payload.find(p => p.dataKey === 'ipsa');
  return (
    <div style={{
      background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8,
      padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: '#6b7fa0', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {stock && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#00c6ff' }}>
          <span>Acción</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {fmt.currency(stock.value)} &nbsp;
            <span style={{ color: stock.value >= amount ? '#00e676' : '#ff4757', fontSize: 11 }}>
              ({stock.value >= amount ? '+' : ''}{((stock.value / amount - 1) * 100).toFixed(1)}%)
            </span>
          </span>
        </div>
      )}
      {ipsa?.value != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#6b7fa0', marginTop: 4 }}>
          <span>IPSA</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {fmt.currency(ipsa.value)} &nbsp;
            <span style={{ color: ipsa.value >= amount ? '#00e676' : '#ff4757', fontSize: 11 }}>
              ({ipsa.value >= amount ? '+' : ''}{((ipsa.value / amount - 1) * 100).toFixed(1)}%)
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function Simulator() {
  const [ticker,    setTicker]    = useState('');
  const [amount,    setAmount]    = useState('');
  const [startDate, setStartDate] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [rawData,   setRawData]   = useState(null);

  const parsedAmount = useMemo(() => {
    const n = parseFloat(String(amount).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) || n <= 0 ? null : n;
  }, [amount]);

  // ── Compute simulation metrics ─────────────────────────────────────────────
  const results = useMemo(() => {
    if (!rawData || !parsedAmount) return null;
    const stock = rawData.stock.filter(d => d.close != null && d.close > 0);
    const ipsa  = rawData.ipsa.filter(d => d.close != null && d.close > 0);
    if (stock.length < 2) return null;

    const startPrice   = stock[0].close;
    const currentPrice = stock[stock.length - 1].close;
    const shares       = parsedAmount / startPrice;
    const currentValue = shares * currentPrice;
    const returnAbs    = currentValue - parsedAmount;
    const returnPct    = (currentValue / parsedAmount - 1) * 100;

    // IPSA benchmark
    const ipsaMap    = new Map(ipsa.map(d => [d.date, d]));
    const ipsaStart  = ipsa[0]?.close ?? null;
    const ipsaEnd    = ipsa[ipsa.length - 1]?.close ?? null;
    const ipsaReturn = ipsaStart && ipsaEnd ? (ipsaEnd / ipsaStart - 1) * 100 : null;
    const alpha      = ipsaReturn != null ? returnPct - ipsaReturn : null;
    const ipsaValue  = ipsaStart && ipsaEnd ? parsedAmount * (ipsaEnd / ipsaStart) : null;

    // Chart data — align stock with IPSA by date
    const chartData = stock.map(d => {
      const ip = ipsaMap.get(d.date);
      return {
        date:  d.date,
        stock: shares * d.close,
        ipsa:  ip && ipsaStart ? (parsedAmount / ipsaStart) * ip.close : null,
      };
    });

    // Daily returns
    const dailyReturns = [];
    for (let i = 1; i < stock.length; i++) {
      const r = (stock[i].close - stock[i - 1].close) / stock[i - 1].close * 100;
      dailyReturns.push({ date: stock[i].date, ret: r });
    }

    const bestDay  = dailyReturns.reduce((b, d) => d.ret > (b?.ret ?? -Infinity) ? d : b, null);
    const worstDay = dailyReturns.reduce((w, d) => d.ret < (w?.ret ?? Infinity)  ? d : w, null);
    const positiveDays = dailyReturns.filter(d => d.ret > 0).length;
    const positivePct  = dailyReturns.length > 0 ? (positiveDays / dailyReturns.length) * 100 : null;

    // Annualized volatility
    const mean     = dailyReturns.reduce((s, d) => s + d.ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, d) => s + (d.ret - mean) ** 2, 0) / dailyReturns.length;
    const annualVol = Math.sqrt(variance) * Math.sqrt(252);

    // Max drawdown
    let peak = stock[0].close;
    let maxDD = 0;
    stock.forEach(d => {
      if (d.close > peak) peak = d.close;
      const dd = (d.close - peak) / peak * 100;
      if (dd < maxDD) maxDD = dd;
    });

    // Sharpe (annualized return vs 5% risk-free)
    const years      = stock.length / 252;
    const annualRet  = years > 0 ? ((currentValue / parsedAmount) ** (1 / years) - 1) * 100 : 0;
    const sharpe     = annualVol > 0 ? ((annualRet - 5) / annualVol) : null;

    // Duration in days
    const days = Math.round(
      (new Date(stock[stock.length - 1].date) - new Date(stock[0].date)) / (1000 * 60 * 60 * 24)
    );

    return {
      startPrice, currentPrice, shares, currentValue,
      returnAbs, returnPct, ipsaReturn, alpha, ipsaValue,
      chartData, bestDay, worstDay,
      positiveDays, positivePct, dailyCount: dailyReturns.length,
      annualVol, maxDD, sharpe, days,
      startDateActual: stock[0].date, endDateActual: stock[stock.length - 1].date,
    };
  }, [rawData, parsedAmount]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSimulate = async () => {
    if (!ticker.trim()) { setError('Ingresa un ticker o nombre de empresa.'); return; }
    if (!parsedAmount)  { setError('Ingresa un monto válido mayor a 0.'); return; }
    if (!startDate)     { setError('Selecciona una fecha de entrada.'); return; }
    if (startDate >= TODAY) { setError('La fecha debe ser anterior a hoy.'); return; }

    setError('');
    setLoading(true);
    setRawData(null);
    try {
      const data = await fetchSimulate(ticker.trim().toUpperCase(), startDate);
      if (!data.stock?.length) {
        setError(`No se encontraron datos para "${ticker.trim().toUpperCase()}" desde ${startDate}. Verifica el ticker (e.g. FALABELLA.SN, ^IPSA).`);
      } else {
        setRawData(data);
      }
    } catch {
      setError('Error al obtener los datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const totalDays = results?.days ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Form card */}
      <div className="card">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
            ¿Qué hubiera pasado si...?
          </h2>
          <p style={{ fontSize: 13, color: '#6b7fa0' }}>
            Simula una inversión hipotética y compara el resultado contra el benchmark IPSA.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'end' }}>
          {/* Ticker */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Acción / Ticker
            </label>
            <input
              list="ipsa-tickers"
              value={ticker}
              onChange={e => setTicker(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSimulate()}
              placeholder="FALABELLA.SN"
              style={{
                width: '100%', background: '#080c14', border: '1px solid #1e2d45',
                borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '10px 12px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <datalist id="ipsa-tickers">
              {IPSA_CONSTITUENTS.map(c => (
                <option key={c.ticker} value={c.ticker}>{c.name}</option>
              ))}
            </datalist>
          </div>

          {/* Amount */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Monto inicial (CLP)
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSimulate()}
              placeholder="1000000"
              min="1"
              style={{
                width: '100%', background: '#080c14', border: '1px solid #1e2d45',
                borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '10px 12px',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Fecha de entrada
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              min={MIN_DATE}
              max={TODAY}
              style={{
                width: '100%', background: '#080c14', border: '1px solid #1e2d45',
                borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '10px 12px',
                outline: 'none', boxSizing: 'border-box', colorScheme: 'dark',
              }}
            />
          </div>

          {/* Button */}
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="btn btn-primary"
            style={{ height: 42, paddingLeft: 24, paddingRight: 24, whiteSpace: 'nowrap' }}
          >
            {loading ? 'Calculando...' : '▶ Simular'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 14, padding: '10px 14px', background: 'rgba(255,71,87,0.08)',
            border: '1px solid rgba(255,71,87,0.25)', borderRadius: 8,
            color: '#ff4757', fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7fa0' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 14 }}>Obteniendo datos históricos...</div>
          <div style={{ fontSize: 12, marginTop: 6, color: '#4a5568' }}>Esto puede tomar unos segundos</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !results && !error && (
        <div style={{
          textAlign: 'center', padding: '56px 0', color: '#4a5568',
          border: '1px dashed #1e2d45', borderRadius: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔮</div>
          <div style={{ fontSize: 15, color: '#6b7fa0', marginBottom: 6 }}>Ingresa los datos y presiona Simular</div>
          <div style={{ fontSize: 12 }}>Ejemplo: FALABELLA.SN · $1.000.000 · 01/01/2022</div>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard
              label="Inversión inicial"
              value={fmt.currency(parsedAmount)}
              sub={`${results.shares.toLocaleString('es-CL', { maximumFractionDigits: 0 })} acciones a ${fmt.price(results.startPrice)}`}
            />
            <StatCard
              label="Valor actual"
              value={fmt.currency(results.currentValue)}
              sub={`Precio actual: ${fmt.price(results.currentPrice)}`}
              color={results.currentValue >= parsedAmount ? '#00e676' : '#ff4757'}
            />
            <StatCard
              label="Retorno total"
              value={fmt.percent(results.returnPct)}
              sub={`${results.returnAbs >= 0 ? '+' : ''}${fmt.currency(results.returnAbs)} CLP`}
              color={results.returnPct >= 0 ? '#00e676' : '#ff4757'}
            />
            <StatCard
              label="vs Benchmark IPSA"
              value={results.alpha != null ? `${results.alpha >= 0 ? '+' : ''}${results.alpha.toFixed(2)} pp` : '—'}
              sub={results.ipsaReturn != null ? `IPSA: ${fmt.percent(results.ipsaReturn)} · Hoy: ${fmt.currency(results.ipsaValue)}` : 'Datos IPSA no disponibles'}
              color={results.alpha != null ? (results.alpha >= 0 ? '#00e676' : '#ff4757') : '#6b7fa0'}
            />
          </div>

          {/* Chart */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                  Evolución de la inversión
                </div>
                <div style={{ fontSize: 12, color: '#6b7fa0', marginTop: 2 }}>
                  {results.startDateActual} → {results.endDateActual} · {results.days} días · {results.dailyCount} sesiones
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#00c6ff' }}>── {ticker.replace('.SN', '').toUpperCase()}</span>
                <span style={{ color: '#4a5568' }}>── IPSA</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={results.chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2535" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7fa0', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#1e2d45' }}
                  tickFormatter={d => formatAxisDate(d, totalDays)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#6b7fa0', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => fmt.compact(v)}
                  width={62}
                />
                <Tooltip content={<CustomTooltip amount={parsedAmount} />} />
                <ReferenceLine
                  y={parsedAmount}
                  stroke="#2d3f5a"
                  strokeDasharray="4 2"
                  label={{ value: 'Inversión', fill: '#4a5568', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="ipsa"
                  stroke="#2d4060"
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                  name="IPSA"
                />
                <Line
                  type="monotone"
                  dataKey="stock"
                  stroke="#00c6ff"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  name={ticker.replace('.SN', '')}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stats grid */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 14 }}>
              Estadísticas del período
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <SmallStat
                label="Retorno anualizado"
                value={results.days > 0
                  ? fmt.percent(((results.currentValue / parsedAmount) ** (365 / results.days) - 1) * 100)
                  : '—'}
                color={results.returnPct >= 0 ? '#00e676' : '#ff4757'}
              />
              <SmallStat
                label="Volatilidad anual"
                value={`${results.annualVol.toFixed(1)}%`}
                color={results.annualVol > 30 ? '#ff4757' : results.annualVol > 20 ? '#ffd700' : '#00e676'}
              />
              <SmallStat
                label="Máx. Drawdown"
                value={`${results.maxDD.toFixed(1)}%`}
                color={results.maxDD < -20 ? '#ff4757' : results.maxDD < -10 ? '#ffd700' : '#00e676'}
              />
              <SmallStat
                label="Sharpe Ratio"
                value={results.sharpe != null ? results.sharpe.toFixed(2) : '—'}
                color={results.sharpe != null ? (results.sharpe > 1 ? '#00e676' : results.sharpe > 0 ? '#ffd700' : '#ff4757') : '#6b7fa0'}
              />
              <SmallStat
                label="Mejor día"
                value={results.bestDay ? `${results.bestDay.ret >= 0 ? '+' : ''}${results.bestDay.ret.toFixed(2)}%` : '—'}
                color="#00e676"
              />
              <SmallStat
                label="Peor día"
                value={results.worstDay ? `${results.worstDay.ret.toFixed(2)}%` : '—'}
                color="#ff4757"
              />
              <SmallStat
                label="Días positivos"
                value={results.positivePct != null
                  ? `${results.positivePct.toFixed(0)}% (${results.positiveDays}/${results.dailyCount})`
                  : '—'}
                color={results.positivePct != null ? (results.positivePct >= 50 ? '#00e676' : '#ff4757') : '#6b7fa0'}
              />
              <SmallStat
                label="Duración"
                value={results.days >= 365
                  ? `${(results.days / 365).toFixed(1)} años`
                  : `${results.days} días`}
              />
            </div>

            {/* Best/worst day detail */}
            {(results.bestDay || results.worstDay) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                {results.bestDay && (
                  <div style={{ background: 'rgba(0,230,118,0.05)', border: '1px solid rgba(0,230,118,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <span style={{ color: '#6b7fa0' }}>Mejor jornada:</span>
                    <span style={{ color: '#00e676', fontWeight: 600, marginLeft: 8 }}>
                      +{results.bestDay.ret.toFixed(2)}%
                    </span>
                    <span style={{ color: '#4a5568', marginLeft: 8 }}>{results.bestDay.date}</span>
                  </div>
                )}
                {results.worstDay && (
                  <div style={{ background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.15)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <span style={{ color: '#6b7fa0' }}>Peor jornada:</span>
                    <span style={{ color: '#ff4757', fontWeight: 600, marginLeft: 8 }}>
                      {results.worstDay.ret.toFixed(2)}%
                    </span>
                    <span style={{ color: '#4a5568', marginLeft: 8 }}>{results.worstDay.date}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
