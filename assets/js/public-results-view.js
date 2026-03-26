import { fetchPublicResults } from './api-client.js';
import { RESULT_CONTENT } from './result-content.js';
import { escapeHtml, initThemeToggle } from './utils.js';
import { dominantPercentFromNormalized, resolveMaxScores, scoreToNormalized } from './score-utils.js';

function normalizeTypeCode(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toUpperCase();
  return /^[EINSFTJP]{4}$/.test(trimmed) ? trimmed : '';
}

function resolveTypeDisplay(rawTypeCode) {
  const typeCode = normalizeTypeCode(rawTypeCode);
  if (!typeCode) {
    return {
      code: '----',
      name: 'Onbekend type'
    };
  }

  const typeName = RESULT_CONTENT?.types?.[typeCode]?.personalitytitel;
  return {
    code: typeCode,
    name: typeof typeName === 'string' && typeName.trim() !== '' ? typeName.trim() : 'Onbekend type'
  };
}

function formatDimensionSummary(scores, typeCode, maxScores) {
  const dimensions = ['EI', 'SN', 'TF', 'JP'];
  const fallbackMap = {
    EI: typeCode[0],
    SN: typeCode[1],
    TF: typeCode[2],
    JP: typeCode[3]
  };

  if (!scores || typeof scores !== 'object') {
    return dimensions
      .map((dimension) => `${dimension}: ${fallbackMap[dimension] || 'n.v.t.'}`)
      .join(' • ');
  }

  const summary = dimensions.map((dimension) => {
    const raw = Number(scores[dimension]);
    if (!Number.isFinite(raw)) {
      return `${dimension}: ${fallbackMap[dimension] || 'n.v.t.'}`;
    }

    const leftPole = dimension[0];
    const rightPole = dimension[1];
    const scoredPole = raw >= 0 ? leftPole : rightPole;
    const dominantPole = fallbackMap[dimension] || scoredPole;
    const normalized = scoreToNormalized(raw, dimension, maxScores);
    const intensity = dominantPercentFromNormalized(normalized);
    return `${dimension}: ${dominantPole} ${intensity}%`;
  });

  return summary.join(' • ');
}

function createCard(result, maxScores) {
  const displayName = typeof result.display_name === 'string' ? result.display_name.trim() : '';
  const rawTypeCode = typeof result.type_code === 'string' ? result.type_code : result.type;
  const typeInfo = resolveTypeDisplay(rawTypeCode);
  const createdAt = typeof result.created_at === 'string' && result.created_at.trim() !== '' ? result.created_at.trim() : 'Onbekende datum';
  const dimensions = formatDimensionSummary(result.scores, typeInfo.code, maxScores);

  return `
    <article class="public-result-card">
      <header class="public-result-card__header">
        <p class="public-result-card__name">${escapeHtml(displayName)}</p>
        <p class="public-result-card__type" translate="no">${escapeHtml(typeInfo.code)} · ${escapeHtml(typeInfo.name)}</p>
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
  const maxScores = resolveMaxScores(payload?.max_scores);

  status.hidden = true;
  status.setAttribute('aria-busy', 'false');

  if (entries.length === 0) {
    status.hidden = false;
    status.textContent = 'Nog geen gedeelde resultaten gevonden.';
    return;
  }

  list.innerHTML = entries.map((entry) => createCard(entry, maxScores)).join('');
}

function renderSingleResult(payload) {
  const list = document.getElementById('public-results-list');
  const status = document.getElementById('public-results-status');
  if (!(list instanceof HTMLElement) || !(status instanceof HTMLElement)) return;

  const entry = payload?.result && typeof payload.result === 'object' ? payload.result : null;
  const maxScores = resolveMaxScores(payload?.max_scores);

  status.hidden = true;
  status.setAttribute('aria-busy', 'false');

  if (!entry) {
    status.hidden = false;
    status.textContent = 'Dit gedeelde resultaat kon niet worden gevonden.';
    return;
  }

  list.innerHTML = createCard(entry, maxScores);
}

function renderError(message = 'Kon publieke resultaten niet laden. Probeer het later opnieuw.') {
  const status = document.getElementById('public-results-status');
  if (!(status instanceof HTMLElement)) return;

  status.hidden = false;
  status.setAttribute('aria-busy', 'false');
  status.textContent = message;
}

async function initPublicResultsView() {
  const params = new URLSearchParams(window.location.search);
  const publicId = (params.get('public_id') || '').trim();

  try {
    const payload = await fetchPublicResults(publicId);
    if (publicId) {
      renderSingleResult(payload);
      return;
    }

    renderResults(payload);
  } catch (error) {
    console.error('[public-results-view] failed to load results', error);
    if (publicId && error?.status === 404) {
      renderError('Dit gedeelde resultaat bestaat niet (meer).');
      return;
    }

    renderError();
  }
}

initThemeToggle();
initPublicResultsView();
