import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({ baseURL: BASE_URL + '/api', timeout: 60000 });

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('delta_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 &&
        !error.config.url.includes('/auth/')) {
      localStorage.removeItem('delta_token');
      localStorage.removeItem('delta_user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Separate instance for auth (no /api prefix)
const authApi = axios.create({ baseURL: BASE_URL, timeout: 60000 });

export const authLogin    = (email, password) =>
  authApi.post('/auth/login',    { email, password }).then(r => r.data);
export const authRegister = (email, password) =>
  authApi.post('/auth/register', { email, password }).then(r => r.data);

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

// Portfolio API (server-side, per-user)
export const portfolioGetAll  = () =>
  api.get('/portfolio').then(r => r.data);
export const portfolioSave    = (id, name, data) =>
  api.put(`/portfolio/${id}`, { name, data }).then(r => r.data);
export const portfolioCreate  = (id, name) =>
  api.post('/portfolio', { id, name }).then(r => r.data);
export const portfolioDelete  = (id) =>
  api.delete(`/portfolio/${id}`).then(r => r.data);
