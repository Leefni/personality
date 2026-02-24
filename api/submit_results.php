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

$questions = [];
foreach ($pdo->query('SELECT id, dimension, direction, weight FROM questions') as $question) {
    $questions[(int) $question['id']] = $question;
}

$sums = ['EI' => 0.0, 'SN' => 0.0, 'TF' => 0.0, 'JP' => 0.0];

$stmt = $pdo->prepare('SELECT question_id, value FROM answers WHERE visitor_id = ?');
$stmt->execute([$visitor]);

foreach ($stmt as $answer) {
    $questionId = (int) $answer['question_id'];
    if (!isset($questions[$questionId])) {
        continue;
    }

    $question = $questions[$questionId];
    $delta = ((int) $answer['value']) - 3;
    $dimension = $question['dimension'];

    $sums[$dimension] += $delta * (int) $question['direction'] * (float) $question['weight'];
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
