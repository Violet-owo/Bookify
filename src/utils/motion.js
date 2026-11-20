// Motion toolkit: Material-style ripples and the circular theme reveal.
import { flushSync } from 'react-dom';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Animation speed chosen in Settings (1 = default 280 ms, 0 = animations off). */
export function motionScale() {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-scale'));
  return Number.isFinite(value) ? value : 1;
}

/**
 * Material ripple on every button-like element. One global listener: no
 * per-component wiring, and it also covers dialogs rendered later.
 */
export function installRipple() {
  const SELECTOR = 'button, [role="button"], [role="tab"], .ripple';
  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || prefersReducedMotion() || motionScale() === 0) return;
    const host = event.target.closest?.(SELECTOR);
    if (!host || host.disabled || host.dataset.noRipple !== undefined) return;

    const rect = host.getBoundingClientRect();
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    let layer = host.querySelector(':scope > .bk-ripple-layer');
    if (!layer) {
      layer = document.createElement('span');
      layer.className = 'bk-ripple-layer';
      layer.setAttribute('aria-hidden', 'true');
      host.appendChild(layer);
    }

    const size = Math.hypot(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'bk-ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    layer.appendChild(ripple);

    const release = () => {
      ripple.classList.add('is-fading');
      setTimeout(() => ripple.remove(), 520 * Math.max(motionScale(), 0.3));
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }, { passive: true });
}

/**
 * Switch theme with a circle that grows from (x, y) and paints the whole app.
 * `apply` must synchronously update the DOM (it runs inside flushSync).
 */
export function revealTheme(x, y, apply) {
  const run = () => flushSync(apply);
  const scale = motionScale();
  if (!document.startViewTransition || prefersReducedMotion() || scale === 0) {
    run();
    return;
  }
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  document.documentElement.classList.add('theme-transition');
  const transition = document.startViewTransition(run);
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: Math.round(720 * scale), easing: 'cubic-bezier(0.65, 0, 0.15, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
  transition.finished.finally(() => document.documentElement.classList.remove('theme-transition'));
}
