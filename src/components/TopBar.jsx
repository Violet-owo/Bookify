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
  onToggleFullscreen,
  isWriting = false
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);

  const isBarHidden = isWriting && !isHovered && !showSoundMenu;

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
      className={`studio-ui ghost-ui ${isBarHidden ? 'studio-ui-hidden' : 'studio-ui-visible'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '62px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 50,
        background: 'linear-gradient(to bottom, var(--bg-overlay) 65%, transparent 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'opacity var(--transition-smooth), transform var(--transition-smooth)',
        userSelect: 'none'
      }}
    >
      {/* 1. Left M3 Expressive Island: Project & Chapter Navigation */}
      <div className="m3-cluster-island">
        {/* Bookshelf Pill */}
        <button
          onClick={onOpenBookshelf}
          className="m3-cluster-btn"
          title="Apri Biblioteca dei Libri (Ctrl+L)"
        >
          <Bookmark size={13} className="m3-icon-bounce" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ maxWidth: '135px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>
            {book?.title || 'Biblioteca'}
          </span>
          <ChevronDown size={11} style={{ opacity: 0.55 }} />
        </button>

        <div className="m3-cluster-divider" />

        {/* Chapter Switcher Pill */}
        <button
          onClick={onOpenChapters}
          className="m3-cluster-btn"
          title="Gestione Capitoli (Ctrl+J / Ctrl+K)"
        >
          <BookOpen size={13} className="m3-icon-bounce" style={{ color: 'var(--text-secondary)' }} />
          <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentChapter?.title || 'Capitolo'}
          </span>
          <ChevronDown size={11} style={{ opacity: 0.55 }} />
        </button>

        <div className="m3-cluster-divider" />

        {/* Book Metadata Pill */}
        <button
          onClick={onOpenBookMetadata}
          className="m3-cluster-btn"
          title="Scheda del Romanzo & Obiettivi (Ctrl+I)"
        >
          <BookMarked size={13} className="m3-icon-bounce" style={{ color: 'var(--accent-cyan)' }} />
          <span>Scheda</span>
        </button>

        <div className="m3-cluster-divider" />

        {/* Open from PC Disk Pill */}
        <button
          onClick={onOpenFileFromDisk}
          className="m3-cluster-btn"
          title="Apri file .bookify o .json dal tuo PC (Ctrl+O)"
        >
          <FolderOpen size={13} className="m3-icon-bounce" style={{ color: 'var(--accent-amber)' }} />
          <span>Apri</span>
        </button>
      </div>

      {/* 2. Center M3 & Monkeytype Island: Focused Literary HUD */}
      <div className="monkey-stat-pill" title="Conteggio parole del capitolo e totale del romanzo">
        <span>cap</span>
        <span className="monkey-stat-val">{chapterWordCount.toLocaleString()}</span>
        <div className="monkey-stat-dot" />
        <span>tot</span>
        <span className="monkey-stat-val">{totalBookWords.toLocaleString()}</span>
        <div className="monkey-stat-dot" />
        <span style={{ opacity: 0.75 }}>~{Math.ceil(chapterWordCount / 220)}m</span>
      </div>

      {/* 3. Right M3 Expressive Island: Atmosphere, AI & Studio Controls */}
      <div className="m3-cluster-island" style={{ position: 'relative' }}>
        {/* Ambient Soundscape Dropdown Trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSoundMenu(!showSoundMenu)}
            className={`m3-cluster-btn ${showSoundMenu || (settings.ambientTrack && settings.ambientTrack !== 'none') ? 'm3-cluster-btn-active' : ''}`}
            title="Sottofondo Atmosferico & Paesaggi Sonori"
          >
            <CloudRain size={13} className="m3-icon-bounce" />
            <span style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentAmbient.name}
            </span>
            <ChevronDown size={11} style={{ opacity: 0.6 }} />
          </button>

          {/* M3 Expressive Soundscape Menu */}
          {showSoundMenu && (
            <div 
              className="glass-panel m3-dropdown-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '240px',
                padding: '0.5rem',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                borderRadius: 'var(--m3-shape-md, 16px)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.25rem 0.5rem', fontWeight: '700', letterSpacing: '0.04em' }}>
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
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--m3-shape-sm, 10px)',
                      fontSize: '0.78rem',
                      backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'transparent',
                      color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      border: isSelected ? '1px solid var(--accent-cyan-glow)' : '1px solid transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'all 120ms ease'
                    }}
                  >
                    <span style={{ fontWeight: isSelected ? '700' : '500' }}>{t.name}</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '1px' }}>{t.description}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="m3-cluster-divider" />

        {/* Novel Bible Pill */}
        <button
          onClick={onOpenBible}
          className="m3-cluster-btn"
          title="Bibbia del Romanzo (Personaggi, Luoghi & Lore) — Ctrl+B"
        >
          <Compass size={13} className="m3-icon-bounce" style={{ color: 'var(--accent-amber)' }} />
          <span>Bibbia</span>
        </button>

        <div className="m3-cluster-divider" />

        {/* AI Literary Review Room Pill */}
        <button
          onClick={onOpenReview}
          className="m3-cluster-btn"
          title="Stanza dell'Editor AI & Revisione — Ctrl+R"
        >
          <Zap size={13} className="m3-icon-bounce" style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontWeight: '600' }}>Editor AI</span>
        </button>

        <div className="m3-cluster-divider" />

        {/* Save to Disk / Status Pill */}
        <button
          onClick={onSaveToDisk}
          className="m3-cluster-btn"
          title={connectedFileName ? `Salva su "${connectedFileName}" (Ctrl+S)` : 'Salva su file PC (Ctrl+S)'}
        >
          <div 
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isAutosaving ? 'var(--accent-amber)' : 'var(--accent-green, #4ade80)',
              boxShadow: isAutosaving ? '0 0 6px var(--accent-amber)' : '0 0 4px rgba(74, 222, 128, 0.6)',
              transition: 'all 0.3s ease'
            }}
          />
          <Save size={13} className="m3-icon-bounce" />
          <span>{isAutosaving ? 'Salvataggio...' : 'Salva'}</span>
        </button>

        <div className="m3-cluster-divider" />

        {/* Fullscreen Zen Pill */}
        <button
          onClick={onToggleFullscreen}
          className="m3-cluster-btn"
          title="Schermo Intero (F11)"
          style={{ padding: '0.36rem 0.5rem' }}
        >
          {isFullscreen ? <Minimize2 size={13} className="m3-icon-bounce" /> : <Maximize2 size={13} className="m3-icon-bounce" />}
        </button>

        <div className="m3-cluster-divider" />

        {/* Settings Pill */}
        <button
          onClick={onOpenSettings}
          className="m3-cluster-btn"
          title="Impostazioni Studio (Ctrl+,)"
          style={{ padding: '0.36rem 0.5rem' }}
        >
          <Settings size={14} className="m3-icon-bounce" />
        </button>
      </div>
    </header>
  );
}
