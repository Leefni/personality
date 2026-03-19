import { apiFetch } from './utils.js';

/**
 * Loads test metadata such as version and release date.
 * @returns {Promise<{version: string, date: string, question_count: number}>} Metadata payload from the API.
 */
export function fetchTestMetadata() {
  return apiFetch('api/v1/test_metadata.php');
}

/**
 * Loads saved progress from the backend.
 * @returns {Promise<Array>} Saved answer rows from the API.
 */
export function fetchProgress() {
  return apiFetch('api/v1/get_progress.php');
}

/**
 * Loads one page of questions and validates the response shape.
 * @param {number} page - The 1-based page number to request.
 * @param {number} perPage - Number of questions to request on that page.
 * @returns {Promise<{questions: Array, total: number, page: number, per_page: number}>} Validated questions payload.
 */
export async function fetchQuestions(page, perPage) {
  const dataEndpoint = `api/v1/get_questions.php?page=${page}&per_page=${perPage}`;
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

  return questionPayload;
}

/**
 * Saves one selected answer for a question.
 * @param {number} questionId - Question id being answered.
 * @param {number} value - Selected answer value.
 * @returns {Promise<any>} API payload returned by the save endpoint.
 */
export function saveAnswer(questionId, value) {
  return apiFetch('api/v1/save_answer.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId, value })
  });
}

/**
 * Submits the quiz and asks the backend to calculate a result.
 * @returns {Promise<any>} Result payload containing personality type data.
 */
export function submitResults() {
  return apiFetch('api/v1/submit_results.php', { method: 'POST' });
}

/**
 * Deletes all persisted quiz data for the current visitor.
 * @returns {Promise<{ok: boolean}>} API payload confirming data deletion.
 */
export function deleteData() {
  return apiFetch('api/v1/delete_data.php', { method: 'POST' });
}

/**
 * Clears server-side progress so the quiz can be started again.
 * @returns {Promise<any>} API payload from reset endpoint.
 */
export function resetProgress() {
  return apiFetch('api/v1/reset_progress.php', { method: 'POST' });
}
