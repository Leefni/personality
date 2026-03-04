<?php
declare(strict_types=1);

require __DIR__ . '/../../db.php';
require __DIR__ . '/../../src/QuizRepository.php';
require __DIR__ . '/../../src/QuizService.php';

require __DIR__ . '/http/response.php';
require __DIR__ . '/http/request.php';
require __DIR__ . '/http/visitor.php';
require __DIR__ . '/results_cache.php';

$quizRepository = new QuizRepository($pdo);
$quizService = new QuizService();
