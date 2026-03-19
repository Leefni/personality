<?php
declare(strict_types=1);

require __DIR__ . '/http/response.php';

/** @return array{app_version:string,test_version:string,test_release_date:string} */
function health_metadata(): array
{
    $config = require __DIR__ . '/../../config.php';

    $testVersion = isset($config['test_version']) ? trim((string) $config['test_version']) : '';
    if ($testVersion === '') {
        $testVersion = '2026.03';
    }

    $testReleaseDate = isset($config['test_release_date']) ? trim((string) $config['test_release_date']) : '';
    if ($testReleaseDate === '') {
        $testReleaseDate = '2026-03-18';
    }

    return [
        'app_version' => 'v1',
        'test_version' => $testVersion,
        'test_release_date' => $testReleaseDate,
    ];
}

function is_liveness_mode(): bool
{
    $mode = strtolower((string) ($_GET['mode'] ?? ''));

    if ($mode === 'live' || $mode === 'liveness') {
        return true;
    }

    return isset($_GET['live']) || isset($_GET['lightweight']);
}

/** @param list<string> $messages */
function compact_messages(array $messages): array
{
    $filtered = array_values(array_filter(array_map('trim', $messages), static fn (string $message): bool => $message !== ''));

    return array_slice(array_unique($filtered), 0, 5);
}

if (is_liveness_mode()) {
    json_success([
        'ok' => true,
        'status' => 'live',
        'mode' => 'liveness',
        'metadata' => health_metadata(),
    ]);
}

$requiredTables = ['questions', 'answers', 'results'];
$tableStatuses = [];
foreach ($requiredTables as $table) {
    $tableStatuses[$table] = false;
}

$errors = [];
$dbConnected = false;
$questionCount = 0;
$bootstrapReady = false;

try {
    require __DIR__ . '/../../db.php';

    if (!isset($pdo) || !$pdo instanceof PDO) {
        throw new RuntimeException('Database connection was not initialized.');
    }

    $pdo->query('SELECT 1');
    $dbConnected = true;

    $tableCheckStmt = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :table_name'
    );

    foreach ($requiredTables as $table) {
        $tableCheckStmt->execute(['table_name' => $table]);
        $tableStatuses[$table] = ((int) $tableCheckStmt->fetchColumn()) > 0;
    }

    if ($tableStatuses['questions']) {
        $questionCount = (int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();
        $bootstrapReady = $questionCount > 0;
    } else {
        $errors[] = 'Missing required table: questions.';
    }
} catch (Throwable $error) {
    $errors[] = $error->getMessage();
}

$allRequiredTablesPresent = !in_array(false, $tableStatuses, true);
if (!$allRequiredTablesPresent) {
    foreach ($tableStatuses as $table => $present) {
        if (!$present) {
            $errors[] = sprintf('Missing required table: %s.', $table);
        }
    }
}

if ($allRequiredTablesPresent && !$bootstrapReady) {
    $errors[] = 'Bootstrap incomplete: questions table is empty.';
}

$isReady = $dbConnected && $allRequiredTablesPresent && $bootstrapReady;
$statusCode = $isReady ? 200 : 503;
$statusLabel = $isReady ? 'ready' : 'not_ready';

json_success([
    'ok' => $isReady,
    'status' => $statusLabel,
    'mode' => 'readiness',
    'checks' => [
        'database' => [
            'connected' => $dbConnected,
        ],
        'required_tables' => $tableStatuses,
        'questions' => [
            'count' => $questionCount,
            'bootstrapped' => $bootstrapReady,
        ],
    ],
    'metadata' => health_metadata(),
    'errors' => compact_messages($errors),
], $statusCode);
