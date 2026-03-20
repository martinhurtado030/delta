import React, { useEffect, useState } from 'react';
import { fetchNews } from '../../utils/api';

const SOURCES = ['Todas', 'IPSA · Bolsa', 'Economía Chile', 'Minería · Cobre', 'BBC Mundo Economía'];

const SOURCE_COLORS = {
  'IPSA · Bolsa':       '#00c6ff',
  'Economía Chile':     '#00e676',
  'Minería · Cobre':    '#ffd700',
  'BBC Mundo Economía': '#8b5cf6',
};

export default function NewsFeed() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filter, setFilter]     = useState('Todas');

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchNews()
      .then(data => { setItems(data); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'Todas' ? items : items.filter(i => i.source === filter);

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Noticias Financieras</div>
          <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 2 }}>Chile · Economía · Mercados</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SOURCES.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
                background: filter === s ? `${SOURCE_COLORS[s] ?? '#00c6ff'}22` : 'transparent',
                color: filter === s ? (SOURCE_COLORS[s] ?? '#00c6ff') : '#6b7fa0',
                outline: filter === s ? `1px solid ${SOURCE_COLORS[s] ?? '#00c6ff'}44` : 'none',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height: 64, borderRadius: 8, background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7fa0', fontSize: 13 }}>
          No se pudieron cargar las noticias. Intenta de nuevo más tarde.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7fa0', fontSize: 13 }}>
          Sin noticias disponibles para esta fuente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', gap: 12, padding: '12px 14px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2d45',
                  borderRadius: 8, transition: 'background 0.15s', cursor: 'pointer',
                  borderLeft: `3px solid ${item.color}`,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.4, marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: item.color, fontWeight: 500 }}>{item.source}</span>
                    {item.date && <span style={{ fontSize: 11, color: '#4a5568' }}>{item.date}</span>}
                  </div>
                </div>
                <div style={{ color: '#4a5568', fontSize: 16, alignSelf: 'center', flexShrink: 0 }}>→</div>
              </div>
            </a>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: '#4a5568', textAlign: 'center' }}>
        Fuentes: Google News Chile · BBC Mundo · Actualiza cada 15 min
      </div>
    </div>
  );
}
