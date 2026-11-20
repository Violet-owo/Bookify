// Desktop (Tauri) integration helpers with graceful browser fallbacks.
import { isTauriRuntime } from './fileSync';

const SPLASH_MIN_MS = 1700;

async function tauriWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

/** The window starts hidden (tauri.conf.json) so no white flash: show it once the splash is painted. */
export function revealMainWindow() {
  if (!isTauriRuntime()) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      try {
        const win = await tauriWindow();
        await win.show();
        await win.setFocus();
      } catch (err) {
        console.warn('Impossibile mostrare la finestra:', err);
      }
    });
  });
}

/** Fade the splash out once the app is mounted, keeping it on screen long enough to be enjoyed. */
export function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash || splash.dataset.leaving) return;
  splash.dataset.leaving = 'true';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const startedAt = window.__BOOKIFY_SPLASH_START__ || Date.now();
  const wait = reduced ? 0 : Math.max(0, SPLASH_MIN_MS - (Date.now() - startedAt));
  setTimeout(() => {
    splash.classList.add('sp-exit');
    setTimeout(() => splash.remove(), reduced ? 50 : 650);
  }, wait);
}

/** Real window fullscreen on desktop; HTML fullscreen in the browser. Returns the new state. */
export async function toggleAppFullscreen() {
  if (isTauriRuntime()) {
    const win = await tauriWindow();
    const next = !(await win.isFullscreen());
    await win.setFullscreen(next);
    return next;
  }
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    return true;
  }
  await document.exitFullscreen().catch(() => {});
  return false;
}

/** Open a link in the user's default browser (target=_blank does nothing inside Tauri). */
export async function openExternal(url) {
  if (!url) return;
  if (isTauriRuntime()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
      return;
    } catch (err) {
      console.warn('Impossibile aprire il link:', err);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Intercept clicks on external <a href="http..."> links app-wide and route them to the system browser. */
export function installExternalLinkHandler() {
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (/^https?:\/\//i.test(href)) {
      event.preventDefault();
      openExternal(href);
    }
  });
}
