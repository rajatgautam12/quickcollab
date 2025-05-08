import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import styles from './Dashboard.module.css';

function Dashboard() {
  const [boards, setBoards] = useState([]);
  const [title, setTitle] = useState('');
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome, {user?.name || 'User'}!</h1>
        <button onClick={logout} className={styles.logoutButton}>Logout</button>
      </div>
      <form onSubmit={handleCreateBoard} className={styles.form}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New Board Title"
          className={styles.input}
          required
        />
        <button type="submit" className={styles.button}>Create Board</button>
      </form>
      <div className={styles.boardGrid}>
        {boards.map((board) => (
          <div
            key={board._id}
            onClick={() => navigate(`/board/${board._id}`)}
            className={styles.boardCard}
          >
            <h2 className={styles.boardTitle}>{board.title}</h2>
            <p className={styles.boardRole}>
              {board.owner === user.id ? 'Owner' : 'Collaborator'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;