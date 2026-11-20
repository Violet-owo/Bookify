import React, { useEffect } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { useI18n } from '../utils/i18n';
import DiffViewer from './DiffViewer';
import AiCircleLoader from './AiCircleLoader';

/**
 * "Review & compare" dialog shared by the Editor and the Editor's Room:
 * word diff, original vs editable AI proposal, explanation and actions.
 */
export default function RewriteReviewDialog({ review, onClose, onChangeImproved, onRequestAlternative, onApply }) {
  const { t } = useI18n();

  // Esc closes only this dialog, not the panels underneath
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!review) return null;
  const applyDisabled = review.loading || !review.improved?.trim() || review.improved === review.original;

  return (
    <div
      role="presentation"
      className="m3-modal-backdrop editor-review-backdrop"
      onMouseDown={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="rewrite-review-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="m3-popup-panel editor-review-dialog"
      >
        <div className="editor-review-head">
          <div className="bk-dialog-heading">
            <div className="m3-dialog-icon-box"><Sparkles size={20} className="m3-icon-bounce" /></div>
            <div>
              <h2 id="rewrite-review-title">{t('editor.reviewTitle')}</h2>
              {review.reason && <p>{review.reason}</p>}
            </div>
          </div>
          <button type="button" className="m3-dialog-close-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="editor-review-section">
          <div className="editor-review-legend">
            <span className="editor-review-label">{t('editor.diffTitle')}</span>
            <span>
              <span className="diff-legend-removed">{t('editor.diffRemoved')}</span>
              <span className="diff-legend-added">{t('editor.diffAdded')}</span>
            </span>
          </div>
          {review.loading ? (
            <div className="editor-review-loading">
              <AiCircleLoader compact size={32} message={t('editor.rewritingMessage')} submessage={t('editor.rewritingSub')} />
            </div>
          ) : (
            <DiffViewer original={review.original} modified={review.improved} />
          )}
        </div>

        <div className="editor-compare-grid">
          <label className="editor-compare-label">
            {t('editor.originalInChapter')}
            <textarea value={review.original} readOnly rows={5} className="editor-compare-area" />
          </label>
          <label className="editor-compare-label editor-compare-label-accent">
            {t('editor.aiProposalEditable')}
            <textarea
              value={review.loading ? t('editor.generatingRewrite') : review.improved}
              disabled={review.loading}
              onChange={(event) => onChangeImproved(event.target.value)}
              rows={5}
              className="editor-compare-area editor-compare-accent"
            />
          </label>
        </div>

        {review.explanation && (
          <p className="editor-review-explanation"><strong>{t('editor.editorialExplanation')}</strong> {review.explanation}</p>
        )}
        {review.error && <p role="alert" className="editor-error" style={{ marginTop: '0.8rem' }}>{review.error}</p>}
        {review.fallback && <p className="editor-review-note">{t('editor.localFallback')}</p>}

        <div className="editor-review-actions">
          <button type="button" onClick={onRequestAlternative} disabled={review.loading} className="m3-btn m3-btn-tonal" title={t('editor.anotherVariantHint')}>
            <Sparkles size={13} className={review.loading ? 'animate-spin' : 'm3-icon-bounce'} />
            <span>{review.loading ? t('editor.generatingVariant') : t('editor.anotherVariant')}</span>
          </button>
          <div className="editor-review-actions-right">
            <button type="button" onClick={onClose} className="m3-btn m3-btn-outlined">{t('common.cancel')}</button>
            <button type="button" onClick={onApply} disabled={applyDisabled} className="m3-btn m3-btn-filled">
              <Check size={15} /> {t('editor.applyToText')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
