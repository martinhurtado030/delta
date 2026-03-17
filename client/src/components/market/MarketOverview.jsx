import React, { useEffect, useState } from 'react';
import { fetchQuotes } from '../../utils/api';
import { IPSA_CONSTITUENTS, SECTOR_COLORS } from '../../data/ipsaConstituents';
import { fmt, colorClass } from '../../utils/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function MarketOverview({ ipsa, onSelectStock }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [constituentesOpen, setConstituentesOpen] = useState(true);

  useEffect(() => {
    fetchQuotes().then(data => {
      const enriched = data.map(q => {
        const info = IPSA_CONSTITUENTS.find(c => c.ticker === q.symbol);
        return { ...q, ...info };
      });
      setQuotes(enriched);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sectors = ['all', ...new Set(IPSA_CONSTITUENTS.map(c => c.sector))];

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.sector === filter);
  const sorted = [...filtered].sort((a, b) => (b.regularMarketChangePercent ?? 0) - (a.regularMarketChangePercent ?? 0));

  const ipsaChange = ipsa?.quote?.regularMarketChangePercent;
  const ipsaPrice = ipsa?.quote?.regularMarketPrice;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* IPSA Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #0d1421 0%, #0a1628 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7fa0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>IPSA — Bolsa de Santiago</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                {ipsaPrice != null ? fmt.number(ipsaPrice, 2) : '—'}
              </span>
              {ipsaChange != null && (
                <span style={{
                  fontSize: 18, fontWeight: 600,
                  color: ipsaChange >= 0 ? '#00e676' : '#ff4757',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {ipsaChange >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {fmt.percent(ipsaChange)}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7fa0', marginTop: 4 }}>
              {ipsa?.quote?.regularMarketTime ? `Última actualización: ${fmt.time(ipsa.quote.regularMarketTime)}` : 'Datos diferidos'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 2 }}>Apertura</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#e2e8f0' }}>{fmt.number(ipsa?.quote?.regularMarketOpen, 2) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 2 }}>Máx. Día</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#00e676' }}>{fmt.number(ipsa?.quote?.regularMarketDayHigh, 2) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 2 }}>Mín. Día</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#ff4757' }}>{fmt.number(ipsa?.quote?.regularMarketDayLow, 2) || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 2 }}>Volumen</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#e2e8f0' }}>{fmt.compact(ipsa?.quote?.regularMarketVolume) || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Constituents */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          onClick={() => setConstituentesOpen(o => !o)}
          style={{ padding: '16px 20px', borderBottom: constituentesOpen ? '1px solid #1e2d45' : 'none', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginRight: 8 }}>Constituyentes IPSA</span>
          <span style={{ marginLeft: 'auto', color: '#6b7fa0', fontSize: 16, lineHeight: 1 }}>{constituentesOpen ? '▲' : '▼'}</span>
        </div>
        {constituentesOpen && (
          <>
            <div style={{ padding: '8px 20px 12px', borderBottom: '1px solid #1e2d45', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
              onClick={e => e.stopPropagation()}>
              {sectors.map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{
                  padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: filter === s ? (SECTOR_COLORS[s] || '#00c6ff') : 'rgba(255,255,255,0.05)',
                  color: filter === s ? '#080c14' : '#6b7fa0',
                  fontWeight: filter === s ? 700 : 400,
                }}>{s === 'all' ? 'Todos' : s}</button>
              ))}
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7fa0' }}>Cargando cotizaciones...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Sector</th>
                      <th style={{ textAlign: 'right' }}>Precio</th>
                      <th style={{ textAlign: 'right' }}>Variación</th>
                      <th style={{ textAlign: 'right' }}>Var. %</th>
                      <th style={{ textAlign: 'right' }}>Volumen</th>
                      <th style={{ textAlign: 'right' }}>Cap. Bursátil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(q => (
                      <tr
                        key={q.symbol}
                        onClick={() => onSelectStock?.({ symbol: q.symbol, name: q.name || q.shortName, quote: q })}
                        style={{ cursor: onSelectStock ? 'pointer' : 'default' }}
                        title="Ver análisis técnico y fundamentales"
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{q.symbol?.replace('.SN', '')}</div>
                          <div style={{ fontSize: 11, color: '#6b7fa0' }}>{q.name || q.shortName}</div>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 4,
                            background: `${SECTOR_COLORS[q.sector]}22`,
                            color: SECTOR_COLORS[q.sector] || '#6b7fa0',
                            border: `1px solid ${SECTOR_COLORS[q.sector] || '#1e2d45'}44`,
                          }}>{q.sector}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#e2e8f0' }}>
                          {fmt.price(q.regularMarketPrice)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                          <span className={colorClass(q.regularMarketChange)}>
                            {q.regularMarketChange != null ? (q.regularMarketChange >= 0 ? '+' : '') + fmt.number(q.regularMarketChange, 2) : '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {q.regularMarketChangePercent != null ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 8px', borderRadius: 4,
                              background: q.regularMarketChangePercent >= 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,71,87,0.1)',
                              color: q.regularMarketChangePercent >= 0 ? '#00e676' : '#ff4757',
                              fontSize: 12, fontWeight: 600,
                            }}>
                              {q.regularMarketChangePercent >= 0 ? '▲' : '▼'}
                              {Math.abs(q.regularMarketChangePercent).toFixed(2)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7fa0' }}>
                          {fmt.compact(q.regularMarketVolume)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#6b7fa0' }}>
                          {fmt.compact(q.marketCap)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
