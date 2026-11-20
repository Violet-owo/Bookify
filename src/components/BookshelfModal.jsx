import React, { useState } from 'react';
import { X, Plus, Trash2, Copy, Download, Upload, Bookmark, Layers, FolderOpen } from 'lucide-react';
import { createNewBook, exportProjectBackup } from '../utils/storage';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { useI18n } from '../utils/i18n';
import { useFeedback } from './Feedback';

const GENRES = ['thriller', 'contemporary', 'historical', 'scifi', 'fantasy', 'mystery', 'romance', 'horror', 'nonfiction'];
const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;

export default function BookshelfModal({
  isOpen,
  onClose,
  library,
  settings,
  onSelectBook,
  onCreateBook,
  onDuplicateBook,
  onDeleteBook,
  onOpenFileFromDisk
}) {
  const { t, language } = useI18n();
  const { notify, confirm } = useFeedback();
  const animDuration = settings?.enableAnimations !== false ? Number(settings?.animationDurationMs) || 280 : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, animDuration);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('thriller');
  const [newTargetWords, setNewTargetWords] = useState(60000);
  const locale = language === 'en' ? 'en-US' : 'it-IT';

  if (!shouldRender) return null;

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newBook = createNewBook(newTitle.trim(), t(`genres.${newGenre}`), language);
    newBook.targetWords = Math.max(1000, parseInt(newTargetWords, 10) || 50000);
    onCreateBook(newBook);
    setIsCreating(false);
    setNewTitle('');
    onClose();
  };

  const handleDelete = async (book) => {
    const ok = await confirm({
      title: t('bookshelf.deleteTitle'),
      message: t('bookshelf.deleteMessage', { title: book.title }),
      confirmLabel: t('common.delete'),
      danger: true
    });
    if (ok) {
      onDeleteBook(book.id);
      notify(t('bookshelf.deleted', { title: book.title }), { tone: 'info' });
    }
  };

  const handleExportBackup = async () => {
    try {
      const result = await exportProjectBackup(library, language);
      if (result?.success) notify(t('drawer.exported', { file: result.fileName }), { tone: 'success' });
    } catch (error) {
      notify(t('drawer.exportFailed', { error: error.message || error }), { tone: 'error' });
    }
  };

  const formatDate = (iso) => {
    if (!iso) return t('bookshelf.recently');
    try {
      return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso.slice(0, 10);
    }
  };

  return (
    <div className={`m3-modal-backdrop bk-modal-backdrop ${isExiting ? 'm3-modal-backdrop-exit' : ''}`} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookshelf-title"
        className={`glass-panel m3-dialog-panel bookshelf-dialog ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="m3-dialog-header">
          <div className="bk-dialog-heading">
            <div className="m3-dialog-icon-box"><Bookmark size={20} className="m3-icon-bounce" /></div>
            <div>
              <h2 id="bookshelf-title">{t('bookshelf.title')}</h2>
              <p>{t('bookshelf.subtitle')}</p>
            </div>
          </div>
          <div className="bk-dialog-heading-actions">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFileFromDisk?.();
              }}
              className="m3-btn m3-btn-outlined bookshelf-header-btn"
            >
              <FolderOpen size={14} className="m3-icon-bounce" style={{ color: 'var(--accent-amber)' }} />
              <span>{t('bookshelf.openFromDisk')}</span>
            </button>
            <button type="button" onClick={() => setIsCreating(true)} className="m3-btn m3-btn-filled bookshelf-header-btn">
              <Plus size={15} className="m3-icon-bounce" /> {t('bookshelf.newBook')}
            </button>
            <button type="button" onClick={onClose} className="m3-dialog-close-btn" aria-label={t('common.close')} title={t('common.closeEsc')}>
              <X size={17} />
            </button>
          </div>
        </header>

        <div className="bookshelf-body">
          {isCreating && (
            <form onSubmit={handleCreateSubmit} className="animate-fade-in bookshelf-create">
              <div className="bookshelf-create-head">
                <h3>{t('bookshelf.createTitle')}</h3>
                <button type="button" className="editor-icon-btn" onClick={() => setIsCreating(false)} aria-label={t('common.cancel')}>
                  <X size={16} />
                </button>
              </div>

              <div className="bookshelf-create-grid">
                <label className="settings-field">
                  <span className="settings-field-label">{t('bookshelf.bookTitle')} *</span>
                  <input
                    type="text"
                    required
                    className="settings-input"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t('bookshelf.titlePlaceholder')}
                    autoFocus
                  />
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">{t('bookshelf.genre')}</span>
                  <select className="settings-input" value={newGenre} onChange={(e) => setNewGenre(e.target.value)}>
                    {GENRES.map(id => <option key={id} value={id}>{t(`genres.${id}`)}</option>)}
                  </select>
                </label>
                <label className="settings-field">
                  <span className="settings-field-label">{t('bookshelf.wordGoal')}</span>
                  <input
                    type="number"
                    className="settings-input"
                    value={newTargetWords}
                    onChange={(e) => setNewTargetWords(e.target.value)}
                    min={1000}
                    step={5000}
                  />
                </label>
              </div>

              <div className="bookshelf-create-actions">
                <button type="button" className="m3-btn m3-btn-outlined" onClick={() => setIsCreating(false)}>{t('common.cancel')}</button>
                <button type="submit" className="m3-btn m3-btn-filled" disabled={!newTitle.trim()}>{t('bookshelf.createAndWrite')}</button>
              </div>
            </form>
          )}

          <div className="bookshelf-grid">
            {library.books.map((book) => {
              const isActive = book.id === library.activeBookId;
              const totalWords = (book.chapters || []).reduce((acc, chap) => acc + countWords(chap.content), 0);
              const target = book.targetWords || 50000;
              const progress = Math.min(100, Math.round((totalWords / target) * 100));
              const spine = book.coverColor || 'var(--accent-cyan)';

              return (
                <div
                  key={book.id}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    onSelectBook(book.id);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectBook(book.id);
                      onClose();
                    }
                  }}
                  className={`m3-card book-card ${isActive ? 'm3-card-active' : ''}`}
                  style={{ '--spine': spine }}
                >
                  <div className="book-cover" aria-hidden="true">
                    <span className="book-cover-genre">{book.genre || t('genres.contemporary')}</span>
                    <span className="book-cover-title">{book.title}</span>
                    <span className="book-cover-rule" />
                    <span className="book-cover-author">{book.author || ''}</span>
                  </div>

                  <div className="book-card-info">
                    <div className="book-card-top">
                      <h3 className="book-card-title">{book.title}</h3>
                      {isActive && <span className="book-card-active">{t('bookshelf.active')}</span>}
                    </div>
                    {book.subtitle && <p className="book-card-subtitle">{book.subtitle}</p>}
                    <p className="book-card-meta">
                      {t('bookshelf.meta', { chapters: (book.chapters || []).length, date: formatDate(book.updatedAt) })}
                    </p>

                    <div className="book-card-progress">
                      <div className="book-card-progress-head">
                        <span>{t('bookshelf.progress')}</span>
                        <strong>{totalWords.toLocaleString(locale)} / {target.toLocaleString(locale)}</strong>
                      </div>
                      <div className="book-card-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                        <div style={{ width: `${Math.max(progress, totalWords ? 1.5 : 0)}%` }} />
                      </div>
                    </div>

                    <div className="book-card-actions">
                      <button
                        type="button"
                        title={t('bookshelf.duplicate')}
                        aria-label={t('bookshelf.duplicate')}
                        className="editor-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateBook(book);
                        }}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Copy size={14} />
                      </button>
                      {library.books.length > 1 && (
                        <button
                          type="button"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                          className="editor-icon-btn book-card-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(book);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="bookshelf-footer">
          <div className="bookshelf-footer-info">
            <Layers size={15} />
            <span>{t(library.books.length === 1 ? 'bookshelf.totalOne' : 'bookshelf.totalMany', { count: library.books.length })}</span>
          </div>
          <div className="bookshelf-footer-actions">
            <button
              type="button"
              className="m3-btn m3-btn-outlined"
              onClick={() => {
                onClose();
                onOpenFileFromDisk?.();
              }}
              title={t('bookshelf.restoreHint')}
            >
              <Upload size={14} />
              <span>{t('bookshelf.restoreBackup')}</span>
            </button>
            <button type="button" className="m3-btn m3-btn-outlined" onClick={handleExportBackup}>
              <Download size={14} />
              <span>{t('bookshelf.exportBackup')}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
