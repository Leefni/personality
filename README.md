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

