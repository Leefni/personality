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

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    const requestError = new Error('Request failed: ' + url);
    requestError.status = response.status;
    requestError.payload = payload;
    throw requestError;
  }
  return response.json();
}

async function loadData() {
  try {
    questions = await apiFetch('api/get_questions.php');
    const saved = await apiFetch('api/get_progress.php');

    saved.forEach((item) => {
      answers[item.question_id] = Number(item.value);
    });

    render();
  } catch (error) {
    document.getElementById('progress').textContent =
      'Fout bij laden. Controleer database en API-configuratie.';
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

    div.innerHTML = `
      <p><strong>${start + index + 1}.</strong> ${q.text}</p>
      <div class="likert">
        ${[1, 2, 3, 4, 5].map((value) => `
          <button data-qid="${q.id}" data-value="${value}" class="${answers[q.id] === value ? 'selected' : ''}">${value}</button>
        `).join('')}
      </div>
      <div class="likert-labels">
        <span>${likertLabels[0]}</span>
        <span>${likertLabels[4]}</span>
      </div>
    `;

    qDiv.appendChild(div);
  });

  qDiv.querySelectorAll('button[data-qid]').forEach((button) => {
    button.addEventListener('click', async () => {
      const qid = Number(button.dataset.qid);
      const value = Number(button.dataset.value);
      await answer(qid, value);
    });
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
  answers[questionId] = value;

  await apiFetch('api/save_answer.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, value: value })
  });

  render();
}

async function submitTest() {
  try {
    const data = await apiFetch('api/submit_results.php');
    showResult(data);
  } catch (error) {
    const progress = document.getElementById('progress');
    const result = document.getElementById('result');

    if (error.status === 422 && error.payload?.error === 'Incomplete test') {
      const answered = Number(error.payload.answered);
      const total = Number(error.payload.total);
      const message = `Test is nog niet compleet: ${answered} van ${total} vragen beantwoord.`;

      progress.textContent = message;
      result.innerHTML = `<p class="error">${message}</p>`;
      return;
    }

    result.innerHTML = '<p class="error">Resultaat ophalen mislukt. Probeer het opnieuw.</p>';
  }
}

function showResult(data) {
  const map = {
    EI: ['E', 'I'],
    SN: ['S', 'N'],
    TF: ['T', 'F'],
    JP: ['J', 'P']
  };

  const res = document.getElementById('result');
  res.innerHTML = `<h2>Resultaat: ${data.type}</h2>`;

  Object.keys(data.scores).forEach((dimension) => {
    const score = Number(data.scores[dimension]);
    const percent = Math.max(0, Math.min(100, 50 + score * 10));

    res.innerHTML += `
      <div class="bar">
        <div class="bar-label">${map[dimension][0]} — ${map[dimension][1]}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
      </div>
    `;
  });

  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

loadData();
