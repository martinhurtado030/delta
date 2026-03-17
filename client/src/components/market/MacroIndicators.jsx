import React from 'react';
import { fmt } from '../../utils/formatters';

function MacroCard({ label, value, unit, date, available, desc }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid #1e2d45',
      borderRadius: 10,
      padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{label}</div>
      {available ? (
        <>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
            {typeof value === 'number' ? value.toFixed(2) : value}
            <span style={{ fontSize: 14, color: '#6b7fa0', fontWeight: 400, marginLeft: 4 }}>{unit}</span>
          </div>
          {desc && <div style={{ fontSize: 11, color: '#6b7fa0', marginTop: 4 }}>{desc}</div>}
          {date && (
            <div style={{ fontSize: 11, color: '#4a5568', marginTop: 6 }}>
              Fuente: Banco Central de Chile — {new Date(date).toLocaleDateString('es-CL')}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: '#4a5568', fontStyle: 'italic' }}>No disponible en este momento</div>
      )}
    </div>
  );
}

export default function MacroIndicators({ macro }) {
  return (
    <div className="card">
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Indicadores Macroeconómicos Chile</div>
      <div style={{ fontSize: 11, color: '#6b7fa0', marginBottom: 16 }}>Fuente: Banco Central de Chile (BCCh) · mindicador.cl</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <MacroCard
          label="Tasa de Política Monetaria (TPM)"
          value={macro?.tpm?.available ? macro.tpm.value : null}
          unit="%"
          date={macro?.tpm?.date}
          available={macro?.tpm?.available}
          desc="Tasa de referencia BCCh"
        />
        <MacroCard
          label="UF (Unidad de Fomento)"
          value={macro?.uf?.available ? macro.uf.value : null}
          unit="CLP"
          date={macro?.uf?.date}
          available={macro?.uf?.available}
          desc="Valor diario UF"
        />
        <MacroCard
          label="IPC (Inflación Mensual)"
          value={macro?.ipc?.available ? macro.ipc.value : null}
          unit="%"
          date={macro?.ipc?.date}
          available={macro?.ipc?.available}
          desc="Índice de Precios al Consumidor"
        />
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid #1e2d45',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, color: '#6b7fa0', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Renta Fija Soberana</div>
          <div style={{ fontSize: 13, color: '#4a5568', fontStyle: 'italic' }}>
            Bonos del Banco Central de Chile (BCP/BCU) — datos disponibles en <a href="https://www.bcentral.cl" target="_blank" rel="noopener noreferrer" style={{ color: '#00c6ff' }}>bcentral.cl</a>
          </div>
        </div>
      </div>
      {!macro && (
        <div style={{ textAlign: 'center', padding: 24, color: '#6b7fa0', fontSize: 13 }}>
          Cargando indicadores...
        </div>
      )}
    </div>
  );
}
