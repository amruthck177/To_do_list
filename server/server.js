const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- DATABASE CONNECTION ---
/**
 * Connect to MongoDB
 * Ensure MongoDB is running on localhost:27017
 */
mongoose.connect('mongodb://127.0.0.1:27017/todoapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- DATABASE SCHEMA ---
/**
 * Task Schema for MongoDB
 * Defines the structure of task documents
 */
const taskSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 500
  },
  date: { 
    type: String, 
    default: '',
    match: /^\d{4}-\d{2}-\d{2}$|^$/  // YYYY-MM-DD format or empty
  },
  time: { 
    type: String, 
    default: '',
    match: /^\d{2}:\d{2}$|^$/  // HH:MM format or empty
  },
  category: { 
    type: String, 
    default: 'none',
    enum: ['none', 'work', 'personal', 'health']
  },
  priority: { 
    type: String, 
    default: 'medium',
    enum: ['low', 'medium', 'high', 'urgent']
  },
  completed: { 
    type: Boolean, 
    default: false
  },
  subtasks: { 
    type: Array, 
    default: [] 
  },
  order: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// --- API ROUTES ---

/**
 * GET /api/tasks
 * Fetch all tasks sorted by order and creation date
 * @returns {Array} Array of all tasks
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to read tasks' });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 * @body {Object} Task data (text, date, time, category, priority, completed)
 * @returns {Object} Created task with ID and timestamps
 */
app.post('/api/tasks', async (req, res) => {
  try {
    const { text, date, time, category, priority, completed } = req.body;
    
    // Validate required fields
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Task text is required' });
    }
    
    const count = await Task.countDocuments();
    const newTask = new Task({
      text: text.trim(),
      date: date || '',
      time: time || '',
      category: category || 'none',
      priority: priority || 'medium',
      completed: completed || false,
      order: count > 0 ? -(count + 1) : 0
    });
    
    const savedTask = await newTask.save();
    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * PUT /api/tasks/reorder
 * Reorder tasks (drag & drop functionality)
 * @body {Object} { orders: Array of {_id, order} }
 * @returns {Object} Success message
 */
app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders must be an array' });
    }
    
    for (let { _id, order } of orders) {
      await Task.findByIdAndUpdate(_id, { order });
    }
    
    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    console.error('Error reordering tasks:', err);
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a specific task
 * @param {string} id - Task ID
 * @body {Object} Task fields to update
 * @returns {Object} Updated task
 */
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Sanitize input
    if (updateData.text) {
      updateData.text = updateData.text.trim();
    }
    
    const updatedTask = await Task.findByIdAndUpdate(id, updateData, { new: true });
    
    if (updatedTask) {
      res.json(updatedTask);
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a specific task
 * @param {string} id - Task ID
 * @returns {void} 204 No Content
 */
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTask = await Task.findByIdAndDelete(id);
    
    if (deletedTask) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// --- AI ENDPOINTS ---

/**
 * POST /api/ai/suggest
 * Mock AI endpoint for task suggestions
 * Breaks down a large goal into actionable subtasks
 * 
 * TODO: Integrate with real AI service (OpenAI, Anthropic, etc.)
 * 
 * @body {Object} { goal: string }
 * @returns {Object} { suggestions: Array<string> }
 */
app.post('/api/ai/suggest', (req, res) => {
  const { goal } = req.body;
  
  if (!goal || goal.trim().length === 0) {
    return res.status(400).json({ error: 'Goal is required' });
  }
  
  // Simulate API delay
  setTimeout(() => {
    const suggestions = [
      `Initial research on ${goal}`,
      `Break down ${goal} into phases`,
      `Execute first phase of ${goal}`,
      `Review and finalize ${goal}`,
      `Document and share results`
    ];
    
    res.json({ suggestions });
  }, 1000);
});

// --- ERROR HANDLING ---

/**
 * 404 Not Found Handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- SERVER STARTUP ---
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🎯 Ethereal Tasks Server Running     ║
║                                        ║
║   Server:   http://localhost:${PORT}    ║
║   Database: mongodb://127.0.0.1:27017  ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});

module.exports = app;
