import { RESULT_CONTENT } from './result-content.js';

const PERSONA_STORAGE_KEY = 'pp_result_persona';
const MODULE_COUNTERS_STORAGE_KEY = 'pp_result_module_event_counters_v1';
const SCORE_DIMENSIONS = Object.entries(RESULT_CONTENT.dimensions);

const PERSONA_OPTIONS = [
  { key: 'individual_contributor', label: 'als individuele bijdrager' },
  { key: 'manager', label: 'als manager' },
  { key: 'student', label: 'als student' }
];

const MODULES = [
  { key: 'work_env', title: 'Werkomgeving' },
  { key: 'communication', title: 'Communicatie' },
  { key: 'team_risks', title: 'Teamrisico\'s' },
  { key: 'collab_tips', title: 'Samenwerkingstips' }
];

function readStoredPersona() {
  try {
    const stored = window.localStorage.getItem(PERSONA_STORAGE_KEY);
    if (PERSONA_OPTIONS.some((option) => option.key === stored)) {
      return stored;
    }
  } catch (error) {
    // Intentionally ignored when storage is unavailable.
  }

  return 'individual_contributor';
}

function savePersona(persona) {
  try {
    window.localStorage.setItem(PERSONA_STORAGE_KEY, persona);
  } catch (error) {
    // Intentionally ignored when storage is unavailable.
  }
}

function readCounters() {
  const defaults = {
    expand: {},
    copy: {}
  };

  try {
    const raw = window.localStorage.getItem(MODULE_COUNTERS_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaults;

    return {
      expand: typeof parsed.expand === 'object' && parsed.expand !== null ? parsed.expand : {},
      copy: typeof parsed.copy === 'object' && parsed.copy !== null ? parsed.copy : {}
    };
  } catch (error) {
    return defaults;
  }
}

function persistCounters(counters) {
  try {
    window.localStorage.setItem(MODULE_COUNTERS_STORAGE_KEY, JSON.stringify(counters));
  } catch (error) {
    // Intentionally ignored when storage is unavailable.
  }

  window.__resultModuleEventCounters = counters;
}

function trackModuleEvent(eventType, moduleKey) {
  const counters = readCounters();
  const currentValue = Number(counters?.[eventType]?.[moduleKey]) || 0;

  counters[eventType] = {
    ...counters[eventType],
    [moduleKey]: currentValue + 1
  };

  persistCounters(counters);
}

function renderPersonaAdvice(module, persona) {
  const personaAdvice = module?.personas?.[persona];
  const base = module?.base;

  if (base && personaAdvice) {
    return `${base} ${personaAdvice}`;
  }

  return base || personaAdvice || 'Geen advies beschikbaar.';
}

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

function buildShareText(payload, details) {
  const type = toSafeText(payload?.type, '----');
  const shortDescription = toSafeText(details?.shortDescription, 'Geen beschrijving beschikbaar.');
  const shareUrl = toSafeText(window.location.href, `${window.location.origin}${window.location.pathname}`);

  return [
    `Mijn persoonlijkheidstype: ${type}`,
    shortDescription,
    '',
    `🔍 Doe de test op: ${shareUrl}`
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
  const selectedPersona = readStoredPersona();

  const shortDescription = toSafeText(details?.shortDescription, 'Geen beschrijving beschikbaar voor dit type.');
  const longDescription = toSafeText(details?.longDescriptionNl, shortDescription);
  const strengths = asStringList(details?.strengths);
  const attentionPoints = asStringList(details?.attentionPoints);
  const tips = asStringList(details?.tips);
  const summaryText = buildSummaryText(data, details);
  const shareText = buildShareText(data, details);

  const personaToggleHtml = PERSONA_OPTIONS.map(
    (option) => `
      <label class="persona-toggle-option">
        <input type="radio" name="persona-toggle" value="${option.key}" ${
      selectedPersona === option.key ? 'checked' : ''
    }>
        <span>${option.label}</span>
      </label>
    `
  ).join('');

  const modulesHtml = MODULES.map((moduleMeta) => {
    const moduleContent = details?.[moduleMeta.key];
    const adviceText = renderPersonaAdvice(moduleContent, selectedPersona);

    return `
      <details class="result-module-card" data-module-key="${moduleMeta.key}">
        <summary>${moduleMeta.title}</summary>
        <p class="module-advice" data-module-advice="${moduleMeta.key}">${escapeHtml(adviceText)}</p>
        <button type="button" class="copy-module" data-module-copy="${moduleMeta.key}">Kopieer advies</button>
      </details>
    `;
  }).join('');

  res.innerHTML = `
    <section class="result-card">
      <h2>Resultaat</h2>
      <p class="result-type">Persoonlijkheidstype: <strong>${escapeHtml(type)}</strong></p>
      <p class="result-short-description">${escapeHtml(shortDescription)}</p>

      <article class="result-disclaimer" aria-label="Disclaimer">
        <strong>Disclaimer:</strong>
        <p>Dit resultaat is bedoeld voor zelfreflectie en is <em>niet-diagnostisch</em>. Het vervangt geen professionele medische of psychologische beoordeling.</p>
      </article>

      <section class="persona-toggles" aria-label="Selecteer je rol">
        <h3>Toon advies</h3>
        <div class="persona-toggle-group">${personaToggleHtml}</div>
      </section>

      <section class="result-modules" aria-label="Adviesmodules">
        <h3>Advies per module</h3>
        ${modulesHtml}
      </section>

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
          <button type="button" class="share-result">Kopieer deelbare tekst</button>
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

  res.querySelector('.share-result')?.addEventListener('click', async () => {
    if (!statusElement) return;

    try {
      await window.navigator.clipboard.writeText(shareText);
      statusElement.textContent = 'Deelbare tekst gekopieerd naar klembord.';
    } catch (error) {
      statusElement.textContent = 'Kopiëren mislukt. Probeer het opnieuw.';
    }
  });

  res.querySelector('.restart')?.addEventListener('click', onRestart);

  res.querySelectorAll('input[name="persona-toggle"]').forEach((radio) => {
    radio.addEventListener('change', (event) => {
      const persona = event.target instanceof HTMLInputElement ? event.target.value : '';
      if (!PERSONA_OPTIONS.some((option) => option.key === persona)) return;

      savePersona(persona);
      renderResult(data, onRestart);
    });
  });

  res.querySelectorAll('.result-module-card').forEach((card) => {
    card.addEventListener('toggle', () => {
      if (!(card instanceof HTMLDetailsElement) || !card.open) return;
      const moduleKey = card.dataset.moduleKey;
      if (!moduleKey) return;
      trackModuleEvent('expand', moduleKey);
    });
  });

  res.querySelectorAll('.copy-module').forEach((button) => {
    button.addEventListener('click', async () => {
      const moduleKey = button.getAttribute('data-module-copy');
      if (!moduleKey) return;

      const adviceElement = res.querySelector(`[data-module-advice="${moduleKey}"]`);
      const adviceText = adviceElement?.textContent?.trim();
      if (!adviceText) return;

      try {
        await window.navigator.clipboard.writeText(adviceText);
        trackModuleEvent('copy', moduleKey);
        button.textContent = 'Gekopieerd';
        window.setTimeout(() => {
          button.textContent = 'Kopieer advies';
        }, 1500);
      } catch (error) {
        button.textContent = 'Kopiëren mislukt';
        window.setTimeout(() => {
          button.textContent = 'Kopieer advies';
        }, 1500);
      }
    });
  });

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}
