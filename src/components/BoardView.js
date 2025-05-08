import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import styles from './BoardView.module.css';
import { jwtDecode } from 'jwt-decode';

function BoardView({ socket }) {
  const { boardId } = useParams();
  const { user, refreshToken, logout } = useContext(AuthContext);
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState({});
  const [collaborators, setCollaborators] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', dueDate: '', assignedTo: '' });
  const [createForm, setCreateForm] = useState({ title: '', description: '', status: 'To Do', dueDate: '', assignedTo: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const [newComment, setNewComment] = useState({});
  const [showComments, setShowComments] = useState({});
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';
  const statuses = ['To Do', 'In Progress', 'Done'];

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('BoardView init:', { userId: user?.id, token: token ? 'Present' : 'Missing' });

    const fetchTasks = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token missing');
        console.error('No token for fetchTasks');
        setIsLoadingTasks(false);
        return;
      }
      try {
        setIsLoadingTasks(true);
        const res = await api.get(`/tasks?boardId=${boardId}`);
        setTasks(res.data);
      } catch (err) {
        setError('Failed to fetch tasks');
        console.error('Fetch tasks error:', err.response?.data || err.message);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    const fetchCollaborators = async () => {
      try {
        const res = await api.get(`/boards/${boardId}/collaborators`);
        setCollaborators(res.data);
      } catch (err) {
        setError('Failed to fetch collaborators');
        console.error('Fetch collaborators error:', err.response?.data || err.message);
      }
    };

    fetchTasks();
    fetchCollaborators();
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
        delete newShowComments[taskId];
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

    socket.on('collaboratorAdded', (collaborator) => {
      console.log('Received collaboratorAdded:', collaborator);
      setCollaborators((prev) => [...prev, collaborator]);
    });

    socket.on('taskAssigned', (updatedTask) => {
      console.log('Received taskAssigned:', updatedTask);
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
      Object.keys(showComments).forEach((taskId) => socket.emit('leaveTask', taskId));
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('taskEdited');
      socket.off('taskDeleted');
      socket.off('commentAdded');
      socket.off('collaboratorAdded');
      socket.off('taskAssigned');
      socket.off('connect_error');
      console.log('Emitted leaveBoard:', boardId);
    };
  }, [boardId, socket, user, showComments]);

  const fetchComments = useCallback(async (taskId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token for fetchComments');
      return;
    }
    try {
      setIsLoadingComments((prev) => ({ ...prev, [taskId]: true }));
      const res = await api.get(`/comments?taskId=${taskId}`);
      setComments((prev) => ({ ...prev, [taskId]: res.data }));
    } catch (err) {
      console.error('Fetch comments error:', err.response?.data || err.message);
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

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to invite collaborators');
      return;
    }
    try {
      const res = await api.post(`/boards/${boardId}/invite`, { email: inviteEmail });
      socket.emit('inviteSent', { boardId, collaborator: res.data });
      setInviteEmail('');
      setError('');
    } catch (err) {
      setError('Failed to invite collaborator');
      console.error('Invite error:', err.response?.data || err.message);
    }
  };

  const handleAssignTask = async (taskId, assignedTo) => {
    if (!user) {
      setError('Please log in to assign tasks');
      return;
    }
    try {
      await api.put(`/tasks/${taskId}/assign`, { assignedTo });
      socket.emit('taskAssigned', { _id: taskId, assignedTo, board: boardId });
    } catch (err) {
      setError('Failed to assign task');
      console.error('Assign task error:', err.response?.data || err.message);
    }
  };

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
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token missing');
      console.error('No token for createTask');
      return;
    }
    try {
      const res = await api.post('/tasks', { ...createForm, boardId });
      socket.emit('createTask', { ...createForm, board: boardId, _id: res.data._id });
      setCreateForm({ title: '', description: '', status: 'To Do', dueDate: '', assignedTo: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Failed to create task');
      console.error('Create task error:', err.response?.data || err.message);
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
      assignedTo: task.assignedTo || '',
    });
  }, [user]);

  const handleEditSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to edit a task');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token missing');
      console.error('No token for editTask');
      return;
    }
    try {
      await api.put(`/tasks/${editingTask}`, editForm);
      socket.emit('editTask', { _id: editingTask, ...editForm, board: boardId });
      setEditingTask(null);
      setEditForm({ title: '', description: '', dueDate: '', assignedTo: '' });
    } catch (err) {
      setError('Failed to edit task');
      console.error('Edit task error:', err.response?.data || err.message);
    }
  }, [user, editingTask, editForm, boardId, socket]);

  const handleDelete = useCallback(async (taskId) => {
    if (!user) {
      setError('Please log in to delete a task');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication token missing');
      console.error('No token for deleteTask');
      return;
    }
    try {
      await api.delete(`/tasks/${taskId}`);
      socket.emit('deleteTask', taskId, boardId);
    } catch (err) {
      setError('Failed to delete task');
      console.error('Delete task error:', err.response?.data || err.message);
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
    if (!user.id) {
      setError('User ID missing');
      console.error('User ID not available:', user);
      return;
    }
    if (!user.token) {
      setError('Authentication token missing');
      console.error('No token in user object:', user);
      return;
    }
    try {
      let decoded;
      try {
        decoded = jwtDecode(user.token);
        console.log('Token decoded for comment:', { payload: decoded, userId: user.id });
        if (!decoded.id) {
          throw new Error('Token has no valid user ID');
        }
        if (decoded.id !== user.id) {
          throw new Error('Token user ID does not match AuthContext user ID');
        }
        if (!/^[0-9a-fA-F]{24}$/.test(decoded.id)) {
          throw new Error('Token id is not a valid ObjectId');
        }
      } catch (decodeErr) {
        console.error('Invalid token decode:', decodeErr.message);
        setError('Invalid authentication token. Please log in again.');
        logout();
        return;
      }

      console.log('Sending comment payload:', { content, taskId, userId: user.id, token: user.token.slice(0, 10) + '...' });
      let token = user.token;
      try {
        const res = await api.post('/comments', { content, taskId, userId: user.id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        socket.emit('commentAdded', res.data);
        setNewComment((prev) => ({ ...prev, [taskId]: '' }));
      } catch (err) {
        if (err.response?.status === 401 && err.response?.data?.message === 'Token has expired') {
          console.log('Token expired, attempting to refresh');
          token = await refreshToken();
          const res = await api.post('/comments', { content, taskId, userId: user.id }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          socket.emit('commentAdded', res.data);
          setNewComment((prev) => ({ ...prev, [taskId]: '' }));
        } else if (err.response?.status === 401 && err.response?.data?.message === 'Token is not valid: User not found') {
          console.error('User not found for token, logging out:', { userId: user.id });
          setError('Your account is no longer valid. Please log in again.');
          logout();
        } else if (err.response?.status === 401 && err.response?.data?.message === 'Token is not valid: Missing user ID') {
          console.error('Token missing user ID, logging out:', { userId: user.id });
          setError('Invalid authentication token. Please log in again.');
          logout();
        } else {
          throw err;
        }
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add comment';
      setError(errorMessage);
      console.error('Add comment error:', err.response?.data || err);
    }
  }, [user, newComment, socket, refreshToken, logout]);

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
      <div className={styles.collaboratorsSection}>
        <h2>Collaborators</h2>
        <ul className={styles.collaboratorsList}>
          {collaborators.map((collab) => (
            <li key={collab.userId} className={styles.collaborator}>
              {collab.email} ({collab.role})
            </li>
          ))}
        </ul>
        {user && (
          <form onSubmit={handleInvite} className={styles.inviteForm}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email to invite"
              className={styles.input}
              required
            />
            <button type="submit" className={styles.inviteButton}>Invite</button>
          </form>
        )}
      </div>
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
          <select
            value={createForm.assignedTo}
            onChange={(e) => setCreateForm({ ...createForm, assignedTo: e.target.value })}
            className={styles.assignedToSelect}
          >
            <option value="">Unassigned</option>
            {collaborators.map((collab) => (
              <option key={collab.userId} value={collab.userId}>
                {collab.email}
              </option>
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
                        <select
                          value={editForm.assignedTo}
                          onChange={(e) => setEditForm({ ...editForm, assignedTo: e.target.value })}
                          className={styles.assignedToSelect}
                        >
                          <option value="">Unassigned</option>
                          {collaborators.map((collab) => (
                            <option key={collab.userId} value={collab.userId}>
                              {collab.email}
                            </option>
                          ))}
                        </select>
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
                        <p className={styles.assignedTo}>
                          Assigned to: {task.assignedTo ? collaborators.find(c => c.userId === task.assignedTo)?.email || 'Unknown' : 'Unassigned'}
                        </p>
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