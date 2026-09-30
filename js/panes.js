// The four hideable panes around the view: sidebar [ , top strip \ , detail ] — plus the fixed top bar.
import * as S from './store.js';
import { h, icon, themeVars, setVars, draggable, dropzone, debounce, prettyTs, makeEditable } from './util.js';
import { VIEWS } from './views/index.js';
import { quickAdd } from './views/flow.js';
import { themeChip, checkbox } from './components.js';
import { latestWord, WORD_ID } from './digest.js';

const KIND_HINT = { task: 'Tick off once', daily: 'Tick every day — builds a streak', progress: 'Log a number over time, with a chart' };
import * as Sync from './sync.js';

// ---------- sidebar ----------
export function renderSidebar(app, el) {
  const counts = {
    today: app.visibleTasks({ includeDone: false }).filter((t) => t.urgent || t.status === 'doing' || (t.due && t.due <= app.today)).length,
    kanban: app.visibleTasks({ includeDone: false }).length,
  };
  const nav = VIEWS.map((v, i) => h('button', {
    class: `nav ${app.ui.view === v.id ? 'active' : ''}`, onclick: () => { app.set({ view: v.id, ...(mobile() ? { sidebar: false } : {}) }); },
  }, icon(v.icon), h('span', { class: 'nav-label' }, v.label), counts[v.id] ? h('span', { class: 'count' }, counts[v.id]) : null, h('kbd', null, String(i + 1))));

  const themes = app.s.themes.map((t) => {
    // Open to-dos + daily/tracked items: everything in the theme that isn't finished.
    const open = app.s.tasks.filter((x) => x.themeId === t.id && !(x.kind === 'task' && x.status === 'done')).length;
    const row = h('div', {
      class: `theme-row ${app.ui.focus === t.id ? 'focused' : ''} ${t.hidden ? 'is-hidden' : ''}`,
      title: 'Click to show only this theme · drag to reorder · drop a task here to move it',
      onclick: () => app.set({ focus: app.ui.focus === t.id ? null : t.id }),
    },
    h('i', { class: 'swatch' }), h('span', { class: 'theme-name' }, t.name), h('span', { class: 'count' }, open),
    h('button', { class: 'icon-btn', title: t.hidden ? 'Show on board' : 'Hide from all views', onclick: (e) => { e.stopPropagation(); app.do(S.updateTheme, t.id, { hidden: !t.hidden }); } }, icon(t.hidden ? 'eyeoff' : 'eye', 14)),
    h('button', { class: 'icon-btn', title: 'Edit theme', onclick: (e) => { e.stopPropagation(); app.editTheme(t); } }, icon('dots', 14)));
    setVars(row, themeVars(t));
    draggable(row, 'theme', t.id);
    dropzone(row, ['theme', 'task'], (d) => (d.type === 'theme' ? app.do(S.moveTheme, d.id, t.id) : app.do(S.moveTask, d.id, { themeId: t.id })));
    return row;
  });

  el.replaceChildren(
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, 'L'), h('span', null, 'Life', h('b', null, 'board')),
      h('button', { class: 'icon-btn close-pane', title: 'Hide sidebar  [', onclick: () => app.set({ sidebar: false }) }, icon('x', 16))),
    h('nav', { class: 'nav-list' }, nav),
    h('div', { class: 'side-section' },
      h('div', { class: 'side-head' }, h('span', null, 'Themes'), h('button', { class: 'icon-btn', title: 'New theme  (t)', onclick: () => app.editTheme(null) }, icon('plus', 16)))),
    h('div', { class: 'theme-list' }, themes),
    wishlist(app),
    h('div', { class: 'side-foot' },
      h('button', { class: 'nav', onclick: () => app.settings() }, icon('cloud'), h('span', { class: 'nav-label' }, 'Sync & backup'), h('span', { class: `sync-dot ${Sync.status()}` })),
      h('button', { class: 'nav', onclick: () => app.help() }, icon('key'), h('span', { class: 'nav-label' }, 'Shortcuts'), h('kbd', null, '?'))));
}
const mobile = () => window.matchMedia('(max-width: 900px)').matches;

// "Things to add to DB": ideas for the dashboard itself. Collapsible; tick when built.
function wishlist(app) {
  const items = app.s.wishlist || [];
  const open = !app.ui.wishClosed;
  const add = h('input', { class: 'inline-add wish-add', placeholder: 'Add an idea…', 'aria-label': 'Add a dashboard idea' });
  add.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && add.value.trim()) { app.do(S.addWish, { title: add.value }); requestAnimationFrame(() => document.querySelector('.wish-add')?.focus()); }
    if (e.key === 'Escape') add.blur();
  });
  return h('div', { class: 'side-section wish' },
    h('button', { class: 'side-head wish-head', 'aria-expanded': String(open), onclick: () => app.set({ wishClosed: open }) },
      h('span', null, 'Things to add to DB'), h('span', { class: 'row gap' }, h('span', { class: 'count' }, items.filter((w) => !w.done).length), h('span', { class: open ? '' : 'rot' }, icon('chev', 14)))),
    open ? h('div', { class: 'wish-list' },
      items.map((w) => {
        const title = h('span', { class: 'task-title' }, w.title);
        makeEditable(title, (txt) => app.do(S.updateWish, w.id, { title: txt }));
        return h('div', { class: `wish-row ${w.done ? 'is-done' : ''}` },
          checkbox(w.done, () => app.do(S.toggleWish, w.id), `Built: ${w.title}`), title,
          h('button', { class: 'icon-btn', title: 'Remove', onclick: () => app.do(S.deleteWish, w.id) }, icon('x', 12)));
      }), add) : null);
}

// ---------- top bar (built once; inputs keep focus across re-renders) ----------
export function renderTopbar(app, el) {
  const quick = h('input', { id: 'quick', class: 'quick', autocomplete: 'off', placeholder: 'Add a task…  “finance: pay rent ! @fri”', 'aria-label': 'Quick add a task' });
  quick.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && quick.value.trim()) {
      const fallback = app.ui.focus || app.visibleThemes()[0]?.id || app.s.themes[0]?.id;
      quickAdd(app, quick.value, fallback);
      quick.value = '';
    }
    if (e.key === 'Escape') quick.blur();
  });
  const search = h('input', { id: 'search', class: 'search', type: 'search', placeholder: 'Search  /', 'aria-label': 'Search tasks' });
  const onSearch = debounce(() => app.set({ q: search.value }), 120);
  search.addEventListener('input', onSearch);
  search.value = app.ui.q;

  const tog = (key, ic, tip) => h('button', { class: 'icon-btn tog', 'data-tog': key, title: tip, onclick: () => app.set({ [key]: !app.ui[key] }) }, icon(ic));
  el.replaceChildren(
    tog('sidebar', 'sidebar', 'Sidebar  ['),
    h('label', { class: 'quick-wrap' }, icon('plus', 16), quick, h('kbd', null, 'n')),
    h('label', { class: 'search-wrap' }, icon('search', 16), search),
    h('div', { class: 'top-actions' },
      h('button', { class: 'icon-btn', id: 'undo', title: 'Undo  ⌘Z', onclick: () => app.undo() }, icon('undo')),
      h('button', { class: 'icon-btn', id: 'redo', title: 'Redo  ⇧⌘Z', onclick: () => app.redo() }, icon('redo')),
      h('button', { class: 'btn btn-sm', id: 'hide-done', title: 'Hide / show done tasks  (h)', onclick: () => app.set({ hideDone: !app.ui.hideDone }) }),
      h('span', { class: 'sep' }),
      tog('strip', 'strip', 'Today strip  \\'),
      tog('detail', 'detail', 'Detail pane  ]')));
}

export function updateTopbar(app) {
  document.getElementById('undo').disabled = !app.past.length;
  document.getElementById('redo').disabled = !app.future.length;
  document.getElementById('hide-done').textContent = app.ui.hideDone ? 'Done: hidden' : 'Done: shown';
  document.querySelectorAll('[data-tog]').forEach((b) => b.classList.toggle('active', Boolean(app.ui[b.dataset.tog])));
  const search = document.getElementById('search');
  if (document.activeElement !== search) search.value = app.ui.q;
  document.getElementById('scrim').classList.toggle('show', mobile() && (app.ui.sidebar || app.ui.detail));
}

// ---------- today strip ----------
export function renderStrip(app, el) {
  if (!app.ui.strip) { el.replaceChildren(); return; }
  const daily = app.itemsOf('daily');
  const open = app.visibleTasks({ includeDone: false });
  const late = open.filter((t) => t.due && t.due < app.today).length;
  const urgent = open.filter((t) => t.urgent).length;
  const doing = open.filter((t) => t.status === 'doing').length;
  const trainIds = new Set(app.itemsOf('progress').map((t) => t.id));
  const trainedToday = new Set(app.s.logs.filter((l) => l.date === app.today && trainIds.has(l.taskId)).map((l) => l.taskId)).size;
  const pill = (n, label, cls, view) => h('button', { class: `pill ${cls} ${n ? '' : 'zero'}`, onclick: () => app.set({ view }) }, h('b', null, n), ` ${label}`);
  el.replaceChildren(h('div', { class: 'strip' },
    h('span', { class: 'strip-label' }, 'Today'),
    h('div', { class: 'strip-dots' }, daily.map((t) => {
      const on = S.isChecked(app.s, app.today, t.id);
      return setVars(h('button', { class: `sdot ${on ? 'on' : ''}`, title: `${t.title}${on ? ' ✓' : ' — click when done'}`, onclick: () => app.do(S.toggleCheck, app.today, t.id) },
        h('span', null, t.title)), themeVars(app.theme(t.themeId)));
    })),
    h('span', { class: 'sep' }),
    pill(late, 'late', 'p-late', 'today'), pill(urgent, 'urgent', 'p-urgent', 'matrix'), pill(doing, 'doing', 'p-doing', 'kanban'),
    trainIds.size ? pill(`${trainedToday}/${trainIds.size}`, 'trained', 'p-train', 'training') : null,
    wordPill(app),
    h('button', { class: 'icon-btn close-pane', title: 'Hide strip  \\', onclick: () => app.set({ strip: false }) }, icon('x', 14))));
}

function wordPill(app) {
  const w = latestWord();
  if (!w) return null;
  const seen = S.isChecked(app.s, w.date, WORD_ID);
  return h('button', { class: `pill ${seen ? 'p-seen' : 'p-word'}`, title: 'Word of the day — open the Digest', onclick: () => app.set({ view: 'digest' }) },
    seen ? '✓ ' : '', h('b', null, w.word));
}

// ---------- detail pane ----------
export function renderDetail(app, el) {
  if (!app.ui.detail) { el.replaceChildren(); return; }
  const tabs = [['task', 'Task'], ['notes', 'Notes'], ['stats', 'Stats']];
  const body = app.ui.detailTab === 'notes' ? notesTab(app) : app.ui.detailTab === 'stats' ? statsTab(app) : taskTab(app);
  el.replaceChildren(
    h('div', { class: 'detail-head' },
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(app.ui.detailTab === k), class: `tab ${app.ui.detailTab === k ? 'active' : ''}`, onclick: () => app.set({ detailTab: k }) }, l))),
      h('button', { class: 'icon-btn', title: 'Hide pane  ]', onclick: () => app.set({ detail: false }) }, icon('x', 16))),
    h('div', { class: 'detail-body' }, body));
}

function taskTab(app) {
  const t = app.task(app.ui.selected);
  if (!t) {
    return h('div', { class: 'detail-empty' },
      h('div', { class: 'big-glyph' }, '↖'),
      h('p', null, h('b', null, 'Click any task'), ' to edit it here.'),
      h('ul', { class: 'tips' },
        h('li', null, 'Double-click a title to rename in place'),
        h('li', null, 'Drag tasks between boxes, columns or squares'),
        h('li', null, 'Drag a box by its header to rearrange the board'),
        h('li', null, h('kbd', null, 'n'), ' quick add  ', h('kbd', null, '?'), ' all shortcuts')));
  }
  const theme = app.theme(t.themeId);
  const saveTitle = debounce((v) => v.trim() && app.doQuiet(S.updateTask, t.id, { title: v.trim() }), 350);
  const saveNotes = debounce((v) => app.doQuiet(S.updateTask, t.id, { notes: v }), 350);
  const title = h('textarea', { class: 'detail-title', rows: 2, 'aria-label': 'Title' }, t.title);
  title.addEventListener('input', () => saveTitle(title.value));
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('blur', () => saveTitle.flush(title.value));
  const notes = h('textarea', { class: 'notes', rows: 6, placeholder: 'Notes, links, next step…', 'aria-label': 'Notes' }, t.notes || '');
  notes.addEventListener('input', () => saveNotes(notes.value));
  notes.addEventListener('blur', () => saveNotes.flush(notes.value));

  const field = (label, ...kids) => h('div', { class: 'field' }, h('label', null, label), ...kids);
  const toggle = (key, label, cls) => h('button', { class: `toggle ${cls} ${t[key] ? 'on' : ''}`, 'aria-pressed': String(Boolean(t[key])), onclick: () => app.do(S.updateTask, t.id, { [key]: !t[key] }) }, label);

  const typeField = field('Type', h('div', { class: 'seg' }, Object.entries(S.KINDS).map(([k, l]) => h('button', {
    class: `seg-btn kind-${k} ${t.kind === k ? 'on' : ''}`, title: KIND_HINT[k], onclick: () => app.do(S.updateTask, t.id, { kind: k }),
  }, l))));

  const kindFields = t.kind === 'task' ? [
    field('Status', h('div', { class: 'seg' }, S.STATUSES.map((s) => h('button', { class: `seg-btn st-${s} ${t.status === s ? 'on' : ''}`, onclick: () => app.do(S.updateTask, t.id, { status: s }) }, s === 'todo' ? 'To do' : s[0].toUpperCase() + s.slice(1))))),
    field('Flags', h('div', { class: 'row gap' }, toggle('urgent', '! Urgent', 'tg-urgent'), toggle('important', '★ Important', 'tg-imp'))),
    field('Due', h('div', { class: 'row gap' },
      h('input', { type: 'date', value: t.due || '', onchange: (e) => app.do(S.updateTask, t.id, { due: e.target.value }) }),
      t.due ? h('button', { class: 'linkish small', onclick: () => app.do(S.updateTask, t.id, { due: '' }) }, 'clear') : null)),
  ] : t.kind === 'daily' ? [
    field('Last 7 days', h('div', { class: 'week-dots' }, Array.from({ length: 7 }, (_, i) => S.addDays(app.today, i - 6)).map((d) => {
      const on = S.isChecked(app.s, d, t.id);
      return h('button', { class: `wd ${on ? 'on' : ''}`, title: d, onclick: () => app.do(S.toggleCheck, d, t.id) }, new Date(`${d}T12:00`).toLocaleDateString(undefined, { weekday: 'narrow' }));
    }))),
    field('Streak', h('span', { class: 'mono' }, `${S.streak(app.s, t.id, app.today)} days now · best ${S.bestStreak(app.s, t.id)}`)),
  ] : [
    field('Target', h('div', { class: 'row gap' },
      h('input', { type: 'number', value: t.target ?? '', placeholder: 'e.g. 20', style: { width: '90px' }, onchange: (e) => app.do(S.updateTask, t.id, { target: e.target.value === '' ? null : Number(e.target.value) }) }),
      h('input', { value: t.unit || '', placeholder: 'unit', style: { width: '90px' }, onchange: (e) => app.do(S.updateTask, t.id, { unit: e.target.value }) }))),
    field('Logs', h('button', { class: 'linkish', onclick: () => app.set({ view: 'training' }) }, `${S.logsFor(app.s, t.id).length} entries → chart`)),
  ];

  const detail = h('div', { class: 'editor' },
    title,
    field('Theme', h('select', { onchange: (e) => app.do(S.moveTask, t.id, { themeId: e.target.value }) },
      app.s.themes.map((th) => h('option', { value: th.id, selected: th.id === t.themeId }, th.name)))),
    typeField,
    ...kindFields,
    field('Notes', notes),
    h('div', { class: 'meta mono small muted' }, `added ${prettyTs(t.createdAt)}${t.doneAt ? ` · done ${prettyTs(t.doneAt)}` : ''}`),
    h('div', { class: 'row gap' },
      t.kind === 'task' ? h('button', { class: 'btn', onclick: () => app.do(S.toggleDone, t.id) }, t.status === 'done' ? 'Re-open' : '✓ Mark done') : null,
      h('button', { class: 'btn btn-danger', onclick: () => { app.do(S.deleteTask, t.id); app.toast(`Deleted “${t.title}”`, { label: 'Undo', run: () => app.undo() }); } }, icon('trash', 14), ' Delete')));
  return setVars(h('div', { class: 'detail-card' }, h('div', { class: 'detail-band' }, themeChip(theme), h('span', { class: 'kind-tag' }, S.KINDS[t.kind])), detail), themeVars(theme));
}

function notesTab(app) {
  const save = debounce((v) => app.doQuiet(S.setScratch, v), 400);
  const ta = h('textarea', { class: 'scratch', placeholder: 'A scratchpad for anything — ideas, lists, a thought at 2am. Saved as you type.', 'aria-label': 'Scratchpad' }, app.s.scratch || '');
  ta.addEventListener('input', () => save(ta.value));
  ta.addEventListener('blur', () => save.flush(ta.value));
  return h('div', { class: 'notes-tab' }, ta);
}

function statsTab(app) {
  const rows = app.s.themes.map((th) => {
    const all = app.s.tasks.filter((t) => t.themeId === th.id && t.kind === 'task');
    const done = all.filter((t) => t.status === 'done').length;
    return setVars(h('div', { class: 'bar-row', onclick: () => app.set({ focus: th.id, view: 'board' }) },
      h('span', { class: 'bar-label' }, th.name),
      h('span', { class: 'bar' }, h('i', { style: { width: `${all.length ? (done / all.length) * 100 : 0}%` } })),
      h('b', { class: 'mono small' }, `${done}/${all.length}`)), themeVars(th));
  });
  const daily = app.s.tasks.filter((t) => t.kind === 'daily');
  let hit = 0;
  for (let i = 0; i < 7; i += 1) for (const t of daily) if (S.isChecked(app.s, S.addDays(app.today, -i), t.id)) hit += 1;
  const open = app.s.tasks.filter((t) => t.kind === 'task' && t.status !== 'done');
  const weekAgo = Date.now() - 7 * 864e5;
  const closedWeek = app.s.tasks.filter((t) => t.doneAt && t.doneAt > weekAgo).length;
  const box = (v, l) => h('div', { class: 'kpi' }, h('b', null, String(v)), h('span', null, l));
  return h('div', { class: 'stats-tab' },
    h('div', { class: 'kpis' }, box(open.length, 'open'), box(closedWeek, 'done this week'),
      box(daily.length ? `${Math.round((hit / (daily.length * 7)) * 100)}%` : '—', 'routine, 7 days')),
    h('h3', null, 'To-dos done, by theme'), h('div', { class: 'bars' }, rows));
}
