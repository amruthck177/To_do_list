/**
 * Zinc Minimalist To-do List v3.1
 */

const API_URL = 'http://localhost:3001/api/tasks';
let tasks = [];
let currentFilter = 'all';
let isUpdatingOrder = false;
let isPolling = true;

// Selector State
let selectedPriority = 'medium';
let selectedTag = 'none';

const elements = {
  todoList: document.getElementById('todo-list'),
  todoInput: document.getElementById('todo-input'),
  todoDate: document.getElementById('todo-date'),
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
  tagSelector: document.getElementById('tag-selector'),
  currentTag: document.getElementById('current-tag'),
  tagOptions: document.querySelector('.dropdown-options'),
  priorityPills: document.querySelectorAll('.priority-pills .pill'),
};

const init = async () => {
  setupEventListeners();
  setupCustomSelectors();
  if (typeof Sortable !== 'undefined') setupSortable();
  loadTheme();
  await fetchTasks();
  if (elements.loadingOverlay) elements.loadingOverlay.classList.add('fade-out');

  setInterval(() => {
    if (isPolling && !isUpdatingOrder && !isInputFocused()) fetchTasks(true);
  }, 5000);
};

const isInputFocused = () => document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');

const setupCustomSelectors = () => {
  elements.priorityPills.forEach(pill => {
    pill.addEventListener('click', () => {
      elements.priorityPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedPriority = pill.dataset.value;
    });
  });

  elements.tagSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.tagOptions.classList.toggle('hidden');
  });

  document.querySelectorAll('.option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedTag = opt.dataset.value;
      elements.currentTag.innerText = opt.innerText;
      elements.tagOptions.classList.add('hidden');
    });
  });

  document.addEventListener('click', () => elements.tagOptions.classList.add('hidden'));
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
  const newOrders = itemEls.map((el, index) => ({ id: parseInt(el.dataset.id), order: index }));
  newOrders.forEach(({ id, order }) => {
    const t = tasks.find(x => x.id === id);
    if (t) t.order = order;
  });
  try {
    await fetch(`${API_URL}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: newOrders })
    });
  } catch (err) { console.error(err); } finally { isUpdatingOrder = false; }
};

const fetchTasks = async (isBg = false) => {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (JSON.stringify(data) !== JSON.stringify(tasks)) {
      tasks = data;
      renderTasks();
    }
  } catch (err) {
    if (!isBg) {
      tasks = JSON.parse(localStorage.getItem('todolist_zinc')) || [];
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
    const data = await res.json();
    tasks.unshift(data);
    syncLocal();
    renderTasks();
    showNotification('Task Added', 'success');
  } catch (err) { showNotification('Error adding task', 'error'); }
};

const updateTaskInDB = async (id, updates) => {
  const i = tasks.findIndex(t => t.id === id);
  if (i !== -1) {
    tasks[i] = { ...tasks[i], ...updates };
    renderTasks();
    try {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      syncLocal();
    } catch (err) { fetchTasks(); }
  }
};

const deleteTask = async (id) => {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();
  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    syncLocal();
  } catch (err) { fetchTasks(); }
};

const syncLocal = () => localStorage.setItem('todolist_zinc', JSON.stringify(tasks));

const renderTasks = () => {
  const query = elements.searchInput.value.toLowerCase();
  const filtered = tasks.filter(t => {
    const mSearch = t.text.toLowerCase().includes(query) || (t.tag && t.tag.toLowerCase().includes(query));
    const mTab = currentFilter === 'all' || (currentFilter === 'pending' && !t.completed) || (currentFilter === 'completed' && t.completed);
    return mSearch && mTab;
  }).sort((a, b) => (a.order || 0) - (b.order || 0));

  elements.todoList.innerHTML = '';
  filtered.forEach(t => elements.todoList.appendChild(createTaskElement(t)));
  updateStats();
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

const createTaskElement = (task) => {
  const li = document.createElement('li');
  li.className = `todo-item ${task.priority} ${task.completed ? 'completed' : ''}`;
  li.dataset.id = task.id;

  const dateStr = task.date ? new Date(task.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const tagHtml = task.tag && task.tag !== 'none' ? `<span class="badge">${task.tag}</span>` : '';

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
      <button class="icon-btn delete" title="Delete"><i data-lucide="trash-2"></i></button>
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

const loadTheme = () => {
  const saved = localStorage.getItem('todo-theme-zinc') || 'theme-midnight';
  document.body.className = saved;
};

const setTheme = (theme) => {
  document.body.className = theme;
  localStorage.setItem('todo-theme-zinc', theme);
  elements.themeModal.classList.add('hidden');
};

const showNotification = (msg, type = 'info') => {
  const c = document.querySelector('.notification-container') || (() => {
    const div = document.createElement('div');
    div.className = 'notification-container';
    document.body.appendChild(div);
    return div;
  })();
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.innerText = msg;
  c.appendChild(n);
  setTimeout(() => { n.style.opacity = '0'; setTimeout(() => n.remove(), 500); }, 3000);
};

const setupEventListeners = () => {
  elements.addBtn.addEventListener('click', () => {
    const text = elements.todoInput.value.trim();
    if (text) {
      saveTask({ text, date: elements.todoDate.value, tag: selectedTag, priority: selectedPriority, completed: false });
      elements.todoInput.value = '';
      selectedTag = 'none';
      elements.currentTag.innerText = 'No Tag';
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
