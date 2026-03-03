# Personality Test (USBWebserver v8.6.6)

A lightweight PHP + MySQL personality test app with paginated questions, autosave, and a computed 4-letter result.

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

