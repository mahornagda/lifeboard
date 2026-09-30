// BOARD — the whiteboard: one box per theme. Drag boxes by their header, drag tasks between boxes.
import * as S from '../store.js';
import { h, icon, themeVars, setVars, draggable, dropzone, makeEditable } from '../util.js';
import { taskRow, inlineAdd, checkbox, sparkline } from '../components.js';

export function renderBoard(app) {
  const themes = app.visibleThemes();
  if (!app.s.themes.length) return emptyHero(app);
  const grid = h('div', { class: 'board' }, themes.map((t) => themeBox(app, t)),
    app.ui.focus ? null : h('button', { class: 'box box-add', onclick: () => app.editTheme(null) }, icon('plus', 28), h('span', null, 'New theme'), h('small', null, 'shortcut  t')));
  return h('div', { class: 'view-pad' }, viewHead(app, 'Board', 'Every area of life, one box each. Drag boxes by the header; drag tasks anywhere.'), grid);
}

export function viewHead(app, title, sub, extra) {
  return h('div', { class: 'view-head' },
    h('div', null, h('h1', null, title), sub ? h('p', { class: 'muted' }, sub) : null),
    h('div', { class: 'row gap' }, extra,
      app.ui.focus ? h('button', { class: 'btn btn-sm', onclick: () => app.set({ focus: null }) }, icon('x', 14), ` Showing ${app.theme(app.ui.focus)?.name} only`) : null));
}

// Remembers the type picked in each box's add row across re-renders (UI-only, not saved).
const addKind = new Map();

function themeBox(app, theme) {
  const items = app.s.tasks.filter((t) => t.themeId === theme.id);
  const byKind = (k) => items.filter((t) => t.kind === k);
  const todos = byKind('task'); const daily = byKind('daily'); const tracked = byKind('progress');
  const name = h('span', { class: 'box-name' }, theme.name);
  makeEditable(name, (txt) => app.do(S.updateTheme, theme.id, { name: txt }));

  const count = [
    todos.length ? `${todos.filter((t) => t.status !== 'done').length} open` : null,
    daily.length ? `${daily.filter((t) => S.isChecked(app.s, app.today, t.id)).length}/${daily.length} today` : null,
    tracked.length ? `${tracked.length} tracked` : null,
  ].filter(Boolean).join(' · ') || 'empty';

  const head = h('div', { class: 'box-head' },
    h('span', { class: 'grip', title: 'Drag to move this box' }, icon('grip', 14)),
    name,
    h('span', { class: 'box-count' }, count),
    h('button', { class: 'icon-btn', title: theme.collapsed ? 'Expand' : 'Collapse', onclick: () => app.do(S.updateTheme, theme.id, { collapsed: !theme.collapsed }) },
      h('span', { class: theme.collapsed ? 'rot' : '' }, icon('chev', 16))),
    h('button', { class: 'icon-btn', title: 'Edit theme', onclick: () => app.editTheme(theme) }, icon('dots', 16)));
  draggable(head, 'theme', theme.id);

  const body = h('div', { class: 'box-body' });
  if (!theme.collapsed) {
    // Label the sections only when a box actually mixes types.
    const mixed = [todos, daily, tracked].filter((a) => a.length).length > 1;
    const section = (label, rows) => (rows.length ? [mixed ? h('div', { class: 'sub-label' }, label) : null, ...rows].filter(Boolean) : []);
    body.append(
      ...section('To-do', listBody(app, theme, todos)),
      ...section('Daily', daily.filter((t) => app.matches(t)).map((t) => dailyRow(app, theme, t))),
      ...section('Tracked', tracked.filter((t) => app.matches(t)).map((t) => progressRow(app, theme, t))));
    if (!items.length) body.append(h('p', { class: 'box-empty' }, 'Empty. Add below — pick To-do, Daily or Tracked.'));
    body.append(addRow(app, theme));
  }

  const box = h('section', { class: `box theme-box ${theme.collapsed ? 'collapsed' : ''}` }, head, body);
  setVars(box, themeVars(theme));
  dropzone(box, ['theme', 'task'], (d) => {
    if (d.type === 'theme') app.do(S.moveTheme, d.id, theme.id);
    else app.do(S.moveTask, d.id, { themeId: theme.id });
  });
  return box;
}

function addRow(app, theme) {
  const kind = addKind.get(theme.id) || 'task';
  const pick = h('select', { class: 'kind-select', title: 'Type of the new item', 'aria-label': 'Type', onchange: (e) => addKind.set(theme.id, e.target.value) },
    Object.entries(S.KINDS).map(([k, l]) => h('option', { value: k, selected: k === kind }, l)));
  const input = inlineAdd(app, `Add to ${theme.name}…`, (v) => {
    const p = S.parseQuick(app.s, v, app.today);
    const chosen = p.kind !== 'task' ? p.kind : (addKind.get(theme.id) || 'task');
    app.do(S.addTask, { themeId: theme.id, title: p.title || v.trim(), kind: chosen, urgent: p.urgent, important: p.important, due: p.due });
  });
  return h('div', { class: 'add-row' }, input, pick);
}

function listBody(app, theme, items) {
  const shown = items.filter((t) => app.matches(t) && !(app.ui.hideDone && t.status === 'done'));
  const hiddenDone = app.ui.hideDone ? items.filter((t) => t.status === 'done').length : 0;
  return [...shown.map((t) => taskRow(app, t)),
    hiddenDone ? h('button', { class: 'linkish small', onclick: () => app.set({ hideDone: false }) }, `+ ${hiddenDone} done (hidden)`) : null].filter(Boolean);
}

function dailyRow(app, theme, t) {
  const on = S.isChecked(app.s, app.today, t.id);
  const st = S.streak(app.s, t.id, app.today);
  const title = h('span', { class: 'task-title' }, t.title);
  makeEditable(title, (txt) => app.do(S.updateTask, t.id, { title: txt }));
  const row = h('div', { class: `task daily ${on ? 'is-done' : ''} ${app.ui.selected === t.id ? 'is-sel' : ''}`, onclick: () => app.select(t.id) },
    h('span', { class: 'grip' }, icon('grip', 14)),
    checkbox(on, () => app.do(S.toggleCheck, app.today, t.id), `Did ${t.title} today`),
    h('div', { class: 'task-main' }, title),
    st ? h('span', { class: 'streak', title: `${st}-day streak` }, `${st}d`) : null);
  draggable(row, 'task', t.id);
  dropzone(row, ['task'], (d) => app.do(S.moveTask, d.id, { themeId: theme.id, beforeId: t.id }));
  return row;
}

function progressRow(app, theme, t) {
  const logs = S.logsFor(app.s, t.id);
  const last = logs[logs.length - 1];
  const input = h('input', { class: 'log-input', type: 'number', inputmode: 'decimal', placeholder: last ? String(last.value) : '0', 'aria-label': `Log ${t.title}`, onclick: (e) => e.stopPropagation() });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && input.value !== '') { app.do(S.addLog, { taskId: t.id, value: input.value }); app.toast(`Logged ${input.value} ${t.unit || ''}`); }
  });
  const title = h('span', { class: 'task-title' }, t.title);
  makeEditable(title, (txt) => app.do(S.updateTask, t.id, { title: txt }));
  const row = h('div', { class: `task progress ${app.ui.selected === t.id ? 'is-sel' : ''}`, onclick: () => app.select(t.id) },
    h('span', { class: 'grip' }, icon('grip', 14)),
    h('div', { class: 'task-main' }, title,
      h('div', { class: 'task-meta' },
        h('span', { class: 'mono small' }, last ? `last ${last.value}${t.target ? ` / ${t.target}` : ''} ${t.unit || ''}` : 'not logged'),
        logs.length > 1 ? sparkline(logs.slice(-12).map((l) => l.value), { w: 70, h: 20 }) : null)),
    input);
  draggable(row, 'task', t.id);
  dropzone(row, ['task'], (d) => app.do(S.moveTask, d.id, { themeId: theme.id, beforeId: t.id }));
  return row;
}

function emptyHero(app) {
  return h('div', { class: 'view-pad' }, h('div', { class: 'empty-hero box' },
    h('h1', null, 'A blank whiteboard.'),
    h('p', null, 'Start with a theme: a box for one area of life (Finances, Health, Errands). Or bring your board in from another device.'),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn btn-primary', onclick: () => app.editTheme(null) }, icon('plus'), ' New theme'),
      h('button', { class: 'btn', onclick: () => app.settings() }, icon('cloud'), ' Import / sync'))));
}
