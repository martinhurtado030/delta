import React from 'react';
import { fmt, colorClass } from '../../utils/formatters';

function Card({ label, value, sub, subColor, badge }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.2 }}>{value}</div>
      {sub != null && (
        <div style={{ fontSize: 12, color: subColor || '#6b7fa0', marginTop: 4, fontWeight: 500 }}>{sub}</div>
      )}
      {badge && (
        <div style={{
          display: 'inline-block', marginTop: 6, padding: '2px 8px',
          background: 'rgba(0,198,255,0.1)', border: '1px solid rgba(0,198,255,0.2)',
          borderRadius: 20, fontSize: 11, color: '#00c6ff',
        }}>{badge}</div>
      )}
    </div>
  );
}

export default function SummaryCards({ metrics }) {
  if (!metrics) return null;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
      <Card
        label="NAV Total"
        value={fmt.compact(metrics.totalNav) + ' CLP'}
        sub={`${fmt.number(metrics.equityPct, 1)}% Renta Variable · ${fmt.number(metrics.cashPct, 1)}% Efectivo`}
      />
      <Card
        label="Valor en Acciones"
        value={fmt.compact(metrics.equityValue) + ' CLP'}
        sub={`${metrics.positionCount} posición${metrics.positionCount !== 1 ? 'es' : ''}`}
        badge={`${metrics.equityPct.toFixed(1)}% del portafolio`}
      />
      <Card
        label="Reserva de Efectivo"
        value={fmt.compact(metrics.portfolio?.cashReserve ?? 0) + ' CLP'}
        sub={`${metrics.cashPct.toFixed(1)}% del NAV`}
      />
      <Card
        label="P&L No Realizado"
        value={fmt.compact(metrics.totalUnrealizedPnL) + ' CLP'}
        sub={fmt.percent(metrics.totalUnrealizedPnLPct)}
        subColor={metrics.totalUnrealizedPnL >= 0 ? '#00e676' : '#ff4757'}
      />
      <Card
        label="P&L Diario"
        value={metrics.dailyPnL != null ? fmt.compact(metrics.dailyPnL) + ' CLP' : '—'}
        sub={metrics.dailyPnLPct != null ? fmt.percent(metrics.dailyPnLPct) : null}
        subColor={metrics.dailyPnL != null ? (metrics.dailyPnL >= 0 ? '#00e676' : '#ff4757') : '#6b7fa0'}
      />
      <Card
        label="Dividendos Cobrados"
        value={fmt.compact(metrics.totalDividends) + ' CLP'}
        sub="Ingresos acumulados"
      />
      <Card
        label="Top 5 Concentración"
        value={`${metrics.top5Pct.toFixed(1)}%`}
        sub="Peso de las 5 mayores posiciones"
        subColor={metrics.top5Pct > 80 ? '#ff4757' : metrics.top5Pct > 60 ? '#ffd700' : '#00e676'}
      />
    </div>
  );
}
