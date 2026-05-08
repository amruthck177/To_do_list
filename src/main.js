// ZenTask Pro - Full-Stack Implementation
const API_URL = 'http://localhost:3001/api/tasks';

let tasks = [];
let currentFilter = 'all';
let focusTimerInterval = null;

// UI Elements
const todoList = document.getElementById('todo-list');
const todoInput = document.getElementById('todo-input');
const todoDate = document.getElementById('todo-date');
const todoTime = document.getElementById('todo-time');
const todoPriority = document.getElementById('todo-priority');
const addBtn = document.getElementById('add-btn');
const progressFill = document.getElementById('progress-fill');
const pendingCount = document.getElementById('pending-count');
const urgentCount = document.getElementById('urgent-count');
const doneCount = document.getElementById('done-count');
const searchInput = document.getElementById('search-input');
const filterTabs = document.querySelectorAll('.tab');

// Focus Elements
const focusToggle = document.getElementById('focus-toggle');
const focusOverlay = document.getElementById('focus-overlay');
const focusTimer = document.getElementById('focus-timer');
const focusExit = document.getElementById('focus-exit');
const focusComplete = document.getElementById('focus-complete');
const focusTaskTitle = document.getElementById('focus-task-title');

// Fetch Tasks from Backend
const fetchTasks = async () => {
  try {
    const res = await fetch(API_URL);
    tasks = await res.json();
    renderTasks();
  } catch (err) {
    console.error('Failed to fetch tasks:', err);
    // Fallback to local storage if server is down
    tasks = JSON.parse(localStorage.getItem('zentasks_v3')) || [];
    renderTasks();
  }
};

// Save Task to Backend
const saveTask = async (task) => {
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    fetchTasks();
  } catch (err) {
    console.error('Failed to save task:', err);
  }
};

// Update Task in Backend
const updateTaskInDB = async (id, updates) => {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    fetchTasks();
  } catch (err) {
    console.error('Failed to update task:', err);
  }
};

// Delete Task from Backend
const deleteTask = async (id) => {
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    fetchTasks();
  } catch (err) {
    console.error('Failed to delete task:', err);
  }
};

// Smart Sorting
const getSortedTasks = () => {
  const priorityMap = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (priorityMap[a.priority] !== priorityMap[b.priority]) {
      return priorityMap[a.priority] - priorityMap[b.priority];
    }
    return new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31');
  });
};

// Render Logic
const renderTasks = () => {
  const sorted = getSortedTasks();
  const filtered = sorted.filter(t => {
    const matchesSearch = t.text.toLowerCase().includes(searchInput.value.toLowerCase());
    const matchesTab = currentFilter === 'all' || 
                       (currentFilter === 'pending' && !t.completed) || 
                       (currentFilter === 'completed' && t.completed);
    return matchesSearch && matchesTab;
  });

  todoList.innerHTML = '';
  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = `todo-item ${task.priority} ${task.completed ? 'completed' : ''}`;
    
    const dateStr = task.date ? new Date(task.date).toLocaleDateString() : 'No date';
    const timeStr = task.time || '';

    li.innerHTML = `
      <div class="checkbox-pro" onclick="toggleTask(${task.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="todo-main-info">
        <span class="todo-text">${task.text}</span>
        <div class="todo-meta">
          <span class="priority-tag ${task.priority}">${task.priority}</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
      </div>
      <button class="delete-pro" onclick="removeTask(${task.id})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
      </button>
    `;
    todoList.appendChild(li);
  });

  updateStats();
};

const updateStats = () => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const urgent = tasks.filter(t => t.priority === 'high' && !t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  pendingCount.innerText = pending;
  urgentCount.innerText = urgent;
  doneCount.innerText = completed;
  progressFill.style.width = `${percent}%`;
};

// Event Handlers
const addTask = () => {
  const text = todoInput.value.trim();
  if (text) {
    const newTask = {
      text,
      date: todoDate.value,
      time: todoTime.value,
      priority: todoPriority.value,
      completed: false
    };
    saveTask(newTask);
    todoInput.value = '';
    todoDate.value = '';
    todoTime.value = '';
  }
};

window.toggleTask = (id) => {
  const task = tasks.find(t => t.id === id);
  if (task) {
    updateTaskInDB(id, { completed: !task.completed });
  }
};

window.removeTask = (id) => {
  deleteTask(id);
};

// Filter & Search
searchInput.addEventListener('input', renderTasks);
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderTasks();
  });
});

addBtn.addEventListener('click', addTask);
todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

// Focus Mode Logic
let focusTimeRemaining = 25 * 60;
const startFocusMode = () => {
  const topTask = tasks.find(t => !t.completed && t.priority === 'high') || tasks.find(t => !t.completed);
  if (!topTask) {
    alert('Add some missions first!');
    return;
  }
  
  focusTaskTitle.innerText = `Focus: ${topTask.text}`;
  focusOverlay.classList.remove('hidden');
  
  focusTimeRemaining = 25 * 60;
  updateTimerDisplay();
  
  focusTimerInterval = setInterval(() => {
    focusTimeRemaining--;
    updateTimerDisplay();
    if (focusTimeRemaining <= 0) {
      clearInterval(focusTimerInterval);
      alert('Focus session complete!');
    }
  }, 1000);
};

const updateTimerDisplay = () => {
  const mins = Math.floor(focusTimeRemaining / 60);
  const secs = focusTimeRemaining % 60;
  focusTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

focusToggle.addEventListener('click', startFocusMode);
focusExit.addEventListener('click', () => {
  clearInterval(focusTimerInterval);
  focusOverlay.classList.add('hidden');
});
focusComplete.addEventListener('click', () => {
  const topTask = tasks.find(t => !t.completed && t.priority === 'high') || tasks.find(t => !t.completed);
  if (topTask) {
    updateTaskInDB(topTask.id, { completed: true });
  }
  clearInterval(focusTimerInterval);
  focusOverlay.classList.add('hidden');
});

// Init
fetchTasks();
setInterval(fetchTasks, 5000); // Polling for "strong" backend updates
