/**
 * ZenTask Pro v2.0
 * Premium Productivity Suite
 */

const API_URL = 'http://localhost:3001/api/tasks';
let tasks = [];
let currentFilter = 'all';
let focusTimerInterval = null;
let focusTimeRemaining = 25 * 60;
let sortable = null;

// DOM Elements
const elements = {
  todoList: document.getElementById('todo-list'),
  todoInput: document.getElementById('todo-input'),
  todoDate: document.getElementById('todo-date'),
  todoTime: document.getElementById('todo-time'),
  todoTag: document.getElementById('todo-tag'),
  todoPriority: document.getElementById('todo-priority'),
  addBtn: document.getElementById('add-btn'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  pendingCount: document.getElementById('pending-count'),
  urgentCount: document.getElementById('urgent-count'),
  doneCount: document.getElementById('done-count'),
  searchInput: document.getElementById('search-input'),
  filterTabs: document.querySelectorAll('.tab'),
  themeBtn: document.getElementById('theme-btn'),
  themeModal: document.getElementById('theme-modal'),
  closeThemeModal: document.getElementById('close-theme-modal'),
  themeOptions: document.querySelectorAll('.theme-option'),
  focusToggle: document.getElementById('focus-toggle'),
  focusOverlay: document.getElementById('focus-overlay'),
  focusTimer: document.getElementById('focus-timer'),
  focusExit: document.getElementById('focus-exit'),
  focusComplete: document.getElementById('focus-complete'),
  focusTaskTitle: document.getElementById('focus-task-title'),
};

// --- Initialization ---

const init = async () => {
  setupEventListeners();
  setupSortable();
  loadTheme();
  await fetchTasks();
  lucide.createIcons();
};

const setupSortable = () => {
  sortable = new Sortable(elements.todoList, {
    animation: 150,
    ghostClass: 'dragging',
    onEnd: () => {
      // Logic for persisting manual sort could go here
      // For now, we just allow the visual reorder
    }
  });
};

// --- API Calls ---

const fetchTasks = async () => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Network response was not ok');
    tasks = await res.json();
    renderTasks();
  } catch (err) {
    console.error('Fetch failed, using local fallback:', err);
    tasks = JSON.parse(localStorage.getItem('zentasks_v2')) || [];
    renderTasks();
  }
};

const saveTask = async (task) => {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    const newTask = await res.json();
    tasks.unshift(newTask);
    syncLocalStorage();
    renderTasks();
  } catch (err) {
    console.error('Save failed:', err);
  }
};

const updateTaskInDB = async (id, updates) => {
  try {
    await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) tasks[index] = { ...tasks[index], ...updates };
    syncLocalStorage();
    renderTasks();
  } catch (err) {
    console.error('Update failed:', err);
  }
};

const deleteTask = async (id) => {
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    tasks = tasks.filter(t => t.id !== id);
    syncLocalStorage();
    renderTasks();
  } catch (err) {
    console.error('Delete failed:', err);
  }
};

const syncLocalStorage = () => {
  localStorage.setItem('zentasks_v2', JSON.stringify(tasks));
};

// --- Logic ---

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

const renderTasks = () => {
  const sorted = getSortedTasks();
  const filtered = sorted.filter(t => {
    const query = elements.searchInput.value.toLowerCase();
    const matchesSearch = t.text.toLowerCase().includes(query) || 
                         (t.tag && t.tag.toLowerCase().includes(query));
    const matchesTab = currentFilter === 'all' || 
                       (currentFilter === 'pending' && !t.completed) || 
                       (currentFilter === 'completed' && t.completed);
    return matchesSearch && matchesTab;
  });

  elements.todoList.innerHTML = '';
  filtered.forEach(task => {
    const li = createTaskElement(task);
    elements.todoList.appendChild(li);
  });

  updateStats();
  lucide.createIcons();
};

const createTaskElement = (task) => {
  const li = document.createElement('li');
  li.className = `todo-item ${task.priority} ${task.completed ? 'completed' : ''}`;
  li.dataset.id = task.id;

  const dateStr = task.date ? new Date(task.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const tagHtml = task.tag && task.tag !== 'none' ? `<span class="badge tag-badge">${task.tag}</span>` : '';

  li.innerHTML = `
    <div class="todo-checkbox">
      <i data-lucide="check"></i>
    </div>
    <div class="todo-content">
      <span class="todo-title">${task.text}</span>
      <div class="todo-details">
        <span class="badge priority-${task.priority}">${task.priority}</span>
        ${tagHtml}
        ${dateStr ? `<span><i data-lucide="calendar" style="width:10px;display:inline"></i> ${dateStr} ${task.time || ''}</span>` : ''}
      </div>
    </div>
    <div class="item-actions">
      <button class="action-btn delete" title="Delete Task">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  // Attach events directly to avoid global scope pollution
  li.querySelector('.todo-checkbox').addEventListener('click', () => toggleTask(task.id));
  li.querySelector('.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  return li;
};

const updateStats = () => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const urgent = tasks.filter(t => t.priority === 'high' && !t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  elements.pendingCount.innerText = pending;
  elements.urgentCount.innerText = urgent;
  elements.doneCount.innerText = completed;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.innerText = `${percent}%`;
};

// --- Actions ---

const toggleTask = (id) => {
  const task = tasks.find(t => t.id === id);
  if (task) {
    updateTaskInDB(id, { completed: !task.completed });
  }
};

const handleAddTask = () => {
  const text = elements.todoInput.value.trim();
  if (text) {
    const newTask = {
      text,
      date: elements.todoDate.value,
      time: elements.todoTime.value,
      tag: elements.todoTag.value,
      priority: elements.todoPriority.value,
      completed: false
    };
    saveTask(newTask);
    elements.todoInput.value = '';
    elements.todoDate.value = '';
    elements.todoTime.value = '';
    elements.todoTag.value = 'none';
    elements.todoPriority.value = 'medium';
  }
};

// --- Theme Management ---

const loadTheme = () => {
  const savedTheme = localStorage.getItem('zentask-theme') || 'theme-midnight';
  document.body.className = savedTheme;
};

const setTheme = (theme) => {
  document.body.className = theme;
  localStorage.setItem('zentask-theme', theme);
  elements.themeModal.classList.add('hidden');
};

// --- Focus Mode ---

const startFocusMode = () => {
  const topTask = tasks.find(t => !t.completed && t.priority === 'high') || tasks.find(t => !t.completed);
  if (!topTask) {
    showNotification('No active missions found. Add a task to start focusing.', 'info');
    return;
  }
  
  elements.focusTaskTitle.innerText = topTask.text;
  elements.focusOverlay.classList.remove('hidden');
  
  focusTimeRemaining = 25 * 60;
  updateTimerDisplay();
  
  focusTimerInterval = setInterval(() => {
    focusTimeRemaining--;
    updateTimerDisplay();
    if (focusTimeRemaining <= 0) {
      clearInterval(focusTimerInterval);
      showNotification('Focus session complete! Take a break.', 'success');
    }
  }, 1000);
};

const updateTimerDisplay = () => {
  const mins = Math.floor(focusTimeRemaining / 60);
  const secs = focusTimeRemaining % 60;
  elements.focusTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- Notifications ---

const notifyContainer = document.createElement('div');
notifyContainer.className = 'notification-container';
document.body.appendChild(notifyContainer);

const showNotification = (msg, type = 'info') => {
  const notify = document.createElement('div');
  notify.className = `notification ${type}`;
  
  const icons = {
    success: 'check-circle',
    info: 'info',
    error: 'alert-circle'
  };

  notify.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}"></i>
    <span>${msg}</span>
  `;
  
  notifyContainer.appendChild(notify);
  lucide.createIcons();

  setTimeout(() => {
    notify.classList.add('fade-out');
    setTimeout(() => notify.remove(), 500);
  }, 4000);
};

// --- Event Listeners ---

const setupEventListeners = () => {
  elements.addBtn.addEventListener('click', handleAddTask);
  elements.todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleAddTask(); });
  elements.searchInput.addEventListener('input', renderTasks);

  elements.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTasks();
    });
  });

  elements.themeBtn.addEventListener('click', () => elements.themeModal.classList.remove('hidden'));
  elements.closeThemeModal.addEventListener('click', () => elements.themeModal.classList.add('hidden'));
  elements.themeOptions.forEach(opt => {
    opt.addEventListener('click', () => setTheme(opt.dataset.theme));
  });

  elements.focusToggle.addEventListener('click', startFocusMode);
  elements.focusExit.addEventListener('click', () => {
    clearInterval(focusTimerInterval);
    elements.focusOverlay.classList.add('hidden');
  });
  
  elements.focusComplete.addEventListener('click', () => {
    const currentTitle = elements.focusTaskTitle.innerText;
    const task = tasks.find(t => t.text === currentTitle && !t.completed);
    if (task) toggleTask(task.id);
    clearInterval(focusTimerInterval);
    elements.focusOverlay.classList.add('hidden');
  });
};

// Start the app
init();
