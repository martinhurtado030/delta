import React, { useEffect, useState } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import axios from 'axios';

const SECTORS = ['Todos', 'Financials', 'Utilities', 'Materials', 'Energy', 'Consumer Discretionary', 'Consumer Staples', 'Industrials', 'Real Estate', 'Technology'];

function changeColor(pct) {
  if (pct == null) return '#1e2d45';
  if (pct >= 3)   return '#00a651';
  if (pct >= 1.5) return '#00c96b';
  if (pct >= 0.5) return '#00e676';
  if (pct >= 0)   return '#1a7a45';
  if (pct >= -0.5) return '#8b2020';
  if (pct >= -1.5) return '#cc2222';
  if (pct >= -3)   return '#e63030';
  return '#ff4757';
}

function textColor(pct) {
  if (pct == null) return '#6b7fa0';
  return Math.abs(pct) < 0.3 ? '#94a3b8' : '#fff';
}

const CustomContent = (props) => {
  const { x, y, width, height, depth, ticker, name, changePercent } = props;
  // Skip root node (depth=0) and nodes too small to render
  if (depth === 0 || x == null || y == null || !width || !height || width < 30 || height < 20) return null;
  const bg   = changeColor(changePercent);
  const fg   = textColor(changePercent);
  const pct  = changePercent != null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%` : '—';
  const showName  = height > 44 && width > 50;
  const showPrice = height > 60 && width > 60;

  return (
    <g>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} rx={4} fill={bg} />
      <text
        x={x + width / 2} y={y + height / 2 - (showName ? 8 : 0) - (showPrice ? 6 : 0)}
        textAnchor="middle" dominantBaseline="middle"
        fill={fg} fontSize={Math.min(14, Math.max(9, width / 6))} fontWeight={700}
        fontFamily="JetBrains Mono, monospace"
      >
        {ticker}
      </text>
      {showName && (
        <text
          x={x + width / 2} y={y + height / 2 + (showPrice ? 0 : 6)}
          textAnchor="middle" dominantBaseline="middle"
          fill={fg + 'cc'} fontSize={Math.min(10, Math.max(8, width / 9))}
        >
          {name.length > 14 ? name.slice(0, 13) + '…' : name}
        </text>
      )}
      {showPrice && (
        <text
          x={x + width / 2} y={y + height / 2 + 14}
          textAnchor="middle" dominantBaseline="middle"
          fill={fg + 'aa'} fontSize={Math.min(10, Math.max(8, width / 9))}
          fontFamily="JetBrains Mono, monospace"
        >
          {pct}
        </text>
      )}
      {!showPrice && (
        <text
          x={x + width / 2} y={y + height / 2 + (showName ? 14 : 8)}
          textAnchor="middle" dominantBaseline="middle"
          fill={fg + 'aa'} fontSize={Math.min(10, Math.max(8, width / 9))}
          fontFamily="JetBrains Mono, monospace"
        >
          {pct}
        </text>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8,
      padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
        {d.ticker} · {d.name}
      </div>
      <div style={{ color: '#6b7fa0', fontSize: 11, marginBottom: 6 }}>{d.sector}</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#6b7fa0' }}>Variación</div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
            color: d.changePercent >= 0 ? '#00e676' : '#ff4757',
          }}>
            {d.changePercent != null ? `${d.changePercent >= 0 ? '+' : ''}${d.changePercent.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6b7fa0' }}>Precio</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
            {d.price != null ? d.price.toLocaleString('es-CL') : '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6b7fa0' }}>Cap. Bursátil</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
            {d.marketCap != null ? `${(d.marketCap / 1e9).toFixed(0)}B` : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function MarketHeatmap() {
  const [raw, setRaw]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [sector, setSector]   = useState('Todos');

  useEffect(() => {
    axios.get('/api/heatmap').then(r => setRaw(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const data = (sector === 'Todos' ? raw : raw.filter(d => d.sector === sector))
    .map(d => ({ ...d, size: d.marketCap }));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Mapa de Calor — IPSA</div>
          <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 2 }}>Tamaño = Cap. bursátil · Color = Variación del día</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SECTORS.filter(s => s === 'Todos' || raw.some(d => d.sector === s)).map(s => (
            <button key={s} onClick={() => setSector(s)} style={{
              padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10,
              background: sector === s ? 'rgba(0,198,255,0.15)' : 'transparent',
              color: sector === s ? '#00c6ff' : '#6b7fa0',
              outline: sector === s ? '1px solid rgba(0,198,255,0.3)' : 'none',
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
        {[['≥+3%', '#00a651'], ['+1.5%', '#00c96b'], ['+0.5%', '#00e676'], ['~0%', '#1a7a45'], ['-0.5%', '#cc2222'], ['-1.5%', '#e63030'], ['≤-3%', '#ff4757']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 10, color: '#6b7fa0' }}>{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7fa0', fontSize: 13 }}>
          Cargando mapa...
        </div>
      ) : data.length === 0 ? (
        <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7fa0', fontSize: 13 }}>
          Sin datos disponibles
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={380}>
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            isAnimationActive={false}
            content={<CustomContent />}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      )}
    </div>
  );
}
