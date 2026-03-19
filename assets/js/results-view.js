import { RESULT_CONTENT } from './result-content.js';

const PERSONA_STORAGE_KEY = 'pp_result_persona';
const MODULE_COUNTERS_STORAGE_KEY = 'pp_result_module_event_counters_v1';

const PERSONA_OPTIONS = [
  { key: 'individual_contributor', label: 'as individual contributor' },
  { key: 'manager', label: 'as manager' },
  { key: 'student', label: 'as student' }
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
  const selectedPersona = readStoredPersona();

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
        <p class="module-advice" data-module-advice="${moduleMeta.key}">${adviceText}</p>
        <button type="button" class="copy-module" data-module-copy="${moduleMeta.key}">Kopieer advies</button>
      </details>
    `;
  }).join('');

  res.innerHTML = `
    <h2>Resultaat</h2>
    <p>Persoonlijkheidstype: <strong>${type}</strong></p>
    <p>${description}</p>

    <section class="persona-toggles" aria-label="Selecteer je rol">
      <h3>Toon advies</h3>
      <div class="persona-toggle-group">${personaToggleHtml}</div>
    </section>

    <section class="result-modules" aria-label="Adviesmodules">
      <h3>Advies per module</h3>
      ${modulesHtml}
    </section>

    <button type="button" class="restart">Opnieuw doen</button>
  `;

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
