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
  onUpdateBible
}) {
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, 280);
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
          settings: {}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-cyan-dim)',
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Compass size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                Bibbia del Romanzo — {book.title}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Personaggi, snodi di trama, timeline e appunti di ambientazione a portata di mano.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              onClick={handleAutoScanAllChapters}
              disabled={isScanningBible}
              title="Scansiona tutti i capitoli ed estrae automaticamente personaggi, luoghi e snodi"
              style={{
                padding: '0.45rem 0.95rem',
                backgroundColor: 'var(--accent-cyan-dim)',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={14} className={isScanningBible ? 'animate-spin' : ''} />
              <span>{isScanningBible ? 'Scansione Capitoli...' : 'Auto-Compila con AI'}</span>
            </button>

            <button onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '0.4rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}>
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
                style={{
                  flex: 1,
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.84rem',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  borderBottom: `2px solid ${isActive ? 'var(--accent-cyan)' : 'transparent'}`,
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Icon size={15} />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-elevated)' }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
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
                  style={{
                    padding: '0.45rem 0.9rem',
                    backgroundColor: 'var(--accent-cyan-dim)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid var(--accent-cyan)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Plus size={14} /> Aggiungi Personaggio
                </button>
              </div>

              {characters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <Users size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                  <p>Nessun personaggio ancora inserito. Clicca su "Aggiungi Personaggio" per iniziare.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {characters.map(char => (
                    <div 
                      key={char.id}
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
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
                              padding: '0.2rem 0.5rem',
                              borderBottom: '1px solid var(--border-subtle)',
                              width: '45%'
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
                              padding: '0.2rem 0.5rem',
                              borderBottom: '1px solid var(--border-subtle)',
                              flex: 1
                            }}
                          />
                          {char.isAiAutoExtracted && (
                            <span 
                              title="Personaggio estratto in automatico dal testo del tuo manoscritto"
                              style={{ 
                                fontSize: '0.66rem', 
                                color: 'var(--accent-cyan)', 
                                padding: '0.15rem 0.45rem', 
                                backgroundColor: 'var(--accent-cyan-dim)', 
                                borderRadius: '4px', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.25rem', 
                                fontWeight: '600',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <Sparkles size={11} /> AI Auto-rilevato
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteChar(char.id)}
                          style={{ color: 'var(--text-muted)', padding: '0.3rem' }}
                          title="Elimina personaggio"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            Obiettivo / Desiderio
                          </label>
                          <input
                            type="text"
                            value={char.goal}
                            onChange={(e) => handleUpdateChar(char.id, 'goal', e.target.value)}
                            placeholder="Cosa vuole a tutti i costi?"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent-coral)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                            Punto Cieco / Difetto Fatale
                          </label>
                          <input
                            type="text"
                            value={char.flaw}
                            onChange={(e) => handleUpdateChar(char.id, 'flaw', e.target.value)}
                            placeholder="Cosa gli impedisce di riuscire subito?"
                            style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          Note di Carattere, Voce & Aspetto
                        </label>
                        <textarea
                          rows={2}
                          value={char.notes}
                          onChange={(e) => handleUpdateChar(char.id, 'notes', e.target.value)}
                          placeholder="Particolarità fisiche, espressioni tipiche, backstory..."
                          style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)', resize: 'vertical' }}
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
                  style={{
                    padding: '0.45rem 0.9rem',
                    backgroundColor: 'var(--accent-cyan-dim)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid var(--accent-cyan)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Plus size={14} /> Aggiungi Snodo
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {plotNotes.map((plot, idx) => (
                  <div
                    key={plot.id}
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.2rem',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div 
                      style={{
                        padding: '0.3rem 0.6rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--accent-cyan)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.82rem',
                        fontWeight: '700'
                      }}
                    >
                      #{idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={plot.title}
                          onChange={(e) => handleUpdatePlot(plot.id, 'title', e.target.value)}
                          placeholder="Titolo snodo di trama"
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            borderBottom: '1px solid var(--border-subtle)',
                            width: '60%',
                            padding: '0.2rem 0.4rem'
                          }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <select
                            value={plot.tensionLevel}
                            onChange={(e) => handleUpdatePlot(plot.id, 'tensionLevel', e.target.value)}
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.5rem',
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
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={plot.summary}
                        onChange={(e) => handleUpdatePlot(plot.id, 'summary', e.target.value)}
                        placeholder="Cosa accade ai personaggi in questo momento?"
                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)', resize: 'vertical' }}
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
                  padding: '1rem',
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
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
                  padding: '1rem',
                  fontSize: '0.88rem',
                  lineHeight: 1.7,
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
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
            style={{
              padding: '0.45rem 1.25rem',
              backgroundColor: 'var(--accent-cyan)',
              color: '#1a1612',
              fontWeight: '600',
              fontSize: '0.82rem',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            Chiudi e Torna al Capitolo
          </button>
        </div>
      </div>
    </div>
  );
}
