/**
 * Updates the progress line above the quiz.
 * @param {string} message - Text to show in the progress element.
 * @returns {void} Nothing.
 */
export function setProgressMessage(message) {
  const progress = document.getElementById('progress');
  if (!progress) return;
  progress.textContent = message;
}

/**
 * Attaches a single delegated change listener for question radio inputs.
 * @param {() => boolean} isAttached
 * @param {(attached: boolean) => void} setAttached
 * @param {(questionId: number, value: number) => void} onAnswerChange
 * @returns {void}
 */
export function setupQuestionChangeListener(isAttached, setAttached, onAnswerChange) {
  if (isAttached()) return;

  const questionsElement = document.getElementById('questions');
  questionsElement?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('input[type="radio"][data-qid]')) return;

    const qid = Number(target.dataset.qid);
    const value = Number(target.dataset.value);
    if (!Number.isInteger(qid) || !Number.isFinite(value)) return;

    onAnswerChange(qid, value);
  });

  // Keyboard roving within each likert fieldset (←/→ arrow keys).
  questionsElement?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('input[type="radio"][data-qid]')) return;

    const fieldset = target.closest('fieldset.likert');
    if (!fieldset) return;

    const radios = Array.from(fieldset.querySelectorAll('input[type="radio"]'));
    const currentIndex = radios.indexOf(target);
    if (currentIndex === -1) return;

    let nextIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = currentIndex < radios.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : radios.length - 1;
    }

    event.preventDefault();
    const nextRadio = radios[nextIndex];
    if (!(nextRadio instanceof HTMLInputElement)) return;

    // Move roving tabindex.
    radios.forEach((r) => r.setAttribute('tabindex', '-1'));
    nextRadio.setAttribute('tabindex', '0');
    nextRadio.focus();
    nextRadio.click(); // select + trigger change event
  });

  setAttached(true);
}

function createQuestionRow(question, index, viewModel) {
  const div = document.createElement('article');
  div.className = 'question';
  div.dataset.questionId = String(question.id);
  const currentAnswer = viewModel.answers[question.id];

  div.innerHTML = `
    <p><strong>${(viewModel.page - 1) * viewModel.perPage + index + 1}.</strong> ${question.text}</p>
    <fieldset class="likert" aria-describedby="likert-scale-hint">
      <legend class="sr-only">Kies een antwoordoptie voor vraag ${(viewModel.page - 1) * viewModel.perPage + index + 1}</legend>
      ${[1, 2, 3, 4, 5, 6].map((value) => `
        <div class="likert-option">
          <input
            type="radio"
            id="q-${question.id}-v-${value}"
            name="q-${question.id}"
            data-qid="${question.id}"
            data-value="${value}"
            value="${value}"
            title="${viewModel.likertLabels[value - 1]}"
            tabindex="${(currentAnswer ?? 1) === value ? '0' : '-1'}"
            ${currentAnswer === value ? 'checked' : ''}
          >
          <label for="q-${question.id}-v-${value}">
            <span class="likert-num">${value}</span>
            <span class="likert-hint" aria-hidden="true">${viewModel.likertLabels[value - 1]}</span>
            <span class="sr-only">(${viewModel.likertLabels[value - 1]})</span>
          </label>
        </div>
      `).join('')}
    </fieldset>
    <div class="likert-labels" aria-hidden="true">
      <span>${viewModel.likertLabels[0]}</span>
      <span>${viewModel.likertLabels[5]}</span>
    </div>
  `;

  return div;
}

function getRenderedQuestionElement(questionId) {
  return document.querySelector(`[data-question-id="${questionId}"]`);
}

/**
 * Plays a temporary success pulse on the rendered question container.
 * @param {HTMLElement} questionElement
 * @returns {void}
 */
export function flashSavedQuestion(questionElement) {
  questionElement.classList.remove('answer-saved');
  void questionElement.offsetWidth;
  questionElement.classList.add('answer-saved');

  // Show a brief "✓ Opgeslagen" badge in the corner.
  const existing = questionElement.querySelector('.save-badge');
  if (existing) existing.remove();

  const badge = document.createElement('span');
  badge.className = 'save-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = '✓';
  questionElement.appendChild(badge);

  window.setTimeout(() => {
    badge.classList.add('save-badge--out');
    window.setTimeout(() => {
      badge.remove();
      questionElement.classList.remove('answer-saved');
    }, 300);
  }, 900);
}

/**
 * Re-renders one question row after its answer state changes.
 * @param {number} questionId
 * @param {Object} viewModel
 * @returns {void}
 */
export function updateQuestionRow(questionId, viewModel) {
  const questionIndex = viewModel.questions.findIndex((question) => question.id === questionId);
  if (questionIndex < 0) return;

  const existingElement = getRenderedQuestionElement(questionId);
  if (!existingElement) return;

  const nextElement = createQuestionRow(viewModel.questions[questionIndex], questionIndex, viewModel);
  existingElement.replaceWith(nextElement);
}

/**
 * Updates submit button enabled state based on completion.
 * @param {Object} answers
 * @param {number} totalQuestions
 * @param {boolean} [isNavigating]
 * @param {boolean} [hasUnsyncedAnswers]
 * @returns {void}
 */
export function updateNavState(
  answers,
  totalQuestions,
  isNavigating = false,
  hasUnsyncedAnswers = false
) {
  const submitButton = document.querySelector('#nav .submit');
  if (!submitButton) return;

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === totalQuestions;
  submitButton.disabled = !isComplete || isNavigating || hasUnsyncedAnswers;
  submitButton.title = !isComplete
    ? 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.'
    : (hasUnsyncedAnswers
      ? 'Nog niet alle antwoorden zijn met de server gesynchroniseerd.'
      : '');
}

/**
 * Renders a fallback state for an empty first page of questions.
 * @param {string} dataEndpoint
 * @param {boolean} isDevelopment
 * @returns {void}
 */
export function renderEmptyState(dataEndpoint, isDevelopment) {
  const progress = document.getElementById('progress');
  const questionsElement = document.getElementById('questions');
  const nav = document.getElementById('nav');

  const baseMessage = 'Geen vragen gevonden. Controleer database-seeding.';
  if (progress) progress.textContent = baseMessage;

  if (isDevelopment) {
    const debugHint = `Debug: controleer response van ${dataEndpoint} en verwacht dat db_bootstrap/seed ten minste 1 vraag aanmaakt.`;
    if (questionsElement) {
      questionsElement.innerHTML = `
        <p class="error" role="alert">${baseMessage}</p>
        <p class="error">${debugHint}</p>
      `;
    }
  } else if (questionsElement) {
    questionsElement.innerHTML = `<p class="error" role="alert">${baseMessage}</p>`;
  }

  if (nav) {
    nav.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    nav.innerHTML = '';
    nav.hidden = true;
  }
}

/**
 * Counts unanswered questions for the currently rendered page.
 * @param {Object} viewModel
 * @returns {number}
 */
export function getUnansweredCountOnPage(viewModel) {
  return viewModel.questions.filter((q) => viewModel.answers[q.id] === undefined).length;
}

function ensureIncompletePageModal() {
  let modal = document.getElementById('incomplete-page-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'incomplete-page-modal';
  modal.className = 'modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal__backdrop" data-modal-close="true"></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="incomplete-page-title" aria-describedby="incomplete-page-message">
      <h2 id="incomplete-page-title">Incomplete Page</h2>
      <p id="incomplete-page-message">You haven't answered all questions. Are you sure you want to continue?</p>
      <div class="modal__actions">
        <button type="button" class="modal-go-back">Go Back</button>
        <button type="button" class="modal-continue">Continue Anyway</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function showIncompletePageModal(onContinue) {
  const modal = ensureIncompletePageModal();
  const goBackButton = modal.querySelector('.modal-go-back');
  const continueButton = modal.querySelector('.modal-continue');
  const backdrop = modal.querySelector('[data-modal-close="true"]');

  if (!(goBackButton instanceof HTMLButtonElement) || !(continueButton instanceof HTMLButtonElement)) {
    return;
  }

  const closeModal = () => {
    modal.hidden = true;
    goBackButton.removeEventListener('click', handleGoBack);
    continueButton.removeEventListener('click', handleContinue);
    backdrop?.removeEventListener('click', handleGoBack);
  };

  const handleGoBack = () => {
    closeModal();
  };

  const handleContinue = () => {
    closeModal();
    onContinue();
  };

  goBackButton.addEventListener('click', handleGoBack);
  continueButton.addEventListener('click', handleContinue);
  backdrop?.addEventListener('click', handleGoBack);
  modal.hidden = false;
  goBackButton.focus();
}

/**
 * Renders pagination/submit buttons for the current page.
 * @param {Object} viewModel
 * @param {Object} handlers
 * @returns {void}
 */
export function renderNav(viewModel, handlers) {
  const nav = document.getElementById('nav');
  nav.hidden = false;
  nav.innerHTML = '';
  const isNavigating = Boolean(viewModel.isNavigating);

  if (viewModel.page > 1) {
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'prev';
    prev.textContent = '← Vorige';
    prev.disabled = isNavigating;
    prev.addEventListener('click', handlers.onPrev);
    nav.appendChild(prev);
  }

  const hasNext = viewModel.page * viewModel.perPage < viewModel.totalQuestions;
  if (hasNext) {
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'next';
    next.textContent = 'Volgende →';
    next.disabled = isNavigating;
    next.addEventListener('click', handlers.onNext);
    nav.appendChild(next);
  } else {
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'submit';
    submit.textContent = 'Bekijk resultaat';
    const answeredCount = Object.keys(viewModel.answers).length;
    const isComplete = answeredCount === viewModel.totalQuestions;
    submit.disabled = isNavigating || !isComplete;
    submit.title = !isComplete
      ? 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.'
      : '';
    submit.addEventListener('click', handlers.onSubmit);
    nav.appendChild(submit);
  }

  updatePageHint(viewModel);
}

/**
 * Updates the unanswered questions hint in #nav.
 * @param {Object} viewModel
 * @returns {void}
 */
export function updatePageHint(viewModel) {
  const nav = document.getElementById('nav');
  if (!(nav instanceof HTMLElement)) return;

  const unansweredOnPage = getUnansweredCountOnPage(viewModel);
  const hints = Array.from(nav.querySelectorAll('.page-hint'));
  const existingHint = hints[0] instanceof HTMLElement ? hints[0] : null;

  hints.slice(1).forEach((hint) => hint.remove());

  if (unansweredOnPage <= 0) {
    existingHint?.remove();
    return;
  }

  const suffix = unansweredOnPage === 1 ? 'vraag' : 'vragen';
  const text = `Nog ${unansweredOnPage} openstaande ${suffix} op deze pagina`;

  if (existingHint) {
    existingHint.textContent = text;
    return;
  }

  const hint = document.createElement('p');
  hint.className = 'page-hint';
  hint.textContent = text;
  nav.appendChild(hint);
}

export function renderPageDots(viewModel, handlers = {}) {
  const questionsContainer = document.getElementById('questions');
  if (!questionsContainer) return;

  const totalPages = Math.max(1, Math.ceil(viewModel.totalQuestions / viewModel.perPage));
  const dots = document.createElement('div');
  dots.className = 'page-dots';
  dots.setAttribute('role', 'navigation');
  dots.setAttribute('aria-label', `Paginanavigatie: pagina ${viewModel.page} van ${totalPages}`);

  Array.from({ length: totalPages }).forEach((_, index) => {
    const pageNumber = index + 1;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'page-dot';
    dot.dataset.page = String(pageNumber);
    dot.setAttribute('aria-label', `Ga naar pagina ${pageNumber}`);
    if (pageNumber === viewModel.page) {
      dot.classList.add('is-active');
      dot.setAttribute('aria-current', 'page');
      dot.disabled = true;
    } else {
      dot.addEventListener('click', (event) => {
        if (typeof handlers.onPageSelect === 'function') {
          handlers.onPageSelect(pageNumber, event);
        }
      });
    }
    dots.appendChild(dot);
  });

  questionsContainer.appendChild(dots);
}

function ensureProgressBarElements() {
  const progress = document.getElementById('progress');
  if (!progress || !progress.parentElement) return null;

  let progressWrap = document.getElementById('progress-wrap');
  if (!progressWrap) {
    if (typeof progress.insertAdjacentElement !== 'function') {
      return null;
    }
    progressWrap = document.createElement('section');
    progressWrap.id = 'progress-wrap';
    progressWrap.className = 'progress-wrap';
    progressWrap.setAttribute('aria-label', 'Voortgang');
    progressWrap.innerHTML = `
      <div id="progress-bar" class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Percentage vragen ingevuld">
        <div id="progress-bar-fill" class="progress-bar-fill"></div>
      </div>
      <p class="progress-meta">
        <span id="progress-percentage">0%</span> afgerond
      </p>
    `;
    progress.insertAdjacentElement('afterend', progressWrap);
  }

  const progressBar = progressWrap.querySelector('#progress-bar');
  const progressFill = progressWrap.querySelector('#progress-bar-fill');
  const progressPercentage = progressWrap.querySelector('#progress-percentage');

  if (
    !(progressBar instanceof HTMLElement) ||
    !(progressFill instanceof HTMLElement) ||
    !(progressPercentage instanceof HTMLElement)
  ) {
    return null;
  }

  return { progressBar, progressFill, progressPercentage };
}

/**
 * Updates the page and answer count progress text.
 * @param {Object} viewModel
 * @returns {void}
 */
export function updateProgress(viewModel) {
  const totalPages = Math.max(1, Math.ceil(viewModel.totalQuestions / viewModel.perPage));
  const answeredCount = Object.keys(viewModel.answers).length;
  const progressEl = document.getElementById('progress');
  if (progressEl) {
    progressEl.textContent =
      `Pagina ${viewModel.page} / ${totalPages} — ${answeredCount} van ${viewModel.totalQuestions} vragen ingevuld`;
  }

  const progressElements = ensureProgressBarElements();
  if (!progressElements) return;

  const completionPercent = viewModel.totalQuestions > 0
    ? (answeredCount / viewModel.totalQuestions) * 100
    : 0;
  const roundedCompletionPercent = Math.round(completionPercent);
  progressElements.progressFill.style.width = `${completionPercent}%`;
  progressElements.progressBar.setAttribute('aria-valuenow', String(roundedCompletionPercent));
  progressElements.progressPercentage.textContent = `${roundedCompletionPercent}%`;
}

/**
 * Renders the full question list and navigation controls.
 * @param {Object} viewModel
 * @param {Object} handlers
 * @returns {void}
 */
export function renderQuestions(viewModel, handlers) {
  const qDiv = document.getElementById('questions');
  const isFirstPageEmpty =
    viewModel.page === 1 &&
    (viewModel.totalQuestions === 0 || viewModel.questions.length === 0);

  if (isFirstPageEmpty) {
    renderEmptyState(
      `api/v1/get_questions.php?page=${viewModel.page}&per_page=${viewModel.perPage}`,
      handlers.isDevelopment
    );
    return;
  }

  qDiv.innerHTML =
    '<p id="likert-scale-hint" class="sr-only">Schaal van 1 (Helemaal oneens) tot 6 (Helemaal eens).</p>';
  viewModel.questions.forEach((q, index) => {
    qDiv.appendChild(createQuestionRow(q, index, viewModel));
  });
  renderPageDots(viewModel, handlers);

  renderNav(viewModel, handlers);
  updateProgress(viewModel);
}
