import React, { useState } from 'react';
import { 
  X, 
  Users, 
  GitBranch, 
  Compass, 
  Plus, 
  Trash2, 
  FileText, 
  BookOpen,
  Sparkles
} from 'lucide-react';
import { extractBibleEntities } from '../utils/bibleCompanion';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';

export default function NovelBibleModal({
  isOpen,
  onClose,
  book,
  settings,
  onUpdateBible
}) {
  const animDuration = settings?.enableAnimations !== false
    ? Number(settings?.animationDurationMs) || 280
    : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, animDuration);
  const [activeTab, setActiveTab] = useState('characters'); // 'characters' | 'plot' | 'world' | 'synopsis'
  const bible = book?.bible || { synopsis: '', characters: [], plotNotes: [], worldNotes: '' };

  const [synopsis, setSynopsis] = useState(bible.synopsis || '');
  const [worldNotes, setWorldNotes] = useState(bible.worldNotes || '');
  const [characters, setCharacters] = useState(bible.characters || []);
  const [plotNotes, setPlotNotes] = useState(bible.plotNotes || []);
  const [isScanningBible, setIsScanningBible] = useState(false);

  if (!shouldRender) return null;

  const handleAutoScanAllChapters = async () => {
    setIsScanningBible(true);
    try {
      let mergedBible = {
        synopsis,
        worldNotes,
        characters,
        plotNotes
      };
      let totalFound = 0;

      for (const chap of (book.chapters || [])) {
        if (!chap.content || chap.content.trim().length < 25) continue;
        const res = await extractBibleEntities({
          chapterTitle: chap.title || 'Capitolo',
          chapterContent: chap.content,
          currentBible: mergedBible,
          settings: settings || {}
        });
        mergedBible = res.updatedBible;
        totalFound += res.newlyDiscoveredCount;
      }

      setCharacters(mergedBible.characters || []);
      setPlotNotes(mergedBible.plotNotes || []);
      setWorldNotes(mergedBible.worldNotes || '');
      onUpdateBible(mergedBible);

      if (totalFound > 0) {
        alert(`✨ Bibbia aggiornata con successo! L'AI Companion ha estratto ${totalFound} nuove entità (personaggi, luoghi o snodi) direttamente dai tuoi capitoli.`);
      } else {
        alert('Tutte le entità del manoscritto sono già catalogate nella Bibbia.');
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsScanningBible(false);
    }
  };

  const handleSave = () => {
    onUpdateBible({
      synopsis,
      worldNotes,
      characters,
      plotNotes
    });
  };

  const handleAddCharacter = () => {
    const newChar = {
      id: `char-${Date.now()}`,
      name: 'Nuovo Personaggio',
      role: 'Ruolo / Archetipo',
      goal: 'Obiettivo principale nella storia',
      flaw: 'Punto debole o segreto inconfessabile',
      notes: 'Caratteristiche fisiche, voce, modo di parlare...'
    };
    const updated = [...characters, newChar];
    setCharacters(updated);
    onUpdateBible({ ...bible, characters: updated });
  };

  const handleUpdateChar = (id, field, value) => {
    const updated = characters.map(c => c.id === id ? { ...c, [field]: value } : c);
    setCharacters(updated);
    onUpdateBible({ ...bible, characters: updated });
  };

  const handleDeleteChar = (id) => {
    const updated = characters.filter(c => c.id !== id);
    setCharacters(updated);
    onUpdateBible({ ...bible, characters: updated });
  };

  const handleAddPlotNote = () => {
    const newPlot = {
      id: `plot-${Date.now()}`,
      title: 'Snodo di Trama',
      tensionLevel: 'Alta',
      summary: 'Descrivi la rivelazione, il conflitto o il colpo di scena di questo momento.'
    };
    const updated = [...plotNotes, newPlot];
    setPlotNotes(updated);
    onUpdateBible({ ...bible, plotNotes: updated });
  };

  const handleUpdatePlot = (id, field, value) => {
    const updated = plotNotes.map(p => p.id === id ? { ...p, [field]: value } : p);
    setPlotNotes(updated);
    onUpdateBible({ ...bible, plotNotes: updated });
  };

  const handleDeletePlot = (id) => {
    const updated = plotNotes.filter(p => p.id !== id);
    setPlotNotes(updated);
    onUpdateBible({ ...bible, plotNotes: updated });
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
        zIndex: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
      onClick={onClose}
    >
      <div 
        className={`glass-panel m3-dialog-panel ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '880px',
          maxWidth: '96vw',
          height: '84vh',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--m3-shape-dialog, 24px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)'
        }}
      >
        {/* Header */}
        <div className="m3-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="m3-dialog-icon-box">
              <Compass size={22} className="m3-icon-bounce" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Bibbia del Romanzo — {book.title}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Personaggi, snodi di trama, timeline e appunti di ambientazione a portata di mano.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleAutoScanAllChapters}
              disabled={isScanningBible}
              title="Scansiona tutti i capitoli ed estrae automaticamente personaggi, luoghi e snodi"
              className="m3-chip"
              style={{
                color: 'var(--accent-cyan)',
                borderColor: 'var(--accent-cyan-dim)',
                background: 'var(--accent-cyan-dim)',
                cursor: isScanningBible ? 'wait' : 'pointer'
              }}
            >
              <Sparkles size={14} className={isScanningBible ? 'animate-spin' : 'm3-icon-bounce'} />
              <span>{isScanningBible ? 'Scansione Capitoli...' : 'Auto-Compila con AI'}</span>
            </button>

            <button 
              onClick={onClose} 
              className="m3-dialog-close-btn"
              title="Chiudi (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab navigation - Segmented Grid (No Horizontal Scroll) */}
        <div style={{ padding: '0.75rem 1.75rem', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
          <div className="m3-segmented-grid m3-segmented-grid-4">
            {[
              { id: 'characters', label: 'Personaggi & Ruoli', icon: Users, count: characters.length },
              { id: 'plot', label: 'Snodi di Trama & Suspense', icon: GitBranch, count: plotNotes.length },
              { id: 'world', label: 'Ambientazione & Lore', icon: BookOpen },
              { id: 'synopsis', label: 'Sinossi & Premessa', icon: FileText }
            ].map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`m3-segmented-tab ${isActive ? 'm3-segmented-tab-active' : ''}`}
                >
                  <Icon size={14} className="m3-icon-bounce" />
                  <span>{t.label}</span>
                  {t.count !== undefined && (
                    <span 
                      style={{ 
                        fontSize: '0.68rem', 
                        padding: '0.1rem 0.45rem', 
                        borderRadius: 'var(--m3-shape-full)', 
                        backgroundColor: isActive ? 'var(--accent-cyan-glow)' : 'var(--bg-elevated)',
                        color: isActive ? '#fff' : 'inherit'
                      }}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {/* TAB 1: CHARACTERS */}
          {activeTab === 'characters' && (
            <div key="characters" className="m3-tab-content-fluid">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  I personaggi forti hanno sempre un obiettivo viscerale e un punto cieco che la trama metterà a nudo.
                </p>
                <button
                  onClick={handleAddCharacter}
                  className="m3-chip"
                  style={{
                    color: 'var(--accent-cyan)',
                    background: 'var(--accent-cyan-dim)',
                    borderColor: 'var(--accent-cyan)'
                  }}
                >
                  <Plus size={14} className="m3-icon-bounce" /> <span>Aggiungi Personaggio</span>
                </button>
              </div>

              {characters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ margin: '0 auto 0.85rem auto', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.9rem' }}>Nessun personaggio ancora inserito. Clicca su "Aggiungi Personaggio" per iniziare.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {characters.map(char => (
                    <div 
                      key={char.id}
                      className="m3-card"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={char.name}
                            onChange={(e) => handleUpdateChar(char.id, 'name', e.target.value)}
                            placeholder="Nome del Personaggio"
                            style={{
                              fontSize: '1.05rem',
                              fontWeight: '700',
                              color: 'var(--text-primary)',
                              fontFamily: 'var(--font-serif)',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--m3-shape-xs, 8px)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-primary)',
                              minWidth: '180px'
                            }}
                          />
                          <input
                            type="text"
                            value={char.role}
                            onChange={(e) => handleUpdateChar(char.id, 'role', e.target.value)}
                            placeholder="Ruolo (es. Protagonista, Antagonista, Mentore)"
                            style={{
                              fontSize: '0.82rem',
                              color: 'var(--accent-cyan)',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--m3-shape-xs, 8px)',
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-primary)',
                              flex: 1,
                              minWidth: '180px'
                            }}
                          />
                          {char.isAiAutoExtracted && (
                            <span 
                              className="m3-chip"
                              title="Personaggio estratto in automatico dal testo del tuo manoscritto"
                              style={{ 
                                fontSize: '0.68rem', 
                                color: 'var(--accent-cyan)', 
                                backgroundColor: 'var(--accent-cyan-dim)', 
                                borderColor: 'var(--accent-cyan-glow)'
                              }}
                            >
                              <Sparkles size={11} className="m3-icon-bounce" /> AI Auto-rilevato
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteChar(char.id)}
                          className="m3-dialog-close-btn"
                          style={{ width: '32px', height: '32px' }}
                          title="Elimina personaggio"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                            Obiettivo / Desiderio
                          </label>
                          <input
                            type="text"
                            value={char.goal}
                            onChange={(e) => handleUpdateChar(char.id, 'goal', e.target.value)}
                            placeholder="Cosa vuole a tutti i costi?"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--m3-shape-xs, 8px)' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent-coral)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                            Punto Cieco / Difetto Fatale
                          </label>
                          <input
                            type="text"
                            value={char.flaw}
                            onChange={(e) => handleUpdateChar(char.id, 'flaw', e.target.value)}
                            placeholder="Cosa gli impedisce di riuscire subito?"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--m3-shape-xs, 8px)' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                          Note di Carattere, Voce & Aspetto
                        </label>
                        <textarea
                          rows={2}
                          value={char.notes}
                          onChange={(e) => handleUpdateChar(char.id, 'notes', e.target.value)}
                          placeholder="Particolarità fisiche, espressioni tipiche, backstory..."
                          style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--m3-shape-xs, 8px)', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PLOT BEATS */}
          {activeTab === 'plot' && (
            <div key="plot" className="m3-tab-content-fluid">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  La formula della narrativa avvincente: una catena ininterrotta di cause-effetto e rivelazioni progressive.
                </p>
                <button
                  onClick={handleAddPlotNote}
                  className="m3-chip"
                  style={{
                    color: 'var(--accent-cyan)',
                    background: 'var(--accent-cyan-dim)',
                    borderColor: 'var(--accent-cyan)'
                  }}
                >
                  <Plus size={14} className="m3-icon-bounce" /> <span>Aggiungi Snodo</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {plotNotes.map((plot, idx) => (
                  <div
                    key={plot.id}
                    className="m3-card"
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div 
                      className="monkey-stat-pill"
                      style={{
                        padding: '0.25rem 0.6rem',
                        color: 'var(--accent-cyan)',
                        fontSize: '0.8rem',
                        fontWeight: '700'
                      }}
                    >
                      #{idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={plot.title}
                          onChange={(e) => handleUpdatePlot(plot.id, 'title', e.target.value)}
                          placeholder="Titolo snodo di trama"
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            padding: '0.35rem 0.65rem',
                            borderRadius: 'var(--m3-shape-xs, 8px)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-primary)',
                            flex: 1,
                            minWidth: '180px'
                          }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <select
                            value={plot.tensionLevel}
                            onChange={(e) => handleUpdatePlot(plot.id, 'tensionLevel', e.target.value)}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: 'var(--m3-shape-xs, 8px)',
                              backgroundColor: 'var(--bg-primary)',
                              color: plot.tensionLevel === 'Altissima' ? 'var(--accent-coral)' : 'var(--accent-cyan)'
                            }}
                          >
                            <option value="Moderata">Tensione Moderata</option>
                            <option value="Alta">Tensione Alta</option>
                            <option value="Altissima">Climax / Altissima</option>
                          </select>

                          <button
                            onClick={() => handleDeletePlot(plot.id)}
                            className="m3-dialog-close-btn"
                            style={{ width: '32px', height: '32px' }}
                            title="Elimina snodo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={plot.summary}
                        onChange={(e) => handleUpdatePlot(plot.id, 'summary', e.target.value)}
                        placeholder="Cosa accade ai personaggi in questo momento?"
                        style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--m3-shape-xs, 8px)', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: WORLD & LORE */}
          {activeTab === 'world' && (
            <div key="world" className="m3-tab-content-fluid">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Luoghi chiave, atmosfere sensoriali, documenti storici, regole dell'universo narrativo o cospirazioni in corso.
              </p>
              <textarea
                rows={16}
                value={worldNotes}
                onChange={(e) => {
                  setWorldNotes(e.target.value);
                  onUpdateBible({ ...bible, worldNotes: e.target.value });
                }}
                placeholder="Descrivi l'ambientazione: le luci, gli odori, le città, i codici da decifrare, le fazioni in lotta..."
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--m3-shape-lg, 20px)'
                }}
              />
            </div>
          )}

          {/* TAB 4: SYNOPSIS */}
          {activeTab === 'synopsis' && (
            <div key="synopsis" className="m3-tab-content-fluid">
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                La promessa del romanzo al lettore: la domanda drammatica centrale e l'arco narrativo principale.
              </p>
              <textarea
                rows={14}
                value={synopsis}
                onChange={(e) => {
                  setSynopsis(e.target.value);
                  onUpdateBible({ ...bible, synopsis: e.target.value });
                }}
                placeholder="Scrivi qui la sinossi completa o il pitch del libro..."
                style={{
                  width: '100%',
                  padding: '1.25rem',
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--m3-shape-lg, 20px)'
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          style={{
            padding: '1rem 2rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Le note della bibbia vengono sincronizzate automaticamente con il libro attivo.
          </span>
          <button
            onClick={() => {
              handleSave();
              onClose();
            }}
            className="m3-btn m3-btn-filled"
          >
            Chiudi e Torna al Capitolo
          </button>
        </div>
      </div>
    </div>
  );
}
