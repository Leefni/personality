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
  queuedAnswerValues: new Map(),
  pendingSavePromises: new Map(),
  saveSession: 0,
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
 * Tracks latest queued answer value for a question id.
 * @param {number} questionId - Question id being debounced.
 * @param {number} value - Most recent selected value.
 * @returns {void} Nothing.
 */
export function setQueuedAnswerValue(questionId, value) {
  state.queuedAnswerValues.set(questionId, value);
}

/**
 * Returns latest queued answer value for a question id.
 * @param {number} questionId - Question id lookup key.
 * @returns {number|undefined} Latest queued value, if any.
 */
export function getQueuedAnswerValue(questionId) {
  return state.queuedAnswerValues.get(questionId);
}

/**
 * Removes queued answer value for a question id.
 * @param {number} questionId - Question id to remove.
 * @returns {void} Nothing.
 */
export function clearQueuedAnswerValue(questionId) {
  state.queuedAnswerValues.delete(questionId);
}

/**
 * Stores an in-flight answer save promise for a question id.
 * @param {number} questionId - Question id currently saving.
 * @param {Promise<void>} promise - Promise tracking completion for this save.
 * @returns {void} Nothing.
 */
export function setPendingSavePromise(questionId, promise) {
  state.pendingSavePromises.set(questionId, promise);
}

/**
 * Removes in-flight save promise tracking for a question.
 * @param {number} questionId - Question id whose save completed.
 * @returns {void} Nothing.
 */
export function clearPendingSavePromise(questionId) {
  state.pendingSavePromises.delete(questionId);
}

/**
 * Returns all in-flight save promises.
 * @returns {Promise<void>[]} Array of promises that resolve when saves finish.
 */
export function getPendingSavePromises() {
  return Array.from(state.pendingSavePromises.values());
}

/**
 * Indicates whether debounced or in-flight saves currently exist.
 * @returns {boolean} True when actions should be gated.
 */
export function hasPendingSaves() {
  return state.saveTimers.size > 0 || state.pendingQuestionIds.size > 0;
}

/**
 * Clears all active debounce timers and queued answer values.
 * @returns {void} Nothing.
 */
export function clearSaveTimers() {
  state.saveTimers.forEach((timerId) => window.clearTimeout(timerId));
  state.saveTimers.clear();
  state.queuedAnswerValues.clear();
}

/**
 * Clears pending/in-flight save tracking sets/maps.
 * @returns {void} Nothing.
 */
export function clearPendingSavesTracking() {
  state.pendingQuestionIds.clear();
  state.pendingSavePromises.clear();
}

/**
 * Invalidates existing async save callbacks. Older callbacks should no-op when session changed.
 * @returns {number} New session token.
 */
export function bumpSaveSession() {
  state.saveSession += 1;
  return state.saveSession;
}

/**
 * Returns current save session token.
 * @returns {number} Current session id.
 */
export function getSaveSession() {
  return state.saveSession;
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
