import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../utils/audioEngine';
import { checkTextChunk, enhanceParagraph } from '../utils/aiService';
import { extractBibleEntities } from '../utils/bibleCompanion';
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
  onSaveToDisk
}) {
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const mirrorRef = useRef(null);

  // Suggestions from Chunk Checking
  const [activeSuggestions, setActiveSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [isCheckingChunk, setIsCheckingChunk] = useState(false);
  const [isCompanionExpanded, setIsCompanionExpanded] = useState(false);
  const [bibleToast, setBibleToast] = useState(null);
  const [editorialToast, setEditorialToast] = useState(null);

  // Selection AI floating menu
  const [selectionRange, setSelectionRange] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedResult, setEnhancedResult] = useState(null);

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
      setCursorLine(curParagraph);
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
      // Ctrl+A / Ctrl+Enter / Ctrl+Y: Accept top AI suggestion
      else if ((key === 'a' || e.key === 'Enter' || key === 'y') && activeSuggestions.length > 0) {
        e.preventDefault();
        const target = selectedSuggestion || activeSuggestions[0];
        if (target) applySuggestion(target);
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

    const lines = text.split('\n').filter(Boolean);
    const recentChunk = lines.slice(-4).join('\n') || text;

    setIsCheckingChunk(true);
    try {
      // 1. Text & Typo Check
      const suggestions = await checkTextChunk({
        recentText: recentChunk,
        contextWindow: text.slice(Math.max(0, text.length - 600)),
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

        if (bibleRes && bibleRes.newlyDiscoveredCount > 0) {
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

  // Apply suggestion replacement
  const applySuggestion = (suggestion) => {
    if (!textareaRef.current || !suggestion) return;
    const currentText = textareaRef.current.value;
    
    if (currentText.includes(suggestion.original)) {
      const newText = currentText.replace(suggestion.original, suggestion.suggestion);
      onUpdateContent(newText);
    }

    dismissSuggestion(suggestion);
  };

  // Apply all detected suggestions in one click
  const applyAllSuggestions = () => {
    if (!textareaRef.current || activeSuggestions.length === 0) return;
    let currentText = textareaRef.current.value;
    activeSuggestions.forEach(s => {
      if (currentText.includes(s.original)) {
        currentText = currentText.replace(s.original, s.suggestion);
      }
    });
    onUpdateContent(currentText);
    setActiveSuggestions([]);
    setSelectedSuggestion(null);
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
    const { selectionStart, selectionEnd, value } = textareaRef.current;
    
    if (selectionEnd - selectionStart > 12) {
      const selected = value.slice(selectionStart, selectionEnd);
      setSelectionRange({ start: selectionStart, end: selectionEnd, text: selected });
    } else {
      setSelectionRange(null);
      setEnhancedResult(null);
    }
  };

  const handleRunEnhancement = async (mode) => {
    if (!selectionRange?.text) return;
    setIsEnhancing(true);
    try {
      const result = await enhanceParagraph({
        text: selectionRange.text,
        mode,
        settings
      });
      setEnhancedResult(result);
    } catch (err) {
      console.error('Failed to enhance paragraph', err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApplyEnhanced = () => {
    if (!enhancedResult?.improved || !selectionRange) return;
    const current = textareaRef.current.value;
    const before = current.slice(0, selectionRange.start);
    const after = current.slice(selectionRange.end);
    const updated = before + enhancedResult.improved + after;
    onUpdateContent(updated);
    setSelectionRange(null);
    setEnhancedResult(null);
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
            onChange={(e) => onUpdateContent(chapter?.content, e.target.value)}
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
        {selectionRange && (
          <div 
            className="glass-panel animate-fade-in"
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
              maxWidth: '560px',
              width: '90%',
              boxShadow: '0 10px 35px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                <Sparkles size={14} />
                <span>Azioni Rapide Scrittore ({selectionRange.text.split(/\s+/).length} parole selezionate)</span>
              </div>
              <button onClick={() => setSelectionRange(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Quick Action Buttons */}
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

            {/* Enhanced Result Preview */}
            {isEnhancing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--accent-cyan)' }} />
                <span>Riscrivendo il passaggio con i canoni della suspense...</span>
              </div>
            )}

            {enhancedResult && (
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-cyan)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontStyle: 'italic', marginBottom: '0.4rem', lineHeight: 1.5 }}>
                  "{enhancedResult.improved}"
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                  {enhancedResult.explanation}
                </div>
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
                    <Check size={12} /> Sostituisci nel Testo
                  </button>
                </div>
              </div>
            )}
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
                  {activeSuggestions.length > 1 && (
                    <button
                      onClick={applyAllSuggestions}
                      title="Applica tutte le correzioni nel testo"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: 'var(--accent-cyan)',
                        color: '#1a1612',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Correggi Tutti
                    </button>
                  )}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--accent-coral)', textDecoration: 'line-through', opacity: 0.85 }}>
                          {item.original}
                        </span>
                        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>
                          {item.suggestion}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => applySuggestion(item)}
                          className="m3-chip"
                          style={{
                            padding: '0.2rem 0.55rem',
                            fontSize: '0.72rem',
                            background: 'var(--accent-cyan-dim)',
                            color: 'var(--accent-cyan)',
                            borderColor: 'var(--accent-cyan)'
                          }}
                        >
                          <Check size={12} /> Correggi
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

          {/* Collapsed Pill Button */}
          {activeSuggestions.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <button
                type="button"
                onClick={handleFormatForPublication}
                title="Formatta il capitolo secondo gli standard editoriali (Ctrl+Shift+F)"
                className="m3-chip"
                style={{
                  padding: '0.38rem 0.75rem',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.73rem',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Feather size={12} style={{ color: 'var(--accent-amber)' }} />
                <span>Formatta Prosa</span>
              </button>

              <div
                className="m3-chip"
                style={{
                  padding: '0.38rem 0.75rem',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.73rem',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
                }}
              >
                <Sparkles size={12} style={{ color: 'var(--accent-cyan)' }} />
                <span>AI Companion: Prosa Impeccabile</span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic & Configurable Line Indicator HUD (Material 3 Expressive) */}
        {settings.showLineHUD !== false && (
          <>
            {(!settings.lineHUDStyle || settings.lineHUDStyle === 'pill') && (
              <div 
                className="m3-line-hud"
                title={`Posizione: Riga ${cursorLine} di ${totalLines} (${Math.round((cursorLine / Math.max(1, totalLines)) * 100)}%)`}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
                <span>RIGA {cursorLine} / {totalLines}</span>
                <span style={{ opacity: 0.65, fontSize: '0.66rem' }}>
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
