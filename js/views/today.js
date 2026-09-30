// TODAY — what to do right now: the routine, the hot list, and today's training numbers.
import * as S from '../store.js';
import { h, icon, themeVars, setVars } from '../util.js';
import { taskRow, ring, themeChip } from '../components.js';
import { viewHead } from './board.js';

const GREET = (hr) => (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening');

export function renderToday(app) {
  const now = new Date();
  const dateLine = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return h('div', { class: 'view-pad' },
    viewHead(app, `${GREET(now.getHours())}.`, dateLine),
    h('div', { class: 'today-grid' }, routineCol(app), hotCol(app), trainingCol(app)));
}

function routineCol(app) {
  const items = app.itemsOf('daily');
  const themes = app.visibleThemes().filter((th) => items.some((t) => t.themeId === th.id));
  const done = items.filter((t) => S.isChecked(app.s, app.today, t.id)).length;
  const tiles = themes.map((th) => {
    const mine = items.filter((t) => t.themeId === th.id);
    return h('div', { class: 'tile-group' },
      h('div', { class: 'tile-label' }, themeChip(th)),
      h('div', { class: 'tiles' }, mine.map((t) => {
        const on = S.isChecked(app.s, app.today, t.id);
        const st = S.streak(app.s, t.id, app.today);
        const tile = h('button', {
          class: `tile ${on ? 'on' : ''}`, 'aria-pressed': String(on),
          onclick: () => app.do(S.toggleCheck, app.today, t.id),
        }, h('span', { class: 'tile-title' }, t.title), h('span', { class: 'tile-sub' }, on ? 'done ✓' : st ? `${st}-day streak` : 'tap when done'));
        return setVars(tile, themeVars(th));
      })));
  });
  return h('section', { class: 'box col' },
    h('div', { class: 'col-head' }, h('h2', null, 'Routine'), items.length ? ring(done / items.length, `${done}/${items.length}`) : null),
    tiles.length ? tiles : h('p', { class: 'box-empty' }, 'Items with type “Daily” show here as tiles. Add one with “+daily”, e.g. “self care: stretch +daily”.'));
}

// Hot = in progress, urgent, or due by today. Sorted: late first, then urgent, then due date.
function hotCol(app) {
  const hot = app.visibleTasks({ includeDone: false })
    .filter((t) => t.status === 'doing' || t.urgent || (t.due && t.due <= app.today))
    .sort((a, b) => rank(app, a) - rank(app, b) || (a.due || '9').localeCompare(b.due || '9'));
  const doneToday = app.visibleTasks().filter((t) => t.status === 'done' && t.doneAt && S.dateKey(new Date(t.doneAt)) === app.today);
  return h('section', { class: 'box col' },
    h('div', { class: 'col-head' }, h('h2', null, 'Hot list'), h('span', { class: 'muted small' }, 'doing · urgent · due')),
    hot.length ? hot.map((t) => taskRow(app, t, { showTheme: true }))
      : h('p', { class: 'box-empty' }, 'Nothing burning. Mark a task urgent (!) or give it a due date to pull it here.'),
    doneToday.length ? h('div', { class: 'done-today' }, h('h3', null, `Done today · ${doneToday.length}`), doneToday.map((t) => taskRow(app, t, { showTheme: true }))) : null);
}
const rank = (app, t) => (t.due && t.due < app.today ? 0 : t.urgent ? 1 : t.status === 'doing' ? 2 : 3);

function trainingCol(app) {
  const items = app.itemsOf('progress');
  return h('section', { class: 'box col' },
    h('div', { class: 'col-head' }, h('h2', null, 'Train'), h('button', { class: 'linkish small', onclick: () => app.set({ view: 'training' }) }, 'all charts →')),
    items.length ? items.map((t) => {
      const th = app.theme(t.themeId);
      const logs = S.logsFor(app.s, t.id);
      const todays = logs.filter((l) => l.date === app.today);
      const best = logs.length ? Math.max(...logs.map((l) => l.value)) : null;
      const input = h('input', { type: 'number', inputmode: 'decimal', class: 'log-input', placeholder: t.unit || 'reps', 'aria-label': `Log ${t.title}` });
      const log = () => { if (input.value !== '') app.do(S.addLog, { taskId: t.id, value: input.value }); };
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') log(); });
      const row = h('div', { class: 'train-row' },
        h('div', { class: 'task-main' }, h('b', null, t.title),
          h('div', { class: 'task-meta' }, themeChip(th),
            h('span', { class: 'mono small' }, todays.length ? `today ${todays.map((l) => l.value).join(' · ')}` : 'not yet today'),
            best != null ? h('span', { class: 'mono small muted' }, `best ${best}`) : null)),
        input, h('button', { class: 'btn btn-sm', onclick: log }, icon('plus', 14)));
      return setVars(row, themeVars(th));
    }) : h('p', { class: 'box-empty' }, 'Items with type “Tracked” show here. Add one with “+track”, e.g. “fitness: plank +track”.'));
}

