const PAGE_SIZE = 10;
const APP_ENV = window.APP_ENV || 'production';
const IS_DEVELOPMENT = APP_ENV === 'development';
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
const ANSWERS_STORAGE_KEY = 'personality.answers.v1';
const RESULT_CONTENT = {
  dimensions: {
    EI: {
      poles: ['E', 'I'],
      names: ['Extraversie', 'Introversie']
    },
    SN: {
      poles: ['S', 'N'],
      names: ['Sensing', 'Intuïtie']
    },
    TF: {
      poles: ['T', 'F'],
      names: ['Thinking', 'Feeling']
    },
    JP: {
      poles: ['J', 'P'],
      names: ['Judging', 'Perceiving']
    }
  },
  types: {
    ESTJ: {
      shortDescription: 'Praktische organisator die structuur en verantwoordelijkheid omarmt.',
      strengths: ['Besluitvaardig', 'Betrouwbaar', 'Sterk in plannen'],
      attentionPoints: ['Kan star overkomen', 'Minder geduld met vaagheid'],
      tips: ['Plan bewust rustmomenten in', 'Vraag actief om alternatieve ideeën']
    },
    ESTP: {
      shortDescription: 'Energieke doener die kansen ziet en direct in actie komt.',
      strengths: ['Snel schakelen', 'Pragmatisch', 'Sociaal overtuigend'],
      attentionPoints: ['Neiging tot impulsiviteit', 'Minder focus op lange termijn'],
      tips: ['Check eerst risico’s', 'Werk met korte evaluatiemomenten']
    },
    ESFJ: {
      shortDescription: 'Betrokken verbinder die harmonie en samenwerking stimuleert.',
      strengths: ['Empathisch', 'Loyaal', 'Sterk in teamdynamiek'],
      attentionPoints: ['Kan te veel pleasen', 'Neemt kritiek persoonlijk op'],
      tips: ['Stel heldere grenzen', 'Plan reflectie in op eigen behoeften']
    },
    ESFP: {
      shortDescription: 'Enthousiaste sfeermaker die graag in het moment leeft.',
      strengths: ['Positieve energie', 'Flexibel', 'Praktisch creatief'],
      attentionPoints: ['Moeite met routine', 'Vermijdt soms moeilijke keuzes'],
      tips: ['Gebruik reminders voor structuur', 'Vertaal doelen naar korte acties']
    },
    ENTJ: {
      shortDescription: 'Strategische leider die richting geeft en resultaten nastreeft.',
      strengths: ['Visiegericht', 'Doelgericht', 'Sterk in organiseren'],
      attentionPoints: ['Kan dominant overkomen', 'Soms te weinig ruimte voor gevoel'],
      tips: ['Luister actief vóór besluiten', 'Beloon ook proces, niet alleen resultaat']
    },
    ENTP: {
      shortDescription: 'Inventieve uitdager die nieuwe ideeën en mogelijkheden verkent.',
      strengths: ['Innovatief', 'Scherp analyserend', 'Snel lerend'],
      attentionPoints: ['Verliest interesse in details', 'Start meer dan hij afrondt'],
      tips: ['Werk met concrete deadlines', 'Kies per project één focusdoel']
    },
    ENFJ: {
      shortDescription: 'Inspirerende motivator die mensen in beweging brengt.',
      strengths: ['Coachend', 'Communicatief sterk', 'Waarde-gedreven'],
      attentionPoints: ['Kan zichzelf wegcijferen', 'Neiging tot oververantwoordelijkheid'],
      tips: ['Delegeer bewust', 'Reserveer tijd voor eigen herstel']
    },
    ENFP: {
      shortDescription: 'Creatieve vernieuwer die kansen ziet in mensen en ideeën.',
      strengths: ['Enthousiast', 'Origineel', 'Empathisch verbindend'],
      attentionPoints: ['Snel afgeleid', 'Moeite met strakke systemen'],
      tips: ['Gebruik visuele planning', 'Rond eerst af, start daarna iets nieuws']
    },
    ISTJ: {
      shortDescription: 'Nauwkeurige bouwer die stabiliteit en kwaliteit bewaakt.',
      strengths: ['Consistent', 'Verantwoordelijk', 'Detailgericht'],
      attentionPoints: ['Kan behoudend zijn', 'Moeite met plotselinge verandering'],
      tips: ['Plan ruimte voor experiment', 'Benoem expliciet je flexibiliteit']
    },
    ISTP: {
      shortDescription: 'Rustige probleemoplosser die techniek en logica combineert.',
      strengths: ['Analytisch', 'Praktisch', 'Kalm onder druk'],
      attentionPoints: ['Houdt afstand in communicatie', 'Stelt beslissingen soms uit'],
      tips: ['Maak verwachtingen expliciet', 'Deel tussentijds je voortgang']
    },
    ISFJ: {
      shortDescription: 'Zorgzame ondersteuner die aandacht heeft voor detail en mensen.',
      strengths: ['Betrouwbaar', 'Geduldig', 'Dienstbaar'],
      attentionPoints: ['Vermijdt conflict', 'Neemt te veel op zich'],
      tips: ['Zeg vaker tijdig nee', 'Plan vaste momenten voor feedback']
    },
    ISFP: {
      shortDescription: 'Gevoelige maker die authenticiteit en vrijheid belangrijk vindt.',
      strengths: ['Empathisch', 'Creatief', 'Flexibel'],
      attentionPoints: ['Mijdt strakke planning', 'Houdt zorgen voor zich'],
      tips: ['Werk met zachte deadlines', 'Spreek behoeften eerder uit']
    },
    INTJ: {
      shortDescription: 'Conceptuele strateeg die lange-termijnplannen scherp uitwerkt.',
      strengths: ['Onafhankelijk', 'Visionair', 'Sterk analyserend'],
      attentionPoints: ['Kan afstandelijk lijken', 'Onvoldoende geduld met inefficiëntie'],
      tips: ['Vertaal visie naar begrijpelijke stappen', 'Check regelmatig teamgevoel']
    },
    INTP: {
      shortDescription: 'Nieuwsgierige denker die patronen en systemen diep wil begrijpen.',
      strengths: ['Logisch', 'Origineel', 'Objectief'],
      attentionPoints: ['Overanalyse', 'Minder aandacht voor praktische opvolging'],
      tips: ['Koppel ideeën aan concrete acties', 'Plan beslismomenten in']
    },
    INFJ: {
      shortDescription: 'Inzichtvolle idealist die betekenis en richting zoekt.',
      strengths: ['Intuïtief', 'Waarde-gedreven', 'Diep empathisch'],
      attentionPoints: ['Perfectionistisch', 'Snel mentaal overbelast'],
      tips: ['Bewaak energiegrenzen', 'Maak grote doelen meetbaar']
    },
    INFP: {
      shortDescription: 'Reflectieve idealist die authenticiteit en persoonlijke groei nastreeft.',
      strengths: ['Creatief', 'Compassievol', 'Loyaal aan waarden'],
      attentionPoints: ['Stelt conflict uit', 'Kan moeite hebben met prioriteren'],
      tips: ['Kies dagelijks één hoofdtaak', 'Gebruik assertieve ik-boodschappen']
    }
  }
};

function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(ANSWERS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const normalized = {};
    Object.entries(parsed).forEach(([questionId, value]) => {
      const id = Number(questionId);
      const numericValue = Number(value);
      if (Number.isInteger(id) && Number.isFinite(numericValue)) {
        normalized[id] = numericValue;
      }
    });

    return normalized;
  } catch (error) {
    return {};
  }
}

function saveLocalDraft(draft) {
  localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(draft));
}

function clearLocalDraft() {
  localStorage.removeItem(ANSWERS_STORAGE_KEY);
}
const pendingQuestionIds = new Set();
const isDevelopmentEnvironment = window.APP_ENV === 'development';

function buildDebugHint(endpoint, status) {
  const statusLabel = Number.isFinite(status) ? status : 'onbekend';
  return `Technische hint: ${endpoint} (status: ${statusLabel})`;
}

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

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const fallbackText = await response.text();
    let payload = null;
    try {
      payload = fallbackText ? JSON.parse(fallbackText) : null;
    } catch (error) {
      try {
        payload = await response.clone().text();
      } catch (fallbackError) {
        payload = null;
      }
    }

    const requestError = new Error('Request failed: ' + url);
    requestError.status = response.status;
    requestError.payload = payload;
    requestError.text = fallbackText || null;
    requestError.url = url;
    throw requestError;
  }
  return response.json();
}

function formatApiError(error, fallbackMessage) {
  const statusMessages = {
    400: 'Je verzoek is ongeldig. Controleer je invoer en probeer opnieuw.',
    422: 'Niet alle gegevens zijn compleet of geldig. Vul ontbrekende velden in en probeer opnieuw.',
    500: 'Er ging iets mis op de server. Probeer het later opnieuw.'
  };

  const message = statusMessages[error?.status] || fallbackMessage;

  if (IS_DEVELOPMENT) {
    console.error('API error:', {
      message,
      status: error?.status,
      payload: error?.payload,
      text: error?.text,
      url: error?.url
    });
  }

  return message;
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
    if (isDevelopmentEnvironment) {
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

async function answer(questionId, value, input) {
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
