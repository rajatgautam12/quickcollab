import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import styles from './BoardView.module.css';

function BoardView({ socket }) {
  const { boardId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const statuses = ['To Do', 'In Progress', 'Done'];

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

    socket.on('taskEdited', (updatedTask) => {
      console.log('Received taskEdited:', updatedTask);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task._id === updatedTask._id ? updatedTask : task
        )
      );
    });

    socket.on('taskDeleted', (taskId) => {
      console.log('Received taskDeleted:', taskId);
      setTasks((prevTasks) => prevTasks.filter((task) => task._id !== taskId));
    });

    socket.on('connect_error', (err) => {
      console.error('BoardView Socket.IO error:', err.message);
      setError('Real-time updates unavailable');
    });

    return () => {
      socket.emit('leaveBoard', boardId);
      socket.off('taskUpdated');
      socket.off('taskEdited');
      socket.off('taskDeleted');
      socket.off('connect_error');
      console.log('Emitted leaveBoard:', boardId);
    };
  }, [boardId, socket]);

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
    console.log('Dragging task:', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    socket.emit('updateTask', { _id: taskId, status: newStatus, board: boardId });
    console.log('Dropped task:', taskId, 'to status:', newStatus);
  };

  const handleEdit = (task) => {
    setEditingTask(task._id);
    setEditForm({ title: task.title, description: task.description || '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `${API_URL}/tasks/${editingTask}`,
        editForm,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      socket.emit('editTask', { _id: editingTask, ...editForm, board: boardId });
      setEditingTask(null);
      setEditForm({ title: '', description: '' });
    } catch (err) {
      setError('Failed to edit task');
      console.error('Edit task error:', err);
    }
  };

  const handleDelete = async (taskId) => {
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      socket.emit('deleteTask', taskId, boardId);
    } catch (err) {
      setError('Failed to delete task');
      console.error('Delete task error:', err);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Board View</h1>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.board}>
        {statuses.map((status) => (
          <div
            key={status}
            className={styles.column}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <h2 className={styles.columnTitle}>{status}</h2>
            {tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <div
                  key={task._id}
                  className={styles.taskCard}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task._id)}
                >
                  {editingTask === task._id ? (
                    <form onSubmit={handleEditSubmit} className={styles.editForm}>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        placeholder="Task title"
                        required
                        className={styles.input}
                      />
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Task description"
                        className={styles.textarea}
                      />
                      <button type="submit" className={styles.saveButton}>Save</button>
                      <button
                        type="button"
                        onClick={() => setEditingTask(null)}
                        className={styles.cancelButton}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <h3 className={styles.taskTitle}>{task.title}</h3>
                      <p className={styles.taskDescription}>{task.description || 'No description'}</p>
                      <div className={styles.taskActions}>
                        <button
                          onClick={() => handleEdit(task)}
                          className={styles.editButton}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(task._id)}
                          className={styles.deleteButton}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BoardView;