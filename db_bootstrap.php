<?php
declare(strict_types=1);

/**
 * Ensure required database schema and seed data exist.
 */
function bootstrap_database(PDO $pdo, array $config): void
{
    if (!(bool) ($config['db_auto_bootstrap'] ?? true)) {
        return;
    }

    $requiredTables = ['questions', 'answers', 'results'];

    if (has_required_tables($pdo, $requiredTables)) {
        seed_questions_if_empty($pdo);
        return;
    }

    $inTransaction = false;

    try {
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
            $inTransaction = true;
        }

        execute_sql_file($pdo, __DIR__ . '/init.sql');
        seed_questions_if_empty($pdo);

        if ($inTransaction && $pdo->inTransaction()) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($inTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;
    }
}

function has_required_tables(PDO $pdo, array $requiredTables): bool
{
    $sql = <<<'SQL'
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = ?
  AND TABLE_NAME IN (%s)
SQL;

    $placeholders = implode(', ', array_fill(0, count($requiredTables), '?'));
    $databaseName = (string) $pdo->query('SELECT DATABASE()')->fetchColumn();

    if ($databaseName === '') {
        throw new RuntimeException('No active database selected for bootstrap.');
    }

    $stmt = $pdo->prepare(sprintf($sql, $placeholders));
    $stmt->bindValue(1, $databaseName);

    foreach ($requiredTables as $index => $tableName) {
        $stmt->bindValue($index + 2, $tableName);
    }

    $stmt->execute();
    $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);

    return count(array_intersect($requiredTables, $existing)) === count($requiredTables);
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
