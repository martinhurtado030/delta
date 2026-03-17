import React, { useState } from 'react';
import { X } from 'lucide-react';
import { fmt } from '../../utils/formatters';

export default function SellPositionModal({ position, onClose, onSell }) {
  const [quantity, setQuantity] = useState(String(position.quantity));
  const [price,    setPrice]    = useState(position.currentPrice != null ? String(position.currentPrice) : '');
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);

  const qty   = parseFloat(quantity) || 0;
  const px    = parseFloat(price)    || 0;
  const total = qty * px;
  const pnl   = qty * (px - position.buyPrice);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!quantity || !price || !date || qty <= 0 || qty > position.quantity) return;
    onSell({ ticker: position.ticker, quantity: qty, price: px, date, total, realizedPnL: pnl });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Vender Posición</h2>
            <div style={{ fontSize: 12, color: '#6b7fa0', marginTop: 3 }}>
              <span style={{ fontWeight: 700, color: '#e2e8f0' }}>{position.ticker.replace('.SN', '')}</span>
              {' · '}{position.name}
              {' · '}<span style={{ color: '#6b7fa0' }}>Disponible: {position.quantity.toLocaleString('es-CL')} acciones</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7fa0' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Cantidad a vender</label>
              <input
                type="number" min="1" max={position.quantity} step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
              {qty > position.quantity && (
                <div style={{ fontSize: 11, color: '#ff4757', marginTop: 4 }}>
                  Máximo {position.quantity.toLocaleString('es-CL')}
                </div>
              )}
            </div>
            <div>
              <label>Precio de venta (CLP)</label>
              <input
                type="number" min="0" step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label>Fecha de venta</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {total > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e2d45', borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7fa0' }}>Total operación</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{fmt.currency(total)} CLP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#6b7fa0' }}>P. compra promedio</span>
                <span style={{ fontSize: 12, color: '#6b7fa0' }}>{fmt.currency(position.buyPrice)} CLP</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1e2d45', paddingTop: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7fa0' }}>P&L Realizado</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? '#00e676' : '#ff4757' }}>
                  {pnl >= 0 ? '+' : ''}{fmt.currency(pnl)} CLP
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button
              type="submit"
              disabled={qty <= 0 || qty > position.quantity || px <= 0}
              style={{
                flex: 2, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                background: qty > 0 && qty <= position.quantity && px > 0 ? 'rgba(255,71,87,0.15)' : 'rgba(255,255,255,0.05)',
                color: qty > 0 && qty <= position.quantity && px > 0 ? '#ff4757' : '#4a5568',
              }}
            >
              Confirmar Venta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
