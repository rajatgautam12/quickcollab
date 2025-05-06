import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import TaskModal from '../components/TaskModel';

function BoardView({ socket }) {
  const { boardId } = useParams();
  const [board, setBoard] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', status: 'To Do' });
  const API_URL = process.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    socket.emit('joinBoard', boardId);
    const fetchBoard = async () => {
      try {
        const token = localStorage.getItem('token');
        const [boardRes, tasksRes] = await Promise.all([
          axios.get(`${API_URL}/boards`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/tasks/${boardId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const boardData = boardRes.data.find((b) => b._id === boardId);
        setBoard(boardData);
        setTasks(tasksRes.data);
      } catch (err) {
        console.error('Error fetching board/tasks:', err);
      }
    };
    fetchBoard();

    socket.on('newComment', (comment) => {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task._id === comment.task ? { ...task, comments: [...(task.comments || []), comment] } : task
        )
      );
    });

    socket.on('taskUpdated', (updatedTask) => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => (task._id === updatedTask._id ? updatedTask : task))
      );
    });

    return () => {
      socket.emit('leaveBoard', boardId);
      socket.off('newComment');
      socket.off('taskUpdated');
    };
  }, [boardId, socket]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/tasks`,
        { ...newTask, boardId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTasks([...tasks, res.data]);
      setNewTask({ title: '', status: 'To Do' });
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(
        `${API_URL}/tasks/${taskId}`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      socket.emit('updateTask', res.data);
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  if (!board) return <div>Loading...</div>;

  return (
    <div className="container">
      <h1 className="text-3xl font-bold mb-6">{board.title}</h1>
      <form onSubmit={handleCreateTask} className="mb-6">
        <input
          type="text"
          value={newTask.title}
          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
          placeholder="New Task Title"
          className="form-group mr-2"
          required
        />
        <select
          value={newTask.status}
          onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
          className="form-group mr-2"
        >
          <option value="To Do">To Do</option>
          <option value="In Progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
        <button type="submit" className="button button-blue">
          Add Task
        </button>
      </form>
      <div className="grid grid-md-3">
        {['To Do', 'In Progress', 'Done'].map((status) => (
          <div key={status} className="column">
            <h2 className="text-xl font-semibold mb-4">{status}</h2>
            {tasks
              .filter((task) => task.status === status)
              .map((task) => (
                <div
                  key={task._id}
                  onClick={() => setSelectedTask(task)}
                  className="task-card"
                >
                  <h3 className="font-medium">{task.title}</h3>
                  {task.dueDate && (
                    <p className="text-sm">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          socket={socket}
          onUpdateTask={handleUpdateTask}
        />
      )}
    </div>
  );
}

export default BoardView;