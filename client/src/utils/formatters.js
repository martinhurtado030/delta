export const fmt = {
  currency: (val, decimals = 0) => {
    if (val == null || isNaN(val)) return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  },

  number: (val, decimals = 2) => {
    if (val == null || isNaN(val)) return '—';
    return new Intl.NumberFormat('es-CL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(val);
  },

  percent: (val, decimals = 2) => {
    if (val == null || isNaN(val)) return '—';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(decimals)}%`;
  },

  // Exact price — shows decimals only when present (up to 4 places)
  price: (val) => {
    if (val == null || isNaN(val)) return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(val);
  },

  compact: (val) => {
    if (val == null || isNaN(val)) return '—';
    if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (Math.abs(val) >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return val.toFixed(0);
  },

  date: (val) => {
    if (!val) return '—';
    const d = typeof val === 'string' ? new Date(val) : new Date(val * 1000);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  time: (val) => {
    if (!val) return '—';
    const d = typeof val === 'string' ? new Date(val) : new Date(val * 1000);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  },
};

export const colorClass = (val) => {
  if (val == null) return '';
  return val >= 0 ? 'positive' : 'negative';
};
