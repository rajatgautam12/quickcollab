import React, { useState, useEffect } from 'react';
import axios from 'axios';

function TaskModal({ task, onClose, socket, onUpdateTask }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [taskDetails, setTaskDetails] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
    tags: task.tags?.join(', ') || '',
  });
  const [error, setError] = useState('');
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token missing');
          return;
        }
        const res = await axios.get(`${API_URL}/comments?taskId=${task._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setComments(res.data);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setError('Failed to fetch comments');
      }
    };
    fetchComments();

    socket.emit('joinTask', task._id);
    socket.on('commentAdded', (comment) => {
      if (comment.task === task._id) {
        setComments((prev) => [comment, ...prev]);
      }
    });

    return () => {
      socket.emit('leaveTask', task._id);
      socket.off('commentAdded');
    };
  }, [task._id, socket]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    const content = newComment.trim();
    const taskId = task._id;
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
      socket.emit('commentAdded', res.data);
      setNewComment('');
      setError('');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add comment';
      setError(errorMessage);
      console.error('Add comment error:', err.response?.data || err);
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    const updates = {
      title: taskDetails.title,
      description: taskDetails.description,
      status: taskDetails.status,
      dueDate: taskDetails.dueDate,
      tags: taskDetails.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      await onUpdateTask(task._id, updates);
      setError('');
    } catch (err) {
      setError('Failed to update task');
      console.error('Update task error:', err);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2 className="text-2xl font-bold mb-4">{task.title}</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 mb-4 rounded">{error}</div>}
        <form onSubmit={handleUpdateTask} className="mb-6">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={taskDetails.title}
              onChange={(e) => setTaskDetails({ ...taskDetails, title: e.target.value })}
              className="form-group"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={taskDetails.description}
              onChange={(e) => setTaskDetails({ ...taskDetails, description: e.target.value })}
              className="form-group"
            />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select
              value={taskDetails.status}
              onChange={(e) => setTaskDetails({ ...taskDetails, status: e.target.value })}
              className="form-group"
            >
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input
              type="date"
              value={taskDetails.dueDate}
              onChange={(e) => setTaskDetails({ ...taskDetails, dueDate: e.target.value })}
              className="form-group"
            />
          </div>
          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={taskDetails.tags}
              onChange={(e) => setTaskDetails({ ...taskDetails, tags: e.target.value })}
              className="form-group"
            />
          </div>
          <button type="submit" className="button button-blue">
            Update Task
          </button>
        </form>
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Comments</h3>
          <div className="comment-list">
            {comments.map((comment) => (
              <div key={comment._id} className="comment">
                <p className="text-sm">{comment.user.email} - {new Date(comment.createdAt).toLocaleString()}</p>
                <p>{comment.content}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="mt-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="form-group mb-2"
              required
            />
            <button type="submit" className="button button-blue">
              Add Comment
            </button>
          </form>
        </div>
        <button onClick={onClose} className="button button-red">
          Close
        </button>
      </div>
    </div>
  );
}

export default TaskModal;