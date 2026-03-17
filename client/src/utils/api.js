import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({ baseURL: BASE_URL + '/api', timeout: 15000 });

export const fetchQuotes = (symbols) =>
  api.get(`/quotes${symbols ? `?symbols=${symbols.join(',')}` : ''}`).then(r => r.data);

export const fetchQuote = (symbol) =>
  api.get(`/quote/${symbol}`).then(r => r.data);

export const fetchHistory = (symbol, period = '1y', interval = '1d') =>
  api.get(`/history/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`).then(r => r.data);

export const fetchIPSA = () =>
  api.get('/ipsa').then(r => r.data);

export const fetchFX = () =>
  api.get('/fx').then(r => r.data);

export const fetchMacro = () =>
  api.get('/macro').then(r => r.data);

export const fetchSectors = () =>
  api.get('/sectors').then(r => r.data);

export const fetchIndices = () =>
  api.get('/indices').then(r => r.data);

export const fetchCommodities = () =>
  api.get('/commodities').then(r => r.data);

export const fetchFundamentals = (symbol) =>
  api.get(`/fundamentals/${encodeURIComponent(symbol)}`).then(r => r.data);

export const fetchTopPerformers = () =>
  api.get('/top-performers').then(r => r.data);

export const fetchSimulate = (symbol, startDate) =>
  api.get(`/simulate?symbol=${encodeURIComponent(symbol)}&startDate=${startDate}`).then(r => r.data);
