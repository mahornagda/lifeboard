import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/store.js';

const base = () => {
  let s = S.emptyState();
  s = S.addTheme(s, { name: 'Finance', id: 'fin' });
  s = S.addTheme(s, { name: 'Tech', id: 'tech' });
  s = S.addTheme(s, { name: 'Morning', kind: 'daily', id: 'mor' });
  s = S.addTheme(s, { name: 'Push-ups', kind: 'progress', id: 'push' });
  s = S.addTask(s, { themeId: 'fin', title: 'Rent', id: 'a' });
  s = S.addTask(s, { themeId: 'fin', title: 'SIP', id: 'b' });
  s = S.addTask(s, { themeId: 'tech', title: 'GDrive', id: 'c' });
  s = S.addTask(s, { themeId: 'mor', title: 'Brush', id: 'm1' });
  s = S.addTask(s, { themeId: 'push', title: 'Max push-ups', id: 'p1' });
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
  assert.deepEqual(r, { themeId: 'fin', title: 'pay rent', urgent: true, important: true, due: '2026-10-02' });
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
