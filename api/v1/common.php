<?php
declare(strict_types=1);

// Ensure PHP errors never bleed into the JSON response body.
// On dev servers display_errors is often On by default, which
// would prepend HTML error text before the JSON, breaking JSON.parse().
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Custom error handler: converts fatal errors into JSON 500 responses
// so the browser always gets parseable output instead of an empty body.
set_error_handler(function (int $errno, string $errstr, string $errfile, int $errline): bool {
    if (!(error_reporting() & $errno)) {
        return false; // Respect error_reporting level.
    }
    error_log("[PHP error $errno] $errstr in $errfile:$errline");
    return true; // Don't execute PHP's internal handler.
});

register_shutdown_function(function (): void {
    $error = error_get_last();
    if ($error === null) {
        return;
    }
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($error['type'], $fatalTypes, true)) {
        return;
    }
    // Fatal error: send JSON 500 so the client gets a parseable response.
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
        'error' => true,
        'message' => 'Er ging iets mis op de server. Probeer het later opnieuw.',
    ]);
});

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
