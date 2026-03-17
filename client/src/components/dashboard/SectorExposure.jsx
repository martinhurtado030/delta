import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SECTOR_COLORS } from '../../data/ipsaConstituents';
import { fmt } from '../../utils/formatters';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{payload[0].payload.sector}</div>
      <div style={{ fontSize: 13, color: '#00c6ff' }}>{payload[0].value.toFixed(1)}% del NAV</div>
      <div style={{ fontSize: 12, color: '#6b7fa0' }}>{fmt.compact(payload[0].payload.value)} CLP</div>
    </div>
  );
};

export default function SectorExposure({ sectorAllocation }) {
  if (!sectorAllocation?.length) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <span style={{ color: '#6b7fa0', fontSize: 13 }}>Sin datos de sector</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Exposición Sectorial</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={sectorAllocation} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#6b7fa0', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
          <YAxis type="category" dataKey="sector" tick={{ fill: '#e2e8f0', fontSize: 11 }} tickLine={false} axisLine={false} width={140} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {sectorAllocation.map((entry, i) => (
              <Cell key={i} fill={SECTOR_COLORS[entry.sector] || '#00c6ff'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
