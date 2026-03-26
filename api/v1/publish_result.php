<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
if ($visitor === '') {
    json_error('No visitor session', 400);
}

$displayName = '';
if (isset($payload['display_name']) && is_string($payload['display_name'])) {
    $displayName = trim($payload['display_name']);
}

$cached = get_cached_result($pdo, $visitor);
if ($cached === null) {
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

    cache_result($pdo, $visitor, $type, $scores);

    $cached = [
        'type' => $type,
        'scores' => $scores,
    ];
}

$publicResult = $quizRepository->createPublicResult(
    $visitor,
    $displayName,
    (string) $cached['type'],
    is_array($cached['scores']) ? $cached['scores'] : []
);

json_success([
    'public_id' => $publicResult['public_id'],
    'created_at' => $publicResult['created_at'],
]);
