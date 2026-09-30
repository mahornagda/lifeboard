// DOM helpers, icons, drag-and-drop. Tiny on purpose — no framework.
import { PALETTE } from './store.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Theme colour → CSS custom properties, so every element reads the same three values.
export const themeVars = (theme) => {
  const p = PALETTE[theme?.color] || PALETTE.slate;
  return { '--c': p.fill, '--c-soft': p.soft, '--c-ink': p.ink };
};
export const setVars = (el, vars) => { for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v); return el; };

const I = {
  board: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  kanban: '<rect x="3" y="3" width="5" height="18"/><rect x="10" y="3" width="5" height="12"/><rect x="17" y="3" width="4" height="8"/>',
  matrix: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><rect x="3" y="4.5" width="2.5" height="2.5"/><rect x="3" y="10.5" width="2.5" height="2.5"/><rect x="3" y="16.5" width="2.5" height="2.5"/>',
  habits: '<rect x="3" y="3" width="4" height="4"/><rect x="10" y="3" width="4" height="4"/><rect x="17" y="3" width="4" height="4"/><rect x="3" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="3" y="17" width="4" height="4"/>',
  training: '<path d="M3 17l5-5 4 4 9-9"/><path d="M15 7h6v6"/>',
  wins: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  digest: '<rect x="4" y="3" width="16" height="18"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/>',
  detail: '<rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/>',
  strip: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A9.6 9.6 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.3 9.3 0 0 0 4.4-1.1"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  key: '<rect x="2" y="6" width="20" height="12"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.1-9.9A6 6 0 0 1 19.5 11a4 4 0 0 1-2 8z"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
};
export const icon = (name, size = 18) =>
  h('span', { class: 'ic', 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">${I[name] || ''}</svg>` });

// ---------- dates ----------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function prettyDate(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MON[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}
export const prettyTs = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};

// ---------- drag & drop ----------
// One drag in flight at a time; dataTransfer can't be read during dragover, so hold it here.
let current = null;
export function draggable(el, type, id) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    current = { type, id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.stopPropagation();
    requestAnimationFrame(() => el.classList.add('dragging'));
    document.body.classList.add(`dragging-${type}`);
  });
  el.addEventListener('dragend', () => {
    current = null;
    el.classList.remove('dragging');
    document.body.classList.remove('dragging-task', 'dragging-theme');
    document.querySelectorAll('.drop-hot').forEach((n) => n.classList.remove('drop-hot'));
  });
  return el;
}
export function dropzone(el, types, onDrop) {
  const ok = () => current && types.includes(current.type);
  el.addEventListener('dragover', (e) => {
    if (!ok()) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.drop-hot').forEach((n) => n !== el && n.classList.remove('drop-hot'));
    el.classList.add('drop-hot');
  });
  el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop-hot'); });
  el.addEventListener('drop', (e) => {
    if (!ok()) return;
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('drop-hot');
    const d = current;
    current = null;
    onDrop(d, e);
  });
  return el;
}

// Inline rename: double-click (or call directly) → editable, Enter saves, Esc cancels.
export function makeEditable(el, onSave) {
  const start = (e) => {
    e?.stopPropagation();
    const before = el.textContent;
    el.contentEditable = 'plaintext-only';
    el.classList.add('editing');
    el.focus();
    document.getSelection().selectAllChildren(el);
    const finish = (save) => {
      el.contentEditable = 'false';
      el.classList.remove('editing');
      el.removeEventListener('keydown', key);
      el.removeEventListener('blur', blur);
      const txt = el.textContent.trim();
      if (save && txt && txt !== before) onSave(txt);
      else el.textContent = before;
    };
    const key = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
    };
    const blur = () => finish(true);
    el.addEventListener('keydown', key);
    el.addEventListener('blur', blur);
  };
  el.addEventListener('dblclick', start);
  el.title = el.title || 'Double-click to rename';
  return start;
}

export const debounce = (fn, ms) => {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
};
