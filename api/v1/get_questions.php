<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = max(1, min(100, (int) ($_GET['per_page'] ?? 10)));
$offset = ($page - 1) * $perPage;

$result = $quizRepository->getQuestionsPage($perPage, $offset);

json_success([
    'questions' => $result['questions'],
    'page' => $page,
    'per_page' => $perPage,
    'total' => $result['total'],
]);
