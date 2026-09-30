// Optional cross-device sync through ONE secret GitHub Gist. Last write wins, by `updatedAt`.
// The token only ever lives in this browser's localStorage and is only sent to api.github.com.
import { validate } from './store.js';
import { debounce } from './util.js';

const KEY = 'life.sync.v1';
const FILE = 'lifeboard.json';
const API = 'https://api.github.com/gists';

let cfg = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
let state = cfg.token && cfg.gistId ? 'ok' : 'off';
let lastMsg = '';

export const config = () => ({ ...cfg });
export const status = () => state;
export function configure(patch) {
  cfg = { ...cfg, ...patch };
  localStorage.setItem(KEY, JSON.stringify(cfg));
  state = cfg.token && cfg.gistId ? 'ok' : 'off';
}
export function describe() {
  if (!cfg.token) return 'Not connected. Your board is saved on this device only.';
  if (!cfg.gistId) return 'Token saved — press Connect to create your private gist.';
  return `${state === 'err' ? '⚠ ' : '● '}Synced to gist ${cfg.gistId.slice(0, 8)}…${cfg.lastSync ? ` · last ${new Date(cfg.lastSync).toLocaleString()}` : ''}${lastMsg ? ` · ${lastMsg}` : ''}`;
}

async function gh(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(res.status === 401 ? 'token rejected (401)' : res.status === 404 ? 'gist not found (404)' : `GitHub said ${res.status}`);
  return res.json();
}

async function pull() {
  const g = await gh('GET', `${API}/${cfg.gistId}`);
  const f = g.files && g.files[FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return validate(JSON.parse(text));
}

async function push(data) {
  await gh('PATCH', `${API}/${cfg.gistId}`, { files: { [FILE]: { content: JSON.stringify(data) } } });
  configure({ lastSync: Date.now() });
}

// Bring the two copies together: newer side wins.
async function reconcile(app, { quiet = false } = {}) {
  state = 'busy';
  try {
    const remote = await pull();
    if (remote && (remote.updatedAt || 0) > (app.s.updatedAt || 0)) {
      app.commit(remote, { record: true });
      if (!quiet) app.toast('Pulled the newer board from the cloud');
    } else if (!remote || (remote.updatedAt || 0) < (app.s.updatedAt || 0)) {
      await push(app.s);
    }
    configure({ lastSync: Date.now() });
    state = 'ok'; lastMsg = '';
  } catch (err) {
    state = 'err'; lastMsg = err.message;
    if (!quiet) app.toast(`Sync failed: ${err.message}`);
  }
}

export async function connect(app) {
  if (!cfg.token) throw new Error('paste a token first');
  if (!cfg.gistId) {
    const g = await gh('POST', API, { description: 'Lifeboard data (private)', public: false, files: { [FILE]: { content: JSON.stringify(app.s) } } });
    configure({ gistId: g.id, lastSync: Date.now() });
    state = 'ok';
    app.render();
    return;
  }
  await reconcile(app);
  if (state === 'err') throw new Error(lastMsg);
  app.render();
}

const pushSoon = debounce(async (app) => {
  state = 'busy';
  try { await push(app.s); state = 'ok'; lastMsg = ''; } catch (err) { state = 'err'; lastMsg = err.message; }
  document.querySelector('.sync-dot')?.setAttribute('class', `sync-dot ${state}`);
}, 1500);

export function schedulePush(app) {
  if (cfg.token && cfg.gistId) pushSoon(app);
}

export async function pullOnBoot(app) {
  if (!(cfg.token && cfg.gistId)) return;
  await reconcile(app, { quiet: false });
  app.render();
  // Coming back to the tab (e.g. after editing on the phone) re-checks the cloud copy.
  window.addEventListener('focus', () => reconcile(app, { quiet: true }).then(() => app.render()));
}
