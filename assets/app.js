import {
  IS_DEVELOPMENT_ENV,
  likertLabels,
  initThemeToggle,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
  loadPendingRetries,
  savePendingRetries,
  clearPendingRetries,
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
  addUnsyncedQuestionId,
  removeUnsyncedQuestionId,
  setUnsyncedQuestionIds,
  clearSaveTimers,
  clearPendingSavesTracking,
  bumpSaveSession,
  getSaveSession,
  setPagination,
  setQuestionChangeListenerAttached,
  setIsNavigating,
  getIsNavigating
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
  getUnansweredCountOnPage,
  updateNavState,
  updateProgress,
  updatePageHint,
  updateQuestionRow,
  flashSavedQuestion
} from './js/questions-view.js';
import { renderResult } from './js/results-view.js';

const pageScrollPositions = new Map();
const RECOVERY_MIN_ANSWER_COUNT = 5;
const loadingMessages = [
  'Je persoonlijkheid wordt geanalyseerd...',
  'Resultaten worden berekend...',
  'Je persoonlijkheidsprofiel wordt samengesteld...'
];

let loadingMessageTimer = null;
let isSubmitting = false;

function showQuestionScreen() {
  const questionScreen = document.getElementById('question-screen');
  const resultsScreen = document.getElementById('results-screen');

  if (questionScreen instanceof HTMLElement) {
    questionScreen.hidden = false;
  }

  if (resultsScreen instanceof HTMLElement) {
    resultsScreen.hidden = true;
  }

  document.body.classList.remove('results-dark');
}

function showResultScreen() {
  const questionScreen = document.getElementById('question-screen');
  const resultsScreen = document.getElementById('results-screen');

  if (questionScreen instanceof HTMLElement) {
    questionScreen.hidden = true;
  }

  if (resultsScreen instanceof HTMLElement) {
    resultsScreen.hidden = false;
  }

  if (!document.body.classList.contains('theme-light')) {
    document.body.classList.add('results-dark');
  }
}

function getLoadingOverlayElements() {
  return {
    overlay: document.getElementById('loading-overlay'),
    liveRegion: document.getElementById('loading-overlay-live'),
    main: document.querySelector('main.container')
  };
}

function getInteractiveControls() {
  return document.querySelectorAll(
    '#nav button, #result .restart, #delete-data-start, #recovery-toggle, #recovery-request, #recovery-email, #questions input, #questions button'
  );
}

function setInteractiveControlsDisabled(isDisabled) {
  getInteractiveControls().forEach((element) => {
    if (!(element instanceof HTMLButtonElement || element instanceof HTMLInputElement)) {
      return;
    }

    if (isDisabled) {
      if (!element.disabled) {
        element.dataset.loadingDisabled = 'true';
        element.disabled = true;
      }
      return;
    }

    if (element.dataset.loadingDisabled === 'true') {
      element.disabled = false;
    }
    delete element.dataset.loadingDisabled;
  });
}

function showLoadingOverlay() {
  const { overlay, liveRegion, main } = getLoadingOverlayElements();
  if (!(overlay instanceof HTMLElement)) {
    return;
  }

  setInteractiveControlsDisabled(true);
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-loading');

  if (main instanceof HTMLElement) {
    main.setAttribute('aria-busy', 'true');
  }

  if (liveRegion instanceof HTMLElement) {
    let messageIndex = 0;
    liveRegion.textContent = loadingMessages[messageIndex];

    if (loadingMessageTimer) {
      window.clearInterval(loadingMessageTimer);
    }

    loadingMessageTimer = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      liveRegion.textContent = loadingMessages[messageIndex];
    }, 1400);
  }
}

function hideLoadingOverlay() {
  const { overlay, liveRegion, main } = getLoadingOverlayElements();
  if (loadingMessageTimer) {
    window.clearInterval(loadingMessageTimer);
    loadingMessageTimer = null;
  }

  if (overlay instanceof HTMLElement) {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  }

  if (liveRegion instanceof HTMLElement) {
    liveRegion.textContent = loadingMessages[0];
  }

  if (main instanceof HTMLElement) {
    main.setAttribute('aria-busy', 'false');
  }

  document.body.classList.remove('is-loading');
  setInteractiveControlsDisabled(false);
}

const SAVE_RETRY_ATTEMPTS = 2;
const SAVE_RETRY_BASE_DELAY_MS = 350;
const SAVE_REQUEST_TIMEOUT_MS = 1200;
const SAVE_WAIT_BUDGET_MS = 3200;
const FOREGROUND_SAVE_RETRY_ATTEMPTS = 1;
const FOREGROUND_SAVE_WAIT_BUDGET_MS = 2400;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableSaveError(error) {
  const status = error?.status;
  if (status === undefined) return true;
  return status === 408 || status === 429 || status >= 500;
}

function markQuestionPendingRetry(questionId) {
  const pendingRetries = loadPendingRetries();
  pendingRetries[questionId] = true;
  savePendingRetries(pendingRetries);
  addUnsyncedQuestionId(questionId);
}

function clearQuestionPendingRetry(questionId) {
  const pendingRetries = loadPendingRetries();
  if (!pendingRetries[questionId]) return;
  delete pendingRetries[questionId];
  savePendingRetries(pendingRetries);
  removeUnsyncedQuestionId(questionId);
}

function getUnsyncedQuestionIdSet() {
  const pendingRetries = loadPendingRetries();
  const pendingRetryIds = Object.keys(pendingRetries).map((id) => Number(id));
  const state = getState();
  const knownUnsyncedIds = Array.from(state.unsyncedQuestionIds ?? []);
  const unsyncedIds = new Set(
    [...pendingRetryIds, ...knownUnsyncedIds].filter((id) => Number.isInteger(id))
  );
  setUnsyncedQuestionIds(unsyncedIds);
  return unsyncedIds;
}

function setSubmitInlineWarning(message = '') {
  const questionScreen = document.getElementById('question-screen');
  if (!(questionScreen instanceof HTMLElement)) return;

  let warningElement = document.getElementById('submit-inline-warning');
  if (!(warningElement instanceof HTMLElement)) {
    warningElement = document.createElement('p');
    warningElement.id = 'submit-inline-warning';
    warningElement.className = 'error';
    const nav = document.getElementById('nav');
    if (nav?.parentElement) {
      nav.parentElement.insertBefore(warningElement, nav);
    } else {
      questionScreen.appendChild(warningElement);
    }
  }

  warningElement.textContent = message;
  warningElement.hidden = !message;
}

function updateIntroSectionsVisibility() {
  const state = getState();
  // Show intro sections only on page 1. The sections start with [hidden] in
  // the HTML so they never flash on subsequent pages even before JS runs.
  const shouldShowIntro = state.page === 1;

  ['.privacy-note', '.about-test'].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.hidden = !shouldShowIntro;
    }
  });
}

function getViewModel() {
  const state = getState();
  return {
    questions: state.questions,
    answers: state.answers,
    page: state.page,
    perPage: state.perPage,
    totalQuestions: state.totalQuestions,
    pendingQuestionIds: state.pendingQuestionIds,
    isNavigating: state.isNavigating,
    likertLabels
  };
}

function setNavLoadingState(isLoading) {
  const nav = document.getElementById('nav');
  if (!nav) return;

  nav.querySelectorAll('button').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = isLoading;
  });

  if (!isLoading) {
    updatePendingActionState();
  }
}

async function withButtonLoadingState(button, asyncAction) {
  const triggerButton = button instanceof HTMLButtonElement ? button : null;
  const originalButtonText = triggerButton?.textContent ?? null;

  if (triggerButton) {
    triggerButton.textContent = 'Bezig...';
    triggerButton.classList.add('is-loading');
  }

  try {
    await asyncAction();
  } finally {
    if (triggerButton) {
      triggerButton.textContent = originalButtonText;
      triggerButton.classList.remove('is-loading');
    }
  }
}

function updatePendingActionState() {
  const state = getState();
  const hasUnsyncedAnswers = getUnsyncedQuestionIdSet().size > 0;
  if (!hasUnsyncedAnswers) {
    setSubmitInlineWarning('');
  }
  updateNavState(state.answers, state.totalQuestions, state.isNavigating, hasUnsyncedAnswers);
  const restartButton = document.querySelector('#result .restart');
  if (restartButton) {
    restartButton.disabled = hasPendingSaves() || hasUnsyncedAnswers;
  }
}

function mergeProgress(saved) {
  const localDraft = loadLocalDraft();
  const serverAnswers = {};
  const rows = Array.isArray(saved) ? saved : [];

  rows.forEach((item) => {
    serverAnswers[item.question_id] = Number(item.value);
  });

  const mergedAnswers = { ...serverAnswers, ...localDraft };
  setAnswers(mergedAnswers);

  const unresolvedDraft = {};
  const unresolvedQuestionIds = [];
  Object.entries(localDraft).forEach(([questionId, value]) => {
    if (serverAnswers[questionId] !== value) {
      unresolvedDraft[questionId] = value;
      unresolvedQuestionIds.push(Number(questionId));
    }
  });

  setUnsyncedQuestionIds(unresolvedQuestionIds);
  if (Object.keys(unresolvedDraft).length === 0) {
    clearLocalDraft();
  } else {
    saveLocalDraft(unresolvedDraft);
    Object.entries(unresolvedDraft).forEach(([questionId, value]) => {
      markQuestionPendingRetry(Number(questionId));
      queueAnswerSave(Number(questionId), Number(value));
    });
  }
}

function clearClientState() {
  const state = getState();
  state.saveTimers.forEach((timerId) => {
    window.clearTimeout(timerId);
  });
  state.saveTimers.clear();
  state.pendingQuestionIds.clear();
  state.unsyncedQuestionIds.clear();
  clearAnswers();
  clearLocalDraft();
  clearPendingRetries();
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

    showError(formatApiError(error, 'Testmetadata laden mislukt.'));
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
    showQuestionScreen();
    setPagination({ page: 1 });
    setProgressMessage('Gegevens verwijderd. Je kunt opnieuw beginnen.');
    await loadQuestionsPage();
  } catch (error) {
    showError(formatApiError(error, 'Verwijderen mislukt. Probeer het opnieuw.'));
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
    renderQuestions(getViewModel(), {
      isDevelopment: IS_DEVELOPMENT_ENV,
      onPrev: async (event) => {
        if (getIsNavigating()) return;
        setIsNavigating(true);
        setNavLoadingState(true);

        try {
          await withButtonLoadingState(event?.currentTarget, async () => {
            const prevPage = getState().page - 1;
            setPagination({ page: prevPage });
            await loadQuestionsPage();
            const savedY = pageScrollPositions.get(prevPage) ?? 0;
            window.scrollTo({ top: savedY, behavior: 'smooth' });
          });
        } finally {
          setIsNavigating(false);
          setNavLoadingState(false);
        }
      },
      onNext: async (event) => {
        if (getIsNavigating()) return;
        setIsNavigating(true);
        setNavLoadingState(true);

        try {
          await withButtonLoadingState(event?.currentTarget, async () => {
            pageScrollPositions.set(getState().page, window.scrollY);
            setPagination({ page: getState().page + 1 });
            await loadQuestionsPage();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          });
        } finally {
          setIsNavigating(false);
          setNavLoadingState(false);
        }
      },
      onPageSelect: async (nextPage, event) => {
        const requestedPage = Number(nextPage);
        const stateNow = getState();
        if (!Number.isInteger(requestedPage) || requestedPage < 1) return;
        if (requestedPage === stateNow.page || getIsNavigating()) return;

        const totalPages = Math.max(1, Math.ceil(stateNow.totalQuestions / stateNow.perPage));
        if (requestedPage > totalPages) return;

        setIsNavigating(true);
        setNavLoadingState(true);

        try {
          await withButtonLoadingState(event?.currentTarget, async () => {
            pageScrollPositions.set(stateNow.page, window.scrollY);
            await flushPendingSaves();
            setPagination({ page: requestedPage });
            await loadQuestionsPage();
            const targetY = pageScrollPositions.get(requestedPage) ?? 0;
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          });
        } finally {
          setIsNavigating(false);
          setNavLoadingState(false);
        }
      },
      onSubmit: submitTest
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateIntroSectionsVisibility();
    updateRecoveryVisibility();
    updatePendingActionState();
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
      showError(`${baseMessage} ${debugParts.join(' ')}`);
      return;
    }

    showError(baseMessage);
  }
}

async function persistAnswer(questionId, value, saveSession, options = {}) {
  const state = getState();
  const maxAttempts = Number.isFinite(options.retryAttempts)
    ? Math.max(1, Math.floor(options.retryAttempts))
    : SAVE_RETRY_ATTEMPTS;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(200, Math.floor(options.timeoutMs))
    : SAVE_REQUEST_TIMEOUT_MS;
  const waitBudgetMs = Number.isFinite(options.waitBudgetMs)
    ? Math.max(timeoutMs, Math.floor(options.waitBudgetMs))
    : SAVE_WAIT_BUDGET_MS;
  const startedAt = Date.now();
  // Optimistic UI: don't disable the question while saving.
  // Track pending saves only for submit-gating purposes.
  state.pendingQuestionIds.add(questionId);
  updatePendingActionState();

  try {
    let lastError = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (getSaveSession() !== saveSession) return;

      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= waitBudgetMs) {
        break;
      }

      if (attempt > 0) {
        const retryDelayMs = SAVE_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const remainingBudgetMs = waitBudgetMs - (Date.now() - startedAt);
        if (remainingBudgetMs <= 0) {
          break;
        }
        await sleep(Math.min(retryDelayMs, remainingBudgetMs));
      }

      try {
        await saveAnswer(questionId, value, { timeoutMs });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const isFinalAttempt = attempt >= maxAttempts - 1;
        if (isFinalAttempt || !isRetryableSaveError(error)) {
          throw error;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    if (getSaveSession() !== saveSession) return;
    clearQuestionPendingRetry(questionId);
    saveLocalDraft(state.answers);
    // Show brief save confirmation badge on the question card.
    const questionEl = document.querySelector(`[data-question-id="${questionId}"]`);
    if (questionEl) flashSavedQuestion(questionEl);
  } catch (error) {
    if (getSaveSession() !== saveSession) return;
    markQuestionPendingRetry(questionId);
    saveLocalDraft(state.answers);
    if (!isRetryableSaveError(error)) {
      const message = formatApiError(
        error,
        'Opslaan mislukt. Antwoord blijft lokaal bewaard en wordt later opnieuw geprobeerd.'
      );
      showError(message);
    }
  } finally {
    state.pendingQuestionIds.delete(questionId);
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
  updatePageHint(getViewModel());
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
  }, 150);

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

    const savePromise = persistAnswer(questionId, Number(queuedValue), currentSession, {
      retryAttempts: FOREGROUND_SAVE_RETRY_ATTEMPTS,
      timeoutMs: SAVE_REQUEST_TIMEOUT_MS,
      waitBudgetMs: FOREGROUND_SAVE_WAIT_BUDGET_MS
    });
    setPendingSavePromise(questionId, savePromise);
    return savePromise.finally(() => {
      clearPendingSavePromise(questionId);
    });
  });

  await Promise.allSettled([...debouncedPromises, ...getPendingSavePromises()]);
  if (getUnsyncedQuestionIdSet().size > 0) {
    setSubmitInlineWarning(
      'Niet alle antwoorden zijn direct opgeslagen. Je kunt doorgaan; we blijven op de achtergrond opnieuw proberen.'
    );
  }
  updatePendingActionState();
}

async function submitTest(event) {
  if (event?.preventDefault) {
    event.preventDefault();
  }

  if (isSubmitting) {
    return;
  }

  isSubmitting = true;
  showLoadingOverlay();

  try {
    await flushPendingSaves();
    const data = await submitResults();
    const { type } = data ?? {};
    if (typeof type === 'string' && type.trim()) {
      document.title = `Jouw type: ${type} – Persoonlijkheidstest`;
    }
    clearLocalDraft();
    clearPendingRetries();
    setUnsyncedQuestionIds([]);
    setSubmitInlineWarning('');
    showResultScreen();
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
      const retryHintMessage = 'Je antwoorden staan lokaal opgeslagen op dit apparaat. We proberen opnieuw te synchroniseren met de server op de achtergrond. Probeer over enkele seconden opnieuw je resultaat op te vragen.';

      if (progress) {
        progress.textContent = incompleteMessage;
      }
      if (result) {
        result.innerHTML = `<p class="error">${incompleteMessage}</p>`;
      }
      setSubmitInlineWarning(retryHintMessage);
      setProgressMessage('Bezig met opnieuw opslaan van antwoorden...');
      queueUnsyncedAnswersForRetry();
      return;
    }

    if (progress) {
      progress.textContent = message;
    }
    if (result) {
      result.innerHTML = `<p class="error">${message}</p>`;
    }
  } finally {
    isSubmitting = false;
    hideLoadingOverlay();
    updatePendingActionState();
  }
}

function queueUnsyncedAnswersForRetry() {
  const localDraft = loadLocalDraft();
  const unsyncedIds = getUnsyncedQuestionIdSet();
  const state = getState();

  unsyncedIds.forEach((questionId) => {
    const answerValue = Number(state.answers[questionId] ?? localDraft[questionId]);
    if (!Number.isFinite(answerValue)) return;
    markQuestionPendingRetry(questionId);
    queueAnswerSave(questionId, answerValue);
  });
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
    showQuestionScreen();
    await bootstrap();
    document.title = 'Persoonlijkheidstest – Ontdek jouw persoonlijkheidstype';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showError('Resetten mislukt. Probeer het opnieuw.');
  }
}

async function bootstrap() {
  try {
    showQuestionScreen();
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
      showError(`${baseMessage} ${buildDebugHint('api/v1/get_progress.php', error?.status)}`);
      return;
    }

    showError(baseMessage);
  }
}

initThemeToggle();
bootstrap();
