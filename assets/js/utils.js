export const PAGE_SIZE = 10;
export const APP_ENV = (window.APP_ENV || 'production').toLowerCase();
export const IS_DEVELOPMENT_ENV = APP_ENV === 'development' || APP_ENV === 'local';
export const ANSWERS_STORAGE_KEY = 'personality.answers.v1';
export const API_TIMEOUT_MS = 12000;
export const likertLabels = [
  'Helemaal oneens',
  'Oneens',
  'Licht oneens',
  'Licht eens',
  'Eens',
  'Helemaal eens'
];

export function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(ANSWERS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const normalized = {};
    Object.entries(parsed).forEach(([questionId, value]) => {
      const id = Number(questionId);
      const numericValue = Number(value);
      if (Number.isInteger(id) && Number.isFinite(numericValue)) {
        normalized[id] = numericValue;
      }
    });

    return normalized;
  } catch (error) {
    return {};
  }
}

export function saveLocalDraft(draft) {
  localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(draft));
}

export function clearLocalDraft() {
  localStorage.removeItem(ANSWERS_STORAGE_KEY);
}

export function buildDebugHint(endpoint, status) {
  const statusLabel = Number.isFinite(status) ? status : 'onbekend';
  return `Technische hint: ${endpoint} (status: ${statusLabel})`;
}

export function showError(message, targetId = 'progress') {
  const target = document.getElementById(targetId);
  if (!target) return;

  const notice = document.createElement('div');
  notice.className = 'error-notice';
  notice.textContent = message;

  const container = target.parentElement || target;
  container.insertBefore(notice, target.nextSibling);

  window.setTimeout(() => {
    notice.remove();
  }, 4000);
}

export async function apiFetch(url, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : API_TIMEOUT_MS;
  const { timeoutMs: _timeoutMs, ...requestOptions } = options;
  const controller = new AbortController();
  const abortTimerId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(url, { ...requestOptions, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Request timed out: ' + url);
      timeoutError.status = 408;
      timeoutError.url = url;
      timeoutError.isTimeout = true;
      timeoutError.timeoutMs = timeoutMs;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(abortTimerId);
  }

  const text = await response.text();
  const hasBody = text.trim().length > 0;
  const bodyPreview = text.slice(0, 180);

  let payload = null;
  let jsonParseError = null;
  if (hasBody) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      jsonParseError = error;
    }
  }

  if (!response.ok) {
    const requestError = new Error('Request failed: ' + url);
    requestError.status = response.status;
    requestError.payload = payload;
    requestError.text = text || null;
    requestError.bodyPreview = bodyPreview || null;
    requestError.isJsonParseError = Boolean(jsonParseError);
    requestError.parseErrorMessage = jsonParseError?.message || null;
    requestError.url = url;
    throw requestError;
  }

  if (jsonParseError) {
    const parseError = new Error('Response JSON parse failed');
    parseError.status = response.status;
    parseError.url = url;
    parseError.text = text || null;
    parseError.bodyPreview = bodyPreview || null;
    parseError.isJsonParseError = true;
    parseError.parseErrorMessage = jsonParseError.message;
    throw parseError;
  }

  return payload;
}

export function formatApiError(error, fallbackMessage) {
  const statusMessages = {
    400: 'Je verzoek is ongeldig. Controleer je invoer en probeer opnieuw.',
    422: 'Niet alle gegevens zijn compleet of geldig. Vul ontbrekende velden in en probeer opnieuw.',
    500: 'Er ging iets mis op de server. Probeer het later opnieuw.',
    408: 'Verbinding met de server duurde te lang. Controleer je netwerk en probeer opnieuw.'
  };

  const message = statusMessages[error?.status] || fallbackMessage;

  if (IS_DEVELOPMENT_ENV) {
    console.error('API error:', {
      message,
      status: error?.status,
      payload: error?.payload,
      text: error?.text,
      url: error?.url
    });
  }

  return message;
}
