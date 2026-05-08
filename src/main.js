/**
 * ZenTask Pro v2.1
 * Advanced Persistence & Sub-tasks
 */

const API_URL = 'http://localhost:3001/api/tasks';
let tasks = [];
let currentFilter = 'all';
let focusTimerInterval = null;
let focusTimeRemaining = 25 * 60;
let sortable = null;
let isUpdatingOrder = false;

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
};

const setupSortable = () => {
  sortable = new Sortable(elements.todoList, {
    animation: 250,
    ghostClass: 'dragging',
    handle: '.todo-content', // Only drag by content area
    onEnd: async () => {
      await persistNewOrder();
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

  // Optimistic update of local tasks
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
    showNotification('Order saved', 'success');
  } catch (err) {
    console.error('Failed to save order:', err);
    showNotification('Order sync failed', 'error');
  } finally {
    isUpdatingOrder = false;
  }
};

// --- API Calls ---

const fetchTasks = async () => {
  if (isUpdatingOrder) return; // Don't fetch while we are reordering
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
    showNotification('Mission Launched', 'success');
  } catch (err) {
    console.error('Save failed:', err);
    showNotification('Failed to launch mission', 'error');
  }
};

const updateTaskInDB = async (id, updates) => {
  // Optimistic UI Update
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    const oldTask = { ...tasks[index] };
    tasks[index] = { ...tasks[index], ...updates };
    renderTasks();

    try {
      await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      syncLocalStorage();
    } catch (err) {
      console.error('Update failed, rolling back:', err);
      tasks[index] = oldTask;
      renderTasks();
      showNotification('Sync failed', 'error');
    }
  }
};

const deleteTask = async (id) => {
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    const deletedTask = tasks[index];
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();

    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      syncLocalStorage();
      showNotification('Mission Aborted', 'info');
    } catch (err) {
      console.error('Delete failed, rolling back:', err);
      tasks.splice(index, 0, deletedTask);
      renderTasks();
      showNotification('Abort failed', 'error');
    }
  }
};

const syncLocalStorage = () => {
  localStorage.setItem('zentasks_v2', JSON.stringify(tasks));
};

// --- Logic ---

const getFilteredTasks = () => {
  const query = elements.searchInput.value.toLowerCase();
  return tasks.filter(t => {
    const matchesSearch = t.text.toLowerCase().includes(query) || 
                         (t.tag && t.tag.toLowerCase().includes(query));
    const matchesTab = currentFilter === 'all' || 
                       (currentFilter === 'pending' && !t.completed) || 
                       (currentFilter === 'completed' && t.completed);
    return matchesSearch && matchesTab;
  }).sort((a, b) => (a.order || 0) - (b.order || 0));
};

const renderTasks = () => {
  const filtered = getFilteredTasks();
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
  
  // Sub-tasks summary
  const totalSub = task.subtasks?.length || 0;
  const doneSub = task.subtasks?.filter(s => s.completed).length || 0;
  const subHtml = totalSub > 0 ? `<span class="badge sub-badge"><i data-lucide="layers" style="width:10px"></i> ${doneSub}/${totalSub}</span>` : '';

  li.innerHTML = `
    <div class="todo-checkbox">
      <i data-lucide="check"></i>
    </div>
    <div class="todo-content">
      <div class="todo-main-row">
        <span class="todo-title">${task.text}</span>
        <div class="todo-details">
          <span class="badge priority-${task.priority}">${task.priority}</span>
          ${tagHtml}
          ${subHtml}
          ${dateStr ? `<span><i data-lucide="calendar" style="width:10px;display:inline"></i> ${dateStr}</span>` : ''}
        </div>
      </div>
      <div class="subtask-container hidden" id="subtasks-${task.id}">
        <ul class="subtask-list">
          ${(task.subtasks || []).map(s => `
            <li class="subtask-item ${s.completed ? 'done' : ''}" data-sid="${s.id}">
              <div class="sub-check ${s.completed ? 'checked' : ''}"></div>
              <span>${s.text}</span>
              <button class="sub-del"><i data-lucide="x"></i></button>
            </li>
          `).join('')}
        </ul>
        <div class="subtask-add">
          <input type="text" placeholder="Add sub-task..." class="sub-input" />
          <button class="sub-add-btn"><i data-lucide="plus"></i></button>
        </div>
      </div>
    </div>
    <div class="item-actions">
      <button class="action-btn toggle-sub" title="Sub-tasks">
        <i data-lucide="chevron-down"></i>
      </button>
      <button class="action-btn delete" title="Delete Task">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  // --- Sub-task Events ---
  const toggleSubBtn = li.querySelector('.toggle-sub');
  const subContainer = li.querySelector('.subtask-container');
  
  toggleSubBtn.addEventListener('click', () => {
    subContainer.classList.toggle('hidden');
    toggleSubBtn.querySelector('i').style.transform = subContainer.classList.contains('hidden') ? 'rotate(0)' : 'rotate(180deg)';
  });

  // Add Sub-task
  const subInput = li.querySelector('.sub-input');
  const subAddBtn = li.querySelector('.sub-add-btn');
  const addSub = () => {
    const text = subInput.value.trim();
    if (text) {
      const newSub = { id: Date.now(), text, completed: false };
      const updatedSubtasks = [...(task.subtasks || []), newSub];
      updateTaskInDB(task.id, { subtasks: updatedSubtasks });
    }
  };
  subAddBtn.addEventListener('click', addSub);
  subInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSub(); });

  // Toggle Sub-task
  li.querySelectorAll('.subtask-item').forEach(sEl => {
    const sid = parseInt(sEl.dataset.sid);
    sEl.querySelector('.sub-check').addEventListener('click', () => {
      const updated = task.subtasks.map(s => s.id === sid ? { ...s, completed: !s.completed } : s);
      updateTaskInDB(task.id, { subtasks: updated });
    });
    sEl.querySelector('.sub-del').addEventListener('click', () => {
      const updated = task.subtasks.filter(s => s.id !== sid);
      updateTaskInDB(task.id, { subtasks: updated });
    });
  });

  // --- Main Task Events ---
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
      completed: false,
      subtasks: []
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
    showNotification('No active missions found', 'info');
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
      showNotification('Focus session complete!', 'success');
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

// Background sync (polling) - Only fetch if not reordering
setInterval(fetchTasks, 5000);
