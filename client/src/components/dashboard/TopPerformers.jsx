import { useState, useEffect } from 'react';
import { fetchTopPerformers } from '../../utils/api';
import { IPSA_CONSTITUENTS } from '../../data/ipsaConstituents';
import { fmt } from '../../utils/formatters';
import { TrendingUp } from 'lucide-react';

const PERIODS = [
  { key: 'day',   label: 'Día' },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mes' },
];

function nameFor(symbol) {
  return IPSA_CONSTITUENTS.find(c => c.ticker === symbol)?.name ?? symbol.replace('.SN', '');
}

export default function TopPerformers() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('day');

  useEffect(() => {
    fetchTopPerformers()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const list = data?.[period] ?? [];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={16} color="#00e676" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Top 5 IPSA</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '3px 10px',
                borderRadius: 6,
                border: 'none',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: period === p.key ? 'rgba(0,198,255,0.15)' : 'transparent',
                color: period === p.key ? '#00c6ff' : '#6b7fa0',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#6b7fa0', fontSize: 12, padding: '20px 0' }}>Cargando…</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7fa0', fontSize: 12, padding: '20px 0' }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((item, i) => (
            <div key={item.symbol} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Rank */}
              <span style={{
                width: 20, textAlign: 'center', fontSize: 11, fontWeight: 700,
                color: i === 0 ? '#ffd700' : '#6b7fa0', flexShrink: 0,
              }}>
                {i + 1}
              </span>
              {/* Ticker + name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.symbol.replace('.SN', '')}
                </div>
                <div style={{ fontSize: 10, color: '#6b7fa0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nameFor(item.symbol)}
                </div>
              </div>
              {/* Change badge */}
              <span style={{
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'JetBrains Mono, monospace',
                background: item.change >= 0 ? 'rgba(0,230,118,0.12)' : 'rgba(255,71,87,0.12)',
                color: item.change >= 0 ? '#00e676' : '#ff4757',
                flexShrink: 0,
              }}>
                {fmt.percent(item.change)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
