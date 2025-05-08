import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add Authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('API request with token:', config.url);
    } else {
      console.warn('No token found for API request:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('API request interceptor error:', error);
    return Promise.reject(error);
  }
);

export default api;