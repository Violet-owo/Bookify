// Single entry point for every AI request in Bookify.
//
// Providers: Claude (Anthropic SDK), Google Gemini, OpenAI-compatible APIs and
// local Ollama. Callers describe the task (prompt, JSON or prose, effort) and
// never deal with provider-specific request shapes.
// The Anthropic SDK is loaded on first use to keep the startup bundle small
let AnthropicSDK = null;
async function loadAnthropic() {
  if (!AnthropicSDK) AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
  return AnthropicSDK;
}
import { translate } from './i18n';

export const AI_USAGE_EVENT = 'bookify-ai-usage-updated';

export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hintKey: 'claudeModels.opus' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hintKey: 'claudeModels.sonnet' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hintKey: 'claudeModels.haiku' }
];
export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

export const PROVIDER_LABELS = {
  claude: 'Claude',
  gemini: 'Gemini',
  openai: 'OpenAI',
  ollama: 'Ollama'
};

const tr = (settings, key, params) => translate(key, settings?.language || 'it', params);

/** Is an AI provider configured well enough to send requests? */
export function hasAIProvider(settings = {}) {
  switch (settings.aiProvider) {
    case 'claude': return Boolean(settings.claudeApiKey?.trim());
    case 'gemini': return Boolean(settings.geminiApiKey?.trim());
    case 'openai': return Boolean(settings.openaiApiKey?.trim());
    case 'ollama': return Boolean(settings.ollamaEndpoint?.trim());
    default: return false;
  }
}

export function providerLabel(settings = {}) {
  return PROVIDER_LABELS[settings.aiProvider] || 'AI';
}

/** Fingerprint of the active provider + model (used to invalidate cached reviews). */
export function providerFingerprint(settings = {}) {
  const model = {
    claude: settings.claudeModel || DEFAULT_CLAUDE_MODEL,
    gemini: settings.geminiModel,
    openai: settings.openaiModel,
    ollama: settings.ollamaModel
  }[settings.aiProvider];
  const endpoint = settings.aiProvider === 'ollama' ? settings.ollamaEndpoint : settings.aiProvider === 'openai' ? settings.openaiEndpoint : '';
  return `${settings.aiProvider}|${model}|${endpoint}`;
}

// ---------------------------------------------------------------------------
// Usage statistics (local, per month)
// ---------------------------------------------------------------------------
function usageKey() {
  return `bookify_ai_usage_${new Date().toISOString().slice(0, 7)}`;
}

const EMPTY_USAGE = { requests: 0, meteredRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, providers: {} };

export function readAIUsage() {
  try {
    return { ...EMPTY_USAGE, ...JSON.parse(localStorage.getItem(usageKey()) || '{}') };
  } catch {
    return { ...EMPTY_USAGE };
  }
}

export function recordUsage(provider, promptTokens = 0, completionTokens = 0) {
  try {
    const total = Number(promptTokens) + Number(completionTokens);
    const metered = total > 0 ? 1 : 0;
    const stats = readAIUsage();
    const bump = (s = {}) => ({
      requests: (s.requests || 0) + 1,
      meteredRequests: (s.meteredRequests || 0) + metered,
      promptTokens: (s.promptTokens || 0) + Number(promptTokens),
      completionTokens: (s.completionTokens || 0) + Number(completionTokens),
      totalTokens: (s.totalTokens || 0) + total
    });
    const next = { ...bump(stats), providers: { ...stats.providers, [provider]: bump(stats.providers?.[provider]) } };
    localStorage.setItem(usageKey(), JSON.stringify(next));
    window.dispatchEvent(new Event(AI_USAGE_EVENT));
  } catch { /* statistics are best-effort */ }
}

// ---------------------------------------------------------------------------
// HTTP helpers (Gemini / OpenAI-compatible)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, attempts = 3) {
  let response;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(url, options);
    } catch (error) {
      if (error.name === 'AbortError' || attempt === attempts - 1) throw error;
      await sleep(Math.min(1000 * 2 ** attempt, 8000));
      continue;
    }
    if (![500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) return response;
    const retryAfter = Number(response.headers.get('Retry-After'));
    await sleep(Math.max(Math.min(1000 * 2 ** attempt, 8000), Number.isFinite(retryAfter) ? retryAfter * 1000 : 0));
  }
  return response;
}

async function httpError(settings, response, provider) {
  let detail = '';
  try {
    const data = await response.clone().json();
    detail = data.error?.message || data.message || '';
  } catch { /* not JSON */ }
  const status = response.status;
  if (status === 401 || status === 403) return new Error(tr(settings, 'ai.errorAuth', { provider, status }));
  if (status === 429) return Object.assign(new Error(tr(settings, 'ai.errorRateLimit', { provider })), { isRateLimit: true });
  if (status >= 500) return new Error(tr(settings, 'ai.errorUnavailable', { provider, status }));
  return new Error(detail ? `${provider} (HTTP ${status}): ${detail}` : tr(settings, 'ai.errorRejected', { provider, status }));
}

function languageDirective(settings) {
  return settings.language === 'en'
    ? 'The author writes in English. Write every explanation, note and rewritten passage in natural, polished English, even though these instructions are in Italian. Keep JSON keys exactly as requested.'
    : 'Rispondi in italiano naturale e impeccabile. Mantieni le chiavi JSON esattamente come richieste.';
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
async function callGemini(settings, { prompt, system, json, temperature, maxTokens, signal, attempts }) {
  const model = settings.geminiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiApiKey.trim() },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        ...(json ? { responseMimeType: 'application/json' } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {})
      }
    })
  }, attempts);
  if (!response.ok) throw await httpError(settings, response, 'Gemini');

  const data = await response.json();
  const usage = data.usageMetadata || {};
  recordUsage('gemini', usage.promptTokenCount, usage.candidatesTokenCount);

  const text = (data.candidates || [])
    .flatMap(candidate => candidate.content?.parts || [])
    .map(part => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason;
    if (reason === 'SAFETY' || data.promptFeedback?.blockReason) throw new Error(tr(settings, 'ai.errorSafety', { provider: 'Gemini' }));
    if (reason === 'MAX_TOKENS') throw new Error(tr(settings, 'ai.errorTruncated', { provider: 'Gemini' }));
    throw new Error(tr(settings, 'ai.errorEmpty', { provider: 'Gemini' }));
  }
  return text;
}

async function callOpenAICompatible(settings, { prompt, system, temperature, maxTokens, signal, attempts }) {
  const isOllama = settings.aiProvider === 'ollama';
  const provider = isOllama ? 'Ollama' : 'OpenAI';
  const endpoint = ((isOllama ? settings.ollamaEndpoint : settings.openaiEndpoint) || '').replace(/\/+$/, '');
  const model = (isOllama ? settings.ollamaModel : settings.openaiModel) || (isOllama ? 'llama3:latest' : 'gpt-4o-mini');

  let response;
  try {
    response = await fetchWithRetry(`${endpoint}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(!isOllama ? { Authorization: `Bearer ${settings.openaiApiKey.trim()}` } : {})
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        ...(temperature !== undefined ? { temperature } : {}),
        ...(isOllama ? { think: false } : maxTokens ? { max_tokens: maxTokens } : {})
      })
    }, attempts);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(tr(settings, isOllama ? 'ai.errorOllamaOffline' : 'ai.errorNetwork', { provider, endpoint }));
  }
  if (!response.ok) throw await httpError(settings, response, provider);

  const data = await response.json();
  recordUsage(settings.aiProvider, data.usage?.prompt_tokens ?? data.prompt_eval_count, data.usage?.completion_tokens ?? data.eval_count);
  const text = (data.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error(tr(settings, 'ai.errorEmpty', { provider }));
  return text;
}

let cachedClaude = { key: null, client: null };
async function claudeClient(apiKey) {
  const Anthropic = await loadAnthropic();
  if (cachedClaude.key !== apiKey) {
    // Bookify is a local desktop app: the user's own key never leaves their machine
    // except to call the Anthropic API directly.
    cachedClaude = { key: apiKey, client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 }) };
  }
  return cachedClaude.client;
}

function claudeError(settings, error) {
  const Anthropic = AnthropicSDK;
  if (!Anthropic) return error;
  if (error instanceof Anthropic.APIUserAbortError || error?.name === 'AbortError') {
    const abort = new Error(tr(settings, 'ai.cancelled'));
    abort.name = 'AbortError';
    return abort;
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new Error(tr(settings, 'ai.errorAuth', { provider: 'Claude', status: error.status }));
  }
  if (error instanceof Anthropic.RateLimitError) {
    return Object.assign(new Error(tr(settings, 'ai.errorRateLimit', { provider: 'Claude' })), { isRateLimit: true });
  }
  if (error instanceof Anthropic.NotFoundError) return new Error(tr(settings, 'ai.errorModel', { provider: 'Claude' }));
  if (error instanceof Anthropic.APIConnectionError) return new Error(tr(settings, 'ai.errorNetwork', { provider: 'Claude', endpoint: 'api.anthropic.com' }));
  if (error instanceof Anthropic.InternalServerError) return new Error(tr(settings, 'ai.errorUnavailable', { provider: 'Claude', status: error.status }));
  if (error instanceof Anthropic.APIError) return new Error(`Claude (HTTP ${error.status}): ${error.message}`);
  return error;
}

async function callClaude(settings, { prompt, system, maxTokens, signal, effort, stream }) {
  const client = await claudeClient(settings.claudeApiKey.trim());
  const model = settings.claudeModel || DEFAULT_CLAUDE_MODEL;
  const supportsFallback = model.startsWith('claude-opus-5') || model.startsWith('claude-sonnet-5-5');

  const params = {
    model,
    max_tokens: stream ? Math.max(maxTokens || 0, 64000) : Math.max(maxTokens || 0, 16000),
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: effort || 'medium' },
    // If a safety classifier declines, retry transparently on the fallback model
    ...(supportsFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {})
  };
  const messagesApi = supportsFallback ? client.beta.messages : client.messages;

  let message;
  try {
    message = stream
      ? await messagesApi.stream(params, { signal }).finalMessage()
      : await messagesApi.create(params, { signal });
  } catch (error) {
    throw claudeError(settings, error);
  }

  recordUsage('claude', message.usage?.input_tokens, message.usage?.output_tokens);

  if (message.stop_reason === 'refusal') throw new Error(tr(settings, 'ai.errorRefusal', { provider: 'Claude' }));
  const text = message.content.filter(block => block.type === 'text').map(block => block.text).join('').trim();
  if (!text) {
    throw new Error(tr(settings, message.stop_reason === 'max_tokens' ? 'ai.errorTruncated' : 'ai.errorEmpty', { provider: 'Claude' }));
  }
  return text;
}

/**
 * Send one request to the configured provider and return the response text.
 *
 * @param {object} settings  app settings (provider, keys, models, language)
 * @param {object} task
 * @param {string} task.prompt       the user prompt
 * @param {string} [task.system]     extra system instructions
 * @param {boolean} [task.json]      ask for a JSON response
 * @param {number} [task.temperature] ignored by Claude (fixed sampling on current models)
 * @param {number} [task.maxTokens]
 * @param {'low'|'medium'|'high'} [task.effort] Claude reasoning effort
 * @param {boolean} [task.long]      long output (chapter refinement/review): streamed on Claude
 * @param {AbortSignal} [task.signal]
 */
export async function callLLM(settings, task) {
  if (!hasAIProvider(settings)) throw new Error(tr(settings, 'ai.notConfigured'));
  const system = [languageDirective(settings), task.json ? 'Return only valid JSON, with no markdown fences and no text before or after it.' : '', task.system || '']
    .filter(Boolean)
    .join('\n\n');
  const request = { ...task, system, attempts: task.attempts ?? 3 };

  switch (settings.aiProvider) {
    case 'claude': return callClaude(settings, { ...request, stream: Boolean(task.long) });
    case 'gemini': return callGemini(settings, request);
    case 'openai':
    case 'ollama': return callOpenAICompatible(settings, request);
    default: throw new Error(tr(settings, 'ai.notConfigured'));
  }
}

/** Validate a Claude key and list the models it can use. */
export async function testClaudeKey(settings) {
  const client = await claudeClient((settings.claudeApiKey || '').trim());
  try {
    const ids = [];
    for await (const model of client.models.list({ limit: 100 })) ids.push(model.id);
    return ids;
  } catch (error) {
    throw claudeError(settings, error);
  }
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
export function extractJson(text) {
  if (!text) return '';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) return body;
  const open = body[start];
  const close = open === '{' ? '}' : ']';
  const end = body.lastIndexOf(close);
  return end > start ? body.slice(start, end + 1) : body.slice(start);
}

export function parseJsonResponse(text, fallback = null) {
  try {
    return JSON.parse(extractJson(text));
  } catch {
    return fallback;
  }
}
