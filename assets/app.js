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
  fetchTestMetadata,
  saveAnswer,
  submitResults,
  deleteData,
  resetProgress,
  requestRecovery,
  redeemRecovery
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

const pageScrollPositions = new Map();
const RECOVERY_MIN_ANSWER_COUNT = 5;

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

function setRecoveryStatus(message, isError = false) {
  const status = document.getElementById('recovery-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function toggleRecoveryPanel(isExpanded) {
  const toggle = document.getElementById('recovery-toggle');
  const panel = document.getElementById('recovery-panel');
  if (!toggle || !panel || typeof toggle.setAttribute !== 'function') {
    return;
  }

  toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  panel.hidden = !isExpanded;
}

function shouldShowRecoveryPrompt() {
  const state = getState();
  const answeredCount = Object.keys(state.answers).length;
  const status = document.getElementById('recovery-status');
  const hasStatusText = Boolean(status?.textContent?.trim());
  return state.page > 1 || answeredCount >= RECOVERY_MIN_ANSWER_COUNT || hasStatusText;
}

function updateRecoveryVisibility() {
  const prompt = document.getElementById('recovery-prompt');
  if (!prompt) return;

  const isVisible = shouldShowRecoveryPrompt();
  prompt.classList.toggle('is-hidden', !isVisible);
}

async function handleRecoveryRequest() {
  const input = document.getElementById('recovery-email');
  const button = document.getElementById('recovery-request');
  if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) {
    return;
  }

  const email = input.value.trim();
  if (!email) {
    setRecoveryStatus('Vul een geldig e-mailadres in.', true);
    return;
  }

  button.disabled = true;
  setRecoveryStatus('Herstel-link aanvragen...');

  try {
    const response = await requestRecovery(email);
    if (response.delivery === 'mock' && response.recovery_link) {
      setRecoveryStatus(`Dev mock-link: ${response.recovery_link}`);
    } else {
      setRecoveryStatus('Als dit e-mailadres bekend is, is er een herstel-link verstuurd.');
    }
  } catch (error) {
    setRecoveryStatus(formatApiError(error, 'Herstel-link aanvragen mislukt.'), true);
  } finally {
    button.disabled = false;
  }
}

function setupRecoveryHandler() {
  const toggle = document.getElementById('recovery-toggle');
  if (toggle && toggle.dataset.handlerAttached !== 'true') {
    toggle.dataset.handlerAttached = 'true';
    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggleRecoveryPanel(!isExpanded);
    });
  }

  const button = document.getElementById('recovery-request');
  if (!button || button.dataset.handlerAttached === 'true') {
    return;
  }

  button.dataset.handlerAttached = 'true';
  button.addEventListener('click', () => {
    handleRecoveryRequest();
  });
}

async function maybeRedeemRecoveryFromUrl() {
  const location = window.location;
  if (!location || typeof location.search !== 'string') {
    return;
  }

  const params = new URLSearchParams(location.search);
  const token = params.get('recovery_token');
  if (!token) {
    return;
  }

  try {
    await redeemRecovery(token);
    updateRecoveryVisibility();
    toggleRecoveryPanel(true);
    setRecoveryStatus('Herstel-link geaccepteerd. Je voortgang is geladen.');
    params.delete('recovery_token');

    if (window.history?.replaceState) {
      const nextQuery = params.toString();
      const pathname = typeof location.pathname === 'string' ? location.pathname : '';
      const hash = typeof location.hash === 'string' ? location.hash : '';
      const nextUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ''}${hash}`;
      window.history.replaceState({}, document.title, nextUrl);
    }
  } catch (error) {
    updateRecoveryVisibility();
    toggleRecoveryPanel(true);
    setRecoveryStatus(formatApiError(error, 'Herstel-link is ongeldig of verlopen.'), true);
  }
}

function render(scrollToTop = false) {
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
      const prevPage = getState().page - 1;
      setPagination({ page: prevPage });
      await loadQuestionsPage();
      const savedY = pageScrollPositions.get(prevPage) ?? 0;
      window.scrollTo({ top: savedY, behavior: 'smooth' });
    },
    onNext: async () => {
      pageScrollPositions.set(getState().page, window.scrollY);
      await flushPendingSaves();
      setPagination({ page: getState().page + 1 });
      await loadQuestionsPage();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onSubmit: submitTest
  });

  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateRecoveryVisibility();
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
    render(true);
  } catch (error) {
    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    console.error('Vraaglijst laden mislukt:', error);
    setProgressMessage(baseMessage);

    if (IS_DEVELOPMENT_ENV) {
      const endpoint = error?.url || dataEndpoint;
      const status = error?.status;
      const debugParts = [
        buildDebugHint(endpoint, status),
        error?.isJsonParseError ? 'Hint: API-body is geen geldige JSON.' : null,
        error?.parseErrorMessage ? `JSON parse: ${error.parseErrorMessage}` : null
      ].filter(Boolean);

      console.error('Vraagpayload laden mislukt:', {
        endpoint,
        status,
        payload: error?.payload,
        message: error?.message,
        parseErrorMessage: error?.parseErrorMessage
      });
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
  updateRecoveryVisibility();

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
    const { type } = data ?? {};
    if (typeof type === 'string' && type.trim()) {
      document.title = `Jouw type: ${type} – Personality Test`;
    }
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
    clearClientState();
    setPagination({ page: 1 });
    clearResultUi();
    await bootstrap();
    document.title = 'Personality Test – Ontdek jouw persoonlijkheidstype';
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
    setupRecoveryHandler();
    toggleRecoveryPanel(false);
    updateRecoveryVisibility();
    await maybeRedeemRecoveryFromUrl();

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
