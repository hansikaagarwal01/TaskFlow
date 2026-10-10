import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken, getAccessToken, refreshAccessToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Demo users list for fast switching
  const demoUsers = [
    { id: 'u-mgr-1', name: 'Sarah Jenkins', role: 'MANAGER', title: 'Chief Operations Manager', teamName: 'All Teams' },
    { id: 'u-ldr-eng', name: 'Alex Rivera', role: 'LEADER', title: 'Engineering Team Lead', teamName: 'Engineering Department' },
    { id: 'u-ldr-prod', name: 'Maya Lin', role: 'LEADER', title: 'Head of Product & Design', teamName: 'Product & Design Ops' },
    { id: 'u-emp-eng1', name: 'David Kim', role: 'EMPLOYEE', title: 'Full Stack Engineer', teamName: 'Engineering Department' },
    { id: 'u-emp-eng2', name: 'Elena Rostova', role: 'EMPLOYEE', title: 'Backend Systems Engineer', teamName: 'Engineering Department' },
    { id: 'u-emp-prod1', name: 'Marcus Vance', role: 'EMPLOYEE', title: 'Senior UI/UX Specialist', teamName: 'Product & Design Ops' }
  ];

  const initAuth = async () => {
    setLoading(true);
    try {
      // Attempt to refresh session using HttpOnly refresh cookie
      const refreshResult = await refreshAccessToken();
      if (refreshResult && refreshResult.user) {
        setUser(refreshResult.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const data = await api.post('/auth/register', { name, email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  const demoLogin = async (userId) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/demo-login', { userId });
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore logout request errors
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token: getAccessToken(), loading, login, register, demoLogin, logout, demoUsers, refetchUser: initAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
