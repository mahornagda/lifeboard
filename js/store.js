// Pure data layer. Every action takes a state and returns a NEW state.
// No DOM, no storage here — so it runs under `node --test` unchanged.

// The TYPE belongs to each item, not to the theme — a theme can mix all three.
export const KINDS = {
  task: 'To-do',       // one-off: tick it off once
  daily: 'Daily',      // tick every day, builds streaks
  progress: 'Tracked', // log a number over time, with a chart
};
const OLD_THEME_KIND = { list: 'task', daily: 'daily', progress: 'progress' };

export const STATUSES = ['todo', 'doing', 'done'];

// One colour = one theme, everywhere. Red is NOT here: it is reserved for "urgent".
export const PALETTE = {
  sun:   { fill: '#FFE27A', soft: '#FFF6D1', ink: '#5C4600' },
  mint:  { fill: '#A8EBC4', soft: '#E3F8EC', ink: '#0B5E34' },
  sky:   { fill: '#A9D4FF', soft: '#E4F1FF', ink: '#0B4380' },
  lilac: { fill: '#D2BEFF', soft: '#F1EAFF', ink: '#46248F' },
  peach: { fill: '#FFC49A', soft: '#FFEDE0', ink: '#7F3500' },
  rose:  { fill: '#FFB8D4', soft: '#FFE8F1', ink: '#83124A' },
  teal:  { fill: '#9FE3DA', soft: '#E0F7F4', ink: '#095349' },
  lime:  { fill: '#D6F08A', soft: '#F3FBD9', ink: '#435600' },
  sand:  { fill: '#E8D8BC', soft: '#F8F2E8', ink: '#57431F' },
  slate: { fill: '#C9D1DE', soft: '#EEF1F6', ink: '#27324A' },
};
export const COLOR_KEYS = Object.keys(PALETTE);

export const uid = () => Math.random().toString(36).slice(2, 10);

// Local calendar date as YYYY-MM-DD (never UTC — a 1am tick belongs to today).
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

export function emptyState() {
  return { version: 2, updatedAt: 0, themes: [], tasks: [], checks: {}, logs: [], scratch: '', wishlist: [], wordSince: '' };
}

const touch = (s) => ({ ...s, updatedAt: Date.now() });
const nextColor = (s) => COLOR_KEYS[s.themes.length % COLOR_KEYS.length];

// ---------- themes ----------
export function addTheme(s, { name, color, id = uid() }) {
  const clean = String(name || '').trim();
  if (!clean) return s;
  const theme = { id, name: clean, color: PALETTE[color] ? color : nextColor(s), collapsed: false, hidden: false };
  return touch({ ...s, themes: [...s.themes, theme] });
}

export function updateTheme(s, id, patch) {
  const cur = s.themes.find((t) => t.id === id);
  if (!cur || Object.keys(patch).every((k) => cur[k] === patch[k])) return s;
  return touch({ ...s, themes: s.themes.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
}

export function deleteTheme(s, id) {
  const gone = new Set(s.tasks.filter((t) => t.themeId === id).map((t) => t.id));
  const checks = Object.fromEntries(
    Object.entries(s.checks).map(([day, ids]) => [day, Object.fromEntries(Object.entries(ids).filter(([k]) => !gone.has(k)))]),
  );
  return touch({
    ...s,
    themes: s.themes.filter((t) => t.id !== id),
    tasks: s.tasks.filter((t) => t.themeId !== id),
    logs: s.logs.filter((l) => !gone.has(l.taskId)),
    checks,
  });
}

// Move theme `id` so it sits just before `beforeId` (or last when beforeId is null).
export function moveTheme(s, id, beforeId) {
  if (id === beforeId) return s;
  const moving = s.themes.find((t) => t.id === id);
  if (!moving) return s;
  const rest = s.themes.filter((t) => t.id !== id);
  const at = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
  const themes = at < 0 ? [...rest, moving] : [...rest.slice(0, at), moving, ...rest.slice(at)];
  return touch({ ...s, themes });
}

// ---------- tasks ----------
export function addTask(s, { themeId, title, id = uid(), ...rest }) {
  const clean = String(title || '').trim();
  if (!clean || !s.themes.some((t) => t.id === themeId)) return s;
  const task = {
    id, themeId, title: clean, kind: 'task', status: 'todo', urgent: false, important: false,
    due: '', notes: '', target: null, unit: 'reps', createdAt: Date.now(), doneAt: null,
    ...rest,
  };
  if (!KINDS[task.kind]) task.kind = 'task';
  if (task.status === 'done' && !task.doneAt) task.doneAt = task.createdAt;
  return touch({ ...s, tasks: [...s.tasks, task] });
}

export function updateTask(s, id, patch) {
  const cur = s.tasks.find((t) => t.id === id);
  if (!cur || Object.keys(patch).every((k) => cur[k] === patch[k])) return s; // no-op: no save, no undo step
  return touch({
    ...s,
    tasks: s.tasks.map((t) => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      if (patch.status && patch.status !== t.status) next.doneAt = patch.status === 'done' ? Date.now() : null;
      return next;
    }),
  });
}

export const toggleDone = (s, id) => {
  const t = s.tasks.find((x) => x.id === id);
  return t ? updateTask(s, id, { status: t.status === 'done' ? 'todo' : 'done' }) : s;
};

export function deleteTask(s, id) {
  const checks = Object.fromEntries(
    Object.entries(s.checks).map(([day, ids]) => [day, Object.fromEntries(Object.entries(ids).filter(([k]) => k !== id))]),
  );
  return touch({ ...s, tasks: s.tasks.filter((t) => t.id !== id), logs: s.logs.filter((l) => l.taskId !== id), checks });
}

// Move a task: optionally to another theme / status, placed before `beforeId` in array order.
export function moveTask(s, id, { themeId, status, beforeId = null } = {}) {
  const t = s.tasks.find((x) => x.id === id);
  if (!t || id === beforeId) return s;
  if (themeId && !s.themes.some((th) => th.id === themeId)) return s;
  let moved = { ...t, ...(themeId ? { themeId } : {}) };
  if (status && status !== t.status) moved = { ...moved, status, doneAt: status === 'done' ? Date.now() : null };
  const rest = s.tasks.filter((x) => x.id !== id);
  const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : -1;
  const tasks = at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)];
  return touch({ ...s, tasks });
}

// ---------- daily checks ----------
export const isChecked = (s, day, taskId) => Boolean(s.checks[day] && s.checks[day][taskId]);

export function toggleCheck(s, day, taskId) {
  const dayMap = { ...(s.checks[day] || {}) };
  if (dayMap[taskId]) delete dayMap[taskId];
  else dayMap[taskId] = true;
  return touch({ ...s, checks: { ...s.checks, [day]: dayMap } });
}

// Consecutive checked days ending today (or yesterday, if today isn't ticked yet).
export function streak(s, taskId, today = dateKey()) {
  let day = isChecked(s, today, taskId) ? today : addDays(today, -1);
  let n = 0;
  while (isChecked(s, day, taskId)) { n += 1; day = addDays(day, -1); }
  return n;
}

export function bestStreak(s, taskId) {
  const days = Object.keys(s.checks).filter((d) => isChecked(s, d, taskId)).sort();
  let best = 0; let run = 0; let prev = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function checkRate(s, taskId, days = 30, today = dateKey()) {
  let hit = 0;
  for (let i = 0; i < days; i += 1) if (isChecked(s, addDays(today, -i), taskId)) hit += 1;
  return hit / days;
}

// ---------- progress logs ----------
export function addLog(s, { taskId, value, date = dateKey(), note = '', id = uid() }) {
  const v = Number(value);
  if (!Number.isFinite(v) || !s.tasks.some((t) => t.id === taskId)) return s;
  return touch({ ...s, logs: [...s.logs, { id, taskId, date, value: v, note: String(note || '') }] });
}
export const deleteLog = (s, id) => touch({ ...s, logs: s.logs.filter((l) => l.id !== id) });
export const logsFor = (s, taskId) => s.logs.filter((l) => l.taskId === taskId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

export const setScratch = (s, text) => touch({ ...s, scratch: String(text) });

// ---------- "things to add to the dashboard" list ----------
export function addWish(s, { title, id = uid() }) {
  const clean = String(title || '').trim();
  if (!clean) return s;
  return touch({ ...s, wishlist: [...(s.wishlist || []), { id, title: clean, done: false }] });
}
export const updateWish = (s, id, patch) => touch({ ...s, wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
export const toggleWish = (s, id) => touch({ ...s, wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, done: !w.done } : w)) });
export const deleteWish = (s, id) => touch({ ...s, wishlist: s.wishlist.filter((w) => w.id !== id) });

// ---------- quick-add parser ----------
// "fin: pay rent ! * @fri"  → theme starting "fin", urgent, important, due next Friday.
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function parseQuick(s, text, today = dateKey()) {
  let rest = String(text || '').trim();
  let themeId = null;
  const m = rest.match(/^([^:]{1,40}):\s*(.*)$/);
  if (m) {
    const q = m[1].trim().toLowerCase();
    const hit = s.themes.find((t) => t.name.toLowerCase() === q) || s.themes.find((t) => t.name.toLowerCase().startsWith(q));
    if (hit) { themeId = hit.id; rest = m[2]; }
  }
  let urgent = false; let important = false; let due = ''; let kind = 'task';
  rest = rest.replace(/(^|\s)\+(daily|track|tracked)(?=\s|$)/gi, (_, sp, k) => { kind = k.toLowerCase() === 'daily' ? 'daily' : 'progress'; return sp; });
  rest = rest.replace(/(^|\s)@(\S+)/g, (_, sp, tok) => {
    const t = tok.toLowerCase();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) due = t;
    else if (t === 'today') due = today;
    else if (t === 'tomorrow' || t === 'tmrw') due = addDays(today, 1);
    else if (DOW.includes(t.slice(0, 3))) {
      const [y, mo, d] = today.split('-').map(Number);
      const cur = new Date(y, mo - 1, d).getDay();
      const diff = ((DOW.indexOf(t.slice(0, 3)) - cur + 7) % 7) || 7;
      due = addDays(today, diff);
    } else return `${sp}@${tok}`;
    return sp;
  });
  rest = rest.replace(/(^|\s)!+(?=\s|$)/g, () => { urgent = true; return ' '; });
  rest = rest.replace(/(^|\s)\*+(?=\s|$)/g, () => { important = true; return ' '; });
  return { themeId, title: rest.replace(/\s+/g, ' ').trim(), urgent, important, due, kind };
}

// ---------- validation for imports ----------
export function validate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a dashboard file');
  const s = { ...emptyState(), ...raw };
  if (!Array.isArray(s.themes) || !Array.isArray(s.tasks) || !Array.isArray(s.logs) || typeof s.checks !== 'object') {
    throw new Error('File is missing themes / tasks / logs');
  }
  const themes = s.themes.filter((t) => t && t.id && t.name);
  const byId = new Map(themes.map((t) => [t.id, t]));
  return {
    ...s,
    version: 2,
    wishlist: Array.isArray(s.wishlist) ? s.wishlist.filter((w) => w && w.id && w.title) : [],
    // v1 boards kept the type on the theme; move it onto each item, then drop it from the theme.
    themes: themes.map(({ kind, ...t }) => ({ collapsed: false, hidden: false, ...t, color: PALETTE[t.color] ? t.color : 'slate' })),
    tasks: s.tasks.filter((t) => t && t.id && byId.has(t.themeId) && t.title)
      .map((t) => ({ ...t, kind: KINDS[t.kind] ? t.kind : OLD_THEME_KIND[byId.get(t.themeId).kind] || 'task' })),
  };
}
