# Personality Quiz (API v1)

This project is a PHP-based personality quiz with a JavaScript frontend.

## API versioning

All active endpoints are now under `api/v1/`:

- `GET /api/v1/get_questions.php?page=<number>&per_page=<number>`
- `GET /api/v1/get_progress.php`
- `POST /api/v1/save_answer.php`
- `POST /api/v1/submit_results.php`
- `POST /api/v1/reset_progress.php`
- `GET /api/v1/health.php`

## Legacy endpoints (`/api/*.php`)

Legacy paths under `/api/*.php` are **deprecated compatibility wrappers**.
They now forward directly to the corresponding `/api/v1/*.php` handlers, so behavior matches v1.

- `GET /api/get_questions.php` -> `/api/v1/get_questions.php`
- `GET /api/get_progress.php` -> `/api/v1/get_progress.php`
- `POST /api/save_answer.php` -> `/api/v1/save_answer.php`
- `POST /api/submit_results.php` -> `/api/v1/submit_results.php`
- `POST /api/reset_progress.php` -> `/api/v1/reset_progress.php`
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

Result caching is database-backed and stored in the existing `results` table:

- cache key: `visitor_id`
- cached payload: `type_code` and `detail_json`

### Cache read/write behavior

- `submit_results` checks `results` first. If a row exists, it returns that cached result immediately.
- If no row exists, `submit_results` computes scores from `answers` and upserts the cache row in `results`.

### Cache invalidation

The cache entry for a visitor is deleted when:

- an answer is created/updated (`save_answer`)
- progress is reset (`reset_progress`)

This keeps cached types aligned with the latest answers.

## Test files

Example API tests are available in:

- `tests/api_v1_endpoints_test.php`

These tests exercise each endpoint and expected response shape.
