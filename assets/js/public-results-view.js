import { fetchPublicResults } from './api-client.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDimensionSummary(scores) {
  if (!scores || typeof scores !== 'object') {
    return 'Geen dimensiescore beschikbaar.';
  }

  const dimensions = ['EI', 'SN', 'TF', 'JP'];
  const summary = dimensions.map((dimension) => {
    const raw = Number(scores[dimension]);
    if (!Number.isFinite(raw)) return `${dimension}: n.v.t.`;

    const leftPole = dimension[0];
    const rightPole = dimension[1];
    const dominantPole = raw >= 0 ? leftPole : rightPole;
    const intensity = Math.min(100, Math.round(Math.abs(raw) * 10));
    return `${dimension}: ${dominantPole} ${intensity}%`;
  });

  return summary.join(' • ');
}

function createCard(result) {
  const displayName = typeof result.display_name === 'string' ? result.display_name.trim() : '';
  const rawTypeCode = typeof result.type_code === 'string' ? result.type_code : result.type;
  const typeCode = typeof rawTypeCode === 'string' && rawTypeCode.trim() !== '' ? rawTypeCode.trim() : '----';
  const createdAt = typeof result.created_at === 'string' && result.created_at.trim() !== '' ? result.created_at.trim() : 'Onbekende datum';
  const dimensions = formatDimensionSummary(result.scores);

  return `
    <article class="public-result-card">
      <header class="public-result-card__header">
        <p class="public-result-card__name">${escapeHtml(displayName)}</p>
        <p class="public-result-card__type" translate="no">${escapeHtml(typeCode)}</p>
      </header>
      <p class="public-result-card__date">${escapeHtml(createdAt)}</p>
      <p class="public-result-card__dimensions">${escapeHtml(dimensions)}</p>
    </article>
  `;
}

function renderResults(payload) {
  const list = document.getElementById('public-results-list');
  const status = document.getElementById('public-results-status');
  if (!(list instanceof HTMLElement) || !(status instanceof HTMLElement)) return;

  const entries = Array.isArray(payload?.results) ? payload.results : [];

  status.hidden = true;
  status.setAttribute('aria-busy', 'false');

  if (entries.length === 0) {
    status.hidden = false;
    status.textContent = 'Nog geen gedeelde resultaten gevonden.';
    return;
  }

  list.innerHTML = entries.map((entry) => createCard(entry)).join('');
}

function renderError() {
  const status = document.getElementById('public-results-status');
  if (!(status instanceof HTMLElement)) return;

  status.hidden = false;
  status.setAttribute('aria-busy', 'false');
  status.textContent = 'Kon publieke resultaten niet laden. Probeer het later opnieuw.';
}

async function initPublicResultsView() {
  try {
    const payload = await fetchPublicResults();
    renderResults(payload);
  } catch (error) {
    console.error('[public-results-view] failed to load results', error);
    renderError();
  }
}

initPublicResultsView();
