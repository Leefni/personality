<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>Personality Test</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
  body {
    font-family: system-ui, sans-serif;
    background: #f4f6f8;
    margin: 0;
  }
  .container {
    max-width: 800px;
    margin: auto;
    padding: 24px;
    background: #fff;
    min-height: 100vh;
  }
  h1 { text-align: center; }

  .progress {
    text-align: center;
    color: #555;
    margin-bottom: 16px;
  }

  .question {
    margin-bottom: 28px;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 16px;
  }

  .likert {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-top: 10px;
  }

  .likert button {
    padding: 10px 4px;
    border-radius: 6px;
    border: 1px solid #ccc;
    background: #fafafa;
    cursor: pointer;
    font-size: 13px;
  }

  .likert button.selected {
    background: #007bff;
    color: #fff;
    border-color: #007bff;
    font-weight: bold;
  }

  .likert-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: #666;
    margin-top: 4px;
  }

  .nav {
    display: flex;
    justify-content: space-between;
    margin-top: 24px;
  }

  .nav button {
    padding: 10px 18px;
    font-size: 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
  }

  .nav .prev { background: #6c757d; color: #fff; }
  .nav .next { background: #007bff; color: #fff; }
  .nav .submit { background: #28a745; color: #fff; width: 100%; }

  .result {
    margin-top: 32px;
  }

  .bar {
    margin: 12px 0;
  }

  .bar-label {
    font-size: 14px;
    margin-bottom: 4px;
  }

  .bar-track {
    background: #e9ecef;
    border-radius: 8px;
    height: 18px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #007bff, #00c6ff);
    width: 50%;
    transition: width 0.5s;
  }
</style>
</head>

<body>
<div class="container">
  <h1>Personality Test</h1>
  <div class="progress" id="progress"></div>

  <div id="questions"></div>

  <div class="nav" id="nav"></div>

  <div class="result" id="result"></div>
</div>

<script>
const PAGE_SIZE = 10;
const likertLabels = [
  "Helemaal oneens",
  "Oneens",
  "Neutraal",
  "Eens",
  "Helemaal eens"
];

let questions = [];
let answers = {};
let page = 0;

function getVisitorId() {
  const m = document.cookie.match(/visitor_id=([^;]+)/);
  if (m) return m[1];
  const id = crypto.randomUUID();
  document.cookie = `visitor_id=${id}; path=/; max-age=${60*60*24*365}`;
  return id;
}

async function loadData() {
  getVisitorId();

  questions = await fetch('api/get_questions.php').then(r => r.json());
  const saved = await fetch('api/get_progress.php').then(r => r.json());
  saved.forEach(a => answers[a.question_id] = a.value);

  render();
}

function render() {
  const qDiv = document.getElementById('questions');
  qDiv.innerHTML = '';

  const start = page * PAGE_SIZE;
  const slice = questions.slice(start, start + PAGE_SIZE);

  slice.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'question';
    div.innerHTML = `
      <p><strong>${start + i + 1}.</strong> ${q.text}</p>
      <div class="likert">
        ${[1,2,3,4,5].map(v => `
          <button class="${answers[q.id] === v ? 'selected' : ''}"
                  onclick="answer(${q.id}, ${v})">
            ${v}
          </button>
        `).join('')}
      </div>
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
    nav.innerHTML += `<button class="prev" onclick="page--; render()">Vorige</button>`;
  }

  if ((page + 1) * PAGE_SIZE < questions.length) {
    nav.innerHTML += `<button class="next" onclick="page++; render()">Volgende</button>`;
  } else {
    nav.innerHTML += `<button class="submit" onclick="submitTest()">Bekijk resultaat</button>`;
  }
}

function updateProgress() {
  document.getElementById('progress').textContent =
    `Pagina ${page + 1} / ${Math.ceil(questions.length / PAGE_SIZE)} — ` +
    `${Object.keys(answers).length} van ${questions.length} vragen ingevuld`;
}

function answer(q, v) {
  answers[q] = v;
  fetch('api/save_answer.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({question_id: q, value: v})
  });
  render();
}

async function submitTest() {
  const r = await fetch('api/submit_results.php').then(r => r.json());
  showResult(r);
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

  for (const dim in data.scores) {
    const score = data.scores[dim];
    const percent = Math.max(0, Math.min(100, 50 + score * 10));

    res.innerHTML += `
      <div class="bar">
        <div class="bar-label">
          ${map[dim][0]} — ${map[dim][1]}
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `;
  }

  window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'});
}

loadData();
</script>
</body>
</html>