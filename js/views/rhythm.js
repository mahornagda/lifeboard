// HABITS (daily streak grid), TRAINING (progress charts + logs), WINS (what got done, by week).
import * as S from '../store.js';
import { h, icon, themeVars, setVars, prettyDate, prettyTs } from '../util.js';
import { themeChip, lineChart } from '../components.js';
import { viewHead } from './board.js';

const WEEKS = 22;

export function renderHabits(app) {
  const themes = app.visibleThemes('daily');
  const items = app.s.tasks.filter((t) => themes.some((th) => th.id === t.themeId));
  // Grid ends on this week's Sunday, starts Monday WEEKS weeks back. Columns = weeks, rows = Mon..Sun.
  const [y, m, d] = app.today.split('-').map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon = 0
  const start = S.addDays(app.today, -dow - (WEEKS - 1) * 7);
  const days = Array.from({ length: WEEKS * 7 }, (_, i) => S.addDays(start, i));

  const cards = items.map((t) => {
    const th = app.theme(t.themeId);
    const grid = h('div', { class: 'heat' },
      days.map((day, i) => {
        // Column-major: day i sits in week floor(i/7), row i%7.
        const future = day > app.today;
        const on = S.isChecked(app.s, day, t.id);
        return h('button', {
          class: `cell ${on ? 'on' : ''} ${day === app.today ? 'today' : ''}`,
          style: { gridColumn: String(Math.floor(i / 7) + 1), gridRow: String((i % 7) + 1) },
          disabled: future, title: `${prettyDate(day)}${on ? ' ✓' : ''}`, 'aria-label': `${t.title} on ${day}`,
          onclick: () => app.do(S.toggleCheck, day, t.id),
        });
      }));
    const card = h('section', { class: 'box habit-card', onclick: (e) => { if (e.target === e.currentTarget) app.select(t.id); } },
      h('div', { class: 'col-head' }, h('div', null, h('h2', { onclick: () => app.select(t.id), class: 'clickable' }, t.title), themeChip(th)),
        h('div', { class: 'stats' },
          stat(S.streak(app.s, t.id, app.today), 'streak'), stat(S.bestStreak(app.s, t.id), 'best'),
          stat(`${Math.round(S.checkRate(app.s, t.id, 30, app.today) * 100)}%`, '30 days'))),
      h('div', { class: 'heat-wrap' }, h('div', { class: 'heat-days' }, ['M', '', 'W', '', 'F', '', 'S'].map((x) => h('span', null, x))), grid));
    return setVars(card, themeVars(th));
  });

  return h('div', { class: 'view-pad' },
    viewHead(app, 'Habits', `Last ${WEEKS} weeks. Click any square to fill in a day you forgot.`),
    cards.length ? h('div', { class: 'habit-grid' }, cards)
      : h('div', { class: 'box box-empty' }, 'No daily habits yet. Create a theme with kind “Daily”.'));
}

const stat = (v, l) => h('div', { class: 'stat' }, h('b', null, String(v)), h('span', null, l));

export function renderTraining(app) {
  const themes = app.visibleThemes('progress');
  const items = app.s.tasks.filter((t) => themes.some((th) => th.id === t.themeId));
  const cards = items.map((t) => {
    const th = app.theme(t.themeId);
    const logs = S.logsFor(app.s, t.id);
    const vals = logs.map((l) => l.value);
    const best = vals.length ? Math.max(...vals) : '—';
    const first = vals[0]; const last = vals[vals.length - 1];
    const delta = vals.length > 1 ? last - first : null;
    const val = h('input', { type: 'number', inputmode: 'decimal', placeholder: t.unit || 'value', 'aria-label': 'Value' });
    const date = h('input', { type: 'date', value: app.today, max: app.today, 'aria-label': 'Date' });
    const note = h('input', { placeholder: 'note (optional)', 'aria-label': 'Note' });
    const add = () => { if (val.value !== '') app.do(S.addLog, { taskId: t.id, value: val.value, date: date.value || app.today, note: note.value }); };
    [val, note].forEach((i) => i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') add(); }));
    const card = h('section', { class: 'box train-card' },
      h('div', { class: 'col-head' }, h('div', null, h('h2', { class: 'clickable', onclick: () => app.select(t.id) }, t.title), themeChip(th)),
        h('div', { class: 'stats' }, stat(last ?? '—', 'last'), stat(best, 'best'), stat(t.target || '—', 'target'),
          delta != null ? stat(`${delta >= 0 ? '+' : ''}${delta}`, 'since start') : null)),
      lineChart(logs, t.target),
      h('div', { class: 'log-form' }, val, date, note, h('button', { class: 'btn btn-primary btn-sm', onclick: add }, icon('plus', 14), ' Log')),
      logs.length ? h('details', { class: 'log-list' }, h('summary', null, `${logs.length} entries`),
        h('table', { class: 'table compact' }, h('tbody', null, [...logs].reverse().map((l) => h('tr', null,
          h('td', { class: 'mono' }, prettyDate(l.date)), h('td', { class: 'mono' }, `${l.value} ${t.unit || ''}`), h('td', { class: 'muted' }, l.note),
          h('td', null, h('button', { class: 'icon-btn', title: 'Delete entry', onclick: () => app.do(S.deleteLog, l.id) }, icon('trash', 14)))))))) : null);
    return setVars(card, themeVars(th));
  });
  return h('div', { class: 'view-pad' },
    viewHead(app, 'Training', 'Log a number, watch the line climb. Set a target on the item to draw the goal line.'),
    cards.length ? h('div', { class: 'train-grid' }, cards)
      : h('div', { class: 'box box-empty' }, 'Nothing tracked yet. Create a theme with kind “Progress”.'));
}

export function renderWins(app) {
  const done = app.s.tasks.filter((t) => t.status === 'done' && app.matches(t) && app.visibleThemes().some((th) => th.id === t.themeId))
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const weeks = new Map();
  for (const t of done) {
    const d = new Date(t.doneAt || t.createdAt);
    const mon = S.addDays(S.dateKey(d), -((d.getDay() + 6) % 7));
    weeks.set(mon, [...(weeks.get(mon) || []), t]);
  }
  const perTheme = app.s.themes.map((th) => ({ th, n: done.filter((t) => t.themeId === th.id).length })).filter((x) => x.n);
  const max = Math.max(1, ...perTheme.map((x) => x.n));
  return h('div', { class: 'view-pad' },
    viewHead(app, 'Wins', `${done.length} things closed. Proof the whiteboard moves.`),
    perTheme.length ? h('div', { class: 'box bars' }, perTheme.map(({ th, n }) => setVars(h('div', { class: 'bar-row', onclick: () => app.set({ focus: th.id }) },
      h('span', { class: 'bar-label' }, th.name), h('span', { class: 'bar' }, h('i', { style: { width: `${(n / max) * 100}%` } })), h('b', { class: 'mono' }, n)), themeVars(th)))) : null,
    [...weeks.entries()].map(([mon, list]) => h('section', { class: 'box week' },
      h('div', { class: 'col-head' }, h('h2', null, `Week of ${prettyDate(mon)}`), h('span', { class: 'count' }, list.length)),
      list.map((t) => setVars(h('div', { class: 'win', onclick: () => app.select(t.id) },
        h('span', { class: 'win-tick' }, '✓'), h('span', { class: 'win-title' }, t.title), themeChip(app.theme(t.themeId)),
        h('span', { class: 'mono small muted' }, prettyTs(t.doneAt))), themeVars(app.theme(t.themeId)))))),
    done.length ? null : h('div', { class: 'box box-empty' }, 'Tick something off and it lands here.'));
}
