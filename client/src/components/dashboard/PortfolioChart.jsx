import React, { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { fetchHistory } from '../../utils/api';

const PERIODS = [
  { label: '1D', period: '1d',  interval: '5m' },
  { label: '1S', period: '5d',  interval: '1h' },
  { label: '1M', period: '1mo', interval: '1d' },
  { label: '3M', period: '3mo', interval: '1d' },
  { label: '6M', period: '6mo', interval: '1d' },
  { label: '1A', period: '1y',  interval: '1d' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value?.toFixed(2)}%
        </div>
      ))}
    </div>
  );
};

export default function PortfolioChart({ positions }) {
  const [selected, setSelected]   = useState(PERIODS[5]); // default 1A
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(false);

  const weightedTickers = useMemo(() => {
    const map = {};
    positions.forEach(p => {
      if (!map[p.ticker]) map[p.ticker] = 0;
      // Use current market value as weight; fall back to cost basis if quotes not loaded
      map[p.ticker] += p.currentValue ?? (p.quantity * p.buyPrice);
    });
    const totalValue = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map).map(([ticker, value]) => ({
      ticker,
      weight: totalValue > 0 ? value / totalValue : 0,
    }));
  }, [positions]);

  useEffect(() => {
    if (weightedTickers.length === 0) return;
    setLoading(true);
    setChartData([]);

    Promise.all([
      fetchHistory('^IPSA', selected.period, selected.interval),
      ...weightedTickers.map(({ ticker }) => fetchHistory(ticker, selected.period, selected.interval)),
    ])
      .then(([ipsaHistory, ...tickerHistories]) => {
        if (!ipsaHistory?.length) return;

        // Build price maps: ticker → { date: price }
        const priceMaps = {};
        weightedTickers.forEach(({ ticker }, i) => {
          priceMaps[ticker] = {};
          tickerHistories[i]?.forEach(d => { priceMaps[ticker][d.date] = d.close; });
        });

        // Compound daily returns so new positions entering mid-period don't cause jumps.
        // Each position contributes its daily % change only on days it has a prior price.
        const prevPrice = {};

        // For intraday (1D/1S), seed prevPrice with previous close so the first candle
        // captures the gap from yesterday's close — aligning with regularMarketChangePercent.
        if (selected.interval === '5m' || selected.interval === '1h') {
          weightedTickers.forEach(({ ticker }) => {
            const pos = positions.find(p => p.ticker === ticker);
            const pc = pos?.quote?.regularMarketPreviousClose;
            if (pc != null) prevPrice[ticker] = pc;
          });
        }

        let portfolioIndex = null;
        const portfolioIndexByDate = {};

        for (const { date } of ipsaHistory) {
          let weightedDailyReturn = 0;
          let activeWeight = 0;

          weightedTickers.forEach(({ ticker, weight }) => {
            const price = priceMaps[ticker][date];
            if (price != null && prevPrice[ticker] != null) {
              weightedDailyReturn += weight * (price / prevPrice[ticker] - 1);
              activeWeight += weight;
            }
            if (price != null) prevPrice[ticker] = price;
          });

          // Initialize index on the first date any position has data
          if (portfolioIndex === null) {
            if (weightedTickers.some(({ ticker }) => priceMaps[ticker][date] != null)) {
              portfolioIndex = 100;
            }
          } else if (activeWeight > 0) {
            portfolioIndex *= (1 + weightedDailyReturn / activeWeight);
          }

          if (portfolioIndex !== null) {
            portfolioIndexByDate[date] = portfolioIndex;
          }
        }

        const ipsaBase = ipsaHistory[0].close;

        const data = ipsaHistory
          .filter(({ date }) => portfolioIndexByDate[date] != null)
          .map(({ date, close: ipsaClose }) => ({
            date,
            Portafolio: parseFloat((portfolioIndexByDate[date] - 100).toFixed(2)),
            IPSA: ipsaClose != null ? parseFloat(((ipsaClose / ipsaBase - 1) * 100).toFixed(2)) : null,
          }));

        setChartData(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected, weightedTickers]);

  if (positions.length === 0) {
    return (
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Rendimiento Portafolio vs IPSA</div>
        <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#6b7fa0' }}>
          <div style={{ fontSize: 32 }}>📈</div>
          <div style={{ fontSize: 13 }}>Agrega posiciones para ver el rendimiento</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Rendimiento Portafolio vs IPSA</div>
          <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 2 }}>Retorno normalizado desde inicio del período</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.label} onClick={() => setSelected(p)} style={{
              padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              background: selected.label === p.label ? 'rgba(0,230,118,0.15)' : 'transparent',
              color: selected.label === p.label ? '#00e676' : '#6b7fa0',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7fa0' }}>
          Calculando rendimiento...
        </div>
      ) : chartData.length >= 2 ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6b7fa0', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#1e2d45' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: '#6b7fa0', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v.toFixed(1)}%`}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#1e2d45" />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={v => <span style={{ color: v === 'Portafolio' ? '#00e676' : '#00c6ff' }}>{v}</span>}
            />
            <Line type="monotone" dataKey="Portafolio" stroke="#00e676" strokeWidth={2} dot={false} name="Portafolio" />
            <Line type="monotone" dataKey="IPSA" stroke="#00c6ff" strokeWidth={1.5} dot={false} name="IPSA" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7fa0' }}>
          Sin datos disponibles
        </div>
      )}
    </div>
  );
}
