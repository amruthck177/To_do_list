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
  const db = readDB();
  res.json(db.tasks);
});

app.post('/api/tasks', (req, res) => {
  const db = readDB();
  const newTask = {
    id: Date.now(),
    ...req.body,
    createdAt: new Date().toISOString()
  };
  db.tasks.unshift(newTask);
  writeDB(db);
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  const index = db.tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    db.tasks[index] = { ...db.tasks[index], ...req.body };
    writeDB(db);
    res.json(db.tasks[index]);
  } else {
    res.status(404).send('Task not found');
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  const db = readDB();
  const id = parseInt(req.params.id);
  db.tasks = db.tasks.filter(t => t.id !== id);
  writeDB(db);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
