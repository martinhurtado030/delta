import React, { useState } from 'react';
import { fmt, colorClass } from '../../utils/formatters';
import { Trash2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

export default function PortfolioTable({ positions, loading, onRemove, lastUpdated }) {
  const [sortBy, setSortBy] = useState('currentValue');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sorted = [...positions].sort((a, b) => {
    const av = a[sortBy] ?? -Infinity;
    const bv = b[sortBy] ?? -Infinity;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const SortBtn = ({ col, label }) => (
    <button onClick={() => handleSort(col)} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: sortBy === col ? '#00c6ff' : '#6b7fa0',
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.08, padding: 0,
      display: 'flex', alignItems: 'center', gap: 3,
    }}>
      {label}
      {sortBy === col && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );

  if (positions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>Δ</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>Portafolio vacío</div>
        <div style={{ fontSize: 13, color: '#6b7fa0' }}>Agrega tu primera posición para comenzar.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2d45', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>Posiciones Abiertas</div>
        <div style={{ fontSize: 11, color: '#6b7fa0' }}>
          {loading ? 'Actualizando...' : lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : ''}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th><SortBtn col="quantity" label="Cant." /></th>
              <th><SortBtn col="buyPrice" label="P. Compra" /></th>
              <th><SortBtn col="currentPrice" label="P. Actual" /></th>
              <th><SortBtn col="currentValue" label="Valor Actual" /></th>
              <th><SortBtn col="costBasis" label="Costo Base" /></th>
              <th><SortBtn col="unrealizedPnL" label="P&L CLP" /></th>
              <th><SortBtn col="unrealizedPnLPct" label="P&L %" /></th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(pos => (
              <tr key={pos.id}>
                <td>
                  <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>
                    {pos.ticker.replace('.SN', '')}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 2 }}>{pos.name}</div>
                  <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 1 }}>{pos.sector}</div>
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {fmt.number(pos.quantity, 0)}
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {fmt.currency(pos.buyPrice)}
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {pos.currentPrice != null ? (
                    <div>
                      <div>{fmt.currency(pos.currentPrice)}</div>
                      {pos.quote?.regularMarketChangePercent != null && (
                        <div style={{ fontSize: 11, color: pos.quote.regularMarketChangePercent >= 0 ? '#00e676' : '#ff4757' }}>
                          {fmt.percent(pos.quote.regularMarketChangePercent)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#ff4757', fontSize: 11 }}>No disponible</span>
                  )}
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {pos.currentValue != null ? fmt.compact(pos.currentValue) : '—'}
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#6b7fa0' }}>
                  {fmt.compact(pos.costBasis)}
                </td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                  {pos.unrealizedPnL != null ? (
                    <span className={pos.unrealizedPnL >= 0 ? 'positive' : 'negative'}>
                      {pos.unrealizedPnL >= 0 ? '+' : ''}{fmt.compact(pos.unrealizedPnL)}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  {pos.unrealizedPnLPct != null ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 4,
                      background: pos.unrealizedPnLPct >= 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
                      color: pos.unrealizedPnLPct >= 0 ? '#00e676' : '#ff4757',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      {pos.unrealizedPnLPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {fmt.percent(pos.unrealizedPnLPct)}
                    </div>
                  ) : '—'}
                </td>
                <td>
                  <button
                    className="btn btn-danger"
                    onClick={() => onRemove(pos)}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    <Trash2 size={12} /> Vender
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
