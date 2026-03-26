<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('GET');

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 36;
$results = $quizRepository->getPublicResults($limit);

json_success([
    'results' => $results,
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 20)));
$offset = ($page - 1) * $perPage;

$results = $quizRepository->listRecentVisiblePublicResults($perPage, $offset);

json_success([
    'results' => $results['results'],
    'page' => $page,
    'per_page' => $perPage,
    'total' => $results['total'],
]);
