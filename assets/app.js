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
  fetchTestMetadata,
  saveAnswer,
  submitResults,
  deleteData,
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

function clearClientState() {
  const state = getState();
  state.saveTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  state.saveTimers.clear();
  state.pendingQuestionIds.clear();
  clearAnswers();
  clearLocalDraft();
}

function clearResultUi() {
  const result = document.getElementById('result');
  if (result) {
    result.innerHTML = '';
  }
}

function updateTestMetadata(meta) {
  const metaElement = document.getElementById('test-meta');
  if (!metaElement) return;

  const version = typeof meta?.version === 'string' ? meta.version : 'onbekend';
  const date = typeof meta?.date === 'string' ? meta.date : 'onbekend';
  const questionCount = Number.isFinite(Number(meta?.question_count)) ? Number(meta.question_count) : 0;

  metaElement.textContent = `Testversie ${version} · releasedatum ${date} · ${questionCount} vragen`;
}

async function loadTestMetadata() {
  try {
    const metadata = await fetchTestMetadata();
    updateTestMetadata(metadata);
  } catch (error) {
    const metaElement = document.getElementById('test-meta');
    if (metaElement) {
      metaElement.textContent = 'Testmetadata kon niet worden geladen.';
    }

    showError(formatApiError(error, 'Testmetadata laden mislukt.'), 'progress');
  }
}

async function handleDeleteData() {
  const confirmed = window.confirm('Weet je zeker dat je al je testgegevens wilt verwijderen?');
  if (!confirmed) {
    return;
  }

  setProgressMessage('Gegevens verwijderen...');

  try {
    await deleteData();
    clearClientState();
    clearResultUi();
    setPagination({ page: 1 });
    setProgressMessage('Gegevens verwijderd. Je kunt opnieuw beginnen.');
    await loadQuestionsPage();
  } catch (error) {
    showError(formatApiError(error, 'Verwijderen mislukt. Probeer het opnieuw.'), 'progress');
  }
}

function setupDeleteDataHandler() {
  const deleteButton = document.getElementById('delete-data-start');
  if (!deleteButton || deleteButton.dataset.handlerAttached === 'true') {
    return;
  }

  deleteButton.dataset.handlerAttached = 'true';
  deleteButton.addEventListener('click', () => {
    handleDeleteData();
  });
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
    await resetProgress();
    clearClientState();
    setPagination({ page: 1 });
    clearResultUi();
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
    setupDeleteDataHandler();

    await loadTestMetadata();
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
