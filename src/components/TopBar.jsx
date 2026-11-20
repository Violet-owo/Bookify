import React, { useEffect, useRef, useState } from 'react';
import {
  PanelLeftOpen,
  ChevronRight,
  Maximize2,
  Minimize2,
  CloudRain,
  Feather,
  Sparkles,
  Check
} from 'lucide-react';
import { audioEngine, AMBIENT_TRACKS } from '../utils/audioEngine';
import { useI18n } from '../utils/i18n';

/**
 * Slim top bar: breadcrumb (book › chapter), chapter tools, soundscape and save state.
 * Every control keeps its icon at any width; only text labels collapse.
 */
export default function TopBar({
  book,
  currentChapter,
  sidebarVisible,
  onToggleSidebar,
  onOpenBookshelf,
  settings,
  onToggleSetting,
  isAutosaving,
  lastSavedTime,
  connectedFileName,
  onSaveToDisk,
  isFullscreen,
  onToggleFullscreen,
  onFormat,
  onRefine,
  isRefining = false,
  isWriting = false
}) {
  const { t, language } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const soundMenuRef = useRef(null);
  const locale = language === 'en' ? 'en-US' : 'it-IT';
  const isHidden = isWriting && !isHovered && !showSoundMenu;

  const ambientId = settings.ambientTrack || 'none';
  const ambientOn = ambientId !== 'none';

  useEffect(() => {
    if (!showSoundMenu) return undefined;
    const onPointer = (event) => {
      if (!soundMenuRef.current?.contains(event.target)) setShowSoundMenu(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setShowSoundMenu(false);
      }
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [showSoundMenu]);

  const handleSelectAmbient = (trackId) => {
    onToggleSetting('ambientTrack', trackId);
    audioEngine.startAmbient(trackId);
    setShowSoundMenu(false);
  };

  const saveLabel = isAutosaving
    ? t('topbar.saving')
    : lastSavedTime
      ? t('topbar.savedAt', { time: lastSavedTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
      : t('topbar.notSavedYet');

  return (
    <header
      className={`topbar ${isHidden ? 'chrome-hidden' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="pill pill-crumbs">
        {!sidebarVisible && (
          <>
            <button type="button" className="pill-icon" onClick={onToggleSidebar} title={`${t('sidebar.show')} (Ctrl+J)`} aria-label={t('sidebar.show')}>
              <PanelLeftOpen size={18} strokeWidth={2} className="ic-nudge" />
            </button>
            <span className="pill-sep" aria-hidden="true" />
          </>
        )}
        <nav className="tb-crumbs" aria-label={t('topbar.breadcrumb')}>
          <button type="button" className="tb-crumb tb-crumb-book" onClick={onOpenBookshelf} title={t('topbar.bookshelfHint')}>
            {book?.title || t('topbar.bookshelf')}
          </button>
          <ChevronRight size={14} className="tb-crumb-sep" aria-hidden="true" />
          <span key={currentChapter?.id} className="tb-crumb tb-crumb-chapter" title={currentChapter?.title}>
            {currentChapter?.title || t('topbar.chapter')}
          </span>
        </nav>
      </div>

      <div className="tb-right">
        <div className="pill">
          <button type="button" className="pill-btn" onClick={onFormat} title={t('editor.formatChapterHint')}>
            <Feather size={16} strokeWidth={2} className="ic-wiggle" />
            <span className="tb-label">{t('editor.format')}</span>
          </button>
          <button
            type="button"
            className="pill-btn pill-btn-accent"
            onClick={onRefine}
            disabled={isRefining || !(currentChapter?.content || '').trim()}
            title={t('editor.refineHint')}
          >
            <Sparkles size={16} strokeWidth={2} className={isRefining ? 'animate-spin' : 'ic-twinkle'} />
            <span className="tb-label">{isRefining ? t('editor.refining') : t('editor.refine')}</span>
          </button>
        </div>

        <div ref={soundMenuRef} className="pill tb-sound">
          <button
            type="button"
            className={`pill-btn ${ambientOn ? 'pill-btn-on' : ''}`}
            onClick={() => setShowSoundMenu(open => !open)}
            title={t('topbar.ambientHint')}
            aria-haspopup="menu"
            aria-expanded={showSoundMenu}
          >
            <CloudRain size={16} strokeWidth={2} className={ambientOn ? 'ic-rain' : 'ic-bob'} />
            <span className="tb-label tb-label-wide">{t(`ambient.${ambientId}.name`, {}, AMBIENT_TRACKS.find(a => a.id === ambientId)?.name)}</span>
            {ambientOn && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}
          </button>

          {showSoundMenu && (
            <div className="tb-menu m3-dropdown-menu" role="menu">
              <div className="tb-menu-title">{t('topbar.ambientTitle')}</div>
              {AMBIENT_TRACKS.map((track, i) => {
                const selected = ambientId === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => handleSelectAmbient(track.id)}
                    className={`tb-menu-item ${selected ? 'tb-menu-item-active' : ''}`}
                    style={{ '--i': i }}
                  >
                    <span className="tb-menu-check">{selected && <Check size={14} strokeWidth={2.5} />}</span>
                    <span className="tb-menu-text">
                      <span className="tb-menu-name">{t(`ambient.${track.id}.name`, {}, track.name)}</span>
                      <span className="tb-menu-desc">{t(`ambient.${track.id}.description`, {}, track.description)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="pill">
          <button
            type="button"
            className="pill-btn tb-save"
            onClick={onSaveToDisk}
            title={connectedFileName ? t('topbar.saveToHint', { file: connectedFileName }) : t('topbar.saveHint')}
          >
            <span className={`tb-save-dot ${isAutosaving ? 'is-busy' : connectedFileName ? 'is-linked' : ''}`} aria-hidden="true" />
            <span className="tb-label">{saveLabel}</span>
          </button>
          <button
            type="button"
            className="pill-icon"
            onClick={onToggleFullscreen}
            title={isFullscreen ? t('topbar.exitFullscreen') : t('topbar.fullscreen')}
            aria-label={isFullscreen ? t('topbar.exitFullscreen') : t('topbar.fullscreen')}
          >
            {isFullscreen ? <Minimize2 size={16} strokeWidth={2} className="ic-pinch" /> : <Maximize2 size={16} strokeWidth={2} className="ic-pop" />}
          </button>
        </div>
      </div>
    </header>
  );
}
