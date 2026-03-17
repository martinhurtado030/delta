import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchHistory } from '../../utils/api';

const PERIODS = [
  { label: '1D', period: '1d',  interval: '5m'  },
  { label: '1S', period: '5d',  interval: '1h'  },
  { label: '1M', period: '1mo', interval: '1d'  },
  { label: '3M', period: '3mo', interval: '1d'  },
  { label: '6M', period: '6mo', interval: '1d'  },
  { label: '1A', period: '1y',  interval: '1d'  },
  { label: '2A', period: '2y',  interval: '1d'  },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>
            {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%
          </div>
          {entry?.close != null && (
            <div style={{ fontSize: 12, color: '#a0b0c8', marginTop: 1 }}>
              {entry.close.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default function PerformanceChart() {
  const [selected, setSelected] = useState(PERIODS[5]); // default 1A
  const [chartData, setChartData]   = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    setLoading(true);
    setChartData([]);
    fetchHistory('^IPSA', selected.period, selected.interval)
      .then(data => {
        if (!Array.isArray(data) || data.length < 2) return;
        const base = data[0]?.close;
        if (!base) return;
        setChartData(data.map(d => ({
          date:  d.date,
          close: d.close,
          IPSA:  d.close != null ? parseFloat(((d.close / base - 1) * 100).toFixed(2)) : null,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>IPSA — Rendimiento</div>
          <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 2 }}>Bolsa de Santiago · Retorno normalizado</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.label} onClick={() => setSelected(p)} style={{
              padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              background: selected.label === p.label ? 'rgba(0,198,255,0.15)' : 'transparent',
              color: selected.label === p.label ? '#00c6ff' : '#6b7fa0',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7fa0' }}>
          Cargando...
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
            <Line type="monotone" dataKey="IPSA" stroke="#00c6ff" strokeWidth={2} dot={false} name="IPSA" />
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
