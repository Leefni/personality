# Personality Quiz (API v1)

This project is a PHP-based personality quiz with a JavaScript frontend.

## Getting Started

### Prerequisites

- **PHP**: 8.0+ with `pdo_mysql` enabled.
- **MySQL**: 5.7+ (8.x recommended).
- **Web server**: Any server that can serve PHP (Apache, Nginx + PHP-FPM, or built-in PHP dev server) with this repo as the web root (or mapped subdirectory).

### Local configuration

Runtime configuration comes from environment variables in `config.php`:

- `DB_HOST` (default: `127.0.0.1`)
- `DB_PORT` (default: `3306`)
- `DB_NAME` (default: `personality`)
- `DB_USER` (default: `root`)
- `DB_PASS` (default: empty string)
- `DB_AUTO_BOOTSTRAP` (default: `true`)
- `APP_ENV` (default: `production`)
- `RETENTION_DAYS` (default: `90`) for maintenance cleanup window
- `RETENTION_MAX_DELETE_PER_TABLE` (default: `5000`) max rows deleted per table per run
- `RETENTION_DRY_RUN` (default: `false`) report candidate rows without deleting

For local-only overrides, you can optionally create `config.local.php` at the repository root. If present and it returns an array, its values override env-derived defaults.

### Database bootstrap (`db_auto_bootstrap`)

When `DB_AUTO_BOOTSTRAP=true` (default), startup bootstrap will:

1. Ensure required tables exist (`questions`, `answers`, `results`) by running `init.sql` if needed.
2. Seed `questions` from `questions.sql` when the table is empty.

When `DB_AUTO_BOOTSTRAP=false`, bootstrap is skipped, so schema and seed data must already exist.

### First run

1. Start MySQL and create/login credentials matching your `DB_*` settings.
2. Serve this folder via your web server.
3. Open the app entrypoint in a browser: `http://<host>/<path>/index.php`.
4. The frontend will call `/api/v1/*` endpoints from there.

#### Smoke test (curl)

```bash
# Health check
curl -sS "http://localhost/personality/api/v1/health.php"

# Fetch first page of questions
curl -sS "http://localhost/personality/api/v1/get_questions.php?page=1&per_page=5"
```

### Troubleshooting

- **DB auth failure (dev/local)**: if you see `Database authentication failed. Check DB_USER/DB_PASS ... update env vars or config.local.php.`, verify `DB_USER`/`DB_PASS` (or `config.local.php`) and that the MySQL user is allowed from your `DB_HOST`.
- **Missing tables / schema errors**: if requests fail with missing table errors (for example `questions`, `answers`, or `results`), either enable `DB_AUTO_BOOTSTRAP=true` or run `init.sql` (and `questions.sql` if needed) manually against `DB_NAME`.

## Data retention cleanup (cron)

**Default decision (product/legal): `90` days.**  
This keeps enough history for users to resume an unfinished test over a longer period while still enforcing automatic deletion for data minimization.

Use `scripts/cleanup_retention.php` to remove stale rows from:

- `answers`
- `results`

Rows are eligible when `COALESCE(updated_at, created_at)` is older than `RETENTION_DAYS`.

### Environment variables

- `RETENTION_DAYS` (default: `90`)
- `RETENTION_MAX_DELETE_PER_TABLE` (default: `5000`)
- `RETENTION_DRY_RUN` (`true`/`false`, default: `false`)

### Manual run

```bash
php scripts/cleanup_retention.php
```

Sample output:

```json
{
  "ok": true,
  "dry_run": false,
  "retention_days": 90,
  "cutoff_utc": "2025-12-19 10:00:00",
  "batch_size": 5000,
  "deleted": { "answers": 120, "results": 95 }
}
```

### Cron setup example

Run daily at 02:15 UTC with the default 90-day retention window:

```cron
15 2 * * * cd /path/to/personality && php scripts/cleanup_retention.php >> /var/log/personality-retention.log 2>&1
```

If you need a one-off override, you can still set env vars inline:

```cron
15 2 * * * cd /path/to/personality && RETENTION_DAYS=90 RETENTION_MAX_DELETE_PER_TABLE=10000 php scripts/cleanup_retention.php >> /var/log/personality-retention.log 2>&1
```

Suggested schedule: once per day during low traffic hours. Keep `RETENTION_MAX_DELETE_PER_TABLE` bounded to avoid long-running delete spikes.

## API versioning

All active endpoints are now under `api/v1/`:

- `GET /api/v1/get_questions.php?page=<number>&per_page=<number>`
- `GET /api/v1/get_progress.php`
- `POST /api/v1/save_answer.php`
- `POST /api/v1/submit_results.php`
- `POST /api/v1/reset_progress.php`
- `POST /api/v1/delete_data.php`
- `GET /api/v1/test_metadata.php`
- `GET /api/v1/health.php`

## Legacy endpoints (`/api/*.php`)

Legacy paths under `/api/*.php` are **deprecated compatibility wrappers**.
They now forward directly to the corresponding `/api/v1/*.php` handlers, so behavior matches v1.

- `GET /api/get_questions.php` -> `/api/v1/get_questions.php`
- `GET /api/get_progress.php` -> `/api/v1/get_progress.php`
- `POST /api/save_answer.php` -> `/api/v1/save_answer.php`
- `POST /api/submit_results.php` -> `/api/v1/submit_results.php`
- `POST /api/reset_progress.php` -> `/api/v1/reset_progress.php`
- `POST /api/delete_data.php` -> `/api/v1/delete_data.php`
- `GET /api/test_metadata.php` -> `/api/v1/test_metadata.php`
- `GET /api/health.php` -> `/api/v1/health.php`

Sunset policy: these wrappers are scheduled for removal after **2026-12-31**.
New integrations should use only `/api/v1/*` endpoints.

## JSON error format

All API errors use the same structure:

```json
{
  "error": true,
  "message": "Human readable error"
}
```

Some endpoints can add extra fields (for example `answered` and `total` for incomplete quiz submission).

## Endpoint behavior

### `GET /api/v1/get_questions.php`

Supports pagination via optional query parameters:

- `page` (default: `1`)
- `per_page` (default: `10`)

Response:

```json
{
  "questions": [
    { "id": 1, "text": "..." }
  ],
  "page": 1,
  "per_page": 10,
  "total": 50
}
```

### `GET /api/v1/get_progress.php`

Returns current visitor answers:

```json
[
  { "question_id": 1, "value": 4 }
]
```

### `POST /api/v1/save_answer.php`

Request body:

```json
{
  "question_id": 1,
  "value": 4
}
```

Success response:

```json
{
  "ok": true,
  "visitor_id": "<id>"
}
```

### `POST /api/v1/submit_results.php`

Calculates the 4-letter personality type from saved answers and caches it in the `results` table (`visitor_id` -> `type_code` + `detail_json`).

Success response:

```json
{
  "type": "ENTJ",
  "scores": { "EI": 6, "SN": -2, "TF": 1, "JP": 8 }
}
```

If a cached DB result already exists for the visitor, the endpoint returns it without recalculation.

### `POST /api/v1/reset_progress.php`

Deletes visitor answers and invalidates the visitor's cached result entry.

Response:

```json
{ "ok": true }
```

## Frontend changes

The frontend (`assets/app.js`) now:

- Loads questions page-by-page from `api/v1/get_questions.php`.
- Shows `Prev` and `Next` buttons for navigation.
- Saves answer changes with **300ms debounce** (instead of immediate save on every click).
- Submits results through `POST /api/v1/submit_results.php`.

## Result cache

Result caching is canonicalized to the database `results` table only:

- cache key: `visitor_id`
- cached payload: `type_code` and `detail_json`
- cache helpers: `api/v1/cache.php` (`get_cached_result`, `cache_result`, `invalidate_cached_result`)

### Cache read/write behavior

- `submit_results` checks `results` first. If a row exists, it returns that cached result immediately.
- If no row exists, `submit_results` computes scores from `answers`, saves the canonical result, and upserts the `results` cache row.

### Cache invalidation

The DB cache entry for a visitor is deleted when:

- an answer is created/updated (`save_answer`)
- progress is reset (`reset_progress`)
- privacy delete is requested (`delete_data`)

### Deprecated file cache

Legacy file cache helpers in `api/v1/results_cache.php` are behind `ENABLE_FILE_RESULTS_CACHE=false` and are deprecated. They are kept temporarily for backward compatibility and are scheduled for removal after **2026-12-31**.

## Testing

Run API checks through the shared test entrypoint:

- `BASE_URL="http://localhost/personality" bash tests/run_api_checks.sh`

This command now runs both:

1. `tests/frontend_syntax_check.sh` to validate JavaScript syntax for `assets/app.js` and `assets/js/*.js` before deploy.
2. `tests/frontend_runtime_check.sh` to verify frontend load/error runtime behavior (including timeout handling).
3. `tests/api_v1_endpoints_test.php` to exercise API endpoint behavior.

You can still run the API-only test directly if needed:

- `BASE_URL="http://localhost/personality" php tests/api_v1_endpoints_test.php`

### CI parity (GitHub Actions)

The repository CI workflow (`.github/workflows/ci.yml`) runs on both `push` and `pull_request` and executes:

1. `tests/frontend_syntax_check.sh`
2. `tests/frontend_runtime_check.sh`
3. `tests/run_api_checks.sh` (includes API endpoint checks)

To reproduce CI failures locally:

```bash
# 1) Frontend syntax/runtime checks (same as CI)
bash tests/frontend_syntax_check.sh
bash tests/frontend_runtime_check.sh

# 2) API checks against an existing deployment
BASE_URL="http://localhost/personality" bash tests/run_api_checks.sh
```

If you do not already have a local server running, use the same fallback pattern as CI (local PHP server + local MySQL):

```bash
# Start MySQL first (matching README DB_* defaults), then:
export DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=personality DB_USER=root DB_PASS=root DB_AUTO_BOOTSTRAP=true
php -S 127.0.0.1:8000 -t . &
BASE_URL="http://127.0.0.1:8000" bash tests/run_api_checks.sh
```

In GitHub Actions, API checks can target either:

- a custom `BASE_URL` (set via environment or repository variable `BASE_URL`), or
- the built-in fallback service path (`http://127.0.0.1:8000`) backed by a MySQL service container.

### Windows (PowerShell) debugging helpers

For local debugging on Windows, use the PowerShell equivalents:

- `pwsh tests/frontend_syntax_check.ps1`
- `pwsh tests/frontend_runtime_check.ps1`

### `GET /api/v1/test_metadata.php`

Returns revision metadata for the active test:

```json
{
  "version": "2026.03",
  "date": "2026-03-18",
  "question_count": 120
}
```

### `POST /api/v1/delete_data.php`

Explicit privacy action that removes current visitor answers and results cache.

Response:

```json
{ "ok": true }
```
