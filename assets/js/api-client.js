const APP_ENV = window.APP_ENV || 'production';
export const IS_DEVELOPMENT = APP_ENV === 'development';

export function buildDebugHint(endpoint, status) {
  const statusLabel = Number.isFinite(status) ? status : 'onbekend';
  return `Technische hint: ${endpoint} (status: ${statusLabel})`;
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

  if (IS_DEVELOPMENT) {
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
