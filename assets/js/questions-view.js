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
 * @param {() => boolean} isAttached - Function that reports if listener already exists.
 * @param {(attached: boolean) => void} setAttached - Function that stores listener attached state.
 * @param {(questionId: number, value: number) => void} onAnswerChange - Callback for radio value changes.
 * @returns {void} Nothing.
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

  setAttached(true);
}

function createQuestionRow(question, index, viewModel) {
  const div = document.createElement('article');
  div.className = 'question';
  div.dataset.questionId = String(question.id);
  const isPending = viewModel.pendingQuestionIds.has(question.id);

  div.innerHTML = `
    <p><strong>${(viewModel.page - 1) * viewModel.perPage + index + 1}.</strong> ${question.text}</p>
    <fieldset class="likert" ${isPending ? 'disabled' : ''}>
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
            ${viewModel.answers[question.id] === value ? 'checked' : ''}
          >
          <label for="q-${question.id}-v-${value}">${value} <span class="sr-only">(${viewModel.likertLabels[value - 1]})</span></label>
        </div>
      `).join('')}
    </fieldset>
    <div class="likert-labels">
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
 * Re-renders one question row after its answer state changes.
 * @param {number} questionId - Question id to refresh in the DOM.
 * @param {{questions: Array, page: number, perPage: number, answers: Object, pendingQuestionIds: Set<number>, likertLabels: string[]}} viewModel - Values needed to build row markup.
 * @returns {void} Nothing.
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
 * Enables or disables a question while its save request is running.
 * @param {number} questionId - Question id to toggle disabled state for.
 * @param {Set<number>} pendingQuestionIds - Set of ids currently being saved.
 * @returns {void} Nothing.
 */
export function updateQuestionPendingState(questionId, pendingQuestionIds) {
  const questionElement = getRenderedQuestionElement(questionId);
  if (!questionElement) return;

  const fieldset = questionElement.querySelector('fieldset');
  if (!fieldset) return;

  fieldset.disabled = pendingQuestionIds.has(questionId);
}

/**
 * Updates submit button enabled state based on completion.
 * @param {Object} answers - Current answers keyed by question id.
 * @param {number} totalQuestions - Number of questions in quiz.
 * @param {Set<number>} pendingQuestionIds - In-flight save ids used to optionally block submit.
 * @returns {void} Nothing.
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
 * @param {string} dataEndpoint - Endpoint used, shown in development hint.
 * @param {boolean} isDevelopment - True when debug details should be shown.
 * @returns {void} Nothing.
 */
export function renderEmptyState(dataEndpoint, isDevelopment) {
  const progress = document.getElementById('progress');
  const questionsElement = document.getElementById('questions');
  const nav = document.getElementById('nav');

  const baseMessage = 'Geen vragen gevonden. Controleer database-seeding.';
  progress.textContent = baseMessage;

  if (isDevelopment) {
    const debugHint = `Debug: controleer response van ${dataEndpoint} en verwacht dat db_bootstrap/seed ten minste 1 vraag aanmaakt.`;
    questionsElement.innerHTML = `
      <p class="error">${baseMessage}</p>
      <p class="error">${debugHint}</p>
    `;
  } else {
    questionsElement.innerHTML = `<p class="error">${baseMessage}</p>`;
  }

  nav.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
  nav.innerHTML = '';
  nav.hidden = true;
}

/**
 * Renders pagination/submit buttons for the current page.
 * @param {{page: number, perPage: number, totalQuestions: number, answers: Object, pendingQuestionIds: Set<number>}} viewModel - Current pagination and answer values.
 * @param {{onPrev: () => void, onNext: () => void, onSubmit: () => void}} handlers - Callbacks for nav button clicks.
 * @returns {void} Nothing.
 */
export function renderNav(viewModel, handlers) {
  const nav = document.getElementById('nav');
  nav.hidden = false;
  nav.innerHTML = '';

  if (viewModel.page > 1) {
    const prev = document.createElement('button');
    prev.className = 'prev';
    prev.textContent = 'Prev';
    prev.addEventListener('click', handlers.onPrev);
    nav.appendChild(prev);
  }

  const hasNext = viewModel.page * viewModel.perPage < viewModel.totalQuestions;
  if (hasNext) {
    const next = document.createElement('button');
    next.className = 'next';
    next.textContent = 'Next';
    next.addEventListener('click', handlers.onNext);
    nav.appendChild(next);
    return;
  }

  const submit = document.createElement('button');
  submit.className = 'submit';
  submit.textContent = 'Bekijk resultaat';
  const answeredCount = Object.keys(viewModel.answers).length;
  const isComplete = answeredCount === viewModel.totalQuestions;
  const hasPendingSaves = viewModel.pendingQuestionIds.size > 0;
  submit.disabled = !isComplete || hasPendingSaves;
  submit.title = !isComplete
    ? 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.'
    : hasPendingSaves
      ? 'Nog bezig met opslaan. Wacht even tot alles klaar is.'
      : '';
  submit.addEventListener('click', handlers.onSubmit);
  nav.appendChild(submit);
}

/**
 * Updates the page and answer count progress text.
 * @param {{page: number, perPage: number, totalQuestions: number, answers: Object}} viewModel - Values used to build progress text.
 * @returns {void} Nothing.
 */
export function updateProgress(viewModel) {
  const totalPages = Math.max(1, Math.ceil(viewModel.totalQuestions / viewModel.perPage));
  document.getElementById('progress').textContent =
    `Pagina ${viewModel.page} / ${totalPages} — ${Object.keys(viewModel.answers).length} van ${viewModel.totalQuestions} vragen ingevuld`;
}

/**
 * Renders the full question list and navigation controls.
 * @param {{questions: Array, page: number, perPage: number, totalQuestions: number, answers: Object, pendingQuestionIds: Set<number>, likertLabels: string[]}} viewModel - Data needed to paint the question page.
 * @param {{isDevelopment: boolean, onPrev: () => void, onNext: () => void, onSubmit: () => void}} handlers - Environment flag and click handlers.
 * @returns {void} Nothing.
 */
export function renderQuestions(viewModel, handlers) {
  const qDiv = document.getElementById('questions');
  const isFirstPageEmpty = viewModel.page === 1 && (viewModel.totalQuestions === 0 || viewModel.questions.length === 0);
  if (isFirstPageEmpty) {
    renderEmptyState(`api/v1/get_questions.php?page=${viewModel.page}&per_page=${viewModel.perPage}`, handlers.isDevelopment);
    return;
  }

  qDiv.innerHTML = '';
  viewModel.questions.forEach((q, index) => {
    qDiv.appendChild(createQuestionRow(q, index, viewModel));
  });

  renderNav(viewModel, handlers);
  updateProgress(viewModel);
}
