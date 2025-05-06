import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);

  const API_URL = process.env.VITE_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('user'));
    if (token && userData) {
      try {
        const decoded = jwtDecode(token);
        console.log('Token decoded on load:', { payload: decoded });
        if (!decoded.id) {
          console.error('Token has no valid id:', { decoded });
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          return;
        }
        if (decoded.id !== userData.id) {
          console.error('Token user ID mismatch:', { tokenId: decoded.id, userId: userData.id });
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          return;
        }
        if (!/^[0-9a-fA-F]{24}$/.test(decoded.id)) {
          console.error('Token id is not a valid ObjectId:', { id: decoded.id });
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          return;
        }
        setUser({ ...userData, token });
        console.log('AuthContext loaded user:', { userId: userData.id });
      } catch (err) {
        console.error('Invalid token on load:', err.message);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const refreshToken = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token available');
      }
      const res = await axios.post(`${API_URL}/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { token: newToken, user: newUser } = res.data;
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      setUser({ ...newUser, token: newToken });
      console.log('Token refreshed:', { userId: newUser.id });
      return newToken;
    } catch (err) {
      console.error('Token refresh error:', err.response?.data || err.message);
      logout();
      throw err;
    }
  };

  const login = async (email, password) => {
    console.log('Login payload:', { email, password });
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser({ ...user, token });
    } catch (err) {
      console.error('Login error:', err.response?.data || err.message);
      throw err;
    }
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
      console.error('Registration error:', err.response?.data || err.message);
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
    console.log('User logged out');
  };

  // Intercept 401 errors and handle User not found
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && error.response?.data?.message === 'Token has expired') {
          try {
            await refreshToken();
            // Retry original request with new token
            const newToken = localStorage.getItem('token');
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return axios(error.config);
          } catch (refreshError) {
            return Promise.reject(refreshError);
          }
        } else if (error.response?.status === 401 && error.response?.data?.message === 'Token is not valid: User not found') {
          console.error('User not found, logging out');
          logout();
          return Promise.reject(new Error('Your account is no longer valid. Please log in again.'));
        } else if (error.response?.status === 401 && error.response?.data?.message === 'Token is not valid: Missing user ID') {
          console.error('Token missing user ID, logging out');
          logout();
          return Promise.reject(new Error('Invalid authentication token. Please log in again.'));
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, socket, setSocket, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};