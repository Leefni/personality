import {
  PAGE_SIZE,
  IS_DEVELOPMENT_ENV,
  likertLabels,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
  buildDebugHint,
  showError,
  apiFetch,
  formatApiError
} from './js/utils.js';
import { RESULT_CONTENT } from './js/result-content.js';

let questions = [];
let answers = {};
let page = 1;
let perPage = PAGE_SIZE;
let totalQuestions = 0;
let hasQuestionChangeListener = false;
const pendingQuestionIds = new Set();
const saveTimers = new Map();

function setupQuestionChangeListener() {
  if (hasQuestionChangeListener) return;

  const questionsElement = document.getElementById('questions');
  questionsElement?.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('input[type="radio"][data-qid]')) return;

    const qid = Number(target.dataset.qid);
    const value = Number(target.dataset.value);
    if (!Number.isInteger(qid) || !Number.isFinite(value)) return;

    queueAnswerSave(qid, value);
  });

  hasQuestionChangeListener = true;
}

function mergeProgress(saved) {
  const localDraft = loadLocalDraft();
  const serverAnswers = {};

  saved.forEach((item) => {
    serverAnswers[item.question_id] = Number(item.value);
  });

  answers = { ...serverAnswers, ...localDraft };

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

async function loadQuestions() {
  const dataEndpoint = `api/v1/get_questions.php?page=${page}&per_page=${perPage}`;

  try {
    const questionPayload = await apiFetch(dataEndpoint);
    questions = Array.isArray(questionPayload.questions) ? questionPayload.questions : [];
    totalQuestions = Number(questionPayload.total ?? 0);
    page = Number(questionPayload.page ?? 1);
    perPage = Number(questionPayload.per_page ?? PAGE_SIZE);
    render();
  } catch (error) {
    console.error('loadQuestions mislukte.', error.status, error.payload);

    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    if (IS_DEVELOPMENT_ENV) {
      showError(`${baseMessage} ${buildDebugHint(dataEndpoint, error.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

async function bootstrap() {
  try {
    setupQuestionChangeListener();
    const saved = await apiFetch('api/v1/get_progress.php');
    mergeProgress(saved);
    await loadQuestions();
  } catch (error) {
    console.error('bootstrap mislukte.', error.status, error.payload);

    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    if (IS_DEVELOPMENT_ENV) {
      showError(`${baseMessage} ${buildDebugHint('api/v1/get_progress.php', error.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

function render() {
  const qDiv = document.getElementById('questions');
  qDiv.innerHTML = '';

  questions.forEach((q, index) => {
    const div = document.createElement('article');
    div.className = 'question';
    const isPending = pendingQuestionIds.has(q.id);

    div.innerHTML = `
      <p><strong>${(page - 1) * perPage + index + 1}.</strong> ${q.text}</p>
      <fieldset class="likert" ${isPending ? 'disabled' : ''}>
        <legend class="sr-only">Kies een antwoordoptie voor vraag ${(page - 1) * perPage + index + 1}</legend>
        ${[1, 2, 3, 4, 5].map((value) => `
          <div class="likert-option">
            <input
              type="radio"
              id="q-${q.id}-v-${value}"
              name="q-${q.id}"
              data-qid="${q.id}"
              data-value="${value}"
              value="${value}"
              ${answers[q.id] === value ? 'checked' : ''}
            >
            <label for="q-${q.id}-v-${value}">${value} <span class="sr-only">(${likertLabels[value - 1]})</span></label>
          </div>
        `).join('')}
      </fieldset>
      <div class="likert-labels">
        <span>${likertLabels[0]}</span>
        <span>${likertLabels[4]}</span>
      </div>
    `;

    qDiv.appendChild(div);
  });

  renderNav();
  updateProgress();
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.innerHTML = '';

  if (page > 1) {
    const prev = document.createElement('button');
    prev.className = 'prev';
    prev.textContent = 'Prev';
    prev.addEventListener('click', () => {
      page -= 1;
      loadQuestions();
    });
    nav.appendChild(prev);
  }

  const hasNext = page * perPage < totalQuestions;
  if (hasNext) {
    const next = document.createElement('button');
    next.className = 'next';
    next.textContent = 'Next';
    next.addEventListener('click', () => {
      page += 1;
      loadQuestions();
    });
    nav.appendChild(next);
  } else {
    const submit = document.createElement('button');
    submit.className = 'submit';
    submit.textContent = 'Bekijk resultaat';
    const answeredCount = Object.keys(answers).length;
    const isComplete = answeredCount === totalQuestions;
    submit.disabled = !isComplete;
    submit.title = isComplete ? '' : 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.';
    submit.addEventListener('click', submitTest);
    nav.appendChild(submit);
  }
}

function updateProgress() {
  const totalPages = Math.max(1, Math.ceil(totalQuestions / perPage));
  document.getElementById('progress').textContent =
    `Pagina ${page} / ${totalPages} — ${Object.keys(answers).length} van ${totalQuestions} vragen ingevuld`;
}

function queueAnswerSave(questionId, value) {
  answers[questionId] = value;
  saveLocalDraft(answers);
  render();

  const existingTimer = saveTimers.get(questionId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  const timerId = window.setTimeout(async () => {
    saveTimers.delete(questionId);
    await persistAnswer(questionId, value);
  }, 300);

  saveTimers.set(questionId, timerId);
}

async function persistAnswer(questionId, value) {
  pendingQuestionIds.add(questionId);
  render();

  try {
    await apiFetch('api/v1/save_answer.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, value })
    });
    saveLocalDraft(answers);
  } catch (error) {
    saveLocalDraft(answers);
    const message = formatApiError(error, 'Opslaan mislukt. Probeer het opnieuw.');
    showError(message, 'progress');
  } finally {
    pendingQuestionIds.delete(questionId);
    render();
  }
}

async function submitTest() {
  try {
    const data = await apiFetch('api/v1/submit_results.php', { method: 'POST' });
    clearLocalDraft();
    showResult(data);
  } catch (error) {
    const progress = document.getElementById('progress');
    const result = document.getElementById('result');
    const message = formatApiError(error, 'Resultaat ophalen mislukt. Probeer het opnieuw.');

    if (error.status === 422 && error.payload?.message === 'Incomplete test') {
      const answered = Number(error.payload.answered);
      const total = Number(error.payload.total);
      const incompleteMessage = `Test is nog niet compleet: ${answered} van ${total} vragen beantwoord.`;

      progress.textContent = incompleteMessage;
      result.innerHTML = `<p class="error">${incompleteMessage}</p>`;
      return;
    }

    progress.textContent = message;
    result.innerHTML = `<p class="error">${message}</p>`;
  }
}

async function resetTest() {
  try {
    await apiFetch('api/v1/reset_progress.php', { method: 'POST' });
    answers = {};
    page = 1;
    clearLocalDraft();
    document.getElementById('result').innerHTML = '';
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
  const description = details?.shortDescription ?? 'Geen beschrijving beschikbaar voor dit type.';

  res.innerHTML = `
    <h2>Resultaat</h2>
    <p>Persoonlijkheidstype: <strong>${type}</strong></p>
    <p>${description}</p>
    <button type="button" class="restart">Opnieuw doen</button>
  `;

  res.querySelector('.restart')?.addEventListener('click', resetTest);

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

bootstrap();
