import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import styles from './BoardView.module.css';

function BoardView({ socket }) {
  const { boardId } = useParams();
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState({});
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '' });
  const [createForm, setCreateForm] = useState({ title: '', description: '', status: 'To Do', dueDate: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [newComment, setNewComment] = useState({});
  const [showComments, setShowComments] = useState({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';
  const statuses = ['To Do', 'In Progress', 'Done'];

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setIsLoadingTasks(true);
        const res = await axios.get(`${API_URL}/tasks?boardId=${boardId}`, {
          headers: user ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {},
        });
        setTasks(res.data);
      } catch (err) {
        setError('Failed to fetch tasks');
        console.error('Fetch tasks error:', err);
      } finally {
        setIsLoadingTasks(false);
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
      setComments((prev) => {
        const newComments = { ...prev };
        delete newComments[taskId];
        return newComments;
      });
      setShowComments((prev) => {
        const newShowComments = { ...prev };
        delete newComments[taskId];
        return newShowComments;
      });
    });

    socket.on('commentAdded', (newComment) => {
      console.log('Received commentAdded:', newComment);
      setComments((prev) => ({
        ...prev,
        [newComment.task]: [newComment, ...(prev[newComment.task] || [])],
      }));
    });

    socket.on('connect_error', (err) => {
      console.error('BoardView Socket.IO error:', err.message);
      setError('Real-time updates unavailable');
    });

    return () => {
      socket.emit('leaveBoard', boardId);
      Object.keys(showComments).forEach((taskId) => socket.emit('leaveTask', taskId));
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('taskEdited');
      socket.off('taskDeleted');
      socket.off('commentAdded');
      socket.off('connect_error');
      console.log('Emitted leaveBoard:', boardId);
    };
  }, [boardId, socket, user, showComments]);

  const fetchComments = useCallback(async (taskId) => {
    try {
      setIsLoadingComments((prev) => ({ ...prev, [taskId]: true }));
      const res = await axios.get(`${API_URL}/comments?taskId=${taskId}`);
      setComments((prev) => ({ ...prev, [taskId]: res.data }));
    } catch (err) {
      console.error('Fetch comments error:', err);
    } finally {
      setIsLoadingComments((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  const toggleComments = useCallback((taskId) => {
    setShowComments((prev) => {
      const newShowComments = { ...prev, [taskId]: !prev[taskId] };
      if (newShowComments[taskId]) {
        socket.emit('joinTask', taskId);
        fetchComments(taskId);
      } else {
        socket.emit('leaveTask', taskId);
      }
      return newShowComments;
    });
  }, [socket, fetchComments]);

  const handleDragStart = useCallback((e, taskId) => {
    if (!isDragEnabled) {
      console.log('Drag prevented: Drag-and-drop not enabled');
      return;
    }
    e.dataTransfer.setData('taskId', taskId);
    console.log('Dragging task:', taskId);
  }, [isDragEnabled]);

  const handleDragOver = useCallback((e) => {
    if (!isDragEnabled) return;
    e.preventDefault();
  }, [isDragEnabled]);

  const handleDrop = useCallback((e, newStatus) => {
    if (!isDragEnabled) return;
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    socket.emit('updateTask', { _id: taskId, status: newStatus, board: boardId });
    console.log('Dropped task:', taskId, 'to status:', newStatus);
  }, [isDragEnabled, boardId, socket]);

  const handleCreateSubmit = useCallback(async (e) => {
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
      setCreateForm({ title: '', description: '', status: 'To Do', dueDate: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Failed to create task');
      console.error('Create task error:', err);
    }
  }, [user, createForm, boardId, socket]);

  const handleEdit = useCallback((task) => {
    if (!user) {
      setError('Please log in to edit a task');
      return;
    }
    setEditingTask(task._id);
    setEditForm({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    });
  }, [user]);

  const handleEditSubmit = useCallback(async (e) => {
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
      setEditForm({ title: '', description: '', dueDate: '' });
    } catch (err) {
      setError('Failed to edit task');
      console.error('Edit task error:', err);
    }
  }, [user, editingTask, editForm, boardId, socket]);

  const handleDelete = useCallback(async (taskId) => {
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
  }, [user, boardId, socket]);

  const handleCommentSubmit = useCallback(async (taskId, e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to add a comment');
      return;
    }
    const content = newComment[taskId]?.trim();
    if (!content) {
      setError('Comment cannot be empty');
      return;
    }
    if (!/^[0-9a-fA-F]{24}$/.test(taskId)) {
      setError('Invalid task ID');
      console.error('Invalid taskId:', taskId);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token missing');
      return;
    }
    try {
      console.log('Sending comment payload:', { content, taskId });
      const res = await axios.post(
        `${API_URL}/comments`,
        { content, taskId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("gjjh", res);
      socket.emit('commentAdded', res.data);
      setNewComment((prev) => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add comment';
      setError(errorMessage);
      console.error('Add comment error:', err.response?.data || err);
    }
  }, [user, newComment, socket]);

  const formatDate = useCallback((date) => {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

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
          <input
            type="date"
            value={createForm.dueDate}
            onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
            className={styles.dateInput}
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
        {isLoadingTasks ? (
          <div className={styles.loading}>Loading tasks...</div>
        ) : (
          statuses.map((status) => (
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
                        <input
                          type="date"
                          value={editForm.dueDate}
                          onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                          className={styles.dateInput}
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
                        <p className={styles.dueDate}>Due: {formatDate(task.dueDate)}</p>
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
                        <div className={styles.commentsSection}>
                          <button
                            onClick={() => toggleComments(task._id)}
                            className={styles.showCommentsButton}
                          >
                            {showComments[task._id] ? 'Hide Comments' : 'Show Comments'}
                          </button>
                          {showComments[task._id] && (
                            <>
                              {isLoadingComments[task._id] ? (
                                <div className={styles.loading}>Loading comments...</div>
                              ) : comments[task._id]?.length > 0 ? (
                                <div className={styles.commentsList}>
                                  {comments[task._id].map((comment) => (
                                    <div key={comment._id} className={styles.comment}>
                                      <p className={styles.commentContent}>{comment.content}</p>
                                      <p className={styles.commentMeta}>
                                        By {comment.user.email} on{' '}
                                        {new Date(comment.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className={styles.noComments}>No comments yet.</p>
                              )}
                              {user && (
                                <form
                                  onSubmit={(e) => handleCommentSubmit(task._id, e)}
                                  className={styles.commentForm}
                                >
                                  <input
                                    type="text"
                                    value={newComment[task._id] || ''}
                                    onChange={(e) =>
                                      setNewComment((prev) => ({
                                        ...prev,
                                        [task._id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Add a comment..."
                                    className={styles.commentInput}
                                  />
                                  <button type="submit" className={styles.commentButton}>
                                    Post
                                  </button>
                                </form>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default BoardView;