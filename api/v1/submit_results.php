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
        'metadata' => get_test_metadata($quizRepository),
    ]);
}

$totalQuestions = $quizRepository->getTotalQuestionCount();
$answeredCount = $quizRepository->getAnsweredQuestionCount($visitor);

if (!$quizService->isComplete($answeredCount, $totalQuestions)) {
    json_error('Incomplete test', 422, [
        'answered' => $answeredCount,
        'total' => $totalQuestions,
    ]);
}

$scores = $quizRepository->getDimensionScores($visitor);
$type = $quizService->deriveType($scores);

$quizRepository->saveResult($visitor, $type, $scores);
cache_result($pdo, $visitor, $type, $scores);

json_success([
    'type' => $type,
    'scores' => $scores,
    'metadata' => get_test_metadata($quizRepository),
]);
