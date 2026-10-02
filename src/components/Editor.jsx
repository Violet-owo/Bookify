import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { checkTextChunk, enhanceParagraph, rewriteSuggestion, buildNovelContext } from '../utils/aiService';
import { extractBibleEntities } from '../utils/bibleCompanion';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import DiffViewer from './DiffViewer';
import AiCircleLoader from './AiCircleLoader';
import { 
  Sparkles, 
  Check, 
  X, 
  ArrowRight, 
  Flame, 
  EyeOff, 
  MessageSquare, 
  RefreshCw,
  BookOpen,
  Wand2,
  Feather,
  CheckCheck,
  FileCheck
} from 'lucide-react';

export default function Editor({
  chapter,
  onUpdateContent,
  settings,
  book,
  onUpdateBible,
  onOpenReview,
  onOpenBible,
  onOpenSettings,
  onSaveToDisk,
  onWritingActivity
}) {
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const mirrorRef = useRef(null);

  // Suggestions from Chunk Checking
  const [activeSuggestions, setActiveSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [suggestionReview, setSuggestionReview] = useState(null);
  const [isCheckingChunk, setIsCheckingChunk] = useState(false);
  const [isCompanionExpanded, setIsCompanionExpanded] = useState(false);
  const [bibleToast, setBibleToast] = useState(null);
  const [editorialToast, setEditorialToast] = useState(null);

  // Selection AI floating menu
  const [selectionRange, setSelectionRange] = useState(null);
  const [isChapterRefinementActive, setIsChapterRefinementActive] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementElapsedSeconds, setEnhancementElapsedSeconds] = useState(0);
  const [enhancedResult, setEnhancedResult] = useState(null);
  const [enhancementError, setEnhancementError] = useState(null);
  const enhancementAbortControllerRef = useRef(null);
  const [closingSelectionRange, setClosingSelectionRange] = useState(null);
  const selectionAnimationDuration = settings.enableAnimations !== false
    ? Number(settings.animationDurationMs) || 220
    : 0;
  const { shouldRender: shouldShowSelectionPopup, isExiting: isSelectionPopupExiting } = useAnimatedVisibility(
    Boolean(selectionRange),
    selectionAnimationDuration
  );

  useEffect(() => {
    if (!isEnhancing) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setEnhancementElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isEnhancing]);

  // Active Typing Focus & Blur state
  const [isTypingFocusActive, setIsTypingFocusActive] = useState(false);
  const typingIdleTimerRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Tracking enter presses and typing state
  const consecutiveEntersRef = useRef(0);
  const chunkTypingTimerRef = useRef(null);
  const lastChunkHashRef = useRef('');

  // Cursor tracking for typewriter scroll and live Line HUD
  const [cursorLine, setCursorLine] = useState(1);
  const [totalLines, setTotalLines] = useState(1);

  // Precise Caret Coordinates calculation using invisible mirror
  const getCaretOffset = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return { top: 0, height: 38, totalHeight: 400 };

    if (textarea.clientWidth > 0) {
      mirror.style.width = `${textarea.clientWidth}px`;
    }

    const { selectionStart } = textarea;
    const text = textarea.value || '';
    const textBefore = text.slice(0, selectionStart);
    const textAfter = text.slice(selectionStart);

    mirror.textContent = '';
    const preNode = document.createTextNode(textBefore);
    const marker = document.createElement('span');
    marker.textContent = '|';
    marker.style.display = 'inline-block';
    marker.style.width = '0px';
    const postNode = document.createTextNode(textAfter);

    mirror.appendChild(preNode);
    mirror.appendChild(marker);
    mirror.appendChild(postNode);

    const markerTop = marker.offsetTop;
    const markerHeight = marker.offsetHeight || 38;
    const totalHeight = mirror.offsetHeight || mirror.scrollHeight || 400;
    return { top: markerTop, height: markerHeight, totalHeight };
  }, []);

  // Calculate exact cursor line and total lines (supporting real visual wrapped lines)
  const updateLineNumbers = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const text = textarea.value || '';
    const selStart = textarea.selectionStart ?? 0;
    const textBefore = text.slice(0, selStart);
    const curParagraph = textBefore.split('\n').length;
    const allParagraphs = Math.max(1, text.split('\n').length);

    // Calculate real visual wrapped lines from caret vertical coordinate in mirror
    const { top: caretTop, totalHeight } = getCaretOffset();
    const fontSize = Number(settings?.fontSize) || 19;
    const lineHeightRatio = Number(settings?.lineHeight) || 2.1;
    const singleLinePx = Math.max(22, Math.round(fontSize * lineHeightRatio));

    const visualCurLine = Math.max(1, Math.floor(caretTop / singleLinePx) + 1);
    const visualTotalLines = Math.max(visualCurLine, Math.floor(totalHeight / singleLinePx) + 1);

    if (settings?.lineHUDCountMode === 'paragraphs') {
      setTotalLines(allParagraphs);
    } else {
      setCursorLine(visualCurLine);
      setTotalLines(visualTotalLines);
    }
  }, [getCaretOffset, settings?.fontSize, settings?.lineHeight, settings?.lineHUDCountMode]);

  useEffect(() => {
    updateLineNumbers();
  }, [chapter?.content, updateLineNumbers]);

  // Center active line in container with zero bounce
  const centerActiveLine = useCallback((smooth = false) => {
    if (!textareaRef.current || !containerRef.current) return;
    const textarea = textareaRef.current;
    const container = containerRef.current;

    const { top: caretTop, height: caretHeight, totalHeight } = getCaretOffset();

    // Adjust height from mirror WITHOUT resetting to 'auto'
    if (totalHeight) {
      const desiredHeight = Math.max(500, totalHeight + 100);
      if (Math.abs(textarea.offsetHeight - desiredHeight) > 15) {
        textarea.style.height = `${desiredHeight}px`;
      }
    }

    if (!settings.typewriterMode) return;

    // Calculate exact caret Y coordinate relative to container's visible viewport
    const containerRect = container.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();

    const caretCurrentViewportY = (textareaRect.top - containerRect.top) + caretTop;
    const targetViewportY = (container.clientHeight / 2) - (caretHeight / 2);
    const deltaScroll = caretCurrentViewportY - targetViewportY;

    if (Math.abs(deltaScroll) > 1) {
      if (smooth) {
        container.scrollTo({
          top: Math.max(0, container.scrollTop + deltaScroll),
          behavior: 'smooth'
        });
      } else {
        container.scrollTop = Math.max(0, container.scrollTop + deltaScroll);
      }
    }
  }, [settings.typewriterMode, getCaretOffset]);

  // Publication-grade formatting helper for Italian & International literature
  const formatManuscriptPublicationStandards = (rawText) => {
    if (!rawText) return rawText;
    let res = rawText;
    
    // 1. Normalize line endings
    res = res.replace(/\r\n/g, '\n');
    
    // 2. Dialogue dashes: lines starting with '-' or '--' become literary em-dash '— '
    res = res.replace(/^[\t ]*[-–—]+[\t ]*/gm, '— ');
    
    // 3. Remove multiple spaces (excluding newlines)
    res = res.replace(/[^\S\r\n]{2,}/g, ' ');
    
    // 4. Remove space before punctuation: , . ! ? ; : … » ” ) ] }
    res = res.replace(/[ \t]+([,.;:!?…»”)\]}])/g, '$1');
    
    // 5. Ensure single space after punctuation: , . ! ? ; : … when followed by word or quote
    res = res.replace(/([,.;:!?…])([A-Za-z0-9àèéìòùÀÈÉÌÒÙ«“—])/g, '$1 $2');
    
    // 6. Typographic ellipses: replace three consecutive dots with …
    res = res.replace(/\.{3}/g, '…');
    
    // 7. Typographic apostrophe: replace straight single quote ' with ’
    res = res.replace(/([a-zA-ZàèéìòùÀÈÉÌÒÙ])'([a-zA-ZàèéìòùÀÈÉÌÒÙ])/g, '$1’$2');
    res = res.replace(/\b(po|fa|da|di|un|qual)'\b/gi, '$1’');
    
    // 8. Convert straight quotes "..." to publication guillemets «...»
    res = res.replace(/"([^"\n]+)"/g, '«$1»');
    
    // 9. Capitalize first letter after sentence-ending punctuation (. ! ?)
    res = res.replace(/([.!?]\s+)([a-zàèéìòù])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    
    // 10. Capitalize after dialogue dash: '— a...' -> '— A...'
    res = res.replace(/(—\s+)([a-zàèéìòù])/g, (m, p1, p2) => p1 + p2.toUpperCase());

    // 11. Clean trailing whitespace on lines
    res = res.replace(/[ \t]+$/gm, '');

    return res;
  };

  const handleFormatForPublication = () => {
    if (!textareaRef.current) return;
    const current = textareaRef.current.value || '';
    if (!current.trim()) return;

    const formatted = formatManuscriptPublicationStandards(current);
    if (formatted !== current) {
      onUpdateContent(formatted);
      setEditorialToast('✨ Manoscritto rifinito secondo gli standard tipografici ed editoriali!');
    } else {
      setEditorialToast('✓ Il manoscritto è già perfettamente formattato per la pubblicazione!');
    }
    setTimeout(() => setEditorialToast(null), 4000);
  };

  // Play audio and activate Typing Focus
  const handleKeyDown = (e) => {
    audioEngine.playKey(e.key, e.code);
    if (onWritingActivity) onWritingActivity();

    // Trigger Active Line Focus while typing
    if (settings.lineFocusBlur) {
      setIsTypingFocusActive(true);
      if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = setTimeout(() => {
        setIsTypingFocusActive(false);
      }, 1500);
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const textBefore = value.slice(0, selectionStart);
    const textAfter = value.slice(selectionEnd);
    const currentLine = textBefore.split('\n').pop() || '';

    // ============================================================
    // 1. AUTONOMOUS INDENTATION & DIALOGUE CONTINUATION (Enter)
    // ============================================================
    if (e.key === 'Enter') {
      consecutiveEntersRef.current += 1;
      if (consecutiveEntersRef.current >= 3 && settings.chunkCheckingEnabled) {
        triggerChunkCheck();
        consecutiveEntersRef.current = 0;
      }

      // Dialogue continuation: if the current line was a dialogue line
      const isDialogueLine = /^\s*([—–-]|«)/.test(currentLine);
      const isDialogueOnly = /^\s*([—–-]\s*|«\s*)$/.test(currentLine);

      if (isDialogueOnly) {
        // If author presses enter on an empty dialogue dash, cancel dialogue to return to narrative
        e.preventDefault();
        const startOfLine = selectionStart - currentLine.length;
        const newText = value.slice(0, startOfLine) + '\n' + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = startOfLine + 1;
          updateLineNumbers();
          centerActiveLine(false);
        }, 0);
        return;
      }

      if (isDialogueLine) {
        // Autonomously continue next dialogue line
        e.preventDefault();
        const insert = '\n— ';
        const newText = textBefore + insert + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + insert.length;
          updateLineNumbers();
          centerActiveLine(false);
        }, 0);
        return;
      }

      // Editorial Paragraph Indentation (Capoverso da libro stampato)
      if (settings.editorialIndent && !e.shiftKey) {
        // If the author is already on an empty indented line, clear indent so they can exit paragraph
        if (/^\s{4,}$/.test(currentLine)) {
          e.preventDefault();
          const startOfLine = selectionStart - currentLine.length;
          const newText = value.slice(0, startOfLine) + '\n' + textAfter;
          onUpdateContent(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = startOfLine + 1;
            updateLineNumbers();
            centerActiveLine(false);
          }, 0);
          return;
        }

        // Auto-indent new paragraph with 4 spaces
        e.preventDefault();
        const insert = '\n    ';
        const newText = textBefore + insert + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + insert.length;
          updateLineNumbers();
          centerActiveLine(false);
        }, 0);
        return;
      }
    } else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
      consecutiveEntersRef.current = 0;
    }

    // ============================================================
    // 2. TAB & SHIFT+TAB (Literary Indentation)
    // ============================================================
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Unindent current line by up to 4 spaces
        const match = currentLine.match(/^(\s{1,4})/);
        if (match) {
          const removed = match[1].length;
          const lineStartIdx = selectionStart - currentLine.length;
          const newText = value.slice(0, lineStartIdx) + currentLine.slice(removed) + textAfter;
          onUpdateContent(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStartIdx, selectionStart - removed);
            updateLineNumbers();
          }, 0);
        }
      } else {
        // Insert 4-space editorial indent
        const insert = '    ';
        const newText = textBefore + insert + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + insert.length;
          updateLineNumbers();
        }, 0);
      }
      return;
    }

    // ============================================================
    // 3. SMART PUNCTUATION & TYPOGRAPHY
    // ============================================================
    if (settings.smartPunctuation !== false && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // A. Em-Dash: '--' becomes '—'
      if (e.key === '-' && selectionStart > 0 && value[selectionStart - 1] === '-') {
        e.preventDefault();
        const newText = value.slice(0, selectionStart - 1) + '— ' + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
          updateLineNumbers();
        }, 0);
        return;
      }

      // B. Ellipsis: '..' followed by '.' becomes '…'
      if (e.key === '.' && selectionStart >= 2 && value.slice(selectionStart - 2, selectionStart) === '..') {
        e.preventDefault();
        const newText = value.slice(0, selectionStart - 2) + '… ' + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart;
          updateLineNumbers();
        }, 0);
        return;
      }

      // C. Typographic Dialogue Quotes: '"' becomes '« ' or ' »'
      if (e.key === '"') {
        e.preventDefault();
        const prevChar = selectionStart > 0 ? value[selectionStart - 1] : '';
        const isOpening = !prevChar || /\s|[\n(\[{]/.test(prevChar);
        const quoteChar = isOpening ? '«' : '»';
        const newText = textBefore + quoteChar + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
          updateLineNumbers();
        }, 0);
        return;
      }

      // D. Typographic Apostrophe: "'" becomes '’'
      if (e.key === "'") {
        e.preventDefault();
        const newText = textBefore + '’' + textAfter;
        onUpdateContent(newText);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
          updateLineNumbers();
        }, 0);
        return;
      }

      // E. Auto-Spacing after punctuation: if user types a letter directly after ,;:!?
      if (e.key.length === 1 && /^[a-zA-ZàèéìòùÀÈÉÌÒÙ]$/.test(e.key)) {
        const prevChar = selectionStart > 0 ? value[selectionStart - 1] : '';
        if (['.', '!', '?', ',', ';', ':', '…'].includes(prevChar)) {
          e.preventDefault();
          const isSentenceEnd = ['.', '!', '?', '…'].includes(prevChar);
          const charToInsert = isSentenceEnd ? e.key.toUpperCase() : e.key;
          const insert = ' ' + charToInsert;
          const newText = textBefore + insert + textAfter;
          onUpdateContent(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insert.length;
            updateLineNumbers();
            centerActiveLine(false);
          }, 0);
          return;
        }

        // F. Auto-Capitalization: at start of line, paragraph, or after sentence end (. ! ? … \n — «)
        const needsCap = /^(|\s*)$/.test(textBefore) ||
                         /[.!?…]\s+$/.test(textBefore) ||
                         /\n\s*$/.test(textBefore) ||
                         /(^|\n)\s*[—–-]\s*$/.test(textBefore) ||
                         /«\s*$/.test(textBefore);

        if (needsCap && /^[a-zàèéìòù]$/.test(e.key)) {
          e.preventDefault();
          const upper = e.key.toUpperCase();
          const newText = textBefore + upper + textAfter;
          onUpdateContent(newText);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
            updateLineNumbers();
            centerActiveLine(false);
          }, 0);
          return;
        }
      }
    }

    // ============================================================
    // 4. KEYBOARD SHORTCUTS WITH CTRL
    // ============================================================
    if ((e.ctrlKey || e.metaKey)) {
      const key = e.key.toLowerCase();

      // Ctrl+Shift+F: Format Manuscript to Publication Standards
      if ((key === 'f' && e.shiftKey)) {
        e.preventDefault();
        handleFormatForPublication();
        return;
      }

      // Ctrl+S: Save to PC
      if (key === 's') {
        e.preventDefault();
        e.stopPropagation();
        if (onSaveToDisk) onSaveToDisk();
      }
      // Ctrl+R: Revisione / Editor Room
      else if (key === 'r') {
        e.preventDefault();
        if (onOpenReview) onOpenReview();
      }
      // Ctrl+B: Novel Bible
      else if (key === 'b') {
        e.preventDefault();
        if (onOpenBible) onOpenBible();
      }
      // Ctrl+Enter / Ctrl+Y: Review the selected AI suggestion
      else if ((e.key === 'Enter' || key === 'y') && activeSuggestions.length > 0) {
        e.preventDefault();
        const target = selectedSuggestion || activeSuggestions[0];
        if (target) reviewSuggestion(target);
      }
      // Ctrl+D: Dismiss suggestion
      else if (key === 'd' && selectedSuggestion) {
        e.preventDefault();
        dismissSuggestion(selectedSuggestion);
      }
    }
  };

  // Handle text input
  const handleChange = (e) => {
    if (onWritingActivity) onWritingActivity();
    const newContent = e.target.value;
    onUpdateContent(newContent);

    // Center position immediately and update line metrics
    centerActiveLine(false);
    updateLineNumbers();

    if (settings.chunkCheckingEnabled) {
      if (chunkTypingTimerRef.current) clearTimeout(chunkTypingTimerRef.current);
      chunkTypingTimerRef.current = setTimeout(() => {
        triggerChunkCheck();
      }, 2500);
    }
  };

  // When mouse moves, smoothly disable blur so the author can read the entire page clearly
  const handleContainerMouseMove = (e) => {
    const dx = Math.abs(e.clientX - lastMousePosRef.current.x);
    const dy = Math.abs(e.clientY - lastMousePosRef.current.y);

    if (dx > 4 || dy > 4) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (isTypingFocusActive) {
        setIsTypingFocusActive(false);
      }
    }
  };

  const handleContainerScroll = () => {
    if (isTypingFocusActive) {
      setIsTypingFocusActive(false);
    }
  };

  // Chunk checking logic & Bible Auto-Extraction
  const triggerChunkCheck = async () => {
    if (!textareaRef.current || isCheckingChunk) return;
    const text = textareaRef.current.value;
    if (!text || text.trim().length < 6) return;

    const cursorPos = textareaRef.current.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);
    const linesBefore = beforeCursor.split('\n');
    const recentChunkLines = linesBefore.slice(-4);
    const firstLineAfter = afterCursor.split('\n')[0] || '';
    const recentChunk = [...recentChunkLines, firstLineAfter].join('\n').trim() || text.slice(-400);

    setIsCheckingChunk(true);
    try {
      // 1. Text & Typo Check
      const suggestions = await checkTextChunk({
        recentText: recentChunk,
        contextWindow: text.slice(Math.max(0, cursorPos - 1000), Math.min(text.length, cursorPos + 300)),
        settings
      });

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        setActiveSuggestions((prev) => {
          const existingIds = new Set(prev.map(s => s.original + s.suggestion));
          const newItems = suggestions.filter(s => !existingIds.has(s.original + s.suggestion));
          const updated = [...newItems, ...prev].slice(0, 10);
          if (updated.length > 0 && !selectedSuggestion) {
            setSelectedSuggestion(updated[0]);
          }
          return updated;
        });
      }

      // 2. Novel Bible Auto-Extraction (Auto-compile characters & lore)
      if (settings.autoSyncBible !== false && book && onUpdateBible) {
        const bibleRes = await extractBibleEntities({
          chapterTitle: chapter?.title || 'Capitolo',
          chapterContent: text,
          currentBible: book.bible || {},
          settings
        });

        if (bibleRes?.error) {
          setBibleToast(`Bibbia non aggiornata: ${bibleRes.error}`);
          setTimeout(() => setBibleToast(null), 6000);
        } else if (bibleRes && bibleRes.newlyDiscoveredCount > 0) {
          onUpdateBible(bibleRes.updatedBible);
          const firstChar = bibleRes.extracted.characters[0]?.name;
          const firstLoc = bibleRes.extracted.locations[0]?.title;
          const label = firstChar || firstLoc || 'Nuove entità';
          setBibleToast(`✨ AI Companion: Aggiunto alla Bibbia: "${label}" (+${bibleRes.newlyDiscoveredCount})`);
          setTimeout(() => setBibleToast(null), 4500);
        }
      }
    } catch (err) {
      console.error('Chunk check error', err);
    } finally {
      setIsCheckingChunk(false);
    }
  };

  const reviewSuggestion = async (suggestion) => {
    if (!textareaRef.current) return;
    const text = textareaRef.current.value || '';
    const cleanOriginal = (suggestion?.original || '').trim();

    // Smart locator
    let matchStart = -1;
    if (cleanOriginal) {
      matchStart = text.lastIndexOf(cleanOriginal);
      if (matchStart < 0) {
        const unquoted = cleanOriginal.replace(/^[«"“'—–\s-]+|[»"”'—–\s.-]+$/g, '').trim();
        if (unquoted.length > 5) matchStart = text.lastIndexOf(unquoted);
      }
      if (matchStart < 0 && (cleanOriginal.includes('...') || cleanOriginal.includes('…'))) {
        const parts = cleanOriginal.split(/\.{3}|…/).map(p => p.trim()).filter(p => p.length > 4);
        for (const part of parts) {
          const idx = text.lastIndexOf(part);
          if (idx >= 0) { matchStart = idx; break; }
        }
      }
      if (matchStart < 0) {
        const normTarget = cleanOriginal.replace(/\s+/g, ' ');
        const normText = text.replace(/\s+/g, ' ');
        const nIdx = normText.lastIndexOf(normTarget);
        if (nIdx >= 0) {
          const words = normTarget.split(' ').slice(0, 3).join(' ');
          matchStart = text.lastIndexOf(words);
        }
      }
    }

    let sentence = cleanOriginal;
    let start = 0;
    let end = 0;
    const isLocated = matchStart >= 0;

    if (isLocated) {
      const precedingText = text.slice(0, matchStart);
      const lastBoundary = Math.max(
        precedingText.lastIndexOf('\n'),
        precedingText.lastIndexOf('.'),
        precedingText.lastIndexOf('!'),
        precedingText.lastIndexOf('?'),
        precedingText.lastIndexOf('…')
      );
      start = lastBoundary + 1;
      while (/\s/.test(text[start] || '') && text[start] !== '\n') start += 1;

      const matchedLen = Math.min(cleanOriginal.length || 1, text.length - matchStart);
      const matchEnd = matchStart + matchedLen;
      const followingText = text.slice(matchEnd);
      const nextBoundary = followingText.search(/[.!?…\n]/);
      end = nextBoundary < 0 ? text.length : matchEnd + nextBoundary + (followingText[nextBoundary] === '\n' ? 0 : 1);
      sentence = text.slice(start, end).trimEnd();
    }

    const review = {
      suggestion,
      start,
      end: isLocated ? (start + sentence.length) : 0,
      original: sentence,
      improved: sentence,
      explanation: suggestion?.reason || '',
      isLocated,
      fallback: false,
      loading: true,
      error: !isLocated ? 'Nota: La frase non è stata localizzata esattamente nel capitolo. Puoi comunque confrontare o modificare la proposta.' : null
    };
    setSelectedSuggestion(suggestion);
    setSuggestionReview(review);

    // Call AI to rewrite based on the editor recommendation
    try {
      const result = await rewriteSuggestion({
        sentence,
        context: text.slice(Math.max(0, start - 350), Math.min(text.length, end + 350)),
        bookContext: buildNovelContext(book, chapter?.id),
        original: suggestion?.original,
        reason: suggestion?.reason,
        suggestion: suggestion?.suggestion,
        settings
      });
      setSuggestionReview(current => current ? {
        ...current,
        ...result,
        improved: result.improved && result.improved.trim() ? result.improved.trim() : current.original,
        loading: false
      } : current);
    } catch (err) {
      setSuggestionReview(curr => curr ? { ...curr, loading: false, error: err.message || 'Errore riscrittura AI.' } : curr);
    }
  };

  const requestEditorAiAlternative = async () => {
    if (!suggestionReview || !textareaRef.current) return;
    setSuggestionReview(curr => ({ ...curr, loading: true, error: null }));
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
      setSuggestionReview(current => current
        ? {
            ...current,
            ...result,
            improved: result.improved && result.improved.trim() ? result.improved : current.improved,
            loading: false
          }
        : current);
    } catch (error) {
      setSuggestionReview(current => current
        ? { ...current, loading: false, error: error.message || 'Impossibile generare una variante alternativa.' }
        : current);
    }
  };

  const applyReviewedSuggestion = () => {
    if (!suggestionReview || suggestionReview.loading || !textareaRef.current) return;
    const currentText = textareaRef.current.value || '';
    const { start, end, original, improved, isLocated, suggestion } = suggestionReview;

    if (isLocated && currentText.slice(start, end) === original) {
      const updated = currentText.slice(0, start) + improved + currentText.slice(end);
      onUpdateContent(updated);
    } else {
      const cleanOrig = suggestion?.original || original;
      if (cleanOrig && currentText.includes(cleanOrig)) {
        const idx = currentText.lastIndexOf(cleanOrig);
        const updated = currentText.slice(0, idx) + improved + currentText.slice(idx + cleanOrig.length);
        onUpdateContent(updated);
      } else {
        setSuggestionReview(current => ({
          ...current,
          error: 'La frase nel capitolo è cambiata. Puoi copiare la proposta e incollarla direttamente nel testo.'
        }));
        return;
      }
    }

    dismissSuggestion(suggestionReview.suggestion);
    setSuggestionReview(null);
  };

  // Dismiss suggestion
  const dismissSuggestion = (suggestion) => {
    setActiveSuggestions(prev => {
      const remaining = prev.filter(s => s !== suggestion && s.id !== suggestion.id);
      setSelectedSuggestion(remaining[0] || null);
      return remaining;
    });
  };

  // Text selection handler for instant AI rewriting
  const handleSelectText = () => {
    centerActiveLine(false);
    if (!textareaRef.current) return;
    setIsChapterRefinementActive(false);
    const { selectionStart, selectionEnd, value } = textareaRef.current;
    
    if (selectionEnd - selectionStart > 12) {
      const selected = value.slice(selectionStart, selectionEnd);
      const nextRange = { start: selectionStart, end: selectionEnd, text: selected };
      setSelectionRange(nextRange);
      setClosingSelectionRange(nextRange);
      setEnhancedResult(null);
      setEnhancementError(null);
    } else {
      closeSelectionPopup();
      setEnhancedResult(null);
      setEnhancementError(null);
    }
  };

  const closeSelectionPopup = () => {
    if (selectionRange) setClosingSelectionRange(selectionRange);
    setSelectionRange(null);
    setIsChapterRefinementActive(false);
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
        setEnhancementError('Richiesta annullata.');
        return;
      }
      console.error('Failed to enhance paragraph', error);
      setEnhancementError(error.message || 'Impossibile completare la revisione AI.');
    } finally {
      if (enhancementAbortControllerRef.current === abortController) {
        enhancementAbortControllerRef.current = null;
      }
      setIsEnhancing(false);
    }
  };

  const handleCancelEnhancement = () => {
    enhancementAbortControllerRef.current?.abort();
  };

  const handleRunChapterRefinement = async () => {
    const chapterText = chapter?.content || '';
    if (!chapterText.trim()) return;
    setIsChapterRefinementActive(true);
    const wholeChapterRange = { start: 0, end: chapterText.length, text: chapterText };
    setSelectionRange(wholeChapterRange);
    setClosingSelectionRange(wholeChapterRange);
    await handleRunEnhancement('refinement', chapterText);
  };

  const handleApplyEnhanced = () => {
    if (!enhancedResult?.improved || !selectionRange) return;
    const current = textareaRef.current.value;
    if (current.slice(selectionRange.start, selectionRange.end) !== selectionRange.text) {
      setEnhancementError('Il testo selezionato è cambiato durante la revisione. Selezionalo di nuovo prima di applicare la proposta.');
      return;
    }
    const before = current.slice(0, selectionRange.start);
    const after = current.slice(selectionRange.end);
    const updated = before + enhancedResult.improved + after;
    onUpdateContent(updated);
    closeSelectionPopup();
    setEnhancedResult(null);
    setEnhancementError(null);
  };

  // Initial and chapter change setup
  useEffect(() => {
    centerActiveLine(true);
  }, [chapter?.id, centerActiveLine]);

  // Width limit mapping
  const maxWidthMap = {
    compact: '700px',
    standard: '840px',
    wide: '980px'
  };
  const activeMaxWidth = maxWidthMap[settings.editorWidth] || '840px';

  // Boundary style class
  const boundaryClass = `boundary-${settings.pageBoundaryStyle || 'shadow'}`;

  // Line focus blur intensity values
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

  return (
    <div 
      ref={containerRef} 
      className="editor-container"
      onMouseMove={handleContainerMouseMove}
      onScroll={handleContainerScroll}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '50vh',
        paddingBottom: '50vh',
        scrollBehavior: 'auto'
      }}
    >
      {/* Dynamic Line-Focus Blur Overlays (active when typing, disappears on mouse move) */}
      {settings.lineFocusBlur && (
        <>
          {/* Top Blur Mask */}
          <div
            className="line-focus-overlay line-focus-top"
            style={{
              opacity: isTypingFocusActive ? currentIntensity.opacity : 0,
              backdropFilter: isTypingFocusActive ? `blur(${currentIntensity.blur})` : 'none',
              WebkitBackdropFilter: isTypingFocusActive ? `blur(${currentIntensity.blur})` : 'none'
            }}
          />

          {/* Center Active Line Spotlight */}
          <div 
            className="active-line-spotlight"
            style={{
              opacity: isTypingFocusActive ? 0.35 : 0
            }}
          />

          {/* Bottom Blur Mask */}
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

      {/* Novel Page Canvas with Custom Boundary */}
      <div 
        className={`editor-column ${boundaryClass}`}
        style={{
          width: '100%',
          maxWidth: activeMaxWidth,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          transition: 'box-shadow var(--transition-normal), border-color var(--transition-normal)'
        }}
      >
        {/* Hidden Caret Measuring Mirror */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            fontFamily: settings.fontFamily || 'var(--font-serif)',
            fontSize: `${settings.fontSize || 19}px`,
            lineHeight: settings.lineHeight || 2.1,
            textAlign: settings.textAlignment || 'left',
            letterSpacing: '0.012em',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box',
            zIndex: -9999
          }}
        />
        {/* Chapter Title Input */}
        <div style={{ marginBottom: '2.5rem' }}>
          <input
            type="text"
            value={chapter?.title || ''}
            onChange={(e) => {
              if (onWritingActivity) onWritingActivity();
              onUpdateContent(chapter?.content, e.target.value);
            }}
            placeholder="Titolo del Capitolo..."
            aria-label="Titolo del Capitolo"
            style={{
              width: '100%',
              fontSize: '1.75rem',
              fontWeight: '700',
              fontFamily: 'var(--font-title)',
              color: 'var(--text-primary)',
              border: 'none',
              borderBottom: '1px solid transparent',
              padding: '0.4rem 0',
              background: 'transparent',
              outline: 'none',
              letterSpacing: '0.02em',
              transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent-cyan-dim)'}
            onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
          />
        </div>

        {/* Writing Textarea */}
        <textarea
          ref={textareaRef}
          value={chapter?.content || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={() => {
            centerActiveLine(false);
            updateLineNumbers();
          }}
          onClick={(e) => {
            handleSelectText(e);
            updateLineNumbers();
          }}
          onSelect={(e) => {
            handleSelectText(e);
            updateLineNumbers();
          }}
          placeholder="Inizia a scrivere qui. Lascia che la storia prenda vita..."
          aria-label="Area di scrittura capitolo"
          autoFocus
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: '60vh',
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            fontFamily: settings.fontFamily || 'var(--font-serif)',
            fontSize: `${settings.fontSize || 19}px`,
            lineHeight: settings.lineHeight || 2.1,
            textAlign: settings.textAlignment || 'left',
            caretColor: 'var(--cursor-neon)',
            letterSpacing: '0.012em',
            padding: '0',
            overflow: 'hidden'
          }}
        />

        {/* Floating Selection AI Quick Actions */}
        {shouldShowSelectionPopup && visibleSelectionRange && (isChapterRefinementActive || !isWholeChapterSelected || isSelectionPopupExiting) && (
          <div 
            className={`glass-panel selection-ai-popup ${isSelectionPopupExiting ? 'selection-ai-popup-exit' : ''}`}
            style={{
              position: 'fixed',
              bottom: '5.2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 120,
              padding: '0.65rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              maxWidth: isChapterRefinementActive ? activeMaxWidth : '560px',
              maxHeight: '85vh',
              overflowY: 'auto',
              width: isChapterRefinementActive ? `min(${activeMaxWidth}, calc(100vw - 2rem))` : 'min(560px, calc(100vw - 2rem))',
              pointerEvents: isSelectionPopupExiting ? 'none' : 'auto',
              boxShadow: '0 10px 35px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                <Sparkles size={14} />
                <span>{isChapterRefinementActive ? 'Rifinitura del capitolo' : `Azioni Rapide Scrittore (${visibleSelectionRange.text.split(/\s+/).length} parole selezionate)`}</span>
              </div>
              <button onClick={closeSelectionPopup} style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Quick Action Buttons */}
            {!isChapterRefinementActive && !isWholeChapterSelected && (
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleRunEnhancement('pacingBoost')}
                disabled={isEnhancing}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: 'var(--text-primary)'
                }}
              >
                <Flame size={12} style={{ color: 'var(--accent-coral)' }} /> Ritmo Incalzante
              </button>

              <button
                onClick={() => handleRunEnhancement('showDontTell')}
                disabled={isEnhancing}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: 'var(--text-primary)'
                }}
              >
                <EyeOff size={12} style={{ color: 'var(--accent-amber)' }} /> Mostra non Raccontare
              </button>

              <button
                onClick={() => handleRunEnhancement('dialogueSharp')}
                disabled={isEnhancing}
                style={{
                  padding: '0.35rem 0.65rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.74rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  color: 'var(--text-primary)'
                }}
              >
                <MessageSquare size={12} style={{ color: 'var(--accent-cyan)' }} /> Affila Dialogo
              </button>
              </div>
            )}

            {/* Enhanced Result Preview */}
            {isEnhancing && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ flex: 1 }}>
                  {settings.aiProvider === 'ollama'
                    ? `Richiesta inviata a Ollama. In attesa del modello da ${enhancementElapsedSeconds}s. La modalità API attuale non espone il progresso dei token.`
                    : `Richiesta inviata al provider AI (${enhancementElapsedSeconds}s). In attesa della risposta...`}
                </span>
                <button type="button" onClick={handleCancelEnhancement} style={{ flexShrink: 0, color: 'var(--accent-coral)', fontSize: '0.72rem' }}>Annulla</button>
              </div>
            )}

            {enhancementError && <p role="alert" style={{ margin: 0, color: 'var(--accent-coral)', fontSize: '0.76rem' }}>{enhancementError}</p>}

            {enhancedResult && (
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-cyan)' }}>
                {enhancedResult.mode === 'refinement' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '0.7rem', marginBottom: '0.65rem' }}>
                    <label style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: '700' }}>
                      Originale
                      <textarea
                        value={visibleSelectionRange.text}
                        readOnly
                        rows={14}
                        style={{ boxSizing: 'border-box', width: '100%', height: 'min(52vh, 520px)', resize: 'vertical', padding: '0.75rem', lineHeight: 1.55, color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-serif)', fontSize: '0.84rem' }}
                      />
                    </label>
                    <label style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: '700' }}>
                      Rifinitura, modificabile
                      <textarea
                        value={enhancedResult.improved}
                        onChange={event => setEnhancedResult(current => ({ ...current, improved: event.target.value }))}
                        rows={14}
                        style={{ boxSizing: 'border-box', width: '100%', height: 'min(52vh, 520px)', resize: 'vertical', padding: '0.75rem', lineHeight: 1.55, color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius-xs)', fontFamily: 'var(--font-serif)', fontSize: '0.84rem' }}
                      />
                    </label>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontStyle: 'italic', marginBottom: '0.4rem', lineHeight: 1.5 }}>
                    "{enhancedResult.improved}"
                  </div>
                )}
                {enhancedResult.explanation && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                    {enhancedResult.explanation}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.45rem' }}>
                  <button
                    onClick={() => setEnhancedResult(null)}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleApplyEnhanced}
                    style={{
                      padding: '0.3rem 0.75rem',
                      backgroundColor: 'var(--accent-cyan)',
                      color: '#1a1612',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      borderRadius: 'var(--radius-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Check size={12} /> {enhancedResult.mode === 'refinement' ? 'Applica rifinitura' : 'Sostituisci nel testo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {suggestionReview && (
          <div
            role="presentation"
            onClick={() => setSuggestionReview(null)}
            className="m3-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 320,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              backgroundColor: 'rgba(10, 8, 6, 0.85)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="suggestion-review-title"
              onClick={event => event.stopPropagation()}
              className="m3-popup-panel"
              style={{
                width: 'min(920px, 96vw)',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '1.5rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--accent-cyan-dim)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 24px 70px rgba(0, 0, 0, 0.8)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                <div>
                  <h2 id="suggestion-review-title" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
                    Rivedi e Confronta la Proposta AI
                  </h2>
                  <p style={{ margin: '0.3rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{suggestionReview.suggestion?.reason}</p>
                </div>
                <button onClick={() => setSuggestionReview(null)} aria-label="Chiudi revisione" style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.35rem' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Visual Word-Diff Preview */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Differenze nel testo (Parole Modificate)
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--accent-coral)', textDecoration: 'line-through', marginRight: '8px' }}>Rosso = rimosso</span>
                    <span style={{ color: 'var(--accent-green, #7da87b)', fontWeight: '600' }}>Verde = inserito</span>
                  </span>
                </div>
                {suggestionReview.loading ? (
                  <div style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--accent-cyan)' }}>
                    <AiCircleLoader
                      compact={true}
                      size={32}
                      message="L'AI sta riscrivendo la frase in prosa narrativa..."
                      submessage="Elaborazione delle variazioni e mantenimento dello stile"
                    />
                  </div>
                ) : (
                  <DiffViewer original={suggestionReview.original} modified={suggestionReview.improved} />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: '700' }}>
                  Originale nel capitolo
                  <textarea
                    value={suggestionReview.original}
                    readOnly
                    rows={5}
                    style={{ width: '100%', resize: 'vertical', padding: '0.75rem', lineHeight: 1.6, color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-serif)', fontSize: '0.9rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', color: 'var(--accent-cyan)', fontSize: '0.78rem', fontWeight: '700' }}>
                  Proposta AI (modificabile prima di applicare)
                  <textarea
                    value={suggestionReview.loading ? 'Generazione della riscrittura in corso...' : suggestionReview.improved}
                    disabled={suggestionReview.loading}
                    onChange={event => setSuggestionReview(current => ({ ...current, improved: event.target.value }))}
                    rows={5}
                    style={{ width: '100%', resize: 'vertical', padding: '0.75rem', lineHeight: 1.6, color: suggestionReview.loading ? 'var(--text-muted)' : 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-serif)', fontSize: '0.9rem' }}
                  />
                </label>
              </div>
              {suggestionReview.explanation && (
                <p style={{ marginTop: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-amber)' }}>
                  <strong>Spiegazione editoriale:</strong> {suggestionReview.explanation}
                </p>
              )}
              {suggestionReview.error && <p role="alert" style={{ color: 'var(--accent-coral)', fontSize: '0.8rem', marginTop: '0.8rem' }}>{suggestionReview.error}</p>}
              {suggestionReview.fallback && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Nessun provider AI configurato: proposta generata con euristiche locali.</p>}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.9rem' }}>
                <div>
                  <button
                    type="button"
                    onClick={requestEditorAiAlternative}
                    disabled={suggestionReview.loading}
                    className="m3-btn m3-btn-outlined"
                    title="Chiedi all'AI di generare una nuova variante alternativa per questa frase"
                    style={{ 
                      padding: '0.45rem 0.85rem', 
                      fontSize: '0.74rem',
                      color: 'var(--accent-amber)',
                      borderColor: 'rgba(229, 169, 83, 0.3)'
                    }}
                  >
                    <Sparkles size={13} className="m3-icon-bounce" />
                    <span>{suggestionReview.loading ? 'Generando variante...' : 'Altra variante AI'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <button 
                    onClick={() => setSuggestionReview(null)} 
                    className="m3-btn m3-btn-outlined"
                    style={{ padding: '0.45rem 0.85rem', color: 'var(--text-secondary)' }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={applyReviewedSuggestion}
                    disabled={suggestionReview.loading || !suggestionReview.improved.trim() || suggestionReview.improved === suggestionReview.original}
                    className="m3-btn m3-btn-filled"
                    style={{ 
                      padding: '0.5rem 1.1rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.45rem', 
                      fontWeight: '700', 
                      opacity: (suggestionReview.loading || !suggestionReview.improved.trim() || suggestionReview.improved === suggestionReview.original) ? 0.5 : 1 
                    }}
                  >
                    <Check size={15} /> Applica al testo
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Bible Auto-Sync Toast Notification */}
        {bibleToast && (
          <div 
            className="glass-panel animate-fade-in"
            style={{
              position: 'fixed',
              top: '4.75rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 140,
              padding: '0.65rem 1.35rem',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.7)'
            }}
          >
            <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>{bibleToast}</span>
          </div>
        )}

        {/* Publication Formatting Toast Notification */}
        {editorialToast && (
          <div 
            className="glass-panel animate-fade-in"
            style={{
              position: 'fixed',
              top: '4.75rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 145,
              padding: '0.7rem 1.5rem',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--accent-green, #4ade80)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              boxShadow: '0 14px 40px rgba(0, 0, 0, 0.75)'
            }}
          >
            <CheckCheck size={17} style={{ color: 'var(--accent-green, #4ade80)' }} />
            <span>{editorialToast}</span>
          </div>
        )}

        {/* AI Companion Floating Hub (Real-Time Typo & Literary Assistant) */}
        <div
          style={{
            position: 'fixed',
            bottom: '4.5rem',
            right: '2.5rem',
            zIndex: 130,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.65rem'
          }}
        >
          {/* Expanded Companion Panel */}
          {(isCompanionExpanded || (activeSuggestions.length > 0 && !selectionRange)) && (
            <div 
              className="ai-suggestion-card glass-panel animate-fade-in"
              style={{
                width: '400px',
                maxWidth: '90vw',
                maxHeight: '440px',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${activeSuggestions.length > 0 ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                backgroundColor: 'var(--bg-card)',
                boxShadow: '0 15px 45px rgba(0, 0, 0, 0.8)',
                overflow: 'hidden'
              }}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-elevated)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-cyan)' }}>
                  <Sparkles size={15} />
                  <span style={{ fontWeight: '700', letterSpacing: '0.04em', fontSize: '0.78rem' }}>
                    AI Companion ({activeSuggestions.length} {activeSuggestions.length === 1 ? 'segnalazione' : 'segnalazioni'})
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={handleFormatForPublication}
                    title="Rifinisci formattazione capoversi, punteggiatura e dialoghi (Ctrl+Shift+F)"
                    className="m3-chip"
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      borderRadius: 'var(--radius-xs)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <Feather size={11} style={{ color: 'var(--accent-amber)' }} /> Formatta
                  </button>
                  <button 
                    onClick={() => setActiveSuggestions([])}
                    title="Chiudi pannello suggerimenti"
                    style={{ color: 'var(--text-secondary)', padding: '2px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div style={{ overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {activeSuggestions.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => reviewSuggestion(item)}
                          className="m3-chip"
                          style={{
                            padding: '0.2rem 0.55rem',
                            fontSize: '0.72rem',
                            background: 'var(--accent-cyan-dim)',
                            color: 'var(--accent-cyan)',
                            borderColor: 'var(--accent-cyan)'
                          }}
                        >
                          <ArrowRight size={12} /> Rivedi frase
                        </button>
                        <button
                          onClick={() => dismissSuggestion(item)}
                          style={{
                            padding: '0.25rem 0.4rem',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Contextual Narrative Preview */}
                    {item.contextSnippet && (
                      <div 
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '0.76rem',
                          fontStyle: 'italic',
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-primary)',
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: '3px solid var(--accent-cyan)',
                          lineHeight: 1.45
                        }}
                      >
                        "{item.contextSnippet}"
                      </div>
                    )}

                    {item.reason && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.73rem', margin: 0, lineHeight: 1.4 }}>
                        {item.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed Actions Island (Material 3 Expressive) */}
          {activeSuggestions.length === 0 && (
            <div className="m3-cluster-island">
              <button
                type="button"
                onClick={handleFormatForPublication}
                title="Formatta il capitolo secondo gli standard editoriali (Ctrl+Shift+F)"
                className="m3-cluster-btn"
                style={{ fontSize: '0.74rem', padding: '0.34rem 0.72rem' }}
              >
                <Feather size={12} className="m3-icon-bounce" style={{ color: 'var(--accent-amber)' }} />
                <span>Formatta</span>
              </button>

              <div className="m3-cluster-divider" />

              <button
                type="button"
                onClick={handleRunChapterRefinement}
                disabled={isEnhancing || !(chapter?.content || '').trim()}
                title="Rifinisci tutto il capitolo mantenendo trama, dettagli e voce narrativa"
                className="m3-cluster-btn"
                style={{
                  fontSize: '0.74rem',
                  padding: '0.34rem 0.72rem',
                  color: 'var(--accent-cyan)',
                  fontWeight: '600',
                  opacity: isEnhancing ? 0.65 : 1
                }}
              >
                <Sparkles size={12} className="m3-icon-bounce" />
                <span>{isEnhancing && isChapterRefinementActive ? 'Rifinitura...' : 'Rifinisci'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic & Configurable Line Indicator HUD (Material 3 Expressive & Monkeytype) */}
        {settings.showLineHUD !== false && (
          <>
            {(!settings.lineHUDStyle || settings.lineHUDStyle === 'pill') && (
              <div 
                className="m3-line-hud"
                title={`Posizione: Riga ${cursorLine} di ${totalLines} (${Math.round((cursorLine / Math.max(1, totalLines)) * 100)}%)`}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)' }} />
                <span>riga <strong style={{ color: 'var(--accent-cyan)' }}>{cursorLine}</strong> / {totalLines}</span>
                <span style={{ opacity: 0.6, fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                  ({Math.round((cursorLine / Math.max(1, totalLines)) * 100)}%)
                </span>
              </div>
            )}

            {settings.lineHUDStyle === 'minimal' && (
              <div 
                style={{
                  position: 'fixed',
                  left: '1.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 30,
                  opacity: 0.5,
                  fontSize: '0.75rem',
                  color: 'var(--accent-cyan)',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  userSelect: 'none'
                }}
              >
                <div style={{ width: '12px', height: '1.5px', background: 'var(--accent-cyan)' }} />
                <span>L. {cursorLine}</span>
              </div>
            )}

            {settings.lineHUDStyle === 'bar' && (
              <div 
                style={{
                  position: 'fixed',
                  left: '1.25rem',
                  top: '25vh',
                  height: '50vh',
                  width: '4px',
                  backgroundColor: 'var(--border-subtle)',
                  borderRadius: '9999px',
                  zIndex: 30,
                  userSelect: 'none'
                }}
                title={`Progresso capitolo: ${Math.round((cursorLine / Math.max(1, totalLines)) * 100)}%`}
              >
                <div 
                  style={{
                    position: 'absolute',
                    top: `${Math.min(96, Math.max(0, ((cursorLine - 1) / Math.max(1, totalLines - 1)) * 100))}%`,
                    left: '-3px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-cyan)',
                    boxShadow: '0 0 10px var(--accent-cyan)',
                    transition: 'top 0.15s ease'
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
