/**
 * Simple & Elegant To-do List
 * Core Functionality with Robust Sync
 */

const API_URL = 'http://localhost:3001/api/tasks';
let tasks = [];
let currentFilter = 'all';
let isUpdatingOrder = false;
let isPolling = true;

const elements = {
  todoList: document.getElementById('todo-list'),
  todoInput: document.getElementById('todo-input'),
  todoDate: document.getElementById('todo-date'),
  todoTag: document.getElementById('todo-tag'),
  todoPriority: document.getElementById('todo-priority'),
  addBtn: document.getElementById('add-btn'),
  progressFill: document.getElementById('progress-fill'),
  pendingCount: document.getElementById('pending-count'),
  searchInput: document.getElementById('search-input'),
  filterTabs: document.querySelectorAll('.tab'),
  themeBtn: document.getElementById('theme-btn'),
  themeModal: document.getElementById('theme-modal'),
  closeThemeModal: document.getElementById('close-theme-modal'),
  themeOptions: document.querySelectorAll('.theme-option'),
  loadingOverlay: document.getElementById('loading-overlay'),
};

// --- Initialization ---

const init = async () => {
  setupEventListeners();
  if (typeof Sortable !== 'undefined') setupSortable();
  loadTheme();
  
  await fetchTasks();
  
  if (elements.loadingOverlay) elements.loadingOverlay.classList.add('fade-out');

  // Background Sync
  setInterval(() => {
    if (isPolling && !isUpdatingOrder && !isInputFocused()) {
      fetchTasks(true);
    }
  }, 5000);
};

const isInputFocused = () => {
  return document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');
};

const setupSortable = () => {
  new Sortable(elements.todoList, {
    animation: 200,
    ghostClass: 'dragging',
    onStart: () => { isPolling = false; },
    onEnd: async () => {
      await persistNewOrder();
      isPolling = true;
    }
  });
};

const persistNewOrder = async () => {
  if (isUpdatingOrder) return;
  isUpdatingOrder = true;

  const itemEls = Array.from(elements.todoList.querySelectorAll('.todo-item'));
  const newOrders = itemEls.map((el, index) => ({
    id: parseInt(el.dataset.id),
    order: index
  }));

  newOrders.forEach(({ id, order }) => {
    const task = tasks.find(t => t.id === id);
    if (task) task.order = order;
  });

  try {
    await fetch(`${API_URL}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: newOrders })
    });
  } catch (err) {
    console.error('Order sync failed:', err);
  } finally {
    isUpdatingOrder = false;
  }
};

// --- API & State ---

const fetchTasks = async (isBackground = false) => {
  try {
    const res = await fetch(API_URL);
    const newTasks = await res.json();
    if (JSON.stringify(newTasks) !== JSON.stringify(tasks)) {
      tasks = newTasks;
      renderTasks();
    }
  } catch (err) {
    if (!isBackground) {
      tasks = JSON.parse(localStorage.getItem('todolist_v1')) || [];
      renderTasks();
    }
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
    syncLocal();
    renderTasks();
    showNotification('Task added', 'success');
  } catch (err) {
    showNotification('Failed to add task', 'error');
  }
};

const updateTaskInDB = async (id, updates) => {
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    tasks[index] = { ...tasks[index], ...updates };
    renderTasks();
    try {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      syncLocal();
    } catch (err) {
      fetchTasks();
    }
  }
};

const deleteTask = async (id) => {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    syncLocal();
    showNotification('Task deleted');
  } catch (err) {
    fetchTasks();
  }
};

const syncLocal = () => localStorage.setItem('todolist_v1', JSON.stringify(tasks));

// --- Rendering ---

const renderTasks = () => {
  const query = elements.searchInput.value.toLowerCase();
  const filtered = tasks.filter(t => {
    const matchesSearch = t.text.toLowerCase().includes(query) || (t.tag && t.tag.toLowerCase().includes(query));
    const matchesTab = currentFilter === 'all' || 
                       (currentFilter === 'pending' && !t.completed) || 
                       (currentFilter === 'completed' && t.completed);
    return matchesSearch && matchesTab;
  }).sort((a, b) => (a.order || 0) - (b.order || 0));

  elements.todoList.innerHTML = '';
  filtered.forEach(task => {
    const li = createTaskElement(task);
    elements.todoList.appendChild(li);
  });

  updateStats();
  if (typeof lucide !== 'undefined') lucide.createIcons();
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
      <div class="todo-main-row">
        <span class="todo-title">${task.text}</span>
        <div class="todo-details">
          <span class="priority-${task.priority}">${task.priority}</span>
          ${tagHtml}
          ${dateStr ? `<span>${dateStr}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="item-actions">
      <button class="icon-btn delete" title="Delete">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  li.querySelector('.todo-checkbox').addEventListener('click', () => updateTaskInDB(task.id, { completed: !task.completed }));
  li.querySelector('.delete').addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });

  return li;
};

const updateStats = () => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  if (elements.pendingCount) elements.pendingCount.innerText = pending;
  if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
};

// --- UI Logic ---

const loadTheme = () => {
  const saved = localStorage.getItem('todo-theme') || 'theme-midnight';
  document.body.className = saved;
};

const setTheme = (theme) => {
  document.body.className = theme;
  localStorage.setItem('todo-theme', theme);
  elements.themeModal.classList.add('hidden');
};

const showNotification = (msg, type = 'info') => {
  const notifyContainer = document.querySelector('.notification-container') || (() => {
    const c = document.createElement('div');
    c.className = 'notification-container';
    document.body.appendChild(c);
    return c;
  })();
  const notify = document.createElement('div');
  notify.className = `notification ${type}`;
  notify.innerHTML = `<span>${msg}</span>`;
  notifyContainer.appendChild(notify);
  setTimeout(() => { notify.classList.add('fade-out'); setTimeout(() => notify.remove(), 500); }, 3000);
};

const setupEventListeners = () => {
  elements.addBtn.addEventListener('click', () => {
    const text = elements.todoInput.value.trim();
    if (text) {
      saveTask({
        text,
        date: elements.todoDate.value,
        tag: elements.todoTag.value,
        priority: elements.todoPriority.value,
        completed: false
      });
      elements.todoInput.value = '';
    }
  });

  elements.todoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.addBtn.click(); });
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
  elements.themeOptions.forEach(opt => opt.addEventListener('click', () => setTheme(opt.dataset.theme)));
};

init();
