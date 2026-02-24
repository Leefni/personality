# Personality Test (USBWebserver v8.6.6)

A lightweight PHP + MySQL personality test app with paginated questions, autosave, and a computed 4-letter result.

## Requirements

- USBWebserver v8.6.6 (Apache + PHP + MySQL)
- PHP PDO MySQL extension enabled (default in USBWebserver)

## Setup

### USBWebserver local defaults

`config.php` now reads database settings from environment variables, but it keeps USBWebserver-friendly defaults:

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=personality`
- `DB_USER=root`
- `DB_PASS=` (empty)

Steps:

1. Copy this project folder to your USBWebserver `root` directory.
2. Start **Apache** and **MySQL** from USBWebserver.
3. Browse to: `http://localhost/personality/`

On first startup, the app now auto-bootstraps the database when `DB_AUTO_BOOTSTRAP=true` (default):

- Verifies required tables (`questions`, `answers`, `results`).
- Runs `init.sql` if any required table is missing.
- Seeds `questions.sql` only when the `questions` table is empty.

You can still import SQL manually via phpMyAdmin if preferred.

### Environment-based deployment (server, container, CI)

Set the following environment variables in your runtime before serving the app:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `DB_AUTO_BOOTSTRAP` (optional, default `true`; set to `false` to disable automatic schema/seed bootstrap in production)

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
