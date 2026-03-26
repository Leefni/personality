# Personality Quiz (API v1)

This repository is a full-stack personality test application:

- **Backend**: PHP (procedural API endpoints + small service/repository classes)
- **Frontend**: Vanilla JavaScript modules
- **Persistence**: MySQL tables for questions, answers, result cache, public sharing, and recovery flows

The app serves a question flow, autosaves answers per visitor, computes a 4-letter type (E/I, S/N, T/F, J/P), supports recovery links, and optionally publishes a result to a public wall.

## How the project is organized

### High-level structure

- `index.php` → HTML shell, SEO tags, CSP/security headers, mounts JS app.
- `assets/app.js` → frontend orchestrator (loads questions/progress, pagination, autosave retries, submit/reset/delete/recovery).
- `assets/js/*.js` → view/state/api/helper modules.
- `api/v1/*.php` → HTTP API endpoints.
- `api/v1/http/*.php` → request/response/visitor helpers.
- `src/QuizRepository.php` → DB queries + persistence rules.
- `src/QuizService.php` → score normalization/completion/type derivation logic.
- `db.php`, `config.php`, `db_bootstrap.php`, `init.sql`, `questions.sql` → config, DB connection, bootstrap + seed.
- `scripts/cleanup_retention.php` → retention cleanup job.
- `tests/*` → API checks, frontend syntax/runtime checks, unit tests.

### Runtime configuration

`config.php` reads environment variables (optionally overridden by `config.local.php`).

Important keys:

- DB: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_AUTO_BOOTSTRAP`
- App mode: `APP_ENV`
- Recovery: `RECOVERY_TOKEN_TTL_SECONDS`, `RECOVERY_RATE_LIMIT_*`, `RECOVERY_EMAIL_FROM`, `RECOVERY_BASE_URL`
- Retention: `RETENTION_DAYS`, `RETENTION_MAX_DELETE_PER_TABLE`, `RETENTION_DRY_RUN`

## End-to-end flow (exact request lifecycle)

## 1) Browser loads app shell

1. User opens `index.php`.
2. PHP returns static HTML with:
   - content/security headers,
   - container elements for question and result screens,
   - `<script type="module" src="assets/app.js">`.
3. Frontend JS starts and initializes theme + state + listeners.

## 2) Visitor identity is established

The app tracks a visitor using a stable `visitor_id` (32-char hex).

- Frontend stores it in localStorage key: `personality.visitor_id.v1`.
- Frontend sends it via `X-Visitor-ID` header when available.
- Backend can also read from payload/cookie/header and can create one when needed.

This ID is the key used for `answers`, `results`, and recovery mapping.

## 3) Initial data load

On startup frontend does:

1. `GET /api/v1/test_metadata.php` (version/date/question_count).
2. `GET /api/v1/get_progress.php` (existing answers for current visitor).
3. `GET /api/v1/get_questions.php?page=1&per_page=<pageSize>`.

`get_questions` returns:

```json
{
  "questions": [{ "id": 1, "text": "..." }],
  "page": 1,
  "per_page": 10,
  "total": 120,
  "metadata": {
    "version": "2026.03",
    "date": "2026-03-18",
    "question_count": 120
  }
}
```

Frontend merges server answers into local state, renders current page, and updates progress/navigation.

## 4) Answering + autosave flow

When user selects an option:

1. Frontend updates in-memory state immediately for responsive UI.
2. Save is debounced.
3. Frontend sends `POST /api/v1/save_answer.php`:

```json
{ "question_id": 42, "value": 5 }
```

4. Backend validates:
   - `question_id` exists,
   - `value` is integer `1..6` (canonical Likert scale).
5. Backend upserts row in `answers` for `(question_id, visitor_id)`.
6. Backend **invalidates cached result** for that visitor (`results` row delete), ensuring changed answers force recalculation later.
7. Frontend handles transient failures with retry + pending retry tracking so unsynced items can be retried.

## 5) Pagination flow

- Frontend requests question pages using `page`/`per_page`.
- Server always returns `total` count, so frontend can compute page boundaries.
- UI blocks submit if unanswered items remain on current page or if unsynced saves still exist.

## 6) Submit flow (result calculation + cache)

When user submits:

1. Frontend calls `POST /api/v1/submit_results.php`.
2. Backend resolves visitor and checks DB cache first (`results` table by `visitor_id`).
3. If cached result exists, it returns immediately.
4. If not cached:
   - count total questions,
   - count answered questions,
   - if incomplete => `422 Incomplete test` with `{ answered, total }`,
   - if complete => compute dimension scores from answers + question direction/weight,
   - derive 4-letter type using sign of each dimension,
   - cache result into `results` table.
5. Response includes:
   - `type`,
   - `scores`,
   - `max_scores`,
   - test `metadata`.

## 7) Reset and deletion flows

### Reset progress

- `POST /api/v1/reset_progress.php`
- Deletes visitor answers and visitor result cache; keeps session usable for a fresh retake.

### Delete data (privacy)

- `POST /api/v1/delete_data.php`
- Same persistence cleanup intent for explicit privacy action.

## 8) Recovery flow (email resume)

### Request recovery

1. Frontend calls `POST /api/v1/request_recovery.php` with email.
2. Backend validates email and enforces rate limits:
   - per visitor per window,
   - per email per window.
3. Backend creates one-time token (stored hashed + TTL).
4. In dev/local app env, API returns a mock `recovery_link`.
5. In production env, API sends email using `mail()`.

### Redeem recovery

1. Frontend reads `recovery_token` from URL and calls `POST /api/v1/redeem_recovery.php`.
2. Backend validates + redeems token, binds visitor session/cookie, writes audit entry.
3. Frontend reloads progress/questions for that recovered visitor context.

## 9) Public sharing flow

### Publish current result

- `POST /api/v1/publish_result.php` with optional `display_name`.
- Requires complete test (or existing cached result).
- Creates `public_results` entry with generated `public_id`.

### View public results

- `GET /api/v1/public_results.php` for paginated wall.
- `GET /api/v1/public_results.php?public_id=<id>` for one shared result.

## API surface

All active v1 endpoints:

- `GET /api/v1/health.php` (readiness/liveness)
- `GET /api/v1/test_metadata.php`
- `GET /api/v1/get_questions.php?page=<n>&per_page=<n>`
- `GET /api/v1/get_progress.php`
- `POST /api/v1/save_answer.php`
- `POST /api/v1/submit_results.php`
- `POST /api/v1/reset_progress.php`
- `POST /api/v1/delete_data.php`
- `POST /api/v1/request_recovery.php`
- `POST /api/v1/redeem_recovery.php`
- `POST /api/v1/publish_result.php`
- `GET /api/v1/public_results.php`

### Standard error format

```json
{
  "error": true,
  "message": "Human readable error"
}
```

Some errors include extra fields (for example `answered`, `total`).

## Database bootstrap behavior

When `DB_AUTO_BOOTSTRAP=true` (default):

1. Ensures required tables exist by running `init.sql` when needed.
2. Seeds questions from `questions.sql` if questions are empty.

When `DB_AUTO_BOOTSTRAP=false`, schema/seed must already exist.

## Getting started locally

1. Start MySQL with credentials matching your `DB_*` config.
2. Serve this repo root with PHP-capable server.
3. Open `http://<host>/<path>/index.php`.
4. Interact with frontend; it talks to `/api/v1/*`.

Quick smoke test:

```bash
curl -sS "http://localhost/personality/api/v1/health.php"
curl -sS "http://localhost/personality/api/v1/get_questions.php?page=1&per_page=5"
```

## Data retention cleanup (cron)

Default retention policy is **90 days**.

`php scripts/cleanup_retention.php` removes stale rows from `answers` and `results` where `COALESCE(updated_at, created_at)` is older than `RETENTION_DAYS`.

Example cron (daily 02:15 UTC):

```cron
15 2 * * * cd /path/to/personality && php scripts/cleanup_retention.php >> /var/log/personality-retention.log 2>&1
```

## Testing

Primary integration command:

- `BASE_URL="http://localhost/personality" bash tests/run_api_checks.sh`

This executes:

1. `tests/frontend_syntax_check.sh`
2. `tests/frontend_runtime_check.sh`
3. `tests/api_v1_endpoints_test.php`

Additional checks:

- `php tests/quiz_service_test.php`
- `pwsh tests/frontend_syntax_check.ps1`
- `pwsh tests/frontend_runtime_check.ps1`

CI (`.github/workflows/ci.yml`) runs php lint + unit tests on pushes/PRs.
