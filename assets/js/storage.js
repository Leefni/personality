const ANSWERS_STORAGE_KEY = 'personality.answers.v1';

export function loadLocalDraft() {
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

export function saveLocalDraft(draft) {
  localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(draft));
}

export function clearLocalDraft() {
  localStorage.removeItem(ANSWERS_STORAGE_KEY);
}
