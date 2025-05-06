import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import styles from './BoardView.module.css';

function BoardView({ socket }) {
  const { boardId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get(`${API_URL}/tasks?boardId=${boardId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setTasks(res.data);
      } catch (err) {
        setError('Failed to fetch tasks');
        console.error('Fetch tasks error:', err);
      }
    };
    fetchTasks();

    socket.emit('joinBoard', boardId);
    console.log('Emitted joinBoard:', boardId);

    socket.on('taskUpdated', (updatedTask) => {
      console.log('Received taskUpdated:', updatedTask);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task._id === updatedTask._id ? updatedTask : task
        )
      );
    });

    socket.on('connect_error', (err) => {
      console.error('BoardView Socket.IO error:', err.message);
      setError('Real-time updates unavailable');
    });

    return () => {
      socket.emit('leaveBoard', boardId);
      socket.off('taskUpdated');
      socket.off('connect_error');
      console.log('Emitted leaveBoard:', boardId);
    };
  }, [boardId, socket]);

  const handleStatusChange = (taskId, newStatus) => {
    socket.emit('updateTask', { _id: taskId, status: newStatus, board: boardId });
    console.log('Emitted updateTask:', { _id: taskId, status: newStatus, board: boardId });
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Board View</h1>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.taskList}>
        {tasks.map((task) => (
          <div key={task._id} className={styles.taskCard}>
            <h2 className={styles.taskTitle}>{task.title}</h2>
            <p>Status: {task.status}</p>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(task._id, e.target.value)}
              className={styles.statusSelect}
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BoardView;