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

  const bars = renderDimensionBars(data?.scores);
  res.querySelector('p:last-of-type')?.insertAdjacentElement('afterend', bars);

  res.querySelector('.restart')?.addEventListener('click', resetTest);
    if (IS_DEVELOPMENT_ENV) {
      showError(`${baseMessage} ${buildDebugHint('api/v1/get_progress.php', error?.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

function renderDimensionBars(scores) {
  const section = document.createElement('section');
  section.className = 'dimension-bars';
  section.innerHTML = '<h3>Scores per dimensie</h3>';

  const dimensions = RESULT_CONTENT?.dimensions;
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) {
    const fallback = document.createElement('p');
    fallback.textContent = 'Dimensie-inhoud ontbreekt; scorebalken kunnen niet worden getoond.';
    section.appendChild(fallback);
    return section;
  }

  // We normaliseren invoer naar een voorspelbaar object met vier dimensies.
  // Zo is de render-flow eenvoudig te volgen, ook wanneer scores ontbreken.
  const normalizedScores = {
    EI: 0,
    SN: 0,
    TF: 0,
    JP: 0
  };
  let hadMalformedScore = false;

  if (scores && typeof scores === 'object' && !Array.isArray(scores)) {
    Object.keys(normalizedScores).forEach((dimensionKey) => {
      const numericValue = Number(scores[dimensionKey]);
      if (Number.isFinite(numericValue)) {
        normalizedScores[dimensionKey] = numericValue;
      } else if (scores[dimensionKey] != null) {
        hadMalformedScore = true;
      }
    });
  } else if (scores != null) {
    hadMalformedScore = true;
  }

  Object.entries(dimensions).forEach(([dimensionKey, config]) => {
    const poles = Array.isArray(config?.poles) ? config.poles : [dimensionKey[0], dimensionKey[1] ?? '?'];
    const names = Array.isArray(config?.names) ? config.names : poles;
    const score = normalizedScores[dimensionKey] ?? 0;
    const dominantIndex = score >= 0 ? 0 : 1;

    // Scores hebben geen vaste bovengrens. Voor UI-doeleinden schalen we
    // de absolute waarde licht op en begrenzen op 100%.
    const fillWidth = Math.min(100, 50 + (Math.abs(score) * 12.5));

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `
      <div class="bar-label">
        <strong>${dimensionKey}</strong> — ${names[0]} (${poles[0]}) ↔ ${names[1]} (${poles[1]})
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width: ${fillWidth}%"></div>
      </div>
      <small>
        Dominant: ${names[dominantIndex]} (${poles[dominantIndex]}) · ruwe score: ${score.toFixed(2)}
      </small>
    `;
    section.appendChild(bar);
  });

  if (hadMalformedScore) {
    const warning = document.createElement('p');
    warning.className = 'error-notice';
    warning.textContent = 'Sommige scorewaarden waren ongeldig; ontbrekende of onleesbare waarden zijn als 0.00 verwerkt.';
    section.appendChild(warning);
  }

  return section;
}

bootstrap();
