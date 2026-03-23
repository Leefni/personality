#!/usr/bin/env php
<?php
declare(strict_types=1);

require __DIR__ . '/../db.php';

/**
 * Deletes rows older than $cutoff from a table, up to $batchSize rows.
 * Returns the number of rows deleted (or counted in dry-run mode).
 */
function cleanup_table(PDO $pdo, string $table, string $cutoff, int $batchSize, bool $dryRun): int
{
    $safeTable = '`' . str_replace('`', '``', $table) . '`';

    if ($dryRun) {
        $sql = sprintf(
            'SELECT COUNT(*) FROM %s WHERE COALESCE(updated_at, created_at) < :cutoff',
            $safeTable
        );
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':cutoff' => $cutoff]);
        return (int) $stmt->fetchColumn();
    }

    $sql = sprintf(
        'DELETE FROM %s WHERE COALESCE(updated_at, created_at) < :cutoff ORDER BY id LIMIT :batch_size',
        $safeTable
    );
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':cutoff', $cutoff, PDO::PARAM_STR);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->rowCount();
}

/**
 * Purges expired (unredeemed) recovery tokens older than $cutoff.
 */
function cleanup_recovery_tokens(PDO $pdo, string $cutoff, int $batchSize, bool $dryRun): int
{
    if ($dryRun) {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM recovery_tokens WHERE expires_at < :cutoff AND redeemed_at IS NULL'
        );
        $stmt->execute([':cutoff' => $cutoff]);
        return (int) $stmt->fetchColumn();
    }

    $stmt = $pdo->prepare(
        'DELETE FROM recovery_tokens WHERE expires_at < :cutoff AND redeemed_at IS NULL ORDER BY id LIMIT :batch_size'
    );
    $stmt->bindValue(':cutoff', $cutoff, PDO::PARAM_STR);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->rowCount();
}

/**
 * Purges old recovery audit log entries.
 */
function cleanup_recovery_audit(PDO $pdo, string $cutoff, int $batchSize, bool $dryRun): int
{
    if ($dryRun) {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM recovery_audit_log WHERE created_at < :cutoff'
        );
        $stmt->execute([':cutoff' => $cutoff]);
        return (int) $stmt->fetchColumn();
    }

    $stmt = $pdo->prepare(
        'DELETE FROM recovery_audit_log WHERE created_at < :cutoff ORDER BY id LIMIT :batch_size'
    );
    $stmt->bindValue(':cutoff', $cutoff, PDO::PARAM_STR);
    $stmt->bindValue(':batch_size', $batchSize, PDO::PARAM_INT);
    $stmt->execute();
    return $stmt->rowCount();
}

$retentionDays = max(1, (int) ($config['retention_days'] ?? 90));
$batchSize     = max(1, (int) ($config['retention_max_delete_per_table'] ?? 5000));
$dryRun        = (bool) ($config['retention_dry_run'] ?? false);

$cutoff = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
    ->sub(new DateInterval(sprintf('P%dD', $retentionDays)))
    ->format('Y-m-d H:i:s');

$deleted = [
    'answers'              => cleanup_table($pdo, 'answers', $cutoff, $batchSize, $dryRun),
    'results'              => cleanup_table($pdo, 'results', $cutoff, $batchSize, $dryRun),
    'recovery_tokens'      => cleanup_recovery_tokens($pdo, $cutoff, $batchSize, $dryRun),
    'recovery_audit_log'   => cleanup_recovery_audit($pdo, $cutoff, $batchSize, $dryRun),
];

echo json_encode(
    [
        'ok'             => true,
        'dry_run'        => $dryRun,
        'retention_days' => $retentionDays,
        'cutoff_utc'     => $cutoff,
        'batch_size'     => $batchSize,
        'deleted'        => $deleted,
    ],
    JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
);
echo PHP_EOL;
