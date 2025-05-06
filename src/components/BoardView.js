import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import TaskModal from '../components/TaskModel';
import styles from './BoardView.module.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://quickcollab-backend-9mdn.onrender.com';
let socket;

const BoardView = () => {
  const { boardId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [isDraggingEnabled, setIsDraggingEnabled] = useState(false);
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const commentRefs = useRef({});

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('BoardView token check:', { token: token ? 'Present' : 'Missing' });

    socket = io(API_URL, { transports: ['websocket'] });
    socket.on('connect', () => console.log('Socket.IO connected:', socket.id));

    const fetchTasks = async () => {
      try {
        const response = await axios.get(`${API_URL}/tasks?boardId=${boardId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTasks(response.data);
      } catch (err) {
        console.error('Error fetching tasks:', err.response?.data || err.message);
      }
    };

    fetchTasks();

    socket.on('taskCreated', (task) => setTasks((prev) => [...prev, task]));
    socket.on('taskEdited', (updatedTask) => {
      setTasks((prev) => prev.map((task) => (task._id === updatedTask._id ? updatedTask : task)));
    });
    socket.on('taskDeleted', (taskId) => {
      setTasks((prev) => prev.filter((task) => task._id !== taskId));
    });

    return () => {
      socket.disconnect();
    };
  }, [boardId]);

  const fetchComments = async (taskId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${API_URL}/comments?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComments((prev) => ({ ...prev, [taskId]: response.data }));
      socket.emit('joinTask', taskId);
    } catch (err) {
      console.error('Error fetching comments:', err.response?.data || err.message);
    }
  };

  const handleCommentSubmit = async (taskId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for comment submission');
      return;
    }
    if (!commentInput.trim()) return;
    try {
      console.log('Sending comment payload:', { content: commentInput, taskId, token: token.slice(0, 10) + '...' });
      const response = await axios.post(
        `${API_URL}/comments`,
        { content: commentInput, taskId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCommentInput('');
    } catch (err) {
      console.error('Add comment error:', err.response?.data || err.message);
    }
  };

  useEffect(() => {
    Object.keys(showComments).forEach((taskId) => {
      if (showComments[taskId]) {
        fetchComments(taskId);
        socket.on('commentAdded', (comment) => {
          if (comment.task === taskId) {
            setComments((prev) => ({
              ...prev,
              [taskId]: [comment, ...(prev[taskId] || [])],
            }));
            console.log('Received commentAdded:', comment);
          }
        });
      }
    });
  }, [showComments]);

  const handleDragStart = (e, taskId) => {
    if (!isDraggingEnabled) {
      console.log('Drag prevented: dragging not enabled');
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDrop = async (e, status) => {
    if (!isDraggingEnabled) return;
    const taskId = e.dataTransfer.getData('text');
    try {
      const response = await axios.put(
        `${API_URL}/tasks/${taskId}`,
        { status },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      console.log('Dropped task:', response.data);
    } catch (err) {
      console.error('Error updating task status:', err.response?.data || err.message);
    }
  };

  const openTaskModal = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  return (
    <div className={styles.board}>
      <button onClick={() => setIsDraggingEnabled(!isDraggingEnabled)}>
        {isDraggingEnabled ? 'Disable Drag' : 'Enable Drag'}
      </button>
      {['To Do', 'In Progress', 'Done'].map((status) => (
        <div
          key={status}
          className={styles.column}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, status)}
        >
          <h2>{status}</h2>
          {tasks
            .filter((task) => task.status === status)
            .map((task) => (
              <div
                key={task._id}
                className={styles.task}
                draggable={isDraggingEnabled}
                onDragStart={(e) => handleDragStart(e, task._id)}
                onClick={() => openTaskModal(task)}
              >
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                {task.dueDate && (
                  <p className={styles.dueDate}>Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                )}
                {task.tags?.length > 0 && (
                  <p className={styles.tags}>Tags: {task.tags.join(', ')}</p>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowComments((prev) => ({
                      ...prev,
                      [task._id]: !prev[task._id],
                    }));
                  }}
                >
                  {showComments[task._id] ? 'Hide Comments' : 'Show Comments'}
                </button>
                {showComments[task._id] && (
                  <div className={styles.comments}>
                    <input
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add a comment..."
                    />
                    <button onClick={() => handleCommentSubmit(task._id)}>Post</button>
                    <div className={styles.commentList}>
                      {comments[task._id]?.map((comment) => (
                        <div
                          key={comment._id}
                          className={styles.comment}
                          ref={(el) => (commentRefs.current[comment._id] = el)}
                        >
                          <p>{comment.content}</p>
                          <small>
                            {comment.user?.name || comment.user?.email} -{' '}
                            {new Date(comment.createdAt).toLocaleString()}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      ))}
      {isModalOpen && (
        <TaskModal
          task={selectedTask}
          boardId={boardId}
          onClose={closeTaskModal}
          onSave={(updatedTask) => {
            setTasks((prev) =>
              prev.map((task) => (task._id === updatedTask._id ? updatedTask : task))
            );
            closeTaskModal();
          }}
        />
      )}
    </div>
  );
};

export default BoardView;