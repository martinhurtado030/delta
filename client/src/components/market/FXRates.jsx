import React, { useEffect, useState } from 'react';
import { fetchCommodities } from '../../utils/api';
import { fmt } from '../../utils/formatters';

const FX_LABELS = {
  'USDCLP=X': { label: 'USD / CLP', flag: '🇺🇸', desc: 'Dólar Estadounidense' },
  'EURCLP=X': { label: 'EUR / CLP', flag: '🇪🇺', desc: 'Euro' },
  'GBPCLP=X': { label: 'GBP / CLP', flag: '🇬🇧', desc: 'Libra Esterlina' },
  'USDEUR=X': { label: 'USD / EUR', flag: '🌐', desc: 'Cruce Internacional' },
  'JPYCLP=X': { label: 'JPY / CLP', flag: '🇯🇵', desc: 'Yen Japonés' },
  'CNYCLP=X': { label: 'CNY / CLP', flag: '🇨🇳', desc: 'Yuan Chino' },
};

const COMMODITY_LABELS = {
  'CL=F':  { label: 'WTI Crudo',        flag: '🛢️',  desc: 'USD/Barril',      unit: 'USD/bbl' },
  'BZ=F':  { label: 'Brent Crudo',       flag: '🛢️',  desc: 'USD/Barril',      unit: 'USD/bbl' },
  'HG=F':  { label: 'Cobre',             flag: '🪨',  desc: 'CMX · USD/lb',    unit: 'USD/lb'  },
  'GC=F':  { label: 'Oro',               flag: '🥇',  desc: 'COMEX · USD/oz',  unit: 'USD/oz'  },
  'SI=F':  { label: 'Plata',             flag: '🥈',  desc: 'COMEX · USD/oz',  unit: 'USD/oz'  },
  'LIT':   { label: 'Litio (ETF LIT)',   flag: '⚡',  desc: 'Global X · USD',  unit: 'USD'     },
  'WOOD':  { label: 'Celulosa (ETF WOOD)',flag: '🌲',  desc: 'iShares · USD',   unit: 'USD'     },
};

function PriceCard({ label, flag, desc, unit, price, changePercent, change }) {
  const isUp = changePercent >= 0;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid #1e2d45',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#6b7fa0' }}>{desc}</div>
        </div>
        <span style={{ fontSize: 20 }}>{flag}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
        {price != null ? fmt.number(price, 2) : '—'}
        {unit && <span style={{ fontSize: 11, color: '#6b7fa0', fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
      {changePercent != null && (
        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4, color: isUp ? '#00e676' : '#ff4757' }}>
          {isUp ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
          {change != null && ` (${change >= 0 ? '+' : ''}${fmt.number(change, 2)})`}
        </div>
      )}
    </div>
  );
}

export default function FXRates({ fx }) {
  const [tab, setTab] = useState('fx');
  const [commodities, setCommodities] = useState([]);
  const [loadingC, setLoadingC] = useState(false);

  useEffect(() => {
    if (tab !== 'commodities') return;
    setLoadingC(true);
    fetchCommodities()
      .then(data => setCommodities(data))
      .catch(() => {})
      .finally(() => setLoadingC(false));
  }, [tab]);

  return (
    <div className="card">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['fx', '💱 Divisas'], ['commodities', '📦 Commodities']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13,
            background: tab === key ? 'rgba(0,198,255,0.15)' : 'rgba(255,255,255,0.04)',
            color: tab === key ? '#00c6ff' : '#6b7fa0',
            fontWeight: tab === key ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'fx' && (
        <>
          {(!fx || fx.length === 0) ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7fa0' }}>Cargando divisas...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {fx.map(item => {
                const info = FX_LABELS[item.symbol] || { label: item.symbol, flag: '📊', desc: '' };
                return (
                  <PriceCard
                    key={item.symbol}
                    label={info.label}
                    flag={info.flag}
                    desc={info.desc}
                    price={item.price}
                    changePercent={item.changePercent}
                    change={item.change}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'commodities' && (
        <>
          {loadingC ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7fa0' }}>Cargando commodities...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {commodities.map(item => {
                const info = COMMODITY_LABELS[item.symbol] || { label: item.symbol, flag: '📊', desc: '', unit: '' };
                return (
                  <PriceCard
                    key={item.symbol}
                    label={info.label}
                    flag={info.flag}
                    desc={info.desc}
                    unit={info.unit}
                    price={item.price}
                    changePercent={item.changePercent}
                    change={item.change}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
