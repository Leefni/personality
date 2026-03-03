# Personality Test (USBWebserver v8.6.6)

A lightweight PHP + MySQL personality test app with paginated questions, autosave, and a computed 4-letter result.

## Quick Start (First Time Setup)

Use this path if you want the shortest route from zero to a running app.

### 2-minute route

- **If you use USBWebserver default local credentials** (`root` with empty password): just follow steps 1-4 as-is.
- **If you use a custom DB password**: before step 4, create `config.local.php` in the project root (example in the Setup section below) and set your real `db_pass` (plus any other custom DB values).

### Minimal path from zero to running app

1. **Start USBWebserver services (Apache + MySQL).**
   - **Expected success signal:** both services show as running/green in USBWebserver.
   - **If this step fails:** likely cause is a busy port (commonly 80 or 3306) or insufficient permissions to start the services.

2. **Place this project folder inside your USBWebserver web root (`root`).**
   - **Expected success signal:** the folder is visible at something like `.../USBWebserver/root/personality`.
   - **If this step fails:** likely cause is copying into the wrong directory (for example, next to `root` instead of inside it).

3. **Open the app URL:** `http://localhost/personality/`.
   - **Expected success signal:** the personality test page loads (not a 404/500 page).
   - **If this step fails:** likely cause is Apache not running, wrong folder name/path, or project not in web root.

4. **Open health check URL:** `http://localhost/personality/api/health.php` and verify JSON contains `"status": "ok"`.
   - **Expected success signal:** JSON response shows `status` as `ok` and DB/PDO checks are true.
   - **If this step fails:** likely cause is incorrect DB credentials (especially custom `root` password), missing MySQL service, or PHP PDO MySQL extension not active.

### You are ready

When step 4 returns `status: ok`, open the app again and answer the first question. Your first click should persist immediately (autosave), so refreshing the page should keep that answer selected.

## Requirements

- USBWebserver v8.6.6 (Apache + PHP + MySQL)
- PHP PDO MySQL extension enabled (default in USBWebserver)

## Setup

### USBWebserver local defaults

`config.php` reads database settings from environment variables and then optionally merges `config.local.php` (if present) for easy machine-local overrides. It still keeps USBWebserver-friendly defaults:

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=personality`
- `DB_USER=root`
- `DB_PASS=` (empty)

Steps:

1. Copy this project folder to your USBWebserver `root` directory.
2. Start **Apache** and **MySQL** from USBWebserver.
3. Browse to: `http://localhost/personality/`


If your MySQL `root` account has a password, create `config.local.php` in the project root and set the exact values you use locally:

```php
<?php
return [
    'db_host' => '127.0.0.1', // DB_HOST
    'db_port' => 3306,        // DB_PORT
    'db_name' => 'personality', // DB_NAME
    'db_user' => 'root',      // DB_USER
    'db_pass' => 'your_root_password', // DB_PASS
    'app_env' => 'development',
];
```

You can make equivalent changes with environment variables instead:

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME=personality
export DB_USER=root
export DB_PASS='your_root_password'
export APP_ENV=development
```

On first startup, the app now auto-bootstraps the selected database when `DB_AUTO_BOOTSTRAP=true` (default):

- Uses the active PDO connection database (`DB_NAME`) as the single source of truth.
- Verifies required tables (`questions`, `answers`, `results`) in that selected database.
- Runs `init.sql` if any required table is missing.
- Seeds `questions.sql` only when the `questions` table is empty.

`init.sql` and `questions.sql` are database-agnostic (no hardcoded `USE ...` or `CREATE DATABASE ...`). This means `DB_NAME` fully determines where schema and seed data are applied.

You can still import SQL manually via phpMyAdmin if preferred.

### Environment-based deployment (server, container, CI)

Set the following environment variables in your runtime before serving the app:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME` (fully leading: selects the exact database used by the app/bootstrap)
- `DB_USER`
- `DB_PASS`
- `DB_AUTO_BOOTSTRAP` (optional, default `true`; set to `false` to disable automatic schema/seed bootstrap in production)
- `APP_ENV` (optional, set to `development`/`local` to show short actionable DB auth errors during local setup)

Example:

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME=personality
export DB_USER=app_user
export DB_PASS='change_me'
```

Then run your web server/PHP runtime as usual.

## Project Structure

- `index.php` - Main page
- `assets/style.css` - Styling
- `assets/app.js` - Front-end app logic
- `api/*.php` - JSON API endpoints
- `db.php` - Database bootstrap (PDO)
- `init.sql` / `questions.sql` - Database schema and seed data

## Maintainer reference

### Runtime flow (page load to result)

#### 1) `index.php` boot

1. Browser requests `index.php` and receives the base HTML shell (`#questions`, `#nav`, `#progress`, `#result`) plus linked assets.
2. `assets/app.js` executes immediately and calls `loadData()` at file end.

#### 2) `loadData()` sequence

1. Registers a one-time delegated `change` listener on `#questions` (guarded by `hasQuestionChangeListener`).
2. Fetches `api/get_questions.php` and stores full question list in `questions`.
3. Fetches `api/get_progress.php` and maps saved rows into `serverAnswers` (`question_id -> value`).
4. Loads browser draft from `localStorage` key `personality.answers.v1`.
5. Merges state as `answers = { ...serverAnswers, ...localDraft }` (local draft wins on conflicts).
6. Keeps only unresolved draft entries in localStorage, then calls `render()`.

#### 3) Autosave event path

1. User changes a radio input (`input[type="radio"][data-qid]`) inside `#questions`.
2. Listener parses `question_id` and `value`, then calls `answer(questionId, value, target)`.
3. `answer()` optimistically updates in-memory `answers`, marks question pending, and re-renders.
4. `answer()` POSTs JSON to `api/save_answer.php` (`{ question_id, value }`).
5. Backend validates method/payload/question existence, creates `visitor_id` cookie when missing, then upserts row into `answers`.
6. Frontend persists local draft and clears pending state; on failure it shows an error notice and keeps draft.

#### 4) Submit/scoring path

1. On last page, "Bekijk resultaat" enables only when answered count equals total questions.
2. `submitTest()` calls `api/submit_results.php`.
3. Backend requires `visitor_id`, checks completion (`COUNT(DISTINCT question_id)` vs total questions), and returns `422` if incomplete.
4. For complete tests, backend computes dimension sums from joined `answers` + `questions`, builds 4-letter type, upserts into `results`, and returns `{ type, scores }`.
5. Frontend clears local draft and renders type description + dimension bars via `showResult()`.

#### 5) Reset path

1. User clicks "Opnieuw doen" in result view.
2. `resetTest()` POSTs to `api/reset_progress.php`.
3. Backend deletes visitor rows in `answers` and `results` (no-op success when cookie absent).
4. Frontend clears in-memory answers, resets pagination (`page = 0`), clears local draft + result panel, then re-renders.

### API contract reference

| Endpoint | Method | Request payload | Success response | Key error responses / statuses |
| --- | --- | --- | --- | --- |
| `api/get_questions.php` | `GET` | none | `200` JSON array of `{ id, text }` ordered by `id` | no explicit app-level error mapping (DB/bootstrap failures bubble as server errors) |
| `api/get_progress.php` | `GET` | none (uses `visitor_id` cookie) | `200` JSON array of `{ question_id, value }`; returns `[]` when no cookie | no explicit app-level error mapping (DB/bootstrap failures bubble as server errors) |
| `api/save_answer.php` | `POST` | JSON `{ "question_id": <int>, "value": <1-5> }` | `200` `{ "ok": true }` (also sets `visitor_id` cookie if missing) | `405` method not allowed; `422` invalid payload; `422` unknown `question_id` |
| `api/submit_results.php` | `GET` | none (uses `visitor_id` cookie and persisted answers) | `200` `{ "type": "<4 letters>", "scores": { "EI": n, "SN": n, "TF": n, "JP": n } }` | `400` no visitor session; `422` incomplete test with `{ error, answered, total }` |
| `api/reset_progress.php` | `POST` | none (uses `visitor_id` cookie) | `200` `{ "ok": true }` after deleting visitor answers/results (or immediate ok when no cookie) | `405` method not allowed |

### Scoring algorithm

- Per answered question, score contribution is exactly: `(value - 3) * direction * weight`.
- `value` is the Likert answer in range `1..5`, where `3` is neutral.
- `direction` and `weight` come from the `questions` table and allow reverse-keying and weighted items.
- Per-dimension totals are summed for `EI`, `SN`, `TF`, `JP`.
- Type-letter mapping rules from final sums:
  - `EI`: `>= 0 => E`, `< 0 => I`
  - `SN`: `>= 0 => S`, `< 0 => N`
  - `TF`: `>= 0 => T`, `< 0 => F`
  - `JP`: `>= 0 => J`, `< 0 => P`

### Data model summary

- `questions` core columns:
  - `id` (PK), `text`, `dimension` (`EI|SN|TF|JP`), `direction`, `weight`.
- `answers` core columns:
  - `id` (PK), `question_id` (FK -> `questions.id`), `visitor_id`, `value`, `created_at`, `updated_at`.
  - Unique key `(question_id, visitor_id)` guarantees one active answer per visitor per question.
- `results` core columns:
  - `id` (PK), `visitor_id`, `type_code`, `detail_json`, `created_at`, `updated_at`.
  - Unique key on `visitor_id` guarantees one current persisted result per visitor.
- `visitor_id` relationship model:
  - Browser cookie `visitor_id` is generated in `save_answer` if absent.
  - The same `visitor_id` links all rows in `answers` and `results` for that browser session, enabling restore (`get_progress`), scoring (`submit_results`), and cleanup (`reset_progress`).

## Beginner Customization Guide

Use this section to choose changes that match your comfort level.

### 1. Safe first edits

- **Visual tweaks in `assets/style.css`**
  - Good for changing colors, spacing, fonts, and button styles.
  - Low risk because these edits do not change app logic or database behavior.
- **Simple text/content updates in `index.php`**
  - Good for headings, labels, helper text, and static copy updates.
  - Keep form field names/IDs untouched unless you also update matching JavaScript.

### 2. Intermediate edits

- **Frontend behavior in `assets/app.js`**
  - Good for UI flow, validation messaging, and interaction behavior.
  - ⚠️ **Warning:** keep existing API endpoint request/response contracts intact (`api/*.php`). If payload fields or response shapes change on the frontend, backend endpoints must be updated in sync.

### 3. Advanced/risky edits

- **`api/*.php`, `db.php`, `init.sql`, `questions.sql`**
  - These files control persistence, endpoint behavior, and schema/data setup.
  - Mistakes here can break saving answers, result calculation, bootstrap, or data integrity.
  - Make these changes only after backing up files and testing end-to-end.

### Before editing checklist

1. Backup the file(s) you plan to change.
2. Validate health endpoint: `http://localhost/personality/api/health.php`.
3. Confirm the app still:
   - Loads at `http://localhost/personality/`.
   - Saves at least one answer successfully.

### Example beginner task (concrete)

- **Goal:** Change the page title text and primary button color.
- **Files to edit:**
  - `index.php` - update the visible page heading/title text.
  - `assets/style.css` - update the button color rules (for example, `background-color` on the main action button class).
- **Verify:** Reload the page, confirm new title appears, click an answer, and ensure it still saves.
### How the app works (beginner overview)

#### Lifecycle walkthrough

1. The browser loads `index.php`, which renders the personality test shell (HTML/CSS/JS).
2. The frontend script in `assets/app.js` starts the app and fetches questions from `api/get_questions.php`.
3. Each answer click immediately sends the choice to `api/save_answer.php` so progress is autosaved.
4. The frontend reads current completion state from `api/get_progress.php` to restore or update progress.
5. When the test is finished, final submission is sent to `api/submit_results.php` to compute and persist the result.

#### API endpoints at a glance

| Endpoint | Purpose | Input (high-level) | Output (high-level) |
| --- | --- | --- | --- |
| `api/get_questions.php` | Load the question set for the UI. | Usually no body; identifies visitor via cookie context. | Question list (IDs, text, answer options). |
| `api/save_answer.php` | Save one answer as soon as the user clicks. | `question_id`, selected `choice`, and visitor context. | Success status and updated progress/acknowledgement. |
| `api/get_progress.php` | Return what the current visitor has already answered. | Visitor context (from cookie). | Answered count, remaining/next question state, or saved answers snapshot. |
| `api/submit_results.php` | Finalize test, compute type, and persist result. | Visitor context plus completion trigger/final answers. | Final personality result (for example 4-letter type) and save confirmation. |

#### `visitor_id` cookie (what it is and why it exists)

The app stores a `visitor_id` cookie in the browser so the backend can associate API requests with one anonymous visitor session. This allows answers and progress to persist across page reloads and lets the app resume where the same browser left off without requiring user accounts.

#### Where to start reading the code

If you are new to this codebase, read files in this order:

1. `index.php` to see what gets rendered first.
2. `assets/app.js` to understand frontend behavior and API calls.
3. `api/*.php` to see how each endpoint validates, saves, and returns data.

## Notes

- Visitor progress is stored per browser using a `visitor_id` cookie.
- Answers autosave on each click.
- Final result is also persisted in the `results` table.

## Troubleshooting

### Health endpoint

Use `api/health.php` to quickly validate PHP/PDO/MySQL runtime health:

- URL: `http://localhost/personality/api/health.php`
- Response is JSON with: `status`, `php_version`, `pdo_loaded`, `pdo_mysql_loaded`, `db_connectable`, and (when configured) `bootstrap_enabled`.
- On failures, the endpoint returns safe error codes only (for example `DB_DRIVER_MISSING` or `DB_CONNECT_FAILED`) and does not expose credentials or DSN details.

Example:

```json
{
  "status": "ok",
  "php_version": "8.2.12",
  "pdo_loaded": true,
  "pdo_mysql_loaded": true,
  "db_connectable": true,
  "bootstrap_enabled": true
}
```
