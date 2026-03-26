import { RESULT_CONTENT } from './result-content.js';

function toSafeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Renders the result card and wires action button callbacks.
 * @param {{type?: string}} data - API result payload.
 * @param {() => void} onRestart - Callback used when user clicks restart.
 * @returns {void} Nothing.
 */
export function renderResult(data, onRestart) {
  const res = document.getElementById('result');
  const type = toSafeText(data?.type, '----');
  const details = RESULT_CONTENT.types[type];

  const shortDescription = toSafeText(details?.shortDescription, 'Geen beschrijving beschikbaar voor dit type.');
  const longDescription = toSafeText(details?.longDescriptionNl, shortDescription);

  res.innerHTML = `
    <section class="result-card">
      <h2 id="result-heading" tabindex="-1">Resultaat</h2>
      <p class="result-type">Persoonlijkheidstype: <strong translate="no">${escapeHtml(type)}</strong></p>
      <p class="result-short-description">${escapeHtml(shortDescription)}</p>
      <article class="result-section-card">
        <h3>Lange beschrijving</h3>
        <p>${escapeHtml(longDescription)}</p>
      </article>
      <div class="result-actions">
        <button type="button" class="restart">Opnieuw doen</button>
      </div>
    </section>
  `;

  res.querySelector('.restart')?.addEventListener('click', onRestart);
  const resultHeading = res.querySelector('#result-heading');
  if (resultHeading instanceof HTMLElement) {
    resultHeading.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
