import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, Sparkles, X } from 'lucide-react';
import { useI18n } from '../utils/i18n';

const FeedbackContext = createContext({
  notify: () => {},
  confirm: async () => false
});

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  ai: Sparkles
};

const DEFAULT_DURATION = { success: 3200, info: 3600, ai: 4500, error: 6500 };

/**
 * Themed toasts and confirmation dialogs, replacing the native alert()/confirm()
 * (which look out of place in a desktop app and block the UI thread).
 */
export function FeedbackProvider({ children }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 260);
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const notify = useCallback((message, { tone = 'info', duration } = {}) => {
    if (!message) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((list) => [...list.filter((toast) => toast.message !== message).slice(-3), { id, message, tone }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration ?? DEFAULT_DURATION[tone] ?? 3600));
  }, [dismiss]);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setDialog({ ...options, resolve });
  }), []);

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}

      <div className="bk-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = TONE_ICONS[toast.tone] || Info;
          return (
            <div key={toast.id} className={`bk-toast bk-toast-${toast.tone} ${toast.leaving ? 'bk-toast-leaving' : ''}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={16} className="bk-toast-icon" />
              <span className="bk-toast-text">{toast.message}</span>
              <button type="button" className="bk-toast-close" onClick={() => dismiss(toast.id)} aria-label={t('common.close')}>
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel || t('common.confirm')}
          cancelLabel={dialog.cancelLabel || t('common.cancel')}
          danger={dialog.danger}
          onResolve={closeDialog}
        />
      )}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onResolve }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onResolve(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onResolve]);

  return (
    <div className="bk-confirm-backdrop m3-modal-backdrop" onMouseDown={() => onResolve(false)}>
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bk-confirm-title"
        aria-describedby="bk-confirm-message"
        className="bk-confirm m3-popup-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`bk-confirm-icon ${danger ? 'bk-confirm-icon-danger' : ''}`}>
          <AlertTriangle size={20} />
        </div>
        <h2 id="bk-confirm-title">{title}</h2>
        {message && <p id="bk-confirm-message">{message}</p>}
        <div className="bk-confirm-actions">
          <button type="button" className="m3-btn m3-btn-outlined" onClick={() => onResolve(false)}>{cancelLabel}</button>
          <button
            ref={confirmRef}
            type="button"
            className={`m3-btn ${danger ? 'm3-btn-danger' : 'm3-btn-filled'}`}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
