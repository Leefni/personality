<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../db.php';

$visitor = $_COOKIE['visitor_id'] ?? '';
if ($visitor === '') {
    http_response_code(400);
    echo json_encode(['error' => 'No visitor session']);
    exit;
}

$totalQuestions = (int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn();
$answeredStmt = $pdo->prepare('SELECT COUNT(DISTINCT question_id) FROM answers WHERE visitor_id = ?');
$answeredStmt->execute([$visitor]);
$answeredCount = (int) $answeredStmt->fetchColumn();

if ($answeredCount < $totalQuestions) {
    http_response_code(422);
    echo json_encode([
        'error' => 'Incomplete test',
        'answered' => $answeredCount,
        'total' => $totalQuestions,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$sums = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

$stmt = $pdo->prepare(
    'SELECT q.dimension, SUM((a.value - 3) * q.direction * q.weight) AS score
     FROM answers a
     JOIN questions q ON a.question_id = q.id
     WHERE a.visitor_id = ?
     GROUP BY q.dimension'
);
$stmt->execute([$visitor]);

foreach ($stmt as $row) {
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

$persist = $pdo->prepare(
    'INSERT INTO results (visitor_id, type_code, detail_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE type_code = VALUES(type_code), detail_json = VALUES(detail_json)'
);
$persist->execute([$visitor, $type, json_encode($sums)]);

echo json_encode(['type' => $type, 'scores' => $sums], JSON_UNESCAPED_UNICODE);
