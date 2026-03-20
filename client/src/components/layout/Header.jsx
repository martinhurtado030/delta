import React, { useState, useRef, useEffect } from 'react';
import { fmt } from '../../utils/formatters';
import { Plus, ChevronDown, Pencil, Trash2, Check } from 'lucide-react';

const NAV_TABS = ['Dashboard', 'Portfolio', 'Mercado', 'Noticias', 'Simulador'];

export default function Header({
  activeTab, onTabChange, metrics, lastUpdated,
  portfolioList, activePortfolioId,
  onSwitchPortfolio, onCreatePortfolio, onRenamePortfolio, onDeletePortfolio,
  onLogout,
}) {
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [creatingNew,  setCreatingNew]    = useState(false);
  const [newName,      setNewName]        = useState('');
  const [editingId,    setEditingId]      = useState(null);
  const [editName,     setEditName]       = useState('');
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeName = portfolioList?.find(p => p.id === activePortfolioId)?.name ?? 'Portafolio';

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreatePortfolio(newName.trim());
    setNewName('');
    setCreatingNew(false);
    setDropdownOpen(false);
  };

  const handleRename = (id) => {
    if (!editName.trim()) return;
    onRenamePortfolio(id, editName.trim());
    setEditingId(null);
  };

  return (
    <header style={{ background: '#0a0f1c', borderBottom: '1px solid #1e2d45', position: 'sticky', top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
        <div className="header-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#00c6ff', letterSpacing: -1 }}>Δ</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: 2 }}>DELTA</div>
              <div style={{ fontSize: 10, color: '#6b7fa0', letterSpacing: 1, marginTop: -2 }}>SSE · IPSA</div>
            </div>
          </div>

          {/* Nav + Portfolio selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <nav className="header-nav-scroll" style={{ display: 'flex', gap: 4 }}>
              {NAV_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => onTabChange(tab)}
                  style={{
                    padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                    background: activeTab === tab ? 'rgba(0,198,255,0.12)' : 'transparent',
                    color: activeTab === tab ? '#00c6ff' : '#6b7fa0',
                    borderBottom: activeTab === tab ? '2px solid #00c6ff' : '2px solid transparent',
                  }}
                >
                  {tab}
                </button>
              ))}
            </nav>

            {/* Portfolio dropdown */}
            <div ref={dropRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setDropdownOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(0,198,255,0.08)', border: '1px solid rgba(0,198,255,0.2)',
                  color: '#00c6ff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                {activeName}
                <ChevronDown size={13} />
              </button>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#0d1421', border: '1px solid #1e2d45', borderRadius: 10,
                  minWidth: 200, zIndex: 200, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ padding: '6px 10px 4px', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Mis Portafolios
                  </div>

                  {portfolioList?.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px',
                      background: p.id === activePortfolioId ? 'rgba(0,198,255,0.08)' : 'transparent',
                    }}>
                      {editingId === p.id ? (
                        <>
                          <input
                            autoFocus
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRename(p.id); if (e.key === 'Escape') setEditingId(null); }}
                            style={{
                              flex: 1, background: '#1e2d45', border: '1px solid #2d3f5a',
                              borderRadius: 4, color: '#e2e8f0', fontSize: 12, padding: '2px 6px',
                            }}
                          />
                          <button onClick={() => handleRename(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00e676', padding: 2 }}>
                            <Check size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { onSwitchPortfolio(p.id); setDropdownOpen(false); }}
                            style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: p.id === activePortfolioId ? '#00c6ff' : '#c9d6e3', fontSize: 13, fontWeight: p.id === activePortfolioId ? 600 : 400, padding: 0 }}
                          >
                            {p.name}
                          </button>
                          <button
                            onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 2 }}
                            title="Renombrar"
                          >
                            <Pencil size={11} />
                          </button>
                          {portfolioList.length > 1 && (
                            <button
                              onClick={() => { if (window.confirm(`¿Eliminar "${p.name}"?`)) { onDeletePortfolio(p.id); setDropdownOpen(false); } }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 2 }}
                              title="Eliminar"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid #1e2d45', padding: '6px 10px' }}>
                    {creatingNew ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          autoFocus
                          placeholder="Nombre..."
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreatingNew(false); }}
                          style={{
                            flex: 1, background: '#1e2d45', border: '1px solid #2d3f5a',
                            borderRadius: 4, color: '#e2e8f0', fontSize: 12, padding: '4px 8px',
                          }}
                        />
                        <button onClick={handleCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00e676', padding: 2 }}>
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCreatingNew(true)}
                        style={{
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                          color: '#6b7fa0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
                          padding: '2px 0',
                        }}
                      >
                        <Plus size={13} /> Nuevo portafolio
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="header-quickstats" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {metrics && (
              <>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.5 }}>NAV Total</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmt.compact(metrics.totalNav)} CLP
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.5 }}>P&L No Realizado</div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace',
                    color: metrics.totalUnrealizedPnL >= 0 ? '#00e676' : '#ff4757',
                  }}>
                    {fmt.percent(metrics.totalUnrealizedPnLPct)}
                  </div>
                </div>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-dot" />
              <span style={{ fontSize: 11, color: '#6b7fa0' }}>
                {lastUpdated ? lastUpdated.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'Conectando...'}
              </span>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                Salir
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
