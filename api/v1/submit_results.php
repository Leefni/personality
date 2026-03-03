<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
if ($visitor === '') {
    json_error('No visitor session', 400);
}

$cache = read_results_cache();
if (isset($cache[$visitor]) && is_array($cache[$visitor])) {
    $cached = $cache[$visitor];
    if (isset($cached['score'], $cached['total'])) {
        json_success([
            'score' => (int) $cached['score'],
            'total' => (int) $cached['total'],
        ]);
    }
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

$scoreStmt = $pdo->prepare('SELECT COALESCE(SUM(value), 0) FROM answers WHERE visitor_id = ?');
$scoreStmt->execute([$visitor]);
$score = (int) $scoreStmt->fetchColumn();
$totalScore = $totalQuestions * 5;

$persist = $pdo->prepare(
    'INSERT INTO results (visitor_id, type_code, detail_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE type_code = VALUES(type_code), detail_json = VALUES(detail_json)'
);
$persist->execute([$visitor, 'SCOR', json_encode(['score' => $score, 'total' => $totalScore])]);

$cache[$visitor] = ['score' => $score, 'total' => $totalScore];
write_results_cache($cache);

json_success(['score' => $score, 'total' => $totalScore]);
