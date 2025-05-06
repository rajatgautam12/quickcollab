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
  const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/comments/${task._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setComments(res.data);
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };
    fetchComments();

    socket.on('newComment', (comment) => {
      if (comment.task === task._id) {
        setComments((prev) => [...prev, comment]);
      }
    });

    return () => {
      socket.off('newComment');
    };
  }, [task._id, socket]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/comments`,
        { content: newComment, taskId: task._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
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
    onUpdateTask(task._id, updates);
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2 className="text-2xl font-bold mb-4">{task.title}</h2>
        <form onSubmit={handleUpdateTask} className="mb-6">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={taskDetails.title}
              onChange={(e) => setTaskDetails({ ...taskDetails, title: e.target.value })}
              className="form-group"
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
                <p className="text-sm">{comment.user.name} - {new Date(comment.createdAt).toLocaleString()}</p>
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