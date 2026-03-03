import { apiFetch, buildDebugHint, formatApiError, IS_DEVELOPMENT } from './api-client.js';
import { RESULT_CONTENT } from './result-content.js';
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from './storage.js';

const PAGE_SIZE = 10;
const likertLabels = [
  'Helemaal oneens',
  'Oneens',
  'Neutraal',
  'Eens',
  'Helemaal eens'
];

let questions = [];
let answers = {};
let page = 0;
let hasQuestionChangeListener = false;
const pendingQuestionIds = new Set();

// Question rendering only depends on `id` and `text`.

function showError(message, targetId = 'progress') {
  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  const notice = document.createElement('div');
  notice.className = 'error-notice';
  notice.textContent = message;

  const container = target.parentElement || target;
  container.insertBefore(notice, target.nextSibling);

  window.setTimeout(() => {
    notice.remove();
  }, 4000);
}

async function loadData() {
  const dataEndpoint = 'api/get_questions.php';
  try {
    if (!hasQuestionChangeListener) {
      const questionsElement = document.getElementById('questions');
      questionsElement?.addEventListener('change', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }

        if (!target.matches('input[type="radio"][data-qid]')) {
          return;
        }

        const qid = Number(target.dataset.qid);
        const value = Number(target.dataset.value);

        if (!Number.isInteger(qid) || !Number.isFinite(value)) {
          return;
        }

        await answer(qid, value, target);
      });

      hasQuestionChangeListener = true;
    }

    questions = await apiFetch(dataEndpoint);
    const saved = await apiFetch('api/get_progress.php');
    const localDraft = loadLocalDraft();
    const serverAnswers = {};

    saved.forEach((item) => {
      serverAnswers[item.question_id] = Number(item.value);
    });

    answers = { ...serverAnswers, ...localDraft };

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

    render();
  } catch (error) {
    console.error('loadData mislukte.', error.status, error.payload);

    const baseMessage = 'Fout bij laden. Controleer database en API-configuratie.';
    if (IS_DEVELOPMENT) {
      showError(`${baseMessage} ${buildDebugHint(dataEndpoint, error.status)}`, 'progress');
      return;
    }

    showError(baseMessage, 'progress');
  }
}

function render() {
  const qDiv = document.getElementById('questions');
  qDiv.innerHTML = '';

  const start = page * PAGE_SIZE;
  const slice = questions.slice(start, start + PAGE_SIZE);

  slice.forEach((q, index) => {
    const div = document.createElement('article');
    div.className = 'question';
    const isPending = pendingQuestionIds.has(q.id);

    div.innerHTML = `
      <p><strong>${start + index + 1}.</strong> ${q.text}</p>
      <fieldset class="likert" ${isPending ? 'disabled' : ''}>
        <legend class="sr-only">Kies een antwoordoptie voor vraag ${start + index + 1}</legend>
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

  if (page > 0) {
    const prev = document.createElement('button');
    prev.className = 'prev';
    prev.textContent = 'Vorige';
    prev.addEventListener('click', () => {
      page -= 1;
      render();
    });
    nav.appendChild(prev);
  }

  if ((page + 1) * PAGE_SIZE < questions.length) {
    const next = document.createElement('button');
    next.className = 'next';
    next.textContent = 'Volgende';
    next.addEventListener('click', () => {
      page += 1;
      render();
    });
    nav.appendChild(next);
  } else {
    const submit = document.createElement('button');
    submit.className = 'submit';
    submit.textContent = 'Bekijk resultaat';
    const answeredCount = Object.keys(answers).length;
    const isComplete = answeredCount === questions.length;
    submit.disabled = !isComplete;
    submit.title = isComplete
      ? ''
      : 'Beantwoord eerst alle vragen voordat je het resultaat bekijkt.';
    submit.addEventListener('click', submitTest);
    nav.appendChild(submit);
  }
}

function updateProgress() {
  const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  document.getElementById('progress').textContent =
    `Pagina ${page + 1} / ${totalPages} — ${Object.keys(answers).length} van ${questions.length} vragen ingevuld`;
}

async function answer(questionId, value) {
  if (pendingQuestionIds.has(questionId)) {
    return;
  }

  const answerChanged = answers[questionId] !== value;
  const pendingChanged = !pendingQuestionIds.has(questionId);

  answers[questionId] = value;
  pendingQuestionIds.add(questionId);

  if (answerChanged || pendingChanged) {
    render();
  }

  try {
    await apiFetch('api/save_answer.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, value: value })
    });

    saveLocalDraft(answers);
  } catch (error) {
    saveLocalDraft(answers);
    render();
    const message = formatApiError(error, 'Opslaan mislukt. Probeer het opnieuw.');
    showError(message, 'progress');
  } finally {
    const pendingWasRemoved = pendingQuestionIds.delete(questionId);

    if (pendingWasRemoved) {
      render();
    }
  }
}

async function submitTest() {
  try {
    const data = await apiFetch('api/submit_results.php');
    clearLocalDraft();
    showResult(data);
  } catch (error) {
    const progress = document.getElementById('progress');
    const result = document.getElementById('result');
    const message = formatApiError(error, 'Resultaat ophalen mislukt. Probeer het opnieuw.');

    if (error.status === 422 && error.payload?.error === 'Incomplete test') {
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

function buildList(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function getDimensionInterpretation(score, config) {
  const numericScore = Number(score);
  const [leftPole, rightPole] = config.poles;
  const [leftName, rightName] = config.names;

  if (Math.abs(numericScore) < 1) {
    return `Vrij gebalanceerd tussen ${leftName} (${leftPole}) en ${rightName} (${rightPole}).`;
  }

  const dominantPole = numericScore >= 0 ? leftPole : rightPole;
  const dominantName = numericScore >= 0 ? leftName : rightName;
  const intensity = Math.abs(numericScore) >= 4 ? 'sterke' : 'lichte';

  return `${intensity.charAt(0).toUpperCase() + intensity.slice(1)} voorkeur voor ${dominantName} (${dominantPole}).`;
}

async function resetTest() {
  try {
    await apiFetch('api/reset_progress.php', { method: 'POST' });
    answers = {};
    page = 0;
    clearLocalDraft();
    document.getElementById('result').innerHTML = '';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showError('Resetten mislukt. Probeer het opnieuw.', 'progress');
  }
}

function showResult(data) {
  const profile = RESULT_CONTENT.types[data.type];

  const res = document.getElementById('result');
  res.innerHTML = `<h2>Resultaat: ${data.type}</h2>`;

  if (profile) {
    res.innerHTML += `
      <p>${profile.shortDescription}</p>
      <h3>Sterke punten</h3>
      ${buildList(profile.strengths)}
      <h3>Aandachtspunten</h3>
      ${buildList(profile.attentionPoints)}
      <h3>Praktische tips</h3>
      ${buildList(profile.tips)}
    `;
  }

  res.innerHTML += '<h3>Dimensiescores</h3>';

  Object.keys(data.scores).forEach((dimension) => {
    const config = RESULT_CONTENT.dimensions[dimension];
    if (!config) {
      return;
    }

    const score = Number(data.scores[dimension]);
    const percent = Math.max(0, Math.min(100, 50 + score * 10));
    const interpretation = getDimensionInterpretation(score, config);

    res.innerHTML += `
      <div class="bar">
        <div class="bar-label">${config.poles[0]} — ${config.poles[1]} (score: ${score.toFixed(1)})</div>
        <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
        <p>${interpretation}</p>
      </div>
    `;
  });

  res.innerHTML += '<button type="button" class="restart">Opnieuw doen</button>';
  res.querySelector('.restart')?.addEventListener('click', resetTest);

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

loadData();
