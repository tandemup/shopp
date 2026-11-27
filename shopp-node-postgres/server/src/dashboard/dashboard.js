'use strict';

const byId = id => document.getElementById(id);
const write = (id, value) => { byId(id).textContent = value ?? '—'; };
const number = new Intl.NumberFormat('es-ES');
const timestamp = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
const dayFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const login = byId('login');
const loginFields = byId('login-fields');
const refreshButton = byId('refresh');
const signOutButton = byId('sign-out');
let token = null;
let refreshing = false;

function feedback(id, message) {
  const item = byId(id);
  item.textContent = message;
  item.hidden = !message;
}

async function request(path, { method = 'GET', authorization, body } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (authorization) headers.set('Authorization', 'Bearer ' + authorization);
  if (body) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload === null) {
    const error = new Error(payload?.error?.message || 'No se pudo consultar el servidor.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function uptimeText(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  if (days) return days + ' d ' + hours + ' h';
  if (hours) return hours + ' h ' + minutes + ' min';
  return minutes ? minutes + ' min' : seconds + ' s';
}

function showStatus(stale) {
  for (const [id, label] of [['api-status', 'Disponible'], ['db-status', 'Conectado']]) {
    const badge = byId(id);
    badge.textContent = stale ? 'Sin actualizar' : label;
    badge.dataset.state = stale ? 'stale' : 'online';
  }
}

function renderActivity(activity) {
  const maximum = Math.max(1, ...activity.map(item => item.lists));
  const rows = activity.map(item => {
    const row = document.createElement('li');
    const day = document.createElement('time');
    day.dateTime = item.day;
    day.textContent = dayFormat.format(new Date(item.day + 'T00:00:00Z'));
    const bar = document.createElement('progress');
    bar.value = item.lists;
    bar.max = maximum;
    bar.setAttribute('aria-hidden', 'true');
    const count = document.createElement('span');
    count.className = 'activity-count';
    count.textContent = number.format(item.lists);
    row.append(day, bar, count);
    return row;
  });
  byId('activity').replaceChildren(...rows);
}

function render(snapshot) {
  const { api, database, counts, sampledAt, activity } = snapshot;
  write('updated-at', 'Actualizado el ' + timestamp.format(new Date(sampledAt)));
  write('node-version', api.nodeVersion);
  write('uptime', uptimeText(api.uptimeSeconds));
  write('memory', number.format(Math.round(api.rssBytes / 1048576)) + ' MiB');
  write('db-version', database.version);
  write('db-ping', number.format(database.pingMs) + ' ms');
  write('db-pool', database.openConnections + ' · ' + database.idleConnections + ' libres · ' + database.waitingRequests + ' en espera');
  write('migration-count', number.format(database.migrations));
  write('latest-migration', database.latestMigration);
  for (const name of ['users', 'sessions', 'lists', 'rooms', 'messages']) write(name, number.format(counts[name]));
  write('playlists', number.format(counts.music + counts.classical));
  write('playlist-detail', number.format(counts.music) + ' de Música · ' + number.format(counts.classical) + ' de Clásica');
  write('pending-stores', number.format(counts.pendingStores));
  write('pending-products', number.format(counts.pendingProducts));
  renderActivity(activity);
  showStatus(false);
  feedback('dashboard-feedback', '');
}

function showLogin(message = '') {
  byId('dashboard').hidden = true;
  signOutButton.hidden = true;
  byId('sign-in').hidden = false;
  feedback('login-feedback', message);
  byId('email').focus();
}

async function closeSession(message) {
  const current = token;
  token = null;
  showLogin(message);
  if (current) await request('/api/v1/auth/logout', { method: 'POST', authorization: current }).catch(() => {});
}

async function refresh() {
  if (!token || refreshing) return;
  const authorization = token;
  refreshing = true;
  refreshButton.disabled = true;
  try {
    const snapshot = await request('/api/v1/admin/dashboard', { authorization });
    if (authorization === token) render(snapshot);
  } catch (error) {
    if (authorization !== token) return;
    if (error.status === 401 || error.status === 403) {
      void closeSession('Vuelve a entrar con una cuenta de administrador.');
      return;
    }
    showStatus(true);
    feedback('dashboard-feedback', 'No se pudo actualizar. Se muestra la última consulta.');
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
  }
}

login.addEventListener('submit', async event => {
  event.preventDefault();
  if (loginFields.disabled) return;

  const body = { email: byId('email').value.trim(), password: byId('password').value };
  byId('password').value = '';
  loginFields.disabled = true;
  write('login-button', 'Entrando…');
  feedback('login-feedback', '');
  let authorization;
  try {
    const result = await request('/api/v1/auth/login', { method: 'POST', body });
    authorization = result.token;
    if (result.user?.role !== 'admin') throw new Error('El panel requiere una cuenta de administrador.');
    const snapshot = await request('/api/v1/admin/dashboard', { authorization });
    render(snapshot);
    token = authorization;
    byId('sign-in').hidden = true;
    byId('dashboard').hidden = false;
    signOutButton.hidden = false;
    refreshButton.focus();
  } catch (error) {
    if (authorization) void request('/api/v1/auth/logout', { method: 'POST', authorization }).catch(() => {});
    feedback('login-feedback', error.message || 'No se pudo iniciar sesión.');
  } finally {
    loginFields.disabled = false;
    write('login-button', 'Entrar');
  }
});

refreshButton.addEventListener('click', refresh);
signOutButton.addEventListener('click', () => void closeSession());
setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
loginFields.disabled = false;
