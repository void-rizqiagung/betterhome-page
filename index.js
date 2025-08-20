// index.js
// BetterHome New Tab - fitur: waktu akurat, search engine toggle, shortcuts (localStorage),
// drag & drop reorder, add/edit/delete shortcuts, todo list (localStorage),
// toggles: high-colour svg flare, minimal glass mode, power dashboard features.
// Ditulis dalam Bahasa Indonesia, tanpa dependensi eksternal.
// Pastikan index.html mengandung elemen dengan id yang dipakai di sini.

(function () {
  'use strict';

  // ----- Util helpers -----
  const qs = (s, el = document) => el.querySelector(s);
  const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
  const byId = id => document.getElementById(id);

  // ----- Keys for localStorage -----
  const LS_KEYS = {
    shortcuts: 'bh_shortcuts_v1',
    settings: 'bh_settings_v1',
    todos: 'bh_todos_v1',
  };

  // ----- Default data -----
  const DEFAULT_SHORTCUTS = [
    { id: genId(), title: 'Google', url: 'https://www.google.com', icon: 'google' },
    { id: genId(), title: 'Gemini', url: 'https://gemini.google.com', icon: 'gemini' },
    { id: genId(), title: 'AI Studio', url: 'https://aistudio.google.com', icon: 'studio' },
    { id: genId(), title: 'YouTube', url: 'https://youtube.com', icon: 'yt' },
    { id: genId(), title: 'Gmail', url: 'https://mail.google.com', icon: 'mail' },
    { id: genId(), title: 'Drive', url: 'https://drive.google.com', icon: 'drive' },
    { id: genId(), title: 'GitHub', url: 'https://github.com', icon: 'github' },
    { id: genId(), title: 'Twitter', url: 'https://twitter.com', icon: 'twitter' },
  ];

  const DEFAULT_SETTINGS = {
    engine: 'google', // google | gemini | ddg | bing
    flare: true,
    minimalGlass: false,
    powerMode: true,
  };

  // ----- DOM refs -----
  const timeEl = byId('time');
  const dateEl = byId('date');
  const searchInput = byId('search-input');
  const searchForm = byId('search-form') || document.createElement('form');
  const searchGo = byId('search-go');
  const engineBtn = byId('engine-btn');
  const engineIcon = byId('engine-icon');
  const shortcutsWrap = byId('shortcuts');
  const addShortcutBtn = byId('add-shortcut');
  const editShortcutsBtn = byId('edit-shortcuts');
  const resetDefaultsBtn = byId('reset-defaults');
  const dailyQuoteEl = byId('daily-quote');

  const toggleFlare = byId('toggle-flare');
  const toggleClassic = byId('toggle-classic');
  const togglePower = byId('toggle-power');

  const todoListEl = byId('todo-list');
  const todoInput = byId('todo-input');
  const todoAdd = byId('todo-add');

  // ----- App state -----
  let shortcuts = loadJSON(LS_KEYS.shortcuts) || DEFAULT_SHORTCUTS.slice();
  let settings = loadJSON(LS_KEYS.settings) || Object.assign({}, DEFAULT_SETTINGS);
  let todos = loadJSON(LS_KEYS.todos) || [];

  // ----- Initialization -----
  function init() {
    // Apply settings to UI
    applySettingsToUI();

    // Time
    updateTimeAccurate();

    // Search handlers
    bindSearch();

    // Render shortcuts
    renderShortcuts();

    // Bind controls
    addShortcutBtn && addShortcutBtn.addEventListener('click', onAddShortcut);
    editShortcutsBtn && editShortcutsBtn.addEventListener('click', onToggleEditMode);
    resetDefaultsBtn && resetDefaultsBtn.addEventListener('click', onResetDefaults);

    // Toggles
    toggleFlare && toggleFlare.addEventListener('change', onToggleFlare);
    toggleClassic && toggleClassic.addEventListener('change', onToggleClassic);
    togglePower && togglePower.addEventListener('change', onTogglePower);

    // Todo
    todoAdd && todoAdd.addEventListener('click', onAddTodo);
    todoInput && todoInput.addEventListener('keydown', e => { if (e.key === 'Enter') onAddTodo(); });

    // Fetch daily quote
    fetchDailyQuote();

    // Render todo
    renderTodos();

    // Engine selection
    engineBtn && engineBtn.addEventListener('click', onEngineClick);

    // Focus management: keep search focused on load
    searchInput && setTimeout(() => { try { searchInput.focus(); } catch (e) {} }, 200);
  }

  // ----- Time: accurate tick to avoid drift -----
  function updateTimeAccurate() {
    function tick() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      timeEl && (timeEl.textContent = `${hh}:${mm}`);

      dateEl && (dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }));

      // schedule next tick at next full second (plus a tiny buffer)
      const msToNext = 1000 - now.getMilliseconds();
      setTimeout(tick, msToNext + 8);
    }
    tick();
  }

  // ----- Search: set form action or handle submit based on selected engine -----
  function bindSearch() {
    // if index.html uses a <form action="..."> default, we intercept submit to route to engine
    (searchForm || {}).addEventListener && searchForm.addEventListener('submit', onSearchSubmit);

    // search button (legacy) also triggers search
    searchGo && searchGo.addEventListener('click', onSearchSubmit);

    // set initial engine icon
    updateEngineIcon();
  }

  function onSearchSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const q = (searchInput && searchInput.value || '').trim();
    if (!q) return;

    const engine = settings.engine || 'google';
    const url = buildSearchURL(engine, q);
    // open in new tab
    window.open(url, '_blank');
  }

  function buildSearchURL(engine, query) {
    const enc = encodeURIComponent(query);
    switch (engine) {
      case 'gemini':
        // Gemini does not have a classic search redirect UI; default to google search but label gemini
        return `https://www.google.com/search?q=${enc}`;
      case 'ddg':
        return `https://duckduckgo.com/?q=${enc}`;
      case 'bing':
        return `https://www.bing.com/search?q=${enc}`;
      case 'google':
      default:
        return `https://www.google.com/search?q=${enc}`;
    }
  }

  // ----- Engine selection UI -----
  function onEngineClick() {
    // Cycle engines: google -> gemini -> ddg -> bing -> google
    const order = ['google', 'gemini', 'ddg', 'bing'];
    const idx = order.indexOf(settings.engine || 'google');
    const next = order[(idx + 1) % order.length];
    settings.engine = next;
    saveSettings();
    updateEngineIcon();

    // small feedback: aria-expanded transient
    engineBtn && engineBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => engineBtn && engineBtn.setAttribute('aria-expanded', 'false'), 400);
  }

  function updateEngineIcon() {
    // Replace inner svg of engineIcon with simple shapes depending on engine
    if (!engineIcon) return;
    const engine = settings.engine || 'google';
    let html = '';
    if (engine === 'google') {
      html = `<rect x="2" y="2" width="20" height="20" rx="5" fill="url(#engGrad)"></rect>`; // existing gradient in HTML
    } else if (engine === 'gemini') {
      html = `<circle cx="12" cy="12" r="9" fill="#ffd6e1"></circle><path d="M8 12h8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
    } else if (engine === 'ddg') {
      html = `<path d="M4 12h16" stroke="#ffd44d" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="8" r="2.6" fill="#ffd44d"/>`;
    } else if (engine === 'bing') {
      html = `<polygon points="4,4 20,12 4,20" fill="#8fd3f4" />`;
    }
    engineIcon.innerHTML = html;
  }

  // ----- Shortcuts rendering and manipulation (localStorage) -----
  function renderShortcuts() {
    if (!shortcutsWrap) return;
    shortcutsWrap.innerHTML = '';
    shortcuts.forEach((s, idx) => {
      const a = document.createElement('a');
      a.className = 'tile';
      a.setAttribute('draggable', 'true');
      a.dataset.id = s.id;
      a.href = s.url;
      a.target = '_blank';
      a.title = s.title;

      // icon container (SVG can be swapped by icon name)
      const iconWrap = document.createElement('div');
      iconWrap.innerHTML = renderIconSVG(s.icon, settings.flare);
      a.appendChild(iconWrap);

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = s.title;
      a.appendChild(label);

      // context: edit/delete on right-click or long-press in edit mode
      a.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        showShortcutActions(s.id);
      });

      // drag handlers for reorder
      a.addEventListener('dragstart', onDragStart);
      a.addEventListener('dragover', onDragOver);
      a.addEventListener('drop', onDrop);
      a.addEventListener('dragend', onDragEnd);

      shortcutsWrap.appendChild(a);
    });
  }

  function renderIconSVG(icon, flare = true) {
    // Return inline SVG string for small set of icons. Keep them colorful (high colouring diffusion).
    // Icons are intentionally simple shapes with gradient fills present in index.html defs, but we fallback to self-contained gradients.
    switch (icon) {
      case 'google':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">
          <defs>
            <linearGradient id="g_google" x1="0" x2="1"><stop offset="0" stop-color="#F9C2ED"/><stop offset="1" stop-color="#A3C4F3"/></linearGradient>
            <filter id="fg${flare ? 'y' : 'n'}"><feGaussianBlur stdDeviation="${flare ? 3 : 0}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <g filter="url(#fg${flare ? 'y' : 'n'})">
            <rect x="10" y="20" width="80" height="60" rx="12" fill="url(#g_google)"/>
          </g>
        </svg>`;
      case 'gemini':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">
          <defs>
            <radialGradient id="g_gemini" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFDDE1"/><stop offset="1" stop-color="#EE9CA7"/></radialGradient>
            <filter id="fg2"><feGaussianBlur stdDeviation="${flare ? 3.6 : 0}"/><feMerge><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <g filter="url(#fg2)"><path fill="url(#g_gemini)" d="M10 28 L50 6 L90 28 L70 56 L78 94 L50 78 L22 94 L30 56 Z"/></g>
        </svg>`;
      case 'studio':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true">
          <defs><linearGradient id="g_studio" x1="0" x2="1"><stop offset="0" stop-color="#84fab0"/><stop offset="1" stop-color="#8fd3f4"/></linearGradient></defs>
          <g><path d="M30 20 L10 50 L30 80" stroke="url(#g_studio)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M70 20 L90 50 L70 80" stroke="url(#g_studio)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>
        </svg>`;
      case 'yt':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="#FF5A5F"/><path d="M42 35 L70 50 L42 65 Z" fill="#fff"/></svg>`;
      case 'mail':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><rect x="10" y="22" width="80" height="56" rx="8" fill="#9be7ff"/><path d="M14 28 L50 56 L86 28" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
      case 'drive':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><polygon points="50,12 86,68 14,68" fill="#8fd3f4"/></svg>`;
      case 'github':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="12" fill="#111827"/><path d="M35 60c2-8 10-10 15-10s13 2 16 10" stroke="#fff" stroke-width="3" fill="none"/></svg>`;
      case 'twitter':
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><rect x="10" y="10" width="80" height="80" rx="12" fill="#1DA1F2"/><path d="M30 44c8 6 16 2 22-2 6-4 10-6 16-6" stroke="#fff" stroke-width="3" fill="none"/></svg>`;
      default:
        return `<svg viewBox="0 0 100 100" width="56" height="56" aria-hidden="true"><rect x="12" y="12" width="76" height="76" rx="12" fill="#eee"/></svg>`;
    }
  }

  // ----- Drag & drop reorder helpers -----
  let dragSrcId = null;
  function onDragStart(e) {
    dragSrcId = this.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragSrcId); } catch (err) {}
    this.style.opacity = '0.6';
  }
  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
  }
  function onDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const targetId = this.dataset.id;
    const srcId = dragSrcId || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
    if (!srcId || !targetId || srcId === targetId) return;
    // reorder array
    const srcIdx = shortcuts.findIndex(s => s.id === srcId);
    const tgtIdx = shortcuts.findIndex(s => s.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const [moved] = shortcuts.splice(srcIdx, 1);
    shortcuts.splice(tgtIdx, 0, moved);
    saveShortcuts();
    renderShortcuts();
  }
  function onDragEnd(e) {
    this.style.opacity = '';
    dragSrcId = null;
    qsa('.tile').forEach(t => t.classList.remove('drag-over'));
  }

  // ----- Shortcut actions: add/edit/delete -----
  function onAddShortcut() {
    // prompt-based simple UI (can be replaced by dialog/modal)
    const title = prompt('Nama shortcut (contoh: GitHub):');
    if (!title) return;
    const url = prompt('URL lengkap (https://...):', 'https://');
    if (!url) return;
    const icon = prompt('Icon (google, gemini, studio, yt, mail, drive, github, twitter) atau biarkan kosong:', 'google') || 'google';
    const ns = { id: genId(), title: title.trim(), url: url.trim(), icon: icon.trim() };
    shortcuts.unshift(ns); // add to front
    saveShortcuts();
    renderShortcuts();
  }

  function showShortcutActions(id) {
    // basic prompt for actions
    const s = shortcuts.find(x => x.id === id);
    if (!s) return;
    const action = prompt(`Shortcut: ${s.title}\nKetik: edit / delete / cancel`, 'edit');
    if (!action) return;
    if (action.toLowerCase() === 'delete') {
      if (!confirm(`Hapus ${s.title}?`)) return;
      shortcuts = shortcuts.filter(x => x.id !== id);
      saveShortcuts();
      renderShortcuts();
      return;
    }
    if (action.toLowerCase() === 'edit') {
      const newTitle = prompt('Nama baru:', s.title) || s.title;
      const newUrl = prompt('URL baru:', s.url) || s.url;
      const newIcon = prompt('Icon (google, gemini, studio, ...):', s.icon) || s.icon;
      s.title = newTitle.trim();
      s.url = newUrl.trim();
      s.icon = newIcon.trim();
      saveShortcuts();
      renderShortcuts();
      return;
    }
  }

  // ----- Settings toggles -----
  function onToggleFlare(e) {
    settings.flare = !!e.target.checked;
    saveSettings();
    renderShortcuts();
  }
  function onToggleClassic(e) {
    settings.minimalGlass = !!e.target.checked;
    saveSettings();
    // apply class to body to switch CSS modes (index.html CSS must have rules for .minimal-glass)
    document.body.classList.toggle('minimal-glass', settings.minimalGlass);
  }
  function onTogglePower(e) {
    settings.powerMode = !!e.target.checked;
    saveSettings();
    // Show/hide elements (widgets) based on powerMode
    document.querySelectorAll('.side, .widget').forEach(el => {
      el.style.display = settings.powerMode ? '' : 'none';
    });
  }

  function applySettingsToUI() {
    // set toggles if present
    toggleFlare && (toggleFlare.checked = !!settings.flare);
    toggleClassic && (toggleClassic.checked = !!settings.minimalGlass);
    togglePower && (togglePower.checked = !!settings.powerMode);
    // body class for minimalGlass
    document.body.classList.toggle('minimal-glass', !!settings.minimalGlass);
    // hide widgets if powerMode false
    document.querySelectorAll('.side, .widget').forEach(el => {
      el.style.display = settings.powerMode ? '' : 'none';
    });
    updateEngineIcon();
  }

  function onToggleEditMode() {
    // quick edit mode: instructions to user (toggle pointer events for edit)
    alert('Edit mode: klik kanan (atau long-press) pada shortcut untuk edit/hapus. Drag & drop untuk reorder.');
  }

  function onResetDefaults() {
    if (!confirm('Reset semua shortcut dan pengaturan ke default?')) return;
    shortcuts = DEFAULT_SHORTCUTS.slice();
    settings = Object.assign({}, DEFAULT_SETTINGS);
    todos = [];
    saveShortcuts();
    saveSettings();
    saveTodos();
    applySettingsToUI();
    renderShortcuts();
    renderTodos();
    alert('Sudah di-reset ke default.');
  }

  // ----- Todos -----
  function onAddTodo() {
    const v = (todoInput && todoInput.value || '').trim();
    if (!v) return;
    const t = { id: genId(), text: v, done: false, created: Date.now() };
    todos.unshift(t);
    saveTodos();
    renderTodos();
    if (todoInput) todoInput.value = '';
  }
  function renderTodos() {
    if (!todoListEl) return;
    todoListEl.innerHTML = '';
    if (todos.length === 0) {
      todoListEl.innerHTML = '<div style="color:#6b7280">Tidak ada todo.</div>';
      return;
    }
    todos.forEach(t => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '8px';
      row.style.marginBottom = '8px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!t.done;
      cb.addEventListener('change', () => {
        t.done = cb.checked;
        saveTodos();
        renderTodos();
      });
      left.appendChild(cb);
      const span = document.createElement('div');
      span.textContent = t.text;
      span.style.color = t.done ? '#9ca3af' : '#111827';
      left.appendChild(span);

      const del = document.createElement('button');
      del.className = 'btn';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        todos = todos.filter(x => x.id !== t.id);
        saveTodos();
        renderTodos();
      });

      row.appendChild(left);
      row.appendChild(del);
      todoListEl.appendChild(row);
    });
  }

  // ----- Quote fetch (simple & resilient) -----
  function fetchDailyQuote() {
    // Try free quotes API; if fetch fails, fallback to static array.
    const fallback = [
      'Bersikap lembut adalah bentuk keberanian.',
      'Kecantikan dimulai pada saat kamu memutuskan untuk menjadi dirimu sendiri.',
      'Tambah sedikit manis pada harimu.',
    ];
    // Public quotes API (no auth): type.fit
    fetch('https://type.fit/api/quotes')
      .then(r => r.ok ? r.json() : Promise.reject('nope'))
      .then(list => {
        if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
        const pick = list[Math.floor(Math.random() * list.length)];
        dailyQuoteEl && (dailyQuoteEl.textContent = pick.text + (pick.author ? ` — ${pick.author}` : ''));
      })
      .catch(() => {
        const pick = fallback[Math.floor(Math.random() * fallback.length)];
        dailyQuoteEl && (dailyQuoteEl.textContent = pick);
      });
  }

  // ----- Persistence helpers -----
  function saveShortcuts() { try { localStorage.setItem(LS_KEYS.shortcuts, JSON.stringify(shortcuts)); } catch (e) {} }
  function saveSettings() { try { localStorage.setItem(LS_KEYS.settings, JSON.stringify(settings)); } catch (e) {} }
  function saveTodos() { try { localStorage.setItem(LS_KEYS.todos, JSON.stringify(todos)); } catch (e) {} }
  function loadJSON(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

  // ----- Utility -----
  function genId() { return ('id_' + Math.random().toString(36).slice(2, 9)); }

  // ----- Start app -----
  init();

  // expose for debugging on window (optional)
  window.BetterHome = {
    getShortcuts: () => shortcuts,
    getSettings: () => settings,
    getTodos: () => todos,
    saveShortcuts,
    saveSettings,
    saveTodos,
  };

})();