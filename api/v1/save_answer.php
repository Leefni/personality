<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$questionId = isset($payload['question_id']) ? (int) $payload['question_id'] : 0;
$value = isset($payload['value']) ? (int) $payload['value'] : 0;

$likertMin = 1;
$likertMax = 6;

if ($questionId <= 0 || $value < $likertMin || $value > $likertMax) {
    json_error('Invalid payload', 422);
}

if (!$quizRepository->questionExists($questionId)) {
    json_error('Unknown question_id', 422);
}

$visitor = ensure_visitor_id($payload);
$quizRepository->saveAnswer($questionId, $visitor, $value);
invalidate_cached_result($pdo, $visitor);

json_success(['ok' => true, 'visitor_id' => $visitor]);
