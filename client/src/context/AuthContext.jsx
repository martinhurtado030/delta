import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('delta_token'));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('delta_user')); } catch { return null; }
  });

  const login = (newToken, newUser) => {
    localStorage.setItem('delta_token', newToken);
    localStorage.setItem('delta_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('delta_token');
    localStorage.removeItem('delta_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
