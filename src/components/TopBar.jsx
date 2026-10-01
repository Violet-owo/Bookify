import React, { useState } from 'react';
import { 
  Settings, 
  BookOpen, 
  Maximize2, 
  Minimize2, 
  Compass, 
  Bookmark,
  Zap,
  CloudRain,
  ChevronDown,
  Save,
  BookMarked,
  FolderOpen
} from 'lucide-react';
import { audioEngine, AMBIENT_TRACKS } from '../utils/audioEngine';

export default function TopBar({
  book,
  currentChapter,
  onOpenBookshelf,
  onOpenChapters,
  onOpenBible,
  onOpenReview,
  onOpenSettings,
  onOpenBookMetadata,
  settings,
  onToggleSetting,
  isAutosaving,
  lastSavedTime,
  connectedFileName,
  onSaveToDisk,
  onOpenFileFromDisk,
  isFullscreen,
  onToggleFullscreen
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);

  // Calculate chapter word count
  const words = (currentChapter?.content || '').trim().split(/\s+/).filter(Boolean);
  const chapterWordCount = words.length;

  // Calculate book total words
  const totalBookWords = (book?.chapters || []).reduce((acc, c) => {
    return acc + (c.content || '').trim().split(/\s+/).filter(Boolean).length;
  }, 0);

  const currentAmbient = AMBIENT_TRACKS.find(t => t.id === (settings.ambientTrack || 'none')) || AMBIENT_TRACKS[0];

  const handleSelectAmbient = (trackId) => {
    onToggleSetting('ambientTrack', trackId);
    audioEngine.startAmbient(trackId);
  };

  return (
    <header
      className={`ghost-ui ${isHovered || showSoundMenu ? 'ghost-ui-active' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        zIndex: 50,
        background: 'linear-gradient(to bottom, var(--bg-overlay) 0%, rgba(22, 22, 42, 0) 100%)',
        backdropFilter: isHovered || showSoundMenu ? 'blur(12px)' : 'none',
        transition: 'all var(--transition-normal)'
      }}
    >
      {/* Left: Book Switcher & Chapter Navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {/* Bookshelf Button */}
        <button
          onClick={onOpenBookshelf}
          title="Apri Biblioteca dei Libri (Ctrl+L)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.38rem 0.75rem',
            borderRadius: 'var(--m3-shape-full, 9999px)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-primary)',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Bookmark size={14} className="m3-icon-bounce" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book?.title || 'Biblioteca'}
          </span>
          <ChevronDown size={12} className="m3-icon-bounce" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Book Metadata & Info Editor Button */}
        <button
          onClick={onOpenBookMetadata}
          className="m3-chip"
          title="Modifica informazioni del romanzo (Titolo, autore, sinossi, obiettivo parole) — Ctrl+I"
          style={{ 
            padding: '0.35rem 0.75rem', 
            fontSize: '0.76rem',
            backgroundColor: 'var(--accent-cyan-dim)',
            borderColor: 'var(--accent-cyan-glow)',
            color: 'var(--text-primary)'
          }}
        >
          <BookMarked size={14} className="m3-icon-bounce" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontWeight: '700' }}>Scheda Romanzo</span>
        </button>

        {/* Chapter Switcher */}
        <button
          onClick={onOpenChapters}
          title="Gestione Capitoli (Ctrl+O)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.38rem 0.75rem',
            borderRadius: 'var(--m3-shape-full, 9999px)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <BookOpen size={14} className="m3-icon-bounce" style={{ color: 'var(--text-secondary)' }} />
          <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentChapter?.title || 'Capitolo'}
          </span>
          <ChevronDown size={12} className="m3-icon-bounce" style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* Open from PC Disk Button */}
        <button
          type="button"
          onClick={onOpenFileFromDisk}
          className="m3-chip"
          title="Apri un romanzo (.bookify o .json) salvato sul tuo PC (Ctrl+O)"
          style={{
            padding: '0.28rem 0.65rem',
            fontSize: '0.72rem',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <FolderOpen size={12} className="m3-icon-bounce" style={{ color: 'var(--accent-amber)' }} />
          <span>Apri .bookify</span>
        </button>

        {/* Autosave & Disk Sync Indicator */}
        <button
          onClick={onSaveToDisk}
          title={connectedFileName ? `File su PC: ${connectedFileName} (Clicca per salvare o premi Ctrl+S)` : 'Clicca per salvare su file del PC (Ctrl+S)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            transition: 'background-color var(--transition-fast)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div 
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isAutosaving ? 'var(--accent-amber)' : 'var(--accent-green, #4ade80)',
              boxShadow: isAutosaving ? '0 0 8px var(--accent-amber)' : '0 0 6px rgba(74, 222, 128, 0.6)',
              transition: 'all 0.3s ease'
            }}
          />
          <Save size={12} className="m3-icon-bounce" style={{ opacity: 0.8 }} />
          <span>
            {isAutosaving ? 'Salvataggio...' : connectedFileName ? connectedFileName : `Salvato alle ${lastSavedTime ? (lastSavedTime instanceof Date ? lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : lastSavedTime) : ''}`}
          </span>
        </button>
      </div>

      {/* Center: Word Counter & Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {chapterWordCount.toLocaleString()} parole
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
            (Libro: {totalBookWords.toLocaleString()})
          </span>
        </div>
      </div>

      {/* Right: Quick Soundscape, Novel Bible, AI Editor & Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', position: 'relative' }}>
        {/* Quick Cozy Soundscape Button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSoundMenu(!showSoundMenu)}
            title="Sottofondo Cozy & Audio Tasti"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.38rem 0.75rem',
              borderRadius: 'var(--m3-shape-full, 9999px)',
              backgroundColor: settings.ambientTrack && settings.ambientTrack !== 'none' ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
              border: `1px solid ${settings.ambientTrack && settings.ambientTrack !== 'none' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
              fontSize: '0.76rem',
              color: settings.ambientTrack && settings.ambientTrack !== 'none' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <CloudRain size={14} className="m3-icon-bounce" />
            <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentAmbient.name}
            </span>
            <ChevronDown size={11} className="m3-icon-bounce" />
          </button>

          {/* Soundscape Dropdown Menu with Liquid Animation */}
          {showSoundMenu && (
            <div 
              className="glass-panel m3-dropdown-menu"
              style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                width: '240px',
                padding: '0.65rem',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.2rem 0.4rem', fontWeight: '700' }}>
                Atmosfera Sonora
              </div>
              {AMBIENT_TRACKS.map(t => {
                const isSelected = (settings.ambientTrack || 'none') === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      handleSelectAmbient(t.id);
                      setShowSoundMenu(false);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '0.45rem 0.6rem',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.78rem',
                      backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'transparent',
                      color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? '600' : '400' }}>{t.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{t.description}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Novel Bible Button */}
        <button
          onClick={onOpenBible}
          title="Bibbia del Romanzo (Personaggi, Snodi & Note) — Ctrl+B"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.38rem 0.75rem',
            borderRadius: 'var(--m3-shape-full, 9999px)',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.76rem',
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <Compass size={14} className="m3-icon-bounce" style={{ color: 'var(--accent-amber)' }} />
          <span>Bibbia</span>
        </button>

        {/* Literary Editor Room Button */}
        <button
          onClick={onOpenReview}
          title="Stanza dell'Editor (Ritmo, Suspense & Cliffhanger) — Ctrl+R"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.38rem 0.85rem',
            borderRadius: 'var(--m3-shape-full, 9999px)',
            backgroundColor: 'var(--accent-cyan-dim)',
            border: '1px solid var(--accent-cyan)',
            fontSize: '0.76rem',
            color: 'var(--accent-cyan)',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <Zap size={14} className="m3-icon-bounce" />
          <span>Editor AI</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Impostazioni (Ctrl+,)"
          style={{
            padding: '0.45rem',
            borderRadius: '50%',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Settings size={16} className="m3-icon-bounce" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          title="Schermo Intero (F11)"
          style={{
            padding: '0.45rem',
            borderRadius: '50%',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isFullscreen ? <Minimize2 size={16} className="m3-icon-bounce" /> : <Maximize2 size={16} className="m3-icon-bounce" />}
        </button>
      </div>
    </header>
  );
}
