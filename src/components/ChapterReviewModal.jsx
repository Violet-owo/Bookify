import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  RefreshCw, 
  FileCheck, 
  Check, 
  Flame, 
  Zap, 
  ArrowRight, 
  EyeOff, 
  Plus,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { reviewChapterContent, reviewWholeBook, buildNovelContext, generateCliffhangerIdeas, rewriteSuggestion } from '../utils/aiService';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import DiffViewer from './DiffViewer';
import AiCircleLoader from './AiCircleLoader';

export default function ChapterReviewModal({
  isOpen,
  onClose,
  chapter,
  book,
  settings,
  onApplyFix,
  onAppendCliffhanger
}) {
  const animDuration = settings?.enableAnimations !== false
    ? Number(settings?.animationDurationMs) || 280
    : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, animDuration);
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [bookReview, setBookReview] = useState(null);
  const [bookReviewProgress, setBookReviewProgress] = useState(null);
  const [bookReviewError, setBookReviewError] = useState(null);
  const [isReviewingBook, setIsReviewingBook] = useState(false);
  const [rewriteReview, setRewriteReview] = useState(null);
  const [activeTab, setActiveTab] = useState('pacing'); // 'pacing' | 'showDontTell' | 'rhythm' | 'orthography' | 'cliffhangers'
  const [appliedFixes, setAppliedFixes] = useState(new Set());
  const [toastMessage, setToastMessage] = useState(null);
  
  // Dedicated cliffhangers state
  const [cliffhangers, setCliffhangers] = useState([]);
  const [loadingCliffhangers, setLoadingCliffhangers] = useState(false);

  // Track last reviewed chapter ID and content to prevent useless re-analysis loops
  const lastAnalyzedChapterIdRef = useRef(null);
  const lastAnalyzedContentRef = useRef(null);

  const runReview = useCallback(async (force = false) => {
    if (!chapter) return;
    // Prevent redundant analyses if chapter content hasn't changed or force isn't set
    if (!force && lastAnalyzedChapterIdRef.current === chapter.id && lastAnalyzedContentRef.current === chapter.content && reviewData) {
      return;
    }

    setLoading(true);
    setReviewError(null);
    try {
      const data = await reviewChapterContent({
        chapterText: chapter.content || '',
        chapterTitle: chapter.title || 'Capitolo',
        settings,
        bookContext: buildNovelContext(book, chapter.id)
      });
      setReviewData(data);
      lastAnalyzedChapterIdRef.current = chapter.id;
      lastAnalyzedContentRef.current = chapter.content;
    } catch (err) {
      console.error('Failed to review chapter', err);
      setReviewError(err.message || 'Revisione AI non riuscita.');
    } finally {
      setLoading(false);
    }
  }, [chapter?.id, chapter?.title, chapter?.content, settings, book, reviewData]);

  const runFullBookReview = async () => {
    if (!book) return;
    setIsReviewingBook(true);
    setBookReview(null);
    setBookReviewError(null);
    setBookReviewProgress({ current: 0, total: book.chapters?.length || 0, title: '' });
    setActiveTab('book');
    try {
      const results = await reviewWholeBook({
        book,
        settings,
        onProgress: setBookReviewProgress
      });
      setBookReview(results);
    } catch (error) {
      setBookReviewError(error.message || 'Analisi del libro non riuscita.');
    } finally {
      setIsReviewingBook(false);
    }
  };

  const handleFetchCliffhangers = async () => {
    if (!chapter) return;
    setLoadingCliffhangers(true);
    try {
      const results = await generateCliffhangerIdeas({
        chapterText: chapter.content || '',
        chapterTitle: chapter.title || 'Capitolo',
        settings
      });
      setCliffhangers(results);
    } catch (err) {
      console.error('Failed to generate cliffhangers', err);
    } finally {
      setLoadingCliffhangers(false);
    }
  };

  // Only auto-trigger analysis when modal opens or chapter switches, NOT on every content change
  useEffect(() => {
    if (isOpen && chapter) {
      if (lastAnalyzedChapterIdRef.current !== chapter.id) {
        runReview(true);
      }
    }
  }, [isOpen, chapter?.id]);


  if (!shouldRender || !chapter) return null;

  const locateTargetSnippet = (text, target) => {
    if (!text || !target) return null;
    const cleanTarget = target.trim();
    if (!cleanTarget) return null;

    // 1. Direct exact match
    let matchStart = text.lastIndexOf(cleanTarget);

    // 2. Stripped quotes match (remove « » " “ ” ' — – - and trailing dots)
    if (matchStart < 0) {
      const unquoted = cleanTarget.replace(/^[«"“'—–\s-]+|[»"”'—–\s.-]+$/g, '').trim();
      if (unquoted.length > 5) {
        matchStart = text.lastIndexOf(unquoted);
      }
    }

    // 3. Ellipsis split: if target contains "..." or "…", find by its sub-clauses
    if (matchStart < 0 && (cleanTarget.includes('...') || cleanTarget.includes('…'))) {
      const parts = cleanTarget.split(/\.{3}|…/).map(p => p.trim()).filter(p => p.length > 4);
      if (parts.length > 0) {
        // Find the first identifiable part
        for (const part of parts) {
          const idx = text.lastIndexOf(part);
          if (idx >= 0) {
            matchStart = idx;
            break;
          }
        }
      }
    }

    // 4. Normalized whitespace match
    if (matchStart < 0) {
      const normalizedTarget = cleanTarget.replace(/\s+/g, ' ');
      const normalizedText = text.replace(/\s+/g, ' ');
      const normStart = normalizedText.lastIndexOf(normalizedTarget);
      if (normStart >= 0) {
        const targetWords = normalizedTarget.split(' ').slice(0, 4).join(' ');
        matchStart = text.lastIndexOf(targetWords);
      }
    }

    // 5. Significant word sequence matching (first 3-5 distinctive words)
    if (matchStart < 0) {
      const words = cleanTarget.replace(/[«"“»”'—–.,;!?…()]/g, ' ').split(/\s+/).filter(w => w.length > 3);
      if (words.length >= 2) {
        const phrase = words.slice(0, 3).join(' ');
        matchStart = text.lastIndexOf(phrase);
      }
      if (matchStart < 0 && words.length > 0) {
        // Try longest single distinctive word
        const longestWord = [...words].sort((a, b) => b.length - a.length)[0];
        if (longestWord && longestWord.length >= 6) {
          matchStart = text.lastIndexOf(longestWord);
        }
      }
    }

    // 6. Substring head/tail fallback
    if (matchStart < 0 && cleanTarget.length > 25) {
      const head = cleanTarget.slice(0, 25).trim();
      matchStart = text.lastIndexOf(head);
    }

    if (matchStart < 0) return null;

    // Calculate sentence/paragraph boundaries
    const precedingText = text.slice(0, matchStart);
    const lastBoundary = Math.max(
      precedingText.lastIndexOf('\n'),
      precedingText.lastIndexOf('.'),
      precedingText.lastIndexOf('!'),
      precedingText.lastIndexOf('?'),
      precedingText.lastIndexOf('…')
    );
    let start = lastBoundary + 1;
    while (/\s/.test(text[start] || '') && text[start] !== '\n') start += 1;

    const matchedLen = Math.min(cleanTarget.length, text.length - matchStart);
    const targetEnd = matchStart + matchedLen;
    const followingText = text.slice(targetEnd);
    const nextBoundary = followingText.search(/[.!?…\n]/);
    const end = nextBoundary < 0 ? text.length : targetEnd + nextBoundary + (followingText[nextBoundary] === '\n' ? 0 : 1);
    const original = text.slice(start, end).trimEnd();

    return { start, end: start + original.length, original };
  };

  const openRewriteReview = async (target, reason, suggestion, targetChapterId = chapter.id) => {
    const targetChapter = book?.chapters?.find(item => item.id === targetChapterId) || chapter;
    const text = targetChapter?.content || '';
    
    const located = locateTargetSnippet(text, target);
    const isLocated = Boolean(located);
    const start = located ? located.start : 0;
    const end = located ? located.end : 0;
    const original = located ? located.original : (target || '');

    // Open modal immediately with loading state and original text
    const initialReview = {
      target,
      targetChapterId: targetChapter?.id || chapter.id,
      reason,
      suggestion,
      start,
      end,
      original,
      improved: original, // Show original until AI returns
      explanation: reason || '',
      isLocated,
      fallback: false,
      loading: true, // Show loader while AI processes!
      error: !isLocated ? 'Nota: La frase originale potrebbe essere stata parzialmente modificata nel testo.' : null
    };
    setRewriteReview(initialReview);

    // Call AI to obtain the clean rewritten text
    try {
      const result = await rewriteSuggestion({
        sentence: original,
        context: text.slice(Math.max(0, start - 350), Math.min(text.length, end + 350)),
        bookContext: buildNovelContext(book, targetChapter?.id),
        original: target,
        reason: reason,
        suggestion: suggestion,
        settings
      });

      setRewriteReview(current => current ? {
        ...current,
        ...result,
        improved: result.improved && result.improved.trim() ? result.improved.trim() : current.original,
        loading: false
      } : current);
    } catch (error) {
      setRewriteReview(current => current ? {
        ...current,
        loading: false,
        error: error.message || 'Errore nella generazione della proposta AI.'
      } : current);
    }
  };

  // Optional on-demand generation if author wants a completely new AI variant
  const requestAiAlternative = async () => {
    if (!rewriteReview) return;
    setRewriteReview(curr => ({ ...curr, loading: true, error: null }));
    const targetChapter = book?.chapters?.find(item => item.id === rewriteReview.targetChapterId) || chapter;
    const text = targetChapter.content || '';

    try {
      const result = await rewriteSuggestion({
        sentence: rewriteReview.original,
        context: text.slice(Math.max(0, rewriteReview.start - 350), Math.min(text.length, rewriteReview.end + 350)),
        bookContext: buildNovelContext(book, targetChapter.id),
        original: rewriteReview.target,
        reason: rewriteReview.reason,
        suggestion: rewriteReview.suggestion,
        settings
      });
      setRewriteReview(current => current
        ? {
            ...current,
            ...result,
            improved: result.improved && result.improved.trim() ? result.improved : current.improved,
            loading: false
          }
        : current);
    } catch (error) {
      setRewriteReview(current => current
        ? { ...current, loading: false, error: error.message || 'Impossibile generare una variante alternativa.' }
        : current);
    }
  };

  const applyRewriteReview = () => {
    const targetChapter = book?.chapters?.find(item => item.id === rewriteReview?.targetChapterId) || chapter;
    if (!rewriteReview || rewriteReview.loading || !targetChapter?.content) return;
    
    let { start, end, original, improved, isLocated, target, targetChapterId } = rewriteReview;
    const currentText = targetChapter.content;

    // Check if the slice at start..end matches original
    if (isLocated && currentText.slice(start, end) === original) {
      onApplyFix?.(original, improved, start, end, targetChapterId);
    } else {
      // Re-attempt smart location in case the text moved or was previously unlocated
      const reloc = locateTargetSnippet(currentText, original || target);
      if (reloc) {
        onApplyFix?.(reloc.original, improved, reloc.start, reloc.end, targetChapterId);
      } else if (target && currentText.includes(target)) {
        // Direct string occurrence replacement
        const targetIdx = currentText.indexOf(target);
        onApplyFix?.(target, improved, targetIdx, targetIdx + target.length, targetChapterId);
      } else {
        setRewriteReview(current => ({ 
          ...current, 
          error: 'Impossibile trovare la frase esatta nel capitolo per sostituirla automaticamente. Puoi copiare la proposta e incollarla direttamente nell\'editor.' 
        }));
        return;
      }
    }
    
    // Add multiple keys so both target, original and normalized match count as applied
    setAppliedFixes(prev => new Set([
      ...prev, 
      `${targetChapterId}:${target}`,
      `${targetChapterId}:${original}`,
      target.trim()
    ]));

    const snippet = improved.slice(0, 35) + (improved.length > 35 ? '...' : '');
    setToastMessage(`✨ Modifica applicata con successo al capitolo: "${snippet}"`);
    setTimeout(() => setToastMessage(null), 4000);

    setRewriteReview(null);
  };

  const handleAppend = (text) => {
    if (onAppendCliffhanger) {
      onAppendCliffhanger(text);
      alert('Cliffhanger accodato alla fine del capitolo!');
    }
  };

  const pacingScore = reviewData?.pacingScore || 80;
  const bookFindingCount = (bookReview?.chapters || []).reduce((total, item) => {
    const report = item.report;
    return total + (report?.showDontTell?.length || 0) + (report?.craft?.length || 0) + (report?.rhythm?.length || 0) + (report?.orthography?.length || 0) + (report?.temporalCoherence?.length || 0);
  }, 0);

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
        zIndex: 260,
        display: 'flex',
        justifyContent: 'flex-end'
      }}
      onClick={onClose}
    >
      <div 
        className={`glass-panel m3-drawer-panel ${isExiting ? 'm3-drawer-panel-exit' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '640px',
          maxWidth: '94vw',
          height: '100%',
          backgroundColor: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--accent-cyan-dim)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-15px 0 45px rgba(0, 0, 0, 0.85)'
        }}
      >
        {/* Toast Notification Alert */}
        {toastMessage && (
          <div 
            className="animate-fade-in"
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: 'rgba(125, 168, 123, 0.18)',
              borderBottom: '1px solid var(--accent-green, #7da87b)',
              color: 'var(--accent-green, #7da87b)',
              fontSize: '0.8rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.35)'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="m3-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="m3-dialog-icon-box">
              <Zap size={22} className="m3-icon-bounce" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Stanza dell'Editor (Ritmo & Suspense)
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                {chapter.title} • Analisi della tensione e del ritmo narrativo
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button
              onClick={runFullBookReview}
              disabled={isReviewingBook}
              title="Analizza tutti i capitoli usando sinossi, personaggi e trama del romanzo"
              className="m3-chip"
              style={{
                color: 'var(--accent-cyan)',
                borderColor: 'var(--accent-cyan-dim)',
                background: 'var(--accent-cyan-dim)',
                opacity: isReviewingBook ? 0.65 : 1
              }}
            >
              <BookOpen size={14} className={isReviewingBook ? 'animate-pulse' : 'm3-icon-bounce'} />
              <span>{isReviewingBook ? `Analisi ${bookReviewProgress?.current || 0}/${bookReviewProgress?.total || 0}${bookReviewProgress?.cached ? ' · cache' : ''}` : 'Analizza tutto il libro'}</span>
            </button>
            <button
              onClick={runReview}
              disabled={loading}
              title="Ricalcola analisi editoriale"
              className="m3-chip"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : 'm3-icon-bounce'} />
              <span>Rianalizza</span>
            </button>
            <button 
              onClick={onClose} 
              className="m3-dialog-close-btn"
              title="Chiudi analisi (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Pacing Score & Vital Stats Telemetry Strip */}
        {reviewData?.stats && (
          <div 
            style={{
              padding: '0.9rem 1.5rem',
              backgroundColor: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem'
            }}
          >
            {/* Pacing Gauge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={15} style={{ color: pacingScore > 75 ? 'var(--accent-cyan)' : 'var(--accent-coral)' }} />
                  Tensione Narrativa
                </span>
                <span 
                  className="m3-chip"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: '0.15rem 0.65rem',
                    color: pacingScore > 75 ? 'var(--accent-cyan)' : 'var(--accent-coral)',
                    borderColor: pacingScore > 75 ? 'var(--accent-cyan-dim)' : 'rgba(255, 118, 117, 0.3)',
                    background: pacingScore > 75 ? 'var(--accent-cyan-dim)' : 'rgba(255, 118, 117, 0.12)'
                  }}
                >
                  {pacingScore}/100 • {reviewData.pacingReview?.tensionLevel || 'Bozza'}
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--m3-shape-full)', overflow: 'hidden', padding: '1px', border: '1px solid var(--border-subtle)' }}>
                <div 
                  style={{
                    width: `${pacingScore}%`,
                    height: '100%',
                    background: pacingScore > 75 
                      ? 'linear-gradient(90deg, var(--accent-amber), var(--accent-cyan))' 
                      : 'linear-gradient(90deg, var(--accent-coral), var(--accent-amber))',
                    borderRadius: 'var(--m3-shape-full)',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                />
              </div>
            </div>

            {/* Manuscript Telemetry Cards */}
            <div style={{ display: 'flex', gap: '0.5rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1.25rem', flexShrink: 0 }}>
              <div 
                className="m3-card" 
                style={{ 
                  padding: '0.45rem 0.85rem', 
                  textAlign: 'center', 
                  minWidth: '78px', 
                  borderRadius: 'var(--m3-shape-md, 14px)',
                  boxShadow: 'none',
                  background: 'var(--bg-card)'
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {reviewData.stats.wordCount.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.25rem' }}>
                  parole
                </div>
              </div>

              <div 
                className="m3-card" 
                style={{ 
                  padding: '0.45rem 0.85rem', 
                  textAlign: 'center', 
                  minWidth: '78px', 
                  borderRadius: 'var(--m3-shape-md, 14px)',
                  boxShadow: 'none',
                  background: 'var(--bg-card)'
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {reviewData.stats.avgWordsPerSentence || 0}
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.25rem' }}>
                  parole/frase
                </div>
              </div>

              <div 
                className="m3-card" 
                style={{ 
                  padding: '0.45rem 0.85rem', 
                  textAlign: 'center', 
                  minWidth: '78px', 
                  borderRadius: 'var(--m3-shape-md, 14px)',
                  boxShadow: 'none',
                  background: 'var(--bg-card)'
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  ~{reviewData.stats.readingTimeMin}m
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.25rem' }}>
                  lettura
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Filters - 2-Tier Segmented Cluster (No Horizontal Scroll) */}
        <div style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
          <div className="m3-segmented-cluster">
            {[
              { id: 'pacing', label: 'Ritmo & Suspense', icon: Flame },
              { id: 'showDontTell', label: 'Mostra non Raccontare', icon: EyeOff, count: reviewData?.showDontTell?.length },
              { id: 'cliffhangers', label: 'Ganci & Cliffhanger', icon: Zap },
              { id: 'orthography', label: 'Ortografia & Refusi', icon: FileCheck, count: reviewData?.orthography?.length },
              { id: 'book', label: 'Libro intero', icon: BookOpen, count: bookFindingCount }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`m3-segmented-tab ${isActive ? 'm3-segmented-tab-active' : ''}`}
                >
                  <Icon size={14} className="m3-icon-bounce" />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span 
                      style={{ 
                        fontSize: '0.66rem', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: 'var(--m3-shape-full)', 
                        backgroundColor: isActive ? 'var(--accent-cyan-glow)' : 'var(--bg-elevated)',
                        color: isActive ? '#fff' : 'inherit'
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '65%', color: 'var(--text-secondary)' }}>
              <AiCircleLoader 
                message="L'AI sta analizzando il capitolo..." 
                submessage="Valutazione del ritmo, stile narrativo e coerenza con il romanzo"
              />
            </div>
          ) : reviewError ? (
            <div role="alert" style={{ padding: '1rem', color: 'var(--accent-coral)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', lineHeight: 1.5 }}>{reviewError}</p>
              <button onClick={() => runReview(true)} style={{ padding: '0.4rem 0.7rem', color: 'var(--accent-cyan)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius-xs)' }}>Riprova analisi</button>
            </div>
          ) : (
            <>
              {reviewData?.source === 'local' && (
                <p role="status" style={{ margin: '0 0 1rem', padding: '0.65rem 0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.74rem' }}>
                  Analisi locale orientativa: configura un provider AI per ricevere osservazioni basate sul contesto del romanzo.
                </p>
              )}
              {activeTab === 'book' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.35rem', color: 'var(--text-primary)', fontSize: '1rem' }}>Revisione completa: {book?.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                      Ogni capitolo viene letto nel contesto di genere, sinossi, personaggi, trama e ordine narrativo. Le proposte restano facoltative e modificabili.
                    </p>
                  </div>

                  {isReviewingBook && (
                    <div role="status" style={{ padding: '0.85rem', color: 'var(--accent-cyan)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                      <RefreshCw size={14} className="animate-spin" style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
                      Capitolo {bookReviewProgress?.current || 0} di {bookReviewProgress?.total || 0}: {bookReviewProgress?.title || 'preparazione'}
                    </div>
                  )}

                  {bookReviewError && <p role="alert" style={{ margin: 0, color: 'var(--accent-coral)', fontSize: '0.82rem' }}>{bookReviewError}</p>}

                  {!bookReview && !isReviewingBook && !bookReviewError && (
                    <div style={{ padding: '1.2rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                      <p style={{ margin: '0 0 0.8rem', fontSize: '0.84rem' }}>L'analisi non modifica il manoscritto. Potrai aprire ogni passaggio, rivedere la riscrittura e decidere se applicarla.</p>
                      <button onClick={runFullBookReview} style={{ padding: '0.5rem 0.8rem', borderRadius: 'var(--radius-xs)', color: '#1a1612', background: 'var(--accent-cyan)', fontWeight: '700' }}>Avvia analisi completa</button>
                    </div>
                  )}

                  {bookReview?.chapters.map(chapterResult => {
                    if (chapterResult.error) {
                      return (
                        <section key={chapterResult.chapterId} style={{ padding: '0.9rem', borderLeft: '3px solid var(--accent-coral)', background: 'var(--bg-elevated)' }}>
                          <h4 style={{ margin: '0 0 0.35rem', color: 'var(--text-primary)', fontSize: '0.86rem' }}>{chapterResult.title}</h4>
                          <p style={{ margin: 0, color: 'var(--accent-coral)', fontSize: '0.76rem' }}>{chapterResult.error}</p>
                        </section>
                      );
                    }

                    const report = chapterResult.report;
                    const findings = [
                      ...(report.showDontTell || []).map(item => ({ target: item.quote, reason: item.critique, suggestion: item.replacement, category: 'Voce e chiarezza' })),
                      ...(report.craft || []).map(item => ({ target: item.quote, reason: item.critique, suggestion: item.suggestion, category: item.category || 'Tecnica narrativa' })),
                      ...(report.rhythm || []).map(item => ({ target: item.quote, reason: item.critique, suggestion: item.suggestion, category: 'Ritmo' })),
                      ...(report.orthography || []).map(item => ({ target: item.original, reason: item.explanation, suggestion: item.fix, category: 'Ortografia' })),
                      ...(report.temporalCoherence || []).map(item => ({ target: item.passage, reason: item.note, suggestion: `Verifica la coerenza dei tempi: ${item.expectedTense || 'tempo narrativo'}.`, category: 'Continuita' }))
                    ].filter(item => item.target && String(item.target).trim());

                    return (
                      <section key={chapterResult.chapterId} style={{ paddingTop: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.55rem' }}>
                          <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{chapterResult.title}</h4>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                            {chapterResult.cached ? 'Risultato riutilizzato dalla cache' : `${findings.length} proposte`}
                          </span>
                        </div>
                        {findings.length === 0 ? (
                          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.76rem' }}>Nessun intervento puntuale rilevato.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {findings.map((finding, index) => {
                              const fixKey = `${chapterResult.chapterId}:${finding.target}`;
                              const isDone = appliedFixes.has(fixKey);
                              return (
                                <article key={`${fixKey}-${index}`} style={{ padding: '0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
                                  <div style={{ marginBottom: '0.3rem', color: 'var(--accent-amber)', fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase' }}>{finding.category}</div>
                                  <p style={{ margin: '0 0 0.35rem', color: 'var(--text-primary)', fontSize: '0.78rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{finding.target}</p>
                                  <p style={{ margin: '0 0 0.55rem', color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.45 }}>{finding.reason}</p>
                                  <button
                                    onClick={() => openRewriteReview(finding.target, finding.reason, finding.suggestion, chapterResult.chapterId)}
                                    disabled={isDone}
                                    style={{ padding: '0.35rem 0.6rem', color: isDone ? 'var(--text-muted)' : 'var(--accent-cyan)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', fontWeight: '700' }}
                                  >
                                    {isDone ? 'Applicata' : 'Rivedi proposta'}
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}

              {/* TAB 1: RITMO & SUSPENSE */}
              {activeTab === 'pacing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Pacing Critique Card */}
                  <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Flame size={16} style={{ color: 'var(--accent-coral)' }} />
                      Valutazione del Respiro Narrativo
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                      {reviewData?.pacingReview?.pacingCritique || reviewData?.summary || 'Nessuna criticità di rilievo.'}
                    </p>
                  </div>

                  {/* Overlong sentences warning */}
                  {reviewData?.rhythm && reviewData.rhythm.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--accent-coral)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Frasi troppo estese che rallentano la suspense ({reviewData.rhythm.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {reviewData.rhythm.map((r, i) => {
                          const isDone = appliedFixes.has(`${chapter.id}:${r.quote}`) || appliedFixes.has(r.quote.trim());
                          return (
                            <div 
                              key={i}
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: `1px solid ${isDone ? 'var(--accent-green, #7da87b)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-sm)',
                                padding: '1rem',
                                transition: 'border-color 0.25s ease'
                              }}
                            >
                              <p style={{ fontSize: '0.84rem', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', fontStyle: 'italic', marginBottom: '0.4rem', textDecoration: isDone ? 'line-through' : 'none' }}>
                                "{r.quote}"
                              </p>
                              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 0.6rem 0' }}>
                                {r.critique}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', backgroundColor: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)' }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: '500' }}>
                                  💡 {r.suggestion}
                                </span>
                                <button
                                  onClick={() => openRewriteReview(r.quote, r.critique, r.suggestion)}
                                  disabled={isDone}
                                  className={isDone ? 'm3-btn' : 'm3-btn m3-btn-filled'}
                                  style={{
                                    padding: '0.35rem 0.8rem',
                                    fontSize: '0.74rem',
                                    fontWeight: '700',
                                    borderRadius: 'var(--radius-xs)',
                                    background: isDone ? 'rgba(125, 168, 123, 0.18)' : 'var(--accent-cyan)',
                                    color: isDone ? 'var(--accent-green, #7da87b)' : '#1a1612',
                                    border: isDone ? '1px solid var(--accent-green, #7da87b)' : 'none',
                                    cursor: isDone ? 'default' : 'pointer'
                                  }}
                                >
                                  {isDone ? (
                                    <>
                                      <Check size={13} /> Applicato al capitolo
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={13} /> Rivedi e confronta
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stylistic notes */}
                  {reviewData?.stylisticNotes && reviewData.stylisticNotes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Spunti & Consigli dell'Editor
                      </h4>
                      {reviewData.stylisticNotes.map((sn, idx) => (
                        <div key={idx} style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.9rem', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontWeight: '600', fontSize: '0.82rem', color: 'var(--accent-cyan)', display: 'block', marginBottom: '0.25rem' }}>
                            {sn.title}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {sn.note}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SHOW DON'T TELL */}
              {activeTab === 'showDontTell' && (
                <div>
                  <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', borderLeft: '3px solid var(--accent-amber)' }}>
                    <h4 style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--accent-amber)', marginBottom: '0.3rem' }}>
                      Scelte di voce e punto di vista
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Un verbo filtro non e' automaticamente un errore: conta l'effetto nella scena, il punto di vista e la voce del personaggio. Le proposte sono spunti da valutare, non regole da applicare sempre.
                    </p>
                  </div>

                  {(!reviewData?.showDontTell || reviewData.showDontTell.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem auto', color: 'var(--accent-green)' }} />
                      <p>Nessun verbo filtro rilevato! La narrazione è diretta e sensoriale.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {reviewData.showDontTell.map((sdt, idx) => {
                        const isDone = appliedFixes.has(`${chapter.id}:${sdt.quote}`) || appliedFixes.has(sdt.quote.trim());
                        return (
                          <div 
                            key={idx}
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              border: `1px solid ${isDone ? 'var(--accent-green, #7da87b)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-sm)',
                              padding: '1.1rem',
                              transition: 'border-color 0.25s ease'
                            }}
                          >
                            <div style={{ fontSize: '0.84rem', color: isDone ? 'var(--text-muted)' : 'var(--accent-coral)', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)', textDecoration: isDone ? 'line-through' : 'none' }}>
                              "{sdt.quote}"
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 0.6rem 0' }}>
                              {sdt.critique}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem', backgroundColor: 'var(--bg-primary)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-xs)' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                                <strong>In alternativa:</strong> {sdt.replacement}
                              </span>
                              <button
                                onClick={() => openRewriteReview(sdt.quote, sdt.critique, sdt.replacement)}
                                disabled={isDone}
                                className={isDone ? 'm3-btn' : 'm3-btn m3-btn-filled'}
                                style={{
                                  padding: '0.35rem 0.8rem',
                                  fontSize: '0.74rem',
                                  fontWeight: '700',
                                  borderRadius: 'var(--radius-xs)',
                                  background: isDone ? 'rgba(125, 168, 123, 0.18)' : 'var(--accent-cyan)',
                                  color: isDone ? 'var(--accent-green, #7da87b)' : '#1a1612',
                                  border: isDone ? '1px solid var(--accent-green, #7da87b)' : 'none',
                                  cursor: isDone ? 'default' : 'pointer'
                                }}
                              >
                                {isDone ? (
                                  <>
                                    <Check size={13} /> Applicato al capitolo
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={13} /> Rivedi e confronta
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CLIFFHANGER GENERATOR */}
              {activeTab === 'cliffhangers' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Generatore di Cliffhanger & Ganci Finali
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        Genera finali shock per il capitolo ispirati alle tecniche di suspense e cliffhanger ad alta tensione.
                      </p>
                    </div>

                    <button
                      onClick={handleFetchCliffhangers}
                      disabled={loadingCliffhangers}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--accent-cyan)',
                        color: '#1a1612',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 2px 10px var(--accent-cyan-dim)'
                      }}
                    >
                      <Sparkles size={14} className={loadingCliffhangers ? 'animate-spin' : ''} />
                      <span>{loadingCliffhangers ? 'Generando...' : 'Genera 3 Cliffhanger'}</span>
                    </button>
                  </div>

                  {cliffhangers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                      <Zap size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                      <p>Clicca sul pulsante sopra per far ideare all'AI tre opzioni di chiusura adrenalinica per questo capitolo.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {cliffhangers.map((ch, idx) => (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1.2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.65rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span 
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: 'var(--accent-cyan-dim)',
                                color: 'var(--accent-cyan)'
                              }}
                            >
                              {ch.type}
                            </span>

                            <button
                              onClick={() => handleAppend(ch.text)}
                              style={{
                                padding: '0.3rem 0.75rem',
                                backgroundColor: 'var(--bg-primary)',
                                border: '1px solid var(--accent-cyan)',
                                color: 'var(--accent-cyan)',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              <Plus size={12} /> Inserisci a fine capitolo
                            </button>
                          </div>

                          <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontStyle: 'italic', fontFamily: 'var(--font-serif)', lineHeight: 1.55 }}>
                            "{ch.text}"
                          </div>

                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            <strong>Perché funziona:</strong> {ch.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ORTHOGRAPHY & TYPOS */}
              {activeTab === 'orthography' && (
                <div>
                  {(!reviewData?.orthography || reviewData.orthography.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem auto', color: 'var(--accent-green)' }} />
                      <p>Nessun refuso ortografico individuato! La prosa è pulita.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      {reviewData.orthography.map((item, idx) => {
                        const isDone = appliedFixes.has(`${chapter.id}:${item.original}`);
                        return (
                          <div 
                            key={idx}
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '1rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '1rem'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                                <span style={{ textDecoration: 'line-through', color: 'var(--accent-coral)', fontSize: '0.85rem' }}>
                                  {item.original}
                                </span>
                                <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--accent-cyan)', fontWeight: '600', fontSize: '0.88rem' }}>
                                  {item.fix}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {item.explanation}
                              </span>
                            </div>

                            <button
                              onClick={() => openRewriteReview(item.original, item.explanation, item.fix)}
                              disabled={isDone}
                              style={{
                                padding: '0.35rem 0.8rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: isDone ? 'var(--bg-primary)' : 'var(--accent-cyan-dim)',
                                color: isDone ? 'var(--text-muted)' : 'var(--accent-cyan)',
                                border: `1px solid ${isDone ? 'var(--border-subtle)' : 'var(--accent-cyan)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}
                            >
                              {isDone ? (
                                <>
                                  <Check size={13} /> Applicato
                                </>
                              ) : (
                                <>Rivedi</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {rewriteReview && (
        <div
          role="presentation"
          onClick={() => setRewriteReview(null)}
          className="m3-modal-backdrop"
          style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 330, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '1.25rem', 
            background: 'rgba(10, 8, 6, 0.85)', 
            backdropFilter: 'blur(10px)' 
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="chapter-rewrite-title"
            onClick={event => event.stopPropagation()}
            className="glass-panel m3-dialog-panel"
            style={{ 
              width: 'min(920px, 96vw)', 
              maxHeight: '90vh', 
              overflowY: 'auto', 
              padding: '1.75rem', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-subtle)', 
              borderRadius: 'var(--m3-shape-xl, 28px)', 
              boxShadow: '0 28px 70px rgba(0, 0, 0, 0.85)' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div className="m3-dialog-icon-box">
                  <Sparkles size={20} className="m3-icon-bounce" />
                </div>
                <div>
                  <h2 id="chapter-rewrite-title" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: '700' }}>
                    Rivedi e Confronta la Proposta
                  </h2>
                  {rewriteReview.reason && (
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {rewriteReview.reason}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setRewriteReview(null)} 
                className="m3-dialog-close-btn"
                aria-label="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            {/* Visual Word-Diff Preview */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Evidenziazione Differenze (Parole Modificate)
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--accent-coral)', textDecoration: 'line-through', marginRight: '8px' }}>Rosso = rimosso</span>
                  <span style={{ color: 'var(--accent-green, #7da87b)', fontWeight: '600' }}>Verde = inserito</span>
                </span>
              </div>
              {rewriteReview.loading ? (
                <div style={{ padding: '1.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--accent-cyan)' }}>
                  <AiCircleLoader
                    compact={true}
                    size={32}
                    message="L'AI sta riscrivendo la frase in prosa narrativa..."
                    submessage="Applicazione delle correzioni stilistiche ed editoriali"
                  />
                </div>
              ) : (
                <DiffViewer original={rewriteReview.original} modified={rewriteReview.improved} />
              )}
            </div>

            {/* Side-by-side or stacked editors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: '700' }}>
                Originale nel capitolo
                <textarea 
                  value={rewriteReview.original} 
                  readOnly 
                  rows={5} 
                  style={{ width: '100%', resize: 'vertical', padding: '0.75rem', lineHeight: 1.6, color: 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-serif)', fontSize: '0.9rem' }} 
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', color: 'var(--accent-cyan)', fontSize: '0.78rem', fontWeight: '700' }}>
                Proposta AI (modificabile prima di applicare)
                <textarea 
                  value={rewriteReview.loading ? 'Generazione della riscrittura in corso...' : rewriteReview.improved} 
                  disabled={rewriteReview.loading}
                  onChange={event => setRewriteReview(current => ({ ...current, improved: event.target.value }))} 
                  rows={5} 
                  style={{ width: '100%', resize: 'vertical', padding: '0.75rem', lineHeight: 1.6, color: rewriteReview.loading ? 'var(--text-muted)' : 'var(--text-primary)', background: 'var(--bg-primary)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-serif)', fontSize: '0.9rem' }} 
                />
              </label>
            </div>
            
            {rewriteReview.explanation && (
              <p style={{ marginTop: '0.8rem', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5, background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-amber)' }}>
                <strong>Spiegazione editoriale:</strong> {rewriteReview.explanation}
              </p>
            )}
            
            {rewriteReview.error && <p role="alert" style={{ color: 'var(--accent-coral)', fontSize: '0.8rem', marginTop: '0.8rem' }}>{rewriteReview.error}</p>}
            {rewriteReview.fallback && <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Nessun provider AI configurato: proposta generata localmente.</p>}
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.9rem' }}>
              <div>
                <button
                  type="button"
                  onClick={requestAiAlternative}
                  disabled={rewriteReview.loading}
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
                  <span>{rewriteReview.loading ? 'Generando variante...' : 'Altra variante AI'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <button 
                  onClick={() => setRewriteReview(null)} 
                  className="m3-btn m3-btn-outlined"
                  style={{ padding: '0.45rem 0.85rem', color: 'var(--text-secondary)' }}
                >
                  Annulla
                </button>
                <button 
                  onClick={applyRewriteReview} 
                  disabled={rewriteReview.loading || !rewriteReview.improved.trim() || rewriteReview.improved === rewriteReview.original} 
                  className="m3-btn m3-btn-filled"
                  style={{ 
                    padding: '0.5rem 1.1rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    fontWeight: '700',
                    opacity: (rewriteReview.loading || !rewriteReview.improved.trim() || rewriteReview.improved === rewriteReview.original) ? 0.5 : 1 
                  }}
                >
                  <Check size={15} /> Applica al testo
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
