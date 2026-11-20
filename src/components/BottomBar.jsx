import React, { useState } from 'react';
import { Volume2, VolumeX, HardDrive } from 'lucide-react';
import { useI18n } from '../utils/i18n';

const SOUND_PROFILE_LABELS = {
  thock: 'Deep Thock',
  typewriter: 'Olivetti',
  rain_keys: 'Ceramica',
  wooden: 'Legno',
  velvet: 'Velvet',
  cherry_blue: 'Cherry Blue',
  holy_panda: 'Holy Panda',
  hitmarker: 'Hitmarker',
  gateron_black: 'Gateron Black',
  topre: 'Topre',
  bubble_wrap: 'Bubble Wrap',
  model_m: 'Model M',
  akko: 'Purple Lavender'
};

/** Quiet status bar: live counts, chapter goal, caret line, key sounds and file. */
export default function BottomBar({
  currentChapter,
  settings,
  connectedFileName,
  onSaveToDisk,
  onToggleSound,
  cursorLine,
  totalLines,
  isWriting = false
}) {
  const { t, language } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const isHidden = isWriting && !isHovered;
  const locale = language === 'en' ? 'en-US' : 'it-IT';

  const text = currentChapter?.content || '';
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(wordCount ? 1 : 0, Math.ceil(wordCount / 220));
  const goal = Math.max(0, Number(settings.wordGoal) || 0);
  const goalPercent = goal ? Math.min(100, Math.round((wordCount / goal) * 100)) : 0;
  const soundOn = settings.soundEnabled !== false;
  const soundName = t(`soundProfiles.${settings.soundProfile || 'akko'}`, {}, SOUND_PROFILE_LABELS[settings.soundProfile] || SOUND_PROFILE_LABELS.akko);
  const shortSound = (SOUND_PROFILE_LABELS[settings.soundProfile] || soundName);

  const ring = 2 * Math.PI * 9;

  return (
    <footer
      className={`statusbar ${isHidden ? 'chrome-hidden' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="pill pill-stats">
        <span className="sbar-item sbar-strong">
          <span key={wordCount} className="num-tick">{wordCount.toLocaleString(locale)}</span> {t('bottombar.wordsLabel')}
        </span>
        <span className="sbar-item sbar-hide-sm">{t('bottombar.chars', { count: text.length.toLocaleString(locale) })}</span>
        <span className="sbar-item sbar-hide-sm">{t('bottombar.readingTime', { count: readingTime })}</span>
      </div>

      {goal > 0 && (
        <div className={`pill pill-goal ${goalPercent >= 100 ? 'is-done' : ''}`} title={t('bottombar.goalHint', { words: wordCount.toLocaleString(locale), goal: goal.toLocaleString(locale) })}>
          <svg className="goal-ring" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" className="goal-ring-track" />
            <circle
              cx="12"
              cy="12"
              r="9"
              className="goal-ring-fill"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - goalPercent / 100)}
            />
          </svg>
          <span className="goal-text">{goalPercent}%</span>
          <span className="goal-sub sbar-hide-md">{t('bottombar.ofGoal', { goal: goal.toLocaleString(locale) })}</span>
        </div>
      )}

      <div className="pill pill-meta">
        {settings.showLineHUD !== false && totalLines > 0 && (
          <span className="sbar-item sbar-hide-sm" title={t('editor.lineTooltip', { line: cursorLine, total: totalLines, percent: Math.round((cursorLine / Math.max(1, totalLines)) * 100) })}>
            {t('bottombar.line', { line: cursorLine, total: totalLines })}
          </span>
        )}
        <button
          type="button"
          className={`pill-btn pill-btn-sm ${soundOn ? '' : 'is-off'}`}
          onClick={onToggleSound}
          title={soundOn ? t('bottombar.soundOnHint', { name: soundName }) : t('bottombar.soundOffHint')}
        >
          {soundOn ? <Volume2 size={15} strokeWidth={2} className="ic-wave" /> : <VolumeX size={15} strokeWidth={2} className="ic-shake" />}
          <span className="sbar-hide-md">{soundOn ? shortSound : t('bottombar.muted')}</span>
        </button>
        <button
          type="button"
          className="pill-btn pill-btn-sm"
          onClick={onSaveToDisk}
          title={connectedFileName ? t('bottombar.linkedFileHint', { file: connectedFileName }) : t('bottombar.localOnlyHint')}
        >
          <HardDrive size={15} strokeWidth={2} className="ic-pop" />
          <span className="sbar-file">{connectedFileName || t('bottombar.localMemory')}</span>
        </button>
      </div>
    </footer>
  );
}
