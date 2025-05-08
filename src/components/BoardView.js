import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import io from 'socket.io-client';
import styles from './BoardView.module.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';
const socket = io(API_URL, { withCredentials: true });

const BoardView = () => {
  const { boardId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDraggingEnabled, setIsDraggingEnabled] = useState(true);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status: 'To Do',
    dueDate: '',
    assignedTo: '',
  });
  const [editingTask, setEditingTask] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showComments, setShowComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [comments, setComments] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');

  useEffect(() => {
    const fetchBoard = async () => {
      try {
        const res = await api.get(`/boards/${boardId}`);
        setBoard(res.data);
      } catch (err) {
        setError('Failed to load board');
      }
    };

    const fetchTasks = async () => {
      try {
        const res = await api.get(`/tasks?boardId=${boardId}`);
        setTasks(res.data);
      } catch (err) {
        setError('Failed to load tasks');
      }
    };

    const fetchCollaborators = async () => {
      try {
        const res = await api.get(`/boards/${boardId}/collaborators`);
        setCollaborators(res.data);
      } catch (err) {
        setError('Failed to load collaborators');
      }
    };

    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchBoard(), fetchTasks(), fetchCollaborators()]);
      setIsLoading(false);
    };

    loadData();

    socket.emit('joinBoard', boardId);

    socket.on('taskCreated', (task) => {
      setTasks((prev) => [...prev, task]);
    });

    socket.on('taskUpdated', (updatedTask) => {
      setTasks((prev) =>
        prev.map((task) => (task._id === updatedTask._id ? updatedTask : task))
      );
    });

    socket.on('taskEdited', (updatedTask) => {
      setTasks((prev) =>
        prev.map((task) => (task._id === updatedTask._id ? updatedTask : task))
      );
    });

    socket.on('taskDeleted', (taskId) => {
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    });

    socket.on('commentAdded', (comment) => {
      setComments((prev) => ({
        ...prev,
        [comment.task]: [...(prev[comment.task] || []), comment],
      }));
    });

    socket.on('collaboratorAdded', (collaborator) => {
      setCollaborators((prev) => [...prev, collaborator]);
    });

    socket.on('taskAssigned', (task) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? task : t))
      );
    });

    return () => {
      socket.emit('leaveBoard', boardId);
      socket.off('taskCreated');
      socket.off('taskUpdated');
      socket.off('taskEdited');
      socket.off('taskDeleted');
      socket.off('commentAdded');
      socket.off('collaboratorAdded');
      socket.off('taskAssigned');
    };
  }, [boardId]);

  const handleDragEnd = async (result) => {
    if (!result.destination || !isDraggingEnabled) return;

    const { source, destination } = result;
    const taskId = result.draggableId;
    const newStatus = destination.droppableId;

    if (source.droppableId !== destination.droppableId) {
      try {
        const updatedTask = await api.put(`/tasks/${taskId}`, { status: newStatus });
        socket.emit('updateTask', updatedTask.data);
      } catch (err) {
        setError('Failed to update task status');
      }
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tasks', { ...newTask, boardId });
      socket.emit('createTask', res.data);
      setNewTask({ title: '', description: '', status: 'To Do', dueDate: '', assignedTo: '' });
      setShowCreateForm(false);
    } catch (err) {
      setError('Failed to create task');
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/tasks/${editingTask._id}`, editingTask);
      socket.emit('editTask', res.data);
      setEditingTask(null);
    } catch (err) {
      setError('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      socket.emit('deleteTask', taskId, boardId);
    } catch (err) {
      setError('Failed to delete task');
    }
  };

  const handleCommentSubmit = async (taskId, e) => {
    e.preventDefault();
    if (!newComment[taskId]?.trim()) return;

    try {
      const res = await api.post('/comments', {
        content: newComment[taskId],
        taskId,
        userId: user._id,
      });
      socket.emit('commentAdded', res.data);
      setNewComment((prev) => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      setError('Failed to add comment');
    }
  };

  const fetchComments = async (taskId) => {
    try {
      const res = await api.get(`/comments?taskId=${taskId}`);
      setComments((prev) => ({ ...prev, [taskId]: res.data }));
    } catch (err) {
      setError('Failed to load comments');
    }
  };

  const toggleComments = (taskId) => {
    setShowComments((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
    if (!showComments[taskId] && !comments[taskId]) {
      fetchComments(taskId);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setError('Please enter a valid email');
      return;
    }

    try {
      const res = await api.post(`/boards/${boardId}/invite`, { email: inviteEmail });
      socket.emit('collaboratorAdded', res.data, boardId);
      setInviteEmail('');
      socket.emit('inviteSent', { userId: res.data.userId, boardId, boardTitle: board.title });
    } catch (err) {
      setError('Failed to invite collaborator');
    }
  };

  const handleAssignTask = async (taskId, assignedTo) => {
    try {
      const res = await api.put(`/tasks/${taskId}/assign`, { assignedTo });
      socket.emit('taskAssigned', res.data);
    } catch (err) {
      setError('Failed to assign task');
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!board) {
    return <div className={styles.error}>Board not found</div>;
  }

  const columns = ['To Do', 'In Progress', 'Done'];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{board.title}</h1>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.collaboratorsSection}>
        <h3>Collaborators</h3>
        <ul className={styles.collaboratorsList}>
          {collaborators.map((collab) => (
            <li
              key={collab.userId}
              className={styles.collaborator}
              data-initials={collab.email
                .split('@')[0]
                .split('.')
                .map(word => word[0]?.toUpperCase())
                .join('')
                .slice(0, 2)}
            >
              {collab.email} ({collab.role})
            </li>
          ))}
        </ul>
        {board.owner === user._id && (
          <form onSubmit={handleInvite} className={styles.inviteForm}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email to invite"
              className={styles.input}
            />
            <button type="submit" className={styles.inviteButton}>
              Invite
            </button>
          </form>
        )}
      </div>

      <button
        onClick={() => setIsDraggingEnabled(!isDraggingEnabled)}
        className={styles.enableDragButton}
      >
        {isDraggingEnabled ? 'Disable Drag' : 'Enable Drag'}
      </button>

      <button onClick={() => setShowCreateForm(!showCreateForm)} className={styles.createButton}>
        {showCreateForm ? 'Cancel' : 'Create Task'}
      </button>

      {showCreateForm && (
        <form onSubmit={handleCreateTask} className={styles.createForm}>
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Task title"
            className={styles.input}
            required
          />
          <textarea
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Task description"
            className={styles.textarea}
          />
          <select
            value={newTask.status}
            onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
            className={styles.statusSelect}
          >
            {columns.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newTask.dueDate}
            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            className={styles.dateInput}
          />
          <select
            value={newTask.assignedTo}
            onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
            className={styles.assignedToSelect}
          >
            <option value="">Unassigned</option>
            {collaborators.map((collab) => (
              <option key={collab.userId} value={collab.userId}>
                {collab.email}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.saveButton}>
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </form>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={styles.board}>
          {columns.map((column) => (
            <Droppable key={column} droppableId={column}>
              {(provided) => (
                <div
                  className={styles.column}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  <h2 className={styles.columnTitle}>{column}</h2>
                  {tasks
                    .filter((task) => task.status === column)
                    .map((task, index) => (
                      <Draggable key={task._id} draggableId={task._id} index={index}>
                        {(provided) => (
                          <div
                            className={`${styles.taskCard} ${
                              provided.isDragging ? styles.dragging : ''
                            }`}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            {editingTask && editingTask._id === task._id ? (
                              <form onSubmit={handleEditTask} className={styles.editForm}>
                                <input
                                  type="text"
                                  value={editingTask.title}
                                  onChange={(e) =>
                                    setEditingTask({ ...editingTask, title: e.target.value })
                                  }
                                  className={styles.input}
                                  required
                                />
                                <textarea
                                  value={editingTask.description}
                                  onChange={(e) =>
                                    setEditingTask({
                                      ...editingTask,
                                      description: e.target.value,
                                    })
                                  }
                                  className={styles.textarea}
                                />
                                <select
                                  value={editingTask.status}
                                  onChange={(e) =>
                                    setEditingTask({ ...editingTask, status: e.target.value })
                                  }
                                  className={styles.statusSelect}
                                >
                                  {columns.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="date"
                                  value={editingTask.dueDate}
                                  onChange={(e) =>
                                    setEditingTask({ ...editingTask, dueDate: e.target.value })
                                  }
                                  className={styles.dateInput}
                                />
                                <select
                                  value={editingTask.assignedTo}
                                  onChange={(e) =>
                                    setEditingTask({
                                      ...editingTask,
                                      assignedTo: e.target.value,
                                    })
                                  }
                                  className={styles.assignedToSelect}
                                >
                                  <option value="">Unassigned</option>
                                  {collaborators.map((collab) => (
                                    <option key={collab.userId} value={collab.userId}>
                                      {collab.email}
                                    </option>
                                  ))}
                                </select>
                                <button type="submit" className={styles.saveButton}>
                                  Save
                                </button>
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
                                <p className={styles.taskDescription}>{task.description}</p>
                                {task.dueDate && (
                                  <p className={styles.dueDate}>
                                    Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                                  </p>
                                )}
                                <p className={styles.assignedTo}>
                                  Assigned to: {task.assignedTo?.email || 'Unassigned'}
                                </p>
                                <div className={styles.taskActions}>
                                  <button
                                    onClick={() =>
                                      setEditingTask({
                                        _id: task._id,
                                        title: task.title,
                                        description: task.description,
                                        status: task.status,
                                        dueDate: task.dueDate
                                          ? format(new Date(task.dueDate), 'yyyy-MM-dd')
                                          : '',
                                        assignedTo: task.assignedTo?._id || '',
                                      })
                                    }
                                    className={styles.editButton}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task._id)}
                                    className={styles.deleteButton}
                                  >
                                    Delete
                                  </button>
                                </div>
                                <div className={styles.commentsSection}>
                                  <button
                                    onClick={() => toggleComments(task._id)}
                                    className={styles.showCommentsButton}
                                  >
                                    {showComments[task._id] ? 'Hide Comments' : 'Show Comments'}
                                  </button>
                                  {showComments[task._id] && (
                                    <div className={styles.commentsList}>
                                      {comments[task._id]?.length > 0 ? (
                                        comments[task._id].map((comment) => (
                                          <div key={comment._id} className={styles.comment}>
                                            <p className={styles.commentContent}>
                                              {comment.content}
                                            </p>
                                            <p className={styles.commentMeta}>
                                              By {comment.user?.email || 'Unknown'} on{' '}
                                              {format(
                                                new Date(comment.createdAt),
                                                'MMM dd, yyyy HH:mm'
                                              )}
                                            </p>
                                          </div>
                                        ))
                                      ) : (
                                        <p className={styles.noComments}>No comments yet</p>
                                      )}
                                      <form
                                        onSubmit={(e) => handleCommentSubmit(task._id, e)}
                                        className={styles.commentForm}
                                      >
                                        <input
                                          type="text"
                                          value={newComment[task._id] || ''}
                                          onChange={(e) =>
                                            setNewComment({
                                              ...newComment,
                                              [task._id]: e.target.value,
                                            })
                                          }
                                          placeholder="Add a comment"
                                          className={styles.commentInput}
                                        />
                                        <button
                                          type="submit"
                                          className={styles.commentButton}
                                        >
                                          Comment
                                        </button>
                                      </form>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default BoardView;