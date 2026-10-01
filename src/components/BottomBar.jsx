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
  activeSuggestionCount = 0
}) {
  const [isHovered, setIsHovered] = useState(false);

  const text = currentChapter?.content || '';
  const charCount = text.length;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const readingTime = Math.ceil(words.length / 220);

  const autosaveInterval = settings?.autosaveIntervalSeconds ?? 30;

  return (
    <footer
      className={`ghost-ui ${isHovered ? 'ghost-ui-active' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        zIndex: 50,
        fontSize: '0.72rem',
        color: 'var(--text-secondary)',
        background: 'linear-gradient(to top, rgba(22, 22, 42, 0.95) 0%, rgba(22, 22, 42, 0) 100%)',
        backdropFilter: isHovered ? 'blur(8px)' : 'none'
      }}
    >
      {/* Left: Reading stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Clock size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>~{readingTime} min lettura</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Type size={13} />
          <span>{charCount.toLocaleString()} caratteri ({words.length.toLocaleString()} parole)</span>
        </div>
        {settings.soundEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--cursor-neon)', opacity: 0.85 }}>
              <Volume2 size={13} />
              <span>
                {settings.soundProfile === 'thock' && 'Deep Thock & Butter'}
                {settings.soundProfile === 'typewriter' && 'Olivetti Typewriter'}
                {settings.soundProfile === 'rain_keys' && 'Ceramica & Gocce'}
                {settings.soundProfile === 'wooden' && 'Legno Caldo'}
                {settings.soundProfile === 'velvet' && 'Silent Velvet'}
                {(!settings.soundProfile || settings.soundProfile === 'akko') && 'Akko Lavender Purple'}
              </span>
            </div>
            {settings.ambientTrack && settings.ambientTrack !== 'none' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-cyan)', opacity: 0.9 }}>
                <span>•</span>
                <span>
                  {settings.ambientTrack === 'rain' && '🌧️ Pioggia'}
                  {settings.ambientTrack === 'fireplace' && '🔥 Camino'}
                  {settings.ambientTrack === 'alpha' && '🧠 Onde 432Hz'}
                  {settings.ambientTrack === 'autumn' && '🍂 Vento'}
                  {settings.ambientTrack === 'cafe' && '☕ Caffè'}
                  {settings.ambientTrack === 'vinyl' && '📻 Vinile'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center/Right: Autosave & Interactive Material 3 Action Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {/* Open from PC Disk Button */}
        <button
          onClick={onOpenFileFromDisk}
          className="m3-chip"
          title="Apri un romanzo (.bookify o .json) dal tuo PC (Ctrl+O)"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)'
          }}
        >
          <FolderOpen size={12} style={{ color: 'var(--accent-amber)' }} />
          <span>Apri .bookify</span>
        </button>

        {/* Autosave PC File Chip */}
        <button
          onClick={onSaveToDisk}
          className="m3-chip"
          title="Fai clic per salvare subito su file .bookify / JSON sul tuo PC (Ctrl+S)"
          style={{
            backgroundColor: connectedFileName ? 'rgba(74, 222, 128, 0.12)' : 'var(--bg-elevated)',
            borderColor: connectedFileName ? 'rgba(74, 222, 128, 0.4)' : 'var(--border-subtle)',
            color: connectedFileName ? '#4ade80' : 'var(--text-secondary)'
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{connectedFileName ? '💾' : '📁'}</span>
          <span style={{ fontWeight: '600' }}>
            {connectedFileName ? connectedFileName : 'Salva su File PC'}
          </span>
          {lastSavedTime && (
            <span style={{ opacity: 0.7, fontSize: '0.65rem' }}>
              • {lastSavedTime instanceof Date ? lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : String(lastSavedTime)}
            </span>
          )}
          {settings.autosaveEnabled !== false && autosaveInterval > 0 && (
            <span style={{ opacity: 0.6, fontSize: '0.62rem' }}>
              ({autosaveInterval}s)
            </span>
          )}
        </button>

        {/* Interactive Functional Shortcut Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {/* Ctrl+A Accetta (illuminated if suggestions exist) */}
          <button 
            onClick={onAcceptSuggestion}
            className="m3-chip"
            title="Accetta il suggerimento ortografico/stilistico dell'AI Companion (Ctrl+A o Ctrl+Enter)"
            style={{
              backgroundColor: activeSuggestionCount > 0 ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
              borderColor: activeSuggestionCount > 0 ? 'var(--accent-cyan)' : 'var(--border-subtle)',
              color: activeSuggestionCount > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)'
            }}
          >
            <kbd style={{ background: 'var(--bg-primary)', padding: '0.1rem 0.35rem', borderRadius: '3px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>Ctrl+A</kbd>
            <span>Accetta {activeSuggestionCount > 0 ? `(${activeSuggestionCount})` : ''}</span>
          </button>

          {/* Ctrl+R Revisione */}
          <button 
            onClick={onOpenReview}
            className="m3-chip"
            title="Apri Stanza dell'Editor per revisionare ritmo, suspense e cliffhanger (Ctrl+R)"
          >
            <kbd style={{ background: 'var(--bg-primary)', padding: '0.1rem 0.35rem', borderRadius: '3px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>Ctrl+R</kbd>
            <span>Revisione</span>
          </button>

          {/* Ctrl+B Bibbia */}
          <button 
            onClick={onOpenBible}
            className="m3-chip"
            title="Apri Bibbia del Romanzo (Personaggi, Luoghi, Intreccio) (Ctrl+B)"
          >
            <kbd style={{ background: 'var(--bg-primary)', padding: '0.1rem 0.35rem', borderRadius: '3px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>Ctrl+B</kbd>
            <span>Bibbia</span>
          </button>

          {/* F11 Zen */}
          <button 
            onClick={onToggleFullscreen}
            className="m3-chip"
            title="Attiva/Disattiva Schermo Intero & Modalità Zen (F11)"
          >
            <kbd style={{ background: 'var(--bg-primary)', padding: '0.1rem 0.35rem', borderRadius: '3px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>F11</kbd>
            <span>Zen</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
