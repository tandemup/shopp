/**
 * Actualizaciones de la PWA Shopp (Expo Web + Netlify).
 * Compara el identificador incluido en el JS cargado con /version.json.
 * Sin dependencia de Convex ni acceso a IndexedDB, localStorage o CacheStorage.
 * Solo se ejecuta en un navegador web. Nunca recarga automáticamente.
 */
const CURRENT_BUILD = process.env.EXPO_PUBLIC_SHOPP_BUILD_ID || 'development';
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const MIN_CHECK_GAP_MS = 15 * 1000;
const DISMISS_PREFIX = 'shopp-pwa-update-dismissed:';

let lastCheckAt = 0;
let checking = null;
let visibleBanner = null;

function dismissed(buildId) {
  try { return window.sessionStorage.getItem(DISMISS_PREFIX + buildId) === 'yes'; }
  catch { return false; }
}

function dismiss(buildId) {
  try { window.sessionStorage.setItem(DISMISS_PREFIX + buildId, 'yes'); }
  catch { /* Safari privado: no importa */ }
  if (visibleBanner) { visibleBanner.remove(); visibleBanner = null; }
}

function createButton(text, filled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText = [
    'font:600 14px system-ui,-apple-system,sans-serif',
    'border-radius:9px',
    'padding:11px 13px',
    'border:1px solid #2563eb',
    'cursor:pointer',
    'min-height:42px',
    `background:${filled ? '#2563eb' : '#fff'}`,
    `color:${filled ? '#fff' : '#2563eb'}`,
  ].join(';');
  button.addEventListener('click', onClick);
  return button;
}

async function reloadForUpdate(button) {
  button.disabled = true;
  button.textContent = 'Actualizando…';
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        // Espera limitada; no bloquear indefinidamente en Safari.
        await Promise.race([
          registration.update().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 1800)),
        ]);
      }
    }
  } finally {
    window.location.reload();
  }
}

function showUpdate(buildId, simulated = false) {
  if (!simulated && dismissed(buildId)) return;
  if (visibleBanner) visibleBanner.remove();
  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.style.cssText = [
    'position:fixed',
    'bottom:calc(85px + env(safe-area-inset-bottom, 0px))',
    'left:12px',
    'right:12px',
    'width:auto',
    'max-width:470px',
    'margin-left:auto',
    'margin-right:auto',
    'padding:16px',
    'z-index:2147483000',
    'background:#fff',
    'border:1px solid #bfdbfe',
    'border-radius:13px',
    'box-shadow:0 12px 40px rgba(15,23,42,.24)',
    'color:#0f172a',
    'font-family:system-ui,-apple-system,sans-serif',
    'box-sizing:border-box',
  ].join(';');
  const title = document.createElement('div');
  title.textContent = simulated ? 'Prueba del aviso de actualización' : 'Actualización de Shopp disponible';
  title.style.cssText = 'font-size:17px;font-weight:750;margin-bottom:6px;';
  const message = document.createElement('div');
  message.textContent = simulated
    ? 'Esta es una simulación. Para verificar una actualización real, publica otra versión en Netlify.'
    : 'Hay una versión nueva de Shopp. Puedes actualizarla sin reinstalarla; las playlists y otros datos de IndexedDB permanecen en este dispositivo.';
  message.style.cssText = 'font-size:13px;line-height:1.5;color:#475569;margin-bottom:13px;';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;';
  actions.appendChild(createButton('Más tarde', false, () => dismiss(buildId)));
  actions.appendChild(createButton('Actualizar ahora', true, (event) => reloadForUpdate(event.currentTarget)));
  banner.append(title, message, actions);
  document.body.appendChild(banner);
  visibleBanner = banner;
}

async function fetchLatestVersion() {
  // La query evita proxies intermedios que ignoran cabeceras de caché.
  const response = await fetch(`/version.json?check=${Date.now()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('json')) return null; // Dev SPA fallback -> index.html
  const info = await response.json();
  return info?.schema === 1 && typeof info.buildId === 'string' && info.buildId.length > 5
    ? info.buildId : null;
}

async function checkForPwaUpdate(force = false) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (checking) return checking;
  if (!force && Date.now() - lastCheckAt < MIN_CHECK_GAP_MS) return false;
  lastCheckAt = Date.now();
  checking = (async () => {
    try {
      const latest = await fetchLatestVersion();
      if (latest && latest !== CURRENT_BUILD) {
        showUpdate(latest);
        return true;
      }
      return false;
    } catch (error) {
      // Sin red: no mostrar alertas molestas ni alterar datos del usuario.
      console.debug('[Shopp] No se pudo comprobar la actualización:', error);
      return false;
    } finally {
      checking = null;
    }
  })();
  return checking;
}

function installDebugControl() {
  // Añade ?pwaUpdates=debug en la URL para probar el aviso en Safari/Chrome.
  const params = new URLSearchParams(window.location.search);
  if (params.get('pwaUpdates') !== 'debug') return;
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'position:fixed;right:10px;top:calc(60px + env(safe-area-inset-top,0px));z-index:2147483000;display:flex;gap:6px;max-width:95vw;';
  toolbar.appendChild(createButton('Comprobar versión', false, async (event) => {
    const b = event.currentTarget;
    b.disabled = true;
    const found = await checkForPwaUpdate(true);
    b.disabled = false;
    if (!found) window.alert('Shopp: no hay una versión nueva disponible (o no se pudo obtener version.json).');
  }));
  toolbar.appendChild(createButton('Simular aviso', true, () => showUpdate('simulada', true)));
  document.body.appendChild(toolbar);
}

export function setupPwaUpdateNotifications() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const start = () => {
    installDebugControl();
    checkForPwaUpdate(true);
    window.addEventListener('focus', () => checkForPwaUpdate());
    window.addEventListener('online', () => checkForPwaUpdate(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForPwaUpdate();
    });
    window.setInterval(() => {
      if (document.visibilityState === 'visible') checkForPwaUpdate();
    }, CHECK_INTERVAL_MS);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
