/**
 * @file app.js
 * @brief Dynamic task manager for Ava Arrival Prep.
 * @version 4.0 — Persistent shared state via remote API
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'ava-checklist-data-v3';
    const API_BASE = 'https://kunz-ai-hub.tailb1d0b7.ts.net/ava-api';

    const DEFAULT_APP_DATA = {
        "app_title": "Baby Ava's Arrival Prep",
        "app_subtitle": "Checklist & Task Tracker",
        "categories": [
            {
                "id": "c1",
                "title": "Nursery & Baby Core",
                "subtitle": "Baby's Room / House",
                "icon": "🍼",
                "tasks": [
                    { "id": "t1", "text": "Assemble the crib", "priority": "MED" },
                    { "id": "t2", "text": "Clean the future baby's room", "priority": "LOW" },
                    { "id": "t3", "text": "Hang a new ceiling fan in the baby's room", "priority": "MED" },
                    { "id": "t4", "text": "Install two cameras in the baby's room", "priority": "LOW" },
                    { "id": "t5", "text": "Assemble the Pack 'N Play", "priority": "LOW" }
                ]
            },
            {
                "id": "c2",
                "title": "Medical & Admin",
                "subtitle": "External / Online",
                "icon": "🏥",
                "tasks": [
                    { "id": "t6", "text": "Call/set up pediatric doctor in Wildwood/Lee's Summit (Monday deadline, finalize by next Sunday)", "priority": "MED" }
                ]
            },
            {
                "id": "c3",
                "title": "Interior Cleaning & Org",
                "subtitle": "Whole House",
                "icon": "🧹",
                "tasks": [
                    { "id": "t7", "text": "Deep clean main rooms (living room, kitchen, dining room)", "priority": "HIGH" },
                    { "id": "t8", "text": "Wash the carpets", "priority": "MED" },
                    { "id": "t9", "text": "General organizing and putting stuff away", "priority": "LOW" },
                    { "id": "t10", "text": "Rearrange master bedroom and switch sides on the bed", "priority": "LOW" },
                    { "id": "t11", "text": "Clean up and organize the basement (throw away old college stuff)", "priority": "HIGH" }
                ]
            },
            {
                "id": "c4",
                "title": "Furniture & Equipment",
                "subtitle": "Various",
                "icon": "🪑",
                "tasks": [
                    { "id": "t12", "text": "Assemble a table", "priority": "LOW" },
                    { "id": "t13", "text": "Install a fixture", "priority": "MED" },
                    { "id": "t14", "text": "Set up bottle washer in dining room (route wastewater outside via weatherproof fitting)", "priority": "MED" },
                    { "id": "t15", "text": "Find and buy a comfortable nursing/holding chair for office/upstairs (under $500)", "priority": "LOW" }
                ]
            },
            {
                "id": "c5",
                "title": "Electrical & Safety",
                "subtitle": "Whole House",
                "icon": "⚡",
                "tasks": [
                    { "id": "t16", "text": "Child-safe electrical outlets and remove/store sharp objects", "priority": "LOW" },
                    { "id": "t17", "text": "Route internet to center of house (power & ethernet from coax modem to central WAP & core PC)", "priority": "HIGH" },
                    { "id": "t18", "text": "Run power to deficient room (disconnect panel, run cabling, wire outlets)", "priority": "HIGH" }
                ]
            },
            {
                "id": "c6",
                "title": "Exterior & Garage",
                "subtitle": "Outside / Garage",
                "icon": "🏡",
                "tasks": [
                    { "id": "t19", "text": "Clean up the garage and put the tent away", "priority": "LOW" },
                    { "id": "t20", "text": "Install front-facing security camera on garage (requires wiring external outlet)", "priority": "HIGH" },
                    { "id": "t21", "text": "Clean up car cover area", "priority": "LOW" },
                    { "id": "t22", "text": "Prep and store '69 Opel GT project outside with cover (rust prevention)", "priority": "MED" },
                    { "id": "t23", "text": "Purchase and set up robotic lawnmower (steep-hill capable, ¼ acre)", "priority": "MED" },
                    { "id": "t24", "text": "Replace back porch chair cushions", "priority": "LOW" },
                    { "id": "t25", "text": "Repair/replace structurally unstable back porch (evaluate DIY vs contractor)", "priority": "HIGH" },
                    { "id": "t26", "text": "Install backyard dog fence (permanent build or temporary wrap-around)", "priority": "HIGH" }
                ]
            },
            {
                "id": "c7",
                "title": "Pet Management",
                "subtitle": "Living Room / Dogs",
                "icon": "🐾",
                "tasks": [
                    { "id": "t27", "text": "Build/buy proper aesthetic dog housing (~15ft L × 2–3ft W × 4ft H)", "priority": "MED" },
                    { "id": "t28", "text": "Buy small, cheap, long-lasting non-shock vibration/sound training collars for barking", "priority": "LOW" }
                ]
            }
        ]
    };

    let appData = { ...DEFAULT_APP_DATA };
    let userState = { checked: {} };
    let syncEnabled = false;
    let saveTimer = null;

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
        audioToggle: document.getElementById('audioToggle'),
        editModal: document.getElementById('editModal'),
        modalTitle: document.getElementById('modalTitle'),
        editInput: document.getElementById('editInput'),
        editPriority: document.getElementById('editPriority'),
        priorityGroup: document.getElementById('priorityGroup'),
        modalSave: document.getElementById('modalSave'),
        modalCancel: document.getElementById('modalCancel')
    };

    let activeEditContext = null;

    // ── Remote API helpers ──────────────────────────────────────────

    async function fetchRemoteState() {
        const res = await fetch(API_BASE + '/state');
        if (!res.ok) throw new Error('API returned ' + res.status);
        return res.json();
    }

    async function pushRemoteState() {
        const payload = {
            lastUpdated: new Date().toISOString(),
            appData: appData,
            userState: userState
        };
        const res = await fetch(API_BASE + '/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('API PUT returned ' + res.status);
        return res.json();
    }

    // Debounced save — writes to localStorage immediately, pushes to API after 500ms idle
    function saveToStorage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            appData, userState, lastUpdated: new Date().toISOString()
        }));

        if (syncEnabled) {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                pushRemoteState().catch(err => console.warn('Sync push failed:', err));
            }, 500);
        }
    }

    // ── Init ────────────────────────────────────────────────────────

    async function init() {
        try {
            // Try remote API first (shared source of truth)
            const remote = await fetchRemoteState();
            appData = remote.appData;
            userState = remote.userState;
            syncEnabled = true;
            saveToStorage(); // cache locally
            console.log('Loaded shared state from API');
        } catch (apiErr) {
            console.warn('API unavailable, falling back to local:', apiErr.message);
            // Fall back to localStorage
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                appData = parsed.appData;
                userState = parsed.userState;
            } else {
                // Last resort: try static files, then defaults
                try {
                    const res = await fetch('src/user-state.json?v=' + Date.now());
                    if (res.ok) {
                        const shared = await res.json();
                        appData = shared.appData;
                        userState = shared.userState;
                    }
                } catch (e) {
                    try {
                        const res = await fetch('src/tasks.json');
                        if (res.ok) appData = await res.json();
                    } catch (e2) {
                        // use DEFAULT_APP_DATA already assigned
                    }
                    userState = { checked: {} };
                }
            }
        }

        renderApp();
        bindGlobalEvents();

        // Poll for remote changes every 30 seconds (keeps tabs in sync)
        if (syncEnabled) {
            setInterval(async () => {
                try {
                    const remote = await fetchRemoteState();
                    const localTs = new Date(localStorage.getItem(STORAGE_KEY) ?
                        JSON.parse(localStorage.getItem(STORAGE_KEY)).lastUpdated : 0);
                    const remoteTs = new Date(remote.lastUpdated);
                    if (remoteTs > localTs) {
                        appData = remote.appData;
                        userState = remote.userState;
                        saveToStorage();
                        renderApp();
                        console.log('Synced newer state from API');
                    }
                } catch (e) {
                    // silently skip
                }
            }, 30000);
        }
    }

    // ── Rendering ───────────────────────────────────────────────────

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
                <div class="section-icon">${cat.icon || '📋'}</div>
                <div class="header-text">
                    <h2 class="section-title">${cat.title}</h2>
                    <p class="section-meta">${cat.subtitle}</p>
                </div>
                <div class="section-actions">
                    <button class="btn-icon add-task-btn" title="Add Task">\u2795</button>
                    <button class="btn-icon delete-cat-btn" title="Delete Category">\ud83d\uddd1\ufe0f</button>
                </div>
            </div>
            <div class="task-list"></div>
        `;

        const taskList = section.querySelector('.task-list');
        cat.tasks.forEach(task => {
            taskList.appendChild(createTaskElement(task, cat.id));
        });

        section.querySelector('.add-task-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openModal('TASK', cat.id);
        });

        section.querySelector('.delete-cat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCategory(cat.id);
        });

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
            <button class="btn-icon delete-task-btn" title="Delete Task">\u2715</button>
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
            e.stopPropagation();
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
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#0f1923', '#f7a8b8', '#ffcad4'],
            disableForReducedMotion: true
        });
    }

    // ── Modals & CRUD ───────────────────────────────────────────────

    function openModal(type, parentId = null) {
        activeEditContext = { type, parentId };
        el.modalTitle.textContent = type === 'CAT' ? 'Add New Category' : 'Add New Task';
        el.editInput.value = '';
        el.priorityGroup.classList.toggle('hidden', type === 'CAT');
        el.editModal.classList.add('visible');
        setTimeout(() => el.editInput.focus(), 50);
    }

    function closeModal() {
        el.editModal.classList.remove('visible');
        activeEditContext = null;
    }

    function saveModal() {
        const val = el.editInput.value.trim();
        if (!val) return;

        if (activeEditContext.type === 'CAT') {
            appData.categories.push({
                id: 'c' + Date.now(),
                title: val,
                subtitle: "Custom Category",
                icon: "\ud83d\udccb",
                tasks: []
            });
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

    // ── Global Events ───────────────────────────────────────────────

    function bindGlobalEvents() {
        el.addCategoryBtn.addEventListener('click', () => openModal('CAT'));
        el.modalSave.addEventListener('click', saveModal);
        el.modalCancel.addEventListener('click', closeModal);
        el.resetDataBtn.addEventListener('click', () => {
            if (confirm('Reset all data to defaults? This will erase your custom tasks.')) {
                localStorage.removeItem(STORAGE_KEY);
                // Also reset the remote state
                appData = { ...DEFAULT_APP_DATA };
                userState = { checked: {} };
                if (syncEnabled) {
                    pushRemoteState().catch(err => console.warn('Reset push failed:', err));
                }
                location.reload();
            }
        });
        el.exportDataBtn.addEventListener('click', () => {
            const exportPayload = {
                lastUpdated: new Date().toISOString(),
                appData: appData,
                userState: userState
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
            const dl = document.createElement('a');
            dl.href = dataStr;
            dl.download = "user-state.json";
            dl.click();
        });

        el.audioToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.AudioEngine) {
                const isMuted = window.AudioEngine.toggleMute();
                el.audioToggle.classList.toggle('muted', isMuted);
                el.audioToggle.textContent = isMuted ? '🔇' : '🎵';
            }
        });

        el.editModal.addEventListener('click', (e) => {
            if (e.target === el.editModal) closeModal();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.editModal.classList.contains('visible')) closeModal();
            if (e.key === 'Enter' && el.editModal.classList.contains('visible')) saveModal();
        });
    }

    // Initialize App
    init();

    // Audio Bootstrapper
    const startAudio = async () => {
        if (window.AudioEngine) {
            console.log('User interaction detected, starting audio...');
            await window.AudioEngine.startLullaby();

            document.removeEventListener('click', startAudio);
            document.removeEventListener('touchstart', startAudio);
            document.removeEventListener('mousedown', startAudio);
        }
    };

    setTimeout(startAudio, 200);
    document.addEventListener('click', startAudio);
    document.addEventListener('touchstart', startAudio);
    document.addEventListener('mousedown', startAudio);
})();
