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

          <button onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '0.3rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Action: Add Chapter */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={onAddChapter}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0, 210, 211, 0.1)',
              border: '1px solid var(--accent-cyan)',
              color: 'var(--accent-cyan)',
              fontWeight: '500',
              fontSize: '0.85rem'
            }}
          >
            <Plus size={16} />
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
            gap: '0.5rem',
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.8rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isCurrent ? 'var(--bg-elevated)' : 'rgba(31, 31, 56, 0.3)',
                  border: isCurrent ? '1px solid var(--accent-cyan-dim)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      #{idx + 1}
                    </span>
                    <span 
                      style={{ 
                        fontSize: '0.88rem', 
                        fontWeight: isCurrent ? '600' : '400',
                        color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {chap.title || `Capitolo ${idx + 1}`}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {words} parole
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
                      style={{
                        padding: '0.3rem',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-coral)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <ChevronRight size={15} style={{ color: isCurrent ? 'var(--accent-cyan)' : 'var(--text-muted)' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Export & Download */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Esportazione Manoscritto
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <button
              onClick={() => {
                const current = book.chapters.find(c => c.id === currentChapterId) || book.chapters[0];
                exportChapterFile(current, book.title, 'md');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(31, 31, 56, 0.6)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)'
              }}
            >
              <FileDown size={14} />
              <span>Capitolo (.md)</span>
            </button>

            <button
              onClick={() => {
                const current = book.chapters.find(c => c.id === currentChapterId) || book.chapters[0];
                exportChapterFile(current, book.title, 'txt');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.55rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(31, 31, 56, 0.6)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)'
              }}
            >
              <FileText size={14} />
              <span>Capitolo (.txt)</span>
            </button>
          </div>

          <button
            onClick={() => exportCompleteBook(book, 'md')}
            style={{
              width: '100%',
              marginTop: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(90deg, rgba(0, 210, 211, 0.15), rgba(197, 108, 240, 0.15))',
              border: '1px solid var(--accent-cyan-dim)',
              fontSize: '0.8rem',
              fontWeight: '500',
              color: 'var(--accent-cyan)'
            }}
          >
            <Book size={14} />
            <span>Scarica Libro Completo (.md)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
