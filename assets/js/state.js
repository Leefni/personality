import { PAGE_SIZE } from './utils.js';

const state = {
  questions: [],
  answers: {},
  page: 1,
  perPage: PAGE_SIZE,
  totalQuestions: 0,
  hasQuestionChangeListener: false,
  pendingQuestionIds: new Set(),
  saveTimers: new Map(),
  renderCount: 0
};

/**
 * Returns all shared app state used by the quiz screens.
 * @returns {{questions: Array, answers: Object, page: number, perPage: number, totalQuestions: number, hasQuestionChangeListener: boolean, pendingQuestionIds: Set<number>, saveTimers: Map<number, number>, renderCount: number}} Current in-memory state object.
 */
export function getState() {
  return state;
}

/**
 * Replaces the loaded question list.
 * @param {Array} questions - The questions for the current page.
 * @returns {void} Nothing.
 */
export function setQuestions(questions) {
  state.questions = questions;
}

/**
 * Replaces all saved answers in memory.
 * @param {Record<string | number, number>} answers - Answer values keyed by question id.
 * @returns {void} Nothing.
 */
export function setAnswers(answers) {
  state.answers = answers;
}

/**
 * Stores one answer value for a question.
 * @param {number} questionId - The question id to update.
 * @param {number} value - The selected Likert value.
 * @returns {void} Nothing.
 */
export function setAnswer(questionId, value) {
  state.answers[questionId] = value;
}

/**
 * Resets answers back to an empty object.
 * @returns {void} Nothing.
 */
export function clearAnswers() {
  state.answers = {};
}

/**
 * Updates current pagination and total values.
 * @param {{page?: number, perPage?: number, totalQuestions?: number}} updates - Pagination values to overwrite.
 * @returns {void} Nothing.
 */
export function setPagination(updates) {
  if (Number.isFinite(updates.page)) state.page = Number(updates.page);
  if (Number.isFinite(updates.perPage)) state.perPage = Number(updates.perPage);
  if (Number.isFinite(updates.totalQuestions)) state.totalQuestions = Number(updates.totalQuestions);
}

/**
 * Marks whether the delegated question change listener is already attached.
 * @param {boolean} attached - True if the listener has been registered.
 * @returns {void} Nothing.
 */
export function setQuestionChangeListenerAttached(attached) {
  state.hasQuestionChangeListener = Boolean(attached);
}

/**
 * Increments the full render counter used in development diagnostics.
 * @returns {number} The updated render count.
 */
export function incrementRenderCount() {
  state.renderCount += 1;
  return state.renderCount;
}
