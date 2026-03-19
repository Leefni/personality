<?php
declare(strict_types=1);

require __DIR__ . '/../../db.php';
require __DIR__ . '/../../src/QuizRepository.php';
require __DIR__ . '/../../src/QuizService.php';

require __DIR__ . '/http/response.php';
require __DIR__ . '/http/request.php';
require __DIR__ . '/http/visitor.php';
require __DIR__ . '/cache.php';

$quizRepository = new QuizRepository($pdo);
$quizService = new QuizService();

/** @return array{version:string,date:string,question_count:int} */
function get_test_metadata(QuizRepository $quizRepository): array
{
    global $config;

    $version = isset($config['test_version']) ? trim((string) $config['test_version']) : '';
    if ($version === '') {
        $version = '2026.03';
    }

    $date = isset($config['test_release_date']) ? trim((string) $config['test_release_date']) : '';
    if ($date === '') {
        $date = '2026-03-18';
    }

    return [
        'version' => $version,
        'date' => $date,
        'question_count' => $quizRepository->getTotalQuestionCount(),
    ];
}
