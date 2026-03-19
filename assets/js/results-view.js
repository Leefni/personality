import { RESULT_CONTENT } from './result-content.js';

const SCORE_DIMENSIONS = Object.entries(RESULT_CONTENT.dimensions);

function toSafeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

function asStringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.trim() !== '') : [];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function scoreToPercent(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return 50;
  }

  const bounded = Math.max(-50, Math.min(50, numericScore * 8));
  return Math.round(50 + bounded);
}

function renderScoreBars(scores) {
  const scorePayload = scores && typeof scores === 'object' ? scores : {};

  return SCORE_DIMENSIONS.map(([dimension, config]) => {
    const rawScore = Number(scorePayload[dimension]);
    const percent = scoreToPercent(rawScore);
    const leftPole = config.poles[0];
    const rightPole = config.poles[1];
    const leftName = config.names[0];
    const rightName = config.names[1];

    const dominantPole = percent >= 50 ? leftPole : rightPole;
    const strength = Math.abs(percent - 50) * 2;

    return `
      <article class="result-score-card">
        <div class="result-score-header">
          <h4>${escapeHtml(leftPole)}/${escapeHtml(rightPole)} · ${escapeHtml(leftName)} ↔ ${escapeHtml(rightName)}</h4>
          <p>${escapeHtml(dominantPole)} dominant (${strength}%)</p>
        </div>
        <div class="result-score-track" role="img" aria-label="Score ${escapeHtml(leftPole)} tegen ${escapeHtml(rightPole)}: ${percent}% ${escapeHtml(leftPole)}">
          <span class="result-score-fill" style="width:${percent}%;"></span>
        </div>
        <div class="result-score-legend">
          <span>${escapeHtml(leftPole)} (${percent}%)</span>
          <span>${escapeHtml(rightPole)} (${100 - percent}%)</span>
        </div>
        <p class="result-score-raw">Ruwe score: ${Number.isFinite(rawScore) ? rawScore.toFixed(2) : 'n.v.t.'}</p>
      </article>
    `;
  }).join('');
}

function buildSummaryText(payload, details) {
  const type = toSafeText(payload?.type, '----');
  const shortDescription = toSafeText(details?.shortDescription, 'Geen beschrijving beschikbaar.');
  const longDescription = toSafeText(details?.longDescriptionNl, shortDescription);
  const strengths = asStringList(details?.strengths);
  const attentionPoints = asStringList(details?.attentionPoints);
  const tips = asStringList(details?.tips);

  const scoreLines = SCORE_DIMENSIONS.map(([dimension, config]) => {
    const percent = scoreToPercent(payload?.scores?.[dimension]);
    return `${config.poles[0]}-${config.poles[1]}: ${percent}% / ${100 - percent}%`;
  });

  return [
    `Persoonlijkheidssamenvatting (${type})`,
    '',
    `Kern: ${shortDescription}`,
    '',
    `Uitgebreide beschrijving: ${longDescription}`,
    '',
    `Sterke punten: ${strengths.length > 0 ? strengths.join('; ') : 'n.v.t.'}`,
    `Aandachtspunten: ${attentionPoints.length > 0 ? attentionPoints.join('; ') : 'n.v.t.'}`,
    `Tips: ${tips.length > 0 ? tips.join('; ') : 'n.v.t.'}`,
    '',
    'Dimensiescores:',
    ...scoreLines,
    '',
    'Disclaimer: dit resultaat is indicatief en geen medisch of psychologisch diagnose-instrument.'
  ].join('\n');
}

async function copySummary(text, statusElement) {
  try {
    await navigator.clipboard.writeText(text);
    statusElement.textContent = 'Samenvatting gekopieerd naar klembord.';
  } catch (error) {
    statusElement.textContent = 'Kopiëren mislukt. Selecteer en kopieer de tekst handmatig.';
  }
}

function downloadSummary(text, filename = 'persoonlijkheidssamenvatting.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Renders the result card and wires action button callbacks.
 * @param {{type?: string, scores?: Record<string, number>}} data - API result payload.
 * @param {() => void} onRestart - Callback used when user clicks restart.
 * @returns {void} Nothing.
 */
export function renderResult(data, onRestart) {
  const res = document.getElementById('result');
  const type = toSafeText(data?.type, '----');
  const details = RESULT_CONTENT.types[type];
  const shortDescription = toSafeText(details?.shortDescription, 'Geen beschrijving beschikbaar voor dit type.');
  const longDescription = toSafeText(details?.longDescriptionNl, shortDescription);
  const strengths = asStringList(details?.strengths);
  const attentionPoints = asStringList(details?.attentionPoints);
  const tips = asStringList(details?.tips);

  const summaryText = buildSummaryText(data, details);

  res.innerHTML = `
    <section class="result-card">
      <h2>Resultaat</h2>
      <p class="result-type">Persoonlijkheidstype: <strong>${escapeHtml(type)}</strong></p>
      <p class="result-short-description">${escapeHtml(shortDescription)}</p>

      <article class="result-disclaimer" aria-label="Disclaimer">
        <strong>Disclaimer:</strong>
        <p>Dit resultaat is bedoeld voor zelfreflectie en is <em>niet-diagnostisch</em>. Het vervangt geen professionele medische of psychologische beoordeling.</p>
      </article>

      <div class="result-grid">
        <article class="result-section-card">
          <h3>Lange beschrijving</h3>
          <p>${escapeHtml(longDescription)}</p>
        </article>

        <article class="result-section-card">
          <h3>Sterke punten</h3>
          <ul>${strengths.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('') || '<li>Geen aanvullende punten beschikbaar.</li>'}</ul>
        </article>

        <article class="result-section-card">
          <h3>Aandachtspunten</h3>
          <ul>${attentionPoints.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('') || '<li>Geen aanvullende punten beschikbaar.</li>'}</ul>
        </article>

        <article class="result-section-card">
          <h3>Tips</h3>
          <ul>${tips.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('') || '<li>Geen aanvullende tips beschikbaar.</li>'}</ul>
        </article>
      </div>

      <section class="result-score-grid" aria-label="Dimensiescores">
        <h3>Dimensiescores</h3>
        ${renderScoreBars(data?.scores)}
      </section>

      <section class="result-summary-actions" aria-label="Download of delen">
        <h3>Download / deel samenvatting</h3>
        <div class="result-actions">
          <button type="button" class="copy-summary">Kopieer samenvatting</button>
          <button type="button" class="download-summary">Download als .txt</button>
          <button type="button" class="restart">Opnieuw doen</button>
        </div>
        <p class="result-meta" data-role="summary-status" aria-live="polite">Gebruik deze knoppen om de uitslag te bewaren of delen.</p>
      </section>
    </section>
  `;

  const statusElement = res.querySelector('[data-role="summary-status"]');
  res.querySelector('.copy-summary')?.addEventListener('click', async () => {
    if (!statusElement) return;
    await copySummary(summaryText, statusElement);
  });

  res.querySelector('.download-summary')?.addEventListener('click', () => {
    if (statusElement) {
      statusElement.textContent = 'Samenvatting gedownload als tekstbestand.';
    }
    downloadSummary(summaryText);
  });

  res.querySelector('.restart')?.addEventListener('click', onRestart);

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
