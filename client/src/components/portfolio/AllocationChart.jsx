import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { SECTOR_COLORS } from '../../data/ipsaConstituents';
import { fmt } from '../../utils/formatters';

const COLORS = ['#00c6ff', '#00e676', '#ffd700', '#ff4757', '#8b5cf6', '#f97316', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{d.name}</div>
      <div style={{ fontSize: 13, color: '#00c6ff' }}>{fmt.compact(d.value)} CLP</div>
      <div style={{ fontSize: 12, color: '#6b7fa0' }}>{d.payload.pct.toFixed(1)}% del NAV</div>
    </div>
  );
};

const TABS = [
  { key: 'nav',    label: 'Nivel de Inversión' },
  { key: 'sector', label: 'Por Sector' },
];

export default function AllocationChart({ metrics }) {
  const [tab, setTab] = useState('nav');

  if (!metrics) return null;

  const navData = [
    { name: 'Renta Variable', value: metrics.equityValue,                  pct: metrics.equityPct },
    { name: 'Efectivo',       value: metrics.portfolio?.cashReserve ?? 0,  pct: metrics.cashPct },
  ].filter(d => d.value > 0);

  const sectorData = metrics.sectorAllocation ?? [];

  const isEmpty = tab === 'nav' ? navData.length === 0 : sectorData.length === 0;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Tab header */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: tab === t.key ? 'rgba(0,198,255,0.15)' : 'transparent',
              color: tab === t.key ? '#00c6ff' : '#6b7fa0',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#6b7fa0', fontSize: 13 }}>
          Sin posiciones para mostrar
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              {tab === 'nav' ? (
                <Pie data={navData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                  {navData.map((_, i) => <Cell key={i} fill={i === 0 ? '#00c6ff' : '#1e2d45'} />)}
                </Pie>
              ) : (
                <Pie data={sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value" nameKey="sector">
                  {sectorData.map((entry, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[entry.sector] || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              )}
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 16px', marginTop: 12 }}>
            {(tab === 'nav' ? navData : sectorData).map((d, i) => {
              const label = tab === 'nav' ? d.name : d.sector;
              const color = tab === 'nav'
                ? (i === 0 ? '#00c6ff' : '#1e2d45')
                : (SECTOR_COLORS[d.sector] || COLORS[i % COLORS.length]);
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color, border: '1px solid #1e2d45', flexShrink: 0 }} />
                  <span style={{ color: '#6b7fa0' }}>{label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{d.pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
