(() => {
  const STORAGE_KEY = 'taskflow_tasks_v2';

  // DOM refs
  const taskList        = document.getElementById('task-list');
  const emptyState      = document.getElementById('empty-state');
  const emptyTitle      = document.getElementById('empty-title');
  const emptySubtitle   = document.getElementById('empty-subtitle');
  const appFooter       = document.getElementById('app-footer');
  const totalCount      = document.getElementById('total-count');
  const clearCompletedBtn = document.getElementById('clear-completed-btn');
  const filterBtns      = document.querySelectorAll('.filter-btn');
  const newTaskBtn      = document.getElementById('new-task-btn');
  const searchInput     = document.getElementById('search-input');
  const searchClear     = document.getElementById('search-clear');

  // Statistics
  const statTotal     = document.getElementById('stat-total');
  const statCompleted = document.getElementById('stat-completed');
  const statPending   = document.getElementById('stat-pending');
  const statOverdue   = document.getElementById('stat-overdue');

  // Modal
  const modalOverlay  = document.getElementById('modal-overlay');
  const modalTitle    = document.getElementById('modal-title');
  const modalClose    = document.getElementById('modal-close');
  const modalCancel   = document.getElementById('modal-cancel');
  const modalSave     = document.getElementById('modal-save');
  const modalError    = document.getElementById('modal-error');
  const modalTaskName = document.getElementById('modal-task-name');
  const modalTaskDesc = document.getElementById('modal-task-desc');
  const modalTaskDate = document.getElementById('modal-task-date');
  const modalTaskTime = document.getElementById('modal-task-time');
  const priorityBtns  = document.querySelectorAll('.priority-btn');

  let tasks         = [];
  let currentFilter = 'all';
  let searchQuery   = '';
  let editingId     = null;
  let selectedPriority = 'medium';

  // ─── Storage ────────────────────────────────────────────────────────────────
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  };
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

  const generateId = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // ─── Overdue check ───────────────────────────────────────────────────────────
  const isOverdue = (task) => {
    if (task.completed || (!task.dueDate && !task.dueTime)) return false;
    const now = new Date();
    if (task.dueDate && task.dueTime) {
      return new Date(`${task.dueDate}T${task.dueTime}`) < now;
    }
    if (task.dueDate) {
      // consider overdue if due date has passed (compare date strings)
      const today = now.toISOString().slice(0, 10);
      return task.dueDate < today;
    }
    return false;
  };

  // ─── Date / Time formatting ──────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // ─── Statistics ─────────────────────────────────────────────────────────────
  const updateStats = () => {
    const total     = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending   = tasks.filter(t => !t.completed).length;
    const overdue   = tasks.filter(t => isOverdue(t)).length;

    statTotal.textContent     = total;
    statCompleted.textContent = completed;
    statPending.textContent   = pending;
    statOverdue.textContent   = overdue;

    totalCount.textContent = `${total} task${total !== 1 ? 's' : ''} total`;
    appFooter.hidden = total === 0;
  };

  // ─── Filter & Search ─────────────────────────────────────────────────────────
  const getFiltered = () => {
    let result = tasks;

    if (currentFilter === 'completed') result = result.filter(t => t.completed);
    else if (currentFilter === 'pending') result = result.filter(t => !t.completed);
    else if (currentFilter === 'overdue') result = result.filter(t => isOverdue(t));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.text.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  };

  // ─── Empty state ─────────────────────────────────────────────────────────────
  const showEmpty = (filtered) => {
    const show = filtered.length === 0;
    emptyState.hidden = !show;
    if (!show) return;

    if (searchQuery) {
      emptyTitle.textContent = 'No results found';
      emptySubtitle.textContent = `No tasks match "${searchQuery}"`;
    } else if (tasks.length === 0) {
      emptyTitle.textContent = 'No tasks yet';
      emptySubtitle.textContent = 'Click "New Task" to get started';
    } else if (currentFilter === 'completed') {
      emptyTitle.textContent = 'No completed tasks';
      emptySubtitle.textContent = 'Complete a task to see it here';
    } else if (currentFilter === 'overdue') {
      emptyTitle.textContent = 'No overdue tasks';
      emptySubtitle.textContent = 'You\'re on top of everything!';
    } else {
      emptyTitle.textContent = 'All done!';
      emptySubtitle.textContent = 'No pending tasks — great work!';
    }
  };

  // ─── Priority badge ───────────────────────────────────────────────────────────
  const priorityLabel = { high: 'High', medium: 'Medium', low: 'Low' };
  const priorityIcon  = {
    high:   `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 20h16L12 2z"/></svg>`,
    medium: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="10" width="18" height="4" rx="2"/></svg>`,
    low:    `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22L4 4h16L12 22z"/></svg>`
  };

  // ─── Create task element ─────────────────────────────────────────────────────
  const createTaskElement = (task) => {
    const overdue = isOverdue(task);
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}${overdue ? ' overdue' : ''}`;
    li.dataset.id = task.id;
    li.setAttribute('role', 'listitem');

    const priority = task.priority || 'medium';
    const formattedDate = formatDate(task.dueDate);
    const formattedTime = formatTime(task.dueTime);

    li.innerHTML = `
      <div class="task-main">
        <label class="checkbox-wrap" aria-label="Mark as ${task.completed ? 'pending' : 'completed'}">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Toggle task">
          <span class="checkbox-custom"></span>
        </label>
        <div class="task-content">
          <div class="task-top-row">
            <span class="task-text">${escapeHtml(task.text)}</span>
            <span class="priority-badge priority-${priority}">
              ${priorityIcon[priority]} ${priorityLabel[priority]}
            </span>
          </div>
          ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            ${formattedDate ? `
              <span class="meta-item ${overdue && !task.completed ? 'meta-overdue' : ''}">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                ${formattedDate}
              </span>` : ''}
            ${formattedTime ? `
              <span class="meta-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${formattedTime}
              </span>` : ''}
            ${overdue && !task.completed ? `<span class="overdue-badge">Overdue</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="action-btn edit-btn" aria-label="Edit task: ${escapeHtml(task.text)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="action-btn delete-btn" aria-label="Delete task: ${escapeHtml(task.text)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Checkbox
    const checkbox = li.querySelector('.task-checkbox');
    checkbox.addEventListener('change', () => toggleTask(task.id, li));

    // Edit
    li.querySelector('.edit-btn').addEventListener('click', () => openModal(task.id));

    // Delete
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id, li));

    return li;
  };

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  const render = () => {
    const filtered = getFiltered();
    taskList.innerHTML = '';
    filtered.forEach(task => taskList.appendChild(createTaskElement(task)));
    showEmpty(filtered);
    updateStats();
  };

  // ─── Toggle task ─────────────────────────────────────────────────────────────
  const toggleTask = (id, li) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    save();

    if (currentFilter !== 'all') {
      li.classList.add('removing');
      li.addEventListener('animationend', () => render(), { once: true });
    } else {
      const overdue = isOverdue(task);
      li.className = `task-item${task.completed ? ' completed' : ''}${overdue ? ' overdue' : ''}`;
      updateStats();
    }
  };

  // ─── Delete task ─────────────────────────────────────────────────────────────
  const deleteTask = (id, li) => {
    // Ask the user to confirm before permanently removing the task
    const confirmed = window.confirm('Are you sure you want to delete this task?');
    if (!confirmed) return;

    li.classList.add('removing');
    li.addEventListener('animationend', () => {
      tasks = tasks.filter(t => t.id !== id);
      save();
      render();
    }, { once: true });
  };

  // ─── Clear completed ──────────────────────────────────────────────────────────
  const clearCompleted = () => {
    const els = taskList.querySelectorAll('.task-item.completed');
    if (!els.length) return;
    let done = 0;
    els.forEach(el => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => {
        done++;
        if (done === els.length) {
          tasks = tasks.filter(t => !t.completed);
          save();
          render();
        }
      }, { once: true });
    });
  };

  // ─── Modal ────────────────────────────────────────────────────────────────────
  const openModal = (id = null) => {
    editingId = id;
    modalError.textContent = '';
    modalError.classList.remove('visible');

    if (id) {
      const task = tasks.find(t => t.id === id);
      modalTitle.textContent = 'Edit Task';
      modalSave.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Save Changes`;
      modalTaskName.value = task.text;
      modalTaskDesc.value = task.description || '';
      modalTaskDate.value = task.dueDate || '';
      modalTaskTime.value = task.dueTime || '';
      selectedPriority = task.priority || 'medium';
    } else {
      modalTitle.textContent = 'New Task';
      modalSave.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Save Task`;
      modalTaskName.value = '';
      modalTaskDesc.value = '';
      modalTaskDate.value = '';
      modalTaskTime.value = '';
      selectedPriority = 'medium';
    }

    // Update priority buttons
    priorityBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.priority === selectedPriority);
    });

    modalOverlay.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => modalTaskName.focus());
  };

  const closeModal = () => {
    modalOverlay.classList.remove('open');
    modalOverlay.setAttribute('aria-hidden', 'true');
    editingId = null;
  };

  const showModalError = (msg) => {
    modalError.textContent = msg;
    modalError.classList.add('visible');
    modalTaskName.focus();
  };

  const saveTask = () => {
    const text = modalTaskName.value.trim();
    if (!text) { showModalError('Task name is required.'); return; }
    if (text.length < 2) { showModalError('Task name must be at least 2 characters.'); return; }

    if (editingId) {
      const task = tasks.find(t => t.id === editingId);
      if (task) {
        task.text        = text;
        task.description = modalTaskDesc.value.trim();
        task.dueDate     = modalTaskDate.value || null;
        task.dueTime     = modalTaskTime.value || null;
        task.priority    = selectedPriority;
        task.updatedAt   = Date.now();
      }
    } else {
      const task = {
        id:          generateId(),
        text,
        description: modalTaskDesc.value.trim(),
        dueDate:     modalTaskDate.value || null,
        dueTime:     modalTaskTime.value || null,
        priority:    selectedPriority,
        completed:   false,
        createdAt:   Date.now(),
        updatedAt:   Date.now()
      };
      tasks.unshift(task);
    }

    save();
    closeModal();
    render();
  };

  // ─── Priority buttons ─────────────────────────────────────────────────────────
  priorityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPriority = btn.dataset.priority;
      priorityBtns.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // ─── Filter buttons ───────────────────────────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // ─── Search ───────────────────────────────────────────────────────────────────
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.hidden = !searchQuery;
    render();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.hidden = true;
    searchInput.focus();
    render();
  });

  // ─── Events ───────────────────────────────────────────────────────────────────
  newTaskBtn.addEventListener('click', () => openModal());
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  clearCompletedBtn.addEventListener('click', clearCompleted);
  modalSave.addEventListener('click', saveTask);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
    if ((e.key === 'Enter') && document.activeElement === modalTaskName) saveTask();
  });

  // ─── Init ─────────────────────────────────────────────────────────────────────
  tasks = load();

  // Migrate old tasks that only have `text` field
  tasks = tasks.map(t => ({
    id:          t.id || generateId(),
    text:        t.text || '',
    description: t.description || '',
    dueDate:     t.dueDate || null,
    dueTime:     t.dueTime || null,
    priority:    t.priority || 'medium',
    completed:   t.completed || false,
    createdAt:   t.createdAt || Date.now(),
    updatedAt:   t.updatedAt || Date.now()
  }));

  render();
})();
