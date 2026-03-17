import React, { useEffect, useState } from 'react';
import { fetchIndices } from '../../utils/api';

const INDEX_META = {
  '^GSPC':    { name: 'S&P 500',        region: 'EE.UU.',      flag: '🇺🇸', color: '#3b82f6', group: 'americas' },
  '^IXIC':    { name: 'NASDAQ',         region: 'EE.UU.',      flag: '🇺🇸', color: '#a78bfa', group: 'americas' },
  '^DJI':     { name: 'Dow Jones',      region: 'EE.UU.',      flag: '🇺🇸', color: '#06b6d4', group: 'americas' },
  '^MERV':    { name: 'Merval',         region: 'Argentina',   flag: '🇦🇷', color: '#f59e0b', group: 'latam'    },
  '^BVSP':    { name: 'Bovespa',        region: 'Brasil',      flag: '🇧🇷', color: '#10b981', group: 'latam'    },
  '^FTSE':    { name: 'FTSE 100',       region: 'Reino Unido', flag: '🇬🇧', color: '#f59e0b', group: 'europe'   },
  '^GDAXI':   { name: 'DAX',            region: 'Alemania',    flag: '🇩🇪', color: '#10b981', group: 'europe'   },
  '^FCHI':    { name: 'CAC 40',         region: 'Francia',     flag: '🇫🇷', color: '#ec4899', group: 'europe'   },
  '^STOXX50E':{ name: 'Euro Stoxx 50',  region: 'Europa',      flag: '🇪🇺', color: '#f97316', group: 'europe'   },
  '^IBEX':    { name: 'IBEX 35',        region: 'España',      flag: '🇪🇸', color: '#ef4444', group: 'europe'   },
  '^N225':    { name: 'Nikkei 225',     region: 'Japón',       flag: '🇯🇵', color: '#00c6ff', group: 'asia'     },
  '^HSI':     { name: 'Hang Seng',      region: 'Hong Kong',   flag: '🇭🇰', color: '#e879f9', group: 'asia'     },
};

const GROUPS = [
  { key: 'all',      label: 'Todos'       },
  { key: 'americas', label: '🌎 Américas' },
  { key: 'latam',    label: '🌿 Latam'    },
  { key: 'europe',   label: '🌍 Europa'   },
  { key: 'asia',     label: '🌏 Asia'     },
];

export default function GlobalIndices() {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup]     = useState('all');

  useEffect(() => {
    fetchIndices()
      .then(data => { setIndices(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const visible = group === 'all'
    ? indices
    : indices.filter(item => INDEX_META[item.symbol]?.group === group);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Índices Bursátiles Globales</div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {GROUPS.map(g => (
          <button key={g.key} onClick={() => setGroup(g.key)} style={{
            padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
            background: group === g.key ? 'rgba(0,198,255,0.15)' : 'rgba(255,255,255,0.04)',
            color: group === g.key ? '#00c6ff' : '#6b7fa0',
            fontWeight: group === g.key ? 600 : 400,
          }}>{g.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#6b7fa0' }}>Cargando índices...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {visible.map(item => {
            const meta = INDEX_META[item.symbol] ?? { name: item.symbol, region: '', flag: '📊', color: '#6b7fa0', group: 'all' };
            const isUp = item.changePercent >= 0;
            return (
              <div key={item.symbol} style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${meta.color}33`,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{meta.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7fa0' }}>{meta.region}</div>
                  </div>
                  <span style={{ fontSize: 18 }}>{meta.flag}</span>
                </div>

                <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.price != null ? item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </div>

                {item.changePercent != null ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
                    padding: '3px 8px', borderRadius: 4,
                    background: isUp ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
                    color: isUp ? '#00e676' : '#ff4757',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {isUp ? '▲' : '▼'} {Math.abs(item.changePercent).toFixed(2)}%
                    {item.change != null && (
                      <span style={{ fontWeight: 400, opacity: 0.8 }}>
                        ({item.change >= 0 ? '+' : ''}{item.change.toFixed(2)})
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#4a5568', marginTop: 6 }}>Sin datos</div>
                )}

                {(item.high != null || item.low != null) && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    {item.high != null && (
                      <div style={{ fontSize: 10, color: '#6b7fa0' }}>
                        H: <span style={{ color: '#00e676' }}>{item.high.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {item.low != null && (
                      <div style={{ fontSize: 10, color: '#6b7fa0' }}>
                        L: <span style={{ color: '#ff4757' }}>{item.low.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
