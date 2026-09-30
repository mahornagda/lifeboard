// DIGEST — the daily reading: word of the day (with a seen/not-seen record), flag of the day,
// and RBI press releases titled "Directions". Source data is fetched every few hours by a
// GitHub Action into data/digest.json; the only thing saved in YOUR board is which words you saw.
import * as S from './store.js';
import { h, prettyDate } from './util.js';
import { flagFor } from './flags.js';

export const WORD_ID = '__wotd'; // the word record reuses the daily-check store, keyed by the word's date
const RBI_PAGE = 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx';
const MW_PAGE = 'https://www.merriam-webster.com/word-of-the-day';
const HISTORY_DAYS = 42;

let data = null;
let status = null;
let loadError = '';
let seenRbiBefore = null; // highest release id seen on a previous visit — marks what's new

export async function loadDigest(onReady) {
  const bust = Math.floor(Date.now() / 6e5); // re-check at most every 10 minutes
  try {
    const [d, st] = await Promise.all([
      fetch(`data/digest.json?v=${bust}`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`data/status.json?v=${bust}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    data = d; status = st; loadError = '';
  } catch (err) { loadError = `Could not load the digest (${err.message}).`; }
  onReady();
}

export const latestWord = () => (data && data.words && data.words[0]) || null;

export function renderDigest(app) {
  const flag = flagFor(app.today);
  // The word record starts the first time you open the Digest — earlier words aren't "missed".
  const w0 = latestWord();
  if (w0 && !app.s.wordSince) queueMicrotask(() => app.commit({ ...app.s, wordSince: w0.date }, { record: false }));
  return h('div', { class: 'view-pad' },
    h('div', { class: 'view-head' },
      h('div', null, h('h1', null, 'Daily digest'), h('p', { class: 'muted' },
        new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
        status ? ` · sources checked ${new Date(status.checkedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''))),
    loadError ? h('div', { class: 'box box-empty' }, loadError) : null,
    h('div', { class: 'digest-grid' }, wordCard(app), flagCard(app, flag)),
    wordHistory(app),
    rbiCard(app));
}

// ---------- word of the day ----------
function wordCard(app) {
  const w = latestWord();
  if (!w) return h('section', { class: 'box dcard word-card' }, h('p', { class: 'box-empty' }, data ? 'No word yet.' : 'Loading…'));
  const seen = S.isChecked(app.s, w.date, WORD_ID);
  const streak = S.streak(app.s, WORD_ID, w.date);
  return h('section', { class: 'box dcard word-card' },
    h('div', { class: 'dcard-head' }, h('span', { class: 'eyebrow' }, `Word of the day · ${prettyDate(w.date)}`),
      h('a', { class: 'linkish small', href: MW_PAGE, target: '_blank', rel: 'noopener' }, 'Merriam-Webster ↗')),
    h('a', { class: 'word', href: w.url, target: '_blank', rel: 'noopener', title: 'Open on Merriam-Webster' }, w.word),
    h('div', { class: 'word-meta mono small' }, w.pronunciation ? `\\${w.pronunciation}\\` : '', w.pos ? h('em', null, `  ${w.pos}`) : ''),
    h('p', { class: 'word-def' }, w.definition),
    w.example ? h('p', { class: 'word-ex' }, `“${w.example}”`) : null,
    h('div', { class: 'row gap word-actions' },
      h('button', {
        class: `btn ${seen ? 'btn-seen' : 'btn-primary'}`, 'aria-pressed': String(seen),
        onclick: () => app.do(S.toggleCheck, w.date, WORD_ID),
      }, seen ? '✓ Seen — day complete' : 'Mark as seen'),
      h('span', { class: 'mono small muted' }, streak ? `${streak}-day word streak` : 'start a streak')));
}

function wordHistory(app) {
  const words = (data && data.words) || [];
  if (!words.length) return null;
  const byDate = new Map(words.map((w) => [w.date, w]));
  const latest = words[0].date;
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => S.addDays(latest, i - HISTORY_DAYS + 1));
  const since = app.s.wordSince || latest;
  const tracked = words.filter((w) => w.date >= since);
  const seenCount = tracked.filter((w) => S.isChecked(app.s, w.date, WORD_ID)).length;
  const cells = days.map((d) => {
    const w = byDate.get(d);
    const seen = S.isChecked(app.s, d, WORD_ID);
    const cls = seen ? 'seen' : !w || d < since ? 'none' : 'missed';
    return h('button', {
      class: `wcell ${cls}`, disabled: !w, 'aria-label': `${d} ${w ? w.word : 'no word on record'} ${seen ? 'seen' : 'not seen'}`,
      title: w ? `${prettyDate(d)} · ${w.word} · ${seen ? 'seen ✓' : d < since ? 'before your record started — click if you saw it' : 'not seen — click to mark'}` : `${prettyDate(d)} · no word on record`,
      onclick: () => app.do(S.toggleCheck, d, WORD_ID),
    }, seen ? '✓' : '');
  });
  const recent = words.slice(0, 14);
  return h('section', { class: 'box dcard' },
    h('div', { class: 'dcard-head' }, h('h2', null, 'Word record'),
      h('span', { class: 'mono small' }, `${seenCount} of ${tracked.length} seen since ${prettyDate(since)} · best run ${S.bestStreak(app.s, WORD_ID)}`)),
    h('div', { class: 'wgrid' }, cells),
    h('div', { class: 'legend small muted' }, h('i', { class: 'wcell seen' }), ' seen ', h('i', { class: 'wcell missed' }), ' missed ', h('i', { class: 'wcell none' }), ' before you started / no word'),
    h('table', { class: 'table compact word-table' }, h('tbody', null, recent.map((w) => {
      const seen = S.isChecked(app.s, w.date, WORD_ID);
      return h('tr', null,
        h('td', { class: 'mono small' }, prettyDate(w.date)),
        h('td', null, h('a', { href: w.url, target: '_blank', rel: 'noopener' }, h('b', null, w.word))),
        h('td', { class: 'muted small' }, w.definition),
        h('td', null, h('button', { class: `check ${seen ? 'on' : ''}`, role: 'checkbox', 'aria-checked': String(seen), 'aria-label': `Seen ${w.word}`, onclick: () => app.do(S.toggleCheck, w.date, WORD_ID) }, seen ? '✓' : '')));
    }))));
}

// ---------- flag of the day ----------
function flagCard(app, flag) {
  const revealed = app.ui.flagRevealed === app.today;
  const yesterday = flagFor(S.addDays(app.today, -1));
  return h('section', { class: 'box dcard flag-card' },
    h('div', { class: 'dcard-head' }, h('span', { class: 'eyebrow' }, 'Flag of the day'), h('span', { class: 'mono small muted' }, 'guess first')),
    h('div', { class: 'flag-frame' }, h('img', { src: flag.img, srcset: `${flag.img2x} 2x`, alt: revealed ? `Flag of ${flag.name}` : 'Today’s flag', loading: 'lazy' })),
    revealed
      ? h('div', { class: 'flag-answer' }, h('b', null, flag.name), h('a', { class: 'linkish small', href: flag.wiki, target: '_blank', rel: 'noopener' }, 'about this flag ↗'))
      : h('button', { class: 'btn btn-primary', onclick: () => app.set({ flagRevealed: app.today }) }, 'Reveal the country'),
    h('p', { class: 'small muted flag-yday' }, 'Yesterday: ', h('img', { src: `https://flagcdn.com/w40/${yesterday.code}.png`, alt: '', width: 20 }), ` ${yesterday.name}`));
}

// ---------- RBI ----------
// Last 60 days only, and never the bank-specific "Directions under Section 35A…" orders.
const RBI_DAYS = 60;
const isBankSpecific = (r) => /section\s*35\s*a/i.test(r.title);

function rbiCard(app) {
  const all = (data && data.rbi) || [];
  const maxId = all.reduce((m, r) => Math.max(m, r.id), 0);
  if (seenRbiBefore === null && data) {
    seenRbiBefore = Number(localStorage.getItem('life.rbiSeen') || maxId);
    localStorage.setItem('life.rbiSeen', String(maxId));
  }
  const cutoff = S.addDays(app.today, -RBI_DAYS);
  const q = app.ui.q.trim().toLowerCase();
  const rows = all.filter((r) => r.date >= cutoff && !isBankSpecific(r) && (!q || r.title.toLowerCase().includes(q)));
  const limit = app.ui.rbiAll ? rows.length : 25;
  return h('section', { class: 'box dcard rbi-card' },
    h('div', { class: 'dcard-head' },
      h('h2', null, 'RBI press releases: “Directions”'),
      h('a', { class: 'linkish small', href: RBI_PAGE, target: '_blank', rel: 'noopener' }, 'rbi.org.in ↗')),
    h('p', { class: 'small muted' }, `${rows.length} in the last ${RBI_DAYS} days · bank-specific Section 35A orders left out`),
    status && status.errors && status.errors.rbi ? h('p', { class: 'small warn' }, `Last check failed (${status.errors.rbi}); showing the last good list.`) : null,
    rows.length ? h('table', { class: 'table rbi-table' },
      h('thead', null, h('tr', null, h('th', null, 'Published'), h('th', null, 'Press release'), h('th', null, 'PDF'))),
      h('tbody', null, rows.slice(0, limit).map((r) => h('tr', { class: r.id > seenRbiBefore ? 'is-new' : '' },
        h('td', { class: 'mono small nowrap' }, prettyDate(r.date), r.id > seenRbiBefore ? h('span', { class: 'badge badge-today' }, 'new') : null),
        h('td', null, h('a', { href: r.url, target: '_blank', rel: 'noopener' }, r.title)),
        h('td', null, r.pdf ? h('a', { class: 'linkish small', href: r.pdf, target: '_blank', rel: 'noopener' }, 'PDF') : '—')))))
      : h('p', { class: 'box-empty' }, data ? 'No releases match.' : 'Loading…'),
    rows.length > 25 ? h('button', { class: 'linkish small more', onclick: () => app.set({ rbiAll: !app.ui.rbiAll }) },
      app.ui.rbiAll ? 'Show latest 25' : `Show all ${rows.length}`) : null);
}

