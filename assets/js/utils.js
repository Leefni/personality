export const PAGE_SIZE = 10;
// Read APP_ENV from the data attribute set by PHP — avoids an inline <script> tag
// so the Content-Security-Policy can omit 'unsafe-inline' for scripts.
const APP_ENV = (
  document.querySelector('[data-app-env]')?.dataset?.appEnv ?? 'production'
).toLowerCase();
export const IS_DEVELOPMENT_ENV = APP_ENV === 'development' || APP_ENV === 'local';
const ANSWERS_STORAGE_KEY = 'personality.answers.v1';
const PENDING_RETRY_STORAGE_KEY = 'personality.pendingRetries.v1';
const API_TIMEOUT_MS = 12000;
const API_RETRY_ATTEMPTS = 2;       // extra attempts after first failure
const API_RETRY_BASE_DELAY_MS = 400; // first retry after 400 ms, doubles each time

export const likertLabels = [
  'Helemaal oneens',
  'Oneens',
  'Eerder oneens',
  'Eerder eens',
  'Eens',
  'Helemaal eens'
];

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

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
  try {
    localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    // Ignore storage failures (private mode / quota exceeded).
  }
}

export function clearLocalDraft() {
  try {
    localStorage.removeItem(ANSWERS_STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
}

export function loadPendingRetries() {
  try {
    const raw = localStorage.getItem(PENDING_RETRY_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const normalized = {};
    Object.keys(parsed).forEach((questionId) => {
      const id = Number(questionId);
      if (Number.isInteger(id) && parsed[questionId]) {
        normalized[id] = true;
      }
    });

    return normalized;
  } catch (error) {
    return {};
  }
}

export function savePendingRetries(markers) {
  try {
    localStorage.setItem(PENDING_RETRY_STORAGE_KEY, JSON.stringify(markers));
  } catch (error) {
    // Ignore storage failures (private mode / quota exceeded).
  }
}

export function clearPendingRetries() {
  try {
    localStorage.removeItem(PENDING_RETRY_STORAGE_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
}

export function buildDebugHint(endpoint, status) {
  const statusLabel = Number.isFinite(status) ? status : 'onbekend';
  return `Technische hint: ${endpoint} (status: ${statusLabel})`;
}

export function showError(message) {
  const notice = document.createElement('div');
  notice.className = 'error-notice';
  notice.setAttribute('role', 'alert');
  notice.textContent = message;

  // Append to body so it sits in fixed position above everything, never lost
  // inside a grid container.
  document.body.appendChild(notice);

  window.setTimeout(() => {
    notice.remove();
  }, 5000);
}

/**
 * Returns true for status codes that are worth retrying (network/server transient errors).
 * We never retry 4xx client errors.
 * @param {number|undefined} status
 */
function isRetryableStatus(status) {
  if (status === undefined) return true; // network failure (no status)
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Sleeps for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Low-level HTTP fetch with timeout and exponential-backoff retry.
 * @param {string} url
 * @param {Object} [options]
 * @returns {Promise<any>}
 */
export async function apiFetch(url, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : API_TIMEOUT_MS;
  // Never retry non-idempotent POST requests — a save that succeeds on attempt 1
  // but whose response is lost in transit should not be silently re-sent.
  const isPost = (options.method || 'GET').toUpperCase() === 'POST';
  const maxRetries = isPost ? 0 : (Number.isFinite(options.retries) ? Number(options.retries) : API_RETRY_ATTEMPTS);
  const { timeoutMs: _t, retries: _r, ...requestOptions } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const controller = new AbortController();
    const abortTimerId = window.setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(url, { ...requestOptions, signal: controller.signal });
    } catch (fetchError) {
      // Cancel the abort timer immediately — we already failed.
      window.clearTimeout(abortTimerId);
      if (fetchError?.name === 'AbortError') {
        const timeoutError = new Error('Request timed out: ' + url);
        timeoutError.status = 408;
        timeoutError.url = url;
        timeoutError.isTimeout = true;
        timeoutError.timeoutMs = timeoutMs;
        lastError = timeoutError;
      } else {
        lastError = fetchError;
        lastError.url = url;
      }
      continue;
    }

    // Cancel the abort timer as soon as the response headers arrive — before
    // reading the body — so an in-progress response.text() can never be aborted
    // by our own timer and incorrectly surface as a network failure.
    window.clearTimeout(abortTimerId);

    let text = '';
    try {
      text = await response.text();
    } catch (bodyError) {
      // Body read failed (e.g. connection reset mid-stream). Treat as retryable.
      const readError = new Error('Response body read failed: ' + url);
      readError.status = response.status;
      readError.url = url;
      lastError = readError;
      continue;
    }

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
      lastError = requestError;

      if (!isRetryableStatus(response.status)) {
        throw requestError; // 4xx client error: don't retry.
      }
      continue; // 5xx / 429 / 408: retry.
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

    return payload; // Success.
  }

  throw lastError;
}

export function formatApiError(error, fallbackMessage) {
  const statusMessages = {
    400: 'Je verzoek is ongeldig. Controleer je invoer en probeer opnieuw.',
    422: 'Niet alle gegevens zijn compleet of geldig. Vul ontbrekende velden in en probeer opnieuw.',
    429: 'Te veel verzoeken in korte tijd. Wacht even en probeer opnieuw.',
    410: 'Deze herstel-link is verlopen of al gebruikt.',
    500: 'Er ging iets mis op de server. Probeer het later opnieuw.',
    408: 'Verbinding met de server duurde te lang. Controleer je netwerk en probeer opnieuw.'
  };

  const message = statusMessages[error?.status] || fallbackMessage;

  // Always log to console so errors are visible in DevTools regardless of env.
  console.error('[API error]', {
    url: error?.url,
    status: error?.status,
    message,
    responseBody: error?.text,
    payload: error?.payload,
  });

  return message;
}
