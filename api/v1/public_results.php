<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('GET');

$publicId = isset($_GET['public_id']) ? trim((string) $_GET['public_id']) : '';
if ($publicId !== '') {
    $result = $quizRepository->getPublicResultByPublicId($publicId);
    if ($result === null) {
        json_error('Publiek resultaat niet gevonden', 404);
    }

    json_success([
        'result' => $result,
        'max_scores' => $quizRepository->getMaxTheoreticalScores(),
    ]);
}

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 20)));
$offset = ($page - 1) * $perPage;

$results = $quizRepository->listRecentVisiblePublicResults($perPage, $offset);

json_success([
    'results' => $results['results'],
    'page' => $page,
    'per_page' => $perPage,
    'total' => $results['total'],
    'max_scores' => $quizRepository->getMaxTheoreticalScores(),
]);
