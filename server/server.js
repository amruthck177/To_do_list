const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/todoapp')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('MongoDB Connection Error:', err));

// Task Schema
const taskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  date: { type: String, default: '' },
  time: { type: String, default: '' },
  category: { type: String, default: 'none' }, // work, personal, health, etc.
  priority: { type: String, default: 'medium' }, // low, medium, high, urgent
  completed: { type: Boolean, default: false },
  subtasks: { type: Array, default: [] },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// Routes
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ order: 1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read tasks' });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const count = await Task.countDocuments();
    const newTask = new Task({
      ...req.body,
      order: count > 0 ? -(count + 1) : 0 // Ensure it appears at top
    });
    const savedTask = await newTask.save();
    res.status(201).json(savedTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const { orders } = req.body; // Array of {_id, order}
    for (let { _id, order } of orders) {
      await Task.findByIdAndUpdate(_id, { order });
    }
    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (updatedTask) {
      res.json(updatedTask);
    } else {
      res.status(404).send('Task not found');
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// AI Mock Endpoint
app.post('/api/ai/suggest', (req, res) => {
  const { goal } = req.body;
  if (!goal) return res.status(400).json({ error: 'Goal is required' });
  
  setTimeout(() => {
    res.json({
      suggestions: [
        `Initial research on ${goal}`,
        `Break down ${goal} into phases`,
        `Execute first phase of ${goal}`,
        `Review and finalize`
      ]
    });
  }, 1000); // simulate delay
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
