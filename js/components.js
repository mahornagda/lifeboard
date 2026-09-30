// Shared building blocks used by several views.
import * as S from './store.js';
import { h, icon, themeVars, setVars, draggable, dropzone, makeEditable, prettyDate } from './util.js';

export function themeChip(theme, { onClick } = {}) {
  if (!theme) return null;
  return setVars(h('span', { class: 'chip', onclick: onClick }, h('i', { class: 'dot' }), theme.name), themeVars(theme));
}

export function dueBadge(app, task) {
  if (!task.due) return null;
  const late = task.status !== 'done' && task.due < app.today;
  const now = task.due === app.today;
  return h('span', { class: `badge ${late ? 'badge-late' : now ? 'badge-today' : ''}`, title: `Due ${task.due}` },
    late ? 'late · ' : '', now ? 'today' : prettyDate(task.due));
}

export function flags(task) {
  return [
    task.urgent ? h('span', { class: 'flag flag-urgent', title: 'Urgent' }, '!') : null,
    task.important ? h('span', { class: 'flag flag-imp', title: 'Important' }, '★') : null,
    task.status === 'doing' ? h('span', { class: 'badge badge-doing', title: 'In progress' }, 'doing') : null,
  ];
}

export function checkbox(on, onToggle, label) {
  return h('button', {
    class: `check ${on ? 'on' : ''}`, role: 'checkbox', 'aria-checked': String(on), 'aria-label': label,
    onclick: (e) => { e.stopPropagation(); onToggle(); },
  }, on ? h('span', { html: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M4 12l5 5L20 6"/></svg>' }) : null);
}

// A one-off task: tick, rename (double-click), drag to reorder or to another box.
// `onDrop(dragged, task)` overrides what dropping another task onto this row means (default: reorder into this box).
export function taskRow(app, task, { showTheme = false, onDrop = null } = {}) {
  const theme = app.theme(task.themeId);
  const title = h('span', { class: 'task-title' }, task.title);
  makeEditable(title, (txt) => app.do(S.updateTask, task.id, { title: txt }));
  const row = h('div', {
    class: `task ${task.status === 'done' ? 'is-done' : ''} ${app.ui.selected === task.id ? 'is-sel' : ''}`,
    onclick: () => app.select(task.id),
  },
  h('span', { class: 'grip' }, icon('grip', 14)),
  checkbox(task.status === 'done', () => app.do(S.toggleDone, task.id), `Mark ${task.title} done`),
  h('div', { class: 'task-main' }, title,
    h('div', { class: 'task-meta' }, showTheme ? themeChip(theme) : null, flags(task), dueBadge(app, task),
      task.notes ? h('span', { class: 'badge', title: task.notes }, '✎') : null)));
  setVars(row, themeVars(theme));
  draggable(row, 'task', task.id);
  dropzone(row, ['task'], (d) => (onDrop ? onDrop(d, task) : app.do(S.moveTask, d.id, { themeId: task.themeId, beforeId: task.id })));
  return row;
}

export function inlineAdd(app, placeholder, onAdd) {
  const input = h('input', { class: 'inline-add', placeholder, 'aria-label': placeholder });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && input.value.trim()) {
      const v = input.value;
      input.value = '';
      onAdd(v);
      requestAnimationFrame(() => {
        // Re-render replaced this input; put the cursor back in the fresh one for rapid entry.
        const again = document.querySelector(`input.inline-add[placeholder="${CSS.escape(placeholder)}"]`);
        again?.focus();
      });
    }
    if (e.key === 'Escape') input.blur();
  });
  return input;
}

// ---------- charts (SVG, no library) ----------
export function sparkline(values, { w = 120, h: ht = 32 } = {}) {
  if (values.length < 2) return h('span', { class: 'muted small' }, values.length ? `${values[0]}` : 'no logs yet');
  const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 4) + 2},${ht - 3 - ((v - min) / span) * (ht - 6)}`);
  const last = pts[pts.length - 1].split(',');
  return h('span', { class: 'spark', html: `<svg width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}"><polyline points="${pts.join(' ')}" fill="none" stroke="var(--c-ink)" stroke-width="2"/><rect x="${last[0] - 3}" y="${last[1] - 3}" width="6" height="6" fill="var(--c-ink)"/></svg>` });
}

export function lineChart(logs, target, { w = 560, h: ht = 200 } = {}) {
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  if (!logs.length) return h('div', { class: 'chart-empty' }, 'Log your first number below — the line starts here.');
  const vals = logs.map((l) => l.value);
  const max = Math.max(...vals, target || 0) * 1.1 || 1;
  const x = (i) => pad.l + (logs.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (logs.length - 1)) * (w - pad.l - pad.r));
  const y = (v) => pad.t + (1 - v / max) * (ht - pad.t - pad.b);
  const ticks = [0, max / 2, max].map((v) => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('');
  const path = logs.map((l, i) => `${i ? 'L' : 'M'}${x(i)},${y(l.value)}`).join(' ');
  const dots = logs.map((l, i) => `<rect x="${x(i) - 4}" y="${y(l.value) - 4}" width="8" height="8" class="pt"><title>${l.date}: ${l.value}${l.note ? ` — ${l.note}` : ''}</title></rect>`).join('');
  const tgt = target ? `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(target)}" y2="${y(target)}" class="target"/><text x="${w - pad.r}" y="${y(target) - 5}" text-anchor="end" class="target-label">target ${target}</text>` : '';
  const labels = [0, logs.length - 1].filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => `<text x="${x(i)}" y="${ht - 8}" text-anchor="${i ? 'end' : 'start'}">${prettyDate(logs[i].date)}</text>`).join('');
  return h('div', { class: 'chart', html: `<svg viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" width="100%" height="${ht}">${ticks}${tgt}<path d="${path}" class="line"/>${dots}${labels}</svg>` });
}

export function ring(frac, label) {
  const r = 22; const c = 2 * Math.PI * r;
  return h('div', { class: 'ring', html: `<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" class="ring-bg"/><circle cx="28" cy="28" r="${r}" class="ring-fg" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 28 28)"/></svg><b>${label}</b>` });
}
