import React, { useState } from 'react';
import { Clock, Type, Volume2, FolderOpen } from 'lucide-react';

export default function BottomBar({
  currentChapter,
  settings,
  lastSavedTime,
  connectedFileName,
  onSaveToDisk,
  onOpenFileFromDisk,
  onToggleFullscreen,
  onOpenReview,
  onOpenBible,
  onAcceptSuggestion,
  activeSuggestionCount = 0,
  isWriting = false
}) {
  const [isHovered, setIsHovered] = useState(false);

  const isBarHidden = isWriting && !isHovered;

  const text = currentChapter?.content || '';
  const charCount = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const readingTime = Math.ceil(words.length / 220);

  const autosaveInterval = settings?.autosaveIntervalSeconds ?? 30;

  const getSoundProfileLabel = () => {
    switch (settings.soundProfile) {
      case 'thock': return 'Deep Thock';
      case 'typewriter': return 'Olivetti';
      case 'rain_keys': return 'Ceramica';
      case 'wooden': return 'Legno';
      case 'velvet': return 'Velvet';
      case 'cherry_blue': return 'Cherry Blue';
      case 'holy_panda': return 'Holy Panda';
      case 'hitmarker': return 'Chirurgico';
      case 'akko':
      default: return 'Purple Lavender';
    }
  };

  return (
    <footer
      className={`studio-ui ghost-ui ${isBarHidden ? 'studio-ui-hidden' : 'studio-ui-visible'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 50,
        background: 'linear-gradient(to top, var(--bg-overlay) 65%, transparent 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'opacity var(--transition-smooth), transform var(--transition-smooth)',
        userSelect: 'none'
      }}
    >
      {/* 1. Left Island: Monkeytype-style Live Typing Counters */}
      <div className="monkey-stat-pill" title="Metriche di lettura e scrittura in tempo reale">
        <span>{words.length.toLocaleString()} parole</span>
        <div className="monkey-stat-dot" />
        <span style={{ opacity: 0.8 }}>{charCount.toLocaleString()} car</span>
        <div className="monkey-stat-dot" />
        <span style={{ opacity: 0.8 }}>~{readingTime} min</span>
        {settings.soundEnabled && (
          <>
            <div className="monkey-stat-dot" />
            <span style={{ color: 'var(--accent-cyan)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Volume2 size={11} /> {getSoundProfileLabel()}
            </span>
          </>
        )}
      </div>

      {/* 2. Center Island: Disk File Sync & Autosave Status */}
      <div className="m3-cluster-island">
        <button
          onClick={onSaveToDisk}
          className="m3-cluster-btn"
          title={connectedFileName ? `File collegato: ${connectedFileName} (Ctrl+S per salvare)` : 'Salva su file PC (Ctrl+S)'}
          style={{ padding: '0.32rem 0.75rem', fontSize: '0.74rem' }}
        >
          <div 
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: connectedFileName ? 'var(--accent-green, #4ade80)' : 'var(--accent-cyan)',
              boxShadow: connectedFileName ? '0 0 6px rgba(74, 222, 128, 0.6)' : '0 0 6px var(--accent-cyan-glow)'
            }}
          />
          <span style={{ fontWeight: '600' }}>
            {connectedFileName ? connectedFileName : 'Memoria Locale'}
          </span>
          {lastSavedTime && (
            <span style={{ opacity: 0.6, fontSize: '0.66rem' }}>
              • {lastSavedTime instanceof Date ? lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : String(lastSavedTime)}
            </span>
          )}
          {settings.autosaveEnabled !== false && autosaveInterval > 0 && (
            <span style={{ opacity: 0.5, fontSize: '0.62rem' }}>
              ({autosaveInterval}s)
            </span>
          )}
        </button>
      </div>

      {/* 3. Right Island: Fast Studio Keyboard Shortcuts */}
      <div className="m3-cluster-island">
        {activeSuggestionCount > 0 && (
          <>
            <button
              onClick={onAcceptSuggestion}
              className="m3-cluster-btn m3-cluster-btn-active"
              title="Accetta suggerimento dell'AI Companion (Ctrl+A)"
              style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem' }}
            >
              <kbd style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem' }}>Ctrl+A</kbd>
              <span>Accetta ({activeSuggestionCount})</span>
            </button>
            <div className="m3-cluster-divider" />
          </>
        )}

        <button
          onClick={onOpenFileFromDisk}
          className="m3-cluster-btn"
          title="Apri file .bookify / JSON dal PC (Ctrl+O)"
          style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem' }}
        >
          <kbd style={{ background: 'var(--bg-elevated)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem', border: '1px solid var(--border-subtle)' }}>Ctrl+O</kbd>
          <span>Apri</span>
        </button>

        <div className="m3-cluster-divider" />

        <button
          onClick={onSaveToDisk}
          className="m3-cluster-btn"
          title="Salva file .bookify / JSON su PC (Ctrl+S)"
          style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem' }}
        >
          <kbd style={{ background: 'var(--bg-elevated)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem', border: '1px solid var(--border-subtle)' }}>Ctrl+S</kbd>
          <span>Salva</span>
        </button>

        <div className="m3-cluster-divider" />

        <button
          onClick={onOpenReview}
          className="m3-cluster-btn"
          title="Revisione Editoriale AI (Ctrl+R)"
          style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem' }}
        >
          <kbd style={{ background: 'var(--bg-elevated)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem', border: '1px solid var(--border-subtle)' }}>Ctrl+R</kbd>
        </button>

        <div className="m3-cluster-divider" />

        <button
          onClick={onOpenBible}
          className="m3-cluster-btn"
          title="Bibbia del Romanzo (Ctrl+B)"
          style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem' }}
        >
          <kbd style={{ background: 'var(--bg-elevated)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem', border: '1px solid var(--border-subtle)' }}>Ctrl+B</kbd>
        </button>

        <div className="m3-cluster-divider" />

        <button
          onClick={onToggleFullscreen}
          className="m3-cluster-btn"
          title="Schermo Intero / Zen Mode (F11)"
          style={{ fontSize: '0.72rem', padding: '0.28rem 0.55rem' }}
        >
          <kbd style={{ background: 'var(--bg-elevated)', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.65rem', border: '1px solid var(--border-subtle)' }}>F11</kbd>
        </button>
      </div>
    </footer>
  );
}
