/**
 * ZenTask Pro v2.2
 * Robustness & Sync Optimization
 */

const API_URL = 'http://localhost:3001/api/tasks';
let tasks = [];
let currentFilter = 'all';
let focusTimerInterval = null;
let focusTimeRemaining = 25 * 60;
let sortable = null;
let isUpdatingOrder = false;
let isPolling = true;

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
  console.log('ZenTask Pro: Initializing...');
  
  // Verify dependencies
  if (typeof Sortable === 'undefined') {
    console.warn('SortableJS not loaded from CDN, drag-and-drop disabled');
  }
  
  setupEventListeners();
  if (typeof Sortable !== 'undefined') setupSortable();
  loadTheme();
  
  await fetchTasks();
  
  // Hide Loading Overlay
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.classList.add('fade-out');

  // Start Polling
  setInterval(() => {
    if (isPolling && !isUpdatingOrder && !isInputFocused()) {
      fetchTasks(true); // Background fetch
    }
  }, 5000);

  console.log('ZenTask Pro: Ready.');
};

const isInputFocused = () => {
  return document.activeElement && 
         (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'SELECT' || 
          document.activeElement.tagName === 'TEXTAREA');
};

const setupSortable = () => {
  sortable = new Sortable(elements.todoList, {
    animation: 250,
    ghostClass: 'dragging',
    handle: '.todo-content',
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

  // Optimistic update
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
    console.error('Failed to save order:', err);
    showNotification('Order sync failed', 'error');
  } finally {
    isUpdatingOrder = false;
  }
};

// --- API Calls ---

const fetchTasks = async (isBackground = false) => {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Network response was not ok');
    const newTasks = await res.json();
    
    // Check if tasks actually changed to avoid unnecessary re-renders
    if (JSON.stringify(newTasks) !== JSON.stringify(tasks)) {
      tasks = newTasks;
      renderTasks();
      if (isBackground) console.log('ZenTask Pro: Background sync complete.');
    }
  } catch (err) {
    if (!isBackground) {
      console.error('Fetch failed, using local fallback:', err);
      tasks = JSON.parse(localStorage.getItem('zentasks_v2')) || [];
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
    syncLocalStorage();
    renderTasks();
    showNotification('Mission Launched', 'success');
  } catch (err) {
    console.error('Save failed:', err);
    showNotification('Failed to launch mission', 'error');
  }
};

const updateTaskInDB = async (id, updates) => {
  const index = tasks.findIndex(t => t.id === id);
  if (index !== -1) {
    // Optimistic Update
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
      console.error('Update failed:', err);
      showNotification('Sync failed', 'error');
      fetchTasks(); // Rollback to server state
    }
  }
};

const deleteTask = async (id) => {
  tasks = tasks.filter(t => t.id !== id);
  renderTasks();

  try {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    syncLocalStorage();
    showNotification('Mission Aborted', 'info');
  } catch (err) {
    console.error('Delete failed:', err);
    showNotification('Abort failed', 'error');
    fetchTasks(); // Rollback
  }
};

const syncLocalStorage = () => {
  localStorage.setItem('zentasks_v2', JSON.stringify(tasks));
};

// --- Logic ---

const renderTasks = () => {
  const query = elements.searchInput.value.toLowerCase();
  const filtered = tasks.filter(t => {
    const matchesSearch = t.text.toLowerCase().includes(query) || 
                         (t.tag && t.tag.toLowerCase().includes(query));
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

  // Attach Events
  li.querySelector('.toggle-sub').addEventListener('click', () => {
    const cont = li.querySelector('.subtask-container');
    const icon = li.querySelector('.toggle-sub i');
    cont.classList.toggle('hidden');
    if (icon) icon.style.transform = cont.classList.contains('hidden') ? 'rotate(0)' : 'rotate(180deg)';
  });

  const subInput = li.querySelector('.sub-input');
  const addSub = () => {
    const text = subInput.value.trim();
    if (text) {
      const newSub = { id: Date.now(), text, completed: false };
      const updated = [...(task.subtasks || []), newSub];
      updateTaskInDB(task.id, { subtasks: updated });
    }
  };
  li.querySelector('.sub-add-btn').addEventListener('click', addSub);
  subInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSub(); });

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

  li.querySelector('.todo-checkbox').addEventListener('click', () => {
    updateTaskInDB(task.id, { completed: !task.completed });
  });
  
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

  if (elements.pendingCount) elements.pendingCount.innerText = pending;
  if (elements.urgentCount) elements.urgentCount.innerText = urgent;
  if (elements.doneCount) elements.doneCount.innerText = completed;
  if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
  if (elements.progressText) elements.progressText.innerText = `${percent}%`;
};

// --- Theme & Focus ---

const loadTheme = () => {
  const saved = localStorage.getItem('zentask-theme') || 'theme-midnight';
  document.body.className = saved;
};

const setTheme = (theme) => {
  document.body.className = theme;
  localStorage.setItem('zentask-theme', theme);
  elements.themeModal.classList.add('hidden');
};

const startFocusMode = () => {
  const topTask = tasks.find(t => !t.completed && t.priority === 'high') || tasks.find(t => !t.completed);
  if (!topTask) {
    showNotification('No active missions', 'info');
    return;
  }
  elements.focusTaskTitle.innerText = topTask.text;
  elements.focusOverlay.classList.remove('hidden');
  focusTimeRemaining = 25 * 60;
  updateTimerDisplay();
  
  if (focusTimerInterval) clearInterval(focusTimerInterval);
  focusTimerInterval = setInterval(() => {
    focusTimeRemaining--;
    updateTimerDisplay();
    if (focusTimeRemaining <= 0) {
      clearInterval(focusTimerInterval);
      showNotification('Focus complete!', 'success');
    }
  }, 1000);
};

const updateTimerDisplay = () => {
  const mins = Math.floor(focusTimeRemaining / 60);
  const secs = focusTimeRemaining % 60;
  elements.focusTimer.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- UI Feedback ---

const notifyContainer = document.createElement('div');
notifyContainer.className = 'notification-container';
document.body.appendChild(notifyContainer);

const showNotification = (msg, type = 'info') => {
  const notify = document.createElement('div');
  notify.className = `notification ${type}`;
  notify.innerHTML = `<span>${msg}</span>`;
  notifyContainer.appendChild(notify);
  setTimeout(() => {
    notify.classList.add('fade-out');
    setTimeout(() => notify.remove(), 500);
  }, 3000);
};

// --- Event Listeners ---

const setupEventListeners = () => {
  elements.addBtn.addEventListener('click', () => {
    const text = elements.todoInput.value.trim();
    if (text) {
      saveTask({
        text,
        date: elements.todoDate.value,
        time: elements.todoTime.value,
        tag: elements.todoTag.value,
        priority: elements.todoPriority.value,
        completed: false,
        subtasks: []
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
  elements.themeOptions.forEach(opt => {
    opt.addEventListener('click', () => setTheme(opt.dataset.theme));
  });

  elements.focusToggle.addEventListener('click', startFocusMode);
  elements.focusExit.addEventListener('click', () => {
    clearInterval(focusTimerInterval);
    elements.focusOverlay.classList.add('hidden');
  });
  
  elements.focusComplete.addEventListener('click', () => {
    const task = tasks.find(t => t.text === elements.focusTaskTitle.innerText && !t.completed);
    if (task) updateTaskInDB(task.id, { completed: true });
    clearInterval(focusTimerInterval);
    elements.focusOverlay.classList.add('hidden');
  });
};

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
