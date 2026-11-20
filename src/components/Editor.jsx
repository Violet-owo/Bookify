import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { checkTextChunk, enhanceParagraph, rewriteSuggestion, buildNovelContext } from '../utils/aiService';
import { extractBibleEntities } from '../utils/bibleCompanion';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { useI18n } from '../utils/i18n';
import { useFeedback } from './Feedback';
import RewriteReviewDialog from './RewriteReviewDialog';
import {
  Sparkles,
  Check,
  X,
  ArrowRight,
  Flame,
  EyeOff,
  MessageSquare,
  RefreshCw
} from 'lucide-react';

const EDITOR_WIDTHS = { compact: 700, standard: 840, wide: 980 };
const LETTER = /^[a-zA-ZàèéìòùÀÈÉÌÒÙ]$/;
const LOWER_LETTER = /^[a-zàèéìòù]$/;

/** Typographic conventions per language. */
function typography(language) {
  return language === 'en'
    ? { open: '“', close: '”', dash: '—', dialogueDash: '— ' }
    : { open: '«', close: '»', dash: '— ', dialogueDash: '— ' };
}

/** Publication-grade clean-up of a manuscript (dialogue dashes, quotes, spacing, ellipses...). */
export function formatManuscript(rawText, language = 'it') {
  if (!rawText) return rawText;
  const { open, close } = typography(language);
  let res = rawText.replace(/\r\n/g, '\n');
  res = res.replace(/^([\t ]*)[-–—]+[\t ]*(?=\S)/gm, '$1— ');             // dialogue dashes
  res = res.replace(/[^\S\r\n]{2,}(?=\S)/g, (m, offset, str) => (str[offset - 1] === '\n' || offset === 0 ? m : ' ')); // collapse inner spaces, keep indents
  res = res.replace(/[ \t]+([,.;:!?…»”)\]}])/g, '$1');                    // no space before punctuation
  res = res.replace(/\.{3}/g, '…');                                       // typographic ellipsis
  res = res.replace(/([,;!?…])([A-Za-zàèéìòùÀÈÉÌÒÙ«“—])/g, '$1 $2');     // space after punctuation
  res = res.replace(/([a-zA-ZàèéìòùÀÈÉÌÒÙ])'([a-zA-ZàèéìòùÀÈÉÌÒÙ])/g, '$1’$2');
  res = res.replace(/\b(po|fa|da|di|un|qual)'(?=\s|$)/gi, '$1’');
  res = res.replace(/"([^"\n]+)"/g, `${open}$1${close}`);
  res = res.replace(/([.!?…]\s+)([a-zàèéìòù])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  res = res.replace(/(—\s+)([a-zàèéìòù])/g, (m, p1, p2) => p1 + p2.toUpperCase());
  res = res.replace(/[ \t]+$/gm, '');
  return res;
}

const Editor = forwardRef(function Editor({
  chapter,
  onUpdateContent,
  settings,
  book,
  onUpdateBible,
  onWritingActivity,
  onCursorChange,
  onRefiningChange,
  isWriting = false
}, ref) {
  const { t, language } = useI18n();
  const { notify } = useFeedback();
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const mirrorRef = useRef(null);

  // Real-time companion suggestions
  const [activeSuggestions, setActiveSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [suggestionReview, setSuggestionReview] = useState(null);
  const [isCheckingChunk, setIsCheckingChunk] = useState(false);

  // Selection AI popup
  const [selectionRange, setSelectionRange] = useState(null);
  const [closingSelectionRange, setClosingSelectionRange] = useState(null);
  const [isChapterRefinementActive, setIsChapterRefinementActive] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementElapsedSeconds, setEnhancementElapsedSeconds] = useState(0);
  const [enhancedResult, setEnhancedResult] = useState(null);
  const [enhancementError, setEnhancementError] = useState(null);
  const enhancementAbortControllerRef = useRef(null);
  const selectionAnimationDuration = settings.enableAnimations !== false ? Number(settings.animationDurationMs) || 220 : 0;
  const { shouldRender: shouldShowSelectionPopup, isExiting: isSelectionPopupExiting } = useAnimatedVisibility(
    Boolean(selectionRange),
    selectionAnimationDuration
  );

  // Typing focus blur
  const [isTypingFocusActive, setIsTypingFocusActive] = useState(false);
  const typingIdleTimerRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const consecutiveEntersRef = useRef(0);
  const chunkTypingTimerRef = useRef(null);

  const [cursorLine, setCursorLine] = useState(1);
  const [totalLines, setTotalLines] = useState(1);

  // The status bar shows the caret line
  useEffect(() => {
    onCursorChange?.({ line: cursorLine, total: totalLines });
  }, [cursorLine, totalLines, onCursorChange]);

  useEffect(() => {
    if (!isEnhancing) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => setEnhancementElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [isEnhancing]);

  // Suggestions belong to a chapter: clear them when switching
  useEffect(() => {
    setActiveSuggestions([]);
    setSelectedSuggestion(null);
    setSelectionRange(null);
    setEnhancedResult(null);
    setEnhancementError(null);
  }, [chapter?.id]);

  // ---------------------------------------------------------------------------
  // Caret measurement (invisible mirror) for typewriter scrolling and the line HUD
  // ---------------------------------------------------------------------------
  const getCaretOffset = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return { top: 0, height: 38, totalHeight: 400 };
    if (textarea.clientWidth > 0) mirror.style.width = `${textarea.clientWidth}px`;

    const { selectionStart } = textarea;
    const text = textarea.value || '';
    mirror.textContent = '';
    const marker = document.createElement('span');
    marker.textContent = '|';
    marker.style.display = 'inline-block';
    marker.style.width = '0px';
    mirror.appendChild(document.createTextNode(text.slice(0, selectionStart)));
    mirror.appendChild(marker);
    mirror.appendChild(document.createTextNode(text.slice(selectionStart)));

    return {
      top: marker.offsetTop,
      height: marker.offsetHeight || 38,
      totalHeight: mirror.offsetHeight || mirror.scrollHeight || 400
    };
  }, []);

  const fontSize = Number(settings.fontSize) || 19;
  const lineHeightRatio = Number(settings.lineHeight) || 2.1;
  const hudCountMode = settings.lineHUDCountMode;

  const updateLineNumbers = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const text = textarea.value || '';
    if (hudCountMode === 'paragraphs') {
      const selStart = textarea.selectionStart ?? 0;
      setCursorLine(text.slice(0, selStart).split('\n').length);
      setTotalLines(Math.max(1, text.split('\n').length));
      return;
    }
    const { top: caretTop, totalHeight } = getCaretOffset();
    const singleLinePx = Math.max(22, Math.round(fontSize * lineHeightRatio));
    const visualCurLine = Math.max(1, Math.floor(caretTop / singleLinePx) + 1);
    setCursorLine(visualCurLine);
    setTotalLines(Math.max(visualCurLine, Math.round(totalHeight / singleLinePx)));
  }, [getCaretOffset, fontSize, lineHeightRatio, hudCountMode]);

  useEffect(() => {
    updateLineNumbers();
  }, [chapter?.content, updateLineNumbers]);

  const typewriterMode = settings.typewriterMode;
  const centerActiveLine = useCallback((smooth = false) => {
    const textarea = textareaRef.current;
    const container = containerRef.current;
    if (!textarea || !container) return;

    const { top: caretTop, height: caretHeight, totalHeight } = getCaretOffset();
    if (totalHeight) {
      const desiredHeight = Math.max(500, totalHeight + 100);
      if (Math.abs(textarea.offsetHeight - desiredHeight) > 15) textarea.style.height = `${desiredHeight}px`;
    }
    if (!typewriterMode) return;

    const containerRect = container.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    const caretViewportY = (textareaRect.top - containerRect.top) + caretTop;
    const delta = caretViewportY - ((container.clientHeight / 2) - (caretHeight / 2));
    if (Math.abs(delta) > 1) {
      const top = Math.max(0, container.scrollTop + delta);
      if (smooth) container.scrollTo({ top, behavior: 'smooth' });
      else container.scrollTop = top;
    }
  }, [typewriterMode, getCaretOffset]);

  useEffect(() => {
    centerActiveLine(true);
  }, [chapter?.id, centerActiveLine]);

  // ---------------------------------------------------------------------------
  // Text mutations that keep the native undo history (Ctrl+Z / Ctrl+Y)
  // ---------------------------------------------------------------------------
  const replaceRange = useCallback((start, end, text) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const ok = text === ''
      ? document.execCommand('delete', false)
      : document.execCommand('insertText', false, text);
    if (!ok) {
      // Fallback (no undo entry, but never lose the edit)
      textarea.setRangeText(text, start, end, 'end');
      onUpdateContent(textarea.value);
    }
  }, [onUpdateContent]);

  const replaceWholeText = useCallback((text) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    replaceRange(0, textarea.value.length, text);
  }, [replaceRange]);

  const handleFormatForPublication = () => {
    const current = textareaRef.current?.value || '';
    if (!current.trim()) return;
    const formatted = formatManuscript(current, language);
    if (formatted !== current) {
      const caret = textareaRef.current.selectionStart;
      replaceWholeText(formatted);
      textareaRef.current.setSelectionRange(Math.min(caret, formatted.length), Math.min(caret, formatted.length));
      notify(t('editor.formatDone'), { tone: 'success' });
    } else {
      notify(t('editor.formatAlready'), { tone: 'info' });
    }
  };

  // ---------------------------------------------------------------------------
  // Keyboard: sounds, typing focus, smart typography
  // ---------------------------------------------------------------------------
  const handleKeyDown = (e) => {
    // Only real typing (not Esc, arrows or shortcuts) enters the immersive mode
    const isTyping = !e.ctrlKey && !e.altKey && !e.metaKey
      && (e.key.length === 1 || ['Enter', 'Backspace', 'Delete', 'Tab'].includes(e.key));
    audioEngine.playKey(e.key, e.code);
    if (isTyping) onWritingActivity?.();

    if (settings.lineFocusBlur && isTyping) {
      setIsTypingFocusActive(true);
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = setTimeout(() => setIsTypingFocusActive(false), 1500);
    }

    const textarea = textareaRef.current;
    if (!textarea || e.nativeEvent.isComposing) return;
    const { selectionStart, selectionEnd, value } = textarea;
    const textBefore = value.slice(0, selectionStart);
    const currentLine = textBefore.split('\n').pop() || '';
    const lineStart = selectionStart - currentLine.length;
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    const typo = typography(language);

    // 1. Enter: dialogue continuation & editorial paragraph indent
    if (e.key === 'Enter' && !hasModifier) {
      consecutiveEntersRef.current += 1;
      if (consecutiveEntersRef.current >= 3 && settings.chunkCheckingEnabled) {
        triggerChunkCheck();
        consecutiveEntersRef.current = 0;
      }
      if (e.shiftKey) return;

      const dialogueOpener = currentLine.match(/^\s*([—–-]\s*|«|“)/)?.[1];
      const isDialogueOnly = /^\s*([—–-]\s*|«\s*|“\s*)$/.test(currentLine);

      if (isDialogueOnly) {
        e.preventDefault();
        replaceRange(lineStart, selectionEnd, '\n');
        return;
      }
      if (dialogueOpener && selectionStart === selectionEnd) {
        e.preventDefault();
        const opener = /[—–-]/.test(dialogueOpener) ? typo.dialogueDash : dialogueOpener.trim();
        replaceRange(selectionStart, selectionEnd, `\n${opener}`);
        return;
      }
      if (settings.editorialIndent) {
        e.preventDefault();
        if (/^\s{4,}$/.test(currentLine)) {
          replaceRange(lineStart, selectionEnd, '\n');
        } else {
          replaceRange(selectionStart, selectionEnd, '\n    ');
        }
        return;
      }
      return;
    }
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) consecutiveEntersRef.current = 0;

    // 2. Tab / Shift+Tab: literary indentation
    if (e.key === 'Tab' && !hasModifier) {
      e.preventDefault();
      if (e.shiftKey) {
        const removed = currentLine.match(/^( {1,4}|\t)/)?.[1].length || 0;
        if (removed) {
          replaceRange(lineStart, lineStart + removed, '');
          const caret = Math.max(lineStart, selectionStart - removed);
          textarea.setSelectionRange(caret, caret);
        }
      } else {
        replaceRange(selectionStart, selectionEnd, '    ');
      }
      return;
    }

    // 3. Smart punctuation & typography
    if (settings.smartPunctuation !== false && !hasModifier && selectionStart === selectionEnd) {
      const prevChar = value[selectionStart - 1] || '';

      if (e.key === '-' && prevChar === '-') {
        e.preventDefault();
        replaceRange(selectionStart - 1, selectionStart, typo.dash);
        return;
      }
      if (e.key === '.' && value.slice(selectionStart - 2, selectionStart) === '..') {
        e.preventDefault();
        replaceRange(selectionStart - 2, selectionStart, '…');
        return;
      }
      if (e.key === '"') {
        e.preventDefault();
        const isOpening = !prevChar || /[\s([{—–-]/.test(prevChar);
        replaceRange(selectionStart, selectionEnd, isOpening ? typo.open : typo.close);
        return;
      }
      if (e.key === "'") {
        e.preventDefault();
        replaceRange(selectionStart, selectionEnd, '’');
        return;
      }

      if (LETTER.test(e.key)) {
        // Missing space after , ; ! ? … : (never after "." — file.txt, www.site, p.es.)
        const isUrlColon = prevChar === ':' && /https?$/i.test(textBefore.slice(0, -1));
        if ([',', ';', '!', '?', '…', ':'].includes(prevChar) && !isUrlColon) {
          e.preventDefault();
          const upper = ['!', '?', '…'].includes(prevChar) && LOWER_LETTER.test(e.key);
          replaceRange(selectionStart, selectionEnd, ` ${upper ? e.key.toUpperCase() : e.key}`);
          return;
        }

        const needsCap = /^\s*$/.test(textBefore)
          || /[.!?…]\s+$/.test(textBefore)
          || /\n\s*$/.test(textBefore)
          || /(^|\n)\s*[—–-]\s*$/.test(textBefore)
          || /[«“]\s*$/.test(textBefore);
        if (needsCap && LOWER_LETTER.test(e.key)) {
          e.preventDefault();
          replaceRange(selectionStart, selectionEnd, e.key.toUpperCase());
          return;
        }
      }
    }

    // 4. Editor-only shortcuts (global ones live in App)
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'f' && e.shiftKey) {
        e.preventDefault();
        handleFormatForPublication();
      } else if (e.key === 'Enter' && activeSuggestions.length > 0) {
        e.preventDefault();
        reviewSuggestion(selectedSuggestion || activeSuggestions[0]);
      } else if (key === 'd' && selectedSuggestion) {
        e.preventDefault();
        dismissSuggestion(selectedSuggestion);
      }
    }
  };

  const handleChange = (e) => {
    onWritingActivity?.();
    onUpdateContent(e.target.value);
    centerActiveLine(false);
    updateLineNumbers();
    if (settings.chunkCheckingEnabled) {
      clearTimeout(chunkTypingTimerRef.current);
      chunkTypingTimerRef.current = setTimeout(() => triggerChunkCheck(), 2500);
    }
  };

  const handleContainerMouseMove = (e) => {
    const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
    const dy = Math.abs(e.clientY - lastMousePosRef.current.y);
    if (dx > 4 || dy > 4) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (isTypingFocusActive) setIsTypingFocusActive(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Real-time companion: chunk check + Novel Bible auto-extraction
  // ---------------------------------------------------------------------------
  const triggerChunkCheck = async () => {
    if (!textareaRef.current || isCheckingChunk) return;
    const text = textareaRef.current.value;
    if (!text || text.trim().length < 6) return;

    const cursorPos = textareaRef.current.selectionStart ?? text.length;
    const linesBefore = text.slice(0, cursorPos).split('\n');
    const firstLineAfter = text.slice(cursorPos).split('\n')[0] || '';
    const recentChunk = [...linesBefore.slice(-4), firstLineAfter].join('\n').trim() || text.slice(-400);

    setIsCheckingChunk(true);
    try {
      const suggestions = await checkTextChunk({
        recentText: recentChunk,
        contextWindow: text.slice(Math.max(0, cursorPos - 1000), Math.min(text.length, cursorPos + 300)),
        settings
      });

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        setActiveSuggestions((prev) => {
          const existing = new Set(prev.map(s => s.original + s.suggestion));
          const updated = [...suggestions.filter(s => !existing.has(s.original + s.suggestion)), ...prev].slice(0, 10);
          setSelectedSuggestion(current => current || updated[0] || null);
          return updated;
        });
      }

      if (settings.autoSyncBible !== false && book && onUpdateBible) {
        const bibleRes = await extractBibleEntities({
          chapterTitle: chapter?.title || '',
          chapterContent: text,
          currentBible: book.bible || {},
          settings
        });
        if (bibleRes?.error) {
          notify(t('editor.bibleNotUpdated', { error: bibleRes.error }), { tone: 'error' });
        } else if (bibleRes?.newlyDiscoveredCount > 0) {
          onUpdateBible(bibleRes.updatedBible);
          const label = bibleRes.extracted.characters[0]?.name || bibleRes.extracted.locations[0]?.title || t('editor.newEntities');
          notify(t('editor.bibleAdded', { label, count: bibleRes.newlyDiscoveredCount }), { tone: 'ai' });
        }
      }
    } catch (err) {
      console.error('Chunk check error', err);
    } finally {
      setIsCheckingChunk(false);
    }
  };

  const locateSentence = (text, cleanOriginal) => {
    let matchStart = -1;
    if (!cleanOriginal) return matchStart;
    matchStart = text.lastIndexOf(cleanOriginal);
    if (matchStart < 0) {
      const unquoted = cleanOriginal.replace(/^[«"“'—–\s-]+|[»"”'—–\s.-]+$/g, '').trim();
      if (unquoted.length > 5) matchStart = text.lastIndexOf(unquoted);
    }
    if (matchStart < 0 && /\.{3}|…/.test(cleanOriginal)) {
      for (const part of cleanOriginal.split(/\.{3}|…/).map(p => p.trim()).filter(p => p.length > 4)) {
        const idx = text.lastIndexOf(part);
        if (idx >= 0) return idx;
      }
    }
    if (matchStart < 0) {
      const normTarget = cleanOriginal.replace(/\s+/g, ' ');
      if (text.replace(/\s+/g, ' ').lastIndexOf(normTarget) >= 0) {
        matchStart = text.lastIndexOf(normTarget.split(' ').slice(0, 3).join(' '));
      }
    }
    return matchStart;
  };

  const reviewSuggestion = async (suggestion) => {
    if (!textareaRef.current || !suggestion) return;
    const text = textareaRef.current.value || '';
    const cleanOriginal = (suggestion.original || '').trim();
    const matchStart = locateSentence(text, cleanOriginal);
    const isLocated = matchStart >= 0;

    let sentence = cleanOriginal;
    let start = 0;
    let end = 0;
    if (isLocated) {
      const preceding = text.slice(0, matchStart);
      start = Math.max(...['\n', '.', '!', '?', '…'].map(ch => preceding.lastIndexOf(ch))) + 1;
      while (/\s/.test(text[start] || '') && text[start] !== '\n') start += 1;
      const matchEnd = matchStart + Math.min(cleanOriginal.length || 1, text.length - matchStart);
      const following = text.slice(matchEnd);
      const nextBoundary = following.search(/[.!?…\n]/);
      end = nextBoundary < 0 ? text.length : matchEnd + nextBoundary + (following[nextBoundary] === '\n' ? 0 : 1);
      sentence = text.slice(start, end).trimEnd();
      end = start + sentence.length;
    }

    setSelectedSuggestion(suggestion);
    setSuggestionReview({
      suggestion,
      start,
      end,
      original: sentence,
      improved: sentence,
      explanation: suggestion.reason || '',
      isLocated,
      fallback: false,
      loading: true,
      error: isLocated ? null : t('editor.sentenceNotLocated')
    });

    try {
      const result = await rewriteSuggestion({
        sentence,
        context: text.slice(Math.max(0, start - 350), Math.min(text.length, end + 350)),
        bookContext: buildNovelContext(book, chapter?.id),
        original: suggestion.original,
        reason: suggestion.reason,
        suggestion: suggestion.suggestion,
        settings
      });
      setSuggestionReview(current => current ? {
        ...current,
        ...result,
        improved: result.improved?.trim() ? result.improved.trim() : current.original,
        loading: false
      } : current);
    } catch (err) {
      setSuggestionReview(current => current ? { ...current, loading: false, error: err.message || t('editor.rewriteFailed') } : current);
    }
  };

  const requestEditorAiAlternative = async () => {
    if (!suggestionReview || !textareaRef.current) return;
    setSuggestionReview(current => ({ ...current, loading: true, error: null }));
    const text = textareaRef.current.value || '';
    try {
      const result = await rewriteSuggestion({
        sentence: suggestionReview.original,
        context: text.slice(Math.max(0, suggestionReview.start - 350), Math.min(text.length, suggestionReview.end + 350)),
        bookContext: buildNovelContext(book, chapter?.id),
        original: suggestionReview.suggestion?.original,
        reason: suggestionReview.suggestion?.reason,
        suggestion: suggestionReview.suggestion?.suggestion,
        settings
      });
      setSuggestionReview(current => current ? {
        ...current,
        ...result,
        improved: result.improved?.trim() ? result.improved : current.improved,
        loading: false
      } : current);
    } catch (error) {
      setSuggestionReview(current => current ? { ...current, loading: false, error: error.message || t('editor.alternativeFailed') } : current);
    }
  };

  const dismissSuggestion = (suggestion) => {
    setActiveSuggestions(prev => {
      const remaining = prev.filter(s => s !== suggestion && (!s.id || s.id !== suggestion?.id));
      setSelectedSuggestion(remaining[0] || null);
      return remaining;
    });
  };

  const applyReviewedSuggestion = () => {
    if (!suggestionReview || suggestionReview.loading || !textareaRef.current) return;
    const currentText = textareaRef.current.value || '';
    const { start, end, original, improved, isLocated, suggestion } = suggestionReview;

    if (isLocated && currentText.slice(start, end) === original) {
      replaceRange(start, end, improved);
    } else {
      const fallbackOriginal = suggestion?.original || original;
      const idx = fallbackOriginal ? currentText.lastIndexOf(fallbackOriginal) : -1;
      if (idx < 0) {
        setSuggestionReview(current => ({ ...current, error: t('editor.sentenceChanged') }));
        return;
      }
      replaceRange(idx, idx + fallbackOriginal.length, improved);
    }
    dismissSuggestion(suggestion);
    setSuggestionReview(null);
  };

  // ---------------------------------------------------------------------------
  // Selection quick actions & chapter refinement
  // ---------------------------------------------------------------------------
  const closeSelectionPopup = () => {
    if (selectionRange) setClosingSelectionRange(selectionRange);
    setSelectionRange(null);
    setIsChapterRefinementActive(false);
  };

  // Esc closes the quick-actions popup first (and cancels a running request)
  useEffect(() => {
    if (!selectionRange || suggestionReview) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      enhancementAbortControllerRef.current?.abort();
      setClosingSelectionRange(selectionRange);
      setSelectionRange(null);
      setIsChapterRefinementActive(false);
      setEnhancedResult(null);
      setEnhancementError(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectionRange, suggestionReview]);

  const handleSelectText = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    updateLineNumbers();
    if (isEnhancing) return;
    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionEnd - selectionStart > 12) {
      const nextRange = { start: selectionStart, end: selectionEnd, text: value.slice(selectionStart, selectionEnd) };
      setIsChapterRefinementActive(false);
      setSelectionRange(nextRange);
      setClosingSelectionRange(nextRange);
      setEnhancedResult(null);
      setEnhancementError(null);
    } else if (selectionRange && !enhancedResult) {
      closeSelectionPopup();
    }
  };

  const handleRunEnhancement = async (mode, textOverride = null) => {
    const sourceText = textOverride ?? selectionRange?.text;
    if (!sourceText) return;
    const abortController = new AbortController();
    enhancementAbortControllerRef.current = abortController;
    setEnhancementElapsedSeconds(0);
    setIsEnhancing(true);
    setEnhancedResult(null);
    setEnhancementError(null);
    try {
      const result = await enhanceParagraph({
        text: sourceText,
        mode,
        settings,
        bookContext: buildNovelContext(book, chapter?.id),
        signal: abortController.signal
      });
      setEnhancedResult({ ...result, mode });
    } catch (error) {
      if (error.name === 'AbortError') {
        setEnhancementError(t('editor.requestCancelled'));
        return;
      }
      console.error('Failed to enhance paragraph', error);
      setEnhancementError(error.message || t('editor.enhanceFailed'));
    } finally {
      if (enhancementAbortControllerRef.current === abortController) enhancementAbortControllerRef.current = null;
      setIsEnhancing(false);
    }
  };

  const handleRunChapterRefinement = async () => {
    const chapterText = chapter?.content || '';
    if (!chapterText.trim()) return;
    const wholeChapterRange = { start: 0, end: chapterText.length, text: chapterText };
    setIsChapterRefinementActive(true);
    setSelectionRange(wholeChapterRange);
    setClosingSelectionRange(wholeChapterRange);
    await handleRunEnhancement('refinement', chapterText);
  };

  const handleApplyEnhanced = () => {
    if (!enhancedResult?.improved || !selectionRange || !textareaRef.current) return;
    const current = textareaRef.current.value;
    if (current.slice(selectionRange.start, selectionRange.end) !== selectionRange.text) {
      setEnhancementError(t('editor.selectionChanged'));
      return;
    }
    replaceRange(selectionRange.start, selectionRange.end, enhancedResult.improved);
    closeSelectionPopup();
    setEnhancedResult(null);
    setEnhancementError(null);
  };

  // Chapter tools are triggered from the top bar
  useImperativeHandle(ref, () => ({
    format: handleFormatForPublication,
    refine: handleRunChapterRefinement
  }));

  const isRefining = isEnhancing && isChapterRefinementActive;
  useEffect(() => {
    onRefiningChange?.(isRefining);
  }, [isRefining, onRefiningChange]);

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  const editorWidthPx = EDITOR_WIDTHS[settings.editorWidth] || EDITOR_WIDTHS.standard;
  const activeMaxWidth = `${editorWidthPx}px`;
  const boundaryClass = `boundary-${settings.pageBoundaryStyle || 'shadow'}`;

  const intensityMap = {
    soft: { blur: '1.5px', opacity: 0.65 },
    medium: { blur: '2.5px', opacity: 0.85 },
    strong: { blur: '4.5px', opacity: 0.96 }
  };
  const currentIntensity = intensityMap[settings.lineFocusIntensity] || intensityMap.medium;
  const visibleSelectionRange = selectionRange || (shouldShowSelectionPopup ? closingSelectionRange : null);
  const isWholeChapterSelected = Boolean(
    visibleSelectionRange && visibleSelectionRange.start === 0 && visibleSelectionRange.end === (chapter?.content || '').length
  );
  const selectedWordCount = visibleSelectionRange ? visibleSelectionRange.text.trim().split(/\s+/).filter(Boolean).length : 0;
  const providerName = { gemini: 'Gemini', openai: 'OpenAI', ollama: 'Ollama', claude: 'Claude' }[settings.aiProvider] || 'AI';
  const textStyle = {
    fontFamily: settings.fontFamily || 'var(--font-serif)',
    fontSize: `${fontSize}px`,
    lineHeight: lineHeightRatio,
    textAlign: settings.textAlignment || 'left',
    letterSpacing: '0.005em'
  };

  return (
    <div
      ref={containerRef}
      className={`editor-container ${typewriterMode ? 'is-typewriter' : ''}`}
      onMouseMove={handleContainerMouseMove}
      onScroll={() => isTypingFocusActive && setIsTypingFocusActive(false)}
    >
      {settings.lineFocusBlur && (
        <>
          <div
            className="line-focus-overlay line-focus-top"
            style={{
              opacity: isTypingFocusActive ? currentIntensity.opacity : 0,
              backdropFilter: isTypingFocusActive ? `blur(${currentIntensity.blur})` : 'none',
              WebkitBackdropFilter: isTypingFocusActive ? `blur(${currentIntensity.blur})` : 'none'
            }}
          />
          <div
            className="line-focus-overlay line-focus-bottom"
            style={{
              opacity: isTypingFocusActive ? currentIntensity.opacity : 0,
              backdropFilter: isTypingFocusActive ? `blur(${currentIntensity.blur})` : 'none',
              WebkitBackdropFilter: isTypingFocusActive ? `blur(${currentIntensity.blur})` : 'none'
            }}
          />
        </>
      )}

      <div key={chapter?.id} className={`editor-column page-enter ${boundaryClass}`} style={{ maxWidth: activeMaxWidth }}>
        <div ref={mirrorRef} aria-hidden="true" className="editor-mirror" style={textStyle} />

        <div className="editor-chapter-eyebrow" aria-hidden="true">
          <span className="editor-ornament" />
        </div>

        <input
          type="text"
          className="editor-title-input"
          value={chapter?.title || ''}
          onChange={(e) => {
            onWritingActivity?.();
            onUpdateContent(chapter?.content || '', e.target.value);
          }}
          placeholder={t('editor.chapterTitlePlaceholder')}
          aria-label={t('editor.chapterTitleLabel')}
          spellCheck={false}
        />

        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={chapter?.content || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={() => {
            centerActiveLine(false);
            updateLineNumbers();
          }}
          onClick={handleSelectText}
          onSelect={handleSelectText}
          placeholder={t('editor.placeholder')}
          aria-label={t('editor.textareaLabel')}
          autoFocus
          spellCheck={false}
          style={textStyle}
        />
      </div>

      {/* Selection quick actions & chapter refinement */}
      {shouldShowSelectionPopup && visibleSelectionRange && (isChapterRefinementActive || !isWholeChapterSelected || isSelectionPopupExiting) && (
        <div
          className={`selection-ai-popup editor-selection-popup ${isSelectionPopupExiting ? 'selection-ai-popup-exit' : ''}`}
          style={{
            width: `min(${isChapterRefinementActive ? '980px' : '560px'}, calc(100% - 2.5rem))`,
            pointerEvents: isSelectionPopupExiting ? 'none' : 'auto'
          }}
        >
          <div className="editor-popup-head">
            <div className="editor-popup-title">
              <Sparkles size={14} />
              <span>{isChapterRefinementActive ? t('editor.chapterRefinement') : t('editor.quickActions', { count: selectedWordCount })}</span>
            </div>
            <button type="button" className="editor-icon-btn" onClick={closeSelectionPopup} aria-label={t('common.close')}>
              <X size={14} />
            </button>
          </div>

          {!isChapterRefinementActive && !isWholeChapterSelected && (
            <div className="editor-quick-actions">
              <button type="button" className="editor-action" onClick={() => handleRunEnhancement('pacingBoost')} disabled={isEnhancing}>
                <Flame size={14} strokeWidth={1.75} /> {t('editor.pacingBoost')}
              </button>
              <button type="button" className="editor-action" onClick={() => handleRunEnhancement('showDontTell')} disabled={isEnhancing}>
                <EyeOff size={14} strokeWidth={1.75} /> {t('editor.showDontTell')}
              </button>
              <button type="button" className="editor-action" onClick={() => handleRunEnhancement('dialogueSharp')} disabled={isEnhancing}>
                <MessageSquare size={14} strokeWidth={1.75} /> {t('editor.dialogueSharp')}
              </button>
            </div>
          )}

          {isEnhancing && (
            <div role="status" className="editor-popup-status">
              <RefreshCw size={13} className="animate-spin" />
              <span>{t('editor.waitingProvider', { provider: providerName, seconds: enhancementElapsedSeconds })}</span>
              <button type="button" className="editor-link-danger" onClick={() => enhancementAbortControllerRef.current?.abort()}>{t('common.cancel')}</button>
            </div>
          )}

          {enhancementError && <p role="alert" className="editor-error">{enhancementError}</p>}

          {enhancedResult && (
            <div className="editor-result">
              {enhancedResult.mode === 'refinement' ? (
                <div className="editor-compare-grid">
                  <label className="editor-compare-label">
                    {t('editor.original')}
                    <textarea value={visibleSelectionRange.text} readOnly className="editor-compare-area editor-compare-tall" />
                  </label>
                  <label className="editor-compare-label editor-compare-label-accent">
                    {t('editor.refinedEditable')}
                    <textarea
                      value={enhancedResult.improved}
                      onChange={event => setEnhancedResult(current => ({ ...current, improved: event.target.value }))}
                      className="editor-compare-area editor-compare-tall editor-compare-accent"
                    />
                  </label>
                </div>
              ) : (
                <blockquote className="editor-result-quote">{enhancedResult.improved}</blockquote>
              )}
              {enhancedResult.explanation && <div className="editor-result-explanation">{enhancedResult.explanation}</div>}
              <div className="editor-result-actions">
                <button type="button" className="m3-btn m3-btn-text" onClick={() => setEnhancedResult(null)}>{t('common.cancel')}</button>
                <button type="button" className="m3-btn m3-btn-filled" onClick={handleApplyEnhanced}>
                  <Check size={14} /> {enhancedResult.mode === 'refinement' ? t('editor.applyRefinement') : t('editor.replaceInText')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {suggestionReview && (
        <RewriteReviewDialog
          review={{ ...suggestionReview, reason: suggestionReview.suggestion?.reason }}
          onClose={() => setSuggestionReview(null)}
          onChangeImproved={(improved) => setSuggestionReview(current => ({ ...current, improved }))}
          onRequestAlternative={requestEditorAiAlternative}
          onApply={applyReviewedSuggestion}
        />
      )}

      {/* Real-time companion notes (only when there is something to say) */}
      {activeSuggestions.length > 0 && !selectionRange && (
        <div className={`editor-companion editor-floating ${isWriting ? 'editor-floating-hidden' : ''}`}>
          <div className="ai-suggestion-card animate-fade-in">
            <div className="ai-suggestion-head">
              <div className="ai-suggestion-title">
                <Sparkles size={14} />
                <span>{t(activeSuggestions.length === 1 ? 'editor.companionOne' : 'editor.companionMany', { count: activeSuggestions.length })}</span>
              </div>
              <button type="button" className="editor-icon-btn" onClick={() => setActiveSuggestions([])} aria-label={t('editor.closeSuggestions')}>
                <X size={15} />
              </button>
            </div>
            <div className="ai-suggestion-list">
              {activeSuggestions.map((item, idx) => (
                <div key={item.id || `${item.original}-${idx}`} className={`ai-suggestion-item ${item === selectedSuggestion ? 'ai-suggestion-item-active' : ''}`}>
                  {item.contextSnippet && <div className="ai-suggestion-snippet">{item.contextSnippet}</div>}
                  {item.reason && <p className="ai-suggestion-reason">{item.reason}</p>}
                  <div className="ai-suggestion-item-actions">
                    <button type="button" onClick={() => dismissSuggestion(item)} className="editor-action editor-action-quiet">{t('editor.dismiss')}</button>
                    <button type="button" onClick={() => reviewSuggestion(item)} className="editor-action editor-action-accent">
                      {t('editor.reviewSentence')} <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Editor;
