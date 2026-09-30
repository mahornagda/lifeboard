// App core: holds state, persists it, keeps undo history, renders panes + the active view.
import * as S from './store.js';
import { h } from './util.js';
import { VIEWS } from './views/index.js';
import { renderSidebar, renderTopbar, updateTopbar, renderStrip, renderDetail } from './panes.js';
import { openThemeEditor, openSettings, openHelp } from './modals.js';
import * as Sync from './sync.js';

const DATA_KEY = 'life.data.v1';
const UI_KEY = 'life.ui.v1';
const HISTORY_MAX = 80;
const small = () => window.matchMedia('(max-width: 900px)').matches;

const defaultUI = () => ({
  view: 'board', sidebar: !small(), detail: !small(), strip: true,
  focus: null, selected: null, q: '', hideDone: false, detailTab: 'task', listSort: ['theme', 1],
});

function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

export const app = {
  s: S.emptyState(),
  ui: defaultUI(),
  past: [],
  future: [],
  today: S.dateKey(),

  // ---------- state changes ----------
  do(action, ...args) { this.commit(action(this.s, ...args), {}); },
  // Same, but leave the detail pane alone (it is the thing being typed into).
  doQuiet(action, ...args) { this.commit(action(this.s, ...args), { skipDetail: true }); },
  commit(next, { skipDetail = false, record = true } = {}) {
    if (next === this.s) return;
    if (record) {
      this.past = [...this.past.slice(-HISTORY_MAX + 1), this.s];
      this.future = [];
    }
    this.s = next;
    this.save();
    this.render({ skipDetail });
  },
  undo() {
    if (!this.past.length) return this.toast('Nothing to undo');
    this.future = [this.s, ...this.future];
    this.s = this.past[this.past.length - 1];
    this.past = this.past.slice(0, -1);
    this.save(); this.render(); this.toast('Undone');
  },
  redo() {
    if (!this.future.length) return;
    this.past = [...this.past, this.s];
    [this.s] = this.future;
    this.future = this.future.slice(1);
    this.save(); this.render(); this.toast('Redone');
  },
  replaceAll(next, msg) {
    this.commit({ ...S.validate(next), updatedAt: Date.now() });
    if (msg) this.toast(msg);
  },
  save() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(this.s)); } catch { this.toast('Could not save — browser storage is full or blocked'); }
    Sync.schedulePush(this);
  },

  set(patch) {
    this.ui = { ...this.ui, ...patch };
    localStorage.setItem(UI_KEY, JSON.stringify(this.ui));
    this.render();
  },
  select(id) {
    const detail = id ? true : this.ui.detail;
    this.set({ selected: id, detail, detailTab: id ? 'task' : this.ui.detailTab });
  },

  // ---------- lookups ----------
  theme(id) { return this.s.themes.find((t) => t.id === id); },
  task(id) { return this.s.tasks.find((t) => t.id === id); },
  // Themes on screen: not hidden, and matching the sidebar focus if one is set.
  visibleThemes(kind) {
    return this.s.themes.filter((t) => !t.hidden && (!this.ui.focus || t.id === this.ui.focus) && (!kind || t.kind === kind));
  },
  // Tasks on screen for one-off views: visible list themes + search.
  visibleTasks({ includeDone = true } = {}) {
    const ok = new Set(this.visibleThemes('list').map((t) => t.id));
    const q = this.ui.q.trim().toLowerCase();
    return this.s.tasks.filter((t) => ok.has(t.themeId)
      && (includeDone || t.status !== 'done')
      && (!q || t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q)));
  },
  matches(task) {
    const q = this.ui.q.trim().toLowerCase();
    return !q || task.title.toLowerCase().includes(q) || (task.notes || '').toLowerCase().includes(q);
  },

  editTheme(theme) { openThemeEditor(this, theme); },
  settings() { openSettings(this); },
  help() { openHelp(this); },

  toast(msg, action) {
    const root = document.getElementById('toast');
    root.replaceChildren(h('div', { class: 'toast-card' }, msg,
      action ? h('button', { class: 'btn btn-sm', onclick: () => { action.run(); root.replaceChildren(); } }, action.label) : null));
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => root.replaceChildren(), action ? 6000 : 2200);
  },

  // ---------- render ----------
  render({ skipDetail = false } = {}) {
    this.today = S.dateKey();
    if (this.ui.selected && !this.task(this.ui.selected)) this.ui = { ...this.ui, selected: null };
    if (this.ui.focus && !this.theme(this.ui.focus)) this.ui = { ...this.ui, focus: null };
    const root = document.getElementById('app');
    root.classList.toggle('no-sidebar', !this.ui.sidebar);
    root.classList.toggle('no-detail', !this.ui.detail);
    root.classList.toggle('no-strip', !this.ui.strip);
    renderSidebar(this, document.getElementById('sidebar'));
    updateTopbar(this);
    renderStrip(this, document.getElementById('strip'));
    const view = VIEWS.find((v) => v.id === this.ui.view) || VIEWS[0];
    const main = document.getElementById('view');
    const scroll = main.scrollTop;
    main.replaceChildren(view.render(this));
    main.scrollTop = scroll;
    main.dataset.view = view.id;
    if (!skipDetail) renderDetail(this, document.getElementById('detail'));
  },
};

// ---------- keyboard ----------
function onKey(e) {
  const typing = e.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]');
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); return e.shiftKey ? app.redo() : app.undo(); }
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); return document.getElementById('quick').focus(); }
  if (e.key === 'Escape') {
    if (document.querySelector('.modal')) return document.getElementById('modal-root').replaceChildren();
    if (typing) return e.target.blur();
    if (app.ui.selected) return app.select(null);
  }
  if (typing || mod || e.altKey) return;
  const n = Number(e.key);
  if (n >= 1 && n <= VIEWS.length) return app.set({ view: VIEWS[n - 1].id });
  const k = e.key;
  if (k === 'n') { e.preventDefault(); document.getElementById('quick').focus(); }
  else if (k === '/') { e.preventDefault(); document.getElementById('search').focus(); }
  else if (k === '[') app.set({ sidebar: !app.ui.sidebar });
  else if (k === ']') app.set({ detail: !app.ui.detail });
  else if (k === '\\') app.set({ strip: !app.ui.strip });
  else if (k === 't') app.editTheme(null);
  else if (k === 'h') app.set({ hideDone: !app.ui.hideDone });
  else if (k === '?') app.help();
  else if (app.ui.selected && (k === 'x' || k === ' ')) { e.preventDefault(); app.do(S.toggleDone, app.ui.selected); }
  else if (app.ui.selected && (k === 'Delete' || k === 'Backspace')) {
    const t = app.task(app.ui.selected);
    app.do(S.deleteTask, t.id);
    app.toast(`Deleted “${t.title}”`, { label: 'Undo', run: () => app.undo() });
  }
}

// First open from the private link: #seed=<base64 JSON>. The hash never reaches the server.
function consumeSeed() {
  const m = location.hash.match(/seed=([^&]+)/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
    const seed = S.validate(JSON.parse(json));
    const hasData = app.s.themes.length > 0;
    if (!hasData || confirm('Replace what is on this device with the board from this link?')) {
      app.commit({ ...seed, updatedAt: Date.now() }, { record: hasData });
      app.toast('Your board is loaded');
    }
  } catch { app.toast('That link’s board could not be read'); }
}

export async function boot() {
  const saved = load(DATA_KEY, null);
  if (saved) { try { app.s = S.validate(saved); } catch { /* keep empty */ } }
  app.ui = { ...defaultUI(), ...load(UI_KEY, {}) };
  if (small()) app.ui = { ...app.ui, sidebar: false, detail: false };
  renderTopbar(app, document.getElementById('topbar'));
  document.addEventListener('keydown', onKey);
  // Mobile: tapping the dim backdrop closes an overlay pane.
  document.getElementById('scrim').addEventListener('click', () => app.set({ sidebar: false, detail: false }));
  // Tick over midnight so "today" rolls without a reload.
  setInterval(() => { if (S.dateKey() !== app.today) app.render(); }, 60_000);
  consumeSeed();
  app.render();
  await Sync.pullOnBoot(app);
}

