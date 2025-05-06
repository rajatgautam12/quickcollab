import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import BoardView from './components/BoardView';
import Navbar from './components/Navbar';
import { AuthContext } from './context/AuthContext';
import io from 'socket.io-client';

const socket = io(process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com', {
  autoConnect: false,
});

function App() {
  const { user, setSocket } = useContext(AuthContext);

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
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/board/:boardId" element={user ? <BoardView socket={socket} /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;