const API_URL = 'http://localhost:3001/api';

// Initialize Lucide icons
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// --- STATE ---
let tasks = [];
let currentCategory = 'all';
let currentStatus = 'pending';

// --- DOM ELEMENTS ---
const taskListEl = document.getElementById('task-list');
const taskInput = document.getElementById('task-input');
const dateSelectEl = document.getElementById('date-select');
const selectedDateText = document.getElementById('selected-date-text');
const miniPrevMonth = document.getElementById('mini-prev-month');
const miniNextMonth = document.getElementById('mini-next-month');
const miniMonthYear = document.getElementById('mini-month-year');
const miniCalDays = document.getElementById('mini-cal-days');

let selectedDateValue = '';
let miniCalDate = new Date();
const addTaskBtn = document.getElementById('add-task-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

// Custom Selects
const catSelect = document.getElementById('cat-select');
const selectedCatVal = document.getElementById('selected-cat');
const prioritySelect = document.getElementById('priority-select');
const selectedPriorityVal = document.getElementById('selected-priority');

// Filters
const filterBtns = document.querySelectorAll('.filter-btn');
const categoryBtns = document.querySelectorAll('#category-list li');
const viewTitle = document.getElementById('view-title');

// Stats
const progressCircle = document.getElementById('progress-circle');
const progressText = document.getElementById('progress-text');
const statsSummary = document.getElementById('stats-summary');

// AI Modal
const aiModal = document.getElementById('ai-modal');
const aiSuggestBtn = document.getElementById('ai-suggest-btn');
const closeAiModalBtn = document.getElementById('close-ai-modal');
const generateAiBtn = document.getElementById('generate-ai-btn');
const aiGoalInput = document.getElementById('ai-goal-input');
const aiLoading = document.getElementById('ai-loading');
const aiSuggestionsList = document.getElementById('ai-suggestions-list');
const addAiTasksBtn = document.getElementById('add-ai-tasks-btn');

// --- INIT ---
document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
createParticles();
fetchTasks();

// --- PARTICLES ---
function createParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    p.style.width = `${Math.random() * 4 + 1}px`;
    p.style.height = p.style.width;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.animationDuration = `${Math.random() * 20 + 10}s`;
    p.style.animationDelay = `${Math.random() * 10}s`;
    container.appendChild(p);
  }
}

// --- THEME ---
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  });
}

// --- CUSTOM SELECTS ---
function setupCustomSelect(selectEl, valueEl) {
  if (!selectEl) return;
  selectEl.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select').forEach(el => {
      if (el !== selectEl) el.classList.remove('open');
    });
    selectEl.classList.toggle('open');
  });

  const opts = selectEl.querySelectorAll('.opt');
  opts.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = opt.getAttribute('data-val');
      const text = opt.textContent;
      valueEl.textContent = text;
      
      // Inherit priority classes
      if(selectEl.id === 'priority-select') {
        const selectedValContainer = selectEl.querySelector('.selected-val');
        selectedValContainer.className = `selected-val priority-${val}`;
      }
      
      selectEl.dataset.current = val;
      selectEl.classList.remove('open');
    });
  });
}
setupCustomSelect(catSelect, selectedCatVal);
setupCustomSelect(prioritySelect, selectedPriorityVal);
if (catSelect) catSelect.dataset.current = 'none';
if (prioritySelect) prioritySelect.dataset.current = 'medium';

// --- MINI CALENDAR ---
function renderMiniCalendar() {
  if(!miniCalDays) return;
  const year = miniCalDate.getFullYear();
  const month = miniCalDate.getMonth();
  
  miniMonthYear.textContent = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(miniCalDate);
  miniCalDays.innerHTML = '';
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  
  const today = new Date();
  
  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'mini-day';
    
    let cellDate;
    if (i < firstDay) {
      const d = prevMonthDays - firstDay + i + 1;
      cell.textContent = d;
      cell.classList.add('muted');
      cellDate = new Date(year, month - 1, d);
    } else if (i >= firstDay + daysInMonth) {
      const d = i - firstDay - daysInMonth + 1;
      cell.textContent = d;
      cell.classList.add('muted');
      cellDate = new Date(year, month + 1, d);
    } else {
      const d = i - firstDay + 1;
      cell.textContent = d;
      cellDate = new Date(year, month, d);
    }
    
    const isToday = cellDate.getFullYear() === today.getFullYear() && cellDate.getMonth() === today.getMonth() && cellDate.getDate() === today.getDate();
    if(isToday) cell.classList.add('today');
    
    const cellDateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
    if (selectedDateValue === cellDateStr) cell.classList.add('selected');
    
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedDateValue = cellDateStr;
      selectedDateText.textContent = cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateSelectEl.classList.remove('open');
      renderMiniCalendar(); // re-render to update selected class
    });
    
    miniCalDays.appendChild(cell);
  }
}

if(dateSelectEl) {
  dateSelectEl.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select').forEach(el => {
      if (el !== dateSelectEl) el.classList.remove('open');
    });
    dateSelectEl.classList.toggle('open');
    renderMiniCalendar();
  });
  
  miniPrevMonth.addEventListener('click', (e) => {
    e.stopPropagation();
    miniCalDate.setMonth(miniCalDate.getMonth() - 1);
    renderMiniCalendar();
  });
  
  miniNextMonth.addEventListener('click', (e) => {
    e.stopPropagation();
    miniCalDate.setMonth(miniCalDate.getMonth() + 1);
    renderMiniCalendar();
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select').forEach(el => el.classList.remove('open'));
});

// --- API & TASKS ---
async function fetchTasks() {
  try {
    const res = await fetch(`${API_URL}/tasks`);
    tasks = await res.json();
    renderTasks();
    updateStats();
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

async function handleAddTask() {
  if (!taskInput) return;
  const text = taskInput.value.trim();
  if (!text) return;

  const newTask = {
    text,
    date: selectedDateValue,
    category: catSelect ? catSelect.dataset.current : 'none',
    priority: prioritySelect ? prioritySelect.dataset.current : 'medium',
    completed: false
  };

  try {
    const res = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    });
    const created = await res.json();
    tasks.unshift(created);
    taskInput.value = '';
    selectedDateValue = '';
    if(selectedDateText) selectedDateText.textContent = 'Today';
    renderTasks();
    updateStats();
  } catch (err) {
    console.error('Failed to create task');
  }
}

if (addTaskBtn) addTaskBtn.addEventListener('click', handleAddTask);
if (taskInput) {
  taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddTask();
  });
}

async function toggleTaskCompletion(id, isCompleted) {
  try {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !isCompleted })
    });
    const updated = await res.json();
    const index = tasks.findIndex(t => t._id === id);
    if (index !== -1) tasks[index] = updated;
    renderTasks();
    updateStats();
  } catch (err) {
    console.error('Failed to update task');
  }
}

async function deleteTask(id) {
  try {
    await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
    tasks = tasks.filter(t => t._id !== id);
    renderTasks();
    updateStats();
  } catch (err) {
    console.error('Failed to delete task');
  }
}

// --- RENDER ---
function renderTasks() {
  if (!taskListEl) return;
  taskListEl.innerHTML = '';
  
  let filtered = tasks;
  if (currentCategory !== 'all') {
    filtered = filtered.filter(t => t.category === currentCategory);
  }
  if (currentStatus === 'pending') {
    filtered = filtered.filter(t => !t.completed);
  } else {
    filtered = filtered.filter(t => t.completed);
  }

  if (filtered.length === 0) {
    taskListEl.innerHTML = `
      <li style="text-align:center; padding: 3rem 2rem; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <i data-lucide="sparkles" style="width: 48px; height: 48px; opacity: 0.5;"></i>
        <p>No tasks here yet. Time to create something beautiful!</p>
      </li>`;
    lucide.createIcons();
    return;
  }

  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    
    let dateStr = task.date ? new Date(task.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    
    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task._id}">
      <div class="task-content">
        <span class="task-text">${task.text}</span>
        <div class="task-details">
          ${dateStr ? `<span class="task-badge"><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${dateStr}</span>` : ''}
          ${task.category !== 'none' && task.category ? `<span class="task-badge cat-${task.category}"><i data-lucide="tag" style="width:12px;height:12px;"></i> ${task.category}</span>` : ''}
          <span class="task-badge priority-${task.priority}"><i data-lucide="flag" style="width:12px;height:12px;"></i> ${task.priority}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="action-btn delete" data-id="${task._id}"><i data-lucide="trash-2" style="width:18px;height:18px;"></i></button>
      </div>
    `;
    taskListEl.appendChild(li);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Attach events
  document.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const isCompleted = !e.target.checked; // Since we toggle
      toggleTaskCompletion(id, isCompleted);
    });
  });

  document.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      deleteTask(id);
    });
  });
}

// --- FILTERS & STATS ---
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatus = btn.getAttribute('data-status');
    renderTasks();
  });
});

categoryBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCategory = btn.getAttribute('data-cat');
    if (viewTitle) viewTitle.textContent = btn.textContent.trim();
    renderTasks();
  });
});

function updateStats() {
  if (!progressText || !statsSummary || !progressCircle) return;
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  progressText.textContent = `${percent}%`;
  statsSummary.textContent = `${completed} of ${total} tasks completed`;
  
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (percent / 100) * circumference;
  progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
  progressCircle.style.strokeDashoffset = offset;
  
  // Badges
  const cats = { work: 0, personal: 0, health: 0 };
  tasks.filter(t => !t.completed).forEach(t => {
    if(cats[t.category] !== undefined) cats[t.category]++;
  });
  
  categoryBtns.forEach(btn => {
    const c = btn.getAttribute('data-cat');
    const badge = btn.querySelector('.badge');
    if (badge && cats[c] !== undefined) {
      badge.textContent = cats[c] > 0 ? cats[c] : '';
      badge.style.display = cats[c] > 0 ? 'block' : 'none';
    }
  });
}

// --- AI SUGGESTIONS ---
let generatedAiTasks = [];

if (aiSuggestBtn && aiModal) {
  aiSuggestBtn.addEventListener('click', () => {
    aiModal.classList.remove('hidden');
    aiGoalInput.value = '';
    aiSuggestionsList.innerHTML = '';
    aiSuggestionsList.classList.add('hidden');
    addAiTasksBtn.classList.add('hidden');
  });
}

if (closeAiModalBtn && aiModal) {
  closeAiModalBtn.addEventListener('click', () => {
    aiModal.classList.add('hidden');
  });
}

if (generateAiBtn) {
  generateAiBtn.addEventListener('click', async () => {
    const goal = aiGoalInput.value.trim();
    if (!goal) return;
    
    aiLoading.classList.remove('hidden');
    aiSuggestionsList.classList.add('hidden');
    addAiTasksBtn.classList.add('hidden');
    generateAiBtn.disabled = true;
    
    try {
      const res = await fetch(`${API_URL}/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal })
      });
      const data = await res.json();
      generatedAiTasks = data.suggestions;
      
      aiSuggestionsList.innerHTML = '';
      generatedAiTasks.forEach((sug, idx) => {
        const li = document.createElement('li');
        li.className = 'selected';
        li.innerHTML = `
          <span>${sug}</span>
          <input type="checkbox" checked data-idx="${idx}" style="cursor:pointer">
        `;
        aiSuggestionsList.appendChild(li);
      });
      
      aiSuggestionsList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const li = e.target.closest('li');
          if(e.target.checked) li.classList.add('selected');
          else li.classList.remove('selected');
        });
      });
      
      aiLoading.classList.add('hidden');
      aiSuggestionsList.classList.remove('hidden');
      addAiTasksBtn.classList.remove('hidden');
    } catch (err) {
      console.error('AI error', err);
      aiLoading.classList.add('hidden');
    } finally {
      generateAiBtn.disabled = false;
    }
  });
}

if (addAiTasksBtn) {
  addAiTasksBtn.addEventListener('click', async () => {
    const checkboxes = aiSuggestionsList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-idx')));
    
    for (let idx of selectedIndices) {
      const taskText = generatedAiTasks[idx];
      try {
        const res = await fetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: taskText,
            date: '',
            category: 'none',
            priority: 'medium',
            completed: false
          })
        });
        const created = await res.json();
        tasks.unshift(created);
      } catch(err) {
        console.error(err);
      }
    }
    
    aiModal.classList.add('hidden');
    renderTasks();
    updateStats();
  });
}
