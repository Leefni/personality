export const PAGE_SIZE = 10;
export const APP_ENV = (window.APP_ENV || 'production').toLowerCase();
export const IS_DEVELOPMENT_ENV = APP_ENV === 'development' || APP_ENV === 'local';
export const ANSWERS_STORAGE_KEY = 'personality.answers.v1';
export const likertLabels = [
  'Helemaal oneens',
  'Oneens',
  'Neutraal',
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
  const response = await fetch(url, options);
  if (!response.ok) {
    const fallbackText = await response.text();
    let payload = null;
    try {
      payload = fallbackText ? JSON.parse(fallbackText) : null;
    } catch (error) {
      try {
        payload = await response.clone().text();
      } catch (fallbackError) {
        payload = null;
      }
    }

    const requestError = new Error('Request failed: ' + url);
    requestError.status = response.status;
    requestError.payload = payload;
    requestError.text = fallbackText || null;
    requestError.url = url;
    throw requestError;
  }

  return response.json();
}

export function formatApiError(error, fallbackMessage) {
  const statusMessages = {
    400: 'Je verzoek is ongeldig. Controleer je invoer en probeer opnieuw.',
    422: 'Niet alle gegevens zijn compleet of geldig. Vul ontbrekende velden in en probeer opnieuw.',
    500: 'Er ging iets mis op de server. Probeer het later opnieuw.'
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
