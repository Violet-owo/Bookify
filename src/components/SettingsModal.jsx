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
  ExternalLink,
  KeyRound,
  Type
} from 'lucide-react';
import { audioEngine, KEY_PROFILES, AMBIENT_TRACKS } from '../utils/audioEngine';
import { readAIUsage, AI_USAGE_EVENT, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, testClaudeKey, recordUsage } from '../utils/llm';
import { useAnimatedVisibility } from '../utils/useAnimatedVisibility';
import { useI18n } from '../utils/i18n';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';
import { revealTheme } from '../utils/motion';

const THEMES = [
  { id: 'parchment', color: '#e5a953', bg: '#191612', text: '#f3ece2' },
  { id: 'serika', color: '#e2b714', bg: '#1f2326', text: '#d1d0c5' },
  { id: 'dracula', color: '#8be9fd', bg: '#21222c', text: '#f8f8f2' },
  { id: 'nord', color: '#88c0d0', bg: '#242933', text: '#eceff4' },
  { id: 'botanical', color: '#7ea172', bg: '#151d18', text: '#e6eee8' },
  { id: 'coffee', color: '#c89666', bg: '#1c1512', text: '#ede3da' },
  { id: 'carbon', color: '#f66e0d', bg: '#1e2022', text: '#f2f2f2' },
  { id: 'matrix', color: '#00ff66', bg: '#070d08', text: '#00ff66' },
  { id: 'solarized', color: '#2aa198', bg: '#00212b', text: '#93a1a1' },
  { id: 'gruvbox', color: '#fabd2f', bg: '#1d2021', text: '#ebdbb2' },
  { id: 'cyber', color: '#00d2d3', bg: '#16162a', text: '#e0e1dd' },
  { id: 'oled', color: '#ffffff', bg: '#050507', text: '#f4f4f5' }
];

const FONTS = [
  { id: "'Lora', Georgia, serif", key: 'lora', name: 'Lora' },
  { id: "'Merriweather', serif", key: 'merriweather', name: 'Merriweather' },
  { id: "'Outfit', sans-serif", key: 'outfit', name: 'Outfit' },
  { id: "'JetBrains Mono', monospace", key: 'jetbrains', name: 'JetBrains Mono' }
];

const BOUNDARIES = ['shadow', 'border', 'sheet', 'vintage', 'dotted', 'none'];
const AUTOSAVE_OPTIONS = [10, 30, 60, 120, 300, 0];
const ANIMATION_PRESETS = [
  { id: 'fast', ms: 150 },
  { id: 'medium', ms: 280 },
  { id: 'slow', ms: 450 }
];
const PROVIDERS = ['claude', 'gemini', 'openai', 'ollama'];
const DEVELOPER_URL = 'https://portfolio.violetvrc30.workers.dev/';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`bk-switch ${checked ? 'bk-switch-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="bk-switch-thumb" />
    </button>
  );
}

function Section({ icon: Icon, title, description, toggle, children, tone }) {
  return (
    <section className={`settings-section ${tone ? `settings-section-${tone}` : ''}`}>
      <div className="settings-section-head">
        <div className="settings-section-title">
          {Icon && <Icon size={17} />}
          <h3>{title}</h3>
        </div>
        {toggle}
      </div>
      {description && <p className="settings-section-desc">{description}</p>}
      {children}
    </section>
  );
}

function ChoiceGrid({ options, value, onChange, columns = 3 }) {
  const { containerRef, indicatorStyle } = useSlidingIndicator(String(value));
  return (
    <div ref={containerRef} className="settings-choice-grid has-indicator" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} role="radiogroup">
      <span className="slide-indicator choice-indicator" style={indicatorStyle} aria-hidden="true" />
      {options.map(option => {
        const selected = option.id === value;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-active={selected ? 'true' : undefined}
            onClick={() => onChange(option.id)}
            className={`settings-choice ${selected ? 'settings-choice-active' : ''}`}
            style={option.style}
          >
            <span className="settings-choice-label">
              {Icon && <Icon size={14} />}
              {option.label}
            </span>
            {option.sub && <span className="settings-choice-sub" style={option.subStyle}>{option.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RangeField({ label, value, display, min, max, step, onChange }) {
  return (
    <div className="settings-range">
      <div className="settings-range-head">
        <span>{label}</span>
        <strong>{display}</strong>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(parseFloat(event.target.value))} />
    </div>
  );
}

function StatusNote({ status }) {
  if (!status) return null;
  return (
    <p role={status.success ? 'status' : 'alert'} className={`settings-status ${status.success ? 'settings-status-ok' : 'settings-status-error'}`}>
      {status.success ? <CheckCircle2 size={14} /> : <X size={14} />}
      <span>{status.message}</span>
    </p>
  );
}

function SecretInput({ value, onChange, placeholder, label }) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  return (
    <div className="settings-secret">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={false}
        autoComplete="off"
        className="settings-input settings-input-mono"
      />
      <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? t('settings.hideKey') : t('settings.showKey')}>
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings modal
// ---------------------------------------------------------------------------
export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  connectedFileName,
  onSaveToDisk,
  initialTab = 'theme'
}) {
  const duration = settings?.enableAnimations !== false ? settings?.animationDurationMs || 280 : 0;
  const { shouldRender, isExiting } = useAnimatedVisibility(isOpen, duration);
  const { t, language } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'it-IT';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [testing, setTesting] = useState(null);
  const [testStatus, setTestStatus] = useState({});
  const [models, setModels] = useState({ gemini: [], openai: [], ollama: [], claude: [] });
  const [aiUsage, setAiUsage] = useState(() => readAIUsage());
  const [customMs, setCustomMs] = useState(String(settings.animationDurationMs || 280));
  const navIndicator = useSlidingIndicator(`${shouldRender}:${activeTab}`);
  const themeIndicator = useSlidingIndicator(`${shouldRender}:${activeTab}:${settings.theme}`);
  const langIndicator = useSlidingIndicator(`${shouldRender}:${language}`);

  useEffect(() => {
    const updateUsage = () => setAiUsage(readAIUsage());
    window.addEventListener(AI_USAGE_EVENT, updateUsage);
    return () => window.removeEventListener(AI_USAGE_EVENT, updateUsage);
  }, []);

  useEffect(() => {
    setCustomMs(String(settings.animationDurationMs || 280));
  }, [settings.animationDurationMs]);

  if (!shouldRender) return null;

  const update = (patch) => onUpdateSettings({ ...settings, ...patch });
  const handleChange = (key, value) => update({ [key]: value });
  const setStatus = (provider, status) => setTestStatus(current => ({ ...current, [provider]: status }));

  // ---- Provider checks ----------------------------------------------------
  const handleTestClaude = async () => {
    const key = (settings.claudeApiKey || '').trim();
    if (!key) {
      setStatus('claude', { success: false, message: t('settings.enterKeyFirst') });
      return;
    }
    setTesting('claude');
    setStatus('claude', null);
    try {
      const available = await testClaudeKey(settings);
      setModels(current => ({ ...current, claude: available }));
      const selected = settings.claudeModel || DEFAULT_CLAUDE_MODEL;
      const ok = available.length === 0 || available.includes(selected);
      setStatus('claude', {
        success: ok,
        message: ok ? t('settings.claudeOk', { model: selected }) : t('settings.claudeModelMissing', { model: selected })
      });
    } catch (error) {
      setStatus('claude', { success: false, message: error.message });
    } finally {
      setTesting(null);
    }
  };

  const handleTestGemini = async () => {
    const key = (settings.geminiApiKey || '').trim();
    if (!key) {
      setStatus('gemini', { success: false, message: t('settings.enterKeyFirst') });
      return;
    }
    setTesting('gemini');
    setStatus('gemini', null);
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);

      const list = (data.models || [])
        .filter(model => model.name?.startsWith('models/gemini-') && model.supportedGenerationMethods?.includes('generateContent'))
        .map(model => ({ id: model.name.replace(/^models\//, ''), label: model.displayName || model.name.replace(/^models\//, '') }))
        .sort((a, b) => Number(!/flash/i.test(a.id)) - Number(!/flash/i.test(b.id)));
      if (!list.length) throw new Error(t('settings.noModels'));

      setModels(current => ({ ...current, gemini: list }));
      const selected = list.find(model => model.id === settings.geminiModel)
        || list.find(model => /flash/i.test(model.id) && !/preview|experimental/i.test(model.id))
        || list[0];
      update({ geminiApiKey: key, geminiModel: selected.id });
      setStatus('gemini', { success: true, message: t('settings.connectedWith', { provider: 'Gemini', model: selected.id }) });
    } catch (error) {
      setStatus('gemini', { success: false, message: t('settings.checkFailed', { provider: 'Gemini', error: error.message }) });
    } finally {
      setTesting(null);
    }
  };

  const handleTestCompatible = async (provider) => {
    const isOllama = provider === 'ollama';
    const endpoint = ((isOllama ? settings.ollamaEndpoint : settings.openaiEndpoint) || (isOllama ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1')).trim().replace(/\/+$/, '');
    const baseUrl = isOllama && !/\/v1$/i.test(endpoint) ? `${endpoint}/v1` : endpoint;
    const apiKey = (settings.openaiApiKey || '').trim();
    if (!isOllama && !apiKey) {
      setStatus(provider, { success: false, message: t('settings.enterKeyFirst') });
      return;
    }

    setTesting(provider);
    setStatus(provider, null);
    const label = isOllama ? 'Ollama' : 'OpenAI';
    try {
      const headers = { 'Content-Type': 'application/json', ...(!isOllama ? { Authorization: `Bearer ${apiKey}` } : {}) };
      let response;
      try {
        response = await fetch(`${baseUrl}/models`, { headers });
      } catch {
        throw new Error(isOllama ? t('ai.errorOllamaOffline', { endpoint: baseUrl }) : t('ai.errorNetwork', { provider: label, endpoint: baseUrl }));
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);

      const list = (Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [])
        .map(model => (typeof model === 'string' ? { id: model, label: model } : { id: model.id || model.name, label: model.name || model.id }))
        .filter(model => model.id);
      if (!list.length) throw new Error(t('settings.noModels'));
      setModels(current => ({ ...current, [provider]: list }));

      const modelKey = isOllama ? 'ollamaModel' : 'openaiModel';
      const selected = list.find(model => model.id === settings[modelKey]) || list[0];
      const test = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: selected.id, messages: [{ role: 'user', content: 'Reply with one word: OK' }], max_tokens: 8 })
      });
      const testData = await test.json().catch(() => ({}));
      if (!test.ok) throw new Error(testData.error?.message || `HTTP ${test.status}`);
      recordUsage(provider, testData.usage?.prompt_tokens, testData.usage?.completion_tokens);

      update({ [modelKey]: selected.id, ...(isOllama ? { ollamaEndpoint: baseUrl } : {}) });
      setStatus(provider, { success: true, message: t('settings.connectedWith', { provider: label, model: selected.id }) });
    } catch (error) {
      setStatus(provider, { success: false, message: t('settings.checkFailed', { provider: label, error: error.message }) });
    } finally {
      setTesting(null);
    }
  };

  // ---- Option lists ---------------------------------------------------------
  const tabs = [
    { id: 'theme', icon: Palette, anim: 'ic-wiggle' },
    { id: 'canvas', icon: Square, anim: 'ic-rotate' },
    { id: 'motion', icon: Play, anim: 'ic-nudge' },
    { id: 'save', icon: HardDrive, anim: 'ic-drop' },
    { id: 'audio', icon: Headphones, anim: 'ic-bob' },
    { id: 'ai', icon: Sparkles, anim: 'ic-twinkle' }
  ];

  const animationPreset = settings.animationPreset
    || ANIMATION_PRESETS.find(preset => preset.ms === (settings.animationDurationMs || 280))?.id
    || 'custom';
  const autosaveValue = settings.autosaveEnabled === false ? 0 : (settings.autosaveIntervalSeconds ?? 30);
  const providerUsage = aiUsage.providers?.[settings.aiProvider] || {};
  const usageLinks = {
    claude: 'https://console.anthropic.com/settings/usage',
    gemini: 'https://aistudio.google.com/',
    openai: 'https://platform.openai.com/usage'
  };

  const commitCustomMs = () => {
    const value = Math.max(50, Math.min(1500, parseInt(customMs, 10) || 280));
    setCustomMs(String(value));
    update({ animationPreset: 'custom', animationDurationMs: value });
  };

  return (
    <div className={`m3-modal-backdrop bk-modal-backdrop ${isExiting ? 'm3-modal-backdrop-exit' : ''}`} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`glass-panel m3-dialog-panel settings-dialog ${isExiting ? 'm3-dialog-panel-exit' : ''}`}
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="m3-dialog-header">
          <div className="bk-dialog-heading">
            <div className="m3-dialog-icon-box"><Sliders size={22} className="m3-icon-bounce" /></div>
            <div>
              <h2 id="settings-title">{t('settings.title')}</h2>
              <p>{t('settings.subtitle')}</p>
            </div>
          </div>
          <div className="bk-dialog-heading-actions">
            <div ref={langIndicator.containerRef} className="settings-lang has-indicator" role="radiogroup" aria-label={t('settings.language')}>
              <span className="slide-indicator lang-indicator" style={langIndicator.indicatorStyle} aria-hidden="true" />
              {['it', 'en'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={language === lang}
                  data-active={language === lang ? 'true' : undefined}
                  className={language === lang ? 'settings-lang-active' : ''}
                  onClick={() => handleChange('language', lang)}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} className="m3-dialog-close-btn" aria-label={t('common.close')} title={t('common.closeEsc')}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="settings-layout">
        <nav ref={navIndicator.containerRef} className="settings-nav has-indicator" role="tablist" aria-orientation="vertical">
          <span className="slide-indicator nav-indicator" style={navIndicator.indicatorStyle} aria-hidden="true" />
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active ? 'true' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-nav-item ${active ? 'is-active' : ''}`}
              >
                <Icon size={18} strokeWidth={2} className={tab.anim} />
                <span>{t(`settings.tabs.${tab.id}`)}</span>
              </button>
            );
          })}
        </nav>

        <div className="settings-body">
          {/* ------------------------------------------------ THEMES */}
          {activeTab === 'theme' && (
            <div key="theme" className="m3-tab-content-fluid settings-stack">
              <div>
                <h4 className="settings-label">{t('settings.themesTitle', { count: THEMES.length })}</h4>
                <div ref={themeIndicator.containerRef} className="settings-theme-grid has-indicator" role="radiogroup">
                  <span className="slide-indicator theme-indicator" style={themeIndicator.indicatorStyle} aria-hidden="true" />
                  {THEMES.map(theme => {
                    const selected = (settings.theme || 'parchment') === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-active={selected ? 'true' : undefined}
                        onClick={(event) => {
                          if (selected) return;
                          revealTheme(event.clientX, event.clientY, () => {
                            document.documentElement.setAttribute('data-theme', theme.id);
                            handleChange('theme', theme.id);
                          });
                        }}
                        className={`settings-theme ${selected ? 'settings-theme-active' : ''}`}
                        style={{ '--swatch-bg': theme.bg, '--swatch-accent': theme.color, '--swatch-text': theme.text }}
                      >
                        <span className="settings-theme-row">
                          <span className="settings-theme-name">{t(`themes.${theme.id}.name`)}</span>
                          <span className="settings-theme-dot" />
                        </span>
                        <span className="settings-theme-sub">{t(`themes.${theme.id}.sub`)}</span>
                        <span className="settings-theme-lines" aria-hidden="true"><i /><i /><i /></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="settings-label">{t('settings.font')}</h4>
                <div className="settings-choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="radiogroup">
                  {FONTS.map(font => {
                    const selected = (settings.fontFamily || FONTS[0].id) === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleChange('fontFamily', font.id)}
                        className={`settings-choice ${selected ? 'settings-choice-active' : ''}`}
                      >
                        <span className="settings-choice-label">{font.name} <em>· {t(`fonts.${font.key}`)}</em></span>
                        <span className="settings-font-sample" style={{ fontFamily: font.id }}>{t('settings.fontSample')}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <section className="settings-section settings-portfolio">
                <div className="settings-portfolio-info">
                  <div className="settings-portfolio-icon"><Globe size={20} /></div>
                  <div>
                    <h3>{t('settings.developerPortfolio')}</h3>
                    <p>{t('settings.developerPortfolioDesc')}</p>
                  </div>
                </div>
                <a href={DEVELOPER_URL} className="m3-btn m3-btn-tonal">
                  <span>{t('common.portfolio')}</span>
                  <ExternalLink size={13} />
                </a>
              </section>
            </div>
          )}

          {/* ------------------------------------------------ CANVAS */}
          {activeTab === 'canvas' && (
            <div key="canvas" className="m3-tab-content-fluid settings-stack">
              <Section
                icon={Focus}
                title={t('settings.lineFocusTitle')}
                description={t('settings.lineFocusDesc')}
                toggle={<Toggle checked={settings.lineFocusBlur ?? true} onChange={value => handleChange('lineFocusBlur', value)} label={t('settings.lineFocusTitle')} />}
              >
                {settings.lineFocusBlur !== false && (
                  <ChoiceGrid
                    value={settings.lineFocusIntensity || 'medium'}
                    onChange={value => handleChange('lineFocusIntensity', value)}
                    options={['soft', 'medium', 'strong'].map(id => ({ id, label: t(`settings.blur.${id}`), sub: t(`settings.blur.${id}Sub`) }))}
                  />
                )}
              </Section>

              <Section
                icon={EyeOff}
                title={t('settings.autoHideTitle')}
                description={t('settings.autoHideDesc')}
                toggle={<Toggle checked={settings.autoHideUIOnType ?? true} onChange={value => handleChange('autoHideUIOnType', value)} label={t('settings.autoHideTitle')} />}
              />

              <Section
                icon={Type}
                title={t('settings.typewriterTitle')}
                description={t('settings.typewriterDesc')}
                toggle={<Toggle checked={settings.typewriterMode ?? true} onChange={value => handleChange('typewriterMode', value)} label={t('settings.typewriterTitle')} />}
              />

              <Section
                icon={Layers}
                title={t('settings.hudTitle')}
                description={t('settings.hudDesc')}
                toggle={<Toggle checked={settings.showLineHUD ?? true} onChange={value => handleChange('showLineHUD', value)} label={t('settings.hudTitle')} />}
              >
                {settings.showLineHUD !== false && (
                  <ChoiceGrid
                    value={settings.lineHUDStyle || 'pill'}
                    onChange={value => handleChange('lineHUDStyle', value)}
                    options={['pill', 'minimal', 'bar'].map(id => ({ id, label: t(`settings.hud.${id}`), sub: t(`settings.hud.${id}Sub`) }))}
                  />
                )}
              </Section>

              <Section icon={AlignLeft} title={t('settings.typographyTitle')}>
                <div className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.indentTitle')}</strong>
                    <p>{t('settings.indentDesc')}</p>
                  </div>
                  <Toggle checked={settings.editorialIndent ?? true} onChange={value => handleChange('editorialIndent', value)} label={t('settings.indentTitle')} />
                </div>
                <div className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.smartPunctTitle')}</strong>
                    <p>{t(language === 'en' ? 'settings.smartPunctDescEn' : 'settings.smartPunctDesc')}</p>
                  </div>
                  <Toggle checked={settings.smartPunctuation ?? true} onChange={value => handleChange('smartPunctuation', value)} label={t('settings.smartPunctTitle')} />
                </div>
              </Section>

              <div>
                <h4 className="settings-label">{t('settings.boundaryTitle')}</h4>
                <ChoiceGrid
                  columns={2}
                  value={settings.pageBoundaryStyle || 'shadow'}
                  onChange={value => handleChange('pageBoundaryStyle', value)}
                  options={BOUNDARIES.map(id => ({ id, label: t(`settings.boundary.${id}`), sub: t(`settings.boundary.${id}Sub`) }))}
                />
              </div>

              <div className="settings-two-col">
                <RangeField
                  label={t('settings.fontSize')}
                  value={settings.fontSize || 19}
                  display={`${settings.fontSize || 19}px`}
                  min={15}
                  max={26}
                  step={1}
                  onChange={value => handleChange('fontSize', value)}
                />
                <RangeField
                  label={t('settings.lineHeight')}
                  value={settings.lineHeight || 2.1}
                  display={`${Number(settings.lineHeight || 2.1).toFixed(1)}×`}
                  min={1.6}
                  max={2.6}
                  step={0.1}
                  onChange={value => handleChange('lineHeight', value)}
                />
              </div>

              <div className="settings-two-col">
                <div>
                  <h4 className="settings-label">{t('settings.editorWidth')}</h4>
                  <ChoiceGrid
                    value={settings.editorWidth || 'standard'}
                    onChange={value => handleChange('editorWidth', value)}
                    options={['compact', 'standard', 'wide'].map(id => ({ id, label: t(`settings.width.${id}`), sub: { compact: '700px', standard: '840px', wide: '980px' }[id] }))}
                  />
                </div>
                <div>
                  <h4 className="settings-label">{t('settings.alignment')}</h4>
                  <ChoiceGrid
                    columns={2}
                    value={settings.textAlignment || 'left'}
                    onChange={value => handleChange('textAlignment', value)}
                    options={[
                      { id: 'left', label: t('settings.alignLeft'), icon: AlignLeft },
                      { id: 'justify', label: t('settings.alignJustify'), icon: AlignJustify }
                    ]}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------ MOTION */}
          {activeTab === 'motion' && (
            <div key="motion" className="m3-tab-content-fluid settings-stack">
              <Section
                icon={Play}
                title={t('settings.animationsTitle')}
                description={t('settings.animationsDesc')}
                toggle={<Toggle checked={settings.enableAnimations ?? true} onChange={value => handleChange('enableAnimations', value)} label={t('settings.animationsTitle')} />}
              >
                {settings.enableAnimations !== false && (
                  <>
                    <ChoiceGrid
                      value={animationPreset}
                      onChange={id => {
                        const preset = ANIMATION_PRESETS.find(p => p.id === id);
                        update({ animationPreset: id, animationDurationMs: preset.ms });
                      }}
                      options={ANIMATION_PRESETS.map(preset => ({ id: preset.id, label: t(`settings.speed.${preset.id}`), sub: t(`settings.speed.${preset.id}Sub`, { ms: preset.ms }) }))}
                    />
                    <div className="settings-inline-field">
                      <div>
                        <strong>{t('settings.customDuration')}</strong>
                        <p>{t('settings.customDurationDesc')}</p>
                      </div>
                      <div className="settings-ms">
                        <input
                          type="number"
                          min="50"
                          max="1500"
                          step="10"
                          value={customMs}
                          onChange={event => setCustomMs(event.target.value)}
                          onBlur={commitCustomMs}
                          onKeyDown={event => event.key === 'Enter' && commitCustomMs()}
                          className="settings-input settings-input-mono"
                          aria-label={t('settings.customDuration')}
                        />
                        <span>ms</span>
                      </div>
                    </div>
                  </>
                )}
              </Section>
            </div>
          )}

          {/* ------------------------------------------------ SAVE */}
          {activeTab === 'save' && (
            <div key="save" className="m3-tab-content-fluid settings-stack">
              <Section
                icon={HardDrive}
                tone={connectedFileName ? 'ok' : undefined}
                title={t('settings.diskTitle')}
                toggle={connectedFileName ? <span className="settings-badge-ok"><CheckCircle2 size={12} /> {t('settings.diskLinked')}</span> : null}
              >
                <p className="settings-section-desc">
                  {connectedFileName
                    ? <>{t('settings.diskLinkedDesc1')} <strong>{connectedFileName}</strong>. {t('settings.diskLinkedDesc2')}</>
                    : t('settings.diskLocalDesc')}
                </p>
                <div>
                  <button type="button" onClick={onSaveToDisk} className="m3-btn m3-btn-filled">
                    <Save size={15} />
                    <span>{connectedFileName ? t('settings.saveAsOther') : t('settings.saveToFile')}</span>
                  </button>
                </div>
              </Section>

              <Section icon={Save} title={t('settings.autosaveTitle')} description={t('settings.autosaveDesc')}>
                <ChoiceGrid
                  value={autosaveValue}
                  onChange={seconds => update(seconds === 0 ? { autosaveEnabled: false } : { autosaveEnabled: true, autosaveIntervalSeconds: seconds })}
                  options={AUTOSAVE_OPTIONS.map(seconds => ({ id: seconds, label: t(`settings.autosave.s${seconds}`), sub: t(`settings.autosave.s${seconds}Sub`) }))}
                />
              </Section>
            </div>
          )}

          {/* ------------------------------------------------ AUDIO */}
          {activeTab === 'audio' && (
            <div key="audio" className="m3-tab-content-fluid settings-stack">
              <Section
                icon={Headphones}
                title={t('settings.keySoundsTitle', { count: KEY_PROFILES.length })}
                toggle={<Toggle checked={settings.soundEnabled ?? true} onChange={value => handleChange('soundEnabled', value)} label={t('settings.soundEnabled')} />}
              >
                <div className="settings-choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="radiogroup">
                  {KEY_PROFILES.map(profile => {
                    const selected = settings.soundProfile === profile.id;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={settings.soundEnabled === false}
                        onClick={() => {
                          handleChange('soundProfile', profile.id);
                          audioEngine.setProfile(profile.id);
                          audioEngine.playKey('a', 'KeyA');
                        }}
                        className={`settings-choice ${selected ? 'settings-choice-active' : ''}`}
                      >
                        <span className="settings-choice-label settings-choice-label-split">
                          <span>{t(`soundProfiles.${profile.id}`, {}, profile.name)}</span>
                          {profile.badge && <span className="settings-mini-badge">{profile.badge}</span>}
                        </span>
                        <span className="settings-choice-sub">{t(`soundProfileDescriptions.${profile.id}`, {}, profile.description)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="settings-range-row">
                  <RangeField
                    label={t('settings.soundVolume')}
                    value={settings.soundVolume ?? 0.55}
                    display={`${Math.round((settings.soundVolume ?? 0.55) * 100)}%`}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={value => {
                      handleChange('soundVolume', value);
                      audioEngine.setVolume(value);
                    }}
                  />
                  <button type="button" className="m3-btn m3-btn-tonal" onClick={() => audioEngine.playKey('a', 'KeyA')} disabled={settings.soundEnabled === false}>
                    <Play size={12} /> {t('settings.tryKey')}
                  </button>
                </div>
              </Section>

              <Section icon={Headphones} title={t('settings.ambientTitle')}>
                <ChoiceGrid
                  columns={2}
                  value={settings.ambientTrack || 'none'}
                  onChange={id => {
                    handleChange('ambientTrack', id);
                    audioEngine.startAmbient(id);
                  }}
                  options={AMBIENT_TRACKS.map(track => ({
                    id: track.id,
                    label: t(`ambient.${track.id}.name`, {}, track.name),
                    sub: t(`ambient.${track.id}.description`, {}, track.description)
                  }))}
                />
                <RangeField
                  label={t('settings.ambientVolume')}
                  value={settings.ambientVolume ?? 0.35}
                  display={`${Math.round((settings.ambientVolume ?? 0.35) * 100)}%`}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={value => {
                    handleChange('ambientVolume', value);
                    audioEngine.setAmbientVolume(value);
                  }}
                />
              </Section>
            </div>
          )}

          {/* ------------------------------------------------ AI */}
          {activeTab === 'ai' && (
            <div key="ai" className="m3-tab-content-fluid settings-stack">
              <div>
                <h4 className="settings-label">{t('settings.aiProvider')}</h4>
                <ChoiceGrid
                  columns={4}
                  value={settings.aiProvider}
                  onChange={value => handleChange('aiProvider', value)}
                  options={PROVIDERS.map(id => ({ id, label: t(`providers.${id}.name`), sub: t(`providers.${id}.sub`) }))}
                />
              </div>

              {settings.aiProvider === 'claude' && (
                <Section icon={KeyRound} title={t('providers.claude.keyTitle')}>
                  <div className="settings-field">
                    <div className="settings-field-head">
                      <label>{t('settings.apiKey')}</label>
                      <a href="https://console.anthropic.com/settings/keys">{t('providers.claude.getKey')} ↗</a>
                    </div>
                    <div className="settings-input-row">
                      <SecretInput
                        value={settings.claudeApiKey || ''}
                        onChange={value => {
                          handleChange('claudeApiKey', value);
                          setStatus('claude', null);
                        }}
                        placeholder="sk-ant-..."
                        label={t('settings.apiKey')}
                      />
                      <button type="button" onClick={handleTestClaude} disabled={testing !== null} className="m3-btn m3-btn-tonal">
                        <Zap size={14} className={testing === 'claude' ? 'animate-spin' : ''} />
                        <span>{testing === 'claude' ? t('settings.checking') : t('settings.checkKey')}</span>
                      </button>
                    </div>
                    <StatusNote status={testStatus.claude} />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.model')}</label>
                    <ChoiceGrid
                      value={settings.claudeModel || DEFAULT_CLAUDE_MODEL}
                      onChange={value => {
                        handleChange('claudeModel', value);
                        setStatus('claude', null);
                      }}
                      options={CLAUDE_MODELS.map(model => ({ id: model.id, label: model.label, sub: t(model.hintKey) }))}
                    />
                  </div>
                  <p className="settings-hint">{t('providers.claude.privacy')}</p>
                </Section>
              )}

              {settings.aiProvider === 'gemini' && (
                <Section icon={KeyRound} title={t('providers.gemini.keyTitle')}>
                  <div className="settings-field">
                    <div className="settings-field-head">
                      <label>{t('settings.apiKey')}</label>
                      <a href="https://aistudio.google.com/app/apikey">{t('providers.gemini.getKey')} ↗</a>
                    </div>
                    <div className="settings-input-row">
                      <SecretInput
                        value={settings.geminiApiKey || ''}
                        onChange={value => {
                          handleChange('geminiApiKey', value);
                          setModels(current => ({ ...current, gemini: [] }));
                          setStatus('gemini', null);
                        }}
                        placeholder="AIzaSy..."
                        label={t('settings.apiKey')}
                      />
                      <button type="button" onClick={handleTestGemini} disabled={testing !== null} className="m3-btn m3-btn-tonal">
                        <Zap size={14} className={testing === 'gemini' ? 'animate-spin' : ''} />
                        <span>{testing === 'gemini' ? t('settings.checking') : t('settings.checkKey')}</span>
                      </button>
                    </div>
                    <StatusNote status={testStatus.gemini} />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.model')}</label>
                    <select
                      className="settings-input"
                      value={settings.geminiModel || 'gemini-2.0-flash'}
                      onChange={event => handleChange('geminiModel', event.target.value)}
                    >
                      {models.gemini.length === 0
                        ? <option value={settings.geminiModel || 'gemini-2.0-flash'}>{settings.geminiModel || 'gemini-2.0-flash'}</option>
                        : models.gemini.map(model => <option key={model.id} value={model.id}>{model.label} ({model.id})</option>)}
                    </select>
                    <p className="settings-hint">{models.gemini.length ? t('settings.modelsLoaded') : t('settings.checkToLoadModels')}</p>
                  </div>
                </Section>
              )}

              {settings.aiProvider === 'openai' && (
                <Section icon={KeyRound} title={t('providers.openai.keyTitle')}>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.apiKey')}</label>
                    <div className="settings-input-row">
                      <SecretInput
                        value={settings.openaiApiKey || ''}
                        onChange={value => {
                          handleChange('openaiApiKey', value);
                          setModels(current => ({ ...current, openai: [] }));
                          setStatus('openai', null);
                        }}
                        placeholder="sk-..."
                        label={t('settings.apiKey')}
                      />
                      <button type="button" onClick={() => handleTestCompatible('openai')} disabled={testing !== null} className="m3-btn m3-btn-tonal">
                        <Zap size={13} className={testing === 'openai' ? 'animate-spin' : ''} />
                        <span>{testing === 'openai' ? t('settings.checking') : t('settings.checkAndLoad')}</span>
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.endpoint')}</label>
                    <input
                      type="text"
                      className="settings-input settings-input-mono"
                      value={settings.openaiEndpoint || 'https://api.openai.com/v1'}
                      onChange={event => {
                        handleChange('openaiEndpoint', event.target.value);
                        setModels(current => ({ ...current, openai: [] }));
                        setStatus('openai', null);
                      }}
                      spellCheck={false}
                    />
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.model')}</label>
                    <select className="settings-input" value={settings.openaiModel || 'gpt-4o-mini'} onChange={event => handleChange('openaiModel', event.target.value)}>
                      {models.openai.length === 0
                        ? <option value={settings.openaiModel || 'gpt-4o-mini'}>{settings.openaiModel || 'gpt-4o-mini'}</option>
                        : models.openai.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </select>
                  </div>
                  <StatusNote status={testStatus.openai} />
                </Section>
              )}

              {settings.aiProvider === 'ollama' && (
                <Section icon={KeyRound} title={t('providers.ollama.keyTitle')} description={t('providers.ollama.desc')}>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.endpoint')}</label>
                    <div className="settings-input-row">
                      <input
                        type="text"
                        className="settings-input settings-input-mono"
                        value={settings.ollamaEndpoint || 'http://localhost:11434/v1'}
                        onChange={event => {
                          handleChange('ollamaEndpoint', event.target.value);
                          setModels(current => ({ ...current, ollama: [] }));
                          setStatus('ollama', null);
                        }}
                        spellCheck={false}
                      />
                      <button type="button" onClick={() => handleTestCompatible('ollama')} disabled={testing !== null} className="m3-btn m3-btn-tonal">
                        <Zap size={13} className={testing === 'ollama' ? 'animate-spin' : ''} />
                        <span>{testing === 'ollama' ? t('settings.checking') : t('settings.checkAndLoad')}</span>
                      </button>
                    </div>
                  </div>
                  <div className="settings-field">
                    <label className="settings-field-label">{t('settings.installedModel')}</label>
                    <select className="settings-input" value={settings.ollamaModel || 'llama3:latest'} onChange={event => handleChange('ollamaModel', event.target.value)}>
                      {models.ollama.length === 0
                        ? <option value={settings.ollamaModel || 'llama3:latest'}>{settings.ollamaModel || 'llama3:latest'}</option>
                        : models.ollama.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
                    </select>
                  </div>
                  <StatusNote status={testStatus.ollama} />
                </Section>
              )}

              <Section
                icon={Zap}
                title={t('settings.realtimeTitle')}
                description={t('settings.realtimeDesc')}
                toggle={(
                  <Toggle
                    checked={settings.chunkCheckingEnabled ?? false}
                    onChange={value => {
                      localStorage.setItem('bookify_realtime_correction_preference_v1', 'true');
                      handleChange('chunkCheckingEnabled', value);
                    }}
                    label={t('settings.realtimeTitle')}
                  />
                )}
              />

              <Section
                icon={BookOpen}
                title={t('settings.autoBibleTitle')}
                description={t('settings.autoBibleDesc')}
                toggle={<Toggle checked={settings.autoSyncBible ?? true} onChange={value => handleChange('autoSyncBible', value)} label={t('settings.autoBibleTitle')} />}
              />

              <section className="settings-section">
                <div className="settings-section-head">
                  <div className="settings-section-title"><h3>{t('settings.usageTitle')}</h3></div>
                  <span className="settings-usage-total">
                    {t('settings.tokens', { count: new Intl.NumberFormat(locale).format(providerUsage.totalTokens || 0) })}
                  </span>
                </div>
                <p className="settings-section-desc">
                  {t('settings.usageDesc', { requests: providerUsage.requests || 0, metered: providerUsage.meteredRequests || 0 })}
                </p>
                <p className="settings-hint">
                  {t('settings.usageHint')}{' '}
                  {usageLinks[settings.aiProvider] && <a href={usageLinks[settings.aiProvider]}>{t('settings.openUsage', { provider: t(`providers.${settings.aiProvider}.name`) })} ↗</a>}
                </p>
              </section>
            </div>
          )}
        </div>
        </div>

        <footer className="bk-dialog-footer bk-dialog-footer-split">
          <a href={DEVELOPER_URL} className="settings-credit">
            <span>{t('settings.madeBy', { name: 'Violet M.' })}</span>
            <ExternalLink size={12} className="ic-nudge" />
          </a>
          <button type="button" onClick={onClose} className="m3-btn m3-btn-filled">{t('common.done')}</button>
        </footer>
      </div>
    </div>
  );
}
