// ── Firebase ──────────────────────────────────────────────
import { initializeApp }                                         from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut,
         signInWithPopup, GoogleAuthProvider,
         signInWithEmailAndPassword,
         createUserWithEmailAndPassword,
         sendPasswordResetEmail }                                from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc }                    from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDgU4B_06t6V6x6bBnfSvKTGSnNDgTMQo8',
  authDomain:        'homework-tracker-761e1.firebaseapp.com',
  projectId:         'homework-tracker-761e1',
  storageBucket:     'homework-tracker-761e1.firebasestorage.app',
  messagingSenderId: '1026373078825',
  appId:             '1:1026373078825:web:73e00e3cbc647583c97138',
  measurementId:     'G-Y67CG1QKTZ',
};

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
let currentUser = null;

// ── Default Subjects ─────────────────────────────────────
// New users start with no classes — they add their own via the 📋 Classes button
const DEFAULT_SUBJECTS = [];

const DEFAULT_SETTINGS = {
  dailyHours: { mon: 2, tue: 2, wed: 2, thu: 2, fri: 2, sat: 3, sun: 3 },
  devMode: false,
};

const CLUBS = {
  theater:     { label: 'Theater',          color: '#8B5CF6' },
  ace:         { label: 'ACE',              color: '#3B82F6' },
  sciolympiad: { label: 'Science Olympiad', color: '#F59E0B' },
  other:       { label: 'Other Club',       color: '#6B7280' },
};
const PERSONAL_COLOR = '#EC4899';

// ── Columns ───────────────────────────────────────────────
const DEFAULT_COLUMNS = [
  { id: 'a', label: 'A-Day', color: '#6366F1' },
  { id: 'b', label: 'B-Day', color: '#059669' },
];

// ── State ─────────────────────────────────────────────────
// (populated from Firestore after login — defaults shown until then)
let columns  = DEFAULT_COLUMNS.map(c => ({ ...c }));
let subjects = DEFAULT_SUBJECTS.map(s => ({ ...s }));
let tasks    = [];
let events   = [];
let theme    = localStorage.getItem('hw-theme') || 'light';

let activeView  = 'board';
let planSubView = 'ranked';   // 'ranked' | 'schedule' | 'stats'
let calView     = 'monthly';
let calDate     = new Date();
let selectedDay = null;
let editingClassId  = null;
let prefilterDay    = null;
let pendingReflectId  = null;  // task id waiting for reflection
const expandedSubtasks = new Set(); // task IDs with checklist panel open

// ── Persist (Firestore) ───────────────────────────────────
function userDocRef() { return doc(db, 'users', currentUser.uid); }
function saveTasks()    { if (currentUser) setDoc(userDocRef(), { tasks },    { merge: true }); }
function saveSubjects() { if (currentUser) setDoc(userDocRef(), { subjects }, { merge: true }); }
function saveEvents()   { if (currentUser) setDoc(userDocRef(), { events },   { merge: true }); }
function saveColumns()  { if (currentUser) setDoc(userDocRef(), { columns },  { merge: true }); }
function getSettings()  { return JSON.parse(localStorage.getItem('hw-settings') || 'null') || { ...DEFAULT_SETTINGS, dailyHours: { ...DEFAULT_SETTINGS.dailyHours } }; }
function saveSettings(s){ localStorage.setItem('hw-settings', JSON.stringify(s)); if (currentUser) setDoc(userDocRef(), { settings: s }, { merge: true }); }

// ── Helpers ───────────────────────────────────────────────
function genId()   { return Math.random().toString(36).slice(2, 10); }
function subjectMap() { return Object.fromEntries(subjects.map(s => [s.id, s])); }
function todayStr()   { return fmtDate(new Date()); }

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function prettyDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
}

function daysUntil(str) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(str + 'T00:00:00');
  return Math.ceil((due - today) / 86400000);
}

function dueLabel(str) {
  if (!str) return { text: '', cls: '' };
  const d = daysUntil(str);
  if (d <  0) return { text: 'Overdue!',            cls: 'overdue' };
  if (d === 0) return { text: 'Due today',           cls: 'soon' };
  if (d <= 2)  return { text: `Due ${prettyDate(str)}`, cls: 'soon' };
  return { text: `Due ${prettyDate(str)}`, cls: '' };
}

function fmtMins(m) {
  if (!m) return '';
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m/60), r = m%60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function starsHtml(n, max=5) {
  if (!n) return '';
  return '★'.repeat(n) + '☆'.repeat(max - n);
}

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Theme ─────────────────────────────────────────────────
function applyTheme(t) {
  theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeToggle').textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('hw-theme', t);
}
document.getElementById('themeToggle').addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark'));

// ── View Switching ────────────────────────────────────────
function showView(v) {
  activeView = v;
  ['board','calendar','plan'].forEach(name => {
    document.getElementById(name + 'View').classList.toggle('hidden', v !== name);
    document.getElementById('btn' + name.charAt(0).toUpperCase() + name.slice(1)).classList.toggle('active', v === name);
  });
  if (v === 'board')    renderBoard();
  if (v === 'calendar') renderCalendar();
  if (v === 'plan')     renderPlan();
}
document.getElementById('btnBoard').addEventListener('click',    () => showView('board'));
document.getElementById('btnCalendar').addEventListener('click', () => showView('calendar'));
document.getElementById('btnPlan').addEventListener('click',     () => showView('plan'));

// ── Subject dropdown (Add Task form) ──────────────────────
function populateSubjectDropdown() {
  const sel = document.getElementById('taskSubject');
  const prev = sel.value;
  sel.innerHTML = subjects.map(s => {
    const col = columns.find(c => c.id === s.day);
    return `<option value="${s.id}">${escHtml(s.label)} (${col ? escHtml(col.label) : s.day})</option>`;
  }).join('');
  if (prev && subjects.find(s => s.id === prev)) sel.value = prev;
}


// ── Board ─────────────────────────────────────────────────
function renderBoard() {
  const container = document.getElementById('boardColumns');

  container.innerHTML = columns.map(col => {
    const subtitle = subjects.filter(s => s.day === col.id).map(s => escHtml(s.label)).join(' · ') || 'No classes';
    const initial  = col.label.charAt(0).toUpperCase();
    return `
      <div class="board-column" data-col="${col.id}">
        <div class="column-header" style="--col-accent:${col.color}">
          <div class="column-title-row">
            <span class="day-pill" style="background:${col.color}">${escHtml(initial)}</span>
            <h2 class="column-title">${escHtml(col.label)}</h2>
            <div class="column-header-actions">
              <button class="column-header-btn customize-col-color-btn" data-id="${col.id}" title="Change color" style="background:${col.color}"></button>
              <button class="column-header-btn rename-col-btn" data-id="${col.id}" title="Rename">✏️</button>
              <button class="column-header-btn danger delete-col-btn" data-id="${col.id}" title="Delete">🗑</button>
            </div>
          </div>
          <p class="column-subtitle">${subtitle}</p>
        </div>
        <div class="column-body" id="col-${col.id}"></div>
        <button class="column-add-btn" data-day="${col.id}">+ Add task</button>
      </div>`;
  }).join('') + `
    <div class="column-add-col" id="addColumnBtn">
      <span class="column-add-col-icon">＋</span>
      <span class="column-add-col-label">Add column</span>
    </div>`;

  columns.forEach(col => renderColumnTasks(col.id));

  container.querySelectorAll('.column-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      prefilterDay = btn.dataset.day;
      openModal();
      const first = subjects.find(s => s.day === prefilterDay);
      if (first) document.getElementById('taskSubject').value = first.id;
    });
  });

  container.querySelectorAll('.customize-col-color-btn').forEach(btn =>
    btn.addEventListener('click', () => openColumnColorPicker(btn.dataset.id, btn))
  );
  container.querySelectorAll('.rename-col-btn').forEach(btn =>
    btn.addEventListener('click', () => renameColumn(btn.dataset.id))
  );
  container.querySelectorAll('.delete-col-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteColumn(btn.dataset.id))
  );
  document.getElementById('addColumnBtn').addEventListener('click', showAddColumnForm);
}

function renderColumnTasks(colId) {
  const container = document.getElementById('col-' + colId);
  if (!container) return;
  const daySubs = subjects.filter(s => s.day === colId);

  if (!daySubs.length) {
    container.innerHTML = `<p class="group-empty" style="padding:16px 13px">No classes here yet!<br>Tap <strong>📋 Classes</strong> in the top right to add yours.</p>`;
    return;
  }

  container.innerHTML = daySubs.map(subj => {
    const subTasks = tasks
      .filter(t => t.subject === subj.id)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.due||'').localeCompare(b.due||'');
      });
    const cards = subTasks.map(t => renderCard(t, subj)).join('');
    const addLabel = subTasks.length ? '+ Add task' : 'No tasks yet — click to add';
    return `
      <div class="subject-group" style="--subject-color:${subj.color}" data-subj="${subj.id}">
        <div class="subject-color-bar"></div>
        <div class="subject-group-header">
          <span class="subject-group-label">${escHtml(subj.label)}</span>
          <span class="subject-group-count">${subTasks.filter(t=>!t.done).length} left</span>
        </div>
        ${cards}
        <div class="inline-add-trigger" data-subj="${subj.id}">${addLabel}</div>
      </div>`;
  }).join('');

  container.querySelectorAll('.card-checkbox').forEach(cb =>
    cb.addEventListener('change', () => handleCheck(cb.dataset.id))
  );
  container.querySelectorAll('.card-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteTask(btn.dataset.id))
  );
  container.querySelectorAll('.card-subtask-btn').forEach(btn =>
    btn.addEventListener('click', () => toggleSubtaskPanel(btn.dataset.id))
  );
  container.querySelectorAll('.subtask-check').forEach(cb =>
    cb.addEventListener('change', () => toggleSubtask(cb.dataset.taskId, cb.dataset.subId))
  );
  container.querySelectorAll('.subtask-del').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); deleteSubtask(btn.dataset.taskId, btn.dataset.subId); })
  );
  container.querySelectorAll('.subtask-add-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); const v = input.value.trim(); if (v) addSubtask(input.dataset.taskId, v); }
      if (e.key === 'Escape') { e.preventDefault(); toggleSubtaskPanel(input.dataset.taskId); }
    });
  });
  container.querySelectorAll('.card-due').forEach(span =>
    span.addEventListener('click', e => { e.stopPropagation(); editDueDate(span); })
  );
  container.querySelectorAll('.inline-add-trigger').forEach(btn =>
    btn.addEventListener('click', () => showInlineAdd(btn.dataset.subj))
  );
}

function showInlineAdd(subjId) {
  const group = document.querySelector(`.subject-group[data-subj="${subjId}"]`);
  if (!group || group.querySelector('.inline-add-form')) return;
  const subj = subjects.find(s => s.id === subjId);
  if (!subj) return;

  const trigger = group.querySelector('.inline-add-trigger');
  const form = document.createElement('div');
  form.className = 'inline-add-form';
  form.innerHTML = `
    <input class="inline-add-name" type="text" placeholder="Task name…" autocomplete="off" />
    <div class="inline-add-meta">
      <input class="inline-add-date" type="date" value="${todayStr()}" />
    </div>
    <div class="inline-add-extras">
      <div class="inline-add-stars-row">
        <span class="inline-add-stars-label">How hard?</span>
        <div class="inline-star-btns">
          <button type="button" class="inline-star" data-val="1">★</button>
          <button type="button" class="inline-star" data-val="2">★</button>
          <button type="button" class="inline-star" data-val="3">★</button>
          <button type="button" class="inline-star" data-val="4">★</button>
          <button type="button" class="inline-star" data-val="5">★</button>
        </div>
        <span class="inline-star-hint">optional</span>
      </div>
      <input class="inline-add-notes" type="text" placeholder="Notes (optional)…" autocomplete="off" />
      <div class="inline-add-actions">
        <button type="button" class="inline-cancel-btn">Cancel</button>
        <button type="button" class="inline-save-btn">Add Task</button>
      </div>
    </div>`;
  trigger.replaceWith(form);
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const nameInput  = form.querySelector('.inline-add-name');
  const dateInput  = form.querySelector('.inline-add-date');
  const notesInput = form.querySelector('.inline-add-notes');
  const starBtns   = form.querySelectorAll('.inline-star');
  const starHint   = form.querySelector('.inline-star-hint');
  let difficulty   = null;
  const diffLabels = ['','Easy','Easy-ish','Medium','Hard','Very Hard'];

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = parseInt(btn.dataset.val);
      starBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) <= difficulty));
      starHint.textContent = diffLabels[difficulty];
    });
    btn.addEventListener('mouseenter', () => {
      starBtns.forEach(b => b.classList.toggle('hover', parseInt(b.dataset.val) <= parseInt(btn.dataset.val)));
    });
  });
  form.querySelector('.inline-star-btns').addEventListener('mouseleave', () => {
    starBtns.forEach(b => b.classList.remove('hover'));
  });

  nameInput.focus();

  function save() {
    const name = nameInput.value.trim();
    if (!name) { cancel(); return; }
    addTask(name, subjId, dateInput.value || null, notesInput.value.trim(), null, difficulty);
  }
  function cancel() { renderColumnTasks(subj.day); }

  form.querySelector('.inline-save-btn').addEventListener('click', save);
  form.querySelector('.inline-cancel-btn').addEventListener('click', cancel);

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  [dateInput, notesInput].forEach(inp => inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  }));
}

function showAddColumnForm() {
  const addBtn = document.getElementById('addColumnBtn');
  const form = document.createElement('div');
  form.className = 'new-column-form';
  form.innerHTML = `
    <span class="new-column-form-title">New Column</span>
    <div class="new-column-form-row">
      <input type="color" id="newColColor" value="#6366F1" class="color-picker" />
      <input type="text" id="newColName" placeholder="e.g. C-Day, Projects…" />
    </div>
    <div class="new-column-form-actions">
      <button class="btn-cancel" id="cancelNewCol" style="padding:7px 14px;font-size:13px">Cancel</button>
      <button class="btn-save"   id="saveNewCol"   style="padding:7px 14px;font-size:13px">Add</button>
    </div>`;
  addBtn.replaceWith(form);
  document.getElementById('newColName').focus();

  document.getElementById('cancelNewCol').addEventListener('click', renderBoard);
  document.getElementById('saveNewCol').addEventListener('click', () => {
    const name = document.getElementById('newColName').value.trim();
    if (!name) { document.getElementById('newColName').focus(); return; }
    columns.push({ id: genId(), label: name, color: document.getElementById('newColColor').value });
    saveColumns();
    renderBoard();
    populateColumnDropdowns();
  });
  document.getElementById('newColName').addEventListener('keydown', e => {
    if (e.key === 'Enter')  document.getElementById('saveNewCol').click();
    if (e.key === 'Escape') renderBoard();
  });
}

function renameColumn(id) {
  const col = columns.find(c => c.id === id);
  if (!col) return;
  const newName = prompt('Rename column:', col.label);
  if (!newName || !newName.trim()) return;
  col.label = newName.trim();
  saveColumns();
  renderBoard();
  populateColumnDropdowns();
  if (activeView === 'calendar') renderLegend();
}

function deleteColumn(id) {
  const col = columns.find(c => c.id === id);
  if (!col) return;
  const colSubjects = subjects.filter(s => s.day === id);
  const colSubjectIds = colSubjects.map(s => s.id);
  const taskCount = tasks.filter(t => colSubjectIds.includes(t.subject)).length;
  let msg = `Delete column "${col.label}"?`;
  if (colSubjects.length)
    msg += `\n\nThis will also remove ${colSubjects.length} class${colSubjects.length>1?'es':''} and their ${taskCount} task${taskCount!==1?'s':''}.`;
  if (!confirm(msg)) return;
  tasks    = tasks.filter(t => !colSubjectIds.includes(t.subject));
  subjects = subjects.filter(s => s.day !== id);
  columns  = columns.filter(c => c.id !== id);
  saveTasks(); saveSubjects(); saveColumns();
  renderBoard();
  populateColumnDropdowns();
  populateSubjectDropdown();
  renderColumnsList();
}

function renderSubtaskPanel(t) {
  const subs = t.subtasks || [];
  const rows = subs.map(s => `
    <label class="subtask-item ${s.done ? 'done' : ''}">
      <input type="checkbox" class="subtask-check" data-task-id="${t.id}" data-sub-id="${s.id}" ${s.done ? 'checked' : ''} />
      <span class="subtask-text">${escHtml(s.text)}</span>
      <button type="button" class="subtask-del" data-task-id="${t.id}" data-sub-id="${s.id}" title="Remove">✕</button>
    </label>`).join('');
  return `<div class="subtask-panel">
    ${rows}
    <div class="subtask-add-row">
      <input class="subtask-add-input" type="text" placeholder="Add a step… (Enter to save)" data-task-id="${t.id}" />
    </div>
  </div>`;
}

function renderCard(t, subj) {
  const due  = dueLabel(t.due);
  const subs = t.subtasks || [];
  const done = subs.filter(s => s.done).length;
  const hasSubs = subs.length > 0;
  const isOpen  = expandedSubtasks.has(t.id);
  const countBadge = hasSubs
    ? `<span class="subtask-count">${done}/${subs.length}</span>`
    : '';
  return `
    <div class="kanban-card ${t.done?'done':''}" data-task-id="${t.id}" style="--subject-color:${subj.color}">
      <div class="card-main-row">
        <input type="checkbox" class="card-checkbox" ${t.done?'checked':''} style="--subject-color:${subj.color}" data-id="${t.id}" />
        <div class="card-body">
          <div class="card-title">${escHtml(t.name)}</div>
          <div class="card-meta">
            ${t.due
              ? `<span class="card-due ${due.cls}" data-id="${t.id}" data-due="${t.due}" title="Click to change date">${due.text}</span>`
              : `<span class="card-due card-due-empty" data-id="${t.id}" data-due="" title="Click to set a due date">No due date</span>`
            }
          </div>
          ${t.notes ? `<div class="card-notes">${escHtml(t.notes)}</div>` : ''}
        </div>
        <button class="card-subtask-btn ${hasSubs?'has-subs':''}" data-id="${t.id}" title="Checklist">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2" width="4" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="5.75" width="4" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="9.5" width="4" height="1.5" rx="0.75" fill="currentColor"/><rect x="7" y="2" width="5" height="1.5" rx="0.75" fill="currentColor"/><rect x="7" y="5.75" width="5" height="1.5" rx="0.75" fill="currentColor"/><rect x="7" y="9.5" width="5" height="1.5" rx="0.75" fill="currentColor"/></svg>
          ${countBadge}
        </button>
        <button class="card-delete" data-id="${t.id}" title="Delete">✕</button>
      </div>
      ${isOpen ? renderSubtaskPanel(t) : ''}
    </div>`;
}

function editDueDate(span) {
  if (span.querySelector('input')) return; // already editing
  const taskId = span.dataset.id;
  const current = span.dataset.due || todayStr();

  const input = document.createElement('input');
  input.type = 'date';
  input.value = current;
  input.className = 'card-due-input';

  span.textContent = '';
  span.appendChild(input);
  input.focus();

  let saved = false;

  function save() {
    if (saved) return;
    saved = true;
    const t = tasks.find(t => t.id === taskId);
    if (t && input.value) {
      t.due = input.value;
      saveTasks();
    }
    renderBoard();
  }
  function cancel() {
    if (saved) return;
    saved = true;
    renderBoard();
  }

  input.addEventListener('change', save);
  input.addEventListener('blur', () => setTimeout(cancel, 150));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
}

// ── Task Actions ──────────────────────────────────────────
function addTask(name, subject, due, notes, estimatedMins, difficulty) {
  tasks.push({ id: genId(), name, subject, due, notes, estimatedMins, difficulty, done: false, created: new Date().toISOString() });
  saveTasks(); renderBoard();
  if (activeView === 'calendar') renderCalendar();
  if (activeView === 'plan')     renderPlan();
}

function handleCheck(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  if (t.done) {
    t.completedAt = new Date().toISOString();
    const s = getSettings();
    if (s.devMode) { pendingReflectId = id; openReflection(t); }
  } else {
    t.completedAt = null;
  }
  saveTasks(); renderBoard();
  if (activeView === 'plan') renderPlan();
}

function deleteTask(id) {
  expandedSubtasks.delete(id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(); renderBoard();
  if (activeView === 'calendar') { renderCalendar(); if (selectedDay) showDayDetail(selectedDay); }
  if (activeView === 'plan') renderPlan();
}

// ── Subtask Actions ───────────────────────────────────────
function toggleSubtaskPanel(taskId) {
  if (expandedSubtasks.has(taskId)) {
    expandedSubtasks.delete(taskId);
  } else {
    expandedSubtasks.add(taskId);
  }
  renderBoard();
  if (expandedSubtasks.has(taskId)) {
    const input = document.querySelector(`.kanban-card[data-task-id="${taskId}"] .subtask-add-input`);
    if (input) input.focus();
  }
}

function addSubtask(taskId, text) {
  const t = tasks.find(t => t.id === taskId);
  if (!t) return;
  if (!t.subtasks) t.subtasks = [];
  t.subtasks.push({ id: genId(), text, done: false });
  saveTasks(); renderBoard();
  const input = document.querySelector(`.kanban-card[data-task-id="${taskId}"] .subtask-add-input`);
  if (input) input.focus();
}

function toggleSubtask(taskId, subId) {
  const t = tasks.find(t => t.id === taskId);
  if (!t || !t.subtasks) return;
  const s = t.subtasks.find(s => s.id === subId);
  if (s) s.done = !s.done;
  saveTasks(); renderBoard();
}

function deleteSubtask(taskId, subId) {
  const t = tasks.find(t => t.id === taskId);
  if (!t || !t.subtasks) return;
  t.subtasks = t.subtasks.filter(s => s.id !== subId);
  saveTasks(); renderBoard();
  const input = document.querySelector(`.kanban-card[data-task-id="${taskId}"] .subtask-add-input`);
  if (input) input.focus();
}

// ── Column dropdown helpers ───────────────────────────────
function populateColumnDropdowns() {
  const opts = columns.map(c => `<option value="${c.id}">${escHtml(c.label)}</option>`).join('');
  document.getElementById('newClassDay').innerHTML = opts;
}

// ── Star Rating (task form difficulty) ───────────────────
function initStarRow(rowId, inputId, hintId) {
  const row   = document.getElementById(rowId);
  const input = document.getElementById(inputId);
  const hint  = hintId ? document.getElementById(hintId) : null;
  const btns  = row.querySelectorAll('.star-btn');
  const labels = ['','Easy','Easy-ish','Medium','Hard','Very Hard'];

  function setVal(val) {
    input.value = val || '';
    btns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.val) <= val));
    if (hint) hint.textContent = val ? labels[val] : 'Tap a star';
  }
  btns.forEach(btn => {
    btn.addEventListener('click',       () => setVal(parseInt(btn.dataset.val)));
    btn.addEventListener('mouseenter',  () => btns.forEach(b => b.classList.toggle('hover', parseInt(b.dataset.val) <= parseInt(btn.dataset.val))));
  });
  row.addEventListener('mouseleave', () => btns.forEach(b => b.classList.remove('hover')));
  return { reset: () => setVal(0), set: setVal };
}

const difficultyStars = initStarRow('difficultyRow', 'taskDifficulty', 'difficultyHint');

// ── Priority Algorithm ────────────────────────────────────
// Compute total available study hours from today up to (and including) dueStr.
function availableHoursUntil(dueStr) {
  const settings  = getSettings();
  const dayKeys   = ['sun','mon','tue','wed','thu','fri','sat'];
  const today     = new Date(); today.setHours(0,0,0,0);
  const due       = new Date(dueStr + 'T00:00:00');
  let total = 0;
  for (let d = new Date(today); d <= due; d.setDate(d.getDate() + 1)) {
    total += settings.dailyHours[dayKeys[d.getDay()]] ?? 2;
  }
  return total;
}

function priorityScore(task, subject) {
  const dueStr      = task.due || todayStr();
  const daysLeft    = daysUntil(dueStr);
  const estHours    = task.estimatedMins ? task.estimatedMins / 60 : 1;
  const avail       = availableHoursUntil(dueStr);

  // Slack: how many spare hours remain after accounting for the work needed.
  // Negative = already in danger (can't finish in time with current schedule).
  const slack       = avail - estHours;

  // Slack score: 0 slack → 100 pts; 10 hrs slack → 0 pts. Capped 0–100.
  const slackScore  = Math.max(0, Math.min(100, Math.round(100 - slack * 9)));

  // Overdue tasks always score 100 urgency regardless of slack.
  const urgencyScore = daysLeft < 0 ? 100 : slackScore;

  // Weight score: hard AND important tasks float to the top (multiplicative).
  // Defaults: difficulty 3/5, subject priority 3/5 if not set.
  const diff        = task.difficulty   ?? 3;
  const prio        = subject?.priority ?? 3;
  const weightScore = Math.round((diff / 5) * (prio / 5) * 100);

  return Math.round(0.60 * urgencyScore + 0.40 * weightScore);
}

function priorityLabel(score) {
  if (score >= 80) return { emoji:'🔴', text:'Do First', cls:'priority-critical' };
  if (score >= 60) return { emoji:'🟠', text:'Do Next',  cls:'priority-high'     };
  if (score >= 40) return { emoji:'🟡', text:'Plan For', cls:'priority-medium'   };
  return                   { emoji:'🟢', text:'Later',   cls:'priority-low'      };
}

// ── Plan View ─────────────────────────────────────────────
function renderPlan() {
  const settings = getSettings();
  const devOn = settings.devMode;

  document.getElementById('btnStats').classList.toggle('hidden', !devOn);
  document.getElementById('devBadge').classList.toggle('hidden', !devOn);

  if (planSubView === 'ranked')   renderRankedList();
  else if (planSubView === 'schedule') renderDailySchedule();
  else if (planSubView === 'stats')    renderStats();
}

document.getElementById('btnRanked').addEventListener('click', () => {
  planSubView = 'ranked';
  document.getElementById('btnRanked').classList.add('active');
  document.getElementById('btnSchedule').classList.remove('active');
  document.getElementById('btnStats').classList.remove('active');
  renderPlan();
});
document.getElementById('btnSchedule').addEventListener('click', () => {
  planSubView = 'schedule';
  document.getElementById('btnSchedule').classList.add('active');
  document.getElementById('btnRanked').classList.remove('active');
  document.getElementById('btnStats').classList.remove('active');
  renderPlan();
});
document.getElementById('btnStats').addEventListener('click', () => {
  planSubView = 'stats';
  document.getElementById('btnStats').classList.add('active');
  document.getElementById('btnRanked').classList.remove('active');
  document.getElementById('btnSchedule').classList.remove('active');
  renderPlan();
});

// ── Ranked List ───────────────────────────────────────────
function renderRankedList() {
  const content = document.getElementById('planContent');
  const sMap    = subjectMap();
  const incomplete = tasks.filter(t => !t.done && t.due);

  if (!incomplete.length) {
    content.innerHTML = `<div class="plan-empty">🎉 All caught up!<br><br>Add some tasks with due dates and they'll appear here, ranked by what to do first.</div>`;
    return;
  }

  const scored = incomplete
    .map(t => ({ ...t, score: priorityScore(t, sMap[t.subject]) }))
    .sort((a, b) => b.score - a.score);

  content.innerHTML = scored.map((t, i) => {
    const subj  = sMap[t.subject] || { label: t.subject, color: '#aaa' };
    const lbl   = priorityLabel(t.score);
    const due   = dueLabel(t.due);
    const stars = t.difficulty ? starsHtml(t.difficulty) : '';
    const est   = t.estimatedMins ? fmtMins(t.estimatedMins) : '';
    return `
      <div class="priority-card">
        <span class="priority-rank">#${i+1}</span>
        <div class="priority-badge">
          <span class="priority-emoji">${lbl.emoji}</span>
          <span class="priority-label ${lbl.cls}">${lbl.text}</span>
        </div>
        <div class="priority-body">
          <div class="priority-title">${escHtml(t.name)}</div>
          <div class="priority-meta">
            <span class="priority-subject" style="background:${subj.color}">${escHtml(subj.label)}</span>
            ${t.due ? `<span class="priority-due ${due.cls}">${due.text}</span>` : ''}
          </div>
          <div class="priority-details">
            ${est   ? `<span class="priority-time">⏱ ${est}</span>` : ''}
            ${stars ? `<span class="priority-stars">${stars}</span>` : ''}
          </div>
        </div>
        <span class="priority-score">${t.score}</span>
      </div>`;
  }).join('');
}

// ── Daily Schedule ────────────────────────────────────────
function buildDailySchedule() {
  const settings  = getSettings();
  const dayKeys   = ['sun','mon','tue','wed','thu','fri','sat'];
  const sMap      = subjectMap();
  const evMap     = eventsByDay();
  const incomplete = tasks.filter(t => !t.done && t.due);
  if (!incomplete.length) return [];

  const scored = incomplete
    .map(t => ({ ...t, score: priorityScore(t, sMap[t.subject]), minsNeeded: t.estimatedMins || 60 }))
    .sort((a, b) => a.due.localeCompare(b.due) || b.score - a.score);

  const today   = new Date(); today.setHours(0,0,0,0);
  const maxDue  = new Date(scored.reduce((m, t) => t.due > m ? t.due : m, fmtDate(today)) + 'T00:00:00');
  const schedule = [];
  const assigned = new Set();

  for (let d = new Date(today); d <= maxDue; d.setDate(d.getDate()+1)) {
    const dateStr    = fmtDate(d);
    const dayKey     = dayKeys[d.getDay()];
    const hoursAvail = settings.dailyHours[dayKey] ?? 2;
    const dayEvs     = evMap[dateStr] || [];
    const eventMins  = dayEvs.reduce((sum, e) => sum + (e.durationMins || 0), 0);
    let availMins    = Math.max(0, hoursAvail * 60 - eventMins);
    const dayTasks   = [];

    // Tasks due today go first (must finish)
    for (const t of scored) {
      if (assigned.has(t.id)) continue;
      if (t.due === dateStr) {
        dayTasks.push(t); assigned.add(t.id); availMins -= t.minsNeeded;
      }
    }
    // Fill remaining time with highest-priority tasks due later
    for (const t of scored) {
      if (assigned.has(t.id)) continue;
      if (t.due > dateStr && availMins >= t.minsNeeded) {
        dayTasks.push(t); assigned.add(t.id); availMins -= t.minsNeeded;
      }
    }

    schedule.push({ date: dateStr, tasks: dayTasks, events: dayEvs, hoursAvail, totalMins: dayTasks.reduce((s,t) => s+t.minsNeeded, 0), eventMins });
  }
  return schedule;
}

function renderDailySchedule() {
  const content  = document.getElementById('planContent');
  const sMap     = subjectMap();
  const today    = todayStr();
  const schedule = buildDailySchedule();

  if (!schedule.length) {
    content.innerHTML = `<div class="plan-empty">No tasks with due dates yet.<br><br>Add tasks and come back to see your daily plan!</div>`;
    return;
  }

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const rows = schedule.map(({ date, tasks: dayTasks, events: dayEvs, hoursAvail, totalMins, eventMins }) => {
    const d        = new Date(date + 'T00:00:00');
    const dayName  = DAYS[d.getDay()];
    const isToday  = date === today;
    const freeLeft = Math.max(0, hoursAvail*60 - totalMins - eventMins);

    const evHtml = dayEvs.map(e => {
      const color = e.category === 'club' ? (CLUBS[e.club]?.color || '#6B7280') : PERSONAL_COLOR;
      const label = e.category === 'club' ? (CLUBS[e.club]?.label || 'Club') : 'Personal';
      return `
        <div class="schedule-task" style="--subject-color:${color}">
          <div class="schedule-task-name">${escHtml(e.title)}</div>
          <div class="schedule-task-meta">
            <span class="schedule-task-subject" style="background:${color}">${label}</span>
            ${e.durationMins ? `<span class="schedule-task-time">⏱ ${fmtMins(e.durationMins)}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    const taskHtml = dayTasks.map(t => {
      const subj = sMap[t.subject] || { label:'?', color:'#aaa' };
      return `
        <div class="schedule-task" style="--subject-color:${subj.color}">
          <div class="schedule-task-name">${escHtml(t.name)}</div>
          <div class="schedule-task-meta">
            <span class="schedule-task-subject" style="background:${subj.color}">${escHtml(subj.label)}</span>
            ${t.estimatedMins ? `<span class="schedule-task-time">⏱ ${fmtMins(t.estimatedMins)}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    const allHtml = evHtml + taskHtml || `<p class="schedule-free">Free day — nothing scheduled</p>`;

    return `
      <div class="schedule-day">
        <div class="schedule-day-header ${isToday?'is-today':''}">
          <div>
            <div class="schedule-day-name">${isToday ? 'Today — ' : ''}${dayName}</div>
            <div class="schedule-day-date">${prettyDate(date)}</div>
          </div>
          <span class="schedule-time-badge">
            ${fmtMins(totalMins)} / ${fmtMins(hoursAvail*60)}
            ${freeLeft > 0 ? ` · ${fmtMins(freeLeft)} free` : ''}
          </span>
        </div>
        <div class="schedule-day-tasks">${allHtml}</div>
      </div>`;
  }).join('');

  content.innerHTML = `
    <div class="schedule-header-row">
      <span style="font-size:12px;color:var(--muted)">Based on your available hours per day.</span>
      <button class="schedule-settings-btn" id="scheduleSettingsBtn">⚙️ Edit Hours</button>
    </div>
    ${rows}`;

  document.getElementById('scheduleSettingsBtn').addEventListener('click', openSettings);
}

// ── Stats (Dev Mode) ──────────────────────────────────────
function renderStats() {
  const content = document.getElementById('planContent');
  const sMap    = subjectMap();
  const done    = tasks.filter(t => t.done && t.completedAt);

  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate()-7);
  const thisWeek   = done.filter(t => new Date(t.completedAt) >= oneWeekAgo).length;
  const withBoth   = done.filter(t => t.estimatedMins && t.actualMins);

  // Overall accuracy
  let accuracyHtml = `<p class="stats-no-data">No completed tasks with time data yet. Check off tasks in Dev Mode to build this up!</p>`;
  if (withBoth.length) {
    const bySubject = {};
    withBoth.forEach(t => {
      if (!bySubject[t.subject]) bySubject[t.subject] = { est: 0, act: 0, n: 0 };
      bySubject[t.subject].est += t.estimatedMins;
      bySubject[t.subject].act += t.actualMins;
      bySubject[t.subject].n++;
    });
    const rows = Object.entries(bySubject).map(([id, { est, act, n }]) => {
      const subj = sMap[id] || { label: id, color: '#aaa' };
      const ratio = act / est;                          // >1 = took longer
      const pct   = Math.min(200, Math.round(ratio*100));
      const cls   = ratio <= 1.1 ? 'good' : ratio <= 1.5 ? 'warn' : 'over';
      const label = ratio <= 1.0 ? '✓ On target' : ratio <= 1.5 ? `+${Math.round((ratio-1)*100)}% longer` : `+${Math.round((ratio-1)*100)}% longer`;
      return `
        <div class="stat-bar-row">
          <span class="stat-bar-label">${escHtml(subj.label)}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill ${cls}" style="width:${Math.min(100,pct/2)}%"></div></div>
          <span class="stat-bar-value">${label}</span>
        </div>`;
    }).join('');
    accuracyHtml = rows;
  }

  // Difficulty per subject
  const withDiff = tasks.filter(t => t.difficulty);
  let diffHtml = `<p class="stats-no-data">No tasks with difficulty ratings yet. Add difficulty when creating tasks!</p>`;
  if (withDiff.length) {
    const bySubj = {};
    withDiff.forEach(t => {
      if (!bySubj[t.subject]) bySubj[t.subject] = { sum: 0, n: 0 };
      bySubj[t.subject].sum += t.difficulty; bySubj[t.subject].n++;
    });
    const sorted = Object.entries(bySubj).sort((a,b) => (b[1].sum/b[1].n) - (a[1].sum/a[1].n));
    diffHtml = sorted.map(([id, { sum, n }]) => {
      const subj = sMap[id] || { label: id };
      const avg  = sum/n;
      const pct  = (avg/5)*100;
      const cls  = avg <= 2 ? 'good' : avg <= 3.5 ? 'warn' : 'over';
      return `
        <div class="stat-bar-row">
          <span class="stat-bar-label">${escHtml(subj.label)}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill ${cls}" style="width:${pct}%"></div></div>
          <span class="stat-bar-value">${starsHtml(Math.round(avg))}</span>
        </div>`;
    }).join('');
  }

  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${thisWeek}</div><div class="stat-label">Done this week</div></div>
      <div class="stat-card"><div class="stat-value">${done.length}</div><div class="stat-label">Total completed</div></div>
      <div class="stat-card"><div class="stat-value">${withBoth.length}</div><div class="stat-label">With time data</div></div>
    </div>

    <p class="stats-section-title">Estimate accuracy (actual vs estimated)</p>
    ${accuracyHtml}

    <p class="stats-section-title" style="margin-top:20px">Difficulty by class</p>
    ${diffHtml}`;
}

// ── Calendar ──────────────────────────────────────────────
function tasksByDay() {
  const map = {};
  tasks.forEach(t => { if (t.due) (map[t.due] = map[t.due]||[]).push(t); });
  return map;
}

function eventsByDay() {
  const map = {};
  events.forEach(e => { if (e.date) (map[e.date] = map[e.date]||[]).push(e); });
  return map;
}

function renderCalendar() {
  document.getElementById('calTitle').textContent = calView === 'monthly'
    ? calDate.toLocaleDateString('en-US', { month:'long', year:'numeric' })
    : weekRangeLabel();
  renderLegend();
  calView === 'monthly' ? renderMonthly() : renderWeekly();
}

function renderLegend() {
  let html = '';
  columns.forEach(col => {
    const colSubjects = subjects.filter(s => s.day === col.id);
    if (!colSubjects.length) return;
    html += `<div class="legend-section-label">${escHtml(col.label)}</div>`;
    html += colSubjects.map(s =>
      `<div class="legend-item"><div class="legend-dot" style="background:${s.color}"></div><span>${escHtml(s.label)}</span></div>`
    ).join('');
  });
  // Subjects not assigned to any column
  const unassigned = subjects.filter(s => !columns.find(c => c.id === s.day));
  if (unassigned.length) {
    html += `<div class="legend-section-label">Other</div>`;
    html += unassigned.map(s =>
      `<div class="legend-item"><div class="legend-dot" style="background:${s.color}"></div><span>${escHtml(s.label)}</span></div>`
    ).join('');
  }
  html += `
    <div class="legend-section-label">Events</div>
    <div class="legend-item"><div class="legend-dot" style="background:#8B5CF6"></div><span>Theater</span></div>
    <div class="legend-item"><div class="legend-dot" style="background:#3B82F6"></div><span>ACE</span></div>
    <div class="legend-item"><div class="legend-dot" style="background:#F59E0B"></div><span>Sci Olympiad</span></div>
    <div class="legend-item"><div class="legend-dot" style="background:${PERSONAL_COLOR}"></div><span>Personal</span></div>
  `;
  document.getElementById('calLegend').innerHTML = html;
}

function renderMonthly() {
  const grid  = document.getElementById('calendarGrid');
  const tMap  = tasksByDay();
  const evMap = eventsByDay();
  const sMap  = subjectMap();
  const today = todayStr();
  const year  = calDate.getFullYear(), month = calDate.getMonth();
  const first = new Date(year, month, 1), last = new Date(year, month+1, 0);
  const days  = [];

  for (let i = first.getDay()-1; i >= 0; i--) days.push({ date: fmtDate(new Date(year,month,-i)), other: true });
  for (let d = 1; d <= last.getDate(); d++) days.push({ date: fmtDate(new Date(year,month,d)), other: false });
  for (let d = 1; days.length < 42; d++) days.push({ date: fmtDate(new Date(year,month+1,d)), other: true });

  grid.innerHTML = `
    <div class="cal-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div class="cal-weekday">${d}</div>`).join('')}</div>
    <div class="cal-days">
      ${days.map(({date,other})=>{
        const taskItems = (tMap[date]||[]).map(t => ({
          name: t.name, color: sMap[t.subject]?.color || '#aaa',
        }));
        const eventItems = (evMap[date]||[]).map(e => ({
          name: e.title, color: e.category === 'club' ? (CLUBS[e.club]?.color || '#6B7280') : PERSONAL_COLOR,
        }));
        const items = [...taskItems, ...eventItems];

        let innerHtml = '';
        if (items.length > 0 && items.length <= 3) {
          innerHtml = `<div class="day-chips">${items.map(it =>
            `<div class="day-chip" style="background:${it.color}" title="${escHtml(it.name)}">${escHtml(it.name)}</div>`
          ).join('')}</div>`;
        } else if (items.length > 3) {
          innerHtml = `<div class="day-dots">${items.map(it =>
            `<div class="day-dot" style="background:${it.color}" title="${escHtml(it.name)}"></div>`
          ).join('')}</div>`;
        }

        return `<div class="cal-day ${other?'other-month':''} ${date===today?'today':''} ${date===selectedDay?'selected':''}" data-date="${date}">
          <div class="day-num">${parseInt(date.split('-')[2])}</div>
          ${innerHtml}
        </div>`;
      }).join('')}
    </div>`;

  grid.querySelectorAll('.cal-day:not(.other-month)').forEach(el =>
    el.addEventListener('click', () => { selectedDay=el.dataset.date; renderMonthly(); showDayDetail(selectedDay); })
  );
}

function weekStart(d) { const r=new Date(d); r.setDate(r.getDate()-r.getDay()); return r; }
function weekRangeLabel() {
  const s = weekStart(calDate), e = new Date(s); e.setDate(e.getDate()+6);
  return `${s.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${e.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
}

function renderWeekly() {
  const grid  = document.getElementById('calendarGrid');
  const tMap  = tasksByDay();
  const evMap = eventsByDay();
  const sMap  = subjectMap();
  const today = todayStr();
  const start = weekStart(calDate);
  const NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const rows = Array.from({length:7}, (_,i) => {
    const d = new Date(start); d.setDate(d.getDate()+i);
    const ds = fmtDate(d);
    const dayTasks  = tMap[ds]  || [];
    const dayEvents = evMap[ds] || [];
    const clubEvs   = dayEvents.filter(e => e.category === 'club');
    const persEvs   = dayEvents.filter(e => e.category === 'personal');

    const hwHtml = dayTasks.length
      ? dayTasks.map(t => {
          const s = sMap[t.subject] || { color:'#aaa', label: t.subject };
          return `<div class="weekly-item">
            <div class="weekly-item-dot" style="background:${s.color}"></div>
            <span class="weekly-item-name" title="${escHtml(t.name)}">${escHtml(t.name)}</span>
            <span class="weekly-item-badge" style="background:${s.color}">${escHtml(s.label)}</span>
          </div>`;
        }).join('')
      : `<span class="weekly-nothing">—</span>`;

    const clubHtml = clubEvs.length
      ? clubEvs.map(e => {
          const c = CLUBS[e.club] || CLUBS.other;
          return `<div class="weekly-item">
            <div class="weekly-item-dot" style="background:${c.color}"></div>
            <span class="weekly-item-name" title="${escHtml(e.title)}">${escHtml(e.title)}</span>
          </div>`;
        }).join('')
      : `<span class="weekly-nothing">—</span>`;

    const persHtml = persEvs.length
      ? persEvs.map(e => `<div class="weekly-item">
          <div class="weekly-item-dot" style="background:${PERSONAL_COLOR}"></div>
          <span class="weekly-item-name" title="${escHtml(e.title)}">${escHtml(e.title)}</span>
        </div>`).join('')
      : `<span class="weekly-nothing">—</span>`;

    return `<div class="weekly-row ${ds===today?'today':''}" data-date="${ds}">
      <div class="weekly-day-cell">
        <div class="weekly-day-name">${NAMES[i]}</div>
        <div class="weekly-day-date">${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
      </div>
      <div class="weekly-data-cell">${hwHtml}</div>
      <div class="weekly-data-cell">${clubHtml}</div>
      <div class="weekly-data-cell">${persHtml}</div>
    </div>`;
  }).join('');

  grid.innerHTML = `
    <div class="weekly-table">
      <div class="weekly-header-row">
        <div class="weekly-th">Day</div>
        <div class="weekly-th">Homework</div>
        <div class="weekly-th">Clubs</div>
        <div class="weekly-th">Personal</div>
      </div>
      ${rows}
    </div>`;

  grid.querySelectorAll('.weekly-row').forEach(el =>
    el.addEventListener('click', () => { selectedDay=el.dataset.date; showDayDetail(selectedDay); })
  );
}

function showDayDetail(dateStr) {
  const sMap = subjectMap();
  const dt   = tasks.filter(t => t.due === dateStr);
  const de   = events.filter(e => e.date === dateStr);

  const taskHtml = dt.map(t => {
    const s    = sMap[t.subject] || { label: t.subject, color: '#aaa' };
    const subs = t.subtasks || [];
    const subsDone = subs.filter(s => s.done).length;

    const meta = [];
    meta.push(`<span class="detail-badge" style="border-left:3px solid ${s.color}">${escHtml(s.label)}</span>`);
    if (t.estimatedMins) meta.push(`<span class="detail-badge">⏱ ${t.estimatedMins >= 60 ? (t.estimatedMins/60 % 1 === 0 ? t.estimatedMins/60 + 'h' : (t.estimatedMins/60).toFixed(1) + 'h') : t.estimatedMins + ' min'}</span>`);
    if (t.difficulty) meta.push(`<span class="detail-stars">${'★'.repeat(t.difficulty)}${'☆'.repeat(5-t.difficulty)}</span>`);
    if (t.done) meta.push(`<span class="detail-badge" style="color:#16a34a;border-color:#bbf7d0">✓ Done</span>`);
    if (subs.length) meta.push(`<span class="detail-badge">☰ ${subsDone}/${subs.length} steps</span>`);

    return `
      <div class="detail-card">
        <div class="detail-color-bar" style="background:${s.color}"></div>
        <div class="detail-card-body">
          <div class="detail-card-title ${t.done ? 'done-title' : ''}">${escHtml(t.name)}</div>
          <div class="detail-card-meta">${meta.join('')}</div>
          ${t.notes ? `<div class="detail-card-notes">${escHtml(t.notes)}</div>` : ''}
          ${subs.length ? `<div class="detail-card-subs">${subs.map(s => `<span style="opacity:${s.done?0.5:1}">${s.done?'✓':'○'} ${escHtml(s.text)}</span>`).join(' · ')}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const eventHtml = de.map(e => {
    const color     = e.category === 'club' ? (CLUBS[e.club]?.color || '#6B7280') : PERSONAL_COLOR;
    const typeLabel = e.category === 'club' ? (CLUBS[e.club]?.label || 'Club') : 'Personal';

    const meta = [];
    meta.push(`<span class="detail-badge event-badge" style="background:${color}">${escHtml(typeLabel)}</span>`);
    if (e.durationMins) meta.push(`<span class="detail-badge">⏱ ${e.durationMins >= 60 ? (e.durationMins/60 % 1 === 0 ? e.durationMins/60 + 'h' : (e.durationMins/60).toFixed(1) + 'h') : e.durationMins + ' min'}</span>`);

    return `
      <div class="detail-card">
        <div class="detail-color-bar" style="background:${color}"></div>
        <div class="detail-card-body">
          <div class="detail-card-title">${escHtml(e.title)}</div>
          <div class="detail-card-meta">${meta.join('')}</div>
          ${e.notes ? `<div class="detail-card-notes">${escHtml(e.notes)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  document.getElementById('dayDetailTitle').textContent = prettyDate(dateStr);
  document.getElementById('dayDetailTasks').innerHTML = (taskHtml + eventHtml) ||
    `<div class="detail-empty">Nothing on this day.</div>`;
  document.getElementById('dayDetail').classList.remove('hidden');
}

function calNav(dir) {
  if (calView==='monthly') calDate=new Date(calDate.getFullYear(),calDate.getMonth()+dir,1);
  else calDate.setDate(calDate.getDate()+dir*7);
  selectedDay=null; document.getElementById('dayDetail').classList.add('hidden'); renderCalendar();
}
document.getElementById('calPrev').addEventListener('click', () => calNav(-1));
document.getElementById('calNext').addEventListener('click', () => calNav(1));
document.getElementById('btnMonthly').addEventListener('click', () => { calView='monthly'; document.getElementById('btnMonthly').classList.add('active'); document.getElementById('btnWeekly').classList.remove('active'); selectedDay=null; document.getElementById('dayDetail').classList.add('hidden'); renderCalendar(); });
document.getElementById('btnWeekly').addEventListener('click',  () => { calView='weekly';  document.getElementById('btnWeekly').classList.add('active');  document.getElementById('btnMonthly').classList.remove('active'); selectedDay=null; document.getElementById('dayDetail').classList.add('hidden'); renderCalendar(); });
document.getElementById('closeDayDetail').addEventListener('click', () => { selectedDay=null; document.getElementById('dayDetail').classList.add('hidden'); renderCalendar(); });

// ── Add Task Modal ────────────────────────────────────────
function openModal()  { document.getElementById('modalOverlay').classList.remove('hidden'); document.getElementById('taskName').focus(); }
function closeModal() { document.getElementById('modalOverlay').classList.add('hidden'); document.getElementById('taskForm').reset(); difficultyStars.reset(); prefilterDay=null; }

document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target===document.getElementById('modalOverlay')) closeModal(); });

document.getElementById('taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const name     = document.getElementById('taskName').value.trim();
  const subject  = document.getElementById('taskSubject').value;
  const due      = document.getElementById('taskDue').value;
  const notes    = document.getElementById('taskNotes').value.trim();
  const est      = parseInt(document.getElementById('taskEstimate').value) || null;
  const diff     = parseInt(document.getElementById('taskDifficulty').value) || null;
  if (!name || !subject || !due) return;
  addTask(name, subject, due, notes, est, diff);
  closeModal();
});

// ── Settings Modal ────────────────────────────────────────
function openSettings() {
  const s = getSettings();
  document.querySelectorAll('.hours-input').forEach(inp => {
    inp.value = s.dailyHours[inp.dataset.day] ?? 2;
  });
  document.getElementById('devModeToggle').checked = s.devMode;
  document.getElementById('settingsOverlay').classList.remove('hidden');
}
function closeSettings() { document.getElementById('settingsOverlay').classList.add('hidden'); }

document.getElementById('openSettings').addEventListener('click', openSettings);
document.getElementById('closeSettings').addEventListener('click', closeSettings);
document.getElementById('cancelSettings').addEventListener('click', closeSettings);
document.getElementById('settingsOverlay').addEventListener('click', e => { if (e.target===document.getElementById('settingsOverlay')) closeSettings(); });

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const s = getSettings();
  document.querySelectorAll('.hours-input').forEach(inp => {
    s.dailyHours[inp.dataset.day] = parseFloat(inp.value) || 0;
  });
  s.devMode = document.getElementById('devModeToggle').checked;
  saveSettings(s);
  closeSettings();
  document.getElementById('devBadge').classList.toggle('hidden', !s.devMode);
  document.getElementById('btnStats').classList.toggle('hidden', !s.devMode);
  if (activeView==='plan') renderPlan();
});

// ── Reflection Popup ──────────────────────────────────────
function openReflection(task) {
  document.getElementById('reflectionTaskName').textContent = `"${task.name}"`;
  document.getElementById('actualMinsInput').value   = '';
  document.getElementById('reflectionNotesInput').value = '';
  document.getElementById('reflectionOverlay').classList.remove('hidden');
}
function closeReflection() {
  document.getElementById('reflectionOverlay').classList.add('hidden');
  pendingReflectId = null;
}
function saveReflection() {
  if (!pendingReflectId) return;
  const t = tasks.find(t => t.id === pendingReflectId);
  if (t) {
    const mins  = parseInt(document.getElementById('actualMinsInput').value) || null;
    const notes = document.getElementById('reflectionNotesInput').value.trim();
    if (mins)  t.actualMins  = mins;
    if (notes) t.reflection  = notes;
    saveTasks();
  }
  closeReflection();
}

document.getElementById('closeReflection').addEventListener('click', closeReflection);
document.getElementById('skipReflection').addEventListener('click',  closeReflection);
document.getElementById('reflectionOverlay').addEventListener('click', e => { if (e.target===document.getElementById('reflectionOverlay')) closeReflection(); });
document.getElementById('reflectionForm').addEventListener('submit', e => { e.preventDefault(); saveReflection(); });

// ── Manage Columns (inside Classes modal) ─────────────────
function renderColumnsList() {
  const container = document.getElementById('columnsList');
  if (!container) return;
  container.innerHTML = columns.map(col => `
    <div class="column-manage-row" data-id="${col.id}">
      <input type="color" class="color-picker col-edit-color" value="${col.color}" data-id="${col.id}" style="width:34px;height:32px;flex-shrink:0" />
      <input type="text"  class="col-edit-name" value="${escHtml(col.label)}" data-id="${col.id}" placeholder="Column name" />
      <button class="btn-save col-save-btn" data-id="${col.id}">Save</button>
      <button class="btn-icon danger col-delete-btn" data-id="${col.id}" title="Delete column">🗑️</button>
    </div>
  `).join('');

  container.querySelectorAll('.col-save-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id;
      const row = container.querySelector(`.column-manage-row[data-id="${id}"]`);
      const name = row.querySelector('.col-edit-name').value.trim();
      if (!name) return;
      const col = columns.find(c => c.id === id);
      if (col) { col.label = name; col.color = row.querySelector('.col-edit-color').value; }
      saveColumns();
      renderBoard();
      populateColumnDropdowns();
      renderClassesList();
      if (activeView === 'calendar') renderLegend();
    });
  });

  container.querySelectorAll('.col-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteColumn(btn.dataset.id))
  );
}

document.getElementById('addColumnModalBtn').addEventListener('click', () => {
  const n = document.getElementById('newColNameModal');
  const name = n.value.trim();
  if (!name) { n.focus(); return; }
  columns.push({ id: genId(), label: name, color: document.getElementById('newColColorModal').value });
  saveColumns();
  n.value = '';
  document.getElementById('newColColorModal').value = '#6366F1';
  renderBoard();
  populateColumnDropdowns();
  renderColumnsList();
});
document.getElementById('newColNameModal').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addColumnModalBtn').click();
});

// ── Manage Classes ────────────────────────────────────────
function openClasses()  { editingClassId=null; populateColumnDropdowns(); renderColumnsList(); renderClassesList(); document.getElementById('classesOverlay').classList.remove('hidden'); }
function closeClasses() { document.getElementById('classesOverlay').classList.add('hidden'); editingClassId=null; }

document.getElementById('openClasses').addEventListener('click', openClasses);
document.getElementById('closeClasses').addEventListener('click', closeClasses);
document.getElementById('classesOverlay').addEventListener('click', e => { if (e.target===document.getElementById('classesOverlay')) closeClasses(); });

function miniStarsHtml(val, id) {
  return [1,2,3,4,5].map(n =>
    `<button class="class-edit-star ${n<=val?'active':''}" data-sid="${id}" data-n="${n}" type="button" title="Priority ${n}">★</button>`
  ).join('');
}

function renderClassesList() {
  const container = document.getElementById('classesList');
  container.innerHTML = subjects.map(s => {
    const count = tasks.filter(t => t.subject===s.id).length;
    const pri   = s.priority || 3;

    if (editingClassId === s.id) {
      return `
        <div class="class-edit-row" data-id="${s.id}">
          <input type="color" class="color-picker edit-color" value="${s.color}" />
          <input type="text"  class="edit-name" value="${escHtml(s.label)}" placeholder="Class name" style="flex:1;min-width:80px" />
          <select class="edit-day" style="padding:6px 8px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text)">
            ${columns.map(c=>`<option value="${c.id}" ${s.day===c.id?'selected':''}>${escHtml(c.label)}</option>`).join('')}
          </select>
          <div class="class-edit-stars">${miniStarsHtml(pri, s.id)}</div>
          <input type="hidden" class="edit-priority" value="${pri}" />
          <button class="btn-save btn-icon-save" data-id="${s.id}" style="padding:6px 12px;font-size:12px">Save</button>
          <button class="btn-cancel btn-icon-cancel" style="padding:6px 10px;font-size:12px">Cancel</button>
        </div>`;
    }
    return `
      <div class="class-row" data-id="${s.id}">
        <div class="class-color-dot" style="background:${s.color}"></div>
        <span class="class-name">${escHtml(s.label)}</span>
        <span class="class-priority-stars" title="Class priority">${'★'.repeat(pri)}</span>
        <span class="class-day-badge" style="background:${columns.find(c=>c.id===s.day)?.color||'#999'}">${escHtml(columns.find(c=>c.id===s.day)?.label||s.day)}</span>
        <span class="class-task-count">${count} task${count!==1?'s':''}</span>
        <div class="class-actions">
          <button class="btn-icon edit-class-btn" data-id="${s.id}" title="Edit">✏️</button>
          <button class="btn-icon danger delete-class-btn" data-id="${s.id}" title="Delete">🗑️</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.edit-class-btn').forEach(btn =>
    btn.addEventListener('click', () => { editingClassId=btn.dataset.id; renderClassesList(); })
  );
  container.querySelectorAll('.delete-class-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const id=btn.dataset.id, count=tasks.filter(t=>t.subject===id).length;
      const subj=subjects.find(s=>s.id===id);
      if (!confirm(count>0?`Delete "${subj.label}"? This removes its ${count} task${count>1?'s':''}.`:`Delete "${subj.label}"?`)) return;
      tasks=tasks.filter(t=>t.subject!==id); subjects=subjects.filter(s=>s.id!==id);
      saveTasks(); saveSubjects(); populateSubjectDropdown(); renderBoard(); renderClassesList();
    })
  );

  // Edit-row star clicks
  container.querySelectorAll('.class-edit-star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.n);
      const row = star.closest('.class-edit-row');
      row.querySelector('.edit-priority').value = val;
      row.querySelectorAll('.class-edit-star').forEach(s => s.classList.toggle('active', parseInt(s.dataset.n)<=val));
    });
  });

  container.querySelectorAll('.btn-icon-save').forEach(btn =>
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id;
      const row = container.querySelector(`.class-edit-row[data-id="${id}"]`);
      const name = row.querySelector('.edit-name').value.trim(); if (!name) return;
      const subj = subjects.find(s=>s.id===id);
      if (subj) {
        subj.label    = name;
        subj.color    = row.querySelector('.edit-color').value;
        subj.day      = row.querySelector('.edit-day').value;
        subj.priority = parseInt(row.querySelector('.edit-priority').value)||3;
      }
      saveSubjects(); populateSubjectDropdown(); renderBoard();
      editingClassId=null; renderClassesList();
    })
  );
  container.querySelectorAll('.btn-icon-cancel').forEach(btn =>
    btn.addEventListener('click', () => { editingClassId=null; renderClassesList(); })
  );
}

document.getElementById('addClassBtn').addEventListener('click', () => {
  const n = document.getElementById('newClassName'), c = document.getElementById('newClassColor'), d = document.getElementById('newClassDay');
  const name = n.value.trim(); if (!name) { n.focus(); return; }
  subjects.push({ id:genId(), label:name, color:c.value, day:d.value, priority:3 });
  saveSubjects(); populateSubjectDropdown(); updateColumnSubtitles();
  n.value=''; c.value='#6366F1';
  renderClassesList(); renderBoard();
});
document.getElementById('newClassName').addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('addClassBtn').click(); });

// ── Add Event Modal ───────────────────────────────────────
function openEvent(prefillDate) {
  document.getElementById('eventDate').value = prefillDate || todayStr();
  document.getElementById('clubGroup').classList.remove('hidden');
  document.getElementById('eventOverlay').classList.remove('hidden');
  document.getElementById('eventTitle').focus();
}
function closeEvent() {
  document.getElementById('eventOverlay').classList.add('hidden');
  document.getElementById('eventForm').reset();
  document.getElementById('clubGroup').classList.remove('hidden');
}

document.getElementById('openEvent').addEventListener('click', () => openEvent());
document.getElementById('closeEvent').addEventListener('click', closeEvent);
document.getElementById('cancelEvent').addEventListener('click', closeEvent);
document.getElementById('eventOverlay').addEventListener('click', e => { if (e.target===document.getElementById('eventOverlay')) closeEvent(); });

document.getElementById('eventCategory').addEventListener('change', e => {
  document.getElementById('clubGroup').classList.toggle('hidden', e.target.value !== 'club');
});

document.getElementById('eventForm').addEventListener('submit', e => {
  e.preventDefault();
  const title    = document.getElementById('eventTitle').value.trim();
  const date     = document.getElementById('eventDate').value;
  const category = document.getElementById('eventCategory').value;
  const club     = category === 'club' ? document.getElementById('eventClub').value : null;
  const duration = parseInt(document.getElementById('eventDuration').value) || null;
  const notes    = document.getElementById('eventNotes').value.trim();
  if (!title || !date) return;
  events.push({ id: genId(), title, date, category, club, durationMins: duration, notes });
  saveEvents();
  closeEvent();
  if (activeView === 'calendar') renderCalendar();
  if (activeView === 'plan')     renderPlan();
});

// ── Customize ─────────────────────────────────────────────
const GRADIENTS = [
  { name: 'Indigo',    value: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { name: 'Sunrise',   value: 'linear-gradient(135deg,#f97316,#ec4899)' },
  { name: 'Ocean',     value: 'linear-gradient(135deg,#0ea5e9,#14b8a6)' },
  { name: 'Forest',    value: 'linear-gradient(135deg,#22c55e,#059669)' },
  { name: 'Rose',      value: 'linear-gradient(135deg,#f43f5e,#fb7185)' },
  { name: 'Slate',     value: 'linear-gradient(135deg,#475569,#1e293b)' },
  { name: 'Peach',     value: 'linear-gradient(135deg,#fbbf24,#f87171)' },
  { name: 'Night',     value: 'linear-gradient(135deg,#1e1b4b,#7c3aed)' },
];

function getStyle() {
  return JSON.parse(localStorage.getItem('hw-style') || 'null') || { bg: null, font: 'Inter', boardTitle: 'Milanote 2.0', boardEmoji: '📚' };
}
function saveStyle(s) { localStorage.setItem('hw-style', JSON.stringify(s)); }

function applyBg(bg) {
  if (!bg) {
    document.body.style.background = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    return;
  }
  if (bg.startsWith('url(')) {
    document.body.style.background = bg;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  } else {
    document.body.style.background = bg;
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
  }
}

function applyStyle() {
  const s = getStyle();
  applyBg(s.bg);
  document.documentElement.style.setProperty('--font-family', `'${s.font || 'Inter'}', sans-serif`);
  const logoEl = document.querySelector('.logo');
  const titleEl = document.querySelector('.header h1');
  if (logoEl)  logoEl.textContent  = s.boardEmoji || '📚';
  if (titleEl) titleEl.textContent = s.boardTitle  || 'Milanote 2.0';
}

let customizeMode = false;

function toggleCustomizeMode() {
  customizeMode = !customizeMode;
  document.body.classList.toggle('customize-mode', customizeMode);
  document.getElementById('openCustomize').classList.toggle('customize-active', customizeMode);
  const panel = document.getElementById('customizePanel');
  panel.classList.toggle('hidden', !customizeMode);
  if (customizeMode) syncCustomizePanelToStyle();
}

function syncCustomizePanelToStyle() {
  const s = getStyle();
  document.querySelectorAll('.customize-font-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.font === (s.font || 'Inter'))
  );
  document.getElementById('customizeEmoji').value       = s.boardEmoji || '📚';
  document.getElementById('customizeTitleInput').value  = s.boardTitle  || 'Milanote 2.0';
  const bg = s.bg || '';
  if (!bg || bg.match(/^#|^rgb/)) {
    activateBgTab('color');
    if (bg) document.getElementById('bgColorPicker').value = bg.slice(0, 7);
  } else if (bg.match(/^linear-gradient|^radial-gradient/)) {
    activateBgTab('gradient');
    document.querySelectorAll('.gradient-swatch').forEach(sw =>
      sw.classList.toggle('active', sw.dataset.gradient === bg)
    );
  } else if (bg.startsWith('url(')) {
    activateBgTab('image');
  }
}

function activateBgTab(tab) {
  document.querySelectorAll('.customize-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.getElementById('bgTabColor').classList.toggle('hidden',    tab !== 'color');
  document.getElementById('bgTabGradient').classList.toggle('hidden', tab !== 'gradient');
  document.getElementById('bgTabImage').classList.toggle('hidden',    tab !== 'image');
}

// Build gradient swatches
(function buildGradientSwatches() {
  const grid = document.getElementById('gradientSwatches');
  GRADIENTS.forEach(g => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gradient-swatch';
    btn.style.background = g.value;
    btn.dataset.gradient = g.value;
    btn.title = g.name;
    btn.addEventListener('click', () => {
      const s = getStyle(); s.bg = g.value; saveStyle(s); applyBg(g.value);
      document.querySelectorAll('.gradient-swatch').forEach(sw => sw.classList.toggle('active', sw === btn));
    });
    grid.appendChild(btn);
  });
})();

// Background tab switching
document.querySelectorAll('.customize-tab').forEach(tab =>
  tab.addEventListener('click', () => activateBgTab(tab.dataset.tab))
);

// Color picker
document.getElementById('bgColorPicker').addEventListener('input', e => {
  const s = getStyle(); s.bg = e.target.value; saveStyle(s); applyBg(e.target.value);
  document.querySelectorAll('.gradient-swatch').forEach(sw => sw.classList.remove('active'));
});

// Image URL
document.getElementById('bgImageUrl').addEventListener('change', e => {
  const url = e.target.value.trim();
  if (!url) return;
  const bg = `url(${url})`;
  const s = getStyle(); s.bg = bg; saveStyle(s); applyBg(bg);
});
document.getElementById('bgImageUrl').addEventListener('keydown', e => {
  if (e.key === 'Enter') e.target.dispatchEvent(new Event('change'));
});

// File upload
document.getElementById('bgImageUpload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const bg = `url(${ev.target.result})`;
    const s = getStyle(); s.bg = bg; saveStyle(s); applyBg(bg);
  };
  reader.readAsDataURL(file);
});

// BG reset
document.getElementById('bgReset').addEventListener('click', () => {
  const s = getStyle(); s.bg = null; saveStyle(s); applyBg(null);
  document.getElementById('bgColorPicker').value = '#ede8df';
  document.querySelectorAll('.gradient-swatch').forEach(sw => sw.classList.remove('active'));
  document.getElementById('bgImageUrl').value = '';
});

// Font pills
document.querySelectorAll('.customize-font-pill').forEach(pill =>
  pill.addEventListener('click', () => {
    const font = pill.dataset.font;
    const s = getStyle(); s.font = font; saveStyle(s);
    document.documentElement.style.setProperty('--font-family', `'${font}', sans-serif`);
    document.querySelectorAll('.customize-font-pill').forEach(p => p.classList.toggle('active', p === pill));
  })
);

// Title / Emoji
document.getElementById('customizeTitleInput').addEventListener('input', e => {
  const s = getStyle(); s.boardTitle = e.target.value || 'Milanote 2.0'; saveStyle(s);
  const titleEl = document.querySelector('.header h1');
  if (titleEl) titleEl.textContent = s.boardTitle;
});
document.getElementById('customizeEmoji').addEventListener('input', e => {
  const s = getStyle(); s.boardEmoji = e.target.value || '📚'; saveStyle(s);
  const logoEl = document.querySelector('.logo');
  if (logoEl) logoEl.textContent = s.boardEmoji;
});
document.getElementById('titleReset').addEventListener('click', () => {
  const s = getStyle(); s.boardTitle = 'Milanote 2.0'; s.boardEmoji = '📚'; saveStyle(s);
  document.getElementById('customizeTitleInput').value = 'Milanote 2.0';
  document.getElementById('customizeEmoji').value = '📚';
  document.querySelector('.header h1').textContent = 'Milanote 2.0';
  document.querySelector('.logo').textContent = '📚';
});

// Close panel
document.getElementById('openCustomize').addEventListener('click', toggleCustomizeMode);
document.getElementById('closeCustomizePanel').addEventListener('click', toggleCustomizeMode);

// Column color picker
function openColumnColorPicker(colId, swatchBtn) {
  const col = columns.find(c => c.id === colId);
  if (!col) return;
  const input = document.createElement('input');
  input.type = 'color';
  input.value = col.color;
  input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0;';
  document.body.appendChild(input);
  input.addEventListener('input', e => {
    col.color = e.target.value;
    swatchBtn.style.background = col.color;
    const pill = swatchBtn.closest('.board-column')?.querySelector('.day-pill');
    if (pill) pill.style.background = col.color;
  });
  input.addEventListener('change', () => {
    saveColumns();
    renderBoard();
    if (document.body.contains(input)) document.body.removeChild(input);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { if (document.body.contains(input)) document.body.removeChild(input); }, 200);
  });
  input.click();
}

// ── Firebase Auth + Init ──────────────────────────────────
function mergeSubjects(raw) {
  return raw.map(s => {
    const def = DEFAULT_SUBJECTS.find(d => d.id === s.id);
    return { priority: 3, ...(def || {}), ...s, day: s.day || (def ? def.day : 'a') };
  });
}

async function loadUserData() {
  const ref  = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const d = snap.data();
    if (d.columns)  columns  = d.columns;
    if (d.subjects) subjects = mergeSubjects(d.subjects);
    if (d.tasks)    tasks    = d.tasks;
    if (d.events)   events   = d.events;
    if (d.settings) localStorage.setItem('hw-settings', JSON.stringify(d.settings));
  } else {
    // First sign-in — migrate any existing localStorage data, then save to cloud
    const lsTasks    = JSON.parse(localStorage.getItem('hw-tasks')    || '[]');
    const lsSubjects = JSON.parse(localStorage.getItem('hw-subjects') || 'null');
    const lsColumns  = JSON.parse(localStorage.getItem('hw-columns')  || 'null');
    const lsEvents   = JSON.parse(localStorage.getItem('hw-events')   || '[]');
    const lsSettings = JSON.parse(localStorage.getItem('hw-settings') || 'null');
    if (lsTasks.length || lsSubjects || lsColumns) {
      tasks   = lsTasks;
      if (lsSubjects) subjects = mergeSubjects(lsSubjects);
      if (lsColumns)  columns  = lsColumns;
      events  = lsEvents;
    }
    await setDoc(ref, {
      tasks, subjects, columns, events,
      settings: lsSettings || { ...DEFAULT_SETTINGS, dailyHours: { ...DEFAULT_SETTINGS.dailyHours } },
    });
  }
}

function initApp() {
  applyStyle();
  applyTheme(theme);
  saveSubjects();
  saveColumns();
  populateSubjectDropdown();
  populateColumnDropdowns();
  const s = getSettings();
  document.getElementById('devBadge').classList.toggle('hidden', !s.devMode);
  document.getElementById('btnStats').classList.toggle('hidden',  !s.devMode);
  renderBoard();
}

// ── Sign-out button ───────────────────────────────────────
document.getElementById('signOutBtn').addEventListener('click', () => signOut(auth));

// ── Login screen logic ────────────────────────────────────
const loginOverlay  = document.getElementById('loginOverlay');
const mainApp       = document.getElementById('mainApp');
const loginError    = document.getElementById('loginError');
const loginEmailSec = document.getElementById('loginEmailSection');
const googleProvider = new GoogleAuthProvider();

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}
function clearLoginError() { loginError.classList.add('hidden'); }

document.getElementById('btnGoogleSignIn').addEventListener('click', async () => {
  clearLoginError();
  try { await signInWithPopup(auth, googleProvider); }
  catch (e) { showLoginError('Google sign-in failed. Try again.'); }
});

document.getElementById('btnShowEmail').addEventListener('click', () => {
  loginEmailSec.classList.toggle('hidden');
  clearLoginError();
});

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearLoginError();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const isSignUp = document.getElementById('loginModeToggle').dataset.mode === 'signup';
  try {
    if (isSignUp) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (e) {
    const msgs = {
      'auth/user-not-found':   'No account found with that email.',
      'auth/wrong-password':   'Wrong password. Try again.',
      'auth/email-already-in-use': 'That email is already registered. Sign in instead.',
      'auth/weak-password':    'Password must be at least 6 characters.',
      'auth/invalid-email':    'Please enter a valid email address.',
      'auth/invalid-credential': 'Wrong email or password.',
    };
    showLoginError(msgs[e.code] || 'Something went wrong. Try again.');
  }
});

document.getElementById('btnForgotPassword').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const msg   = document.getElementById('forgotMsg');
  if (!email) { msg.textContent = 'Type your email above first, then click Forgot password.'; msg.classList.remove('hidden'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    msg.textContent = '✅ Reset email sent! Check your inbox.';
  } catch (e) {
    msg.textContent = 'Could not send reset email. Check the address and try again.';
  }
  msg.classList.remove('hidden');
});

document.getElementById('loginModeToggle').addEventListener('click', e => {
  const btn     = e.currentTarget;
  const isSignUp = btn.dataset.mode !== 'signup';
  btn.dataset.mode = isSignUp ? 'signup' : 'signin';
  btn.textContent  = isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one";
  document.getElementById('loginSubmitBtn').textContent = isSignUp ? 'Create Account' : 'Sign In';
  clearLoginError();
});

// ── Auth state watcher (runs the whole app) ───────────────
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    await loadUserData();
    loginOverlay.classList.add('hidden');
    mainApp.classList.remove('hidden');
    initApp();
  } else {
    currentUser = null;
    mainApp.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    // reset state so next user starts fresh
    columns  = DEFAULT_COLUMNS.map(c => ({ ...c }));
    subjects = DEFAULT_SUBJECTS.map(s => ({ ...s }));
    tasks    = [];
    events   = [];
  }
});
