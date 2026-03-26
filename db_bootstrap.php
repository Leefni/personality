<?php
declare(strict_types=1);

/**
 * Ensure required database schema and seed data exist.
 * Safe to call on every request — skips all work if schema is already in place.
 */
function bootstrap_database(PDO $pdo, array $config): void
{
    if (!(bool) ($config['db_auto_bootstrap'] ?? true)) {
        return;
    }

    // Fast path: if the questions table exists, the schema is already in place.
    // Never run DDL on every request — it triggers MySQL warnings that can
    // surface as PDO exceptions and produce false 500 errors.
    try {
        if (table_exists($pdo, 'questions')) {
            // Run any pending column migrations (e.g. widening visitor_id).
            run_migrations($pdo);
            seed_questions_if_empty($pdo);
            return;
        }
    } catch (Throwable $e) {
        error_log('[bootstrap table_exists] ' . $e->getMessage());
        return;
    }

    // Schema is missing: run init.sql to create all tables.
    try {
        execute_sql_file($pdo, __DIR__ . '/init.sql');
    } catch (Throwable $e) {
        error_log('[bootstrap init.sql] ' . $e->getMessage());
        return;
    }

    // Seed questions.
    try {
        seed_questions_if_empty($pdo);
    } catch (Throwable $e) {
        error_log('[bootstrap seed] ' . $e->getMessage());
    }
}


/**
 * Applies lightweight schema migrations that are safe to run on every boot.
 * Each migration is idempotent — running it twice has no effect.
 */
function run_migrations(PDO $pdo): void
{
    // Migration 1: widen visitor_id from CHAR(32) to VARCHAR(64) so IDs of any
    // reasonable length are accepted without SQL truncation errors.
    try {
        $col = $pdo->query(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'answers'
               AND COLUMN_NAME = 'visitor_id'"
        )->fetchColumn();

        if ($col && strtoupper((string) $col) !== 'VARCHAR(64)') {
            $pdo->exec("ALTER TABLE answers MODIFY COLUMN visitor_id VARCHAR(64) NOT NULL");
            $pdo->exec("ALTER TABLE results MODIFY COLUMN visitor_id VARCHAR(64) NOT NULL");
        }
    } catch (Throwable $e) {
        error_log('[migration visitor_id] ' . $e->getMessage());
    }

    // Migration 2: add sharing metadata columns for public results browsing.
    try {
        $displayNameExists = (bool) $pdo->query(
            "SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'results'
               AND COLUMN_NAME = 'display_name'
             LIMIT 1"
        )->fetchColumn();

        if (!$displayNameExists) {
            $pdo->exec("ALTER TABLE results ADD COLUMN display_name VARCHAR(80) DEFAULT NULL AFTER detail_json");
        }

        $isPublicExists = (bool) $pdo->query(
            "SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'results'
               AND COLUMN_NAME = 'is_public'
             LIMIT 1"
        )->fetchColumn();

        if (!$isPublicExists) {
            $pdo->exec("ALTER TABLE results ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER display_name");
        }

        $publicIndexExists = (bool) $pdo->query(
            "SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'results'
               AND INDEX_NAME = 'idx_results_public_created'
             LIMIT 1"
        )->fetchColumn();

        if (!$publicIndexExists) {
            $pdo->exec("ALTER TABLE results ADD INDEX idx_results_public_created (is_public, created_at)");
        }
    } catch (Throwable $e) {
        error_log('[migration result sharing] ' . $e->getMessage());
    }
}

/**
 * Checks whether a single table exists in the current database.
 * Uses a simple SELECT instead of information_schema for maximum compatibility.
 */
function table_exists(PDO $pdo, string $table): bool
{
    try {
        $pdo->query('SELECT 1 FROM `' . str_replace('`', '``', $table) . '` LIMIT 0');
        return true;
    } catch (PDOException $e) {
        // Error code 1146 = "Table doesn't exist"
        if (($e->errorInfo[1] ?? 0) === 1146) {
            return false;
        }
        // Any other DB error: re-throw so it surfaces properly.
        throw $e;
    }
}

function seed_questions_if_empty(PDO $pdo): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();
    if ($count > 0) {
        return;
    }
    execute_sql_file($pdo, __DIR__ . '/questions.sql');
}

function execute_sql_file(PDO $pdo, string $filePath): void
{
    $sql = file_get_contents($filePath);
    if ($sql === false) {
        throw new RuntimeException(sprintf('Unable to read SQL file: %s', $filePath));
    }
    foreach (split_sql_statements($sql) as $statement) {
        assert_db_agnostic_statement($statement, $filePath);
        $pdo->exec($statement);
    }
}

function assert_db_agnostic_statement(string $statement, string $filePath): void
{
    $normalized = ltrim($statement);
    if (preg_match('/^(USE\s+|CREATE\s+DATABASE\b|DROP\s+DATABASE\b)/i', $normalized) === 1) {
        throw new RuntimeException(sprintf(
            'Database-specific statement found in %s. Keep SQL bootstrap files DB-agnostic.',
            $filePath
        ));
    }
}

function split_sql_statements(string $sql): array
{
    $statements = [];
    $buffer = '';
    $inSingleQuote = false;
    $inDoubleQuote = false;
    $length = strlen($sql);

    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        $prev = $i > 0 ? $sql[$i - 1] : '';

        if ($char === "'" && !$inDoubleQuote && $prev !== '\\') {
            $inSingleQuote = !$inSingleQuote;
        } elseif ($char === '"' && !$inSingleQuote && $prev !== '\\') {
            $inDoubleQuote = !$inDoubleQuote;
        }

        if ($char === ';' && !$inSingleQuote && !$inDoubleQuote) {
            $trimmed = trim($buffer);
            if ($trimmed !== '') {
                $statements[] = $trimmed;
            }
            $buffer = '';
            continue;
        }

        $buffer .= $char;
    }

    $trimmed = trim($buffer);
    if ($trimmed !== '') {
        $statements[] = $trimmed;
    }

    return $statements;
}
