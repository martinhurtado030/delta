import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { authLogin, authRegister } from '../../utils/api.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [mode,     setMode]     = useState('login'); // 'login' | 'register'
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = mode === 'login' ? authLogin : authRegister;
      const { token, user } = await fn(email, password);
      login(token, user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error de conexión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 52, lineHeight: 1 }}>Δ</div>
        <div style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--accent)',
          marginTop: 8,
        }}>DELTA</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Portfolio Manager IPSA Chile
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '32px 28px',
        width: '100%',
        maxWidth: 380,
      }}>
        {/* Tab toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          padding: 3,
          marginBottom: 24,
        }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color:      mode === m ? '#000' : 'var(--text-secondary)',
              }}
            >
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Contraseña {mode === 'register' && <span style={{ color: 'var(--text-muted)' }}>(mín. 8 caracteres)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={mode === 'register' ? 8 : undefined}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,59,59,0.12)',
              border: '1px solid rgba(255,59,59,0.3)',
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--red)',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              background: loading ? 'var(--text-muted)' : 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              transition: 'opacity 0.2s',
            }}
          >
            {loading
              ? 'Cargando...'
              : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
