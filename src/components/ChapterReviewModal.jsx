import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, RefreshCw, FileCheck, Check, Flame, Zap, ArrowRight, EyeOff, Plus, Sparkles, BookOpen } from 'lucide-react';
import { reviewChapterContent, reviewWholeBook, buildNovelContext, generateCliffhangerIdeas, rewriteSuggestion } from '../utils/aiService';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { useI18n } from '../utils/i18n';
import { useFeedback } from './Feedback';
import TabStrip from './TabStrip';
import RewriteReviewDialog from './RewriteReviewDialog';
import AiCircleLoader from './AiCircleLoader';

/** Find the sentence around an AI quote, tolerating small differences in quotes, spacing and ellipses. */
function locateTargetSnippet(text, target) {
  if (!text || !target) return null;
  const cleanTarget = target.trim();
  if (!cleanTarget) return null;

  let matchStart = text.lastIndexOf(cleanTarget);
  if (matchStart < 0) {
    const unquoted = cleanTarget.replace(/^[«"“'—–\s-]+|[»"”'—–\s.-]+$/g, '').trim();
    if (unquoted.length > 5) matchStart = text.lastIndexOf(unquoted);
  }
  if (matchStart < 0 && /\.{3}|…/.test(cleanTarget)) {
    for (const part of cleanTarget.split(/\.{3}|…/).map(p => p.trim()).filter(p => p.length > 4)) {
      const idx = text.lastIndexOf(part);
      if (idx >= 0) { matchStart = idx; break; }
    }
  }
  if (matchStart < 0) {
    const normalizedTarget = cleanTarget.replace(/\s+/g, ' ');
    if (text.replace(/\s+/g, ' ').lastIndexOf(normalizedTarget) >= 0) {
      matchStart = text.lastIndexOf(normalizedTarget.split(' ').slice(0, 4).join(' '));
    }
  }
  if (matchStart < 0) {
    const words = cleanTarget.replace(/[«"“»”'—–.,;!?…()]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    if (words.length >= 2) matchStart = text.lastIndexOf(words.slice(0, 3).join(' '));
    if (matchStart < 0 && words.length > 0) {
      const longestWord = [...words].sort((a, b) => b.length - a.length)[0];
      if (longestWord?.length >= 6) matchStart = text.lastIndexOf(longestWord);
    }
  }
  if (matchStart < 0 && cleanTarget.length > 25) matchStart = text.lastIndexOf(cleanTarget.slice(0, 25).trim());
  if (matchStart < 0) return null;

  const preceding = text.slice(0, matchStart);
  let start = Math.max(...['\n', '.', '!', '?', '…'].map(ch => preceding.lastIndexOf(ch))) + 1;
  while (/\s/.test(text[start] || '') && text[start] !== '\n') start += 1;
  const targetEnd = matchStart + Math.min(cleanTarget.length, text.length - matchStart);
  const following = text.slice(targetEnd);
  const nextBoundary = following.search(/[.!?…\n]/);
  const end = nextBoundary < 0 ? text.length : targetEnd + nextBoundary + (following[nextBoundary] === '\n' ? 0 : 1);
  const original = text.slice(start, end).trimEnd();
  return { start, end: start + original.length, original };
}

function FindingCard({ quote, quoteClass, critique, suggestion, suggestionLabel, isDone, onReview, t }) {
  return (
    <div className={`review-finding ${isDone ? 'review-finding-done' : ''}`}>
      <p className={`review-finding-quote ${quoteClass || ''}`}>{quote}</p>
      {critique && <p className="review-finding-critique">{critique}</p>}
      <div className="review-finding-footer">
        {suggestion ? (
          <span className="review-finding-suggestion">
            {suggestionLabel && <strong>{suggestionLabel} </strong>}
            {suggestion}
          </span>
        ) : <span />}
        <button type="button" onClick={onReview} disabled={isDone} className={`m3-btn ${isDone ? 'review-done-btn' : 'm3-btn-filled'} review-finding-btn`}>
          {isDone ? <><Check size={13} /> {t('review.applied')}</> : <><Sparkles size={13} /> {t('review.reviewCompare')}</>}
        </button>
      </div>
    </div>
  );
}

export default function ChapterReviewModal({ isOpen, onClose, chapter, book, settings, onApplyFix, onAppendCliffhanger }) {
  const { t, language } = useI18n();
  const { notify } = useFeedback();
  const locale = language === 'en' ? 'en-US' : 'it-IT';
  const animDuration = settings?.enableAnimations !== false ? Number(settings?.animationDurationMs) || 280 : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, animDuration);

  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [bookReview, setBookReview] = useState(null);
  const [bookReviewProgress, setBookReviewProgress] = useState(null);
  const [bookReviewError, setBookReviewError] = useState(null);
  const [isReviewingBook, setIsReviewingBook] = useState(false);
  const [rewriteReview, setRewriteReview] = useState(null);
  const [activeTab, setActiveTab] = useState('pacing');
  const [appliedFixes, setAppliedFixes] = useState(() => new Set());
  const [cliffhangers, setCliffhangers] = useState([]);
  const [loadingCliffhangers, setLoadingCliffhangers] = useState(false);
  const lastAnalyzedChapterIdRef = useRef(null);

  const chapterRef = useRef(chapter);
  chapterRef.current = chapter;
  const bookRef = useRef(book);
  bookRef.current = book;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const runReview = useCallback(async () => {
    const current = chapterRef.current;
    if (!current) return;
    setLoading(true);
    setReviewError(null);
    try {
      const data = await reviewChapterContent({
        chapterText: current.content || '',
        chapterTitle: current.title || '',
        settings: settingsRef.current,
        bookContext: buildNovelContext(bookRef.current, current.id)
      });
      setReviewData(data);
      lastAnalyzedChapterIdRef.current = current.id;
    } catch (err) {
      console.error('Failed to review chapter', err);
      setReviewError(err.message || t('review.failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Analyse automatically when the room opens on a chapter that has not been analysed yet
  useEffect(() => {
    if (isOpen && chapter && lastAnalyzedChapterIdRef.current !== chapter.id) {
      setCliffhangers([]);
      runReview();
    }
  }, [isOpen, chapter?.id, runReview]); // eslint-disable-line react-hooks/exhaustive-deps

  // A different book invalidates the whole-book results
  useEffect(() => {
    setBookReview(null);
    setBookReviewError(null);
    setAppliedFixes(new Set());
  }, [book?.id]);

  if (!shouldRender || !chapter) return null;

  const runFullBookReview = async () => {
    if (!book) return;
    setIsReviewingBook(true);
    setBookReview(null);
    setBookReviewError(null);
    setBookReviewProgress({ current: 0, total: book.chapters?.length || 0, title: '' });
    setActiveTab('book');
    try {
      setBookReview(await reviewWholeBook({ book, settings, onProgress: setBookReviewProgress }));
    } catch (error) {
      setBookReviewError(error.message || t('review.bookFailed'));
    } finally {
      setIsReviewingBook(false);
    }
  };

  const handleFetchCliffhangers = async () => {
    setLoadingCliffhangers(true);
    try {
      const results = await generateCliffhangerIdeas({ chapterText: chapter.content || '', chapterTitle: chapter.title || '', settings });
      setCliffhangers(Array.isArray(results) ? results : []);
    } catch (err) {
      notify(err.message || t('review.cliffhangerFailed'), { tone: 'error' });
    } finally {
      setLoadingCliffhangers(false);
    }
  };

  const fetchRewrite = async (review, sentence) => {
    const targetChapter = book?.chapters?.find(item => item.id === review.targetChapterId) || chapter;
    const text = targetChapter?.content || '';
    return rewriteSuggestion({
      sentence,
      context: text.slice(Math.max(0, review.start - 350), Math.min(text.length, review.end + 350)),
      bookContext: buildNovelContext(book, targetChapter?.id),
      original: review.target,
      reason: review.reason,
      suggestion: review.suggestion,
      settings
    });
  };

  const openRewriteReview = async (target, reason, suggestion, targetChapterId = chapter.id) => {
    const targetChapter = book?.chapters?.find(item => item.id === targetChapterId) || chapter;
    const located = locateTargetSnippet(targetChapter?.content || '', target);
    const review = {
      target,
      targetChapterId: targetChapter?.id || chapter.id,
      reason,
      suggestion,
      start: located?.start ?? 0,
      end: located?.end ?? 0,
      original: located?.original ?? (target || ''),
      improved: located?.original ?? (target || ''),
      explanation: reason || '',
      isLocated: Boolean(located),
      fallback: false,
      loading: true,
      error: located ? null : t('review.notLocated')
    };
    setRewriteReview(review);
    try {
      const result = await fetchRewrite(review, review.original);
      setRewriteReview(current => current ? { ...current, ...result, improved: result.improved?.trim() || current.original, loading: false } : current);
    } catch (error) {
      setRewriteReview(current => current ? { ...current, loading: false, error: error.message || t('editor.rewriteFailed') } : current);
    }
  };

  const requestAiAlternative = async () => {
    if (!rewriteReview) return;
    setRewriteReview(current => ({ ...current, loading: true, error: null }));
    try {
      const result = await fetchRewrite(rewriteReview, rewriteReview.original);
      setRewriteReview(current => current ? { ...current, ...result, improved: result.improved?.trim() || current.improved, loading: false } : current);
    } catch (error) {
      setRewriteReview(current => current ? { ...current, loading: false, error: error.message || t('editor.alternativeFailed') } : current);
    }
  };

  const applyRewriteReview = () => {
    if (!rewriteReview || rewriteReview.loading) return;
    const targetChapter = book?.chapters?.find(item => item.id === rewriteReview.targetChapterId) || chapter;
    const currentText = targetChapter?.content || '';
    const { start, end, original, improved, isLocated, target, targetChapterId } = rewriteReview;

    let applied = false;
    if (isLocated && currentText.slice(start, end) === original) {
      applied = onApplyFix?.(original, improved, start, end, targetChapterId);
    } else {
      const reloc = locateTargetSnippet(currentText, original || target);
      if (reloc) {
        applied = onApplyFix?.(reloc.original, improved, reloc.start, reloc.end, targetChapterId);
      } else if (target && currentText.includes(target)) {
        const idx = currentText.indexOf(target);
        applied = onApplyFix?.(target, improved, idx, idx + target.length, targetChapterId);
      }
    }

    if (!applied) {
      setRewriteReview(current => ({ ...current, error: t('review.cannotApply') }));
      return;
    }

    setAppliedFixes(prev => new Set([...prev, `${targetChapterId}:${target}`, `${targetChapterId}:${original}`]));
    notify(t('review.fixApplied', { snippet: improved.length > 40 ? `${improved.slice(0, 40)}…` : improved }), { tone: 'success' });
    setRewriteReview(null);
  };

  const handleAppend = (text) => {
    onAppendCliffhanger?.(text);
    notify(t('review.cliffhangerAppended'), { tone: 'success' });
  };

  const isFixDone = (quote, chapterId = chapter.id) => Boolean(quote) && appliedFixes.has(`${chapterId}:${quote}`);
  const pacingScore = Math.max(0, Math.min(100, Number(reviewData?.pacingScore) || 0));
  const pacingGood = pacingScore > 75;
  const bookFindingCount = (bookReview?.chapters || []).reduce((total, item) => {
    const r = item.report;
    return total + (r?.showDontTell?.length || 0) + (r?.craft?.length || 0) + (r?.rhythm?.length || 0) + (r?.orthography?.length || 0) + (r?.temporalCoherence?.length || 0);
  }, 0);

  const tabs = [
    { id: 'pacing', icon: Flame },
    { id: 'showDontTell', icon: EyeOff, count: reviewData?.showDontTell?.length },
    { id: 'cliffhangers', icon: Zap },
    { id: 'orthography', icon: FileCheck, count: reviewData?.orthography?.length },
    { id: 'book', icon: BookOpen, count: bookFindingCount }
  ];

  return (
    <div className={`m3-modal-backdrop bk-drawer-backdrop ${isExiting ? 'm3-modal-backdrop-exit' : ''}`} onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className={`glass-panel m3-drawer-panel review-drawer ${isExiting ? 'm3-drawer-panel-exit' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="m3-dialog-header review-header">
          <div className="bk-dialog-heading">
            <div className="m3-dialog-icon-box"><Zap size={22} className="m3-icon-bounce" /></div>
            <div style={{ minWidth: 0 }}>
              <h2 id="review-title">{t('review.title')}</h2>
              <p className="bk-ellipsis">{t('review.subtitle', { title: chapter.title || '' })}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="m3-dialog-close-btn" aria-label={t('common.close')} title={t('common.closeEsc')}>
            <X size={18} />
          </button>
        </header>

        <div className="review-actions">
          <button type="button" onClick={() => runReview()} disabled={loading} title={t('review.reanalyzeHint')} className="m3-chip">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{t('review.reanalyze')}</span>
          </button>
          <button type="button" onClick={runFullBookReview} disabled={isReviewingBook} title={t('review.bookHint')} className="m3-chip m3-chip-accent">
            <BookOpen size={14} className={isReviewingBook ? 'animate-spin' : ''} />
            <span>
              {isReviewingBook
                ? t('review.bookProgressShort', { current: bookReviewProgress?.current || 0, total: bookReviewProgress?.total || 0 })
                : t('review.analyzeBook')}
            </span>
          </button>
        </div>

        {reviewData?.stats && !loading && (
          <div className="review-stats">
            <div className="review-gauge">
              <div className="review-gauge-head">
                <span className="review-gauge-title">
                  <Flame size={15} style={{ color: pacingGood ? 'var(--accent-cyan)' : 'var(--accent-coral)' }} />
                  {t('review.tension')}
                </span>
                <span className={`m3-chip review-score ${pacingGood ? 'review-score-good' : 'review-score-low'}`}>
                  {pacingScore}/100 · {reviewData.pacingReview?.tensionLevel || t('ai.draftLevel')}
                </span>
              </div>
              <div className="review-gauge-track">
                <div className={pacingGood ? 'review-gauge-fill-good' : 'review-gauge-fill-low'} style={{ width: `${pacingScore}%` }} />
              </div>
            </div>
            <div className="review-tiles">
              <div className="review-tile">
                <strong>{Number(reviewData.stats.wordCount || 0).toLocaleString(locale)}</strong>
                <span>{t('review.words')}</span>
              </div>
              <div className="review-tile">
                <strong>{reviewData.stats.avgWordsPerSentence || 0}</strong>
                <span>{t('review.wordsPerSentence')}</span>
              </div>
              <div className="review-tile">
                <strong>~{reviewData.stats.readingTimeMin || 0}m</strong>
                <span>{t('review.reading')}</span>
              </div>
            </div>
          </div>
        )}

        <nav className="review-tabs">
          <TabStrip active={activeTab} onChange={setActiveTab} tabs={tabs.map(tab => ({ ...tab, label: t(`review.tabs.${tab.id}`) }))} />
        </nav>

        <div className="review-body">
          {loading && activeTab !== 'book' && activeTab !== 'cliffhangers' ? (
            <div className="review-loading">
              <AiCircleLoader message={t('review.loadingMessage')} submessage={t('review.loadingSub')} />
            </div>
          ) : reviewError && activeTab !== 'book' && activeTab !== 'cliffhangers' ? (
            <div role="alert" className="review-error">
              <p>{reviewError}</p>
              <button type="button" className="m3-btn m3-btn-outlined" onClick={() => runReview()}>{t('review.retry')}</button>
            </div>
          ) : (
            <>
              {reviewData?.source === 'local' && activeTab !== 'book' && activeTab !== 'cliffhangers' && (
                <p role="status" className="review-local-note">{t('review.localNote')}</p>
              )}

              {activeTab === 'pacing' && (
                <div className="settings-stack">
                  <section className="settings-section">
                    <div className="settings-section-title"><Flame size={16} style={{ color: 'var(--accent-coral)' }} /><h3>{t('review.pacingTitle')}</h3></div>
                    <p className="review-paragraph">{reviewData?.pacingReview?.pacingCritique || reviewData?.summary || t('review.noIssues')}</p>
                  </section>

                  {reviewData?.rhythm?.length > 0 && (
                    <div>
                      <h4 className="review-group-title review-group-title-coral">{t('review.rhythmTitle', { count: reviewData.rhythm.length })}</h4>
                      <div className="review-list">
                        {reviewData.rhythm.map((r, i) => (
                          <FindingCard
                            key={i}
                            t={t}
                            quote={r.quote}
                            critique={r.critique}
                            suggestion={r.suggestion}
                            isDone={isFixDone(r.quote)}
                            onReview={() => openRewriteReview(r.quote, r.critique, r.suggestion)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {reviewData?.craft?.length > 0 && (
                    <div>
                      <h4 className="review-group-title">{t('review.craftTitle', { count: reviewData.craft.length })}</h4>
                      <div className="review-list">
                        {reviewData.craft.map((c, i) => (
                          <FindingCard
                            key={i}
                            t={t}
                            quote={c.quote}
                            critique={c.category ? `${c.category} — ${c.critique || ''}` : c.critique}
                            suggestion={c.suggestion}
                            isDone={isFixDone(c.quote)}
                            onReview={() => openRewriteReview(c.quote, c.critique, c.suggestion)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {reviewData?.stylisticNotes?.length > 0 && (
                    <div className="review-list">
                      <h4 className="review-group-title">{t('review.notesTitle')}</h4>
                      {reviewData.stylisticNotes.map((sn, idx) => (
                        <div key={idx} className="review-note">
                          <strong>{sn.title}</strong>
                          <span>{sn.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'showDontTell' && (
                <div className="settings-stack">
                  <div className="review-callout">
                    <h4>{t('review.sdtTitle')}</h4>
                    <p>{t('review.sdtDesc')}</p>
                  </div>
                  {!reviewData?.showDontTell?.length ? (
                    <div className="bk-empty">
                      <CheckCircle2 size={36} style={{ color: 'var(--accent-green)', opacity: 1 }} />
                      <p>{t('review.sdtEmpty')}</p>
                    </div>
                  ) : (
                    <div className="review-list">
                      {reviewData.showDontTell.map((sdt, idx) => (
                        <FindingCard
                          key={idx}
                          t={t}
                          quote={sdt.quote}
                          quoteClass="review-finding-quote-coral"
                          critique={sdt.critique}
                          suggestion={sdt.replacement}
                          suggestionLabel={t('review.alternative')}
                          isDone={isFixDone(sdt.quote)}
                          onReview={() => openRewriteReview(sdt.quote, sdt.critique, sdt.replacement)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'cliffhangers' && (
                <div className="settings-stack">
                  <div className="review-toolbar">
                    <div>
                      <h4>{t('review.cliffTitle')}</h4>
                      <p>{t('review.cliffDesc')}</p>
                    </div>
                    <button type="button" onClick={handleFetchCliffhangers} disabled={loadingCliffhangers} className="m3-btn m3-btn-filled">
                      <Sparkles size={14} className={loadingCliffhangers ? 'animate-spin' : ''} />
                      <span>{loadingCliffhangers ? t('review.generating') : t('review.generateCliff')}</span>
                    </button>
                  </div>
                  {loadingCliffhangers && cliffhangers.length === 0 ? (
                    <AiCircleLoader compact size={34} message={t('review.cliffLoading')} />
                  ) : cliffhangers.length === 0 ? (
                    <div className="bk-empty">
                      <Zap size={36} />
                      <p>{t('review.cliffEmpty')}</p>
                    </div>
                  ) : (
                    <div className="review-list">
                      {cliffhangers.map((ch, idx) => (
                        <div key={idx} className="review-cliff">
                          <div className="review-cliff-head">
                            <span className="review-cliff-type">{ch.type}</span>
                            <button type="button" onClick={() => handleAppend(ch.text)} className="m3-btn m3-btn-tonal review-finding-btn">
                              <Plus size={12} /> {t('review.appendEnd')}
                            </button>
                          </div>
                          <blockquote className="review-cliff-text">{ch.text}</blockquote>
                          {ch.explanation && <p className="review-finding-critique"><strong>{t('review.whyItWorks')}</strong> {ch.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'orthography' && (
                !reviewData?.orthography?.length ? (
                  <div className="bk-empty">
                    <CheckCircle2 size={36} style={{ color: 'var(--accent-green)', opacity: 1 }} />
                    <p>{t('review.orthoEmpty')}</p>
                  </div>
                ) : (
                  <div className="review-list">
                    {reviewData.orthography.map((item, idx) => {
                      const isDone = isFixDone(item.original);
                      return (
                        <div key={idx} className={`review-ortho ${isDone ? 'review-finding-done' : ''}`}>
                          <div style={{ minWidth: 0 }}>
                            <div className="review-ortho-row">
                              <span className="review-ortho-from">{item.original}</span>
                              <ArrowRight size={13} />
                              <span className="review-ortho-to">{item.fix}</span>
                            </div>
                            {item.explanation && <span className="review-finding-critique">{item.explanation}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => openRewriteReview(item.original, item.explanation, item.fix)}
                            disabled={isDone}
                            className={`m3-btn ${isDone ? 'review-done-btn' : 'm3-btn-tonal'} review-finding-btn`}
                          >
                            {isDone ? <><Check size={13} /> {t('review.applied')}</> : t('review.review')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {activeTab === 'book' && (
                <div className="settings-stack">
                  <div>
                    <h3 className="review-book-title">{t('review.bookTitle', { title: book?.title || '' })}</h3>
                    <p className="review-paragraph">{t('review.bookDesc')}</p>
                  </div>

                  {isReviewingBook && (
                    <div role="status" className="review-progress">
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{t('review.bookProgress', { current: bookReviewProgress?.current || 0, total: bookReviewProgress?.total || 0, title: bookReviewProgress?.title || '' })}</span>
                    </div>
                  )}

                  {bookReviewError && <p role="alert" className="editor-error">{bookReviewError}</p>}

                  {!bookReview && !isReviewingBook && !bookReviewError && (
                    <section className="settings-section">
                      <p className="review-paragraph">{t('review.bookIntro')}</p>
                      <div><button type="button" className="m3-btn m3-btn-filled" onClick={runFullBookReview}>{t('review.startBook')}</button></div>
                    </section>
                  )}

                  {bookReview?.chapters.map(chapterResult => {
                    if (chapterResult.error) {
                      return (
                        <section key={chapterResult.chapterId} className="review-book-error">
                          <h4>{chapterResult.title}</h4>
                          <p>{chapterResult.error}</p>
                        </section>
                      );
                    }
                    const report = chapterResult.report;
                    const findings = [
                      ...(report.showDontTell || []).map(item => ({ target: item.quote, reason: item.critique, suggestion: item.replacement, category: t('review.cat.voice') })),
                      ...(report.craft || []).map(item => ({ target: item.quote, reason: item.critique, suggestion: item.suggestion, category: item.category || t('review.cat.craft') })),
                      ...(report.rhythm || []).map(item => ({ target: item.quote, reason: item.critique, suggestion: item.suggestion, category: t('review.cat.rhythm') })),
                      ...(report.orthography || []).map(item => ({ target: item.original, reason: item.explanation, suggestion: item.fix, category: t('review.cat.ortho') })),
                      ...(report.temporalCoherence || []).map(item => ({ target: item.passage, reason: item.note, suggestion: item.expectedTense, category: t('review.cat.continuity') }))
                    ].filter(item => item.target && String(item.target).trim());

                    return (
                      <section key={chapterResult.chapterId} className="review-book-chapter">
                        <div className="review-book-chapter-head">
                          <h4>{chapterResult.title}</h4>
                          <span>{chapterResult.cached ? t('review.cached') : t('review.proposals', { count: findings.length })}</span>
                        </div>
                        {findings.length === 0 ? (
                          <p className="review-finding-critique">{t('review.noFindings')}</p>
                        ) : (
                          <div className="review-list">
                            {findings.map((finding, index) => {
                              const isDone = isFixDone(finding.target, chapterResult.chapterId);
                              return (
                                <article key={`${chapterResult.chapterId}-${index}`} className={`review-finding ${isDone ? 'review-finding-done' : ''}`}>
                                  <div className="review-finding-category">{finding.category}</div>
                                  <p className="review-finding-quote">{finding.target}</p>
                                  {finding.reason && <p className="review-finding-critique">{finding.reason}</p>}
                                  <div className="review-finding-footer">
                                    <span />
                                    <button
                                      type="button"
                                      onClick={() => openRewriteReview(finding.target, finding.reason, finding.suggestion, chapterResult.chapterId)}
                                      disabled={isDone}
                                      className={`m3-btn ${isDone ? 'review-done-btn' : 'm3-btn-tonal'} review-finding-btn`}
                                    >
                                      {isDone ? <><Check size={13} /> {t('review.applied')}</> : t('review.reviewProposal')}
                                    </button>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {rewriteReview && (
        <RewriteReviewDialog
          review={rewriteReview}
          onClose={() => setRewriteReview(null)}
          onChangeImproved={(improved) => setRewriteReview(current => ({ ...current, improved }))}
          onRequestAlternative={requestAiAlternative}
          onApply={applyRewriteReview}
        />
      )}
    </div>
  );
}
