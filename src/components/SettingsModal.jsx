import React, { useEffect, useState } from 'react';
import { 
  X, 
  Sliders, 
  Eye, 
  EyeOff, 
  Headphones,
  Play,
  Palette,
  Zap,
  AlignLeft,
  AlignJustify,
  Focus,
  Square,
  HardDrive,
  Save,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Layers,
  Globe,
  ExternalLink
} from 'lucide-react';
import { audioEngine, KEY_PROFILES, AMBIENT_TRACKS } from '../utils/audioEngine';
import { fetchAIWithUsage, readAIUsage } from '../utils/aiService';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { useI18n } from '../utils/i18n';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  connectedFileName,
  onSaveToDisk
}) {
  const duration = settings?.animationDurationMs || 280;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, duration);
  const { t, language } = useI18n();

  const [activeTab, setActiveTab] = useState('theme'); // 'theme' | 'canvas' | 'motion' | 'save' | 'audio' | 'ai'
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testingCompatibleProvider, setTestingCompatibleProvider] = useState(null);
  const [keyTestStatus, setKeyTestStatus] = useState(null);
  const [availableGeminiModels, setAvailableGeminiModels] = useState([]);
  const [availableOpenAIModels, setAvailableOpenAIModels] = useState([]);
  const [availableOllamaModels, setAvailableOllamaModels] = useState([]);
  const [compatibleTestStatus, setCompatibleTestStatus] = useState({ openai: null, ollama: null });
  const [aiUsage, setAiUsage] = useState(() => readAIUsage());

  useEffect(() => {
    const updateUsage = () => setAiUsage(readAIUsage());
    window.addEventListener('bookify-ai-usage-updated', updateUsage);
    return () => window.removeEventListener('bookify-ai-usage-updated', updateUsage);
  }, []);

  const handleTestGeminiKey = async () => {
    const key = (settings.geminiApiKey || localStorage.getItem('bookify_gemini_api_key') || '').trim();
    if (!key) {
      setKeyTestStatus({ success: false, message: 'Inserisci prima la tua chiave API di Gemini nel campo sottostante.' });
      return;
    }
    setIsTestingKey(true);
    setKeyTestStatus(null);
    try {
      const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const listData = await listResponse.json().catch(() => ({}));
      if (!listResponse.ok) {
        throw new Error(listData.error?.message || `Google non ha accettato la chiave (HTTP ${listResponse.status}).`);
      }

      const models = (listData.models || [])
        .filter(model => model.name?.startsWith('models/gemini-') && model.supportedGenerationMethods?.includes('generateContent'))
        .map(model => ({
          id: model.name.replace(/^models\//, ''),
          label: model.displayName || model.name.replace(/^models\//, '')
        }))
        .sort((first, second) => Number(!/flash/i.test(first.id)) - Number(!/flash/i.test(second.id)));

      if (models.length === 0) {
        throw new Error('La chiave funziona, ma Google non ha restituito modelli Gemini compatibili con generateContent.');
      }

      setAvailableGeminiModels(models);
      const requestedModel = settings.geminiModel || '';
      const selectedModel = models.find(model => model.id === requestedModel)
        || models.find(model => /flash/i.test(model.id) && !/preview|experimental/i.test(model.id))
        || models[0];
      const modelChanged = selectedModel.id !== requestedModel;
      if (modelChanged) {
        onUpdateSettings({ ...settings, geminiModel: selectedModel.id });
      }
      const modelResponse = await fetchAIWithUsage(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel.id}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Rispondi con una sola parola: CONNESSO' }] }] })
      });
      const modelData = await modelResponse.json().catch(() => ({}));
      if (!modelResponse.ok) {
        throw new Error(`Il modello ${selectedModel.id} non ha superato il test: ${modelData.error?.message || `HTTP ${modelResponse.status}`}`);
      }

      localStorage.setItem('bookify_gemini_api_key', key);
      onUpdateSettings({ ...settings, geminiApiKey: key, geminiModel: selectedModel.id });
      setKeyTestStatus({
        success: true,
        message: modelChanged
          ? `Chiave verificata. ${requestedModel || 'Il modello precedente'} non e' disponibile: selezionato ${selectedModel.id}.`
          : `Connessione riuscita a Google Gemini (${selectedModel.id}). Chiave verificata.`
      });
    } catch (err) {
      setKeyTestStatus({
        success: false,
        message: `✕ Verifica Gemini non riuscita: ${err.message}`
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleTestCompatibleProvider = async (provider) => {
    const isOllama = provider === 'ollama';
    const endpointValue = isOllama ? settings.ollamaEndpoint : settings.openaiEndpoint;
    const endpoint = (endpointValue || (isOllama ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1')).trim().replace(/\/+$/, '');
    const baseUrl = isOllama && !/\/v1$/i.test(endpoint) ? `${endpoint}/v1` : endpoint;
    const apiKey = (settings.openaiApiKey || '').trim();
    if (!isOllama && !apiKey) {
      setCompatibleTestStatus(current => ({ ...current, openai: { success: false, message: 'Inserisci prima la chiave API OpenAI.' } }));
      return;
    }

    setTestingCompatibleProvider(provider);
    setCompatibleTestStatus(current => ({ ...current, [provider]: null }));
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(!isOllama ? { Authorization: `Bearer ${apiKey}` } : {})
      };
      const modelsResponse = await fetch(`${baseUrl}/models`, { headers });
      const modelsData = await modelsResponse.json().catch(() => ({}));
      if (!modelsResponse.ok) {
        throw new Error(modelsData.error?.message || `Elenco modelli non disponibile (HTTP ${modelsResponse.status}).`);
      }

      const models = (Array.isArray(modelsData.data) ? modelsData.data : Array.isArray(modelsData.models) ? modelsData.models : [])
        .map(model => typeof model === 'string' ? { id: model, label: model } : {
          id: model.id || model.name,
          label: model.name || model.id
        })
        .filter(model => model.id)
        .sort((first, second) => {
          const preferredId = isOllama ? (settings.ollamaModel || 'llama3:latest') : (settings.openaiModel || 'gpt-4o-mini');
          return Number(second.id === preferredId) - Number(first.id === preferredId);
        });

      if (models.length === 0) throw new Error('Il provider non ha restituito modelli disponibili.');
      if (isOllama) setAvailableOllamaModels(models);
      else setAvailableOpenAIModels(models);

      const requestedModel = isOllama ? settings.ollamaModel : settings.openaiModel;
      const selectedModel = models.find(model => model.id === requestedModel) || models[0];
      const modelChanged = selectedModel.id !== requestedModel;
      if (modelChanged) handleChange(isOllama ? 'ollamaModel' : 'openaiModel', selectedModel.id);

      const testResponse = await fetchAIWithUsage(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: selectedModel.id,
          messages: [{ role: 'user', content: 'Rispondi con una sola parola: CONNESSO' }],
          temperature: 0,
          max_tokens: 8
        })
      });
      const testData = await testResponse.json().catch(() => ({}));
      if (!testResponse.ok) {
        throw new Error(`Il modello ${selectedModel.id} non ha superato il test: ${testData.error?.message || `HTTP ${testResponse.status}`}`);
      }

      setCompatibleTestStatus(current => ({
        ...current,
        [provider]: {
          success: true,
          message: modelChanged
            ? `Connessione riuscita. Il modello precedente non era disponibile; selezionato ${selectedModel.id}.`
            : `Connessione riuscita con ${selectedModel.id}.`
        }
      }));
    } catch (error) {
      setCompatibleTestStatus(current => ({
        ...current,
        [provider]: { success: false, message: `Verifica ${isOllama ? 'Ollama' : 'OpenAI'} non riuscita: ${error.message}` }
      }));
    } finally {
      setTestingCompatibleProvider(null);
    }
  };

  if (!shouldRender) return null;

  const handleChange = (key, value) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const THEMES = [
    { id: 'parchment', name: 'Carta Antica', sub: 'Sepia caldo a lume di candela', color: '#e5a953', bg: '#191612' },
    { id: 'serika', name: 'Serika Dark', sub: 'Tonalità antracite puro e oro caldo', color: '#e2b714', bg: '#1f2326' },
    { id: 'dracula', name: 'Dracula', sub: 'Viola notte e tinte pastello neon', color: '#8be9fd', bg: '#21222c' },
    { id: 'nord', name: 'Nord Arctic', sub: 'Ardesia artica e ciano polare', color: '#88c0d0', bg: '#242933' },
    { id: 'botanical', name: 'Botanical / Matcha', sub: 'Verde salvia, menta e pino', color: '#7ea172', bg: '#151d18' },
    { id: 'coffee', name: 'Espresso & Latte', sub: 'Tonalità calde di caffè tostato', color: '#c89666', bg: '#1c1512' },
    { id: 'carbon', name: 'Carbon Industrial', sub: 'Grigio antracite e arancio vivo', color: '#f66e0d', bg: '#1e2022' },
    { id: 'matrix', name: 'Matrix Terminal', sub: 'Verde fosforico su nero profondo', color: '#00ff66', bg: '#070d08' },
    { id: 'solarized', name: 'Solarized Dark', sub: 'Ottone dorato e ciano petrolio', color: '#2aa198', bg: '#00212b' },
    { id: 'gruvbox', name: 'Gruvbox Dark', sub: 'Terracotta vintage e ocra calda', color: '#fabd2f', bg: '#1d2021' },
    { id: 'cyber', name: 'Neon Synthwave', sub: 'Laser cyberpunk ciano & magenta', color: '#00d2d3', bg: '#16162a' },
    { id: 'oled', name: 'Inchiostro Assoluto', sub: 'OLED nero per zero distrazioni', color: '#ffffff', bg: '#050507' }
  ];

  const FONTS = [
    { id: "'Lora', Georgia, serif", name: 'Lora (Serif Classico)', sample: 'Nel mezzo del cammin di nostra vita' },
    { id: "'Merriweather', serif", name: 'Merriweather (Serif Editoriale)', sample: 'Nel mezzo del cammin di nostra vita' },
    { id: "'Outfit', sans-serif", name: 'Outfit (Sans Minimale)', sample: 'Nel mezzo del cammin di nostra vita' },
    { id: "'JetBrains Mono', monospace", name: 'JetBrains Mono (Vintage Typewriter)', sample: 'Nel mezzo del cammin di nostra vita' }
  ];

  const BOUNDARIES = [
    { id: 'shadow', name: 'Ombra Morbida', desc: 'Foglio libro fluttuante con rilievo caldo' },
    { id: 'border', name: 'Bordo Sottile', desc: 'Cornice discreta ed elegante' },
    { id: 'sheet', name: 'Dorso Rilegato', desc: 'Foglio con costa colorata da volume cartaceo' },
    { id: 'vintage', name: 'Filetto d\'Epoca', desc: 'Doppio filetto dorato da tomo antico' },
    { id: 'dotted', name: 'Tratteggiato', desc: 'Cornice minimale punteggiata' },
    { id: 'none', name: 'Infinito / Nessun Bordo', desc: 'Testo puro a tutto schermo senza cornici' }
  ];

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
        zIndex: 270,
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
          width: '820px',
          maxWidth: '95vw',
          height: 'min(670px, calc(100dvh - 3rem))',
          flex: '0 0 auto',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--m3-shape-dialog, 24px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="m3-dialog-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div className="m3-dialog-icon-box">
              <Sliders size={22} className="m3-icon-bounce" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', margin: 0 }}>
                Impostazioni Studio & Personalizzazione
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                Regola palette d'autore, suoni meccanici, animazioni e parametri dell'AI Companion.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Language Switcher Pill */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.2rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleChange('language', 'it')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  backgroundColor: (settings.language || 'it') === 'it' ? 'var(--accent-cyan)' : 'transparent',
                  color: (settings.language || 'it') === 'it' ? '#0a0a0c' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🇮🇹 IT
              </button>
              <button
                type="button"
                onClick={() => handleChange('language', 'en')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  backgroundColor: settings.language === 'en' ? 'var(--accent-cyan)' : 'transparent',
                  color: settings.language === 'en' ? '#0a0a0c' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🇬🇧 EN
              </button>
            </div>

            <button 
              onClick={onClose} 
              className="m3-dialog-close-btn"
              title="Chiudi impostazioni (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Segmented 2x3 Grid (No Horizontal Scroll) */}
        <div style={{ padding: '0.75rem 1.75rem', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)' }}>
          <div className="m3-segmented-grid m3-segmented-grid-3">
            {[
              { id: 'theme', label: 'Temi d\'Autore', icon: Palette },
              { id: 'canvas', label: 'Foglio & Riga', icon: Square },
              { id: 'motion', label: 'Animazioni', icon: Play },
              { id: 'save', label: 'Salvataggio & PC', icon: HardDrive },
              { id: 'audio', label: 'Tasti & Suoni', icon: Headphones },
              { id: 'ai', label: 'AI Companion & Bibbia', icon: Sparkles }
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
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.75rem' }}>
          {/* TAB 1: THEMES */}
          {activeTab === 'theme' && (
            <div key="theme" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                  Temi d'Autore & Tavolozze Atmosferiche (12 Palette)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  {THEMES.map(th => {
                    const isSelected = (settings.theme || 'parchment') === th.id;
                    return (
                      <div
                        key={th.id}
                        onClick={() => handleChange('theme', th.id)}
                        className={`m3-card ${isSelected ? 'm3-card-active' : ''}`}
                        style={{
                          backgroundColor: th.bg,
                          border: `1.5px solid ${isSelected ? th.color : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--m3-shape-md, 16px)',
                          padding: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          boxShadow: isSelected ? `0 4px 18px ${th.color}35` : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: isSelected ? th.color : '#e0e1dd' }}>
                            {th.name}
                          </span>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: th.color }} />
                        </div>
                        <span style={{ fontSize: '0.68rem', color: '#888', lineHeight: 1.35 }}>
                          {th.sub}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Typography */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                  Carattere Tipografico
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {FONTS.map(f => {
                    const isSelected = settings.fontFamily === f.id;
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleChange('fontFamily', f.id)}
                        style={{
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.84rem', fontWeight: isSelected ? '600' : '400', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          {f.name}
                        </div>
                        <div style={{ fontFamily: f.id, fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {f.sample}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Developer Portfolio Showcase Card */}
              <div 
                style={{
                  padding: '1.15rem 1.35rem',
                  borderRadius: 'var(--m3-shape-md, 16px)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  marginTop: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--accent-cyan-dim)',
                      color: 'var(--accent-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Globe size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {t('settings.developerPortfolio')}
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                      Esplora altri progetti, codice sorgente e novità dal creatore di Bookify.
                    </p>
                  </div>
                </div>
                <a
                  href={settings.developerPortfolioUrl || 'https://github.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="m3-btn m3-btn-tonal"
                  style={{ textDecoration: 'none', fontSize: '0.78rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <span>{t('common.portfolio')}</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: CANVAS & LINE FOCUS */}
          {activeTab === 'canvas' && (
            <div key="canvas" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Line Focus Blur Feature */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Focus size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Focus Riga al Centro & Sfocatura Dinamica
                    </h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lineFocusBlur ?? true}
                    onChange={(e) => handleChange('lineFocusBlur', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                  Quando scrivi, la riga attuale resta perfettamente bloccata al centro e le altre righe si sfocano leggermente. 
                  Non appena fermi la digitazione e muovi il mouse, la sfocatura svanisce dolcemente per farti rileggere tutto con chiarezza.
                </p>

                {settings.lineFocusBlur && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Intensità della Sfocatura Righe
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                      {[
                        { id: 'soft', label: 'Delicata (1.5px)', sub: 'Leggera ombra' },
                        { id: 'medium', label: 'Media (3px)', sub: 'Consigliata' },
                        { id: 'strong', label: 'Marcata (5px)', sub: 'Focus estremo' }
                      ].map(int => {
                        const isIntSelected = (settings.lineFocusIntensity || 'medium') === int.id;
                        return (
                          <button
                            key={int.id}
                            onClick={() => handleChange('lineFocusIntensity', int.id)}
                            style={{
                              padding: '0.55rem',
                              borderRadius: 'var(--radius-xs)',
                              backgroundColor: isIntSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-primary)',
                              border: `1px solid ${isIntSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                              color: isIntSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ fontSize: '0.78rem', fontWeight: '600' }}>{int.label}</div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{int.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Autohide UI Chrome during writing */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <EyeOff size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Dissolvenza Interfaccia durante la Scrittura
                    </h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoHideUIOnType ?? true}
                    onChange={(e) => handleChange('autoHideUIOnType', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  La barra superiore e la barra inferiore restano sempre nitide e ben visibili. Solo mentre stai digitando svaniscono dolcemente per lasciarti immersione totale, e riappaiono subito quando fermi la scrittura o muovi il mouse.
                </p>
              </div>

              {/* Lateral Line Counter HUD Feature */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Barra & Indicatore Riga Attuale (HUD Laterale)
                    </h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showLineHUD ?? true}
                    onChange={(e) => handleChange('showLineHUD', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                  Mostra sul margine sinistro del foglio il numero della riga su cui ti trovi, il totale delle righe del capitolo e la percentuale di avanzamento. Puoi personalizzarne l'aspetto o disattivarlo.
                </p>

                {settings.showLineHUD !== false && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Stile Grafico dell'Indicatore Riga
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                      {[
                        { id: 'pill', label: 'Pill Fluttuante', sub: 'RIGA 14 / 85 (16%)' },
                        { id: 'minimal', label: 'Minimale Discreto', sub: 'L. 14 sottile' },
                        { id: 'bar', label: 'Barra di Progresso', sub: 'Traccia verticale' }
                      ].map(styleOpt => {
                        const isSelected = (settings.lineHUDStyle || 'pill') === styleOpt.id;
                        return (
                          <button
                            key={styleOpt.id}
                            onClick={() => handleChange('lineHUDStyle', styleOpt.id)}
                            style={{
                              padding: '0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-primary)',
                              border: `1.5px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                              color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ fontSize: '0.78rem', fontWeight: '700' }}>{styleOpt.label}</div>
                            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{styleOpt.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Tipografia Editoriale & Indentazione Automatica */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      Rientro Automatico dei Capoversi (Stile Libro Stampato)
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                      Indenta la prima riga di ogni nuovo capoverso (2em) come nei volumi di narrativa pubblicati.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.editorialIndent ?? true}
                    onChange={(e) => handleChange('editorialIndent', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      Punteggiatura Tipografica Autonoma
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                      Converte automaticamente <code style={{ color: 'var(--accent-cyan)' }}>--</code> in trattino lungo <code style={{ color: 'var(--accent-cyan)' }}>—</code>, <code style={{ color: 'var(--accent-cyan)' }}>...</code> in puntini <code style={{ color: 'var(--accent-cyan)' }}>…</code> e sistema gli spazi dopo la punteggiatura.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.smartPunctuation ?? true}
                    onChange={(e) => handleChange('smartPunctuation', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Page Boundary Style */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                  Stile del Confine della Pagina (Bordo & Rilegatura)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                  {BOUNDARIES.map(b => {
                    const isBSelected = (settings.pageBoundaryStyle || 'shadow') === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => handleChange('pageBoundaryStyle', b.id)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isBSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isBSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.84rem', fontWeight: '700', color: isBSelected ? 'var(--accent-cyan)' : 'var(--text-primary)', marginBottom: '0.2rem' }}>
                          {b.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {b.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Canvas Dimensions & Spacing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dimensione Testo</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{settings.fontSize || 19}px</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="26"
                    step="1"
                    value={settings.fontSize || 19}
                    onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>

                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Interlinea</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{settings.lineHeight || 2.1}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.6"
                    max="2.6"
                    step="0.1"
                    value={settings.lineHeight || 2.1}
                    onChange={(e) => handleChange('lineHeight', parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
              </div>

              {/* Column Width & Alignment */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Larghezza Colonna di Scrittura
                  </label>
                  <select
                    value={settings.editorWidth || 'standard'}
                    onChange={(e) => handleChange('editorWidth', e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  >
                    <option value="compact">Compatta (700px)</option>
                    <option value="standard">Standard (840px)</option>
                    <option value="wide">Ampia (980px)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Allineamento Testo
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[
                      { id: 'left', label: 'A Sinistra', icon: AlignLeft },
                      { id: 'justify', label: 'Giustificato', icon: AlignJustify }
                    ].map(a => {
                      const Icon = a.icon;
                      const isAlignSelected = (settings.textAlignment || 'left') === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleChange('textAlignment', a.id)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: isAlignSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
                            border: `1px solid ${isAlignSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                            color: isAlignSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          <Icon size={14} />
                          <span>{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MOTION & FLUID ANIMATIONS (MATERIAL 3 EXPRESSIVE) */}
          {activeTab === 'motion' && (
            <div key="motion" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Play size={18} style={{ color: 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Animazioni Fluide dei Menu & Finestre
                    </h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableAnimations ?? true}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      handleChange('enableAnimations', enabled);
                      const dur = enabled ? (settings.animationDurationMs || 280) : 0;
                      document.documentElement.style.setProperty('--anim-duration', `${dur}ms`);
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
                  Regola la durata e lo stile delle animazioni elastiche Material 3 Expressive per l'apertura e chiusura di tutti i menu, cassetti laterali e finestre modali.
                </p>

                {settings.enableAnimations !== false && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        Preset di Velocità (3 Opzioni)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                        {[
                          { id: 'fast', ms: 150, label: 'Veloce', desc: '150 ms — Rapido e scattante' },
                          { id: 'medium', ms: 280, label: 'Medio', desc: '280 ms — Consigliato (Material 3)' },
                          { id: 'slow', ms: 450, label: 'Lento', desc: '450 ms — Morbido e rilassato' }
                        ].map(preset => {
                          const isSelected = (settings.animationPreset === preset.id) || 
                            (!settings.animationPreset && preset.id === 'medium' && (settings.animationDurationMs === 280 || !settings.animationDurationMs)) ||
                            (settings.animationDurationMs === preset.ms && settings.animationPreset !== 'custom');
                          return (
                            <button
                              key={preset.id}
                              onClick={() => {
                                onUpdateSettings({
                                  ...settings,
                                  animationPreset: preset.id,
                                  animationDurationMs: preset.ms
                                });
                                document.documentElement.style.setProperty('--anim-duration', `${preset.ms}ms`);
                              }}
                              style={{
                                padding: '0.75rem 0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-primary)',
                                border: `1.5px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                                color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)'
                              }}
                            >
                              <div style={{ fontSize: '0.84rem', fontWeight: '700' }}>{preset.label}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{preset.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Editable Input in ms */}
                    <div 
                      style={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        padding: '1rem 1.25rem', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid var(--border-subtle)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between' 
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                          Durata Personalizzata (Modifica a Mano in ms)
                        </span>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
                          Digita qualsiasi valore da 50ms a 1500ms
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <input
                          type="number"
                          min="50"
                          max="1500"
                          step="10"
                          value={settings.animationDurationMs || 280}
                          onChange={(e) => {
                            const val = Math.max(50, Math.min(1500, parseInt(e.target.value) || 280));
                            onUpdateSettings({
                              ...settings,
                              animationPreset: 'custom',
                              animationDurationMs: val
                            });
                            document.documentElement.style.setProperty('--anim-duration', `${val}ms`);
                          }}
                          style={{
                            width: '85px',
                            padding: '0.45rem 0.65rem',
                            fontSize: '0.9rem',
                            fontFamily: 'var(--font-mono)',
                            textAlign: 'right',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent-cyan)',
                            fontWeight: '700'
                          }}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>ms</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: AUTOSAVE & REAL PC FILE PERSISTENCE */}
          {activeTab === 'save' && (
            <div key="save" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* PC Local File Connection Status */}
              <div 
                style={{ 
                  backgroundColor: 'var(--bg-elevated)', 
                  padding: '1.35rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: `1.5px solid ${connectedFileName ? 'rgba(74, 222, 128, 0.4)' : 'var(--border-subtle)'}` 
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <HardDrive size={19} style={{ color: connectedFileName ? '#4ade80' : 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      File Reale sul tuo Computer (*.bookify)
                    </h3>
                  </div>
                  {connectedFileName && (
                    <span 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.35rem', 
                        fontSize: '0.72rem', 
                        fontWeight: '700', 
                        color: '#4ade80', 
                        backgroundColor: 'rgba(74, 222, 128, 0.12)', 
                        padding: '0.2rem 0.65rem', 
                        borderRadius: 'var(--radius-full)' 
                      }}
                    >
                      <CheckCircle2 size={12} /> Collegato a Disco
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.1rem 0' }}>
                  {connectedFileName ? (
                    <>
                      Il tuo manoscritto è sincronizzato direttamente con il file <strong style={{ color: 'var(--text-primary)' }}>{connectedFileName}</strong> sul tuo computer. 
                      Ogni salvataggio automatico viene scritto fisicamente su disco.
                    </>
                  ) : (
                    <>
                      Attualmente Bookify salva nella memoria locale del browser. 
                      Collega o crea un vero file <strong style={{ color: 'var(--accent-cyan)' }}>.bookify</strong> sul tuo PC: una volta selezionato, ogni capitolo e modifica verrà salvato direttamente su disco in tempo reale!
                    </>
                  )}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      if (onSaveToDisk) onSaveToDisk();
                    }}
                    style={{
                      padding: '0.6rem 1.2rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-cyan)',
                      color: '#1a1612',
                      fontWeight: '700',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 4px 12px rgba(0, 210, 211, 0.25)',
                      cursor: 'pointer'
                    }}
                  >
                    <Save size={15} />
                    <span>{connectedFileName ? 'Salva Subito / Collega Altro File' : 'Salva su Vero File PC (*.bookify)'}</span>
                  </button>
                </div>
              </div>

              {/* Autosave Frequency & Controls */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Save size={17} style={{ color: 'var(--accent-cyan)' }} />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Autosalvataggio in Background
                    </h3>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autosaveEnabled ?? true}
                    onChange={(e) => handleChange('autosaveEnabled', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
                  />
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                  Scegli con quale frequenza Bookify deve salvare in automatico il tuo lavoro mentre scrivi.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  {[
                    { sec: 10, label: '10 Secondi', sub: 'Frequente / Sicurezza massima' },
                    { sec: 30, label: '30 Secondi', sub: 'Consigliato (Equilibrato)' },
                    { sec: 60, label: '1 Minuto', sub: 'Regolare' },
                    { sec: 120, label: '2 Minuti', sub: 'Intervallo medio' },
                    { sec: 300, label: '5 Minuti', sub: 'Rilassato' },
                    { sec: 0, label: 'Disattivato', sub: 'Solo manuale (Ctrl+S)' }
                  ].map(opt => {
                    const currentSec = settings.autosaveIntervalSeconds ?? 30;
                    const isSelected = (settings.autosaveEnabled !== false && currentSec === opt.sec) || 
                                       (settings.autosaveEnabled === false && opt.sec === 0);
                    return (
                      <button
                        key={opt.sec}
                        onClick={() => {
                          if (opt.sec === 0) {
                            handleChange('autosaveEnabled', false);
                          } else {
                            onUpdateSettings({
                              ...settings,
                              autosaveEnabled: true,
                              autosaveIntervalSeconds: opt.sec
                            });
                          }
                        }}
                        style={{
                          padding: '0.75rem 0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-primary)',
                          border: `1.5px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ fontSize: '0.84rem', fontWeight: '700' }}>{opt.label}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO & MECHANICAL KEYBOARDS */}
          {activeTab === 'audio' && (
            <div key="audio" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Switch Meccanici & Feedback Tasti ({KEY_PROFILES.length} Profili Audio)
                  </label>
                  <button
                    onClick={() => audioEngine.playKey('a', 'KeyA')}
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.74rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--accent-cyan-dim)',
                      color: 'var(--accent-cyan)',
                      border: '1px solid var(--accent-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <Play size={11} /> Prova Tasto
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                  {KEY_PROFILES.map(prof => {
                    const isSelected = settings.soundProfile === prof.id;
                    return (
                      <div
                        key={prof.id}
                        onClick={() => {
                          handleChange('soundProfile', prof.id);
                          audioEngine.setProfile(prof.id);
                          audioEngine.playKey('a', 'KeyA');
                        }}
                        style={{
                          padding: '0.8rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                            {prof.name}
                          </span>
                          <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                            {prof.badge}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {prof.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Key volume */}
                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', marginTop: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Volume Battitura Tasti</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{Math.round(settings.soundVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.soundVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleChange('soundVolume', val);
                      audioEngine.setVolume(val);
                    }}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
              </div>

              {/* Ambient soundscapes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Sottofondi Immersivi & Atmosfere Cozy
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginBottom: '0.85rem' }}>
                  {AMBIENT_TRACKS.map(amb => {
                    const isSelected = (settings.ambientTrack || 'none') === amb.id;
                    return (
                      <div
                        key={amb.id}
                        onClick={() => {
                          handleChange('ambientTrack', amb.id);
                          audioEngine.startAmbient(amb.id);
                        }}
                        style={{
                          padding: '0.8rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSelected ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
                          border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: '0.84rem', fontWeight: '600', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)', marginBottom: '0.2rem' }}>
                          {amb.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                          {amb.description}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Volume Sottofondo Atmosferico</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{Math.round((settings.ambientVolume ?? 0.35) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.ambientVolume ?? 0.35}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      handleChange('ambientVolume', val);
                      audioEngine.setAmbientVolume(val);
                    }}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI PACING & COMPANION ENGINE */}
          {activeTab === 'ai' && (
            <div key="ai" className="m3-tab-content-fluid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Novel Bible Autonomous Sync */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.autoSyncBible ?? true}
                    onChange={(e) => handleChange('autoSyncBible', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <BookOpen size={16} style={{ color: 'var(--accent-cyan)' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Auto-Compilazione Continua della Bibbia del Romanzo
                      </span>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                      Rileva personaggi, luoghi e svolte narrative mentre scrivi. Richiede il controllo AI in tempo reale qui sotto; ogni aggiornamento può consumare token.
                    </p>
                  </div>
                </label>
              </div>

              {/* Real-time Orthography & Typo Engine */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.chunkCheckingEnabled ?? false}
                    onChange={(event) => {
                      localStorage.setItem('bookify_realtime_correction_preference_v1', 'true');
                      handleChange('chunkCheckingEnabled', event.target.checked);
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Zap size={16} style={{ color: 'var(--accent-cyan)' }} />
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Correzione e suggerimenti AI in tempo reale
                      </span>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                      Disattivata di default. Se la attivi, dopo le pause di scrittura Bookify invia il testo recente al provider AI: può consumare token. Se è attiva anche la Bibbia automatica, può partire un'ulteriore chiamata.
                    </p>
                  </div>
                </label>
              </div>

              {/* LLM Provider */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                  Provider LLM per l'Assistente Letterario Avanzato
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                  {[
                    { id: 'gemini', label: 'Google Gemini', sub: 'Gemini 1.5 / 2.0 Flash' },
                    { id: 'openai', label: 'OpenAI API', sub: 'GPT-4o mini' },
                    { id: 'ollama', label: 'Ollama Locale', sub: '100% Offline / Gratuito' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleChange('aiProvider', p.id)}
                      style={{
                        padding: '0.8rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: settings.aiProvider === p.id ? 'var(--accent-cyan-dim)' : 'var(--bg-elevated)',
                        border: `1px solid ${settings.aiProvider === p.id ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontSize: '0.84rem', fontWeight: '700', color: settings.aiProvider === p.id ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {p.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {settings.aiProvider === 'gemini' && (
                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        Google Gemini API Key
                      </label>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}
                      >
                        Ottieni chiave gratuita su Google AI Studio ↗
                      </a>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={settings.geminiApiKey || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleChange('geminiApiKey', val);
                            localStorage.setItem('bookify_gemini_api_key', val.trim());
                            setAvailableGeminiModels([]);
                            setKeyTestStatus(null);
                          }}
                          placeholder="Incolla qui la chiave API (inizia con AIzaSy...)"
                          style={{ width: '100%', padding: '0.6rem 2.4rem 0.6rem 0.75rem', fontSize: '0.84rem', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--bg-primary)' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                        >
                          {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestGeminiKey}
                        disabled={isTestingKey}
                        className="m3-btn m3-btn-tonal"
                        style={{ padding: '0.55rem 0.95rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                      >
                        <Zap size={14} className={isTestingKey ? 'animate-spin' : ''} />
                        <span>{isTestingKey ? 'Verifica...' : 'Verifica Chiave'}</span>
                      </button>
                    </div>

                    {keyTestStatus && (
                      <div 
                        className="animate-fade-in"
                        style={{
                          marginTop: '0.55rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '0.76rem',
                          fontWeight: '600',
                          backgroundColor: keyTestStatus.success ? 'rgba(74, 222, 128, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: keyTestStatus.success ? '#4ade80' : '#ef4444',
                          border: `1px solid ${keyTestStatus.success ? 'rgba(74, 222, 128, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        {keyTestStatus.message}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      Modello Gemini per l'Editoria
                    </label>
                    <select
                      value={settings.geminiModel || 'gemini-2.0-flash'}
                      onChange={(e) => {
                        handleChange('geminiModel', e.target.value);
                        setKeyTestStatus(null);
                      }}
                      style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.84rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    >
                      {availableGeminiModels.length === 0 ? (
                        <option value={settings.geminiModel || 'gemini-2.0-flash'}>
                          {settings.geminiModel || 'Gemini'} · verifica la chiave per aggiornare i modelli
                        </option>
                      ) : availableGeminiModels.map(model => (
                        <option key={model.id} value={model.id}>{model.label} ({model.id})</option>
                      ))}
                    </select>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
                      {availableGeminiModels.length > 0
                        ? 'Elenco aggiornato dei modelli compatibili con la tua chiave.'
                        : 'Verifica la chiave per caricare i modelli attualmente disponibili per il tuo account.'}
                    </p>
                  </div>
                </div>
              )}

              {settings.aiProvider === 'openai' && (
                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      OpenAI API Key
                    </label>
                    <div style={{ display: 'flex', gap: '0.55rem' }}>
                      <input
                        type="password"
                        value={settings.openaiApiKey || ''}
                        onChange={(event) => {
                          handleChange('openaiApiKey', event.target.value);
                          setAvailableOpenAIModels([]);
                          setCompatibleTestStatus(current => ({ ...current, openai: null }));
                        }}
                        placeholder="sk-..."
                        style={{ flex: 1, minWidth: 0, padding: '0.55rem 0.75rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)' }}
                      />
                      <button type="button" onClick={() => handleTestCompatibleProvider('openai')} disabled={testingCompatibleProvider !== null} className="m3-btn m3-btn-tonal" style={{ padding: '0.5rem 0.75rem', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        <Zap size={13} className={testingCompatibleProvider === 'openai' ? 'animate-spin' : ''} />
                        {testingCompatibleProvider === 'openai' ? 'Verifica...' : 'Verifica e carica'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Endpoint API</label>
                    <input type="text" value={settings.openaiEndpoint || 'https://api.openai.com/v1'} onChange={event => { handleChange('openaiEndpoint', event.target.value); setAvailableOpenAIModels([]); setCompatibleTestStatus(current => ({ ...current, openai: null })); }} style={{ width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--bg-primary)' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Modello</label>
                    <select value={settings.openaiModel || 'gpt-4o-mini'} onChange={event => { handleChange('openaiModel', event.target.value); setCompatibleTestStatus(current => ({ ...current, openai: null })); }} style={{ width: '100%', padding: '0.55rem 0.7rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
                      {availableOpenAIModels.length === 0 ? <option value={settings.openaiModel || 'gpt-4o-mini'}>{settings.openaiModel || 'gpt-4o-mini'} · verifica per caricare i modelli</option> : availableOpenAIModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </select>
                  </div>
                  {compatibleTestStatus.openai && (
                    <p role={compatibleTestStatus.openai.success ? 'status' : 'alert'} style={{ margin: 0, padding: '0.55rem 0.7rem', color: compatibleTestStatus.openai.success ? '#4ade80' : '#ef4444', background: compatibleTestStatus.openai.success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-xs)', fontSize: '0.74rem' }}>{compatibleTestStatus.openai.message}</p>
                  )}
                </div>
              )}

              {settings.aiProvider === 'ollama' && (
                <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '1.25rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Endpoint Ollama</label>
                    <div style={{ display: 'flex', gap: '0.55rem' }}>
                      <input
                        type="text"
                        value={settings.ollamaEndpoint || 'http://localhost:11434/v1'}
                        onChange={event => { handleChange('ollamaEndpoint', event.target.value); setAvailableOllamaModels([]); setCompatibleTestStatus(current => ({ ...current, ollama: null })); }}
                        style={{ flex: 1, minWidth: 0, padding: '0.55rem 0.75rem', fontSize: '0.82rem', backgroundColor: 'var(--bg-primary)' }}
                      />
                      <button type="button" onClick={() => handleTestCompatibleProvider('ollama')} disabled={testingCompatibleProvider !== null} className="m3-btn m3-btn-tonal" style={{ padding: '0.5rem 0.75rem', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        <Zap size={13} className={testingCompatibleProvider === 'ollama' ? 'animate-spin' : ''} />
                        {testingCompatibleProvider === 'ollama' ? 'Verifica...' : 'Verifica e carica'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Modello installato</label>
                    <select value={settings.ollamaModel || 'llama3:latest'} onChange={event => { handleChange('ollamaModel', event.target.value); setCompatibleTestStatus(current => ({ ...current, ollama: null })); }} style={{ width: '100%', padding: '0.55rem 0.7rem', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}>
                      {availableOllamaModels.length === 0 ? <option value={settings.ollamaModel || 'llama3:latest'}>{settings.ollamaModel || 'llama3:latest'} · verifica per caricare i modelli</option> : availableOllamaModels.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </select>
                  </div>
                  {compatibleTestStatus.ollama && (
                    <p role={compatibleTestStatus.ollama.success ? 'status' : 'alert'} style={{ margin: 0, padding: '0.55rem 0.7rem', color: compatibleTestStatus.ollama.success ? '#4ade80' : '#ef4444', background: compatibleTestStatus.ollama.success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-xs)', fontSize: '0.74rem' }}>{compatibleTestStatus.ollama.message}</p>
                  )}
                </div>
              )}

              <div style={{ padding: '1.1rem 1.25rem', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.88rem' }}>Utilizzo registrato questo mese</h3>
                  <span style={{ color: 'var(--accent-cyan)', fontSize: '0.82rem', fontWeight: '700' }}>
                    {new Intl.NumberFormat('it-IT').format(aiUsage.providers?.[settings.aiProvider]?.totalTokens || 0)} token
                  </span>
                </div>
                <p style={{ margin: '0.45rem 0', color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.5 }}>
                  {aiUsage.providers?.[settings.aiProvider]?.requests || 0} richieste completate; token conteggiati in {aiUsage.providers?.[settings.aiProvider]?.meteredRequests || 0} risposte. Dati locali riportati dalle API, non una stima del limite residuo.
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.5 }}>
                  Le chiavi API standard non espongono un limite residuo uniforme: Gemini e OpenAI mostrano quote e soglie nei rispettivi pannelli; Ollama dipende dalle risorse locali.
                  {' '}
                  {settings.aiProvider === 'gemini' && <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>Apri Google AI Studio</a>}
                  {settings.aiProvider === 'openai' && <a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)' }}>Apri utilizzo OpenAI</a>}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.pacingMode ?? true}
                    onChange={(e) => handleChange('pacingMode', e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Analizzatore Ritmo Narrativo & Tensione Frasi
                    </span>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                      Valuta respiro delle frasi, suspense e colpi di scena per capitoli ad alto scorrimento.
                    </p>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showDontTellAssistant ?? true}
                    onChange={(e) => handleChange('showDontTellAssistant', e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Assistente "Mostra, non Raccontare" (Show, Don't Tell)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 1.25rem',
              backgroundColor: 'var(--accent-cyan)',
              color: '#1a1612',
              fontWeight: '700',
              fontSize: '0.82rem',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
