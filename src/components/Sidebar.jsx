import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Compass,
  BookMarked,
  Sparkles,
  Settings,
  Library,
  Download,
  FileText,
  FileDown,
  Book,
  PanelLeftClose
} from 'lucide-react';
import { exportChapterFile, exportCompleteBook } from '../utils/storage';
import { useI18n } from '../utils/i18n';
import { useFeedback } from './Feedback';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;

function NavItem({ icon: Icon, label, shortcut, onClick, anim }) {
  return (
    <button type="button" className="sb-nav-item" onClick={onClick} title={shortcut ? `${label} (${shortcut})` : label}>
      <span className="sb-nav-icon"><Icon size={18} strokeWidth={2} className={anim} /></span>
      <span className="sb-nav-label">{label}</span>
      {shortcut && <kbd className="sb-nav-kbd">{shortcut}</kbd>}
    </button>
  );
}

/**
 * Left sidebar: the active book (cover, progress), its chapters and the studio tools.
 * Docked on wide windows, a sliding sheet on narrow ones.
 */
export default function Sidebar({
  book,
  currentChapterId,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onOpenBookshelf,
  onOpenBible,
  onOpenMetadata,
  onOpenReview,
  onOpenSettings,
  onCollapse,
  mode = 'docked',
  collapsed = false,
  exiting = false,
  isWriting = false
}) {
  const { t, language } = useI18n();
  const { notify, confirm } = useFeedback();
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  const { containerRef: listRef, indicatorStyle } = useSlidingIndicator(currentChapterId);
  const locale = language === 'en' ? 'en-US' : 'it-IT';

  const chapters = book?.chapters || [];
  const totalWords = chapters.reduce((acc, chap) => acc + countWords(chap.content), 0);
  const target = Math.max(1000, Number(book?.targetWords) || 60000);
  const progress = Math.min(100, (totalWords / target) * 100);
  const currentChapter = chapters.find(c => c.id === currentChapterId) || chapters[0];

  useEffect(() => {
    if (!exportOpen) return undefined;
    const close = (event) => {
      if (!exportRef.current?.contains(event.target)) setExportOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [exportOpen]);

  // Keep the active chapter visible in the list
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [currentChapterId]);

  if (!book) return null;

  const handleDelete = async (chapter) => {
    const ok = await confirm({
      title: t('drawer.deleteTitle'),
      message: t('drawer.deleteMessage', { title: chapter.title || t('common.untitled') }),
      confirmLabel: t('common.delete'),
      danger: true
    });
    if (ok) onDeleteChapter(chapter.id);
  };

  const runExport = async (action) => {
    setExportOpen(false);
    try {
      const result = await action();
      if (result?.success) notify(t('drawer.exported', { file: result.fileName }), { tone: 'success' });
    } catch (error) {
      notify(t('drawer.exportFailed', { error: error.message || error }), { tone: 'error' });
    }
  };

  const initials = (book.title || 'B').trim().charAt(0).toUpperCase();

  return (
    <aside
      className={`sidebar sidebar-${mode} ${collapsed ? 'is-collapsed' : ''} ${exiting ? 'is-exiting' : ''} ${isWriting ? 'sidebar-writing' : ''}`}
      aria-label={t('sidebar.label')}
      aria-hidden={collapsed || undefined}
      inert={collapsed}
    >
      <div className="sb-top">
        <div className="sb-brand">
          <img src="/logo.svg" alt="" className="sb-brand-logo" />
          <span className="sb-brand-name">Bookify</span>
        </div>
        <button type="button" className="sb-icon-btn" onClick={onCollapse} title={`${t('sidebar.hide')} (Ctrl+J)`} aria-label={t('sidebar.hide')}>
          <PanelLeftClose size={17} strokeWidth={2} className="ic-nudge-left" />
        </button>
      </div>

      <button type="button" className="sb-book" onClick={onOpenBookshelf} title={t('topbar.bookshelfHint')}>
        <span className="sb-cover" style={{ '--cover': book.coverColor || 'var(--accent-cyan)' }}>
          <span className="sb-cover-letter">{initials}</span>
        </span>
        <span className="sb-book-text">
          <span className="sb-book-title">{book.title}</span>
          <span className="sb-book-author">{book.author || t('common.untitled')}</span>
        </span>
        <Library size={15} strokeWidth={1.75} className="sb-book-switch" />
      </button>

      <div className="sb-progress" title={t('sidebar.progressHint', { words: totalWords.toLocaleString(locale), target: target.toLocaleString(locale) })}>
        <div className="sb-progress-track"><div style={{ width: `${progress}%` }} /></div>
        <div className="sb-progress-meta">
          <span>{totalWords.toLocaleString(locale)} / {target.toLocaleString(locale)}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="sb-section-head">
        <span>{t('sidebar.chapters')}</span>
        <div className="sb-section-actions">
          <div className="sb-export" ref={exportRef}>
            <button
              type="button"
              className="sb-icon-btn"
              onClick={() => setExportOpen(open => !open)}
              title={t('drawer.exportTitle')}
              aria-label={t('drawer.exportTitle')}
              aria-expanded={exportOpen}
            >
              <Download size={16} strokeWidth={2} className="ic-drop" />
            </button>
            {exportOpen && (
              <div className="sb-menu m3-dropdown-menu" role="menu">
                <div className="sb-menu-title">{t('drawer.exportTitle')}</div>
                <button type="button" role="menuitem" onClick={() => runExport(() => exportChapterFile(currentChapter, book.title, 'md', language))}>
                  <FileDown size={14} /> {t('drawer.exportChapterMd')}
                </button>
                <button type="button" role="menuitem" onClick={() => runExport(() => exportChapterFile(currentChapter, book.title, 'txt', language))}>
                  <FileText size={14} /> {t('drawer.exportChapterTxt')}
                </button>
                <div className="sb-menu-sep" />
                <button type="button" role="menuitem" onClick={() => runExport(() => exportCompleteBook(book, 'md', language))}>
                  <Book size={14} /> {t('drawer.exportBookMd')}
                </button>
                <button type="button" role="menuitem" onClick={() => runExport(() => exportCompleteBook(book, 'txt', language))}>
                  <Book size={14} /> {t('drawer.exportBookTxt')}
                </button>
              </div>
            )}
          </div>
          <button type="button" className="sb-icon-btn" onClick={onAddChapter} title={t('drawer.newChapter')} aria-label={t('drawer.newChapter')}>
            <Plus size={17} strokeWidth={2} className="ic-rotate" />
          </button>
        </div>
      </div>

      <nav className="sb-chapters" ref={listRef} aria-label={t('sidebar.chapters')}>
        <span className="slide-indicator sb-chapter-indicator" style={indicatorStyle} aria-hidden="true" />
        {chapters.map((chap, idx) => {
          const isCurrent = chap.id === currentChapter?.id;
          return (
            <div
              key={chap.id}
              role="button"
              tabIndex={0}
              aria-current={isCurrent ? 'true' : undefined}
              data-active={isCurrent ? 'true' : undefined}
              style={{ '--i': idx }}
              className={`sb-chapter ${isCurrent ? 'sb-chapter-active' : ''}`}
              onClick={() => onSelectChapter(chap.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectChapter(chap.id);
                }
              }}
            >
              <span className="sb-chapter-num">{String(idx + 1).padStart(2, '0')}</span>
              <span className="sb-chapter-body">
                <span className="sb-chapter-title">{chap.title || t('app.defaultChapterTitle', { n: idx + 1 })}</span>
                <span className="sb-chapter-words">{t('drawer.words', { count: countWords(chap.content).toLocaleString(locale) })}</span>
              </span>
              {chapters.length > 1 && (
                <button
                  type="button"
                  className="sb-chapter-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(chap);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  title={t('drawer.deleteTitle')}
                  aria-label={t('drawer.deleteChapter', { title: chap.title })}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
            </div>
          );
        })}
        <button type="button" className="sb-add-chapter" onClick={onAddChapter}>
          <Plus size={14} strokeWidth={1.75} /> {t('drawer.newChapter')}
        </button>
      </nav>

      <div className="sb-nav">
        <NavItem anim="ic-spin-slow" icon={Compass} label={t('topbar.bible')} shortcut="Ctrl+B" onClick={onOpenBible} />
        <NavItem anim="ic-bob" icon={BookMarked} label={t('topbar.metadata')} shortcut="Ctrl+I" onClick={onOpenMetadata} />
        <NavItem anim="ic-twinkle" icon={Sparkles} label={t('topbar.editorRoom')} shortcut="Ctrl+R" onClick={onOpenReview} />
        <NavItem anim="ic-spin" icon={Settings} label={t('topbar.settings')} shortcut="Ctrl+," onClick={onOpenSettings} />
      </div>
    </aside>
  );
}
