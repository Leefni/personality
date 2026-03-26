<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

require_method('GET');

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 36;
$results = $quizRepository->getPublicResults($limit);

json_success([
    'results' => $results,
]);
