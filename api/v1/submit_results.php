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
    if (isset($cached['type']) && is_string($cached['type'])) {
        json_success([
            'type' => $cached['type'],
            'scores' => is_array($cached['scores'] ?? null) ? $cached['scores'] : new stdClass(),
        ]);
    }
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

$cache[$visitor] = ['type' => $type, 'scores' => $scores];
write_results_cache($cache);

json_success(['type' => $type, 'scores' => $scores]);
