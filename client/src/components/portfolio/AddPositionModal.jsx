import React, { useState } from 'react';
import { IPSA_CONSTITUENTS } from '../../data/ipsaConstituents';
import { fmt } from '../../utils/formatters';
import { X } from 'lucide-react';

export default function AddPositionModal({ onClose, onAdd }) {
  const [mode, setMode] = useState('position'); // 'position' | 'cash' | 'dividend'
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashAmount, setCashAmount] = useState('');
  const [divTicker, setDivTicker] = useState('');
  const [divAmount, setDivAmount] = useState('');

  const selectedStock = IPSA_CONSTITUENTS.find(c => c.ticker === selected);
  const totalCost = quantity && buyPrice ? parseFloat(quantity) * parseFloat(buyPrice) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'position') {
      if (!selected || !quantity || !buyPrice) return;
      onAdd({ type: 'position', ticker: selected, name: selectedStock?.name, sector: selectedStock?.sector, quantity, buyPrice, buyDate });
    } else if (mode === 'cash') {
      if (!cashAmount) return;
      onAdd({ type: 'cash', amount: parseFloat(cashAmount) });
    } else if (mode === 'dividend') {
      if (!divTicker || !divAmount) return;
      onAdd({ type: 'dividend', ticker: divTicker, amount: divAmount });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Nueva Entrada</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7fa0' }}>
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #1e2d45', paddingBottom: 16 }}>
          {[['position', 'Compra de Acción'], ['cash', 'Efectivo'], ['dividend', 'Dividendo']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: mode === m ? 'rgba(0,198,255,0.15)' : 'transparent',
              color: mode === m ? '#00c6ff' : '#6b7fa0',
              fontWeight: mode === m ? 600 : 400,
            }}>{label}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'position' && (
            <>
              <div>
                <label>Empresa (IPSA)</label>
                <select value={selected} onChange={e => setSelected(e.target.value)} required>
                  <option value="">Seleccionar empresa...</option>
                  {IPSA_CONSTITUENTS.map(c => (
                    <option key={c.ticker} value={c.ticker}>{c.name} ({c.ticker.replace('.SN', '')})</option>
                  ))}
                </select>
              </div>
              {selectedStock && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, padding: '3px 8px', background: 'rgba(0,198,255,0.1)', border: '1px solid rgba(0,198,255,0.2)', borderRadius: 4, color: '#00c6ff' }}>
                    {selectedStock.sector}
                  </span>
                  <span style={{ fontSize: 12, padding: '3px 8px', background: 'rgba(107,127,160,0.1)', border: '1px solid #1e2d45', borderRadius: 4, color: '#6b7fa0' }}>
                    {selectedStock.industry}
                  </span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Cantidad (acciones)</label>
                  <input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="100" required />
                </div>
                <div>
                  <label>Precio de Compra (CLP)</label>
                  <input type="number" min="0" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} placeholder="1500.00" required />
                </div>
              </div>
              <div>
                <label>Fecha de Compra</label>
                <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} />
              </div>
              {totalCost > 0 && (
                <div style={{ background: 'rgba(0,198,255,0.06)', border: '1px solid rgba(0,198,255,0.15)', borderRadius: 8, padding: '10px 14px' }}>
                  <span style={{ fontSize: 12, color: '#6b7fa0' }}>Inversión total: </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#00c6ff' }}>{fmt.currency(totalCost)} CLP</span>
                </div>
              )}
            </>
          )}

          {mode === 'cash' && (
            <div>
              <label>Monto en Efectivo (CLP)</label>
              <input type="number" min="0" step="1" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="1.000.000" required />
              <p style={{ fontSize: 12, color: '#6b7fa0', marginTop: 6 }}>Este monto reemplazará el saldo de efectivo actual.</p>
            </div>
          )}

          {mode === 'dividend' && (
            <>
              <div>
                <label>Empresa</label>
                <select value={divTicker} onChange={e => setDivTicker(e.target.value)} required>
                  <option value="">Seleccionar empresa...</option>
                  {IPSA_CONSTITUENTS.map(c => (
                    <option key={c.ticker} value={c.ticker}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Dividendo Recibido (CLP)</label>
                <input type="number" min="0" step="0.01" value={divAmount} onChange={e => setDivAmount(e.target.value)} placeholder="50.000" required />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
              {mode === 'position' ? 'Agregar Posición' : mode === 'cash' ? 'Actualizar Efectivo' : 'Registrar Dividendo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
