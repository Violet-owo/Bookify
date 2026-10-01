import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Copy, 
  Download, 
  Upload, 
  Bookmark, 
  Layers,
  FolderOpen
} from 'lucide-react';
import { createNewBook, exportProjectBackup } from '../utils/storage';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';

export default function BookshelfModal({
  isOpen,
  onClose,
  library,
  onSelectBook,
  onCreateBook,
  onDuplicateBook,
  onDeleteBook,
  onImportLibrary,
  onOpenFileFromDisk
}) {
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, 280);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('Thriller / Mistero');
  const [newTargetWords, setNewTargetWords] = useState(60000);

  if (!shouldRender) return null;

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newBook = createNewBook(newTitle.trim(), newGenre);
    newBook.targetWords = parseInt(newTargetWords) || 50000;
    onCreateBook(newBook);
    setIsCreating(false);
    setNewTitle('');
  };

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && Array.isArray(parsed.books)) {
          onImportLibrary(parsed);
          onClose();
        } else if (parsed && parsed.chapters && parsed.title) {
          onCreateBook(parsed);
          onClose();
        } else {
          alert('Il file selezionato non è un formato .bookify o backup valido.');
        }
      } catch {
        alert('Errore durante la lettura del file selezionato.');
      }
    };
    reader.readAsText(file);
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
        backgroundColor: 'rgba(10, 8, 6, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div 
        className={`glass-panel m3-dialog-panel ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '920px',
          maxWidth: '96vw',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--m3-shape-dialog, 24px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, var(--bg-elevated), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-cyan-dim)',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bookmark size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                La Tua Biblioteca di Romanzi
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Gestisci più libri contemporaneamente, tieni traccia degli obiettivi e passa da un manoscritto all'altro.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                if (onOpenFileFromDisk) {
                  onOpenFileFromDisk();
                  onClose();
                }
              }}
              style={{
                padding: '0.5rem 0.9rem',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '600',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer'
              }}
            >
              <FolderOpen size={16} style={{ color: 'var(--accent-amber)' }} />
              <span>Apri File .bookify</span>
            </button>

            <button
              onClick={() => setIsCreating(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--accent-cyan)',
                color: '#1a1612',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '600',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 10px var(--accent-cyan-dim)'
              }}
            >
              <Plus size={16} /> Nuovo Romanzo
            </button>
            <button onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '0.4rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
          {/* Create Book Form Drawer */}
          {isCreating && (
            <form 
              onSubmit={handleCreateSubmit}
              className="animate-fade-in"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent-cyan)',
                marginBottom: '2rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Inizia un Nuovo Progetto Letterario
                </h3>
                <button type="button" onClick={() => setIsCreating(false)} style={{ color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Titolo del Libro / Opera *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="es. L'Enigma di Castel Sant'Angelo"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Genere Letterario
                  </label>
                  <select
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="Thriller / Mistero">Thriller / Mistero</option>
                    <option value="Narrativa Contemporanea">Narrativa Contemporanea</option>
                    <option value="Romanzo Storico">Romanzo Storico</option>
                    <option value="Fantascienza / Sci-Fi">Fantascienza / Sci-Fi</option>
                    <option value="Fantasy Epico">Fantasy Epico</option>
                    <option value="Giallo Investigativo">Giallo Investigativo</option>
                    <option value="Saggio / Non-Fiction">Saggio / Non-Fiction</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Obiettivo Parole
                  </label>
                  <input
                    type="number"
                    value={newTargetWords}
                    onChange={(e) => setNewTargetWords(e.target.value)}
                    min={5000}
                    step={5000}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.88rem',
                      backgroundColor: 'var(--bg-primary)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    fontWeight: '600',
                    backgroundColor: 'var(--accent-cyan)',
                    color: '#1a1612'
                  }}
                >
                  Crea e Inizia a Scrivere
                </button>
              </div>
            </form>
          )}

          {/* Bookshelf Grid */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.5rem'
            }}
          >
            {library.books.map((b) => {
              const isActive = b.id === library.activeBookId;
              const totalWords = (b.chapters || []).reduce((acc, chap) => {
                return acc + (chap.content || '').trim().split(/\s+/).filter(Boolean).length;
              }, 0);
              const target = b.targetWords || 50000;
              const progress = Math.min(100, Math.round((totalWords / target) * 100));

              return (
                <div
                  key={b.id}
                  onClick={() => {
                    onSelectBook(b.id);
                    onClose();
                  }}
                  style={{
                    backgroundColor: isActive ? 'var(--bg-elevated)' : 'var(--bg-card)',
                    border: `1.5px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all var(--transition-normal)',
                    boxShadow: isActive ? '0 10px 25px var(--accent-cyan-dim)' : '0 4px 15px rgba(0, 0, 0, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--accent-cyan-dim)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  {/* Spine Color Accent Tag */}
                  <div 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      backgroundColor: b.coverColor || 'var(--accent-cyan)',
                      borderTopLeftRadius: 'var(--radius-md)',
                      borderTopRightRadius: 'var(--radius-md)'
                    }}
                  />

                  {/* Header info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                      <span 
                        style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--text-secondary)',
                          fontWeight: '600'
                        }}
                      >
                        {b.genre || 'Narrativa'}
                      </span>
                      {isActive && (
                        <span 
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--accent-cyan)',
                            color: '#1a1612',
                            fontWeight: '700'
                          }}
                        >
                          ATTIVO
                        </span>
                      )}
                    </div>

                    <h3 
                      style={{
                        fontSize: '1.15rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-serif)',
                        lineHeight: 1.3,
                        marginBottom: '0.4rem'
                      }}
                    >
                      {b.title}
                    </h3>
                    
                    {b.subtitle && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                        {b.subtitle}
                      </p>
                    )}

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {(b.chapters || []).length} capitoli • Ultima modifica {b.updatedAt ? b.updatedAt.slice(0, 10) : 'recente'}
                    </p>
                  </div>

                  {/* Progress & Stats */}
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Avanzamento</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {totalWords.toLocaleString()} / {target.toLocaleString()} parole ({progress}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          backgroundColor: b.coverColor || 'var(--accent-cyan)',
                          borderRadius: '3px',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>

                    {/* Book Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', marginTop: '0.85rem' }}>
                      <button
                        title="Duplica Romanzo"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateBook(b);
                        }}
                        style={{
                          padding: '0.3rem 0.5rem',
                          color: 'var(--text-muted)',
                          borderRadius: 'var(--radius-xs)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Copy size={14} />
                      </button>

                      {library.books.length > 1 && (
                        <button
                          title="Elimina Romanzo"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Sei sicuro di voler eliminare definitivamente il libro "${b.title}"?`)) {
                              onDeleteBook(b.id);
                            }
                          }}
                          style={{
                            padding: '0.3rem 0.5rem',
                            color: 'var(--text-muted)',
                            borderRadius: 'var(--radius-xs)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-coral)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
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

        {/* Footer Backup & Export */}
        <div 
          style={{
            padding: '1.2rem 2rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <Layers size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span>Totale: {library.books.length} romanzi nella biblioteca locale</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <Upload size={14} />
              <span>Importa File (.bookify / .json)</span>
              <input type="file" accept=".bookify,.json" onChange={handleFileImport} style={{ display: 'none' }} />
            </label>

            <button
              onClick={() => exportProjectBackup(library)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: 'var(--text-primary)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              <Download size={14} />
              <span>Esporta Backup Completo (.json)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
