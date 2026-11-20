import React, { useState } from 'react';
import { X, Users, GitBranch, Compass, Plus, Trash2, FileText, BookOpen, Sparkles } from 'lucide-react';
import { extractBibleEntities } from '../utils/bibleCompanion';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { useI18n } from '../utils/i18n';
import { useFeedback } from './Feedback';
import TabStrip from './TabStrip';

const TENSION_LEVELS = ['Moderata', 'Alta', 'Altissima'];
const EMPTY_BIBLE = { synopsis: '', characters: [], plotNotes: [], worldNotes: '' };

export default function NovelBibleModal({ isOpen, onClose, book, settings, onUpdateBible }) {
  const { t } = useI18n();
  const { notify, confirm } = useFeedback();
  const animDuration = settings?.enableAnimations !== false ? Number(settings?.animationDurationMs) || 280 : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, animDuration);
  const [activeTab, setActiveTab] = useState('characters');
  const [isScanningBible, setIsScanningBible] = useState(false);

  if (!shouldRender || !book) return null;

  // Always read the live Bible of the active book (never a stale copy)
  const bible = { ...EMPTY_BIBLE, ...(book.bible || {}) };
  const characters = bible.characters || [];
  const plotNotes = bible.plotNotes || [];
  const updateBible = (patch) => onUpdateBible({ ...bible, ...patch });

  const handleAutoScanAllChapters = async () => {
    setIsScanningBible(true);
    try {
      let mergedBible = bible;
      let totalFound = 0;
      let lastError = null;
      for (const chap of book.chapters || []) {
        if (!chap.content || chap.content.trim().length < 25) continue;
        const res = await extractBibleEntities({
          chapterTitle: chap.title || '',
          chapterContent: chap.content,
          currentBible: mergedBible,
          settings: settings || {}
        });
        if (res.error) lastError = res.error;
        if (res.updatedBible) mergedBible = res.updatedBible;
        totalFound += res.newlyDiscoveredCount || 0;
      }
      onUpdateBible(mergedBible);
      if (totalFound > 0) notify(t('bible.scanFound', { count: totalFound }), { tone: 'ai' });
      else if (lastError) notify(t('editor.bibleNotUpdated', { error: lastError }), { tone: 'error' });
      else notify(t('bible.scanNothing'), { tone: 'info' });
    } catch (err) {
      console.error('Scan error:', err);
      notify(t('editor.bibleNotUpdated', { error: err.message || err }), { tone: 'error' });
    } finally {
      setIsScanningBible(false);
    }
  };

  const handleAddCharacter = () => {
    updateBible({
      characters: [...characters, { id: `char-${Date.now()}`, name: '', role: '', goal: '', flaw: '', notes: '' }]
    });
  };

  const handleUpdateChar = (id, field, value) => {
    updateBible({ characters: characters.map(c => (c.id === id ? { ...c, [field]: value } : c)) });
  };

  const handleDeleteChar = async (char) => {
    const ok = await confirm({
      title: t('bible.deleteCharacterTitle'),
      message: t('bible.deleteCharacterMessage', { name: char.name || t('common.untitled') }),
      confirmLabel: t('common.delete'),
      danger: true
    });
    if (ok) updateBible({ characters: characters.filter(c => c.id !== char.id) });
  };

  const handleAddPlotNote = () => {
    updateBible({
      plotNotes: [...plotNotes, { id: `plot-${Date.now()}`, title: '', tensionLevel: 'Alta', summary: '' }]
    });
  };

  const handleUpdatePlot = (id, field, value) => {
    updateBible({ plotNotes: plotNotes.map(p => (p.id === id ? { ...p, [field]: value } : p)) });
  };

  const handleDeletePlot = async (plot) => {
    const ok = await confirm({
      title: t('bible.deletePlotTitle'),
      message: t('bible.deletePlotMessage', { title: plot.title || t('common.untitled') }),
      confirmLabel: t('common.delete'),
      danger: true
    });
    if (ok) updateBible({ plotNotes: plotNotes.filter(p => p.id !== plot.id) });
  };

  const tabs = [
    { id: 'characters', icon: Users, count: characters.length },
    { id: 'plot', icon: GitBranch, count: plotNotes.length },
    { id: 'world', icon: BookOpen },
    { id: 'synopsis', icon: FileText }
  ];

  return (
    <div className={`m3-modal-backdrop bk-modal-backdrop ${isExiting ? 'm3-modal-backdrop-exit' : ''}`} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bible-title"
        className={`glass-panel m3-dialog-panel bible-dialog ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="m3-dialog-header">
          <div className="bk-dialog-heading">
            <div className="m3-dialog-icon-box"><Compass size={22} className="m3-icon-bounce" /></div>
            <div style={{ minWidth: 0 }}>
              <h2 id="bible-title" className="bk-ellipsis">{t('bible.title', { title: book.title })}</h2>
              <p>{t('bible.subtitle')}</p>
            </div>
          </div>
          <div className="bk-dialog-heading-actions">
            <button
              type="button"
              onClick={handleAutoScanAllChapters}
              disabled={isScanningBible}
              title={t('bible.autoScanHint')}
              className="m3-btn m3-btn-tonal bible-scan-btn"
            >
              <Sparkles size={14} className={isScanningBible ? 'animate-spin' : 'm3-icon-bounce'} />
              <span>{isScanningBible ? t('bible.scanning') : t('bible.autoScan')}</span>
            </button>
            <button type="button" onClick={onClose} className="m3-dialog-close-btn" aria-label={t('common.close')} title={t('common.closeEsc')}>
              <X size={18} />
            </button>
          </div>
        </header>

        <nav className="settings-tabs">
          <TabStrip active={activeTab} onChange={setActiveTab} tabs={tabs.map(tab => ({ ...tab, label: t(`bible.tabs.${tab.id}`) }))} />
        </nav>

        <div className="settings-body">
          {activeTab === 'characters' && (
            <div key="characters" className="m3-tab-content-fluid">
              <div className="bible-toolbar">
                <p>{t('bible.charactersIntro')}</p>
                <button type="button" onClick={handleAddCharacter} className="m3-chip m3-chip-accent">
                  <Plus size={14} className="m3-icon-bounce" /> <span>{t('bible.addCharacter')}</span>
                </button>
              </div>

              {characters.length === 0 ? (
                <div className="bk-empty">
                  <Users size={40} />
                  <p>{t('bible.noCharacters')}</p>
                </div>
              ) : (
                <div className="bible-list">
                  {characters.map(char => (
                    <div key={char.id} className="m3-card bible-card">
                      <div className="bible-card-head">
                        <input
                          type="text"
                          className="settings-input bible-name-input"
                          value={char.name || ''}
                          onChange={(e) => handleUpdateChar(char.id, 'name', e.target.value)}
                          placeholder={t('bible.namePlaceholder')}
                          aria-label={t('bible.name')}
                        />
                        <input
                          type="text"
                          className="settings-input bible-role-input"
                          value={char.role || ''}
                          onChange={(e) => handleUpdateChar(char.id, 'role', e.target.value)}
                          placeholder={t('bible.rolePlaceholder')}
                          aria-label={t('bible.role')}
                        />
                        {char.isAiAutoExtracted && (
                          <span className="m3-chip m3-chip-accent bible-ai-chip" title={t('bible.aiDetectedHint')}>
                            <Sparkles size={11} /> {t('bible.aiDetected')}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteChar(char)}
                          className="m3-dialog-close-btn bible-delete"
                          aria-label={t('bible.deleteCharacterTitle')}
                          title={t('bible.deleteCharacterTitle')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="bible-two-col">
                        <label className="settings-field">
                          <span className="bible-field-label">{t('bible.goal')}</span>
                          <input
                            type="text"
                            className="settings-input"
                            value={char.goal || ''}
                            onChange={(e) => handleUpdateChar(char.id, 'goal', e.target.value)}
                            placeholder={t('bible.goalPlaceholder')}
                          />
                        </label>
                        <label className="settings-field">
                          <span className="bible-field-label bible-field-label-coral">{t('bible.flaw')}</span>
                          <input
                            type="text"
                            className="settings-input"
                            value={char.flaw || ''}
                            onChange={(e) => handleUpdateChar(char.id, 'flaw', e.target.value)}
                            placeholder={t('bible.flawPlaceholder')}
                          />
                        </label>
                      </div>

                      <label className="settings-field">
                        <span className="bible-field-label bible-field-label-muted">{t('bible.notes')}</span>
                        <textarea
                          rows={2}
                          className="settings-input bible-textarea"
                          value={char.notes || ''}
                          onChange={(e) => handleUpdateChar(char.id, 'notes', e.target.value)}
                          placeholder={t('bible.notesPlaceholder')}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'plot' && (
            <div key="plot" className="m3-tab-content-fluid">
              <div className="bible-toolbar">
                <p>{t('bible.plotIntro')}</p>
                <button type="button" onClick={handleAddPlotNote} className="m3-chip m3-chip-accent">
                  <Plus size={14} className="m3-icon-bounce" /> <span>{t('bible.addPlot')}</span>
                </button>
              </div>

              {plotNotes.length === 0 ? (
                <div className="bk-empty">
                  <GitBranch size={40} />
                  <p>{t('bible.noPlot')}</p>
                </div>
              ) : (
                <div className="bible-list">
                  {plotNotes.map((plot, idx) => (
                    <div key={plot.id} className="m3-card bible-card bible-plot-card">
                      <span className="chapter-item-index bible-plot-index">#{idx + 1}</span>
                      <div className="bible-plot-main">
                        <div className="bible-card-head">
                          <input
                            type="text"
                            className="settings-input bible-plot-title"
                            value={plot.title || ''}
                            onChange={(e) => handleUpdatePlot(plot.id, 'title', e.target.value)}
                            placeholder={t('bible.plotTitlePlaceholder')}
                            aria-label={t('bible.plotTitlePlaceholder')}
                          />
                          <select
                            className={`settings-input bible-tension ${plot.tensionLevel === 'Altissima' ? 'bible-tension-max' : ''}`}
                            value={TENSION_LEVELS.includes(plot.tensionLevel) ? plot.tensionLevel : 'Alta'}
                            onChange={(e) => handleUpdatePlot(plot.id, 'tensionLevel', e.target.value)}
                            aria-label={t('bible.tension')}
                          >
                            {TENSION_LEVELS.map(level => <option key={level} value={level}>{t(`bible.tensionLevels.${level}`)}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDeletePlot(plot)}
                            className="m3-dialog-close-btn bible-delete"
                            aria-label={t('bible.deletePlotTitle')}
                            title={t('bible.deletePlotTitle')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          className="settings-input bible-textarea"
                          value={plot.summary || ''}
                          onChange={(e) => handleUpdatePlot(plot.id, 'summary', e.target.value)}
                          placeholder={t('bible.plotSummaryPlaceholder')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'world' && (
            <div key="world" className="m3-tab-content-fluid">
              <p className="bible-intro">{t('bible.worldIntro')}</p>
              <textarea
                rows={16}
                className="settings-input bible-big-textarea"
                value={bible.worldNotes || ''}
                onChange={(e) => updateBible({ worldNotes: e.target.value })}
                placeholder={t('bible.worldPlaceholder')}
              />
            </div>
          )}

          {activeTab === 'synopsis' && (
            <div key="synopsis" className="m3-tab-content-fluid">
              <p className="bible-intro">{t('bible.synopsisIntro')}</p>
              <textarea
                rows={14}
                className="settings-input bible-big-textarea"
                value={bible.synopsis || ''}
                onChange={(e) => updateBible({ synopsis: e.target.value })}
                placeholder={t('bible.synopsisPlaceholder')}
              />
            </div>
          )}
        </div>

        <footer className="bk-dialog-footer bk-dialog-footer-split">
          <span className="bk-footer-note">{t('bible.autoSyncNote')}</span>
          <button type="button" onClick={onClose} className="m3-btn m3-btn-filled">{t('bible.closeAndReturn')}</button>
        </footer>
      </div>
    </div>
  );
}
