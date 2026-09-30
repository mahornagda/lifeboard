// KANBAN (by status) and MATRIX (urgent × important) — same tasks, sorted two different ways.
import * as S from '../store.js';
import { h } from '../util.js';
import { taskRow, inlineAdd } from '../components.js';
import { viewHead } from './board.js';

const COLS = [
  { id: 'todo', label: 'To do', hint: 'Not started' },
  { id: 'doing', label: 'Doing', hint: 'In motion — keep this short' },
  { id: 'done', label: 'Done', hint: 'Last 30 days' },
];

export function renderKanban(app) {
  const monthAgo = Date.now() - 30 * 864e5;
  const tasks = app.visibleTasks();
  const firstTheme = app.visibleThemes('list')[0];
  return h('div', { class: 'view-pad' },
    viewHead(app, 'Kanban', 'Drag a card across to change its status. Colour = theme.'),
    h('div', { class: 'kanban' }, COLS.map((c) => {
      const mine = tasks.filter((t) => t.status === c.id && (c.id !== 'done' || (t.doneAt || 0) > monthAgo));
      const col = h('section', { class: `box kcol kcol-${c.id}` },
        h('div', { class: 'col-head' }, h('h2', null, c.label, h('span', { class: 'count' }, mine.length)), h('span', { class: 'muted small' }, c.hint)),
        h('div', { class: 'kcards' }, mine.map((t) => taskRow(app, t, { showTheme: true, onDrop: (d, over) => app.do(S.moveTask, d.id, { status: c.id, beforeId: over.id }) }))),
        c.id === 'todo' && firstTheme
          ? inlineAdd(app, `Add to ${firstTheme.name}… (or “theme: task”)`, (v) => quickAdd(app, v, firstTheme.id)) : null);
      return dropzoneStatus(app, col, c.id);
    })));
}

function dropzoneStatus(app, el, status) {
  el.addEventListener('dragover', (e) => { if (document.body.classList.contains('dragging-task')) { e.preventDefault(); el.classList.add('drop-hot'); } });
  el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-hot'); });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-hot');
    const id = e.dataTransfer.getData('text/plain');
    if (id) app.do(S.moveTask, id, { status });
  });
  return el;
}

export function quickAdd(app, text, fallbackThemeId, extra = {}) {
  const p = S.parseQuick(app.s, text, app.today);
  const themeId = p.themeId || fallbackThemeId;
  if (!p.title || !themeId) return app.toast('Pick a theme first: type “finance: pay rent”');
  app.do(S.addTask, { themeId, title: p.title, urgent: p.urgent, important: p.important, due: p.due, ...extra });
  app.toast(`Added to ${app.theme(themeId).name}`);
}

// Grid order: row 1 = important, row 2 = not important; column 1 = urgent, column 2 = not urgent.
const QUADS = [
  { key: 'do', urgent: true, important: true, label: 'Do now', hint: 'Urgent + important' },
  { key: 'plan', urgent: false, important: true, label: 'Schedule', hint: 'Important, not urgent — where life improves' },
  { key: 'quick', urgent: true, important: false, label: 'Knock out', hint: 'Urgent, not important — batch these' },
  { key: 'later', urgent: false, important: false, label: 'Someday', hint: 'Neither — fine to let sit' },
];

export function renderMatrix(app) {
  const tasks = app.visibleTasks({ includeDone: false });
  return h('div', { class: 'view-pad' },
    viewHead(app, 'Matrix', 'Drag tasks between squares to set urgent / important.'),
    h('div', { class: 'matrix' },
      h('div', { class: 'axis axis-x' }, h('span', null, 'URGENT'), h('span', null, 'NOT URGENT')),
      QUADS.map((q) => {
        const mine = tasks.filter((t) => Boolean(t.urgent) === q.urgent && Boolean(t.important) === q.important);
        const box = h('section', { class: `box quad quad-${q.key}` },
          h('div', { class: 'col-head' }, h('h2', null, q.label, h('span', { class: 'count' }, mine.length)), h('span', { class: 'muted small' }, q.hint)),
          h('div', { class: 'kcards' }, mine.map((t) => taskRow(app, t, { showTheme: true, onDrop: (d) => app.do(S.updateTask, d.id, { urgent: q.urgent, important: q.important }) }))));
        box.addEventListener('dragover', (e) => { if (document.body.classList.contains('dragging-task')) { e.preventDefault(); box.classList.add('drop-hot'); } });
        box.addEventListener('dragleave', (e) => { if (!box.contains(e.relatedTarget)) box.classList.remove('drop-hot'); });
        box.addEventListener('drop', (e) => {
          e.preventDefault(); e.stopPropagation();
          box.classList.remove('drop-hot');
          const id = e.dataTransfer.getData('text/plain');
          if (id) app.do(S.updateTask, id, { urgent: q.urgent, important: q.important });
        });
        return box;
      })));
}
