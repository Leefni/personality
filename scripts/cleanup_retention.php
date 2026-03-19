#!/usr/bin/env php
<?php
declare(strict_types=1);

require __DIR__ . '/../db.php';

/**
 * @param string $name
 * @param int $default
 */
function env_positive_int(string $name, int $default): int
{
    $raw = getenv($name);
    if ($raw === false) {
        return $default;
    }

    $value = filter_var($raw, FILTER_VALIDATE_INT);
    if ($value === false || $value < 1) {
        return $default;
    }

    return $value;
}

/**
 * @param PDO $pdo
 * @param string $table
 * @param string $cutoff
 * @param int $batchSize
 */
function cleanup_table(PDO $pdo, string $table, string $cutoff, int $batchSize): int
{
    $sql = sprintf(
        'DELETE FROM `%s` WHERE COALESCE(updated_at, created_at) < :cutoff ORDER BY id LIMIT :batch_size',
        str_replace('`', '``', $table)
    );

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':cutoff', $cutoff, PDO::PARAM_STR);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt->rowCount();
}

$retentionDays = env_positive_int('RETENTION_DAYS', 90);
$batchSize = env_positive_int('RETENTION_MAX_DELETE_PER_TABLE', 5000);
$dryRun = filter_var(getenv('RETENTION_DRY_RUN') ?: 'false', FILTER_VALIDATE_BOOLEAN);

$cutoff = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
    ->sub(new DateInterval(sprintf('P%dD', $retentionDays)))
    ->format('Y-m-d H:i:s');

$tables = ['answers', 'results'];
$deletedCounts = [
    'answers' => 0,
    'results' => 0,
];

if ($dryRun) {
    foreach ($tables as $table) {
        $sql = sprintf(
            'SELECT COUNT(*) FROM `%s` WHERE COALESCE(updated_at, created_at) < :cutoff',
            str_replace('`', '``', $table)
        );
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':cutoff' => $cutoff]);
        $deletedCounts[$table] = (int) $stmt->fetchColumn();
    }
} else {
    foreach ($tables as $table) {
        $deletedCounts[$table] = cleanup_table($pdo, $table, $cutoff, $batchSize);
    }
}

echo json_encode(
    [
        'ok' => true,
        'dry_run' => $dryRun,
        'retention_days' => $retentionDays,
        'cutoff_utc' => $cutoff,
        'batch_size' => $batchSize,
        'deleted' => $deletedCounts,
    ],
    JSON_UNESCAPED_SLASHES
);
echo PHP_EOL;
