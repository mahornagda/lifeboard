// LIST — every one-off task in one sortable table. Click a header to sort, a row to open it.
import * as S from '../store.js';
import { h, prettyTs } from '../util.js';
import { themeChip, checkbox, flags, dueBadge } from '../components.js';
import { viewHead } from './board.js';

const COLS = [
  { key: 'done', label: '', sort: (t) => (t.status === 'done' ? 1 : 0) },
  { key: 'title', label: 'Task', sort: (t) => t.title.toLowerCase() },
  { key: 'theme', label: 'Theme', sort: (t, app) => app.s.themes.findIndex((x) => x.id === t.themeId) },
  { key: 'status', label: 'Status', sort: (t) => S.STATUSES.indexOf(t.status) },
  { key: 'flags', label: 'Flags', sort: (t) => (t.urgent ? 0 : 2) + (t.important ? 0 : 1) },
  { key: 'due', label: 'Due', sort: (t) => t.due || '9999' },
  { key: 'created', label: 'Added', sort: (t) => t.createdAt },
];

export function renderList(app) {
  const [key, dir] = app.ui.listSort;
  const col = COLS.find((c) => c.key === key) || COLS[2];
  const rows = app.visibleTasks({ includeDone: !app.ui.hideDone })
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const x = col.sort(a.t, app); const y = col.sort(b.t, app);
      return (x < y ? -1 : x > y ? 1 : a.i - b.i) * dir; // stable: ties keep board order
    })
    .map(({ t }) => t);

  const head = h('tr', null, COLS.map((c) => h('th', {
    class: c.key === key ? 'sorted' : '',
    onclick: () => app.set({ listSort: [c.key, c.key === key ? -dir : 1] }),
  }, c.label, c.key === key ? (dir > 0 ? ' ↑' : ' ↓') : '')));

  const body = rows.map((t) => h('tr', { class: `${t.status === 'done' ? 'is-done' : ''} ${app.ui.selected === t.id ? 'is-sel' : ''}`, onclick: () => app.select(t.id) },
    h('td', null, checkbox(t.status === 'done', () => app.do(S.toggleDone, t.id), `Mark ${t.title} done`)),
    h('td', { class: 'td-title' }, t.title),
    h('td', null, themeChip(app.theme(t.themeId))),
    h('td', null, statusSelect(app, t)),
    h('td', null, flags({ ...t, status: 'todo' })),
    h('td', null, t.due ? dueBadge(app, t) : h('span', { class: 'muted' }, '—')),
    h('td', { class: 'mono small muted' }, prettyTs(t.createdAt))));

  const open = rows.filter((t) => t.status !== 'done').length;
  return h('div', { class: 'view-pad' },
    viewHead(app, 'List', `${open} open · ${rows.length - open} done${app.ui.q ? ` · matching “${app.ui.q}”` : ''}`,
      h('button', { class: 'btn btn-sm', onclick: () => app.set({ hideDone: !app.ui.hideDone }) }, app.ui.hideDone ? 'Show done' : 'Hide done')),
    h('div', { class: 'box table-wrap' }, h('table', { class: 'table' }, h('thead', null, head), h('tbody', null, body)),
      rows.length ? null : h('p', { class: 'box-empty' }, 'No tasks match.')));
}

function statusSelect(app, t) {
  return h('select', {
    class: `status-select st-${t.status}`, 'aria-label': 'Status', onclick: (e) => e.stopPropagation(),
    onchange: (e) => app.do(S.updateTask, t.id, { status: e.target.value }),
  }, S.STATUSES.map((s) => h('option', { value: s, selected: s === t.status }, s === 'todo' ? 'to do' : s)));
}

