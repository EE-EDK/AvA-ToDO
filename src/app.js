/**
 * @file app.js
 * @brief Dynamic task manager for Ava Arrival Prep.
 * @version 3.0
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'ava-checklist-data-v3';
    const DEFAULT_DATA_PATH = 'src/tasks.json';

    let appData = {
        app_title: "Baby Ava's Arrival Prep",
        app_subtitle: "Checklist & Task Tracker",
        categories: []
    };

    let userState = {
        checked: {} // { "t1": true }
    };

    // DOM Cache
    const el = {
        appTitle: document.getElementById('appTitle'),
        appSubtitle: document.getElementById('appSubtitle'),
        categoryContainer: document.getElementById('categoryContainer'),
        progressFill: document.getElementById('progressFill'),
        progressCount: document.getElementById('progressCount'),
        completionBanner: document.getElementById('completionBanner'),
        addCategoryBtn: document.getElementById('addCategoryBtn'),
        resetDataBtn: document.getElementById('resetDataBtn'),
        exportDataBtn: document.getElementById('exportDataBtn'),
        editModal: document.getElementById('editModal'),
        modalTitle: document.getElementById('modalTitle'),
        editInput: document.getElementById('editInput'),
        editPriority: document.getElementById('editPriority'),
        priorityGroup: document.getElementById('priorityGroup'),
        modalSave: document.getElementById('modalSave'),
        modalCancel: document.getElementById('modalCancel')
    };

    let activeEditContext = null;

    /**
     * @brief Loads data from localStorage or fetches from JSON.
     */
    async function init() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                appData = parsed.appData;
                userState = parsed.userState;
            } else {
                const response = await fetch(DEFAULT_DATA_PATH);
                appData = await response.json();
                userState = { checked: {} };
            }
        } catch (err) {
            console.error('Failed to load data:', err);
        }

        renderApp();
        bindGlobalEvents();
    }

    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ appData, userState }));
    }

    function renderApp() {
        el.appTitle.textContent = appData.app_title;
        el.appSubtitle.textContent = appData.app_subtitle;
        el.categoryContainer.innerHTML = '';

        appData.categories.forEach(cat => {
            el.categoryContainer.appendChild(createCategoryElement(cat));
        });

        updateProgress();
    }

    function createCategoryElement(cat) {
        const section = document.createElement('section');
        section.className = 'section';
        section.id = cat.id;

        section.innerHTML = `
            <div class="section-header">
                <div class="section-icon">${cat.icon || '🍼'}</div>
                <div class="header-text">
                    <h2 class="section-title">${cat.title}</h2>
                    <p class="section-meta">${cat.subtitle}</p>
                </div>
                <div class="section-actions">
                    <button class="btn-icon add-task-btn" title="Add Task">➕</button>
                    <button class="btn-icon delete-cat-btn" title="Delete Category">🗑️</button>
                </div>
            </div>
            <div class="task-list"></div>
        `;

        const taskList = section.querySelector('.task-list');
        cat.tasks.forEach(task => {
            taskList.appendChild(createTaskElement(task, cat.id));
        });

        // Event listeners for section actions
        section.querySelector('.add-task-btn').addEventListener('click', () => openModal('TASK', cat.id));
        section.querySelector('.delete-cat-btn').addEventListener('click', () => deleteCategory(cat.id));

        return section;
    }

    function createTaskElement(task, catId) {
        const isChecked = userState.checked[task.id] || false;
        const label = document.createElement('label');
        label.className = `task-item ${isChecked ? 'completed' : ''}`;
        label.dataset.taskId = task.id;

        label.innerHTML = `
            <input type="checkbox" data-id="${task.id}" ${isChecked ? 'checked' : ''}>
            <span class="task-text">${task.text}</span>
            <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
            <button class="btn-icon delete-task-btn">✕</button>
        `;

        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            const checked = e.target.checked;
            userState.checked[task.id] = checked;
            label.classList.toggle('completed', checked);
            if (checked) fireConfetti();
            updateProgress();
            saveToStorage();
        });

        label.querySelector('.delete-task-btn').addEventListener('click', (e) => {
            e.preventDefault();
            deleteTask(catId, task.id);
        });

        return label;
    }

    function updateProgress() {
        const allTasks = appData.categories.flatMap(c => c.tasks);
        const total = allTasks.length;
        const checkedCount = allTasks.filter(t => userState.checked[t.id]).length;
        const pct = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

        el.progressFill.style.width = pct + '%';
        el.progressCount.textContent = `${checkedCount} / ${total}`;
        
        if (pct === 100 && total > 0) {
            el.completionBanner.classList.add('visible');
            fireConfetti();
        } else {
            el.completionBanner.classList.remove('visible');
        }
    }

    function fireConfetti() {
        if (typeof confetti !== 'function') return;
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#0f1923', '#f7a8b8', '#ffcad4']
        });
    }

    // Modal Logic
    function openModal(type, parentId = null) {
        activeEditContext = { type, parentId };
        el.modalTitle.textContent = type === 'CAT' ? 'Add New Category' : 'Add New Task';
        el.editInput.value = '';
        el.priorityGroup.classList.toggle('hidden', type === 'CAT');
        el.editModal.classList.add('visible');
        el.editInput.focus();
    }

    function closeModal() {
        el.editModal.classList.remove('visible');
        activeEditContext = null;
    }

    function saveModal() {
        const val = el.editInput.value.trim();
        if (!val) return;

        if (activeEditContext.type === 'CAT') {
            const newCat = {
                id: 'c' + Date.now(),
                title: val,
                subtitle: "Custom Category",
                icon: "📋",
                tasks: []
            };
            appData.categories.push(newCat);
        } else {
            const cat = appData.categories.find(c => c.id === activeEditContext.parentId);
            if (cat) {
                cat.tasks.push({
                    id: 't' + Date.now(),
                    text: val,
                    priority: el.editPriority.value
                });
            }
        }

        saveToStorage();
        renderApp();
        closeModal();
    }

    // Deletion Logic
    function deleteCategory(id) {
        if (!confirm('Delete this category and all its tasks?')) return;
        appData.categories = appData.categories.filter(c => c.id !== id);
        saveToStorage();
        renderApp();
    }

    function deleteTask(catId, taskId) {
        const cat = appData.categories.find(c => c.id === catId);
        if (cat) {
            cat.tasks = cat.tasks.filter(t => t.id !== taskId);
            delete userState.checked[taskId];
            saveToStorage();
            renderApp();
        }
    }

    function bindGlobalEvents() {
        el.addCategoryBtn.addEventListener('click', () => openModal('CAT'));
        el.modalSave.addEventListener('click', saveModal);
        el.modalCancel.addEventListener('click', closeModal);
        el.resetDataBtn.addEventListener('click', () => {
            if (confirm('Reset all data to defaults? This will erase your custom tasks.')) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        });
        el.exportDataBtn.addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href",     dataStr);
            downloadAnchorNode.setAttribute("download", "tasks_backup.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });

        // Close modal on background click
        el.editModal.addEventListener('click', (e) => {
            if (e.target === el.editModal) closeModal();
        });
    }

    // Initialize
    init();

})();
