<?php
declare(strict_types=1);

function get_cached_result(PDO $pdo, string $visitor): ?array
{
    if ($visitor === '') {
        return null;
    }

    $stmt = $pdo->prepare('SELECT type_code, detail_json FROM results WHERE visitor_id = ? LIMIT 1');
    $stmt->execute([$visitor]);
    $row = $stmt->fetch();

    if (!is_array($row) || !isset($row['type_code']) || !is_string($row['type_code']) || $row['type_code'] === '') {
        return null;
    }

    $scores = [];
    if (isset($row['detail_json']) && is_string($row['detail_json']) && $row['detail_json'] !== '') {
        $decoded = json_decode($row['detail_json'], true);
        if (is_array($decoded)) {
            $scores = $decoded;
        }
    }

    return [
        'type' => $row['type_code'],
        'scores' => $scores,
    ];
}

function cache_result(PDO $pdo, string $visitor, string $type, array $scores): void
{
    if ($visitor === '' || $type === '') {
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO results (visitor_id, type_code, detail_json)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE type_code = ?, detail_json = ?'
    );
    $encodedScores = json_encode($scores, JSON_UNESCAPED_UNICODE);
    $stmt->execute([$visitor, $type, $encodedScores, $type, $encodedScores]);
}

function invalidate_cached_result(PDO $pdo, string $visitor): void
{
    if ($visitor === '') {
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM results WHERE visitor_id = ?');
    $stmt->execute([$visitor]);
}
