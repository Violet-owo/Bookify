import React, { useEffect, useState, useCallback } from 'react';
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
  Sparkles
} from 'lucide-react';
import { reviewChapterContent, generateCliffhangerIdeas } from '../utils/aiService';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';

export default function ChapterReviewModal({
  isOpen,
  onClose,
  chapter,
  settings,
  onApplyFix,
  onAppendCliffhanger
}) {
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, 280);
  const [loading, setLoading] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [activeTab, setActiveTab] = useState('pacing'); // 'pacing' | 'showDontTell' | 'rhythm' | 'orthography' | 'cliffhangers'
  const [appliedFixes, setAppliedFixes] = useState(new Set());
  
  // Dedicated cliffhangers state
  const [cliffhangers, setCliffhangers] = useState([]);
  const [loadingCliffhangers, setLoadingCliffhangers] = useState(false);

  const runReview = useCallback(async () => {
    if (!chapter) return;
    setLoading(true);
    try {
      const data = await reviewChapterContent({
        chapterText: chapter.content || '',
        chapterTitle: chapter.title || 'Capitolo',
        settings
      });
      setReviewData(data);
    } catch (err) {
      console.error('Failed to review chapter', err);
    } finally {
      setLoading(false);
    }
  }, [chapter, settings]);

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

  useEffect(() => {
    if (isOpen && chapter) {
      runReview();
    }
  }, [isOpen, chapter?.id, runReview]);

  if (!shouldRender || !chapter) return null;

  const handleFix = (orig, fix) => {
    if (onApplyFix) {
      onApplyFix(orig, fix);
      setAppliedFixes(prev => new Set([...prev, orig]));
    }
  };

  const handleAppend = (text) => {
    if (onAppendCliffhanger) {
      onAppendCliffhanger(text);
      alert('Cliffhanger accodato alla fine del capitolo!');
    }
  };

  const pacingScore = reviewData?.pacingScore || 80;

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
        {/* Top Header */}
        <div 
          style={{
            padding: '1.4rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, var(--bg-elevated) 0%, rgba(229, 169, 83, 0.08) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--accent-cyan-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                Stanza dell'Editor (Ritmo & Suspense)
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {chapter.title} • Analisi della tensione e del ritmo narrativo
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={runReview}
              disabled={loading}
              title="Ricalcola analisi editoriale"
              style={{
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem'
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Rianalizza</span>
            </button>
            <button onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '0.35rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Pacing Score & Vital Stats Strip */}
        {reviewData?.stats && (
          <div 
            style={{
              padding: '1rem 1.75rem',
              backgroundColor: 'var(--bg-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}
          >
            {/* Pacing Gauge */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Flame size={14} style={{ color: 'var(--accent-coral)' }} />
                  Indice di Tensione Narrativa:
                </span>
                <span style={{ fontSize: '0.86rem', fontWeight: '700', color: pacingScore > 75 ? 'var(--accent-cyan)' : 'var(--accent-coral)' }}>
                  {pacingScore}/100 ({reviewData.pacingReview?.tensionLevel || 'Buona'})
                </span>
              </div>
              <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{
                    width: `${pacingScore}%`,
                    height: '100%',
                    background: pacingScore > 75 
                      ? 'linear-gradient(90deg, var(--accent-amber), var(--accent-cyan))' 
                      : 'linear-gradient(90deg, var(--accent-coral), var(--accent-amber))',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'flex', gap: '1rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {reviewData.stats.wordCount}
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>parole</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {reviewData.stats.avgWordsPerSentence || 0}
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>parole/frase</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  ~{reviewData.stats.readingTimeMin} min
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>lettura</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Filters */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
          {[
            { id: 'pacing', label: 'Ritmo & Suspense', icon: Flame },
            { id: 'showDontTell', label: 'Mostra non Raccontare', icon: EyeOff, count: reviewData?.showDontTell?.length },
            { id: 'cliffhangers', label: 'Ganci & Cliffhanger', icon: Zap },
            { id: 'orthography', label: 'Ortografia & Refusi', icon: FileCheck, count: reviewData?.orthography?.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '0.75rem 0.5rem',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  borderBottom: `2px solid ${isActive ? 'var(--accent-cyan)' : 'transparent'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span style={{ fontSize: '0.66rem', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-elevated)' }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.88rem' }}>L'Editor sta analizzando il capitolo con i canoni del thriller bestseller...</p>
            </div>
          ) : (
            <>
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
                        {reviewData.rhythm.map((r, i) => (
                          <div 
                            key={i}
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '1rem'
                            }}
                          >
                            <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontStyle: 'italic', marginBottom: '0.4rem' }}>
                              "{r.quote}"
                            </p>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 0.4rem 0' }}>
                              {r.critique}
                            </p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', margin: 0, fontWeight: '500' }}>
                              💡 Suggerimento: {r.suggestion}
                            </p>
                          </div>
                        ))}
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
                      La Regola Aurea: Mostra, non Raccontare
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      I verbi filtro (es. <em>vide che, sentì che, sembrava, notò</em>) creano una barriera invisibile tra il lettore e l'azione. 
                      Rimpiazzali con reazioni corporee o dettagli visivi diretti.
                    </p>
                  </div>

                  {(!reviewData?.showDontTell || reviewData.showDontTell.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 0.75rem auto', color: 'var(--accent-green)' }} />
                      <p>Nessun verbo filtro rilevato! La narrazione è diretta e sensoriale.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {reviewData.showDontTell.map((sdt, idx) => (
                        <div 
                          key={idx}
                          style={{
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '1.1rem'
                          }}
                        >
                          <div style={{ fontSize: '0.84rem', color: 'var(--accent-coral)', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)' }}>
                            "{sdt.quote}"
                          </div>
                          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                            {sdt.critique}
                          </p>
                          <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', backgroundColor: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-xs)' }}>
                            <strong>In alternativa:</strong> {sdt.replacement}
                          </div>
                        </div>
                      ))}
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
                        const isDone = appliedFixes.has(item.original);
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
                              onClick={() => handleFix(item.original, item.fix)}
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
                                <>Applica</>
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
    </div>
  );
}
