import React, { useState, useEffect } from 'react';
import { X, BookMarked, Target, Sparkles, Layers, Check, FileText, Lock, RefreshCw, Lightbulb, Tag, Feather } from 'lucide-react';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { suggestBookMetadata } from '../utils/aiService';
import { useI18n } from '../utils/i18n';
import { useFeedback } from './Feedback';
import TabStrip from './TabStrip';
import AiCircleLoader from './AiCircleLoader';

const GENRE_KEYS = ['thriller', 'mystery', 'scifi', 'fantasy', 'historical', 'contemporary', 'horror', 'romance', 'adventure', 'nonfiction'];
const MIN_WORDS_FOR_AI = 150;
const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;

function toForm(book) {
  return {
    title: book?.title || '',
    subtitle: book?.subtitle || '',
    author: book?.author || '',
    genre: book?.genre || '',
    targetWords: book?.targetWords || 60000,
    synopsis: book?.synopsis || book?.bible?.synopsis || '',
    styleNotes: book?.styleNotes || ''
  };
}

export default function BookMetadataModal({ isOpen, onClose, book, onUpdateBook, settings = {} }) {
  const { t, language } = useI18n();
  const { notify } = useFeedback();
  const duration = settings.enableAnimations !== false ? settings.animationDurationMs || 280 : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, duration);
  const locale = language === 'en' ? 'en-US' : 'it-IT';

  const [activeTab, setActiveTab] = useState('main');
  const [formData, setFormData] = useState(() => toForm(book));
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);

  // Reset the form each time the dialog opens or the active book changes
  useEffect(() => {
    if (isOpen) setFormData(toForm(book));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, book?.id]);

  useEffect(() => {
    setAiSuggestions(null);
  }, [book?.id]);

  if (!shouldRender || !book) return null;

  const genreOptions = GENRE_KEYS.map(key => t(`genres.${key}`));
  if (formData.genre && !genreOptions.includes(formData.genre)) genreOptions.unshift(formData.genre);

  const totalWords = (book.chapters || []).reduce((acc, c) => acc + countWords(c.content), 0);
  const hasEnoughWordsForAi = totalWords >= MIN_WORDS_FOR_AI;
  const aiProgressPercent = Math.min(100, Math.round((totalWords / MIN_WORDS_FOR_AI) * 100));
  const target = Math.max(1000, Number(formData.targetWords) || 60000);
  const progressPercent = Math.min(100, Math.round((totalWords / target) * 100));
  const setField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleGenerateAi = async () => {
    if (!hasEnoughWordsForAi) return;
    setIsGeneratingAi(true);
    try {
      const res = await suggestBookMetadata({ book, settings });
      if (res.success) setAiSuggestions(res);
      else notify(res.message || t('metadata.writeMore'), { tone: 'info' });
    } catch (err) {
      console.error('AI generation error:', err);
      notify(err.message || t('metadata.aiFailed'), { tone: 'error' });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const titleOf = (entry) => (typeof entry === 'string' ? entry : entry?.title || '');

  const applySingle = (field, value, labelKey) => {
    if (!value) return;
    setField(field, value);
    notify(t('metadata.applied', { field: t(labelKey) }), { tone: 'success' });
  };

  const handleApplyAllAi = () => {
    if (!aiSuggestions) return;
    const firstTitle = titleOf(aiSuggestions.titles?.[0]);
    setFormData(prev => ({
      ...prev,
      title: firstTitle || prev.title,
      subtitle: aiSuggestions.tagline || prev.subtitle,
      synopsis: aiSuggestions.synopsis || prev.synopsis,
      genre: aiSuggestions.suggestedGenre || prev.genre,
      styleNotes: aiSuggestions.styleNotes || prev.styleNotes
    }));
    notify(t('metadata.allApplied'), { tone: 'ai' });
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    onUpdateBook({
      ...formData,
      title: formData.title.trim() || book.title,
      targetWords: target
    });
    notify(t('metadata.saved'), { tone: 'success' });
    onClose();
  };

  const tabs = [
    { id: 'main', icon: Layers, label: t('metadata.tabs.main') },
    { id: 'synopsis', icon: FileText, label: t('metadata.tabs.synopsis') },
    { id: 'ai', icon: Sparkles, label: hasEnoughWordsForAi ? t('metadata.tabs.ai') : t('metadata.tabs.aiLocked', { current: totalWords, min: MIN_WORDS_FOR_AI }), locked: !hasEnoughWordsForAi }
  ];

  return (
    <div className={`m3-modal-backdrop bk-modal-backdrop ${isExiting ? 'm3-modal-backdrop-exit' : ''}`} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-title"
        className={`glass-panel m3-dialog-panel metadata-dialog ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="m3-dialog-header">
          <div className="bk-dialog-heading">
            <div className="m3-dialog-icon-box"><BookMarked size={22} className="m3-icon-bounce" /></div>
            <div>
              <h2 id="metadata-title">{t('metadata.title')}</h2>
              <p>{t('metadata.subtitle')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="m3-dialog-close-btn" aria-label={t('common.close')} title={t('common.closeEsc')}>
            <X size={18} />
          </button>
        </header>

        <nav className="settings-tabs">
          <TabStrip active={activeTab} onChange={setActiveTab} tabs={tabs} />
        </nav>

        <form onSubmit={handleSubmit} className="metadata-form">
          <div className="settings-body">
            {activeTab === 'main' && (
              <div key="main" className="m3-tab-content-fluid settings-stack">
                <section className="settings-section">
                  <div className="settings-section-head">
                    <div className="settings-section-title"><Target size={16} /><h3>{t('metadata.progressTitle')}</h3></div>
                    <span className="settings-usage-total">
                      {totalWords.toLocaleString(locale)} / {target.toLocaleString(locale)} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="book-card-bar metadata-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ width: `${progressPercent}%`, background: 'var(--accent-cyan)' }} />
                  </div>
                </section>

                <div className="metadata-grid metadata-grid-title">
                  <label className="settings-field">
                    <span className="settings-field-label">{t('metadata.bookTitle')} *</span>
                    <input
                      type="text"
                      className="settings-input metadata-title-input"
                      value={formData.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder={t('metadata.titlePlaceholder')}
                    />
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">{t('metadata.author')}</span>
                    <input
                      type="text"
                      className="settings-input"
                      value={formData.author}
                      onChange={(e) => setField('author', e.target.value)}
                      placeholder={t('metadata.authorPlaceholder')}
                    />
                  </label>
                </div>

                <label className="settings-field">
                  <span className="settings-field-label">{t('metadata.subtitleTagline')}</span>
                  <input
                    type="text"
                    className="settings-input"
                    value={formData.subtitle}
                    onChange={(e) => setField('subtitle', e.target.value)}
                    placeholder={t('metadata.taglinePlaceholder')}
                  />
                </label>

                <div className="metadata-grid">
                  <label className="settings-field">
                    <span className="settings-field-label">{t('metadata.genre')}</span>
                    <select className="settings-input" value={formData.genre} onChange={(e) => setField('genre', e.target.value)}>
                      {!formData.genre && <option value="">—</option>}
                      {genreOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span className="settings-field-label">{t('metadata.targetWords')}</span>
                    <input
                      type="number"
                      min="1000"
                      max="500000"
                      step="1000"
                      className="settings-input settings-input-mono"
                      value={formData.targetWords}
                      onChange={(e) => setField('targetWords', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'synopsis' && (
              <div key="synopsis" className="m3-tab-content-fluid settings-stack">
                <label className="settings-field">
                  <span className="settings-field-label">{t('metadata.synopsis')}</span>
                  <textarea
                    rows={7}
                    className="settings-input bible-textarea metadata-textarea"
                    value={formData.synopsis}
                    onChange={(e) => setField('synopsis', e.target.value)}
                    placeholder={t('metadata.synopsisPlaceholder')}
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">{t('metadata.styleNotes')}</span>
                  <textarea
                    rows={4}
                    className="settings-input bible-textarea metadata-textarea"
                    value={formData.styleNotes}
                    onChange={(e) => setField('styleNotes', e.target.value)}
                    placeholder={t('metadata.styleNotesPlaceholder')}
                  />
                </label>
              </div>
            )}

            {activeTab === 'ai' && (
              <div key="ai" className="m3-tab-content-fluid settings-stack">
                {!hasEnoughWordsForAi ? (
                  <div className="metadata-locked">
                    <div className="metadata-locked-icon"><Lock size={24} className="m3-icon-bounce" /></div>
                    <div>
                      <h3>{t('metadata.lockedTitle')}</h3>
                      <p>{t('metadata.lockedDesc')}</p>
                    </div>
                    <div className="metadata-locked-progress">
                      <div className="book-card-progress-head">
                        <span>{t('metadata.wordsWritten')}</span>
                        <strong>{totalWords} / {MIN_WORDS_FOR_AI} ({aiProgressPercent}%)</strong>
                      </div>
                      <div className="book-card-bar metadata-bar">
                        <div style={{ width: `${aiProgressPercent}%`, background: 'var(--accent-cyan)' }} />
                      </div>
                    </div>
                    <p className="metadata-locked-hint">{t('metadata.writeMoreCount', { count: Math.max(0, MIN_WORDS_FOR_AI - totalWords) })}</p>
                  </div>
                ) : (
                  <>
                    <section className="settings-section metadata-ai-banner">
                      <div>
                        <div className="settings-section-title"><Sparkles size={16} /><h3>{t('metadata.readyTitle', { count: totalWords.toLocaleString(locale) })}</h3></div>
                        <p className="settings-section-desc" style={{ marginTop: '0.35rem' }}>{t('metadata.readyDesc')}</p>
                      </div>
                      <button type="button" onClick={handleGenerateAi} disabled={isGeneratingAi} className="m3-btn m3-btn-filled">
                        <RefreshCw size={15} className={isGeneratingAi ? 'animate-spin' : 'm3-icon-bounce'} />
                        <span>{isGeneratingAi ? t('metadata.analyzing') : aiSuggestions ? t('metadata.regenerate') : t('metadata.generate')}</span>
                      </button>
                    </section>

                    {isGeneratingAi && !aiSuggestions && (
                      <AiCircleLoader compact size={34} message={t('metadata.loaderMessage')} submessage={t('metadata.loaderSub')} />
                    )}

                    {aiSuggestions && (
                      <div className="animate-fade-in settings-stack">
                        <div className="metadata-apply-all">
                          <button type="button" onClick={handleApplyAllAi} className="m3-btn m3-btn-tonal">
                            <Sparkles size={14} className="m3-icon-bounce" />
                            <span>{t('metadata.applyAll')}</span>
                          </button>
                        </div>

                        <section className="settings-section">
                          <div className="settings-section-title"><Tag size={15} /><h3>{t('metadata.titleProposals')}</h3></div>
                          <div className="metadata-title-list">
                            {(aiSuggestions.titles || []).map((entry, idx) => {
                              const titleText = titleOf(entry) || t('ai.proposal', { n: idx + 1 });
                              return (
                                <div key={idx} className="metadata-title-item">
                                  <div style={{ minWidth: 0 }}>
                                    <div className="metadata-title-row">
                                      <span className="metadata-title-text">{titleText}</span>
                                      {entry?.style && <span className="metadata-style-chip">{entry.style}</span>}
                                    </div>
                                    {entry?.reason && <p className="metadata-reason">{entry.reason}</p>}
                                  </div>
                                  <button type="button" onClick={() => applySingle('title', titleText, 'metadata.fieldTitle')} className="m3-btn m3-btn-tonal metadata-use-btn">
                                    {t('metadata.useTitle')}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </section>

                        {aiSuggestions.tagline && (
                          <section className="settings-section">
                            <div className="settings-section-head">
                              <div className="settings-section-title"><Lightbulb size={15} style={{ color: 'var(--accent-amber)' }} /><h3>{t('metadata.taglineProposal')}</h3></div>
                              <button type="button" onClick={() => applySingle('subtitle', aiSuggestions.tagline, 'metadata.fieldTagline')} className="m3-btn m3-btn-tonal metadata-use-btn">{t('metadata.useAsTagline')}</button>
                            </div>
                            <blockquote className="metadata-quote">{aiSuggestions.tagline}</blockquote>
                          </section>
                        )}

                        {aiSuggestions.synopsis && (
                          <section className="settings-section">
                            <div className="settings-section-head">
                              <div className="settings-section-title"><Feather size={15} /><h3>{t('metadata.synopsisProposal')}</h3></div>
                              <button type="button" onClick={() => applySingle('synopsis', aiSuggestions.synopsis, 'metadata.fieldSynopsis')} className="m3-btn m3-btn-tonal metadata-use-btn">{t('metadata.useAsSynopsis')}</button>
                            </div>
                            <div className="metadata-synopsis">{aiSuggestions.synopsis}</div>
                          </section>
                        )}

                        <div className="settings-two-col">
                          {aiSuggestions.suggestedGenre && (
                            <section className="settings-section">
                              <div className="settings-section-head">
                                <h3 className="metadata-small-title">{t('metadata.suggestedGenre')}</h3>
                                <button type="button" onClick={() => applySingle('genre', aiSuggestions.suggestedGenre, 'metadata.fieldGenre')} className="m3-chip">{t('metadata.set')}</button>
                              </div>
                              <div className="metadata-genre">{aiSuggestions.suggestedGenre}</div>
                            </section>
                          )}
                          {aiSuggestions.styleNotes && (
                            <section className="settings-section">
                              <div className="settings-section-head">
                                <h3 className="metadata-small-title">{t('metadata.styleNotesShort')}</h3>
                                <button type="button" onClick={() => applySingle('styleNotes', aiSuggestions.styleNotes, 'metadata.fieldStyle')} className="m3-chip">{t('metadata.set')}</button>
                              </div>
                              <div className="metadata-reason">{aiSuggestions.styleNotes}</div>
                            </section>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <footer className="bk-dialog-footer">
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text">{t('common.cancel')}</button>
            <button type="submit" className="m3-btn m3-btn-filled">
              <Check size={16} className="m3-icon-bounce" />
              <span>{t('metadata.saveChanges')}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
