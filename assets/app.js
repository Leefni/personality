import {
  IS_DEVELOPMENT_ENV,
  likertLabels,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
  buildDebugHint,
  showError,
  formatApiError
} from './js/utils.js';
import {
  getState,
  setQuestions,
  setAnswers,
  setAnswer,
  clearAnswers,
  setPagination,
  setQuestionChangeListenerAttached,
  incrementRenderCount
} from './js/state.js';
import {
  fetchProgress,
  fetchQuestions,
  saveAnswer,
  submitResults,
  resetProgress
} from './js/api-client.js';
import {
  setProgressMessage,
  setupQuestionChangeListener,
  renderQuestions,
  updateNavState,
  updateProgress,
  updateQuestionPendingState,
  updateQuestionRow
} from './js/questions-view.js';
import { renderResult } from './js/results-view.js';

function getViewModel() {
  const state = getState();
  return {
    questions: state.questions,
    answers: state.answers,
    page: state.page,
    perPage: state.perPage,
    totalQuestions: state.totalQuestions,
    pendingQuestionIds: state.pendingQuestionIds,
    likertLabels
  };
}

function mergeProgress(saved) {
  const localDraft = loadLocalDraft();
  const serverAnswers = {};

  saved.forEach((item) => {
    serverAnswers[item.question_id] = Number(item.value);
  });

  const mergedAnswers = { ...serverAnswers, ...localDraft };
  setAnswers(mergedAnswers);

  const unresolvedDraft = {};
  Object.entries(localDraft).forEach(([questionId, value]) => {
    if (serverAnswers[questionId] !== value) unresolvedDraft[questionId] = value;
  });

  if (Object.keys(unresolvedDraft).length === 0) {
    clearLocalDraft();
  } else {
    saveLocalDraft(unresolvedDraft);
  }
}

function render() {
  const state = getState();
  const renderCount = incrementRenderCount();

  if (IS_DEVELOPMENT_ENV) {
    window.__appRenderStats = {
      fullRenderCount: renderCount,
      page: state.page,
      perPage: state.perPage,
      totalQuestions: state.totalQuestions
    };
  }

  renderQuestions(getViewModel(), {
    isDevelopment: IS_DEVELOPMENT_ENV,
    onPrev: () => {
      setPagination({ page: getState().page - 1 });
      loadQuestionsPage();
    },
    onNext: () => {
      setPagination({ page: getState().page + 1 });
      loadQuestionsPage();
    },
    onSubmit: submitTest
  });
}

async function loadQuestionsPage() {
  const state = getState();
  const dataEndpoint = `api/v1/get_questions.php?page=${state.page}&per_page=${state.perPage}`;

  try {
    const questionPayload = await fetchQuestions(state.page, state.perPage);
    setQuestions(questionPayload.questions);
    setPagination({
      totalQuestions: Number(questionPayload.total),
      page: Number(questionPayload.page),
      perPage: Number(questionPayload.per_page)
    });
    render();
  } catch (error) {
    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    setProgressMessage(baseMessage);

    if (IS_DEVELOPMENT_ENV) {
      const endpoint = error?.url || dataEndpoint;
      const status = error?.status;
      const debugParts = [
        buildDebugHint(endpoint, status),
        error?.isJsonParseError ? 'Hint: API-body is geen geldige JSON.' : null,
        error?.parseErrorMessage ? `JSON parse: ${error.parseErrorMessage}` : null
      ].filter(Boolean);

      showError(`${baseMessage} ${debugParts.join(' ')}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

async function persistAnswer(questionId, value) {
  const state = getState();
  state.pendingQuestionIds.add(questionId);
  updateQuestionPendingState(questionId, state.pendingQuestionIds);
  updateProgress(getViewModel());

  try {
    await saveAnswer(questionId, value);
    saveLocalDraft(state.answers);
  } catch (error) {
    saveLocalDraft(state.answers);
    const message = formatApiError(error, 'Opslaan mislukt. Probeer het opnieuw.');
    showError(message, 'progress');
  } finally {
    state.pendingQuestionIds.delete(questionId);
    updateQuestionPendingState(questionId, state.pendingQuestionIds);
    updateProgress(getViewModel());
  }
}

function queueAnswerSave(questionId, value) {
  const state = getState();
  setAnswer(questionId, value);
  saveLocalDraft(state.answers);
  updateQuestionRow(questionId, getViewModel());
  updateProgress(getViewModel());
  updateNavState(state.answers, state.totalQuestions);

  const existingTimer = state.saveTimers.get(questionId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(async () => {
    state.saveTimers.delete(questionId);
    await persistAnswer(questionId, value);
  }, 300);

  state.saveTimers.set(questionId, timerId);
}

async function submitTest() {
  try {
    const data = await submitResults();
    clearLocalDraft();
    renderResult(data, resetTest);
  } catch (error) {
    const progress = document.getElementById('progress');
    const result = document.getElementById('result');
    const message = formatApiError(error, 'Resultaat ophalen mislukt. Probeer het opnieuw.');

    if (error.status === 422 && error.payload?.message === 'Incomplete test') {
      const answered = Number(error.payload.answered);
      const total = Number(error.payload.total);
      const incompleteMessage = `Test is nog niet compleet: ${answered} van ${total} vragen beantwoord.`;

      if (progress) progress.textContent = incompleteMessage;
      if (result) result.innerHTML = `<p class="error">${incompleteMessage}</p>`;
      return;
    }

    if (progress) progress.textContent = message;
    if (result) result.innerHTML = `<p class="error">${message}</p>`;
  }
}


function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDimensionScore(rawScore) {
  return clamp(toFiniteNumber(rawScore), -100, 100);
}

function getScoreboardEntries(rawScores = {}) {
  return Object.entries(RESULT_CONTENT.dimensions).map(([dimension, config]) => {
    const normalizedScore = normalizeDimensionScore(rawScores?.[dimension]);
    const strengthPercent = Math.round(Math.abs(normalizedScore));
    const sideIndex = normalizedScore >= 0 ? 0 : 1;
    const sideLetter = config.poles[sideIndex] ?? '?';
    const sideName = config.names[sideIndex] ?? 'Onbekend';

    return {
      dimension,
      normalizedScore,
      strengthPercent,
      sideLetter,
      sideName,
      oppositeName: config.names[sideIndex === 0 ? 1 : 0] ?? 'Onbekend'
    };
  });
}

function formatTrendLabel(entry) {
  return `${entry.sideName} (${entry.sideLetter})`;
}

async function resetTest() {
  try {
    await resetProgress();
    clearAnswers();
    setPagination({ page: 1 });
    clearLocalDraft();
    const result = document.getElementById('result');
    if (result) result.innerHTML = '';
    await bootstrap();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showError('Resetten mislukt. Probeer het opnieuw.', 'progress');
  }
}

function showResult(data) {
  const res = document.getElementById('result');
  const type = typeof data.type === 'string' ? data.type : '----';
  const details = RESULT_CONTENT.types[type];
  const rawScores = data?.scores && typeof data.scores === 'object' ? data.scores : {};
  const scoreboardEntries = getScoreboardEntries(rawScores);
  const strongestTendencies = [...scoreboardEntries]
    .sort((a, b) => b.strengthPercent - a.strengthPercent)
    .slice(0, 2);
  const possibleBlindSpot = [...scoreboardEntries]
    .sort((a, b) => a.strengthPercent - b.strengthPercent)[0];

  const longDescription = details?.longDescriptionNl ?? details?.shortDescription ?? 'Geen beschrijving beschikbaar voor dit type.';
  const werkstijl = details?.werkstijlNl ?? details?.shortDescription ?? 'Geen beschrijving beschikbaar voor werkstijl.';
  const valkuilen = details?.valkuilenNl ?? details?.shortDescription ?? 'Geen valkuilen beschikbaar voor dit type.';
  const groeitips = details?.groeitipsNl ?? details?.shortDescription ?? 'Geen groeitips beschikbaar voor dit type.';

  res.innerHTML = `
    <h2>Resultaat</h2>
    <p>Persoonlijkheidstype: <strong>${type}</strong></p>
    <p>${longDescription}</p>

    <h3>Scoreboard</h3>
    ${scoreboardEntries.map((entry) => `
      <div class="bar">
        <div class="bar-label">
          <strong>${entry.dimension}</strong> — ${entry.sideName} vs ${entry.oppositeName}
          <span> (${entry.normalizedScore >= 0 ? '+' : ''}${entry.normalizedScore.toFixed(1)})</span>
        </div>
        <div class="bar-track" role="img" aria-label="${entry.dimension} ${entry.strengthPercent}% ${entry.sideName}">
          <div class="bar-fill" style="width: ${entry.strengthPercent}%;"></div>
        </div>
      </div>
    `).join('')}

    <h3>Sterkste tendensen</h3>
    <ul>
      ${strongestTendencies.map((entry) => `<li>${formatTrendLabel(entry)} (${entry.strengthPercent}%)</li>`).join('')}
    </ul>

    <h3>Mogelijke blinde vlek</h3>
    <p>${possibleBlindSpot ? `${formatTrendLabel(possibleBlindSpot)} krijgt nu relatief weinig nadruk (${possibleBlindSpot.strengthPercent}%).` : 'Geen blinde vlek beschikbaar.'}</p>

    <h3>Werkstijl</h3>
    <p>${werkstijl}</p>

    <h3>Valkuilen</h3>
    <p>${valkuilen}</p>

    <h3>Groeitips</h3>
    <p>${groeitips}</p>

    <button type="button" class="restart">Opnieuw doen</button>
  `;
async function bootstrap() {
  try {
    setupQuestionChangeListener(
      () => getState().hasQuestionChangeListener,
      setQuestionChangeListenerAttached,
      queueAnswerSave
    );

    const saved = await fetchProgress();
    mergeProgress(saved);
    await loadQuestionsPage();
  } catch (error) {
    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    setProgressMessage(baseMessage);

    if (IS_DEVELOPMENT_ENV) {
      showError(`${baseMessage} ${buildDebugHint('api/v1/get_progress.php', error?.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

bootstrap();
