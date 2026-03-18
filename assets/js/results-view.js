import { RESULT_CONTENT } from './result-content.js';

/**
 * Renders the result card and wires the restart button callback.
 * @param {{type?: string}} data - API result payload containing the personality type.
 * @param {() => void} onRestart - Callback used when user clicks restart.
 * @returns {void} Nothing.
 */
export function renderResult(data, onRestart) {
  const res = document.getElementById('result');
  const type = typeof data.type === 'string' ? data.type : '----';
  const details = RESULT_CONTENT.types[type];
  const description = details?.shortDescription ?? 'Geen beschrijving beschikbaar voor dit type.';

  res.innerHTML = `
    <h2>Resultaat</h2>
    <p>Persoonlijkheidstype: <strong>${type}</strong></p>
    <p>${description}</p>
    <button type="button" class="restart">Opnieuw doen</button>
  `;

  res.querySelector('.restart')?.addEventListener('click', onRestart);

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
