<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
if ($visitor === '') {
    json_error('No visitor session', 400);
}

$cached = get_cached_result($pdo, $visitor);
if ($cached !== null) {
    json_success([
        'type' => $cached['type'],
        'scores' => is_array($cached['scores']) ? $cached['scores'] : new stdClass(),
    ]);
}

$totalQuestions = (int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();
$answeredStmt = $pdo->prepare('SELECT COUNT(DISTINCT question_id) FROM answers WHERE visitor_id = ?');
$answeredStmt->execute([$visitor]);
$answeredCount = (int) $answeredStmt->fetchColumn();

if ($answeredCount < $totalQuestions) {
    json_error('Incomplete test', 422, [
        'answered' => $answeredCount,
        'total' => $totalQuestions,
    ]);
}

$sums = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

$scoreStmt = $pdo->prepare(
    'SELECT q.dimension, SUM((a.value - 3) * q.direction * q.weight) AS score
     FROM answers a
     JOIN questions q ON a.question_id = q.id
     WHERE a.visitor_id = ?
     GROUP BY q.dimension'
);
$scoreStmt->execute([$visitor]);

foreach ($scoreStmt as $row) {
    $dimension = (string) $row['dimension'];
    if (!array_key_exists($dimension, $sums)) {
        continue;
    }

    $sums[$dimension] = (float) $row['score'];
}

$type = '';
$type .= $sums['EI'] >= 0 ? 'E' : 'I';
$type .= $sums['SN'] >= 0 ? 'S' : 'N';
$type .= $sums['TF'] >= 0 ? 'T' : 'F';
$type .= $sums['JP'] >= 0 ? 'J' : 'P';

cache_result($pdo, $visitor, $type, $sums);

json_success(['type' => $type, 'scores' => $sums]);
