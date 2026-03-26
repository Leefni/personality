<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('POST');

$payload = get_json_payload();
$visitor = get_visitor_id($payload);
$displayName = isset($payload['display_name']) && is_string($payload['display_name'])
    ? trim($payload['display_name'])
    : null;
if ($visitor === '') {
    json_error('No visitor session', 400);
}

$cached = get_cached_result($pdo, $visitor);
if ($cached !== null) {
    $quizRepository->upsertResultShareMeta($visitor, $displayName, true);

    json_success([
        'type' => $cached['type'],
        'scores' => is_array($cached['scores']) ? $cached['scores'] : new stdClass(),
        'max_scores' => $quizRepository->getMaxTheoreticalScores(),
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

cache_result($pdo, $visitor, $type, $scores, $displayName, true);

json_success([
    'type' => $type,
    'scores' => $scores,
    'max_scores' => $quizRepository->getMaxTheoreticalScores(),
    'metadata' => get_test_metadata($quizRepository),
]);
