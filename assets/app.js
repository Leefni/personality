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
  setQueuedAnswerValue,
  getQueuedAnswerValue,
  clearQueuedAnswerValue,
  setPendingSavePromise,
  clearPendingSavePromise,
  getPendingSavePromises,
  hasPendingSaves,
  clearSaveTimers,
  clearPendingSavesTracking,
  bumpSaveSession,
  getSaveSession,
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

function updatePendingActionState() {
  const state = getState();
  updateNavState(state.answers, state.totalQuestions, state.pendingQuestionIds);
  const restartButton = document.querySelector('#result .restart');
  if (restartButton) {
    restartButton.disabled = hasPendingSaves();
  }
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
    if (serverAnswers[questionId] !== value) {
      unresolvedDraft[questionId] = value;
    }
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
    onPrev: async () => {
      await flushPendingSaves();
      setPagination({ page: getState().page - 1 });
      loadQuestionsPage();
    },
    onNext: async () => {
      await flushPendingSaves();
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

async function persistAnswer(questionId, value, saveSession) {
  const state = getState();
  state.pendingQuestionIds.add(questionId);
  updateQuestionPendingState(questionId, state.pendingQuestionIds);
  updateProgress(getViewModel());
  updatePendingActionState();

  try {
    await saveAnswer(questionId, value);
    if (getSaveSession() !== saveSession) return;
    saveLocalDraft(state.answers);
  } catch (error) {
    if (getSaveSession() !== saveSession) return;
    saveLocalDraft(state.answers);
    const message = formatApiError(error, 'Opslaan mislukt. Probeer het opnieuw.');
    showError(message, 'progress');
  } finally {
    state.pendingQuestionIds.delete(questionId);
    updateQuestionPendingState(questionId, state.pendingQuestionIds);
    updateProgress(getViewModel());
    updatePendingActionState();
  }
}

function queueAnswerSave(questionId, value) {
  const state = getState();
  const sessionAtQueue = getSaveSession();
  setAnswer(questionId, value);
  setQueuedAnswerValue(questionId, value);
  saveLocalDraft(state.answers);
  updateQuestionRow(questionId, getViewModel());
  updateProgress(getViewModel());
  updatePendingActionState();

  const existingTimer = state.saveTimers.get(questionId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(async () => {
    if (getSaveSession() !== sessionAtQueue) {
      state.saveTimers.delete(questionId);
      clearQueuedAnswerValue(questionId);
      updatePendingActionState();
      return;
    }

    const queuedValue = getQueuedAnswerValue(questionId);
    state.saveTimers.delete(questionId);
    clearQueuedAnswerValue(questionId);
    updatePendingActionState();
    if (!Number.isFinite(queuedValue)) return;

    const savePromise = persistAnswer(questionId, Number(queuedValue), sessionAtQueue);
    setPendingSavePromise(questionId, savePromise);
    try {
      await savePromise;
    } finally {
      clearPendingSavePromise(questionId);
      updatePendingActionState();
    }
  }, 300);

  state.saveTimers.set(questionId, timerId);
  updatePendingActionState();
}

export async function flushPendingSaves() {
  const state = getState();
  const currentSession = getSaveSession();
  const queuedSaves = Array.from(state.saveTimers.entries());

  queuedSaves.forEach(([questionId, timerId]) => {
    window.clearTimeout(timerId);
    state.saveTimers.delete(questionId);
  });
  updatePendingActionState();

  const debouncedPromises = queuedSaves.map(([questionId]) => {
    const queuedValue = getQueuedAnswerValue(questionId);
    clearQueuedAnswerValue(questionId);
    if (!Number.isFinite(queuedValue)) return Promise.resolve();

    const savePromise = persistAnswer(questionId, Number(queuedValue), currentSession);
    setPendingSavePromise(questionId, savePromise);
    return savePromise.finally(() => {
      clearPendingSavePromise(questionId);
    });
  });

  await Promise.allSettled([...debouncedPromises, ...getPendingSavePromises()]);
  updatePendingActionState();
}

async function submitTest() {
  try {
    await flushPendingSaves();
    const data = await submitResults();
    clearLocalDraft();
    renderResult(data, resetTest);
    updatePendingActionState();
  } catch (error) {
    const progress = document.getElementById('progress');
    const result = document.getElementById('result');
    const message = formatApiError(error, 'Resultaat ophalen mislukt. Probeer het opnieuw.');

    if (error.status === 422 && error.payload?.message === 'Incomplete test') {
      const answered = Number(error.payload.answered);
      const total = Number(error.payload.total);
      const incompleteMessage = `Test is nog niet compleet: ${answered} van ${total} vragen beantwoord.`;

      if (progress) {
        progress.textContent = incompleteMessage;
      }
      if (result) {
        result.innerHTML = `<p class="error">${incompleteMessage}</p>`;
      }
      return;
    }

    if (progress) {
      progress.textContent = message;
    }
    if (result) {
      result.innerHTML = `<p class="error">${message}</p>`;
    }
  }
}

async function resetTest() {
  try {
    bumpSaveSession();
    clearSaveTimers();
    clearPendingSavesTracking();
    updatePendingActionState();
    await flushPendingSaves();
    await resetProgress();
    clearAnswers();
    setPagination({ page: 1 });
    clearLocalDraft();
    const result = document.getElementById('result');
    if (result) {
      result.innerHTML = '';
    }
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

    if (IS_DEVELOPMENT_ENV) {
      showError(`${baseMessage} ${buildDebugHint('api/v1/get_progress.php', error?.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

bootstrap();
