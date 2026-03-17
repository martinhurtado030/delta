import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { fmt } from '../../utils/formatters';

export default function EditTransactionModal({ transaction, onClose, onSave, onDelete }) {
  const [quantity, setQuantity] = useState(String(transaction.quantity));
  const [price,    setPrice]    = useState(String(transaction.price));
  const [date,     setDate]     = useState(transaction.date);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const total = parseFloat(quantity || 0) * parseFloat(price || 0);
  const isBuy = transaction.type === 'BUY';

  const handleSave = (e) => {
    e.preventDefault();
    if (!quantity || !price || !date) return;
    onSave(transaction.id, { quantity, price, date });
    onClose();
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(transaction.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Editar Transacción</h2>
            <div style={{ fontSize: 12, color: '#6b7fa0', marginTop: 3 }}>
              <span style={{
                padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginRight: 6,
                background: isBuy ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
                color: isBuy ? '#00e676' : '#ff4757',
              }}>{isBuy ? 'COMPRA' : 'VENTA'}</span>
              {transaction.ticker?.replace('.SN', '')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7fa0' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Cantidad (acciones)</label>
              <input
                type="number" min="1" step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Precio (CLP)</label>
              <input
                type="number" min="0" step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          {total > 0 && (
            <div style={{ background: 'rgba(0,198,255,0.06)', border: '1px solid rgba(0,198,255,0.15)', borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontSize: 12, color: '#6b7fa0' }}>Total operación: </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#00c6ff' }}>{fmt.currency(total)} CLP</span>
            </div>
          )}

          {isBuy && (
            <div style={{ fontSize: 12, color: '#6b7fa0', background: 'rgba(255,193,7,0.06)', border: '1px solid rgba(255,193,7,0.15)', borderRadius: 8, padding: '10px 14px' }}>
              Esta compra tiene una posición activa asociada — los cambios se aplicarán también a la posición.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleDelete}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
                background: confirmDelete ? 'rgba(255,71,87,0.2)' : 'rgba(255,71,87,0.08)',
                color: '#ff4757',
              }}
            >
              <Trash2 size={14} />
              {confirmDelete ? 'Confirmar eliminación' : 'Eliminar'}
            </button>
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Guardar cambios</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
