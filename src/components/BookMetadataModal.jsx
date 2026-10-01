import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookMarked, 
  Target, 
  User, 
  Sparkles, 
  Calendar, 
  Layers, 
  Check, 
  FileText,
  Palette,
  Lock,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  Tag,
  Feather
} from 'lucide-react';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { suggestBookMetadata } from '../utils/aiService';

const GENRES = [
  'Thriller / Suspense',
  'Giallo / Noir / Poliziesco',
  'Fantascienza (Sci-Fi) / Distopico',
  'Fantasy / High Fantasy',
  'Romanzo Storico',
  'Narrativa Contemporanea',
  'Horror / Gotico / Psicologico',
  'Romance / Drammatico',
  'Avventura / Azione',
  'Saggistica / Memorie'
];

export default function BookMetadataModal({
  isOpen,
  onClose,
  book,
  onUpdateBook,
  settings = {}
}) {
  const duration = settings.animationDurationMs || 280;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, duration);

  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'synopsis' | 'ai'
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    author: '',
    genre: 'Thriller / Suspense',
    targetWords: 60000,
    synopsis: '',
    styleNotes: '',
    coverColor: '#d35400'
  });

  // AI Suggestions state
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [appliedFeedback, setAppliedFeedback] = useState('');

  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || '',
        subtitle: book.subtitle || '',
        author: book.author || 'Autore Indipendente',
        genre: book.genre || 'Thriller / Suspense',
        targetWords: book.targetWords || 60000,
        synopsis: book.synopsis || book.bible?.synopsis || '',
        styleNotes: book.styleNotes || '',
        coverColor: book.coverColor || '#d35400'
      });
    }
  }, [book, isOpen]);

  if (!shouldRender) return null;

  // Calculate total words in manuscript
  const totalWords = (book?.chapters || []).reduce((acc, c) => {
    return acc + (c.content ? c.content.trim().split(/\s+/).filter(Boolean).length : 0);
  }, 0);

  const minWordsForAi = 150;
  const hasEnoughWordsForAi = totalWords >= minWordsForAi;
  const aiProgressPercent = Math.min(100, Math.round((totalWords / minWordsForAi) * 100));
  const progressPercent = Math.min(100, Math.round((totalWords / Math.max(1000, formData.targetWords || 60000)) * 100));

  const handleGenerateAi = async () => {
    if (!hasEnoughWordsForAi) return;
    setIsGeneratingAi(true);
    setAppliedFeedback('');
    try {
      const res = await suggestBookMetadata({ book, settings });
      if (res.success) {
        setAiSuggestions(res);
      } else {
        alert(res.message || 'Scrivi ancora un po\' di testo per consentire all\'AI di comprendere la trama.');
      }
    } catch (err) {
      console.error('AI generation error:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleApplySingle = (field, value, label) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setAppliedFeedback(`✓ ${label} applicato!`);
    setTimeout(() => setAppliedFeedback(''), 3000);
  };

  const handleApplyAllAi = () => {
    if (!aiSuggestions) return;
    setFormData(prev => ({
      ...prev,
      title: aiSuggestions.titles?.[0]?.title || prev.title,
      subtitle: aiSuggestions.tagline || prev.subtitle,
      synopsis: aiSuggestions.synopsis || prev.synopsis,
      genre: aiSuggestions.suggestedGenre || prev.genre,
      styleNotes: aiSuggestions.styleNotes || prev.styleNotes
    }));
    setAppliedFeedback('✨ Tutti i suggerimenti AI sono stati applicati alla scheda!');
    setTimeout(() => setAppliedFeedback(''), 4000);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    onUpdateBook({
      ...formData,
      updatedAt: new Date().toISOString()
    });
    onClose();
  };

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
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={onClose}
    >
      <div 
        className={`glass-panel m3-dialog-panel ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '760px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--m3-shape-dialog, 24px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header with Icon Bounce */}
        <div 
          style={{
            padding: '1.25rem 2rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--m3-shape-card, 16px)',
                backgroundColor: 'var(--accent-cyan-dim)',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--accent-cyan-glow)'
              }}
            >
              <BookMarked size={22} className="m3-icon-bounce" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Scheda Editoriale del Romanzo
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Metadati narrativi, sinossi d'autore e suggerimenti dell'AI Companion.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="m3-btn-text"
            title="Chiudi scheda (Esc)"
            style={{ borderRadius: '50%', width: '38px', height: '38px', padding: 0 }}
          >
            <X size={20} className="m3-icon-bounce" />
          </button>
        </div>

        {/* Tab Navigation with Liquid Pill Indicator */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
          {[
            { id: 'main', label: 'Dati & Metriche', icon: Layers },
            { id: 'synopsis', label: 'Sinossi & Voce Narrativa', icon: FileText },
            { 
              id: 'ai', 
              label: hasEnoughWordsForAi ? 'Suggerimenti AI (Sbloccato)' : `Suggerimenti AI (${totalWords}/${minWordsForAi})`, 
              icon: Sparkles,
              isHighlight: hasEnoughWordsForAi
            }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? 'var(--accent-cyan)' : tab.isHighlight ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: `2.5px solid ${isActive ? 'var(--accent-cyan)' : 'transparent'}`,
                  backgroundColor: isActive ? 'var(--accent-cyan-dim)' : 'transparent',
                  transition: 'all var(--anim-duration, 280ms) var(--anim-easing)'
                }}
              >
                <Icon size={15} className="m3-icon-bounce" style={{ color: tab.isHighlight ? 'var(--accent-cyan)' : 'inherit' }} />
                <span>{tab.label}</span>
                {tab.id === 'ai' && !hasEnoughWordsForAi && (
                  <Lock size={12} style={{ opacity: 0.6 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {appliedFeedback && (
            <div 
              className="animate-fade-in"
              style={{
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(74, 222, 128, 0.15)',
                border: '1px solid #4ade80',
                color: '#4ade80',
                fontSize: '0.82rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Check size={16} />
              <span>{appliedFeedback}</span>
            </div>
          )}

          {/* TAB 1: MAIN METADATA & GOAL */}
          {activeTab === 'main' && (
            <div key="main" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Manuscript Word Goal Banner */}
              <div 
                style={{ 
                  padding: '1.1rem 1.35rem', 
                  backgroundColor: 'var(--bg-elevated)', 
                  borderRadius: 'var(--m3-shape-card, 16px)', 
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    <Target size={16} style={{ color: 'var(--accent-cyan)' }} />
                    Avanzamento Stesura del Romanzo
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                    {totalWords.toLocaleString()} / {(formData.targetWords || 60000).toLocaleString()} parole ({progressPercent}%)
                  </span>
                </div>

                {/* Progress bar track */}
                <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${progressPercent}%`, 
                      height: '100%', 
                      backgroundColor: 'var(--accent-cyan)', 
                      borderRadius: '9999px',
                      transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }} 
                  />
                </div>
              </div>

              {/* Title & Author */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                    Titolo del Romanzo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="es. Il Segreto della Cripta"
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      fontSize: '0.96rem',
                      fontWeight: '700',
                      fontFamily: 'var(--font-serif)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                    Autore / Pseudonimo
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    placeholder="Nome dell'autore"
                    style={{
                      width: '100%',
                      padding: '0.7rem 0.9rem',
                      fontSize: '0.88rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              {/* Tagline / Subtitle */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.45rem' }}>
                  Sottotitolo o Tagline di Copertina
                </label>
                <input
                  type="text"
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder="es. Una cospirazione millenaria. Un codice che nessuno avrebbe dovuto decifrare."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.9rem',
                    fontSize: '0.86rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {/* Genre & Target Words */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                    Genere Letterario Principale
                  </label>
                  <select
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.86rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {GENRES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                    Obiettivo Finale Parole
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="500000"
                    step="1000"
                    value={formData.targetWords}
                    onChange={(e) => setFormData({ ...formData, targetWords: parseInt(e.target.value) || 60000 })}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.9rem',
                      fontSize: '0.88rem',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SYNOPSIS & STYLE NOTES */}
          {activeTab === 'synopsis' && (
            <div key="synopsis" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                  Sinossi / Premessa & Conflitto Centrale del Romanzo
                </label>
                <textarea
                  rows={6}
                  value={formData.synopsis}
                  onChange={(e) => setFormData({ ...formData, synopsis: e.target.value })}
                  placeholder="Di cosa parla il romanzo? Qual è la situazione iniziale, quale evento rompe l'equilibrio, e qual è il dilemma morale o la minaccia che il protagonista affronta?"
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    fontSize: '0.86rem',
                    lineHeight: 1.6,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                  Note di Stile & Voce Narrativa (Guida per l'AI Companion)
                </label>
                <textarea
                  rows={4}
                  value={formData.styleNotes}
                  onChange={(e) => setFormData({ ...formData, styleNotes: e.target.value })}
                  placeholder="es. Terza persona limitata, ritmo incalzante da thriller contemporaneo, dialoghi serrati e asciutti, ricchezza di dettagli sensoriali nei momenti di tensione..."
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    fontSize: '0.84rem',
                    lineHeight: 1.5,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 3: AI NOVEL ASSISTANT (STRICT WORD THRESHOLD) */}
          {activeTab === 'ai' && (
            <div key="ai" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {!hasEnoughWordsForAi ? (
                /* LOCKED CARD: Insufficient Words */
                <div 
                  style={{
                    padding: '1.75rem 2rem',
                    backgroundColor: 'var(--bg-elevated)',
                    borderRadius: 'var(--m3-shape-card, 20px)',
                    border: '1.5px dashed var(--border-subtle)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div 
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(229, 169, 83, 0.12)',
                      color: 'var(--accent-amber)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(229, 169, 83, 0.3)'
                    }}
                  >
                    <Lock size={24} className="m3-icon-bounce" />
                  </div>

                  <div style={{ maxWidth: '480px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                      L'AI ha bisogno di leggere la tua storia per suggerirti titoli e sinossi
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                      Per generare proposte coerenti, magnetiche e su misura per la tua voce, l'AI deve poter comprendere personaggi, atmosfera e trama dai capitoli che scrivi.
                    </p>
                  </div>

                  {/* Words threshold progress */}
                  <div style={{ width: '100%', maxWidth: '360px', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Parole scritte nel manoscritto</span>
                      <span style={{ fontWeight: '700', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                        {totalWords} / {minWordsForAi} parole ({aiProgressPercent}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${aiProgressPercent}%`, 
                          height: '100%', 
                          backgroundColor: 'var(--accent-cyan)', 
                          borderRadius: '9999px',
                          transition: 'width 0.4s ease'
                        }} 
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                    ✍️ Scrivi ancora {Math.max(0, minWordsForAi - totalWords)} parole nel tuo capitolo per sbloccare l'analisi automatica della storia.
                  </p>
                </div>
              ) : (
                /* UNLOCKED CARD: Generate Suggestions */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Action Banner */}
                  <div 
                    style={{
                      padding: '1.25rem 1.5rem',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 'var(--m3-shape-card, 16px)',
                      border: '1px solid var(--accent-cyan-glow)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
                        <span>Manoscritto Pronto per l'Analisi AI ({totalWords} parole scritte)</span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                        L'AI estrarrà i personaggi, i conflitti e l'atmosfera per consigliarti 3 titoli, la tagline, la sinossi e il genere ideale.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAi}
                      disabled={isGeneratingAi}
                      className="m3-btn m3-btn-filled"
                      style={{ padding: '0.55rem 1.15rem' }}
                    >
                      <RefreshCw size={15} className={`m3-icon-bounce ${isGeneratingAi ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingAi ? 'Analisi in corso...' : aiSuggestions ? 'Rigenera Idee' : 'Genera Suggerimenti con AI'}</span>
                    </button>
                  </div>

                  {/* AI Generated Content Cards */}
                  {aiSuggestions && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      
                      {/* Master Apply All */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={handleApplyAllAi}
                          className="m3-chip"
                          style={{
                            padding: '0.45rem 1rem',
                            backgroundColor: 'var(--accent-cyan-dim)',
                            color: 'var(--accent-cyan)',
                            border: '1.5px solid var(--accent-cyan)',
                            fontSize: '0.8rem',
                            fontWeight: '700'
                          }}
                        >
                          <Sparkles size={14} className="m3-icon-bounce" />
                          <span>Applica Tutti i Suggerimenti alla Scheda</span>
                        </button>
                      </div>

                      {/* 1. Title Proposals */}
                      <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                          <Tag size={15} style={{ color: 'var(--accent-cyan)' }} />
                          <span>3 Proposte di Titolo per il tuo Romanzo</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {aiSuggestions.titles.map((t, idx) => (
                            <div 
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.75rem 1rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-primary)',
                                border: '1px solid var(--border-subtle)'
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  <span style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                                    «{t.title}»
                                  </span>
                                  <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                                    {t.style}
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                                  {t.reason}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplySingle('title', t.title, 'Titolo')}
                                className="m3-btn m3-btn-tonal"
                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                              >
                                Usa Titolo
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 2. Tagline Proposal */}
                      <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                            <Lightbulb size={15} style={{ color: 'var(--accent-amber)' }} />
                            <span>Tagline di Copertina Suggerita</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplySingle('subtitle', aiSuggestions.tagline, 'Tagline')}
                            className="m3-btn m3-btn-tonal"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.74rem' }}
                          >
                            Usa come Tagline
                          </button>
                        </div>
                        <p style={{ fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--text-primary)', margin: 0, padding: '0.75rem 1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-xs)' }}>
                          "{aiSuggestions.tagline}"
                        </p>
                      </div>

                      {/* 3. Synopsis Proposal */}
                      <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                            <Feather size={15} style={{ color: 'var(--accent-cyan)' }} />
                            <span>Sinossi / Premessa Narrativa</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplySingle('synopsis', aiSuggestions.synopsis, 'Sinossi')}
                            className="m3-btn m3-btn-tonal"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.74rem' }}
                          >
                            Usa come Sinossi
                          </button>
                        </div>
                        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line', padding: '0.85rem 1rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-xs)' }}>
                          {aiSuggestions.synopsis}
                        </div>
                      </div>

                      {/* 4. Genre & Style Guidance */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)' }}>Genere Suggerito</span>
                            <button
                              type="button"
                              onClick={() => handleApplySingle('genre', aiSuggestions.suggestedGenre, 'Genere')}
                              className="m3-chip"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}
                            >
                              Imposta
                            </button>
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                            {aiSuggestions.suggestedGenre}
                          </div>
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)' }}>Note di Stile</span>
                            <button
                              type="button"
                              onClick={() => handleApplySingle('styleNotes', aiSuggestions.styleNotes, 'Note di stile')}
                              className="m3-chip"
                              style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}
                            >
                              Imposta
                            </button>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {aiSuggestions.styleNotes}
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={onClose}
              className="m3-btn m3-btn-text"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="m3-btn m3-btn-filled"
            >
              <Check size={16} className="m3-icon-bounce" />
              <span>Salva Modifiche</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
