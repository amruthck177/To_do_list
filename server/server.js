const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(bodyParser.json());

// Helper to read DB
const readDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ tasks: [] }));
  }
  const data = fs.readFileSync(DB_FILE);
  return JSON.parse(data);
};

// Helper to write DB
const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Routes
app.get('/api/tasks', (req, res) => {
  try {
    const db = readDB();
    // Sort by order field if it exists, otherwise use ID
    const sortedTasks = db.tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(sortedTasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read tasks' });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const db = readDB();
    const newTask = {
      id: Date.now(),
      text: req.body.text || 'Untitled Mission',
      date: req.body.date || '',
      time: req.body.time || '',
      tag: req.body.tag || 'none',
      priority: req.body.priority || 'medium',
      completed: req.body.completed || false,
      subtasks: req.body.subtasks || [],
      order: db.tasks.length > 0 ? Math.min(...db.tasks.map(t => t.order || 0)) - 1 : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.tasks.unshift(newTask);
    writeDB(db);
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

app.put('/api/tasks/reorder', (req, res) => {
  try {
    const { orders } = req.body; // Array of {id, order}
    const db = readDB();
    
    orders.forEach(({ id, order }) => {
      const task = db.tasks.find(t => t.id === id);
      if (task) {
        task.order = order;
        task.updatedAt = new Date().toISOString();
      }
    });

    writeDB(db);
    res.json({ message: 'Order updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder tasks' });
  }
});

app.put('/api/tasks/:id', (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    const index = db.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      db.tasks[index] = { 
        ...db.tasks[index], 
        ...req.body, 
        updatedAt: new Date().toISOString() 
      };
      writeDB(db);
      res.json(db.tasks[index]);
    } else {
      res.status(404).send('Task not found');
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const db = readDB();
    const id = parseInt(req.params.id);
    db.tasks = db.tasks.filter(t => t.id !== id);
    writeDB(db);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
