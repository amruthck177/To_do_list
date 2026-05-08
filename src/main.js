// ZenTask Premium Logic
let tasks = JSON.parse(localStorage.getItem('zentasks_v2')) || [];

const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const taskCount = document.getElementById('task-count');

const saveTasks = () => {
  localStorage.setItem('zentasks_v2', JSON.stringify(tasks));
  updateProgress();
};

const updateProgress = () => {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  
  progressFill.style.width = `${percentage}%`;
  progressPercent.innerText = `${percentage}% done`;
  taskCount.innerText = `${total} task${total !== 1 ? 's' : ''}`;

  if (percentage === 100 && total > 0) {
    celebrate();
  }
};

const celebrate = () => {
  // Simple visual feedback for completion
  progressFill.style.boxShadow = '0 0 30px #c084fc';
  setTimeout(() => {
    progressFill.style.boxShadow = '0 0 15px rgba(192, 132, 252, 0.5)';
  }, 1000);
};

const renderTasks = () => {
  if (tasks.length === 0) {
    todoList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>No missions active. Start by adding one above.</p>
      </div>
    `;
    updateProgress();
    return;
  }

  todoList.innerHTML = '';
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = `todo-item ${task.completed ? 'completed' : ''}`;
    
    li.innerHTML = `
      <div class="custom-checkbox" onclick="toggleTask(${index})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="todo-content">
        <span class="todo-text">${task.text}</span>
      </div>
      <div class="actions">
        <button class="action-btn delete" onclick="removeTask(${index})" title="Delete Mission">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
    todoList.appendChild(li);
  });
  updateProgress();
};

const addTask = () => {
  const text = todoInput.value.trim();
  if (text) {
    tasks.unshift({ text, completed: false, createdAt: Date.now() });
    todoInput.value = '';
    saveTasks();
    renderTasks();
  }
};

window.toggleTask = (index) => {
  tasks[index].completed = !tasks[index].completed;
  saveTasks();
  renderTasks();
};

window.removeTask = (index) => {
  const items = todoList.querySelectorAll('.todo-item');
  items[index].classList.add('removing');
  
  setTimeout(() => {
    tasks.splice(index, 1);
    saveTasks();
    renderTasks();
  }, 300);
};

addBtn.addEventListener('click', addTask);
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTask();
});

// Initial Render
renderTasks();
updateProgress();
