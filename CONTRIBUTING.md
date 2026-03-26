# Contributing

Thanks for taking the time to contribute! This guide covers the local setup, code conventions, and the PR process.

## Local setup

**Prerequisites:** PHP 8.1+, MySQL 8.0+, Node.js 20+.

```bash
# Clone and enter the repo
git clone https://github.com/<your-org>/personality.git
cd personality

# Copy the env example and fill in your local DB credentials
cp .env.example .env

# Start MySQL and create the database (auto-bootstrapped on first request)
# Then serve with the PHP built-in server:
php -S 127.0.0.1:8000 -t .

# Open http://127.0.0.1:8000/index.php
```

## Running the tests

```bash
# PHP lint (all versions in CI run 8.1–8.3; locally just run your version)
find . -name "*.php" -not -path "./vendor/*" | xargs php -l

# Frontend syntax + runtime checks
bash tests/frontend_syntax_check.sh
bash tests/frontend_runtime_check.sh

# API endpoint integration tests (requires the PHP server to be running)
bash tests/run_api_checks.sh

# PHP unit tests (requires phpunit)
phpunit --bootstrap db_bootstrap.php tests/quiz_service_test.php
```

The GitHub Actions CI workflow runs PHP lint (8.1–8.3 matrix) and PHP unit tests automatically on every push and pull request. Frontend syntax/runtime checks remain recommended local checks.

## Code conventions

- **PHP:** `declare(strict_types=1)` at the top of every file. PDO prepared statements for all DB access — no raw interpolation. Errors surface via `json_error()`, not bare `echo`.
- **JavaScript:** plain ES modules, no build step. `apiFetch` handles timeouts and retry; avoid calling `fetch` directly. Always escape user-controlled content with `escapeHtml()` before inserting into `innerHTML`.
- **CSS:** use the CSS custom properties defined in `:root`. Avoid magic numbers; prefer the `--space-*` and `--font-size-*` tokens.

## Commit message format

Use the conventional-commits style: `type: short description` (imperative, lowercase).

| Type | When to use |
|------|-------------|
| `fix` | A bug fix |
| `feat` | A new feature |
| `refactor` | Code change that is not a fix or feature |
| `test` | Adding or fixing tests |
| `chore` | Build tooling, CI, dependencies |
| `docs` | Documentation only |

Example: `fix: hide unanswered-count hint when all questions are answered`

## Pull request process

1. Create a branch off `main`: `git checkout -b fix/my-bug`.
2. Make your changes and ensure all tests pass locally.
3. Open a PR against `main` using the PR template that appears automatically.
4. A maintainer will review and merge once CI is green.

## Reporting issues

Use the GitHub issue templates — there is one for bugs and one for feature requests. Please fill in as much detail as you can; it speeds up triage significantly.
