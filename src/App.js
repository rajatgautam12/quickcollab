import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import BoardView from './components/BoardView';
import Navbar from './components/Navbar';
import { AuthContext } from './context/AuthContext';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';
console.log('Socket.IO connecting to:', API_URL);

const socket = io(API_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  withCredentials: true,
});

function App() {
  const { user, setSocket } = useContext(AuthContext);

  useEffect(() => {
    if (user) {
      console.log('User authenticated, connecting Socket.IO');
      socket.connect();

      socket.on('connect', () => {
        console.log('Socket.IO connected:', socket.id);
      });

      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message);
      });

      socket.on('error', (err) => {
        console.error('Socket.IO error:', err);
      });

      setSocket(socket);

      return () => {
        console.log('Disconnecting Socket.IO');
        socket.off('connect');
        socket.off('connect_error');
        socket.off('error');
        socket.disconnect();
      };
    }
  }, [user, setSocket]);

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/board/:boardId" element={<BoardView socket={socket} />} />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;