import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import Header from './components/layout/Header';
import SummaryCards from './components/portfolio/SummaryCards';
import PortfolioTable from './components/portfolio/PortfolioTable';
import AllocationChart from './components/portfolio/AllocationChart';
import AddPositionModal from './components/portfolio/AddPositionModal';
import EditTransactionModal from './components/portfolio/EditTransactionModal';
import SellPositionModal from './components/portfolio/SellPositionModal';
import PerformanceChart from './components/dashboard/PerformanceChart';
import PortfolioChart from './components/dashboard/PortfolioChart';
import TopPerformers from './components/dashboard/TopPerformers';
import MarketOverview from './components/market/MarketOverview';
import MarketHeatmap from './components/market/MarketHeatmap';
import GlobalIndices from './components/market/GlobalIndices';
import FXRates from './components/market/FXRates';
import MacroIndicators from './components/market/MacroIndicators';
import NewsFeed from './components/market/NewsFeed';
import Simulator from './components/simulator/Simulator';
import { usePortfolio } from './hooks/usePortfolio';
import { useMarketData } from './hooks/useMarketData';
import StockDetailView from './components/analysis/StockDetailView';
import { Plus, Pencil } from 'lucide-react';

export default function App() {
  const { isAuthenticated, logout } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return <AppContent logout={logout} />;
}

function AppContent({ logout }) {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [sellingPos, setSellingPos] = useState(null);
  const [historialOpen, setHistorialOpen] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);

  const handleSelectStock = useCallback((stock) => setSelectedStock(stock), []);

  const {
    portfolio, metrics, loading, lastUpdated,
    portfolioList, activePortfolioId,
    createPortfolio, switchPortfolio, renamePortfolio, deletePortfolio,
    addPosition, sellPosition, editTransaction, deleteTransaction, updateCash, addDividend,
  } = usePortfolio();
  const { ipsa, fx, macro, loading: marketLoading } = useMarketData();

  // Group open positions by ticker, computing weighted average buy price
  const groupedPositions = useMemo(() => {
    const map = {};
    metrics.positions.forEach(pos => {
      if (!map[pos.ticker]) {
        map[pos.ticker] = { ...pos, id: pos.ticker, totalCost: pos.costBasis };
      } else {
        const g = map[pos.ticker];
        g.quantity += pos.quantity;
        g.totalCost += pos.costBasis;
        g.currentValue = pos.currentValue != null ? (g.currentValue ?? 0) + pos.currentValue : g.currentValue;
      }
    });
    return Object.values(map).map(g => ({
      ...g,
      buyPrice: g.quantity > 0 ? g.totalCost / g.quantity : 0,
      costBasis: g.totalCost,
      unrealizedPnL: g.currentValue != null ? g.currentValue - g.totalCost : null,
      unrealizedPnLPct: g.totalCost > 0 && g.currentValue != null ? ((g.currentValue - g.totalCost) / g.totalCost) * 100 : null,
    }));
  }, [metrics.positions]);

  const handleAdd = ({ type, ...data }) => {
    if (type === 'position') addPosition(data);
    else if (type === 'cash') updateCash(data.amount);
    else if (type === 'dividend') addDividend(data);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        metrics={metrics}
        lastUpdated={lastUpdated}
        portfolioList={portfolioList}
        activePortfolioId={activePortfolioId}
        onSwitchPortfolio={switchPortfolio}
        onCreatePortfolio={createPortfolio}
        onRenamePortfolio={renamePortfolio}
        onDeletePortfolio={deletePortfolio}
        onLogout={logout}
      />

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px' }}>
        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>
              {activeTab === 'Dashboard' && 'Panel Principal'}
              {activeTab === 'Portfolio' && 'Mi Portafolio'}
              {activeTab === 'Mercado' && 'Monitor de Mercado'}
              {activeTab === 'Noticias' && 'Noticias del Mercado'}
              {activeTab === 'Simulador' && 'Simulador de Inversiones'}
            </h1>
            <p style={{ fontSize: 13, color: '#6b7fa0', marginTop: 2 }}>
              Mercado de Valores de Santiago · IPSA · Solo empresas chilenas
            </p>
          </div>
          {activeTab !== 'Simulador' && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Nueva Entrada
            </button>
          )}
        </div>

        {/* Dashboard */}
        {activeTab === 'Dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SummaryCards metrics={{ ...metrics, portfolio }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <PortfolioChart positions={groupedPositions} />
              <PerformanceChart />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <AllocationChart metrics={{ ...metrics, portfolio }} />
              <TopPerformers />
            </div>
          </div>
        )}

        {/* Portfolio */}
        {activeTab === 'Portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SummaryCards metrics={{ ...metrics, portfolio }} />
            <PortfolioTable
              positions={groupedPositions}
              loading={loading}
              onRemove={pos => setSellingPos(pos)}
              lastUpdated={lastUpdated}
            />
            <AllocationChart metrics={{ ...metrics, portfolio }} />

            {/* Transaction History */}
            {portfolio.transactions.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setHistorialOpen(o => !o)}
                  style={{ padding: '16px 20px', borderBottom: historialOpen ? '1px solid #1e2d45' : 'none', fontSize: 14, fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                >
                  Historial de Transacciones
                  <span style={{ marginLeft: 'auto', color: '#6b7fa0', fontSize: 16, lineHeight: 1 }}>{historialOpen ? '▲' : '▼'}</span>
                </div>
                {historialOpen && (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Ticker</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>Precio</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>P&L Realizado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...portfolio.transactions].reverse().map(t => (
                          <tr key={t.id}>
                            <td style={{ color: '#6b7fa0', fontSize: 12 }}>{t.date}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                background: t.type === 'BUY' ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
                                color: t.type === 'BUY' ? '#00e676' : '#ff4757',
                              }}>{t.type === 'BUY' ? 'COMPRA' : 'VENTA'}</span>
                            </td>
                            <td style={{ fontWeight: 600, color: '#e2e8f0' }}>{t.ticker?.replace('.SN', '')}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{t.quantity?.toLocaleString('es-CL')}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#6b7fa0' }}>
                              {t.price?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                              {t.total?.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                              {t.realizedPnL != null ? (
                                <span style={{ color: t.realizedPnL >= 0 ? '#00e676' : '#ff4757' }}>
                                  {t.realizedPnL >= 0 ? '+' : ''}{t.realizedPnL.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                </span>
                              ) : '—'}
                            </td>
                            <td>
                              <button onClick={() => setEditingTx(t)} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#6b7fa0', padding: '4px',
                                borderRadius: 4, display: 'flex', alignItems: 'center',
                              }} title="Editar">
                                <Pencil size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Market Monitor */}
        {activeTab === 'Mercado' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <MarketOverview ipsa={ipsa} onSelectStock={handleSelectStock} />
            <MarketHeatmap />
            <GlobalIndices />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <FXRates fx={fx} />
              <MacroIndicators macro={macro} />
            </div>
          </div>
        )}

        {/* Noticias */}
        {activeTab === 'Noticias' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <NewsFeed />
          </div>
        )}

        {/* Simulador */}
        {activeTab === 'Simulador' && <Simulator />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1e2d45', padding: '16px 24px', textAlign: 'center', marginTop: 40 }}>
        <p style={{ fontSize: 11, color: '#4a5568' }}>
          DELTA · Bolsa de Santiago · IPSA · Datos con posible retraso · No constituye asesoría financiera
        </p>
        <p style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>
          Fuentes: Yahoo Finance (.SN), Banco Central de Chile, mindicador.cl
        </p>
      </footer>

      {showModal && (
        <AddPositionModal
          onClose={() => setShowModal(false)}
          onAdd={handleAdd}
        />
      )}

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={editTransaction}
          onDelete={deleteTransaction}
        />
      )}

      {sellingPos && (
        <SellPositionModal
          position={sellingPos}
          onClose={() => setSellingPos(null)}
          onSell={sellPosition}
        />
      )}

      {selectedStock && (
        <StockDetailView
          symbol={selectedStock.symbol}
          name={selectedStock.name}
          quote={selectedStock.quote}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
