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
let testMetadata = null;
let hasQuestionChangeListener = false;
const pendingQuestionIds = new Set();
const saveTimers = new Map();
let renderCount = 0;

function setProgressMessage(message) {
  const progress = document.getElementById('progress');
  if (!progress) return;
  progress.textContent = message;
}

function setMetadata(meta) {
  if (!meta || typeof meta !== 'object') return;
  testMetadata = {
    version: typeof meta.version === 'string' && meta.version.trim() !== '' ? meta.version : 'Onbekend',
    date: typeof meta.date === 'string' && meta.date.trim() !== '' ? meta.date : 'Onbekend',
    question_count: Number.isFinite(Number(meta.question_count)) ? Number(meta.question_count) : totalQuestions
  };
  renderMetadata();
}

function renderMetadata() {
  const metaElement = document.getElementById('test-meta');
  if (!metaElement || !testMetadata) return;

  metaElement.textContent = `Testversie ${testMetadata.version} (${testMetadata.date}) — ${testMetadata.question_count} vragen`;
}

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


async function loadTestMetadata() {
  try {
    const metadataPayload = await apiFetch('api/v1/test_metadata.php');
    setMetadata(metadataPayload);
  } catch (error) {
    if (IS_DEVELOPMENT_ENV) {
      console.warn('Kon testmetadata niet laden via api/v1/test_metadata.php', error);
    }
  }
}

async function loadQuestions() {
  const dataEndpoint = `api/v1/get_questions.php?page=${page}&per_page=${perPage}`;

  try {
    const questionPayload = await apiFetch(dataEndpoint);
    const hasValidSchema = questionPayload
      && typeof questionPayload === 'object'
      && !Array.isArray(questionPayload)
      && Array.isArray(questionPayload.questions)
      && Number.isFinite(Number(questionPayload.total))
      && Number.isFinite(Number(questionPayload.page))
      && Number.isFinite(Number(questionPayload.per_page));

    if (!hasValidSchema) {
      const schemaError = new Error('Invalid questions payload schema: expected questions[] and numeric total/page/per_page.');
      schemaError.url = dataEndpoint;
      schemaError.status = 200;
      schemaError.payload = questionPayload;
      throw schemaError;
    }

    questions = questionPayload.questions;
    totalQuestions = Number(questionPayload.total);
    page = Number(questionPayload.page);
    perPage = Number(questionPayload.per_page);
    setMetadata(questionPayload.metadata);
    render();
  } catch (error) {
    console.error('loadQuestions mislukte.', error.status, error.payload);

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

function createQuestionRow(question, index) {
  const div = document.createElement('article');
  div.className = 'question';
  div.dataset.questionId = String(question.id);
  const isPending = pendingQuestionIds.has(question.id);

  div.innerHTML = `
    <p><strong>${(page - 1) * perPage + index + 1}.</strong> ${question.text}</p>
    <fieldset class="likert" ${isPending ? 'disabled' : ''}>
      <legend class="sr-only">Kies een antwoordoptie voor vraag ${(page - 1) * perPage + index + 1}</legend>
      ${[1, 2, 3, 4, 5].map((value) => `
        <div class="likert-option">
          <input
            type="radio"
            id="q-${question.id}-v-${value}"
            name="q-${question.id}"
            data-qid="${question.id}"
            data-value="${value}"
            value="${value}"
            ${answers[question.id] === value ? 'checked' : ''}
          >
          <label for="q-${question.id}-v-${value}">${value} <span class="sr-only">(${likertLabels[value - 1]})</span></label>
        </div>
      `).join('')}
    </fieldset>
    <div class="likert-labels">
      <span>${likertLabels[0]}</span>
      <span>${likertLabels[4]}</span>
    </div>
  `;

  return div;
}

function getRenderedQuestionElement(questionId) {
  return document.querySelector(`[data-question-id="${questionId}"]`);
}

function updateQuestionPendingState(questionId) {
  const questionElement = getRenderedQuestionElement(questionId);
  if (!questionElement) return;

  const fieldset = questionElement.querySelector('fieldset');
  if (!fieldset) return;

  fieldset.disabled = pendingQuestionIds.has(questionId);
}

function updateQuestionRow(questionId) {
  const questionIndex = questions.findIndex((question) => question.id === questionId);
  if (questionIndex < 0) return;

  const existingElement = getRenderedQuestionElement(questionId);
  if (!existingElement) return;

  const nextElement = createQuestionRow(questions[questionIndex], questionIndex);
  existingElement.replaceWith(nextElement);
}

function updateNavState() {
  const submitButton = document.querySelector('#nav .submit');
  if (!submitButton) return;

  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === totalQuestions;
  submitButton.disabled = !isComplete;
  submitButton.title = isComplete ? '' : 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.';
}

function renderEmptyState(dataEndpoint) {
  const progress = document.getElementById('progress');
  const questionsElement = document.getElementById('questions');
  const nav = document.getElementById('nav');

  const baseMessage = 'Geen vragen gevonden. Controleer database-seeding.';
  progress.textContent = baseMessage;

  if (IS_DEVELOPMENT_ENV) {
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

async function bootstrap() {
  try {
    setupQuestionChangeListener();
    bindDeleteDataActions();
    await loadTestMetadata();
    const saved = await apiFetch('api/v1/get_progress.php');
    mergeProgress(saved);
    await loadQuestions();
  } catch (error) {
    console.error('bootstrap mislukte.', error.status, error.payload);

    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    setProgressMessage(baseMessage);
    if (IS_DEVELOPMENT_ENV) {
      showError(`${baseMessage} ${buildDebugHint('api/v1/get_progress.php', error.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

function render() {
  renderCount += 1;
  if (IS_DEVELOPMENT_ENV) {
    window.__appRenderStats = {
      fullRenderCount: renderCount,
      page,
      perPage,
      totalQuestions
    };
    console.debug(`[render] full render #${renderCount} (page ${page})`);
  }

  const qDiv = document.getElementById('questions');
  const isFirstPageEmpty = page === 1 && (totalQuestions === 0 || questions.length === 0);
  if (isFirstPageEmpty) {
    renderEmptyState(`api/v1/get_questions.php?page=${page}&per_page=${perPage}`);
    return;
  }

  qDiv.innerHTML = '';

  questions.forEach((q, index) => {
    qDiv.appendChild(createQuestionRow(q, index));
  });

  renderNav();
  updateProgress();
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.hidden = false;
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
  updateQuestionRow(questionId);
  updateProgress();
  updateNavState();

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
  updateQuestionPendingState(questionId);
  updateProgress();

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
    updateQuestionPendingState(questionId);
    updateProgress();
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

async function deleteMyData() {
  try {
    await apiFetch('api/v1/delete_data.php', { method: 'POST' });
    answers = {};
    page = 1;
    clearLocalDraft();
    document.getElementById('result').innerHTML = '<p>Je gegevens zijn verwijderd.</p>';
    await loadQuestions();
    showError('Je gegevens zijn verwijderd.', 'progress');
  } catch (error) {
    showError('Verwijderen mislukt. Probeer het opnieuw.', 'progress');
  }
}

function bindDeleteDataActions() {
  const button = document.getElementById('delete-data-start');
  if (!button || button.dataset.bound === 'true') return;

  button.addEventListener('click', deleteMyData);
  button.dataset.bound = 'true';
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

function buildSummaryText(type, description, scores, metadata) {
  const scoreSummary = Object.entries(scores || {})
    .map(([dimension, value]) => `${dimension}: ${Number(value).toFixed(2)}`)
    .join(', ');

  const metaSummary = metadata
    ? `Testversie ${metadata.version} (${metadata.date}, ${metadata.question_count} vragen)`
    : 'Testmetadata onbekend';

  return [
    `Mijn testresultaat: ${type}`,
    description,
    `Scores: ${scoreSummary}`,
    metaSummary,
    'Deze uitkomst is indicatief en geen klinische diagnose.'
  ].join('\n');
}

async function copySummary(text) {
  if (globalThis.navigator?.clipboard?.writeText) {
    await globalThis.navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSimplePdf(summaryText) {
  const lines = summaryText
    .split('\n')
    .map((line) => line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));

  const textCommands = lines.map((line, index) => `1 0 0 1 50 ${780 - (index * 18)} Tm (${line}) Tj`).join('\n');
  const stream = `BT\n/F1 12 Tf\n${textCommands}\nET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((objectText) => {
    offsets.push(pdf.length);
    pdf += `${objectText}\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function showResult(data) {
  const res = document.getElementById('result');
  const type = typeof data.type === 'string' ? data.type : '----';
  const details = RESULT_CONTENT.types[type];
  const description = details?.shortDescription ?? 'Geen beschrijving beschikbaar voor dit type.';
  setMetadata(data.metadata);

  const metadata = testMetadata;
  const summaryText = buildSummaryText(type, description, data.scores, metadata);
  const metadataText = metadata
    ? `Afgerond op testversie ${metadata.version} (${metadata.date}) met ${metadata.question_count} vragen.`
    : 'Geen testmetadata beschikbaar voor dit resultaat.';

  res.innerHTML = `
    <h2>Resultaat</h2>
    <p>Persoonlijkheidstype: <strong>${type}</strong></p>
    <p>${description}</p>
    <p class="result-meta">${metadataText}</p>
    <div class="result-actions">
      <button type="button" class="copy-summary">Kopieer samenvatting</button>
      <button type="button" class="download-json">Download JSON</button>
      <button type="button" class="download-pdf">Download PDF</button>
      <button type="button" class="restart">Opnieuw doen</button>
      <button type="button" class="danger delete-data-result">Verwijder mijn gegevens</button>
    </div>
  `;

  res.querySelector('.restart')?.addEventListener('click', resetTest);
  res.querySelector('.delete-data-result')?.addEventListener('click', deleteMyData);

  res.querySelector('.copy-summary')?.addEventListener('click', async () => {
    try {
      await copySummary(summaryText);
      showError('Samenvatting gekopieerd naar klembord.', 'progress');
    } catch (error) {
      showError('Kopiëren van samenvatting mislukte.', 'progress');
    }
  });

  res.querySelector('.download-json')?.addEventListener('click', () => {
    const payload = {
      type,
      description,
      scores: data.scores,
      metadata,
      exported_at: new Date().toISOString(),
      note: 'Indicatieve uitslag, geen klinische diagnose.'
    };
    downloadBlob(`personality-result-${type}.json`, 'application/json', `${JSON.stringify(payload, null, 2)}\n`);
  });

  res.querySelector('.download-pdf')?.addEventListener('click', () => {
    const pdfContent = buildSimplePdf(summaryText);
    downloadBlob(`personality-result-${type}.pdf`, 'application/pdf', pdfContent);
  });

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

bootstrap();
