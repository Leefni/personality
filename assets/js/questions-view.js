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
 * @param {Set<number>} [pendingQuestionIds]
 * @returns {void}
 */
export function updateNavState(answers, totalQuestions, pendingQuestionIds = new Set()) {
  const submitButton = document.querySelector('#nav .submit');
  if (!submitButton) return;

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === totalQuestions;
  const hasPendingSaves = pendingQuestionIds.size > 0;
  submitButton.disabled = !isComplete || hasPendingSaves;
  submitButton.title = !isComplete
    ? 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.'
    : hasPendingSaves
      ? 'Nog bezig met opslaan. Wacht even tot alles klaar is.'
      : '';
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
    prev.className = 'prev';
    prev.textContent = '← Vorige';
    prev.disabled = isNavigating;
    prev.addEventListener('click', handlers.onPrev);
    nav.appendChild(prev);
  }

  const hasNext = viewModel.page * viewModel.perPage < viewModel.totalQuestions;
  if (hasNext) {
    const next = document.createElement('button');
    next.className = 'next';
    next.textContent = 'Volgende →';
    next.disabled = isNavigating;
    next.addEventListener('click', handlers.onNext);
    nav.appendChild(next);
  } else {
    const submit = document.createElement('button');
    submit.className = 'submit';
    submit.textContent = 'Bekijk resultaat';
    const answeredCount = Object.keys(viewModel.answers).length;
    const isComplete = answeredCount === viewModel.totalQuestions;
    const hasPendingSaves = viewModel.pendingQuestionIds.size > 0;
    submit.disabled = isNavigating || !isComplete || hasPendingSaves;
    submit.title = !isComplete
      ? 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.'
      : hasPendingSaves
        ? 'Nog bezig met opslaan. Wacht even tot alles klaar is.'
        : '';
    submit.addEventListener('click', handlers.onSubmit);
    nav.appendChild(submit);
  }

  // Only show the unanswered-count hint when there are actually unanswered questions on this page.
  const unansweredOnPage = viewModel.questions
    .filter((q) => viewModel.answers[q.id] === undefined)
    .length;

  if (unansweredOnPage > 0) {
    const hint = document.createElement('p');
    hint.className = 'page-hint';
    const suffix = unansweredOnPage === 1 ? 'vraag' : 'vragen';
    hint.textContent = `Nog ${unansweredOnPage} openstaande ${suffix} op deze pagina`;
    nav.appendChild(hint);
  }
}

export function renderPageDots(viewModel) {
  const questionsContainer = document.getElementById('questions');
  if (!questionsContainer) return;

  const totalPages = Math.max(1, Math.ceil(viewModel.totalQuestions / viewModel.perPage));
  const dots = document.createElement('div');
  dots.className = 'page-dots';
  dots.setAttribute('role', 'status');
  dots.setAttribute('aria-label', `Paginastatus: pagina ${viewModel.page} van ${totalPages}`);

  Array.from({ length: totalPages }).forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = 'page-dot';
    if (index + 1 === viewModel.page) {
      dot.classList.add('is-active');
      dot.setAttribute('aria-current', 'page');
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
  renderPageDots(viewModel);

  renderNav(viewModel, handlers);
  updateProgress(viewModel);
}
