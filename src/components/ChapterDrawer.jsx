import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  FileDown, 
  Book, 
  Check, 
  FileText, 
  ChevronRight
} from 'lucide-react';
import { exportChapterFile, exportCompleteBook } from '../utils/storage';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';

export default function ChapterDrawer({
  isOpen,
  onClose,
  book,
  settings,
  currentChapterId,
  onSelectChapter,
  onAddChapter,
  onDeleteChapter,
  onUpdateBookTitle
}) {
  const animDuration = settings?.enableAnimations !== false
    ? Number(settings?.animationDurationMs) || 280
    : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, animDuration);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(book?.title || '');

  if (!shouldRender) return null;

  const totalWords = (book?.chapters || []).reduce((acc, chap) => {
    return acc + (chap.content || '').trim().split(/\s+/).filter(Boolean).length;
  }, 0);

  const handleSaveBookTitle = () => {
    if (tempTitle.trim()) {
      onUpdateBookTitle(tempTitle.trim());
    }
    setEditingTitle(false);
  };

  return (
    <div 
      className={`m3-modal-backdrop ${isExiting ? 'm3-modal-backdrop-exit' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(10, 8, 6, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 200,
        display: 'flex'
      }}
      onClick={onClose}
    >
      <div 
        className={`glass-panel m3-drawer-panel ${isExiting ? 'm3-drawer-panel-exit' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '420px',
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.75rem',
          marginLeft: 'auto',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            {editingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={handleSaveBookTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBookTitle()}
                  autoFocus
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-elevated)',
                    padding: '0.2rem 0.5rem'
                  }}
                />
                <button onClick={handleSaveBookTitle} style={{ color: 'var(--accent-cyan)' }}>
                  <Check size={18} />
                </button>
              </div>
            ) : (
              <h2 
                onClick={() => setEditingTitle(true)}
                title="Clicca per rinominare il libro"
                style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>{book.title}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>✎</span>
              </h2>
            )}
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {book.chapters.length} capitoli • {totalWords.toLocaleString()} parole totali
            </p>
          </div>

          <button 
            onClick={onClose} 
            className="m3-dialog-close-btn"
            title="Chiudi pannello capitoli (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action: Add Chapter */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={onAddChapter}
            className="m3-btn m3-btn-tonal"
            style={{ width: '100%', padding: '0.65rem 1rem' }}
          >
            <Plus size={16} className="m3-icon-bounce" />
            <span>Nuovo Capitolo</span>
          </button>
        </div>

        {/* Chapters List */}
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.65rem',
            paddingRight: '0.25rem' 
          }}
        >
          {book.chapters.map((chap, idx) => {
            const isCurrent = chap.id === currentChapterId;
            const words = (chap.content || '').trim().split(/\s+/).filter(Boolean).length;
            
            return (
              <div
                key={chap.id}
                onClick={() => {
                  onSelectChapter(chap.id);
                  onClose();
                }}
                className={`m3-card ${isCurrent ? 'm3-card-active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span 
                      className="monkey-stat-pill"
                      style={{ 
                        fontSize: '0.72rem', 
                        padding: '0.15rem 0.5rem',
                        color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)'
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <span 
                      style={{ 
                        fontSize: '0.9rem', 
                        fontWeight: isCurrent ? '700' : '500',
                        color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {chap.title || `Capitolo ${idx + 1}`}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', paddingLeft: '0.2rem' }}>
                    {words.toLocaleString()} parole
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {book.chapters.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Sei sicuro di voler eliminare "${chap.title}"?`)) {
                          onDeleteChapter(chap.id);
                        }
                      }}
                      title="Elimina capitolo"
                      className="m3-dialog-close-btn"
                      style={{ width: '30px', height: '30px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <ChevronRight size={16} style={{ color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Export & Download */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Esportazione Manoscritto
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <button
              onClick={() => {
                const current = book.chapters.find(c => c.id === currentChapterId) || book.chapters[0];
                exportChapterFile(current, book.title, 'md');
              }}
              className="m3-btn m3-btn-outlined"
              style={{ padding: '0.55rem 0.75rem', fontSize: '0.76rem' }}
            >
              <FileDown size={14} className="m3-icon-bounce" />
              <span>Capitolo (.md)</span>
            </button>

            <button
              onClick={() => {
                const current = book.chapters.find(c => c.id === currentChapterId) || book.chapters[0];
                exportChapterFile(current, book.title, 'txt');
              }}
              className="m3-btn m3-btn-outlined"
              style={{ padding: '0.55rem 0.75rem', fontSize: '0.76rem' }}
            >
              <FileText size={14} className="m3-icon-bounce" />
              <span>Capitolo (.txt)</span>
            </button>
          </div>

          <button
            onClick={() => exportCompleteBook(book, 'md')}
            className="m3-btn m3-btn-tonal"
            style={{
              width: '100%',
              marginTop: '0.65rem',
              padding: '0.65rem 1rem',
              fontSize: '0.8rem'
            }}
          >
            <Book size={15} className="m3-icon-bounce" />
            <span>Scarica Libro Completo (.md)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
