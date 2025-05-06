import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import styles from './BoardView.module.css';

function BoardView({ socket }) {
  const { boardId } = useParams();
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [createForm, setCreateForm] = useState({ title: '', description: '', status: 'To Do' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';
  const statuses = ['To Do', 'In Progress', 'Done'];

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get(`${API_URL}/tasks?boardId=${boardId}`, {
          headers: user ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {},
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

    socket.on('taskCreated', (newTask) => {
      console.log('Received taskCreated:', newTask);
      setTasks((prevTasks) => [...prevTasks, newTask]);
    });

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
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('taskEdited');
      socket.off('taskDeleted');
      socket.off('connect_error');
      console.log('Emitted leaveBoard:', boardId);
    };
  }, [boardId, socket, user]);

  const handleDragStart = (e, taskId) => {
    if (!isDragEnabled) {
      console.log('Drag prevented: Drag-and-drop not enabled');
      return;
    }
    e.dataTransfer.setData('taskId', taskId);
    console.log('Dragging task:', taskId);
  };

  const handleDragOver = (e) => {
    if (!isDragEnabled) return;
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    if (!isDragEnabled) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    socket.emit('updateTask', { _id: taskId, status: newStatus, board: boardId });
    console.log('Dropped task:', taskId, 'to status:', newStatus);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to create a task');
      return;
    }
    try {
      const res = await axios.post(
        `${API_URL}/tasks`,
        { ...createForm, boardId },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      socket.emit('createTask', { ...createForm, board: boardId, _id: res.data._id });
      setCreateForm({ title: '', description: '', status: 'To Do' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Failed to create task');
      console.error('Create task error:', err);
    }
  };

  const handleEdit = (task) => {
    if (!user) {
      setError('Please log in to edit a task');
      return;
    }
    setEditingTask(task._id);
    setEditForm({ title: task.title, description: task.description || '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to edit a task');
      return;
    }
    try {
      await axios.put(
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
    if (!user) {
      setError('Please log in to delete a task');
      return;
    }
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
      <button
        onClick={() => setIsDragEnabled(!isDragEnabled)}
        className={styles.enableDragButton}
      >
        {isDragEnabled ? 'Disable Drag-and-Drop' : 'Enable Drag-and-Drop'}
      </button>
      {user && (
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={styles.createButton}
        >
          {showCreateForm ? 'Cancel' : 'Create Task'}
        </button>
      )}
      {showCreateForm && user && (
        <form onSubmit={handleCreateSubmit} className={styles.createForm}>
          <input
            type="text"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="Task title"
            required
            className={styles.input}
          />
          <textarea
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            placeholder="Task description"
            className={styles.textarea}
          />
          <select
            value={createForm.status}
            onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
            className={styles.statusSelect}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button type="submit" className={styles.saveButton}>Create</button>
        </form>
      )}
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
                  draggable={isDragEnabled}
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
                      {user && (
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
                      )}
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