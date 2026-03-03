<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$questionId = isset($payload['question_id']) ? (int) $payload['question_id'] : 0;
$value = isset($payload['value']) ? (int) $payload['value'] : 0;

if ($questionId <= 0 || $value < 1 || $value > 5) {
    json_error('Invalid payload', 422);
}

$questionExistsStmt = $pdo->prepare('SELECT 1 FROM questions WHERE id = ?');
$questionExistsStmt->execute([$questionId]);
if ($questionExistsStmt->fetchColumn() === false) {
    json_error('Unknown question_id', 422);
}

$visitor = ensure_visitor_id($payload);

$stmt = $pdo->prepare(
    'INSERT INTO answers (question_id, visitor_id, value)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)'
);
$stmt->execute([$questionId, $visitor, $value]);

clear_visitor_cache($visitor);

json_success(['ok' => true, 'visitor_id' => $visitor]);
