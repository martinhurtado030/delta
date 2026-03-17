import { useState, useEffect, useCallback } from 'react';
import { fetchIPSA, fetchFX, fetchMacro } from '../utils/api';

export function useMarketData() {
  const [ipsa, setIpsa] = useState(null);
  const [fx, setFx] = useState([]);
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ipsaData, fxData, macroData] = await Promise.allSettled([
        fetchIPSA(),
        fetchFX(),
        fetchMacro(),
      ]);
      if (ipsaData.status === 'fulfilled') setIpsa(ipsaData.value);
      if (fxData.status === 'fulfilled') setFx(fxData.value);
      if (macroData.status === 'fulfilled') setMacro(macroData.value);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Market data error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 120000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { ipsa, fx, macro, loading, lastUpdated, refresh };
}
