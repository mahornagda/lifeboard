import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/store.js';

const base = () => {
  let s = S.emptyState();
  s = S.addTheme(s, { name: 'Finance', id: 'fin' });
  s = S.addTheme(s, { name: 'Tech', id: 'tech' });
  s = S.addTheme(s, { name: 'Morning', id: 'mor' });
  s = S.addTheme(s, { name: 'Push-ups', id: 'push' });
  s = S.addTask(s, { themeId: 'fin', title: 'Rent', id: 'a' });
  s = S.addTask(s, { themeId: 'fin', title: 'SIP', id: 'b' });
  s = S.addTask(s, { themeId: 'tech', title: 'GDrive', id: 'c' });
  s = S.addTask(s, { themeId: 'mor', title: 'Brush', id: 'm1', kind: 'daily' });
  s = S.addTask(s, { themeId: 'push', title: 'Max push-ups', id: 'p1', kind: 'progress' });
  return s;
};

test('actions never mutate the input state', () => {
  const s = base();
  const frozen = JSON.stringify(s);
  S.toggleDone(s, 'a'); S.moveTask(s, 'a', { themeId: 'tech' }); S.deleteTheme(s, 'fin');
  S.toggleCheck(s, '2026-10-01', 'm1'); S.addLog(s, { taskId: 'p1', value: 10 });
  assert.equal(JSON.stringify(s), frozen);
});

test('themes get distinct colours and reject blank names', () => {
  const s = base();
  assert.equal(new Set(s.themes.map((t) => t.color)).size, 4);
  assert.equal(S.addTheme(s, { name: '  ' }), s);
});

test('moveTheme reorders before target and to end', () => {
  let s = S.moveTheme(base(), 'push', 'fin');
  assert.deepEqual(s.themes.map((t) => t.id), ['push', 'fin', 'tech', 'mor']);
  s = S.moveTheme(s, 'push', null);
  assert.deepEqual(s.themes.map((t) => t.id), ['fin', 'tech', 'mor', 'push']);
});

test('deleteTheme removes its tasks, logs and checks', () => {
  let s = S.toggleCheck(base(), '2026-10-01', 'm1');
  s = S.addLog(s, { taskId: 'p1', value: 5 });
  s = S.deleteTheme(S.deleteTheme(s, 'mor'), 'push');
  assert.ok(!s.tasks.some((t) => t.id === 'm1' || t.id === 'p1'));
  assert.equal(s.logs.length, 0);
  assert.equal(S.isChecked(s, '2026-10-01', 'm1'), false);
});

test('addTask rejects unknown theme and blank title', () => {
  const s = base();
  assert.equal(S.addTask(s, { themeId: 'nope', title: 'x' }), s);
  assert.equal(S.addTask(s, { themeId: 'fin', title: '' }), s);
});

test('status changes stamp and clear doneAt', () => {
  let s = S.toggleDone(base(), 'a');
  const t = s.tasks.find((x) => x.id === 'a');
  assert.equal(t.status, 'done'); assert.ok(t.doneAt);
  s = S.toggleDone(s, 'a');
  assert.equal(s.tasks.find((x) => x.id === 'a').doneAt, null);
});

test('moveTask changes theme, status and position', () => {
  const s = S.moveTask(base(), 'c', { themeId: 'fin', beforeId: 'a', status: 'doing' });
  assert.deepEqual(s.tasks.filter((t) => t.themeId === 'fin').map((t) => t.id), ['c', 'a', 'b']);
  assert.equal(s.tasks.find((t) => t.id === 'c').status, 'doing');
  assert.equal(S.moveTask(base(), 'c', { themeId: 'ghost' }).tasks.find((t) => t.id === 'c').themeId, 'tech');
});

test('streaks count back from today, tolerate an unticked today', () => {
  let s = base();
  for (const d of ['2026-09-28', '2026-09-29', '2026-09-30']) s = S.toggleCheck(s, d, 'm1');
  assert.equal(S.streak(s, 'm1', '2026-10-01'), 3);
  s = S.toggleCheck(s, '2026-10-01', 'm1');
  assert.equal(S.streak(s, 'm1', '2026-10-01'), 4);
  s = S.toggleCheck(s, '2026-09-29', 'm1');
  assert.equal(S.streak(s, 'm1', '2026-10-01'), 2);
  assert.equal(S.bestStreak(s, 'm1'), 2);
  assert.equal(S.checkRate(s, 'm1', 10, '2026-10-01'), 0.3);
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(S.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(S.addDays('2026-03-01', -1), '2026-02-28');
});

test('logs validate numbers and sort by date', () => {
  let s = S.addLog(base(), { taskId: 'p1', value: 'abc' });
  assert.equal(s.logs.length, 0);
  s = S.addLog(s, { taskId: 'p1', value: 12, date: '2026-10-02' });
  s = S.addLog(s, { taskId: 'p1', value: 10, date: '2026-09-30' });
  assert.deepEqual(S.logsFor(s, 'p1').map((l) => l.value), [10, 12]);
  s = S.deleteLog(s, S.logsFor(s, 'p1')[0].id);
  assert.equal(s.logs.length, 1);
});

test('parseQuick reads theme prefix, flags and dates', () => {
  const s = base();
  const r = S.parseQuick(s, 'fin: pay rent ! * @tomorrow', '2026-10-01');
  assert.deepEqual(r, { themeId: 'fin', title: 'pay rent', urgent: true, important: true, due: '2026-10-02', kind: 'task' });
  const fri = S.parseQuick(s, 'call bank @fri', '2026-10-01'); // Thu → Fri
  assert.equal(fri.due, '2026-10-02'); assert.equal(fri.themeId, null);
  const same = S.parseQuick(s, 'x @thu', '2026-10-01'); // same weekday → next week
  assert.equal(same.due, '2026-10-08');
  assert.equal(S.parseQuick(s, 'note: email @someone', '2026-10-01').title, 'note: email @someone');
});

test('validate rejects junk and repairs colours / orphans', () => {
  assert.throws(() => S.validate(null));
  assert.throws(() => S.validate({ themes: 'x' }));
  const v = S.validate({ themes: [{ id: 't', name: 'T', color: 'neon' }], tasks: [{ id: 'x', themeId: 'gone', title: 'o' }], logs: [], checks: {} });
  assert.equal(v.themes[0].color, 'slate');
  assert.equal(v.tasks.length, 0);
});

test('no-op updates return the same state (no save, no undo step)', () => {
  const s = base();
  assert.equal(S.updateTask(s, 'a', { title: 'Rent' }), s);
  assert.equal(S.updateTheme(s, 'fin', { name: 'Finance' }), s);
  assert.notEqual(S.updateTask(s, 'a', { title: 'Rent!' }), s);
});

test('type lives on the item: one theme can mix to-dos, daily and tracked', () => {
  let s = S.addTask(base(), { themeId: 'fin', title: 'Check balance', id: 'd', kind: 'daily' });
  s = S.addTask(s, { themeId: 'fin', title: 'Net worth', id: 'n', kind: 'progress' });
  const kinds = s.tasks.filter((t) => t.themeId === 'fin').map((t) => t.kind);
  assert.deepEqual(kinds, ['task', 'task', 'daily', 'progress']);
  assert.equal(S.addTask(s, { themeId: 'fin', title: 'x', id: 'z', kind: 'weird' }).tasks.find((t) => t.id === 'z').kind, 'task');
});

test('changing an item type keeps its history', () => {
  let s = S.toggleCheck(base(), '2026-10-01', 'm1');
  s = S.updateTask(s, 'm1', { kind: 'task' });
  s = S.updateTask(s, 'm1', { kind: 'daily' });
  assert.equal(S.isChecked(s, '2026-10-01', 'm1'), true);
});

test('validate migrates old boards: item type comes from the old theme kind', () => {
  const v = S.validate({
    themes: [{ id: 'a', name: 'A', kind: 'list', color: 'sun' }, { id: 'b', name: 'B', kind: 'daily', color: 'sky' }, { id: 'c', name: 'C', kind: 'progress', color: 'teal' }],
    tasks: [{ id: '1', themeId: 'a', title: 'x' }, { id: '2', themeId: 'b', title: 'y' }, { id: '3', themeId: 'c', title: 'z' }, { id: '4', themeId: 'b', title: 'w', kind: 'task' }],
    logs: [], checks: {},
  });
  assert.deepEqual(v.tasks.map((t) => t.kind), ['task', 'daily', 'progress', 'task']);
  assert.deepEqual(v.wishlist, []);
});

test('parseQuick reads +daily / +track', () => {
  const s = base();
  assert.equal(S.parseQuick(s, 'fin: check balance +daily', '2026-10-01').kind, 'daily');
  const t = S.parseQuick(s, 'plank +track', '2026-10-01');
  assert.equal(t.kind, 'progress'); assert.equal(t.title, 'plank');
});

test('wishlist: add, tick, rename, delete', () => {
  let s = S.addWish(base(), { title: 'Link to email', id: 'w1' });
  assert.equal(S.addWish(s, { title: ' ' }), s);
  s = S.toggleWish(s, 'w1');
  assert.equal(s.wishlist[0].done, true);
  s = S.updateWish(s, 'w1', { title: 'Link to Gmail' });
  assert.equal(s.wishlist[0].title, 'Link to Gmail');
  assert.equal(S.deleteWish(s, 'w1').wishlist.length, 0);
});
