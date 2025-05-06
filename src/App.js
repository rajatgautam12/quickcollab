import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import BoardView from './components/BoardView';
import { AuthContext } from './context/AuthContext';
import io from 'socket.io-client';

const socket = io(process.env.VITE_API_URL || 'http://localhost:5000', {
  autoConnect: false,
});

function App() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('AuthContext is undefined. Ensure App is wrapped in AuthProvider.');
  }
  const { user, setSocket } = context;

  useEffect(() => {
    if (user) {
      socket.connect();
      setSocket(socket);
      return () => {
        socket.disconnect();
      };
    }
  }, [user, setSocket]);

  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/board/:boardId" element={user ? <BoardView socket={socket} /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;