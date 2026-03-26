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

// Fallback max scores based on the question set (count × 2.5 max deviation per answer).
// These are overwritten by the value returned from the API so they stay accurate
// even if the question set changes in future.
const DEFAULT_MAX_SCORES = { EI: 75, SN: 47.5, TF: 92.5, JP: 85 };
let dimensionMaxScores = { ...DEFAULT_MAX_SCORES };

const SCORE_DIMENSIONS = {
  EI: { poles: ['E', 'I'], labels: ['Extraversion', 'Introversion'], icon: '↔' },
  SN: { poles: ['S', 'N'], labels: ['Sensing', 'iNtuition'], icon: '◉' },
  TF: { poles: ['T', 'F'], labels: ['Thinking', 'Feeling'], icon: '⚖' },
  JP: { poles: ['J', 'P'], labels: ['Judging', 'Perceiving'], icon: '⌁' }
};

const SCORE_DIMENSION_ENTRIES = Object.entries(SCORE_DIMENSIONS);


function applyMaxScores(apiData) {
  const ms = apiData?.max_scores;
  if (!ms || typeof ms !== 'object') return;

  ['EI', 'SN', 'TF', 'JP'].forEach((dim) => {
    const v = Number(ms[dim]);
    if (Number.isFinite(v) && v > 0) {
      dimensionMaxScores[dim] = v;
    }
  });
}

function scoreToNormalized(score, dimension) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;

  const maxScore = dimensionMaxScores[dimension] || DEFAULT_MAX_SCORES[dimension] || 75;
  const clamped = Math.max(-maxScore, Math.min(maxScore, numericScore));
  return Number((clamped / maxScore).toFixed(3));
}

function normalizedToPercent(normalizedScore) {
  return Math.round(50 + (normalizedScore * 50));
}

const STRENGTH_LABELS = {
  veryLight: 'zeer licht / bijna in balans',
  light: 'licht',
  moderate: 'gematigd',
  strong: 'sterk'
};

const BEHAVIOR_BY_DIMENSION = {
  EI: {
    E: {
      veryLight: 'Je balanceert rond extraversie: je denkt graag hardop, maar solitaire verwerking werkt net zo goed.',
      light: 'Je neigt naar extraversie: je denkt graag hardop, maar hebt geregeld solo-herstel nodig.',
      moderate: 'Je hebt een duidelijke extraversievoorkeur: interactie versnelt je denken en besluitvorming.',
      strong: 'Je bent sterk extravert: energie en helderheid ontstaan vooral in contact en actie met anderen.'
    },
    I: {
      veryLight: 'Je balanceert rond introversie: je verwerkt eerst intern, maar schakelt makkelijk naar interactie.',
      light: 'Je neigt naar introversie: je verwerkt eerst intern, maar kunt vlot schakelen naar overleg.',
      moderate: 'Je hebt een duidelijke introversievoorkeur: je kwaliteit stijgt met ongestoorde denktijd.',
      strong: 'Je bent sterk introvert: diepe focus en autonomie zijn essentieel om op je best te zijn.'
    }
  },
  SN: {
    S: {
      veryLight: 'Je balanceert rond sensing: je werkt graag met feiten, terwijl je ook openstaat voor nieuwe invalshoeken.',
      light: 'Je neigt naar sensing: je vertrouwt op feiten en praktijk, met ruimte voor nieuwe invalshoeken.',
      moderate: 'Je hebt een duidelijke sensingvoorkeur: je denkt concreet, stapsgewijs en uitvoergericht.',
      strong: 'Je bent sterk sensing-georiënteerd: tastbare data en realisme sturen je keuzes.'
    },
    N: {
      veryLight: 'Je balanceert rond intuïtie: je ziet patronen, met blijvende aandacht voor wat praktisch werkt.',
      light: 'Je neigt naar intuïtie: je ziet snel patronen, maar verliest de praktijk niet uit het oog.',
      moderate: 'Je hebt een duidelijke intuïtieve voorkeur: je denkt in verbanden, concepten en toekomstscenario’s.',
      strong: 'Je bent sterk intuïtief: je richt je primair op betekenis, patronen en mogelijkheden op lange termijn.'
    }
  },
  TF: {
    T: {
      veryLight: 'Je balanceert rond thinking: je zoekt logica en weegt tegelijk relationele impact mee.',
      light: 'Je neigt naar thinking: je zoekt logische consistentie, met oog voor relationele impact.',
      moderate: 'Je hebt een duidelijke thinkingvoorkeur: heldere criteria en objectiviteit sturen je besluiten.',
      strong: 'Je bent sterk thinking-georiënteerd: je prioriteert rationaliteit, ook onder sociale druk.'
    },
    F: {
      veryLight: 'Je balanceert rond feeling: je weegt menselijke impact mee en houdt tegelijk logische samenhang vast.',
      light: 'Je neigt naar feeling: je weegt menselijke impact mee zonder logica los te laten.',
      moderate: 'Je hebt een duidelijke feelingvoorkeur: waarden en context bepalen sterk hoe je kiest.',
      strong: 'Je bent sterk feeling-georiënteerd: relationele en ethische consequenties wegen zwaar in je besluitvorming.'
    }
  },
  JP: {
    J: {
      veryLight: 'Je balanceert rond judging: je houdt van richting en kunt tegelijk soepel improviseren.',
      light: 'Je neigt naar judging: je werkt graag met richting, maar kunt improviseren als dat nodig is.',
      moderate: 'Je hebt een duidelijke judgingvoorkeur: planning en afronding geven je rust en kwaliteit.',
      strong: 'Je bent sterk judging-georiënteerd: voorspelbaarheid, structuur en besluitvastheid zijn je anker.'
    },
    P: {
      veryLight: 'Je balanceert rond perceiving: je houdt opties open, terwijl je ook op tijd kunt afhechten.',
      light: 'Je neigt naar perceiving: je houdt opties open, maar kunt op tijd beslissen.',
      moderate: 'Je hebt een duidelijke perceivingvoorkeur: flexibiliteit en aanpasbaarheid verbeteren je prestaties.',
      strong: 'Je bent sterk perceiving-georiënteerd: je floreert bij vrijheid, iteratie en ruimte om bij te sturen.'
    }
  }
};

function classifyStrength(dominancePercent) {
  if (dominancePercent >= 80) return 'strong';
  if (dominancePercent >= 65) return 'moderate';
  if (dominancePercent >= 55) return 'light';
  return 'veryLight';
}

function buildDimensionInsight(dimension, config, scoreValue) {
  const rawScore = Number(scoreValue);
  const normalized = scoreToNormalized(rawScore, dimension);
  const percent = normalizedToPercent(normalized);
  const leftPole = config.poles[0];
  const rightPole = config.poles[1];
  const dominantPole = normalized >= 0 ? leftPole : rightPole;
  const nonDominantPole = dominantPole === leftPole ? rightPole : leftPole;
  const dominanceStrength = Math.abs(normalized);
  const dominantPercent = Math.round((0.5 + (dominanceStrength / 2)) * 100);
  const strengthKey = classifyStrength(dominantPercent);
  const behaviorText = BEHAVIOR_BY_DIMENSION?.[dimension]?.[dominantPole]?.[strengthKey]
    || 'Je profiel toont een genuanceerde mix binnen deze dimensie.';
  const nuanceText = strengthKey === 'veryLight'
    ? `In verschillende contexten blijven ${dominantPole} en ${nonDominantPole} bijna even zichtbaar.`
    : `Wanneer de context verandert, kan ook je ${nonDominantPole}-kant duidelijk naar voren komen.`;

  return {
    rawScore,
    normalized,
    percent,
    dominantPole,
    nonDominantPole,
    dominantPercent,
    dominanceStrength,
    strengthLabel: STRENGTH_LABELS[strengthKey],
    behaviorText,
    nuanceText,
    leftPole,
    rightPole
  };
}

function renderScoreVisualizations(scores) {
  const scorePayload = scores && typeof scores === 'object' ? scores : {};

  return SCORE_DIMENSION_ENTRIES.map(([dimension, config]) => {
    const insight = buildDimensionInsight(dimension, config, scorePayload[dimension]);
    const meterOffset = Math.abs(insight.normalized) * 50;
    const dominantDirectionClass = insight.dominantPole === insight.leftPole
      ? 'result-dimension-meter-badge--left'
      : 'result-dimension-meter-badge--right';
    const normalizedLabel = insight.normalized >= 0
      ? `+${insight.normalized.toFixed(2)}`
      : insight.normalized.toFixed(2);

    return `
      <article class="result-dimension-card">
        <header class="result-dimension-header">
          <h4>${escapeHtml(dimension)} · ${escapeHtml(config.labels[0])} ↔ ${escapeHtml(config.labels[1])}</h4>
          <p class="result-dimension-dominant">
            <span class="result-dimension-icon" aria-hidden="true">${escapeHtml(config.icon)}</span>
            Dominant: <strong>${escapeHtml(insight.dominantPole)}</strong>
            <span class="result-dimension-strength">${insight.dominantPercent}% (${escapeHtml(insight.strengthLabel)})</span>
          </p>
        </header>

        <div class="result-dimension-meter" role="img" aria-label="${escapeHtml(dimension)} score: dominant ${escapeHtml(insight.dominantPole)}, sterkte ${insight.dominantPercent} procent, genormaliseerd ${normalizedLabel}, ruwe score ${Number.isFinite(insight.rawScore) ? insight.rawScore.toFixed(2) : 'niet beschikbaar'}.">
          <div class="result-dimension-meter-axis" aria-hidden="true">
            <span class="result-dimension-meter-end result-dimension-meter-end--left">${escapeHtml(insight.leftPole)}</span>
            <span class="result-dimension-meter-zero">0</span>
            <span class="result-dimension-meter-end result-dimension-meter-end--right">${escapeHtml(insight.rightPole)}</span>
          </div>
          <div class="result-dimension-meter-track" style="--meter-offset:${meterOffset}%;">
            <span class="result-dimension-meter-center" aria-hidden="true"></span>
            <span class="result-dimension-meter-badge ${dominantDirectionClass}" aria-hidden="true">${escapeHtml(insight.dominantPole)}</span>
          </div>
        </div>

        <p class="result-dimension-metrics">
          <span><strong>Genormaliseerd:</strong> ${normalizedLabel}</span>
          <span><strong>Ruwe score:</strong> ${Number.isFinite(insight.rawScore) ? insight.rawScore.toFixed(2) : 'n.v.t.'}</span>
        </p>
        <p class="result-dimension-explainer"><strong>${escapeHtml(insight.behaviorText)}</strong> ${escapeHtml(insight.nuanceText)}</p>
      </article>
    `;
  }).join('');
}

function validateScoreBarCoherence(scores) {
  const scorePayload = scores && typeof scores === 'object' ? scores : {};
  const requiredDimensions = ['EI', 'SN', 'TF', 'JP'];

  requiredDimensions.forEach((dimension) => {
    const percent = normalizedToPercent(scoreToNormalized(scorePayload[dimension], dimension));
    const counterpart = 100 - percent;
    const hasValidPercentages = Number.isFinite(percent) && Number.isFinite(counterpart) && percent >= 0 && percent <= 100 && counterpart >= 0 && counterpart <= 100;

    if (!hasValidPercentages || percent + counterpart !== 100) {
      // Keep rendering resilient, but expose invalid states in diagnostics.
      console.warn(`[results-view] Incoherente balkwaarden voor ${dimension}:`, {
        rawScore: scorePayload[dimension],
        percent,
        counterpart
      });
    }
  });
}

function buildSummaryText(payload, details) {
  const type = toSafeText(payload?.type, '----');
  const personalityTitle = toSafeText(details?.personalitytitel, 'Onbekende titel');
  const shortDescription = toSafeText(details?.shortDescription, 'Geen beschrijving beschikbaar.');
  const longDescription = toSafeText(details?.longDescriptionNl, shortDescription);
  const strengths = asStringList(details?.strengths);
  const attentionPoints = asStringList(details?.attentionPoints);
  const tips = asStringList(details?.tips);

  const scoreLines = SCORE_DIMENSION_ENTRIES.map(([dimension, config]) => {
    const insight = buildDimensionInsight(dimension, config, payload?.scores?.[dimension]);
    return `${config.poles[0]}-${config.poles[1]}: ${insight.dominantPercent}% ${insight.dominantPole} (${insight.strengthLabel}) — ${insight.behaviorText} ${insight.nuanceText}`;
  });

  return [
    `Persoonlijkheidssamenvatting (${type})`,
    '',
    `Persoonlijkheidstitel (${personalityTitle})`,
    '',
    `Kern: ${shortDescription}`,
    '',
    `Uitgebreide beschrijving: ${longDescription}`,
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
      <section class="result-score-grid" aria-label="Dimensiescores">
        <h3>Dimensiescores</h3>
        ${renderScoreVisualizations(data?.scores)}
      </section>
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
