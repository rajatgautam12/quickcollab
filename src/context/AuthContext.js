import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);

  const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('user'));
    if (token && userData) {
      setUser({ ...userData, token });
    }
  }, []);

  const login = async (email, password) => {
    console.log('Login payload:', { email, password });
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    const { token, user } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser({ ...user, token });
  };

  const register = async (name, email, password) => {
    console.log('Register payload:', { name, email, password });
    try {
      const res = await axios.post(`${API_URL}/auth/register`, { name, email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser({ ...user, token });
    } catch (err) {
      console.error('Registration error:', err.response?.data);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, socket, setSocket }}>
      {children}
    </AuthContext.Provider>
  );
};