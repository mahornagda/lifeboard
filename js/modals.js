// Dialogs: create/edit a theme, sync & backup, keyboard shortcuts.
import * as S from './store.js';
import { h, icon } from './util.js';
import * as Sync from './sync.js';

function modal(title, body, { wide = false } = {}) {
  const root = document.getElementById('modal-root');
  const close = () => root.replaceChildren();
  const card = h('div', { class: `modal box ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'icon-btn', title: 'Close  Esc', onclick: close }, icon('x'))),
    body);
  root.replaceChildren(h('div', { class: 'modal-back', onclick: (e) => { if (e.target === e.currentTarget) close(); } }, card));
  requestAnimationFrame(() => card.querySelector('input, button.primary-focus')?.focus());
  return close;
}

export function openThemeEditor(app, theme) {
  const isNew = !theme;
  let color = theme?.color || S.COLOR_KEYS[app.s.themes.length % S.COLOR_KEYS.length];
  const name = h('input', { value: theme?.name || '', placeholder: 'e.g. Finances, Errands, Self care', 'aria-label': 'Theme name' });
  const used = new Set(app.s.themes.filter((t) => t.id !== theme?.id).map((t) => t.color));

  const swatches = h('div', { class: 'swatches' });
  const paintSwatches = () => swatches.replaceChildren(...S.COLOR_KEYS.map((k) => h('button', {
    class: `swatch-btn ${k === color ? 'on' : ''} ${used.has(k) ? 'used' : ''}`,
    style: { background: S.PALETTE[k].fill, color: S.PALETTE[k].ink }, title: `${k}${used.has(k) ? ' (already used by another theme)' : ''}`,
    onclick: () => { color = k; paintSwatches(); },
  }, k === color ? '✓' : '')));
  paintSwatches();

  const save = () => {
    const n = name.value.trim();
    if (!n) { name.focus(); name.classList.add('shake'); return; }
    if (isNew) app.do(S.addTheme, { name: n, color });
    else app.do(S.updateTheme, theme.id, { name: n, color });
    close();
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

  const body = h('div', { class: 'form' },
    h('label', null, 'Name'), name,
    h('label', null, 'Colour ', h('span', { class: 'muted small' }, '— one per theme; it follows the theme everywhere')), swatches,
    h('p', { class: 'muted small' }, 'A theme can hold To-dos, Daily habits and Tracked numbers together — pick the type per item.'),
    h('div', { class: 'row gap end' },
      !isNew ? h('button', { class: 'btn btn-danger', onclick: () => {
        const n = app.s.tasks.filter((t) => t.themeId === theme.id).length;
        if (!confirm(`Delete “${theme.name}” and its ${n} item(s)? You can undo right after.`)) return;
        app.do(S.deleteTheme, theme.id);
        close();
        app.toast(`Deleted ${theme.name}`, { label: 'Undo', run: () => app.undo() });
      } }, icon('trash', 14), ' Delete') : null,
      h('span', { class: 'grow' }),
      h('button', { class: 'btn', onclick: () => close() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: save }, isNew ? 'Create theme' : 'Save')));
  const close = modal(isNew ? 'New theme' : `Edit ${theme.name}`, body);
}

export function openSettings(app) {
  const token = h('input', { type: 'password', value: Sync.config().token || '', placeholder: 'GitHub token with “gist” scope', autocomplete: 'off', 'aria-label': 'GitHub token' });
  const gist = h('input', { value: Sync.config().gistId || '', placeholder: 'leave blank to create a new secret gist', 'aria-label': 'Gist id' });
  const status = h('p', { class: 'muted small' }, Sync.describe());
  const file = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  file.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await file.files[0].text());
      if (confirm('Replace everything on this device with this file? (Undo works right after.)')) { app.replaceAll(data, 'Imported'); close(); }
    } catch (err) { alert(`Could not import: ${err.message}`); }
  });

  const body = h('div', { class: 'form' },
    h('h3', null, 'Backup'),
    h('p', { class: 'muted small' }, 'Everything lives in this browser. Download a copy now and then — it is one small file.'),
    h('div', { class: 'row gap' },
      h('button', { class: 'btn', onclick: () => download(app.s) }, 'Download backup (.json)'),
      h('button', { class: 'btn', onclick: () => file.click() }, 'Import a backup…'), file),
    h('h3', null, 'Sync across devices ', h('span', { class: 'muted small' }, '(optional)')),
    h('p', { class: 'muted small' }, 'Saves your board to a secret GitHub Gist so your phone and laptop see the same thing. Create a token at ',
      h('a', { href: 'https://github.com/settings/tokens/new?scopes=gist&description=Lifeboard', target: '_blank', rel: 'noopener' }, 'github.com/settings/tokens'),
      ' (tick only “gist”). The token stays in this browser only.'),
    h('label', null, 'Token'), token, h('label', null, 'Gist id'), gist, status,
    h('div', { class: 'row gap' },
      h('button', { class: 'btn btn-primary', onclick: async () => {
        Sync.configure({ token: token.value.trim(), gistId: gist.value.trim() });
        status.textContent = 'Connecting…';
        try { await Sync.connect(app); gist.value = Sync.config().gistId; status.textContent = Sync.describe(); } catch (err) { status.textContent = `Failed: ${err.message}`; }
      } }, 'Connect & sync now'),
      Sync.config().token ? h('button', { class: 'btn', onclick: () => { Sync.configure({ token: '', gistId: '' }); token.value = ''; gist.value = ''; status.textContent = Sync.describe(); app.render(); } }, 'Disconnect') : null),
    h('h3', null, 'Start over'),
    h('button', { class: 'btn btn-danger', onclick: () => {
      if (!confirm('Wipe the board on this device? Download a backup first if unsure. (Undo works right after.)')) return;
      app.commit(S.emptyState()); close();
      app.toast('Board cleared', { label: 'Undo', run: () => app.undo() });
    } }, 'Clear this device'));
  const close = modal('Sync & backup', body, { wide: true });
}

function download(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `lifeboard-${S.dateKey()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function openHelp() {
  const rows = [
    ['n / ⌘K', 'Quick add a task'], ['/', 'Search'], ['1 – 9', 'Switch view'], ['t', 'New theme'],
    ['[', 'Hide / show sidebar'], [']', 'Hide / show detail pane'], ['\\', 'Hide / show today strip'], ['h', 'Hide / show done tasks'],
    ['x or space', 'Tick the selected task'], ['Delete', 'Delete the selected task'], ['⌘Z / ⇧⌘Z', 'Undo / redo'], ['Esc', 'Close / deselect'],
  ];
  const syntax = [['finance: …', 'put it in the theme starting “finance”'], ['!', 'urgent'], ['*', 'important'], ['+daily', 'make it a daily habit'], ['+track', 'make it a tracked number'], ['@fri  @tomorrow  @2026-10-20', 'due date']];
  modal('Shortcuts', h('div', { class: 'help' },
    h('table', { class: 'table compact' }, h('tbody', null, rows.map(([k, d]) => h('tr', null, h('td', null, h('kbd', null, k)), h('td', null, d))))),
    h('h3', null, 'Quick-add language'),
    h('p', { class: 'mono small' }, 'finance: pay rent ! * @fri'),
    h('table', { class: 'table compact' }, h('tbody', null, syntax.map(([k, d]) => h('tr', null, h('td', null, h('code', null, k)), h('td', null, d))))),
    h('h3', null, 'Mouse'),
    h('p', { class: 'small' }, 'Double-click any title to rename. Drag tasks between boxes, Kanban columns, Matrix squares, or onto a theme in the sidebar. Drag a box by its header to rearrange.')));
}
