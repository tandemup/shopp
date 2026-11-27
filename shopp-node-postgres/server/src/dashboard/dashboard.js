'use strict';

const byId = id => document.getElementById(id);
const write = (id, value) => { byId(id).textContent = value ?? '—'; };
const number = new Intl.NumberFormat('es-ES');
const timestamp = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
const dayFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const login = byId('login');
const loginFields = byId('login-fields');
const resetPanel = byId('password-reset');
const requestResetForm = byId('request-reset');
const confirmResetForm = byId('confirm-reset');
const resetEmail = byId('reset-email');
const backToShopp = byId('back-to-shopp');
if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
  const shopp = new URL(window.location.origin);
  shopp.port = '8081';
  shopp.searchParams.set('shoppScreen', 'settings');
  backToShopp.href = shopp.href;
  byId('login-back-to-shopp').href = shopp.href;
  backToShopp.hidden = false;
}
const refreshButton = byId('refresh');
const signOutButton = byId('sign-out');
let token = null;
let signedInUserId = null;
let refreshing = false;
const usersPath = '/api/v1/admin/users';
const userPanel = byId('user-management');
const userPicker = byId('user-picker');
const userFields = byId('user-fields');
const userSearch = byId('user-search');
const userSelect = byId('user-select');
const reloadUsers = byId('reload-users');
const userRole = byId('user-role');
const toggleUserStatus = byId('toggle-user-status');
const editUser = byId('edit-user');
const permissionsField = byId('user-permissions');
const permissions = [
  ['scanner', 'Escáner'], ['stores', 'Tiendas'], ['chat', 'Chat'], ['parking', 'Aparcamiento'],
  ['englishTutor', 'Tutor de inglés'], ['library', 'Biblioteca'], ['musicPlaylist', 'Música'],
  ['classicalMusic', 'Música clásica'], ['tutorials', 'Tutoriales'], ['news', 'Noticias'],
  ['shoppLive', 'Shopp en directo'], ['p2pPlaylistExchange', 'Intercambio P2P'],
  ['fireAlarm', 'Alarma de incendios'], ['investments', 'Inversiones'],
];
const permissionInputs = new Map();
let users = [];

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
  signedInUserId = null;
  clearProductReviews();
  users = [];
  userSearch.value = '';
  userSelect.replaceChildren();
  editUser.hidden = true;
  userPanel.hidden = true;
  setUsersBusy(false);
  feedback('users-feedback', '');
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
    signedInUserId = result.user.id;
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

for (const [key, title] of permissions) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  label.append(input, title);
  byId('permission-options').append(label);
  permissionInputs.set(key, input);
}

function selectedUser() {
  return users.find(user => user.id === userSelect.value);
}

function renderUserEditor() {
  const user = selectedUser();
  editUser.hidden = !user;
  if (!user) return;

  const ownAccount = user.id === signedInUserId;
  const blocked = user.status === 'blocked';
  const accountStatus = blocked ? 'Cuenta bloqueada' : 'Cuenta activa';
  const emailStatus = user.emailVerified ? 'correo verificado' : 'correo pendiente de verificar';
  write('user-status', accountStatus + ' · ' + emailStatus + (ownAccount ? ' · Tu cuenta' : ''));
  userRole.value = user.role;
  userRole.disabled = ownAccount;
  byId('save-role').disabled = ownAccount;
  toggleUserStatus.disabled = ownAccount;
  toggleUserStatus.textContent = blocked ? 'Desbloquear cuenta' : 'Bloquear cuenta';
  permissionsField.hidden = user.role === 'admin';
  for (const [key, input] of permissionInputs) {
    input.checked = user.permissions?.[key] === true;
  }
}

function renderUserPicker(preferredId = userSelect.value) {
  const query = userSearch.value.trim().toLocaleLowerCase('es');
  const matches = users.filter(user =>
    [user.email, user.name, user.alias].some(value => value?.toLocaleLowerCase('es').includes(query))
  );
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = matches.length ? 'Selecciona una cuenta' : 'No hay cuentas que coincidan';
  const options = matches.map(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name ? user.name + ' · ' + user.email : user.email;
    return option;
  });
  userSelect.replaceChildren(placeholder, ...options);
  userSelect.value = matches.some(user => user.id === preferredId) ? preferredId : '';
  renderUserEditor();
}

function setUsersBusy(busy) {
  userPicker.disabled = busy;
  userFields.disabled = busy;
  reloadUsers.disabled = busy;
}

async function runUserRequest(load, applyResult) {
  if (!token || userPicker.disabled) return;
  const authorization = token;
  setUsersBusy(true);
  feedback('users-feedback', '');
  try {
    const result = await load(authorization);
    if (token === authorization) applyResult(result);
  } catch (error) {
    if (token !== authorization) return;
    if (error.status === 401 || error.status === 403) {
      void closeSession('Vuelve a entrar con una cuenta de administrador.');
      return;
    }
    feedback('users-feedback', error.message);
  } finally {
    if (token === authorization) setUsersBusy(false);
  }
}

function loadUsers() {
  return runUserRequest(
    authorization => request(usersPath, { authorization }),
    result => {
      users = result.users;
      renderUserPicker();
      userSearch.focus();
    },
  );
}

function updateUser(user, field, value) {
  return runUserRequest(
    authorization => request(usersPath + '/' + encodeURIComponent(user.id) + '/' + field, {
      method: 'PATCH', authorization, body: { [field]: value },
    }),
    result => {
      users = users.map(current => current.id === user.id ? { ...current, ...result.user } : current);
      renderUserEditor();
      feedback('users-feedback', 'Cambios guardados.');
    },
  );
}

byId('open-users').addEventListener('click', () => {
  userPanel.hidden = false;
  userPanel.scrollIntoView({ block: 'nearest' });
  void loadUsers();
});
reloadUsers.addEventListener('click', () => void loadUsers());
userSearch.addEventListener('input', () => renderUserPicker());
userSelect.addEventListener('change', () => {
  feedback('users-feedback', '');
  renderUserEditor();
});
byId('save-role').addEventListener('click', () => {
  const user = selectedUser();
  if (user && user.id !== signedInUserId && user.role !== userRole.value) {
    void updateUser(user, 'role', userRole.value);
  }
});
toggleUserStatus.addEventListener('click', () => {
  const user = selectedUser();
  if (user && user.id !== signedInUserId) {
    void updateUser(user, 'status', user.status === 'blocked' ? 'active' : 'blocked');
  }
});
editUser.addEventListener('submit', event => {
  event.preventDefault();
  const user = selectedUser();
  if (user && user.role !== 'admin') {
    const values = Object.fromEntries([...permissionInputs].map(([key, input]) => [key, input.checked]));
    void updateUser(user, 'permissions', values);
  }
});
setUsersBusy(false);

function showResetRequest() {
  confirmResetForm.reset();
  confirmResetForm.hidden = true;
  requestResetForm.hidden = false;
  feedback('reset-feedback', '');
  resetEmail.focus();
}

function returnFromReset(message) {
  byId('email').value = resetEmail.value.trim();
  confirmResetForm.reset();
  requestResetForm.reset();
  resetPanel.hidden = true;
  showLogin(message);
}

byId('open-reset').addEventListener('click', () => {
  resetEmail.value = byId('email').value.trim();
  byId('password').value = '';
  byId('sign-in').hidden = true;
  resetPanel.hidden = false;
  showResetRequest();
});
byId('cancel-reset').addEventListener('click', () => returnFromReset());
byId('request-another-code').addEventListener('click', showResetRequest);

requestResetForm.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = byId('request-reset-fields');
  if (fields.disabled) return;
  const email = resetEmail.value.trim();
  fields.disabled = true;
  feedback('reset-feedback', 'Solicitando código…');
  try {
    await request(requestResetForm.action, { method: 'POST', body: { email } });
    write('reset-instructions', 'Si la cuenta puede recibir un código, lo enviaremos a ' + email + '.');
    requestResetForm.hidden = true;
    confirmResetForm.hidden = false;
    feedback('reset-feedback', '');
    byId('reset-code').focus();
  } catch (error) {
    feedback('reset-feedback', error.message);
  } finally {
    fields.disabled = false;
  }
});

confirmResetForm.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = byId('confirm-reset-fields');
  if (fields.disabled) return;
  const password = byId('reset-password').value;
  if (password !== byId('confirm-password').value) {
    feedback('reset-feedback', 'Las contraseñas no coinciden.');
    byId('confirm-password').focus();
    return;
  }

  const body = { email: resetEmail.value.trim(), code: byId('reset-code').value, password };
  fields.disabled = true;
  feedback('reset-feedback', 'Guardando contraseña…');
  try {
    await request(confirmResetForm.action, { method: 'POST', body });
    returnFromReset('Contraseña actualizada. Entra con tu nueva contraseña.');
  } catch (error) {
    feedback('reset-feedback', error.message);
  } finally {
    fields.disabled = false;
  }
});

signOutButton.addEventListener('click', () => void closeSession());
setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
loginFields.disabled = false;

const reviewPath = '/api/v1/product-reviews';
const reviewPanel = byId('product-reviews');
const reviewList = byId('review-list');
const reviewDialog = byId('confirm-review');
const reloadReviews = byId('reload-reviews');
let reviewBusy = false;
let pendingReviewAction = null;

function clearProductReviews() {
  pendingReviewAction = null;
  if (reviewDialog.open) reviewDialog.close();
  reviewPanel.hidden = true;
  reviewList.replaceChildren();
  reviewBusy = false;
  reloadReviews.disabled = false;
  feedback('reviews-feedback', '');
}

function renderProductReviews(submissions) {
  const cards = submissions.map(item => {
    const card = document.createElement('article');
    card.className = 'review-card';
    const title = document.createElement('h2');
    title.textContent = item.name || 'Producto sin nombre';
    const details = document.createElement('p');
    details.className = 'muted';
    details.textContent = [
      'Código ' + item.barcode, item.brand, item.category,
      item.submitterEmail || item.submittedBy,
      item.createdAt && timestamp.format(new Date(item.createdAt)),
    ].filter(Boolean).join(' · ');
    card.append(title, details);
    if (item.notes) {
      const notes = document.createElement('p');
      notes.textContent = item.notes;
      card.append(notes);
    }
    const actions = document.createElement('div');
    actions.className = 'user-actions';
    for (const [action, label] of [['reject', 'Rechazar'], ['approve', 'Aprobar']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button ' + (action === 'approve' ? 'button-primary' : 'button-secondary');
      button.textContent = label;
      button.addEventListener('click', () => {
        if (reviewBusy || reviewDialog.open) return;
        pendingReviewAction = { item, action };
        write('confirm-review-title', label + ' propuesta');
        write('confirm-review-copy', action === 'approve'
          ? 'Se publicará «' + title.textContent + '» en el catálogo compartido.'
          : 'Se marcará como rechazada la propuesta «' + title.textContent + '».');
        write('confirm-review-action', label);
        reviewDialog.returnValue = 'cancel';
        reviewDialog.showModal();
      });
      actions.append(button);
    }
    card.append(actions);
    return card;
  });
  if (cards.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No hay propuestas pendientes.';
    cards.push(empty);
  }
  reviewList.replaceChildren(...cards);
}

async function runReviewRequest(action) {
  if (!token || reviewBusy) return;
  const authorization = token;
  reviewBusy = true;
  reloadReviews.disabled = true;
  feedback('reviews-feedback', 'Consultando propuestas…');
  try {
    if (action) {
      const path = reviewPath + '/' + encodeURIComponent(action.item.id) + '/' + action.action;
      await request(path, { method: 'POST', authorization, body: {} });
    }
    const result = await request(reviewPath + '?status=pending_review&limit=300', { authorization });
    if (authorization !== token) return;
    renderProductReviews(result.submissions);
    feedback('reviews-feedback', action ? 'Revisión guardada.' : '');
    if (action) void refresh();
  } catch (error) {
    if (authorization !== token) return;
    if (error.status === 401 || error.status === 403) {
      void closeSession('Vuelve a entrar con una cuenta de administrador.');
      return;
    }
    if (action) reviewList.replaceChildren();
    feedback('reviews-feedback', error.message);
  } finally {
    if (authorization === token) {
      reviewBusy = false;
      reloadReviews.disabled = false;
    }
  }
}

byId('open-reviews').addEventListener('click', () => {
  reviewPanel.hidden = false;
  reviewPanel.scrollIntoView({ block: 'nearest' });
  void runReviewRequest();
});
reloadReviews.addEventListener('click', () => void runReviewRequest());
reviewDialog.addEventListener('close', () => {
  const action = pendingReviewAction;
  pendingReviewAction = null;
  if (reviewDialog.returnValue === 'confirm' && action) void runReviewRequest(action);
});
