import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState('');
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const res = await axios.get(`${API_URL}/boards`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setBoards(res.data);
      } catch (err) {
        console.error('Error fetching boards:', err);
      }
    };
    if (user) fetchBoards();
  }, [user]);

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${API_URL}/boards`,
        { title },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setBoards([...boards, res.data]);
      setTitle('');
    } catch (err) {
      console.error('Error creating board:', err);
    }
  };

  return (
    <div className="container">
      <div className="flex-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button onClick={logout} className="button button-red">
          Logout
        </button>
      </div>
      <form onSubmit={handleCreateBoard} className="mb-6">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New Board Title"
          className="form-group mr-2"
          required
        />
        <button type="submit" className="button button-blue">
          Create Board
        </button>
      </form>
      <div className="grid grid-md-3">
        {boards.map((board) => (
          <div
            key={board._id}
            onClick={() => navigate(`/board/${board._id}`)}
            className="board-card"
          >
            <h2 className="text-xl font-semibold">{board.title}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;